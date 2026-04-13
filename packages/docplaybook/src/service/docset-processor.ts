import type {
  AppConfig,
  BootstrapExample,
  DocSet,
  DocSetTranslateResult,
  LearnCandidate,
  LearnJudgement,
  ModelUsageStats
} from '../types.js';
import {
  parseDocumentSnapshot,
  renderSnapshot,
  snapshotsHaveSameShape
} from '../markdown/blocks.js';
import { MemoryStore } from '../memories/memory-store.js';
import { GlossaryStore } from '../memories/glossary-store.js';
import { reviewCandidatesInteractively } from '../learn/interactive.js';
import { parseGlossaryRule } from '../translation/memory-updater.js';
import { Translator } from '../translation/translator.js';
import { MemoryUpdater } from '../translation/memory-updater.js';
import { debugLog, formatDuration, label, verboseLog } from '../ui.js';
import { sha256 } from '../utils.js';
import { LocalFolderProvider } from '../providers/local-folder-provider.js';
import { LearnedTargetHashStore } from '../state/learned-target-hash-store.js';
import { SourceHashStore } from '../state/source-hash-store.js';
import { RequestPool } from '../concurrency/request-pool.js';
import {
  DEFAULT_MAX_CONCURRENT_REQUESTS,
  MAX_MAX_CONCURRENT_REQUESTS
} from '../config.js';
import type { DocplaybookObservability } from '../observability.js';
import { noopObservability } from '../observability.js';

const MAX_BOOTSTRAP_PAIRS_PER_DOC = 12;

export class DocSetProcessor {
  private readonly memoryStore: MemoryStore;
  private readonly sourceHashStore: SourceHashStore;
  private readonly learnedTargetHashStore: LearnedTargetHashStore;

  private readonly glossaryStore: GlossaryStore;

  public constructor(
    private readonly workspaceRoot: string,
    private readonly config: AppConfig,
    private readonly provider: LocalFolderProvider,
    private readonly translator: Translator,
    private readonly memoryUpdater: MemoryUpdater,
    private readonly managedWrites: Set<string>,
    private readonly observability: DocplaybookObservability = noopObservability
  ) {
    this.memoryStore = new MemoryStore(workspaceRoot);
    this.glossaryStore = new GlossaryStore(workspaceRoot);
    this.sourceHashStore = new SourceHashStore(workspaceRoot);
    this.learnedTargetHashStore = new LearnedTargetHashStore(workspaceRoot);
  }

  public async bootstrapWorkspace(
    docSets: DocSet[],
    targetLanguages: string[],
    docLimits: Map<string, number | null> = new Map()
  ): Promise<void> {
    const startedAt = Date.now();
    const totals = zeroUsage();

    for (const targetLanguage of targetLanguages) {
      const examples = await this.collectBootstrapExamples(
        docSets,
        targetLanguage,
        docLimits.get(targetLanguage) ?? null
      );
      if (examples.length === 0) {
        console.log(`${label('bootstrap', 'yellow')} No aligned ${targetLanguage} examples were found.`);
        continue;
      }

      const currentPlaybook = await this.memoryStore.readPlaybook();
      const nextPlaybook = await this.memoryUpdater.bootstrapMemory({
        scope: 'playbook',
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage,
        memoryText: currentPlaybook,
        examples
      });
      addUsage(totals, nextPlaybook.usage);
      await this.memoryStore.writePlaybook(nextPlaybook.text);

      const currentMemory = await this.memoryStore.read(targetLanguage);
      const nextMemory = await this.memoryUpdater.bootstrapMemory({
        scope: 'memory',
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage,
        memoryText: currentMemory,
        examples
      });
      addUsage(totals, nextMemory.usage);
      await this.memoryStore.write(targetLanguage, nextMemory.text);

      console.log(
        `${label('bootstrap', 'magenta')} Built playbook and ${targetLanguage} memory from ${examples.length} aligned document(s).`
      );
    }

    console.log(
      `${label('done', 'green')} Bootstrap finished in ${formatDuration(Date.now() - startedAt)} (input: ${totals.inputTokens}, output: ${totals.outputTokens}, total: ${totals.totalTokens}).`
    );
  }

