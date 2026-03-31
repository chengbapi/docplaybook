import type { AppConfig, DocSet, ProviderEvent } from '../types.js';
import { createLayoutAdapter } from '../layouts/index.js';
import { LocalFolderProvider } from '../providers/local-folder-provider.js';
import { RuntimeStore } from '../state/runtime-store.js';
import { createModelHandle } from '../model/model-factory.js';
import { Translator } from '../translation/translator.js';
import { MemoryUpdater } from '../translation/memory-updater.js';
import { QualityLinter } from '../quality/linter.js';
import { label } from '../ui.js';
import { DocSetProcessor } from './docset-processor.js';
import { type LintScope, WorkspaceLinter } from './workspace-linter.js';
import { getSupportedMarkdownExtension } from '../markdown/files.js';

export class WorkspaceAgent {
  private readonly provider: LocalFolderProvider;
  private readonly runtimeStore: RuntimeStore;
  private readonly processor: DocSetProcessor;
  private readonly workspaceLinter: WorkspaceLinter;
  private readonly layoutAdapter;
  private readonly managedWrites = new Set<string>();
  private readonly scheduled = new Map<string, NodeJS.Timeout>();
  private docSets: DocSet[] = [];
  private docSetByPath = new Map<string, DocSet>();

  public constructor(
    private readonly workspaceRoot: string,
    private readonly config: AppConfig
  ) {
    this.layoutAdapter = createLayoutAdapter(config.layout.kind);
    this.provider = new LocalFolderProvider(workspaceRoot, config.ignorePatterns ?? []);
    this.runtimeStore = new RuntimeStore(workspaceRoot);
    const modelHandle = createModelHandle(config.model);
    this.processor = new DocSetProcessor(
      workspaceRoot,
      config,
      this.provider,
      this.runtimeStore,
      new Translator(modelHandle),
      new MemoryUpdater(modelHandle),
      this.managedWrites
    );
    this.workspaceLinter = new WorkspaceLinter(
      workspaceRoot,
      config,
      this.provider,
      new QualityLinter(modelHandle)
    );
  }

  public async runOnce(): Promise<void> {
    await this.autoOnce();
  }

  public async translateOnce(): Promise<void> {
    await this.translateOnceForLanguages(this.config.targetLanguages);
  }

  public async translateOnceForLanguages(targetLanguages: string[]): Promise<void> {
    await this.refreshDocSets();
    for (const docSet of this.docSets) {
      await this.processor.translateDocSet(docSet, 'startup', targetLanguages);
    }
  }

  public async learnOnce(): Promise<void> {
    await this.learnOnceForLanguages(this.config.targetLanguages);
  }

  public async learnOnceForLanguages(targetLanguages: string[]): Promise<void> {
    await this.refreshDocSets();
    await this.processor.learnWorkspace(this.docSets, targetLanguages);
  }

  public async autoOnce(): Promise<void> {
    await this.autoOnceForLanguages(this.config.targetLanguages);
  }

  public async autoOnceForLanguages(targetLanguages: string[]): Promise<void> {
    await this.translateOnceForLanguages(targetLanguages);
    await this.learnOnceForLanguages(targetLanguages);
  }

  public async lintOnce(fix: boolean, scope: LintScope): Promise<void> {
    await this.lintOnceForLanguages(fix, scope, this.config.targetLanguages);
  }

  public async lintOnceForLanguages(
    fix: boolean,
    scope: LintScope,
    targetLanguages: string[]
  ): Promise<void> {
    await this.refreshDocSets();
    await this.workspaceLinter.lintDocSets(this.docSets, fix, scope, targetLanguages);
  }

  private async refreshDocSets(): Promise<void> {
    const files = await this.provider.scanMarkdownFiles();
    this.docSets = this.layoutAdapter.buildDocSets(files, this.workspaceRoot, this.config);
    this.docSetByPath = new Map();

    for (const docSet of this.docSets) {
      this.docSetByPath.set(docSet.source.relativePath, docSet);
      for (const target of Object.values(docSet.targets)) {
        this.docSetByPath.set(target.relativePath, docSet);
      }
    }
  }

  private async onEvent(event: ProviderEvent): Promise<void> {
    if (this.managedWrites.has(event.relativePath)) {
      return;
    }

    await this.refreshDocSets();
    const docSet = this.docSetByPath.get(event.relativePath);

    if (!docSet && event.kind !== 'unlink') {
      return;
    }

    const targetDocSet = docSet ?? this.findSiblingDocSetForDeletedTarget(event.relativePath);
    if (!targetDocSet) {
      return;
    }

    this.scheduleDocSet(targetDocSet, `${event.kind}:${event.relativePath}`);
  }

  private scheduleDocSet(docSet: DocSet, reason: string): void {
    const existing = this.scheduled.get(docSet.id);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      void this.processor.translateDocSet(docSet, reason, this.config.targetLanguages).catch((error: unknown) => {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        console.error(`${label('error', 'red')} Failed to process ${docSet.docKey}: ${message}`);
      });
      this.scheduled.delete(docSet.id);
    }, 250);

    this.scheduled.set(docSet.id, timer);
  }

  private findSiblingDocSetForDeletedTarget(relativePath: string): DocSet | undefined {
    const extension = getSupportedMarkdownExtension(relativePath);
    if (!extension) {
      return undefined;
    }

    for (const docSet of this.docSets) {
      if (Object.values(docSet.targets).some((target) => target.relativePath === relativePath)) {
        return docSet;
      }
    }

    return undefined;
  }
}
