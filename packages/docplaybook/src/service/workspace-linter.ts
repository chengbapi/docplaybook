import type { AppConfig, DocSet, LintFinding, ModelUsageStats } from '../types.js';
import { parseMarkdownSnapshot, renderSnapshot } from '../markdown/blocks.js';
import { MemoryStore } from '../memories/memory-store.js';
import { LocalFolderProvider } from '../providers/local-folder-provider.js';
import { QualityLinter } from '../quality/linter.js';
import { bold, formatDuration, label } from '../ui.js';
import { getChangedWorkspaceFiles } from '../git/changed-files.js';

export type LintScope = 'changed' | 'all';

export interface WorkspaceLintSummary {
  findings: number;
  errors: number;
  warnings: number;
  infos: number;
  documents: number;
  averageScore: number;
  usage: ModelUsageStats;
}

export class WorkspaceLinter {
  private readonly memoryStore: MemoryStore;

  public constructor(
    private readonly workspaceRoot: string,
    private readonly config: AppConfig,
    private readonly provider: LocalFolderProvider,
    private readonly linter: QualityLinter
  ) {
    this.memoryStore = new MemoryStore(workspaceRoot);
  }

  public async lintDocSets(
    docSets: DocSet[],
    fix: boolean,
    scope: LintScope,
    targetLanguages: string[]
  ): Promise<WorkspaceLintSummary> {
    const startedAt = Date.now();
    const totals = zeroUsage();
    let findings = 0;
    let errors = 0;
    let warnings = 0;
    let infos = 0;
    let documents = 0;
    let scoreSum = 0;
    const changedFiles = scope === 'changed' ? await getChangedWorkspaceFiles(this.workspaceRoot) : null;

    if (scope === 'changed') {
      if (changedFiles) {
        console.log(
          `${label('lint', 'blue')} Scope ${bold('changed')}: checking translated files changed in git status.`
        );
      } else {
        console.log(
          `${label('lint', 'yellow')} Could not read git changes. Falling back to ${bold('all')} translated files.`
        );
      }
    }

    for (const docSet of docSets) {
      const sourceSnapshot = parseMarkdownSnapshot(
        docSet.source.relativePath,
        await this.provider.read(docSet.source.relativePath)
      );

      for (const targetLanguage of targetLanguages) {
        const targetRef = docSet.targets[targetLanguage];
        if (changedFiles && !changedFiles.has(targetRef.relativePath)) {
          continue;
        }

        if (!(await this.provider.exists(targetRef.relativePath))) {
          continue;
        }

        documents += 1;
        const targetSnapshot = parseMarkdownSnapshot(
          targetRef.relativePath,
          await this.provider.read(targetRef.relativePath)
        );

        const playbookRaw = await this.memoryStore.readPlaybook();
        const normalizedPlaybook = this.memoryStore.normalizePlaybook(playbookRaw);
        const memoryRaw = await this.memoryStore.read(targetLanguage);
        const normalizedMemory = this.memoryStore.normalize(targetLanguage, memoryRaw);
        const memoryFindings = [
          ...normalizedPlaybook.addedSections.map<LintFinding>((section) => ({
            severity: 'warn',
            category: 'memory',
            message: `Playbook was missing the "${section}" section.`,
            suggestion: `Add reusable global guidance under "${section}".`
          })),
          ...normalizedMemory.addedSections.map<LintFinding>((section) => ({
            severity: 'warn',
            category: 'memory',
            message: `Memory file was missing the "${section}" section.`,
            suggestion: `Add reusable guidance under "${section}" so linting has a clearer standard.`
          }))
        ];

        const lintResult = await this.linter.lintDocument({
          sourceLanguage: this.config.sourceLanguage,
          targetLanguage,
          docKey: docSet.docKey,
          memoryText: this.memoryStore.composePromptContext(
            normalizedPlaybook.text,
            normalizedMemory.text,
            targetLanguage
          ),
          sourceSnapshot,
          targetSnapshot,
          fix
        });

        addUsage(totals, lintResult.usage);
        const combinedFindings = [...memoryFindings, ...lintResult.findings];
        const score = lintResult.scores.overall;
        scoreSum += score;
        findings += combinedFindings.length;

        const documentErrors = combinedFindings.filter((item) => item.severity === 'error').length;
        const documentWarnings = combinedFindings.filter((item) => item.severity === 'warn').length;
        const documentInfos = combinedFindings.filter((item) => item.severity === 'info').length;
        errors += documentErrors;
        warnings += documentWarnings;
        infos += documentInfos;

        if (fix && normalizedPlaybook.addedSections.length > 0) {
          await this.memoryStore.writePlaybook(normalizedPlaybook.text);
        }

        if (fix && normalizedMemory.addedSections.length > 0) {
          await this.memoryStore.write(targetLanguage, normalizedMemory.text);
        }

        let fixedBlocks = 0;
        if (fix) {
          const nextBlockRaws = targetSnapshot.blocks.map((block) => block.raw);
          for (const finding of combinedFindings) {
            const fixEntry = finding.fix;
            if (!fixEntry) {
              continue;
            }

            const block = targetSnapshot.blocks[fixEntry.targetBlockIndex - 1];
            if (!block?.translatable) {
              continue;
            }

            nextBlockRaws[block.index] = fixEntry.text;
            fixedBlocks += 1;
          }

          if (fixedBlocks > 0) {
            const nextRaw = renderSnapshot(targetSnapshot, nextBlockRaws);
            await this.provider.write(targetRef.relativePath, nextRaw);
          }
        }

        console.log(
          `${label('lint', 'blue')} ${targetRef.relativePath} ${bold(String(score))}/100${fix && fixedBlocks > 0 ? ` (${fixedBlocks} fix${fixedBlocks === 1 ? '' : 'es'} applied)` : ''}`
        );
        for (const finding of combinedFindings) {
          const location = finding.targetBlockIndex
            ? `${targetRef.relativePath}:${finding.targetBlockIndex}`
            : targetRef.relativePath;
          const fixSuffix = finding.fix && fix ? ' [fixed]' : '';
          console.log(
            `  ${finding.severity.padEnd(5)} ${finding.category.padEnd(12)} ${location} ${finding.message}${fixSuffix}`
          );
        }
      }
    }

    const averageScore = documents > 0 ? Math.round(scoreSum / documents) : 0;
    console.log(
      `${label('done', 'green')} Linted ${documents} translation file(s) in ${formatDuration(Date.now() - startedAt)}. Findings: ${findings} (errors: ${errors}, warnings: ${warnings}, info: ${infos}). Average score: ${averageScore}/100. Tokens: ${totals.totalTokens}.`
    );

    return {
      findings,
      errors,
      warnings,
      infos,
      documents,
      averageScore,
      usage: totals
    };
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