  public async translateDocSet(
    docSet: DocSet,
    reason: string,
    targetLanguages: string[],
    options: {
      force?: boolean;
      requestPool?: RequestPool;
      pathLocks?: Map<string, Promise<void>>;
    } = {}
  ): Promise<DocSetTranslateResult> {
    const sourceRaw = await this.provider.read(docSet.source.relativePath);
    const sourceHash = sha256(sourceRaw);
    const currentSourceSnapshot = parseDocumentSnapshot(docSet.source.relativePath, sourceRaw, {
      layoutKind: this.config.layout.kind,
      language: this.config.sourceLanguage
    });
    const changedBlockIndexes = currentSourceSnapshot.blocks
      .filter((block) => block.translatable)
      .map((block) => block.index);

    const targetLanguagesToProcess: string[] = [];
    for (const targetLanguage of targetLanguages) {
      const targetRef = docSet.targets[targetLanguage];
      if (!targetRef) {
        continue;
      }

      if (options.force) {
        targetLanguagesToProcess.push(targetLanguage);
        continue;
      }

      const hasTarget = await this.provider.exists(targetRef.relativePath);
      const recordedHash = await this.sourceHashStore.get(targetRef.relativePath);
      if (hasTarget && recordedHash === sourceHash) {
        verboseLog(
          'skip',
          'cyan',
          `${targetRef.relativePath}: source hash unchanged, skipping translation.`
        );
        continue;
      }

      targetLanguagesToProcess.push(targetLanguage);
    }

    if (targetLanguagesToProcess.length === 0) {
      verboseLog('skip', 'cyan', `${docSet.source.relativePath} (all targets up to date)`);
      return { skipped: true, sourcePath: docSet.source.relativePath, perLanguage: [] };
    }

    debugLog(
      `${docSet.source.relativePath}: sourceChangedIndexes=${changedBlockIndexes.length > 0 ? changedBlockIndexes.map((index) => index + 1).join(', ') : '(none)'}, mode=full-document-on-source-change.`
    );

    const requestPool = options.requestPool ?? new RequestPool(
      MAX_MAX_CONCURRENT_REQUESTS,
      this.config.concurrency?.maxConcurrentRequests ?? DEFAULT_MAX_CONCURRENT_REQUESTS
    );

    const languagesByPath = new Map<string, string[]>();
    for (const targetLanguage of targetLanguagesToProcess) {
      const targetPath = docSet.targets[targetLanguage]?.relativePath;
      if (!targetPath) {
        continue;
      }
      const group = languagesByPath.get(targetPath) ?? [];
      group.push(targetLanguage);
      languagesByPath.set(targetPath, group);
    }

    const pathTasks = [...languagesByPath.entries()].map(([targetPath, groupedLanguages]) =>
      this.runTranslateTaskForPath({
        docSet,
        sourceSnapshot: currentSourceSnapshot,
        sourceHash,
        targetPath,
        targetLanguages: groupedLanguages,
        changedBlockIndexes,
        reason,
        force: Boolean(options.force),
        requestPool,
        pathLocks: options.pathLocks
      })
    );

    const pathResults = await Promise.all(pathTasks);

    const perLanguage: DocSetTranslateResult['perLanguage'] = [];
    for (const result of pathResults) {
      for (const langStat of result.perLanguage) {
        perLanguage.push(langStat);
      }
    }

    return { skipped: false, sourcePath: docSet.source.relativePath, perLanguage };
  }

