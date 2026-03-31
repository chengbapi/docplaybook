import type {
  AppConfig,
  DocSet,
  DocSetRuntimeState,
  DocumentSnapshot,
  ManualCorrection,
  ModelUsageStats
} from '../types.js';
import { parseMarkdownSnapshot, getChangedBlockIndexes, renderSnapshot, snapshotsHaveSameShape } from '../markdown/blocks.js';
import { MemoryStore } from '../memories/memory-store.js';
import { Translator } from '../translation/translator.js';
import { MemoryUpdater } from '../translation/memory-updater.js';
import { debugLog, formatDuration, label, verboseLog } from '../ui.js';
import { nowIso } from '../utils.js';
import { RuntimeStore } from '../state/runtime-store.js';
import { LocalFolderProvider } from '../providers/local-folder-provider.js';
import { RequestPool } from '../concurrency/request-pool.js';
import {
  DEFAULT_MAX_CONCURRENT_REQUESTS,
  MAX_MAX_CONCURRENT_REQUESTS
} from '../config.js';

export class DocSetProcessor {
  private readonly memoryStore: MemoryStore;

  public constructor(
    private readonly workspaceRoot: string,
    private readonly config: AppConfig,
    private readonly provider: LocalFolderProvider,
    private readonly runtimeStore: RuntimeStore,
    private readonly translator: Translator,
    private readonly memoryUpdater: MemoryUpdater,
    private readonly managedWrites: Set<string>
  ) {
    this.memoryStore = new MemoryStore(workspaceRoot);
  }

  public async processDocSet(docSet: DocSet, reason: string): Promise<void> {
    await this.learnWorkspace([docSet], this.config.targetLanguages);
    await this.translateDocSet(docSet, reason, this.config.targetLanguages);
  }

  public async translateDocSet(docSet: DocSet, reason: string, targetLanguages: string[]): Promise<void> {
    const startedAt = Date.now();
    const totals = zeroUsage();
    const state = await this.runtimeStore.load();
    const docState: DocSetRuntimeState = state.docSets[docSet.id] ?? {
      docSetId: docSet.id,
      targets: {},
      updatedAt: nowIso()
    };

    const sourceRaw = await this.provider.read(docSet.source.relativePath);
    const currentSourceSnapshot = parseMarkdownSnapshot(docSet.source.relativePath, sourceRaw);
    console.log(
      `${label('translate', 'blue')} ${docSet.source.relativePath} (${targetLanguages.join(', ')}, reason: ${reason})`
    );
    verboseLog(
      'sync',
      'cyan',
      `Loaded source snapshot for ${docSet.source.relativePath} with ${currentSourceSnapshot.blocks.length} total block(s).`
    );
    debugLog(
      `${docSet.source.relativePath}: source snapshot block kinds = ${currentSourceSnapshot.blocks.map((block) => `${block.index + 1}:${block.kind}:${block.translatable ? 'T' : 'N'}`).join(', ')}.`
    );
    const requestPool = new RequestPool(
      MAX_MAX_CONCURRENT_REQUESTS,
      this.config.concurrency?.maxConcurrentRequests ?? DEFAULT_MAX_CONCURRENT_REQUESTS
    );
    verboseLog(
      'sync',
      'cyan',
      `Using shared request pool limit ${requestPool.getLimit()} for ${docSet.source.relativePath}.`
    );

    const targetResults = await Promise.all(
      targetLanguages.map(async (targetLanguage) => {
        const nextTarget = await requestPool.run(() =>
          this.syncTarget({
            docSet,
            docState,
            sourceSnapshot: currentSourceSnapshot,
            targetLanguage,
            reason,
            requestPool
          })
        );

        return {
          targetLanguage,
          snapshot: nextTarget.snapshot,
          usage: nextTarget.usage
        };
      })
    );

    for (const targetResult of targetResults) {
      addUsage(totals, targetResult.usage);
      docState.targets[targetResult.targetLanguage] = {
        language: targetResult.targetLanguage,
        accepted: targetResult.snapshot,
        generated: targetResult.snapshot
      };
    }

    docState.source = currentSourceSnapshot;
    docState.updatedAt = nowIso();
    state.docSets[docSet.id] = docState;
    await this.runtimeStore.save(state);

    console.log(
      `${label('done', 'green')} ${docSet.source.relativePath} translated in ${formatDuration(Date.now() - startedAt)} (input: ${totals.inputTokens}, output: ${totals.outputTokens}, total: ${totals.totalTokens}).`
    );
  }

