import { generateText } from 'ai';
import type { DocumentSnapshot, LintFinding, LintResult, LintScores, ModelUsageStats } from '../types.js';
import type { ModelHandle } from '../model/model-factory.js';
import { buildLintPrompt } from './prompts.js';
import { debugLog } from '../ui.js';

export class QualityLinter {
  public constructor(
    private readonly modelHandle: ModelHandle,
    private readonly runner: typeof generateText = generateText
  ) {}

  public async lintDocument(input: {
    sourceLanguage: string;
    targetLanguage: string;
    docKey: string;
    memoryText: string;
    sourceSnapshot: DocumentSnapshot;
    targetSnapshot: DocumentSnapshot;
    fix: boolean;
  }): Promise<LintResult> {
    const prompt = buildLintPrompt(input);
    debugLog(
      `lint ${input.targetLanguage} for ${input.docKey}: sourceBlocks=${input.sourceSnapshot.blocks.length}, targetBlocks=${input.targetSnapshot.blocks.length}, memoryChars=${input.memoryText.length}, promptChars=${prompt.length}, fix=${input.fix}.`
    );
    const result = await this.runner({
      model: this.modelHandle.model,
      prompt
    });

    return {
      ...parseLintResult(result.text),
      usage: normalizeUsage(result.usage)
    };
  }
}

function parseLintResult(text: string): Pick<LintResult, 'scores' | 'findings'> {
  const normalized = stripOuterMarkdownFence(text.trim());
  const jsonMatch = normalized.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Lint result did not return JSON.');
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    scores?: Partial<LintScores>;
    findings?: Array<Record<string, unknown>>;
  };

  const scores = parsed.scores ?? {};
  return {
    scores: {
      terminology: normalizeScore(scores.terminology),
      tone: normalizeScore(scores.tone),
      completeness: normalizeScore(scores.completeness),
      markdown: normalizeScore(scores.markdown),
      fluency: normalizeScore(scores.fluency),
      overall: normalizeScore(scores.overall)
    },
    findings: (parsed.findings ?? []).map(parseFinding)
  };
}

function parseFinding(input: Record<string, unknown>): LintFinding {
  const targetBlockIndex = toOptionalIndex(input.targetBlockIndex);
  const fix =
    typeof input.fix === 'object' && input.fix !== null
      ? {
          targetBlockIndex:
            toOptionalIndex((input.fix as { targetBlockIndex?: unknown }).targetBlockIndex) ??
            targetBlockIndex ??
            0,
          text: typeof (input.fix as { text?: unknown }).text === 'string'
            ? sanitizeFixText(stripOuterMarkdownFence((input.fix as { text: string }).text.trim()))
            : ''
        }
      : undefined;

  return {
    severity: normalizeSeverity(input.severity),
    category: normalizeCategory(input.category),
    message: typeof input.message === 'string' ? input.message.trim() : 'Unspecified issue.',
    sourceBlockIndex: toOptionalIndex(input.sourceBlockIndex),
    targetBlockIndex,
    suggestion: typeof input.suggestion === 'string' ? input.suggestion.trim() : undefined,
    fix: fix && fix.text ? fix : undefined
  };
}

function normalizeScore(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeSeverity(value: unknown): 'error' | 'warn' | 'info' {
  return value === 'error' || value === 'info' ? value : 'warn';
}

function normalizeCategory(value: unknown): LintFinding['category'] {
  switch (value) {
    case 'terminology':
    case 'tone':
    case 'completeness':
    case 'markdown':
    case 'fluency':
    case 'memory':
      return value;
    default:
      return 'fluency';
  }
}

function toOptionalIndex(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) {
    return undefined;
  }

  return numeric;
}

function stripOuterMarkdownFence(text: string): string {
  const match = text.match(/^```(?:md|markdown|json)?\n([\s\S]*?)\n```$/i);
  if (!match) {
    return text;
  }

  return match[1] ?? text;
}

function sanitizeFixText(text: string): string {
  const lines = text.split('\n');
  let index = 0;

  if (/^##\s+Target Block\s+\d+/i.test(lines[index] ?? '')) {
    index += 1;
    while (index < lines.length && /^(Kind|Translatable):/i.test(lines[index] ?? '')) {
      index += 1;
    }
  }

  return lines.slice(index).join('\n').trim();
}

function normalizeUsage(usage: {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  totalTokens: number | undefined;
}): ModelUsageStats {
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0
  };
}
