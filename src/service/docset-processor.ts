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
import { formatDuration, label } from '../ui.js';
import { nowIso } from '../utils.js';
import { RuntimeStore } from '../state/runtime-store.js';
import { LocalFolderProvider } from '../providers/local-folder-provider.js';
import {
  DEFAULT_MAX_BLOCKS_PER_BATCH,
  DEFAULT_MAX_CHARS_PER_BATCH
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
    this.memoryStore = new MemoryStore(workspaceRoot, config.sourceLanguage);
  }

  public async processDocSet(docSet: DocSet, reason: string): Promise<void> {
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
    const totalBlocks = currentSourceSnapshot.blocks.filter((block) => block.translatable).length;

    console.log(
      `${label('sync', 'blue')} Start ${docSet.source.relativePath} (${this.config.targetLanguages.length} target(s), ${totalBlocks} translatable block(s), reason: ${reason}).`
    );

    for (const targetLanguage of this.config.targetLanguages) {
      const targetRef = docSet.targets[targetLanguage];
      const previousTargetState = docState.targets[targetLanguage];
      const targetExists = await this.provider.exists(targetRef.relativePath);

      if (targetExists) {
        const targetRaw = await this.provider.read(targetRef.relativePath);
        const currentTargetSnapshot = parseMarkdownSnapshot(targetRef.relativePath, targetRaw);
        const corrections = this.collectManualCorrections(
          docState.source,
          previousTargetState?.generated,
          currentTargetSnapshot
        );

        if (corrections === 'skip') {
          console.warn(
            `${label('warning', 'yellow')} Skipping memory learning for ${targetRef.relativePath} because structural edits were too large.`
          );
          docState.targets[targetLanguage] = {
            language: targetLanguage,
            accepted: currentTargetSnapshot,
            generated: currentTargetSnapshot
          };
        } else if (corrections.length > 0) {
          const currentMemory = await this.memoryStore.read(targetLanguage);
          const updatedMemory = await this.memoryUpdater.updateMemory({
            sourceLanguage: this.config.sourceLanguage,
            targetLanguage,
            memoryText: currentMemory,
            corrections
          });
          addUsage(totals, updatedMemory.usage);
          await this.memoryStore.write(targetLanguage, updatedMemory.text);
          docState.targets[targetLanguage] = {
            language: targetLanguage,
            accepted: currentTargetSnapshot,
            generated: currentTargetSnapshot
          };

          console.log(
            `${label('memory', 'magenta')} Learned ${corrections.length} correction(s) for ${this.config.sourceLanguage} -> ${targetLanguage} from ${targetRef.relativePath}.`
          );
        }
      }

      const nextTargetSnapshot = await this.syncTarget({
        docSet,
        docState,
        sourceSnapshot: currentSourceSnapshot,
        targetLanguage,
        reason,
        totals
      });

      docState.targets[targetLanguage] = {
        language: targetLanguage,
        accepted: nextTargetSnapshot,
        generated: nextTargetSnapshot
      };
    }

    docState.source = currentSourceSnapshot;
    docState.updatedAt = nowIso();
    state.docSets[docSet.id] = docState;
    await this.runtimeStore.save(state);

    console.log(
      `${label('done', 'green')} Finished ${docSet.source.relativePath} in ${formatDuration(Date.now() - startedAt)} (input: ${totals.inputTokens}, output: ${totals.outputTokens}, total: ${totals.totalTokens}).`
    );
  }

  private async syncTarget(input: {
    docSet: DocSet;
    docState: DocSetRuntimeState;
    sourceSnapshot: DocumentSnapshot;
    targetLanguage: string;
    reason: string;
    totals: ModelUsageStats;
  }): Promise<DocumentSnapshot> {
    const targetRef = input.docSet.targets[input.targetLanguage];
    const currentMemory = await this.memoryStore.read(input.targetLanguage);
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
    const pendingCount = pendingBlocks.length;
    let completedCount = 0;

    console.log(
      `${label('target', 'cyan')} ${targetRef.relativePath} (${pendingCount}/${translatableBlocks} block(s) to translate).`
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

    for (const batch of this.groupTranslationBatches(pendingBlocks)) {
      const batchResult = await this.translateBatchWithFallback({
        docKey: input.docSet.docKey,
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage: input.targetLanguage,
        memoryText: currentMemory,
        blocks: batch
      });

      addUsage(input.totals, batchResult.usage);

      for (const item of batchResult.items) {
        nextBlockRaws[item.index] = stripOuterMarkdownFence(item.text);
        translatedIndexes.push(item.index);
        completedCount += 1;
      }

      const batchStart = batchResult.items[0]?.index ?? 0;
      const batchEnd = batchResult.items[batchResult.items.length - 1]?.index ?? batchStart;
      console.log(
        `${label('progress', 'cyan')} ${targetRef.relativePath} blocks ${completedCount - batchResult.items.length + 1}-${completedCount}/${pendingCount} (${batchStart + 1}-${batchEnd + 1}/${input.sourceSnapshot.blocks.length}, tokens: ${batchResult.usage.totalTokens}).`
      );
    }

    const nextRaw = renderSnapshot(input.sourceSnapshot, nextBlockRaws);
    const previousRaw = currentTargetSnapshot ? renderSnapshot(currentTargetSnapshot, currentTargetSnapshot.blocks.map((block) => block.raw)) : '';

    if (!targetExists || previousRaw !== nextRaw) {
      this.managedWrites.add(targetRef.relativePath);
      await this.provider.write(targetRef.relativePath, nextRaw);
      setTimeout(() => {
        this.managedWrites.delete(targetRef.relativePath);
      }, 1_500);
    }

    const nextSnapshot = parseMarkdownSnapshot(targetRef.relativePath, nextRaw);

    if (translatedIndexes.length > 0) {
      console.log(
        `${label('sync', 'blue')} ${input.docSet.source.relativePath} -> ${targetRef.relativePath} (${translatedIndexes.length} block(s), reason: ${input.reason}).`
      );
    }

    return nextSnapshot;
  }

  private groupTranslationBatches(blocks: Array<{
    index: number;
    raw: string;
    translatable: boolean;
  }>): Array<Array<{ index: number; raw: string; translatable: boolean }>> {
    const batches: Array<Array<{ index: number; raw: string; translatable: boolean }>> = [];
    let current: Array<{ index: number; raw: string; translatable: boolean }> = [];
    let currentChars = 0;

    for (const block of blocks) {
      const nextChars = currentChars + block.raw.length;
      const contiguous =
        current.length === 0 || block.index === current[current.length - 1]!.index + 1;
      const wouldOverflow =
        current.length >= (this.config.batch?.maxBlocksPerBatch ?? DEFAULT_MAX_BLOCKS_PER_BATCH) ||
        nextChars > (this.config.batch?.maxCharsPerBatch ?? DEFAULT_MAX_CHARS_PER_BATCH);

      if (!contiguous || wouldOverflow) {
        if (current.length > 0) {
          batches.push(current);
        }
        current = [];
        currentChars = 0;
      }

      current.push(block);
      currentChars += block.raw.length;
    }

    if (current.length > 0) {
      batches.push(current);
    }

    return batches;
  }

  private async translateBatchWithFallback(input: {
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
      return this.translateBatchAsSingles(input);
    }

    try {
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
    } catch (error) {
      console.warn(
        `${label('warning', 'yellow')} Batch translation fell back to single-block mode for ${input.targetLanguage}: ${error instanceof Error ? error.message : String(error)}`
      );
      return this.translateBatchAsSingles(input);
    }
  }

  private async translateBatchAsSingles(input: {
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
    const items: Array<{ index: number; text: string }> = [];
    const usage = zeroUsage();

    for (const block of input.blocks) {
      const translated = await this.translateSingleBlock({
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        memoryText: input.memoryText,
        docKey: input.docKey,
        block
      });
      items.push(...translated.items);
      addUsage(usage, translated.usage);
    }

    return { items, usage };
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