  private async runTranslateTaskForPath(input: {
    docSet: DocSet;
    sourceSnapshot: ReturnType<typeof parseDocumentSnapshot>;
    sourceHash: string;
    targetPath: string;
    targetLanguages: string[];
    changedBlockIndexes: number[];
    reason: string;
    force: boolean;
    requestPool: RequestPool;
    pathLocks?: Map<string, Promise<void>>;
  }): Promise<{ perLanguage: DocSetTranslateResult['perLanguage'] }> {
    const runTask = async (): Promise<{ perLanguage: DocSetTranslateResult['perLanguage'] }> => {
      const perLanguage: DocSetTranslateResult['perLanguage'] = [];

      for (const targetLanguage of input.targetLanguages) {
        const targetPath = input.docSet.targets[targetLanguage]!.relativePath;
        const memoryRulesInjected = await this.memoryStore.countRules(targetLanguage);
        const result = await this.observability.withSpan(
          'docplaybook.translate.article',
          {
            'docplaybook.doc_key': input.docSet.docKey,
            'docplaybook.source_language': this.config.sourceLanguage,
            'docplaybook.target_language': targetLanguage,
            'docplaybook.source_path': input.docSet.source.relativePath,
            'docplaybook.target_path': targetPath,
            'docplaybook.reason': input.reason,
            'docplaybook.force': input.force
          },
          async (span) => {
            const startedAt = Date.now();
            const translatedTarget = await input.requestPool.run(() =>
              this.syncTarget({
                docSet: input.docSet,
                sourceSnapshot: input.sourceSnapshot,
                targetLanguage,
                changedBlockIndexes: input.changedBlockIndexes,
                forceFullTranslation: true,
                requestPool: input.requestPool
              }),
              {
                label: `${input.docSet.source.relativePath} -> ${targetPath}`
              }
            );
            const elapsedMs = Date.now() - startedAt;
            span.setAttributes({
              'docplaybook.input_tokens': translatedTarget.usage.inputTokens,
              'docplaybook.output_tokens': translatedTarget.usage.outputTokens,
              'docplaybook.total_tokens': translatedTarget.usage.totalTokens,
              'docplaybook.elapsed_ms': elapsedMs
            });
            return { ...translatedTarget, elapsedMs };
          }
        );
        await this.sourceHashStore.set(input.docSet.targets[targetLanguage]!.relativePath, input.sourceHash);
        perLanguage.push({
          targetLanguage,
          elapsedMs: result.elapsedMs,
          totalTokens: result.usage.totalTokens,
          memoryRulesInjected,
          glossaryPatches: result.glossaryPatches,
        });
      }

      return { perLanguage };
    };

    if (!input.pathLocks) {
      return runTask();
    }

    const previous = input.pathLocks.get(input.targetPath) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(runTask);

    input.pathLocks.set(input.targetPath, current.then(() => undefined, () => undefined));
    return current;
  }

