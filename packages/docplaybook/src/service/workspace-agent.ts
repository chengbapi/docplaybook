import path from 'node:path';
import type { AppConfig, DocSet, DocSetTranslateResult } from '../types.js';
import { createLayoutAdapter } from '../layouts/index.js';
import { LocalFolderProvider } from '../providers/local-folder-provider.js';
import { createModelHandle } from '../model/model-factory.js';
import { Translator } from '../translation/translator.js';
import { MemoryUpdater } from '../translation/memory-updater.js';
import { DocSetProcessor } from './docset-processor.js';
import { promptBootstrapDocLimit } from '../init/prompts.js';
import { RequestPool } from '../concurrency/request-pool.js';
import {
  DEFAULT_MAX_CONCURRENT_REQUESTS,
  MAX_MAX_CONCURRENT_REQUESTS,
  getConfigPath,
  CONFIG_DIRNAME,
  CONFIG_BASENAME
} from '../config.js';
import type { DocplaybookObservability } from '../observability.js';
import { noopObservability } from '../observability.js';
import { GlossaryStore } from '../memories/glossary-store.js';
import { MemoryStore } from '../memories/memory-store.js';
import { SourceHashStore } from '../state/source-hash-store.js';
import { sha256 } from '../utils.js';
import { parseDocumentSnapshot } from '../markdown/blocks.js';
import { bold, cyan, dim, formatDuration, green, label, yellow } from '../ui.js';
import { pathExists } from '../utils.js';

const BOOTSTRAP_PROMPT_THRESHOLD = 50;

// Rough token estimate: 4 chars ≈ 1 token (input only)
const CHARS_PER_TOKEN = 4;

// Input pricing per 1M tokens (USD). Used for --dry cost estimate.
const MODEL_INPUT_PRICE_PER_1M: Record<string, number> = {
  'gpt-4o': 2.5,
  'gpt-4o-mini': 0.15,
  'gpt-4-turbo': 10,
  'gpt-4': 30,
  'claude-opus-4-5': 15,
  'claude-sonnet-4-5': 3,
  'claude-haiku-4-5': 0.8,
  'claude-3-5-sonnet-20241022': 3,
  'claude-3-5-haiku-20241022': 0.8,
  'claude-3-opus-20240229': 15,
};