  public async learnWorkspace(docSets: DocSet[], targetLanguages: string[]): Promise<void> {
    const startedAt = Date.now();
    const totals = zeroUsage();
    const state = await this.runtimeStore.load();
    const correctionsByLanguage = new Map<string, ManualCorrection[]>();
    let touchedTargets = 0;

    for (const docSet of docSets) {
      const docState = state.docSets[docSet.id];
      if (!docState?.source) {
        continue;
      }

      for (const targetLanguage of targetLanguages) {
        const targetRef = docSet.targets[targetLanguage];
        const previousTargetState = docState.targets[targetLanguage];
        if (!previousTargetState?.generated) {
          continue;
        }

        if (!(await this.provider.exists(targetRef.relativePath))) {
          continue;
        }

        const currentTargetSnapshot = parseMarkdownSnapshot(
          targetRef.relativePath,
          await this.provider.read(targetRef.relativePath)
        );
        if (currentTargetSnapshot.hash === previousTargetState.generated.hash) {
          continue;
        }

        touchedTargets += 1;
        console.log(`${label('learn', 'magenta')} ${targetRef.relativePath}`);
        const rewriteJudgement = await this.judgeManualRewrite({
          targetLanguage,
          generatedTargetSnapshot: previousTargetState.generated,
          currentTargetSnapshot
        });
        addUsage(totals, rewriteJudgement.usage);
        console.log(
          `${label('memory', 'magenta')} Rewrite check for ${targetRef.relativePath}: ${rewriteJudgement.isMajorRewrite ? 'major rewrite' : 'reusable corrections'} (${rewriteJudgement.reason}).`
        );

        docState.targets[targetLanguage] = {
          language: targetLanguage,
          accepted: currentTargetSnapshot,
          generated: currentTargetSnapshot
        };

        if (rewriteJudgement.isMajorRewrite) {
          continue;
        }

        const corrections = this.collectManualCorrections(
          docState.source,
          previousTargetState.generated,
          currentTargetSnapshot
        );
        if (corrections === 'skip' || corrections.length === 0) {
          continue;
        }

        const existing = correctionsByLanguage.get(targetLanguage) ?? [];
        existing.push(...corrections);
        correctionsByLanguage.set(targetLanguage, existing);
      }
    }

    for (const targetLanguage of targetLanguages) {
      const corrections = correctionsByLanguage.get(targetLanguage) ?? [];
      if (corrections.length === 0) {
        continue;
      }

      const currentPlaybook = await this.memoryStore.readPlaybook();
      const updatedPlaybook = await this.memoryUpdater.updateMemory({
        scope: 'playbook',
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage,
        memoryText: currentPlaybook,
        corrections
      });
      addUsage(totals, updatedPlaybook.usage);
      await this.memoryStore.writePlaybook(stripOuterMarkdownFence(updatedPlaybook.text));
      console.log(
        `${label('memory', 'magenta')} Updated global playbook from ${targetLanguage} review corrections.`
      );

      const currentMemory = await this.memoryStore.read(targetLanguage);
      const updatedMemory = await this.memoryUpdater.updateMemory({
        scope: 'memory',
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage,
        memoryText: currentMemory,
        corrections
      });
      addUsage(totals, updatedMemory.usage);
      await this.memoryStore.write(targetLanguage, stripOuterMarkdownFence(updatedMemory.text));
      console.log(
        `${label('memory', 'magenta')} Updated ${targetLanguage} memory with ${corrections.length} correction(s).`
      );
    }

    await this.runtimeStore.save(state);

    if (touchedTargets === 0) {
      console.log(`${label('learn', 'magenta')} No manual translation changes were found.`);
      return;
    }

    console.log(
      `${label('done', 'green')} Learned from ${touchedTargets} edited translation file(s) in ${formatDuration(Date.now() - startedAt)} (input: ${totals.inputTokens}, output: ${totals.outputTokens}, total: ${totals.totalTokens}).`
    );
  }