  public async learnWorkspace(
    docSets: DocSet[],
    targetLanguages: string[],
    options: { force?: boolean; interactive?: boolean } = {}
  ): Promise<void> {
    // Default interactive=true, but fall back to false in non-TTY environments (CI, pipes)
    const interactive = (options.interactive ?? true) && Boolean(process.stdin.isTTY);
    const startedAt = Date.now();
    const totals = zeroUsage();
    const targetSet = new Set(targetLanguages);
    const candidatesByLanguage = new Map<string, LearnCandidate[]>();

    for (const docSet of docSets) {
      for (const [targetLanguage, targetRef] of Object.entries(docSet.targets)) {
        if (!targetSet.has(targetLanguage) || !(await this.provider.exists(targetRef.relativePath))) {
          continue;
        }

        const currentTargetRaw = await this.provider.read(targetRef.relativePath);
        const currentTargetHash = sha256(currentTargetRaw);
        if (!options.force) {
          const learnedHash = await this.learnedTargetHashStore.get(targetRef.relativePath);
          if (learnedHash === currentTargetHash) {
            verboseLog('skip', 'cyan', `${targetRef.relativePath}: target hash unchanged, skipping learn.`);
            continue;
          }
        }

        const candidates = await this.collectLearnCandidates(docSet, targetLanguage);
        if (candidates.length === 0) {
          continue;
        }

        const existing = candidatesByLanguage.get(targetLanguage) ?? [];
        existing.push(...candidates);
        candidatesByLanguage.set(targetLanguage, existing);
      }
    }

    if (candidatesByLanguage.size === 0) {
      console.log(`${label('learn', 'magenta')} No translation edits required learning.`);
      return;
    }

    for (const targetLanguage of targetLanguages) {
      const candidates = candidatesByLanguage.get(targetLanguage) ?? [];
      if (candidates.length === 0) {
        continue;
      }

      console.log(`${label('learn', 'magenta')} Reviewing ${candidates.length} document(s) for ${targetLanguage}.`);
      const currentPlaybook = await this.memoryStore.readPlaybook();
      const currentMemory = await this.memoryStore.read(targetLanguage);
      const judged = await this.memoryUpdater.judgeLearnCandidates({
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage,
        currentPlaybook,
        currentMemory,
        candidates
      });
      addUsage(totals, judged.usage);

      // Resolve which items to save — either all (non-interactive) or user-confirmed
      const actionableItems = judged.items.filter((item) => item.shouldLearn && item.scope !== 'ignore');

      type SavedItem = { scope: LearnJudgement['scope']; rule: string };
      const toSave: SavedItem[] = [];

      if (interactive && actionableItems.length > 0) {
        const reviewed = await reviewCandidatesInteractively(actionableItems, targetLanguage);
        for (const r of reviewed) {
          if (r.action === 'accept') {
            toSave.push({ scope: r.judgement.scope, rule: r.editedRule ?? r.judgement.proposedRule });
          }
        }
      } else {
        for (const item of actionableItems) {
          toSave.push({ scope: item.scope, rule: item.proposedRule });
        }
      }

      // Route accepted items to the correct store
      const playbookRules = uniqueRulesFromItems(toSave.filter((s) => s.scope === 'playbook'));
      const memoryRules = uniqueRulesFromItems(toSave.filter((s) => s.scope === 'memory'));
      const glossaryItems = toSave.filter((s) => s.scope === 'glossary');

      if (playbookRules.length > 0) {
        const updated = await this.memoryUpdater.mergeRules({
          scope: 'playbook',
          sourceLanguage: this.config.sourceLanguage,
          targetLanguage,
          memoryText: currentPlaybook,
          rules: playbookRules
        });
        addUsage(totals, updated.usage);
        await this.memoryStore.writePlaybook(updated.text);
        console.log(`${label('memory', 'magenta')} Updated global playbook with ${playbookRules.length} rule(s).`);
      }

      if (memoryRules.length > 0) {
        const updated = await this.memoryUpdater.mergeRules({
          scope: 'memory',
          sourceLanguage: this.config.sourceLanguage,
          targetLanguage,
          memoryText: currentMemory,
          rules: memoryRules
        });
        addUsage(totals, updated.usage);
        await this.memoryStore.write(targetLanguage, updated.text);
        console.log(`${label('memory', 'magenta')} Added ${memoryRules.length} rule(s) to ${targetLanguage} memory.`);
      }

      let glossaryAdded = 0;
      for (const item of glossaryItems) {
        const parsed = parseGlossaryRule(item.rule);
        if (!parsed) {
          verboseLog('warn', 'yellow', `Could not parse glossary rule: ${item.rule}`);
          continue;
        }
        await this.glossaryStore.mergeEntry(targetLanguage, parsed.source, parsed.target);
        glossaryAdded += 1;
      }

      if (glossaryAdded > 0) {
        console.log(`${label('glossary', 'green')} Added ${glossaryAdded} term(s) to ${targetLanguage} glossary.`);
      }

      const savedCount = playbookRules.length + memoryRules.length + glossaryAdded;
      const skippedCount = actionableItems.length - toSave.length;
      const ignoredCount = judged.items.filter((item) => !item.shouldLearn || item.scope === 'ignore').length;
      console.log(
        `${label('learn', 'magenta')} ${targetLanguage}: ${savedCount} saved, ${skippedCount > 0 ? `${skippedCount} skipped, ` : ''}${ignoredCount} ignored.`
      );

      const learnedTargetPaths = new Set(candidates.map((candidate) => candidate.targetPath));
      for (const targetPath of learnedTargetPaths) {
        const currentTargetRaw = await this.provider.read(targetPath);
        await this.learnedTargetHashStore.set(targetPath, sha256(currentTargetRaw));
      }
    }

    console.log(
      `${label('done', 'green')} Learned in ${formatDuration(Date.now() - startedAt)} (input: ${totals.inputTokens}, output: ${totals.outputTokens}, total: ${totals.totalTokens}).`
    );
  }

  private async collectBootstrapExamples(
    docSets: DocSet[],
    targetLanguage: string,
    docLimit: number | null
  ): Promise<BootstrapExample[]> {
    const examples: BootstrapExample[] = [];

    for (const docSet of docSets) {
      const targetRef = docSet.targets[targetLanguage];
      if (!targetRef || !(await this.provider.exists(targetRef.relativePath))) {
        continue;
      }

      const sourceSnapshot = parseDocumentSnapshot(
        docSet.source.relativePath,
        await this.provider.read(docSet.source.relativePath),
        { layoutKind: this.config.layout.kind, language: this.config.sourceLanguage }
      );
      const targetSnapshot = parseDocumentSnapshot(
        targetRef.relativePath,
        await this.provider.read(targetRef.relativePath),
        { layoutKind: this.config.layout.kind, language: targetLanguage }
      );

      if (!snapshotsHaveSameShape(sourceSnapshot, targetSnapshot)) {
        continue;
      }

      const pairs = sourceSnapshot.blocks
        .filter((block) => block.translatable)
        .slice(0, MAX_BOOTSTRAP_PAIRS_PER_DOC)
        .map((block) => ({
          blockIndex: block.index + 1,
          sourceBlock: block.raw,
          targetBlock: targetSnapshot.blocks[block.index]?.raw ?? ''
        }))
        .filter((pair) => pair.targetBlock.trim().length > 0);

      if (pairs.length === 0) {
        continue;
      }

      examples.push({
        docKey: docSet.docKey,
        sourcePath: docSet.source.relativePath,
        targetPath: targetRef.relativePath,
        pairs
      });

      if (docLimit !== null && examples.length >= docLimit) {
        break;
      }
    }

    return examples;
  }