export class WorkspaceAgent {
  private readonly provider: LocalFolderProvider;
  private readonly processor: DocSetProcessor;
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
  }

  public async translateOnce(): Promise<void> {
    await this.translateOnceForLanguages(this.config.targetLanguages);
  }

  public async translateOnceForLanguages(
    targetLanguages: string[],
    options: { force?: boolean; dry?: boolean; pathFilter?: string } = {}
  ): Promise<void> {
    await this.refreshDocSets();
    const filteredDocSets = options.pathFilter
      ? filterDocSetsByPath(this.docSets, options.pathFilter, this.workspaceRoot)
      : this.docSets;

    if (options.dry) {
      await this.runDryTranslate(filteredDocSets, targetLanguages);
      return;
    }

    const maxConcurrentRequests =
      readPositiveIntEnv('DOCPLAYBOOK_MAX_CONCURRENT_REQUESTS') ??
      this.config.concurrency?.maxConcurrentRequests ??
      DEFAULT_MAX_CONCURRENT_REQUESTS;
    const requestPool = new RequestPool(MAX_MAX_CONCURRENT_REQUESTS, maxConcurrentRequests);
    const pathLocks = new Map<string, Promise<void>>();

    const allResults = await Promise.all(
      filteredDocSets.map((docSet) =>
        this.processor.translateDocSet(docSet, 'startup', targetLanguages, {
          ...options,
          requestPool,
          pathLocks
        })
      )
    );

    printTranslateSummary(allResults);
  }

  public async learnOnce(): Promise<void> {
    await this.learnOnceForLanguages(this.config.targetLanguages);
  }

  public async learnOnceForLanguages(
    targetLanguages: string[],
    options: { force?: boolean; interactive?: boolean; pathFilter?: string } = {}
  ): Promise<void> {
    await this.refreshDocSets();
    const filteredDocSets = options.pathFilter
      ? filterDocSetsByPath(this.docSets, options.pathFilter, this.workspaceRoot)
      : this.docSets;
    await this.processor.learnWorkspace(filteredDocSets, targetLanguages, options);
  }

  public async bootstrapOnceForLanguages(targetLanguages: string[]): Promise<void> {
    await this.refreshDocSets();
    const docLimits = new Map<string, number | null>();

    for (const targetLanguage of targetLanguages) {
      const alignedCount = this.docSets.filter(
        (docSet) => docSet.targets[targetLanguage]?.exists
      ).length;

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

  public async statusForWorkspace(): Promise<void> {
    await this.refreshDocSets();

    const memoryStore = new MemoryStore(this.workspaceRoot);
    const glossaryStore = new GlossaryStore(this.workspaceRoot);
    const sourceHashStore = new SourceHashStore(this.workspaceRoot);

    type LangStats = {
      total: number;
      upToDate: number;
      stale: number;
      missing: number;
      memoryRules: number;
      glossaryTerms: number;
    };

    const statsByLanguage = new Map<string, LangStats>();
    for (const lang of this.config.targetLanguages) {
      statsByLanguage.set(lang, { total: 0, upToDate: 0, stale: 0, missing: 0, memoryRules: 0, glossaryTerms: 0 });
    }

    for (const docSet of this.docSets) {
      let sourceHash: string;
      try {
        sourceHash = sha256(await this.provider.read(docSet.source.relativePath));
      } catch {
        continue;
      }

      for (const [lang, targetRef] of Object.entries(docSet.targets)) {
        const stats = statsByLanguage.get(lang);
        if (!stats) continue;
        stats.total += 1;

        const exists = await this.provider.exists(targetRef.relativePath);
        if (!exists) {
          stats.missing += 1;
          continue;
        }

        const recordedHash = await sourceHashStore.get(targetRef.relativePath);
        if (recordedHash === sourceHash) {
          stats.upToDate += 1;
        } else {
          stats.stale += 1;
        }
      }
    }

    for (const lang of this.config.targetLanguages) {
      const stats = statsByLanguage.get(lang)!;
      [stats.memoryRules, stats.glossaryTerms] = await Promise.all([
        memoryStore.countRules(lang),
        glossaryStore.countTerms(lang)
      ]);
    }

    const playbookText = await memoryStore.readPlaybook();
    const playbookRules = playbookText.split('\n').filter(
      (line) => line.trimStart().startsWith('- ') && line.trim().length > 2
    ).length;

    console.log(`\n${bold('Status')}  ${dim(this.workspaceRoot)}\n`);

    const langs = this.config.targetLanguages;
    if (langs.length === 0) {
      console.log('  No target languages configured.\n');
      return;
    }

    const COL_LANG = Math.max(8, ...langs.map((l) => l.length)) + 2;
    const header = [
      padRight('Language', COL_LANG),
      padLeft('Translated', 14),
      padLeft('Stale', 8),
      padLeft('Missing', 9),
      padLeft('Memory', 8),
      padLeft('Glossary', 9)
    ].join('');
    console.log(`  ${dim(header)}`);

    let hasStaleOrMissing = false;
    for (const lang of langs) {
      const s = statsByLanguage.get(lang)!;
      const pct = s.total > 0 ? Math.round((s.upToDate / s.total) * 100) : 100;
      const progress = s.total > 0 ? `${s.upToDate}/${s.total} ${pct}%` : '—';
      const stalePlain = s.stale > 0 ? String(s.stale) : '—';
      const missingPlain = s.missing > 0 ? String(s.missing) : '—';
      if (s.stale > 0 || s.missing > 0) hasStaleOrMissing = true;

      const row = [
        padRight(lang, COL_LANG),
        padLeft(progress, 14),
        s.stale > 0 ? yellow(padLeft(stalePlain, 8)) : dim(padLeft(stalePlain, 8)),
        s.missing > 0 ? yellow(padLeft(missingPlain, 9)) : dim(padLeft(missingPlain, 9)),
        padLeft(String(s.memoryRules), 8),
        padLeft(String(s.glossaryTerms), 9)
      ].join('');
      console.log(`  ${row}`);
    }

    console.log('');
    console.log(`  ${dim('Playbook:')} ${playbookRules} cross-language rule(s)`);

    if (hasStaleOrMissing) {
      console.log(`\n  Run ${bold('docplaybook translate')} to sync stale or missing files.`);
    }
    console.log('');
  }

  private async runDryTranslate(docSets: DocSet[], targetLanguages: string[]): Promise<void> {
    const memoryStore = new MemoryStore(this.workspaceRoot);
    const glossaryStore = new GlossaryStore(this.workspaceRoot);
    const sourceHashStore = new SourceHashStore(this.workspaceRoot);

    type PlanEntry = {
      sourcePath: string;
      targetLanguage: string;
      status: 'stale' | 'missing';
      blocks: number;
      estimatedTokens: number;
      memoryRules: number;
      glossaryTerms: number;
    };

    const plan: PlanEntry[] = [];

    for (const docSet of docSets) {
      let sourceRaw: string;
      try {
        sourceRaw = await this.provider.read(docSet.source.relativePath);
      } catch {
        continue;
      }

      const sourceHash = sha256(sourceRaw);
      const snapshot = parseDocumentSnapshot(docSet.source.relativePath, sourceRaw, {
        layoutKind: this.config.layout.kind,
        language: this.config.sourceLanguage
      });
      const blockCount = snapshot.blocks.filter((b) => b.translatable).length;
      const estimatedTokens = Math.ceil(sourceRaw.length / CHARS_PER_TOKEN);

      for (const targetLanguage of targetLanguages) {
        const targetRef = docSet.targets[targetLanguage];
        if (!targetRef) continue;

        const hasTarget = await this.provider.exists(targetRef.relativePath);
        const recordedHash = await sourceHashStore.get(targetRef.relativePath);

        if (hasTarget && recordedHash === sourceHash) continue;

        const status: 'stale' | 'missing' = hasTarget ? 'stale' : 'missing';
        const [memoryRules, glossaryTerms] = await Promise.all([
          memoryStore.countRules(targetLanguage),
          glossaryStore.countTerms(targetLanguage)
        ]);

        plan.push({ sourcePath: docSet.source.relativePath, targetLanguage, status, blocks: blockCount, estimatedTokens, memoryRules, glossaryTerms });
      }
    }

    if (plan.length === 0) {
      console.log(`${label('dry', 'cyan')} All targets are up to date. Nothing to translate.`);
      return;
    }

    const modelLabel = this.config.model.model;
    const pricePerMillion = MODEL_INPUT_PRICE_PER_1M[modelLabel];

    console.log(`\n${bold('Plan')} ${dim('(no LLM calls made):')}`);

    const bySource = new Map<string, PlanEntry[]>();
    for (const entry of plan) {
      const list = bySource.get(entry.sourcePath) ?? [];
      list.push(entry);
      bySource.set(entry.sourcePath, list);
    }

    for (const [sourcePath, entries] of bySource) {
      const langs = entries.map((e) => e.targetLanguage).join(', ');
      const entry = entries[0]!;
      const tokStr = formatTokenCount(entry.estimatedTokens);
      console.log(`  ${sourcePath}  ${dim(`[${entry.status}]`)}  ${entry.blocks} blocks  ~${tokStr}  langs: ${langs}`);
      for (const e of entries) {
        const hints: string[] = [];
        if (e.memoryRules > 0) hints.push(`memory: ${e.memoryRules} rules`);
        if (e.glossaryTerms > 0) hints.push(`glossary: ${e.glossaryTerms} terms`);
        if (hints.length > 0) {
          console.log(`    ${dim(`${e.targetLanguage}: ${hints.join(', ')} will be injected`)}`);
        }
      }
    }

    const totalTokens = plan.reduce((sum, e) => sum + e.estimatedTokens, 0);
    const totalBlocks = plan.reduce((sum, e) => sum + e.blocks, 0);
    const totalFiles = bySource.size;

    console.log('');
    console.log(`${bold('Total:')} ${totalFiles} file(s), ${totalBlocks} blocks, ~${formatTokenCount(totalTokens)} input tokens`);

    if (pricePerMillion !== undefined) {
      const cost = (totalTokens / 1_000_000) * pricePerMillion;
      console.log(`${bold('Estimated cost:')} $${cost.toFixed(4)} (${modelLabel})`);
    } else {
      console.log(`${bold('Estimated cost:')} N/A (unknown model pricing for ${modelLabel})`);
    }

    console.log(`\n${dim('Run without --dry to execute.')}\n`);
  }

  private async refreshDocSets(): Promise<void> {
    const files = await this.provider.scanTranslatableFiles(this.config.layout.kind);
    this.docSets = this.layoutAdapter.buildDocSets(files, this.workspaceRoot, this.config);
  }
}

function padRight(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function padLeft(s: string, width: number): string {
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

function filterDocSetsByPath(docSets: DocSet[], pathFilter: string, workspaceRoot: string): DocSet[] {
  const absFilter = path.resolve(workspaceRoot, pathFilter);
  return docSets.filter((docSet) => {
    const absSource = path.resolve(workspaceRoot, docSet.source.relativePath);
    return absSource === absFilter || absSource.startsWith(absFilter + path.sep);
  });
}

function printTranslateSummary(results: DocSetTranslateResult[]): void {
  const translated = results.filter((r) => !r.skipped);

  if (translated.length === 0) {
    console.log(`\n${label('done', 'green')} All targets are up to date.\n`);
    return;
  }

  console.log('');
  for (const result of translated) {
    for (const lang of result.perLanguage) {
      const tokStr = formatTokenCount(lang.totalTokens);
      const memStr = lang.memoryRulesInjected > 0 ? `  ${cyan(`memory:${lang.memoryRulesInjected}`)}` : '';
      const glossStr = lang.glossaryPatches > 0 ? `  ${green(`glossary:${lang.glossaryPatches}`)}` : '';
      console.log(
        `${label('translate', 'blue')} ${result.sourcePath}  ${lang.targetLanguage}  ${formatDuration(lang.elapsedMs)}  ${tokStr} tok${memStr}${glossStr}`
      );
    }
  }

  const totalTokens = translated.flatMap((r) => r.perLanguage).reduce((sum, l) => sum + l.totalTokens, 0);
  const totalMemoryHits = translated.flatMap((r) => r.perLanguage).reduce((sum, l) => sum + l.memoryRulesInjected, 0);
  const totalGlossaryPatches = translated.flatMap((r) => r.perLanguage).reduce((sum, l) => sum + l.glossaryPatches, 0);
  const fileCount = translated.length;
  const langCount = translated.flatMap((r) => r.perLanguage).length;

  console.log('');
  console.log(`${bold('Summary:')}`);
  console.log(`  ${fileCount} file(s) translated  ·  ${langCount} language target(s)  ·  ${formatTokenCount(totalTokens)} tokens total`);
  if (totalMemoryHits > 0) {
    console.log(`  Memory rules injected: ${totalMemoryHits}`);
  }
  if (totalGlossaryPatches > 0) {
    console.log(`  Glossary patches applied: ${totalGlossaryPatches}`);
  }
  console.log('');
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return String(tokens);
}

function readPositiveIntEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

export async function resolveWorkspaceAndPath(
  rawArg: string
): Promise<{ workspaceRoot: string; pathFilter?: string }> {
  const absArg = path.resolve(rawArg);

  // If the arg itself has .docplaybook/config.json, treat it as workspace root
  if (await pathExists(path.join(absArg, CONFIG_DIRNAME, CONFIG_BASENAME))) {
    return { workspaceRoot: absArg };
  }

  // Only use CWD as workspace root for relative paths (e.g., "docs/api/")
  // Absolute paths are always treated as workspace root (backward compat)
  const isRelative = !path.isAbsolute(rawArg) && rawArg !== '.';
  if (isRelative) {
    const cwd = process.cwd();
    if (await pathExists(getConfigPath(cwd))) {
      return { workspaceRoot: cwd, pathFilter: rawArg };
    }
  }

  // Fallback: treat as workspace root (will fail at loadConfig with a clear error)
  return { workspaceRoot: absArg };
}