  private async syncTarget(input: {
    docSet: DocSet;
    docState: DocSetRuntimeState;
    sourceSnapshot: DocumentSnapshot;
    targetLanguage: string;
    reason: string;
    requestPool: RequestPool;
  }): Promise<{
    snapshot: DocumentSnapshot;
    usage: ModelUsageStats;
  }> {
    const targetRef = input.docSet.targets[input.targetLanguage];
    console.log(`${label('translate', 'blue')} ${input.docSet.source.relativePath} -> ${targetRef.relativePath}`);
    const currentMemory = await this.memoryStore.readPromptContext(input.targetLanguage);
    const targetExists = await this.provider.exists(targetRef.relativePath);
    const currentTargetSnapshot = targetExists
      ? parseMarkdownSnapshot(targetRef.relativePath, await this.provider.read(targetRef.relativePath))
      : undefined;
    const previousTargetSnapshot =
      currentTargetSnapshot ?? input.docState.targets[input.targetLanguage]?.accepted;

    const changedBlockIndexes = getChangedBlockIndexes(
      input.docState.source,
      input.sourceSnapshot
    );
    const sourceChanged = changedBlockIndexes.length > 0;
    const targetShapeMatchesSource = snapshotsHaveSameShape(
      previousTargetSnapshot,
      input.sourceSnapshot
    );

    const nextBlockRaws: string[] = [];
    const translatedIndexes: number[] = [];
    const translatableBlocks = input.sourceSnapshot.blocks.filter((block) => block.translatable).length;
    const pendingBlocks = input.sourceSnapshot.blocks
      .filter((block) => {
        if (!block.translatable) {
          return false;
        }

        const existingTranslation = previousTargetSnapshot?.blocks[block.index]?.raw;
        const shouldTranslate =
          !targetExists ||
          !previousTargetSnapshot ||
          changedBlockIndexes.includes(block.index) ||
          (sourceChanged && !targetShapeMatchesSource);

        return shouldTranslate || !existingTranslation;
      });
    const usage = zeroUsage();
    verboseLog(
      'target',
      'cyan',
      `${targetRef.relativePath}: ${pendingBlocks.length}/${translatableBlocks} translatable block(s) need translation.`
    );
    debugLog(
      `${targetRef.relativePath}: changed source indexes = ${changedBlockIndexes.length > 0 ? changedBlockIndexes.map((index) => index + 1).join(', ') : '(none)'}, sourceChanged=${sourceChanged}, targetShapeMatchesSource=${targetShapeMatchesSource}.`
    );
    debugLog(
      `${targetRef.relativePath}: pending source indexes = ${pendingBlocks.length > 0 ? pendingBlocks.map((block) => block.index + 1).join(', ') : '(none)'}.`
    );

    for (const block of input.sourceSnapshot.blocks) {
      const existingTranslation = previousTargetSnapshot?.blocks[block.index]?.raw;

      if (!block.translatable) {
        nextBlockRaws[block.index] = block.raw;
        continue;
      }

      const shouldTranslate =
        !targetExists ||
        !previousTargetSnapshot ||
        changedBlockIndexes.includes(block.index) ||
        (sourceChanged && !targetShapeMatchesSource);

      if (!shouldTranslate && existingTranslation) {
        nextBlockRaws[block.index] = existingTranslation;
        continue;
      }
    }

    if (pendingBlocks.length > 0) {
      verboseLog(
        'target',
        'cyan',
        `${targetRef.relativePath}: translating the whole article in a single request.`
      );
      debugLog(
        `${targetRef.relativePath}: single article translation request covers source indexes ${pendingBlocks.map((block) => block.index + 1).join(', ')}.`
      );

      const articleResult = await this.withRateLimitRetry(
        () =>
          this.translateArticleOnce({
            docKey: input.docSet.docKey,
            sourceLanguage: this.config.sourceLanguage,
            targetLanguage: input.targetLanguage,
            memoryText: currentMemory,
            blocks: pendingBlocks
          }),
        input.requestPool
      );

      addUsage(usage, articleResult.usage);
      verboseLog(
        'target',
        'cyan',
        `${targetRef.relativePath}: article translation finished, tokens ${articleResult.usage.totalTokens}.`
      );

      for (const item of articleResult.items) {
        nextBlockRaws[item.index] = stripOuterMarkdownFence(item.text);
        translatedIndexes.push(item.index);
      }
    }

    const nextRaw = renderSnapshot(input.sourceSnapshot, nextBlockRaws);
    const previousRaw = currentTargetSnapshot ? renderSnapshot(currentTargetSnapshot, currentTargetSnapshot.blocks.map((block) => block.raw)) : '';

    if (!targetExists || previousRaw !== nextRaw) {
      this.managedWrites.add(targetRef.relativePath);
      await this.provider.write(targetRef.relativePath, nextRaw);
      verboseLog(
        'write',
        'cyan',
        `${targetRef.relativePath}: wrote updated translation file (${translatedIndexes.length} translated block(s), ${usage.totalTokens} tokens).`
      );
      setTimeout(() => {
        this.managedWrites.delete(targetRef.relativePath);
      }, 1_500);
    } else {
      verboseLog(
        'write',
        'cyan',
        `${targetRef.relativePath}: no file changes were needed after sync.`
      );
    }

    const nextSnapshot = parseMarkdownSnapshot(targetRef.relativePath, nextRaw);

    return {
      snapshot: nextSnapshot,
      usage
    };
  }