  private async collectLearnCandidates(docSet: DocSet, targetLanguage: string): Promise<LearnCandidate[]> {
    const targetRef = docSet.targets[targetLanguage];
    if (!(await this.provider.exists(targetRef.relativePath))) {
      return [];
    }

    const sourceRaw = await this.provider.read(docSet.source.relativePath);
    const targetRaw = await this.provider.read(targetRef.relativePath);
    const sourceSnapshot = parseDocumentSnapshot(
      docSet.source.relativePath,
      sourceRaw,
      { layoutKind: this.config.layout.kind, language: this.config.sourceLanguage }
    );
    const targetSnapshot = parseDocumentSnapshot(
      targetRef.relativePath,
      targetRaw,
      { layoutKind: this.config.layout.kind, language: targetLanguage }
    );

    const hasSourceContent = sourceSnapshot.blocks.some((block) => block.translatable && block.raw.trim().length > 0);
    const hasTargetContent = targetSnapshot.blocks.some((block) => block.translatable && block.raw.trim().length > 0);
    if (!hasSourceContent || !hasTargetContent) {
      return [];
    }

    return [
      {
        docKey: docSet.docKey,
        targetLanguage,
        targetPath: targetRef.relativePath,
        sourcePath: docSet.source.relativePath,
        sourceDocument: sourceRaw,
        targetDocument: targetRaw
      }
    ];
  }

  private async syncTarget(input: {
    docSet: DocSet;
    sourceSnapshot: ReturnType<typeof parseDocumentSnapshot>;
    targetLanguage: string;
    changedBlockIndexes: number[];
    forceFullTranslation: boolean;
    requestPool: RequestPool;
  }): Promise<{ usage: ModelUsageStats; glossaryPatches: number }> {
    const targetRef = input.docSet.targets[input.targetLanguage];
    const currentMemory = await this.memoryStore.readPromptContext(input.targetLanguage);
    const targetExists = await this.provider.exists(targetRef.relativePath);
    const currentTargetSnapshot = targetExists
      ? parseDocumentSnapshot(targetRef.relativePath, await this.provider.read(targetRef.relativePath), {
          layoutKind: this.config.layout.kind,
          language: input.targetLanguage
        })
      : undefined;
    const targetShapeMatchesSource = snapshotsHaveSameShape(currentTargetSnapshot, input.sourceSnapshot);
    const nextBlockRaws: string[] = [];
    const translatedIndexes: number[] = [];
    const usage = zeroUsage();

    const pendingBlocks = input.sourceSnapshot.blocks.filter((block) => {
      if (!block.translatable) {
        return false;
      }

      const existingTranslation = currentTargetSnapshot?.blocks[block.index]?.raw;
      const shouldTranslate =
        input.forceFullTranslation ||
        !targetExists ||
        !targetShapeMatchesSource ||
        input.changedBlockIndexes.includes(block.index);

      return shouldTranslate || !existingTranslation;
    });

    debugLog(
      `${targetRef.relativePath}: pendingIndexes=${pendingBlocks.length > 0 ? pendingBlocks.map((block) => block.index + 1).join(', ') : '(none)'}, targetShapeMatchesSource=${targetShapeMatchesSource}, forceFullTranslation=${input.forceFullTranslation}.`
    );

    for (const block of input.sourceSnapshot.blocks) {
      const existingTranslation = currentTargetSnapshot?.blocks[block.index]?.raw;
      if (!block.translatable) {
        nextBlockRaws[block.index] = block.raw;
        continue;
      }

      const shouldTranslate =
        input.forceFullTranslation ||
        !targetExists ||
        !targetShapeMatchesSource ||
        input.changedBlockIndexes.includes(block.index);

      if (!shouldTranslate && existingTranslation) {
        nextBlockRaws[block.index] = existingTranslation;
      }
    }

    if (pendingBlocks.length > 0) {
      const glossaryEntries = Object.entries(await this.glossaryStore.load(input.targetLanguage));
      const glossaryText = glossaryEntries.length > 0
        ? glossaryEntries.map(([src, tgt]) => `- "${src}" → "${tgt}"`).join('\n')
        : undefined;

      const articleResult = await this.withRateLimitRetry(
        () =>
          this.translateArticleOnce({
            docKey: input.docSet.docKey,
            sourceLanguage: this.config.sourceLanguage,
            targetLanguage: input.targetLanguage,
            memoryText: currentMemory,
            glossaryText,
            blocks: pendingBlocks
          }),
        input.requestPool
      );

      addUsage(usage, articleResult.usage);
      for (const item of articleResult.items) {
        nextBlockRaws[item.index] = stripOuterMarkdownFence(item.text);
        translatedIndexes.push(item.index);
      }
    }

    const renderBaseSnapshot = currentTargetSnapshot ?? input.sourceSnapshot;
    const rawBeforeGlossary = renderSnapshot(renderBaseSnapshot, nextBlockRaws);
    const { text: nextRaw, patches: glossaryPatches } = await this.glossaryStore.patch(rawBeforeGlossary, input.targetLanguage);
    const previousRaw = currentTargetSnapshot
      ? renderSnapshot(currentTargetSnapshot, currentTargetSnapshot.blocks.map((block) => block.raw))
      : '';

    if (!targetExists || previousRaw !== nextRaw) {
      this.managedWrites.add(targetRef.relativePath);
      await this.provider.write(targetRef.relativePath, nextRaw);
      verboseLog(
        'write',
        'cyan',
        `${targetRef.relativePath}: wrote updated translation file (${translatedIndexes.length} translated block(s), ${usage.totalTokens} tokens, ${glossaryPatches} glossary patch(es)).`
      );
      setTimeout(() => {
        this.managedWrites.delete(targetRef.relativePath);
      }, 1_500);
    }

    return { usage, glossaryPatches };
  }

