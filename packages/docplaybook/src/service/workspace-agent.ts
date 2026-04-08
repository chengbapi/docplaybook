import type { AppConfig, DocSet } from '../types.js';
import { createLayoutAdapter } from '../layouts/index.js';
import { LocalFolderProvider } from '../providers/local-folder-provider.js';
import { createModelHandle } from '../model/model-factory.js';
import { Translator } from '../translation/translator.js';
import { MemoryUpdater } from '../translation/memory-updater.js';
import { QualityLinter } from '../quality/linter.js';
import { DocSetProcessor } from './docset-processor.js';
import { type LintScope, WorkspaceLinter } from './workspace-linter.js';
import { promptBootstrapDocLimit } from '../init/prompts.js';
import { RequestPool } from '../concurrency/request-pool.js';
import {
  DEFAULT_MAX_CONCURRENT_REQUESTS,
  MAX_MAX_CONCURRENT_REQUESTS
} from '../config.js';
import type { DocplaybookObservability } from '../observability.js';
import { noopObservability } from '../observability.js';

const BOOTSTRAP_PROMPT_THRESHOLD = 50;

export class WorkspaceAgent {
  private readonly provider: LocalFolderProvider;
  private readonly processor: DocSetProcessor;
  private readonly workspaceLinter: WorkspaceLinter;
  private readonly layoutAdapter;
  private readonly managedWrites = new Set<string>();
  private docSets: DocSet[] = [];

  public constructor(
    private readonly workspaceRoot: string,
    private readonly config: AppConfig,
    private readonly observability: DocplaybookObservability = noopObservability
  ) {
    this.layoutAdapter = createLayoutAdapter(config.layout.kind);
    this.provider = new LocalFolderProvider(workspaceRoot, config.ignorePatterns ?? []);
    const modelHandle = createModelHandle(config.model);
    this.processor = new DocSetProcessor(
      workspaceRoot,
      config,
      this.provider,
      new Translator(modelHandle, this.observability),
      new MemoryUpdater(modelHandle),
      this.managedWrites,
      this.observability
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

  public async translateOnceForLanguages(targetLanguages: string[], options: { force?: boolean } = {}): Promise<void> {
    await this.refreshDocSets();
    const maxConcurrentRequests = readPositiveIntEnv('DOCPLAYBOOK_MAX_CONCURRENT_REQUESTS')
      ?? this.config.concurrency?.maxConcurrentRequests
      ?? DEFAULT_MAX_CONCURRENT_REQUESTS;
    const requestPool = new RequestPool(
      MAX_MAX_CONCURRENT_REQUESTS,
      maxConcurrentRequests
    );
    const pathLocks = new Map<string, Promise<void>>();

    await Promise.all(
      this.docSets.map((docSet) =>
        this.processor.translateDocSet(docSet, 'startup', targetLanguages, {
          ...options,
          requestPool,
          pathLocks
        })
      )
    );
  }

  public async learnOnce(): Promise<void> {
    await this.learnOnceForLanguages(this.config.targetLanguages);
  }

  public async learnOnceForLanguages(targetLanguages: string[], options: { force?: boolean } = {}): Promise<void> {
    await this.refreshDocSets();
    await this.processor.learnWorkspace(this.docSets, targetLanguages, options);
  }

  public async autoOnce(): Promise<void> {
    await this.autoOnceForLanguages(this.config.targetLanguages);
  }

  public async autoOnceForLanguages(targetLanguages: string[]): Promise<void> {
    await this.learnOnceForLanguages(targetLanguages);
    await this.translateOnceForLanguages(targetLanguages);
  }

  public async bootstrapOnceForLanguages(targetLanguages: string[]): Promise<void> {
    await this.refreshDocSets();
    const docLimits = new Map<string, number | null>();

    for (const targetLanguage of targetLanguages) {
      const alignedCount = this.docSets.filter((docSet) => docSet.targets[targetLanguage]?.exists).length;
      if (alignedCount <= BOOTSTRAP_PROMPT_THRESHOLD) {
        docLimits.set(targetLanguage, null);
        continue;
      }

      docLimits.set(targetLanguage, await promptBootstrapDocLimit(targetLanguage, alignedCount));
    }

    await this.processor.bootstrapWorkspace(this.docSets, targetLanguages, docLimits);
  }

  public async detectExistingTargetLanguages(targetLanguages: string[]): Promise<string[]> {
    await this.refreshDocSets();
    const existing = new Set<string>();

    for (const docSet of this.docSets) {
      for (const language of targetLanguages) {
        if (docSet.targets[language]?.exists) {
          existing.add(language);
        }
      }
    }

    return [...existing];
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
    const files = await this.provider.scanTranslatableFiles(this.config.layout.kind);
    this.docSets = this.layoutAdapter.buildDocSets(files, this.workspaceRoot, this.config);
  }
}

function readPositiveIntEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }

  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}