  private async translateArticleOnce(input: {
    docKey: string;
    sourceLanguage: string;
    targetLanguage: string;
    memoryText: string;
    blocks: Array<{
      index: number;
      raw: string;
      translatable: boolean;
    }>;
  }): Promise<{
    items: Array<{ index: number; text: string }>;
    usage: ModelUsageStats;
  }> {
    if (input.blocks.length === 1) {
      verboseLog('target', 'cyan', `${input.targetLanguage}: only one block changed, using a single direct translation call.`);
      const block = input.blocks[0]!;
      return this.translateSingleBlock({
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        memoryText: input.memoryText,
        docKey: input.docKey,
        block
      });
    }

    const translatorWithBatch = this.translator as Translator & {
      translateBlocks?: (input: {
        sourceLanguage: string;
        targetLanguage: string;
        memoryText: string;
        docKey: string;
        blocks: Array<{
          index: number;
          sourceBlock: string;
          existingTranslation?: string;
        }>;
      }) => Promise<{ texts: string[]; usage: ModelUsageStats }>;
    };

    if (typeof translatorWithBatch.translateBlocks !== 'function') {
      throw new Error('Translator does not support whole-article batch translation.');
    }

    const translated = await translatorWithBatch.translateBlocks({
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      memoryText: input.memoryText,
      docKey: input.docKey,
      blocks: input.blocks.map((block) => ({
        index: block.index,
        sourceBlock: block.raw
      }))
    });

    return {
      items: input.blocks.map((block, idx) => ({
        index: block.index,
        text: translated.texts[idx] ?? ''
      })),
      usage: translated.usage
    };
  }

  private async translateSingleBlock(input: {
    sourceLanguage: string;
    targetLanguage: string;
    memoryText: string;
    docKey: string;
    block: {
      index: number;
      raw: string;
      translatable: boolean;
    };
  }): Promise<{
    items: Array<{ index: number; text: string }>;
    usage: ModelUsageStats;
  }> {
    debugLog(
      `${input.targetLanguage}: translate single source index ${input.block.index + 1}, chars=${input.block.raw.length}.`
    );
    const translated = await this.translator.translateBlock({
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      memoryText: input.memoryText,
      sourceBlock: input.block.raw,
      docKey: input.docKey
    });

    return {
      items: [{ index: input.block.index, text: translated.text }],
      usage: translated.usage
    };
  }

  private async withRateLimitRetry<T>(
    task: () => Promise<T>,
    requestPool?: RequestPool,
    attempt = 1
  ): Promise<T> {
    try {
      return await task();
    } catch (error) {
      if (!isRetryableRateLimitError(error) || attempt >= 3) {
        throw error;
      }

      requestPool?.noteRateLimit();
      const delayMs = 500 * 2 ** (attempt - 1);
      console.warn(
        `${label('warning', 'yellow')} Rate limited. Retrying in ${delayMs}ms (attempt ${attempt + 1}/3).`
      );
      verboseLog(
        'retry',
        'cyan',
        `Rate limit retry scheduled after ${delayMs}ms (attempt ${attempt + 1}/3).`
      );
      await sleep(delayMs);
      return this.withRateLimitRetry(task, requestPool, attempt + 1);
    }
  }