  private async translateArticleOnce(input: {
    docKey: string;
    sourceLanguage: string;
    targetLanguage: string;
    memoryText: string;
    glossaryText?: string;
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
      const block = input.blocks[0]!;
      const translated = await this.translator.translateBlock({
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        memoryText: input.memoryText,
        glossaryText: input.glossaryText,
        sourceBlock: block.raw,
        docKey: input.docKey
      });

      return {
        items: [{ index: block.index, text: translated.text }],
        usage: translated.usage
      };
    }

    const translated = await this.translator.translateBlocks({
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      memoryText: input.memoryText,
      glossaryText: input.glossaryText,
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

  private async withRateLimitRetry<T>(
    task: () => Promise<T>,
    requestPool?: RequestPool,
    attempt = 1
  ): Promise<T> {
    try {
      return await task();
    } catch (error) {
      const retryKind = classifyRetryableError(error);
      if (!retryKind || attempt >= 3) {
        throw error;
      }

      if (retryKind === 'rate_limit') {
        requestPool?.noteRateLimit();
      }

      const delayMs = 500 * 2 ** (attempt - 1);
      console.warn(
        `${label('warning', 'yellow')} ${retryKind === 'rate_limit' ? 'Rate limited' : 'Server error'}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/3).`
      );
      this.observability.addEvent('docplaybook.translate.retry', {
        'docplaybook.retry_attempt': attempt,
        'docplaybook.retry_delay_ms': delayMs,
        'docplaybook.retry_kind': retryKind
      });
      await sleep(delayMs);
      return this.withRateLimitRetry(task, requestPool, attempt + 1);
    }
  }
}

function uniqueRulesFromItems(items: Array<{ rule: string }>): string[] {
  return [...new Set(items.map((item) => item.rule.trim()).filter(Boolean))];
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

function classifyRetryableError(error: unknown): 'rate_limit' | 'server_error' | null {
  if (!(error instanceof Error)) {
    return null;
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
    return 'rate_limit';
  }

  if (statusCode !== undefined && statusCode >= 500) {
    return 'server_error';
  }

  const message = `${error.message} ${String(record.cause ?? '')}`.toLowerCase();
  if (message.includes('429') || message.includes('rate limit') || message.includes('too many requests')) {
    return 'rate_limit';
  }

  if (
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('network') ||
    message.includes('socket')
  ) {
    return 'server_error';
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
