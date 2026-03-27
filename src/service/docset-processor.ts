import type { AppConfig, DocSet, DocSetRuntimeState, DocumentSnapshot, ManualCorrection } from '../types.js';
import { parseMarkdownSnapshot, getChangedBlockIndexes, renderSnapshot, snapshotsHaveSameShape } from '../markdown/blocks.js';
import { MemoryStore } from '../memories/memory-store.js';
import { Translator } from '../translation/translator.js';
import { MemoryUpdater } from '../translation/memory-updater.js';
import { nowIso } from '../utils.js';
import { RuntimeStore } from '../state/runtime-store.js';
import { LocalFolderProvider } from '../providers/local-folder-provider.js';

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
    const state = await this.runtimeStore.load();
    const docState: DocSetRuntimeState = state.docSets[docSet.id] ?? {
      docSetId: docSet.id,
      targets: {},
      updatedAt: nowIso()
    };

    const sourceRaw = await this.provider.read(docSet.source.relativePath);
    const currentSourceSnapshot = parseMarkdownSnapshot(docSet.source.relativePath, sourceRaw);

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
            `[warning] Skipping memory learning for ${targetRef.relativePath} because structural edits were too large.`
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
          await this.memoryStore.write(targetLanguage, updatedMemory);
          docState.targets[targetLanguage] = {
            language: targetLanguage,
            accepted: currentTargetSnapshot,
            generated: currentTargetSnapshot
          };

          console.log(
            `[memory] Learned ${corrections.length} correction(s) for ${this.config.sourceLanguage} -> ${targetLanguage} from ${targetRef.relativePath}.`
          );
        }
      }

      const nextTargetSnapshot = await this.syncTarget({
        docSet,
        docState,
        sourceSnapshot: currentSourceSnapshot,
        targetLanguage,
        reason
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
  }

  private async syncTarget(input: {
    docSet: DocSet;
    docState: DocSetRuntimeState;
    sourceSnapshot: DocumentSnapshot;
    targetLanguage: string;
    reason: string;
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

      nextBlockRaws[block.index] = await this.translator.translateBlock({
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage: input.targetLanguage,
        memoryText: currentMemory,
        sourceBlock: block.raw,
        existingTranslation,
        docKey: input.docSet.docKey
      });
      translatedIndexes.push(block.index);
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
        `[sync] ${input.docSet.source.relativePath} -> ${targetRef.relativePath} (${translatedIndexes.length} block(s), reason: ${input.reason}).`
      );
    }

    return nextSnapshot;
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