  private async judgeManualRewrite(input: {
    targetLanguage: string;
    generatedTargetSnapshot: DocumentSnapshot;
    currentTargetSnapshot: DocumentSnapshot;
  }): Promise<{ isMajorRewrite: boolean; reason: string; usage: ModelUsageStats }> {
    const judge = this.memoryUpdater as MemoryUpdater & {
      judgeManualRewrite?: (input: {
        sourceLanguage: string;
        targetLanguage: string;
        generatedTargetSnapshot: DocumentSnapshot;
        currentTargetSnapshot: DocumentSnapshot;
      }) => Promise<{ isMajorRewrite: boolean; reason: string; usage: ModelUsageStats }>;
    };

    if (typeof judge.judgeManualRewrite === 'function') {
      return judge.judgeManualRewrite({
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage: input.targetLanguage,
        generatedTargetSnapshot: input.generatedTargetSnapshot,
        currentTargetSnapshot: input.currentTargetSnapshot
      });
    }

    return {
      isMajorRewrite: isLikelyLargeRewrite(input.generatedTargetSnapshot, input.currentTargetSnapshot),
      reason: 'Fallback heuristic: no model-based rewrite judge was available.',
      usage: zeroUsage()
    };
  }

  private collectManualCorrections(
    previousSourceSnapshot: DocumentSnapshot | undefined,
    generatedTargetSnapshot: DocumentSnapshot | undefined,
    currentTargetSnapshot: DocumentSnapshot
  ): ManualCorrection[] | 'skip' {
    if (!previousSourceSnapshot || !generatedTargetSnapshot) {
      return [];
    }

    if (!snapshotsHaveSameShape(previousSourceSnapshot, generatedTargetSnapshot)) {
      return [];
    }

    if (!snapshotsHaveSameShape(generatedTargetSnapshot, currentTargetSnapshot)) {
      return 'skip';
    }

    const corrections: ManualCorrection[] = [];
    let changedTranslatableBlocks = 0;

    for (const block of generatedTargetSnapshot.blocks) {
      if (!block.translatable) {
        continue;
      }

      const currentBlock = currentTargetSnapshot.blocks[block.index];
      const sourceBlock = previousSourceSnapshot.blocks[block.index];

      if (!currentBlock || !sourceBlock) {
        continue;
      }

      if (currentBlock.raw !== block.raw) {
        changedTranslatableBlocks += 1;
        corrections.push({
          index: block.index,
          sourceBlock: sourceBlock.raw,
          previousTranslation: block.raw,
          correctedTranslation: currentBlock.raw
        });
      }
    }

    const totalTranslatableBlocks = generatedTargetSnapshot.blocks.filter((block) => block.translatable).length;
    if (
      totalTranslatableBlocks >= 5 &&
      changedTranslatableBlocks >= 3 &&
      changedTranslatableBlocks / totalTranslatableBlocks > 0.6
    ) {
      return 'skip';
    }

    return corrections;
  }
}

function zeroUsage(): ModelUsageStats {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  };
}

function addUsage(target: ModelUsageStats, usage: ModelUsageStats): void {
  target.inputTokens += usage.inputTokens;
  target.outputTokens += usage.outputTokens;
  target.totalTokens += usage.totalTokens;
}

function stripOuterMarkdownFence(text: string): string {
  const normalized = text.trim();
  const match = normalized.match(/^```(?:md|markdown)?\n([\s\S]*?)\n```$/i);
  if (!match) {
    return normalized;
  }

  return match[1] ?? normalized;
}

function isLikelyLargeRewrite(
  generatedTargetSnapshot: DocumentSnapshot,
  currentTargetSnapshot: DocumentSnapshot
): boolean {
  if (!snapshotsHaveSameShape(generatedTargetSnapshot, currentTargetSnapshot)) {
    return true;
  }

  const generatedBlocks = generatedTargetSnapshot.blocks.filter((block) => block.translatable);
  const changedBlocks = generatedBlocks.filter((block) => {
    const currentBlock = currentTargetSnapshot.blocks[block.index];
    return currentBlock && currentBlock.raw !== block.raw;
  }).length;

  return generatedBlocks.length >= 5 && changedBlocks >= 3 && changedBlocks / generatedBlocks.length > 0.6;
}

function isRetryableRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const record = error as Error & {
    statusCode?: number;
    status?: number;
    cause?: unknown;
  };
  const statusCode =
    record.statusCode ??
    record.status ??
    (typeof record.cause === 'object' && record.cause !== null && 'status' in record.cause
      ? Number((record.cause as { status?: number }).status)
      : undefined);

  if (statusCode === 429) {
    return true;
  }

  const message = `${error.message} ${String(record.cause ?? '')}`.toLowerCase();
  return message.includes('429') || message.includes('rate limit') || message.includes('too many requests');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
