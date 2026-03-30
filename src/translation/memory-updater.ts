import { generateText } from 'ai';
import type {
  DocumentSnapshot,
  ManualCorrection,
  MemoryUpdateResult,
  ModelUsageStats,
  RewriteJudgementResult
} from '../types.js';
import { buildMemoryUpdatePrompt, buildRewriteJudgePrompt } from './prompts.js';
import type { ModelHandle } from '../model/model-factory.js';
import { debugLog } from '../ui.js';

export class MemoryUpdater {
  public constructor(private readonly modelHandle: ModelHandle) {}

  public async judgeManualRewrite(input: {
    sourceLanguage: string;
    targetLanguage: string;
    generatedTargetSnapshot: DocumentSnapshot;
    currentTargetSnapshot: DocumentSnapshot;
  }): Promise<RewriteJudgementResult> {
    const prompt = buildRewriteJudgePrompt(input);
    debugLog(
      `rewrite-judge ${input.targetLanguage}: generatedBlocks=${input.generatedTargetSnapshot.blocks.length}, currentBlocks=${input.currentTargetSnapshot.blocks.length}, promptChars=${prompt.length}.`
    );
    const result = await generateText({
      model: this.modelHandle.model,
      prompt
    });
    const parsed = parseRewriteJudgement(result.text);
    debugLog(
      `rewrite-judge ${input.targetLanguage}: isMajorRewrite=${parsed.isMajorRewrite}, reason=${parsed.reason}.`
    );

    return {
      ...parsed,
      usage: normalizeUsage(result.usage)
    };
  }

  public async updateMemory(input: {
    sourceLanguage: string;
    targetLanguage: string;
    memoryText: string;
    corrections: ManualCorrection[];
  }): Promise<MemoryUpdateResult> {
    if (input.corrections.length === 0) {
      return {
        text: input.memoryText,
        usage: zeroUsage()
      };
    }

    const prompt = buildMemoryUpdatePrompt(input);
    debugLog(
      `memory-update ${input.targetLanguage}: corrections=${input.corrections.length}, memoryChars=${input.memoryText.length}, promptChars=${prompt.length}.`
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

function stripOuterMarkdownFence(text: string): string {
  const normalized = text.trim();
  const match = normalized.match(/^```(?:md|markdown)?\n([\s\S]*?)\n```$/i);
  if (!match) {
    return normalized;
  }

  return match[1] ?? normalized;
}

function parseRewriteJudgement(text: string): Pick<RewriteJudgementResult, 'isMajorRewrite' | 'reason'> {
  const normalized = stripOuterMarkdownFence(text);
  const match = normalized.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Rewrite judgement did not return JSON.');
  }

  const parsed = JSON.parse(match[0]) as {
    isMajorRewrite?: unknown;
    reason?: unknown;
  };

  return {
    isMajorRewrite: Boolean(parsed.isMajorRewrite),
    reason: typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
      ? parsed.reason.trim()
      : 'No reason provided.'
  };
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
