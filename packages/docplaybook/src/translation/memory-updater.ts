import { generateText } from 'ai';
import type {
  BootstrapExample,
  LearnCandidate,
  LearnJudgement,
  MemoryUpdateResult,
  ModelUsageStats
} from '../types.js';
import {
  buildBootstrapMemoryPrompt,
  buildLearnJudgePrompt,
  buildRuleMergePrompt
} from './prompts.js';
import type { ModelHandle } from '../model/model-factory.js';
import { debugLog } from '../ui.js';

export class MemoryUpdater {
  public constructor(private readonly modelHandle: ModelHandle) {}

  public async judgeLearnCandidates(input: {
    sourceLanguage: string;
    targetLanguage: string;
    currentPlaybook: string;
    currentMemory: string;
    candidates: LearnCandidate[];
  }): Promise<{ items: LearnJudgement[]; usage: ModelUsageStats }> {
    if (input.candidates.length === 0) {
      return {
        items: [],
        usage: zeroUsage()
      };
    }

    const prompt = buildLearnJudgePrompt(input);
    debugLog(
      `learn-judge ${input.targetLanguage}: candidates=${input.candidates.length}, promptChars=${prompt.length}.`
    );
    const result = await generateText({
      model: this.modelHandle.model,
      prompt
    });

    return {
      items: parseLearnJudgements(result.text),
      usage: normalizeUsage(result.usage)
    };
  }

  public async mergeRules(input: {
    scope: 'playbook' | 'memory';
    sourceLanguage: string;
    targetLanguage: string;
    memoryText: string;
    rules: string[];
  }): Promise<MemoryUpdateResult> {
    if (input.rules.length === 0) {
      return {
        text: input.memoryText,
        usage: zeroUsage()
      };
    }

    const prompt = buildRuleMergePrompt(input);
    debugLog(
      `${input.scope}-merge ${input.targetLanguage}: rules=${input.rules.length}, promptChars=${prompt.length}.`
    );
    const result = await generateText({
      model: this.modelHandle.model,
      prompt
    });

    return {
      text: stripOuterMarkdownFence(result.text).trimEnd(),
      usage: normalizeUsage(result.usage)
    };
  }

  public async bootstrapMemory(input: {
    scope: 'playbook' | 'memory';
    sourceLanguage: string;
    targetLanguage: string;
    memoryText: string;
    examples: BootstrapExample[];
  }): Promise<MemoryUpdateResult> {
    if (input.examples.length === 0) {
      return {
        text: input.memoryText,
        usage: zeroUsage()
      };
    }

    const prompt = buildBootstrapMemoryPrompt(input);
    debugLog(
      `bootstrap-${input.scope} ${input.targetLanguage}: examples=${input.examples.length}, promptChars=${prompt.length}.`
    );
    const result = await generateText({
      model: this.modelHandle.model,
      prompt
    });

    return {
      text: stripOuterMarkdownFence(result.text).trimEnd(),
      usage: normalizeUsage(result.usage)
    };
  }
}

function parseLearnJudgements(text: string): LearnJudgement[] {
  const normalized = stripOuterMarkdownFence(text);
  const match = normalized.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Learn judgement did not return JSON.');
  }

  const parsed = JSON.parse(match[0]) as {
    items?: Array<Record<string, unknown>>;
  };

  return (parsed.items ?? []).map((item) => ({
    docKey: typeof item.docKey === 'string' ? item.docKey : '',
    blockIndex: toPositiveInt(item.blockIndex),
    shouldLearn: Boolean(item.shouldLearn),
    scope: normalizeScope(item.scope),
    category: normalizeCategory(item.category),
    reason: typeof item.reason === 'string' && item.reason.trim().length > 0
      ? item.reason.trim()
      : 'No reason provided.',
    proposedRule: typeof item.proposedRule === 'string' ? item.proposedRule.trim() : ''
  }));
}

function normalizeScope(value: unknown): LearnJudgement['scope'] {
  switch (value) {
    case 'playbook':
    case 'memory':
    case 'ignore':
      return value;
    default:
      return 'ignore';
  }
}

function normalizeCategory(value: unknown): LearnJudgement['category'] {
  switch (value) {
    case 'terminology':
    case 'style':
    case 'protected_term':
    case 'format':
    case 'one_off':
    case 'rewrite':
    case 'other':
      return value;
    default:
      return 'other';
  }
}

function toPositiveInt(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 0;
}

function stripOuterMarkdownFence(text: string): string {
  const normalized = text.trim();
  const match = normalized.match(/^```(?:md|markdown|json)?\n([\s\S]*?)\n```$/i);
  if (!match) {
    return normalized;
  }

  return match[1] ?? normalized;
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

function zeroUsage(): ModelUsageStats {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  };
}
