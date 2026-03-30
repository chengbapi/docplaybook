import { generateText } from 'ai';
import { randomUUID } from 'node:crypto';
import type {
  BatchTranslationResult,
  ModelUsageStats,
  TranslationContext,
  TranslationResult
} from '../types.js';
import {
  buildBatchTranslationPrompt,
  buildTranslationPrompt,
  buildTranslationSystemPrompt
} from './prompts.js';
import type { ModelHandle } from '../model/model-factory.js';
import { debugLog, verboseLog } from '../ui.js';

export class Translator {
  public constructor(private readonly modelHandle: ModelHandle) {}

  public async translateBlock(context: TranslationContext): Promise<TranslationResult> {
    const systemPrompt = buildTranslationSystemPrompt(context);
    const prompt = buildTranslationPrompt(context);
    debugLog(
      `single-block ${context.targetLanguage} prompt for ${context.docKey}: sourceChars=${context.sourceBlock.length}, memoryChars=${context.memoryText.length}, systemChars=${systemPrompt.length}, promptChars=${prompt.length}.`
    );
    const result = await generateText({
      model: this.modelHandle.model,
      system: systemPrompt,
      prompt
    });

    return {
      text: stripOuterMarkdownFence(result.text.trim()),
      usage: normalizeUsage(result.usage)
    };
  }

  public async translateBlocks(input: {
    sourceLanguage: string;
    targetLanguage: string;
    memoryText: string;
    docKey: string;
    blocks: Array<{
      index: number;
      sourceBlock: string;
      existingTranslation?: string;
    }>;
  }): Promise<BatchTranslationResult> {
    const blocksWithIds = input.blocks.map((block) => ({
      ...block,
      id: randomUUID().slice(0, 8)
    }));
    const systemPrompt = buildTranslationSystemPrompt({
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      memoryText: input.memoryText,
      sourceBlock: '',
      docKey: input.docKey
    });
    const prompt = buildBatchTranslationPrompt({
      ...input,
      blocks: blocksWithIds
    });
    verboseLog(
      'batch',
      'cyan',
      `${input.targetLanguage}: issuing batch translation for ids ${blocksWithIds.map((block) => `${block.id}@${block.index + 1}`).join(', ')}.`
    );
    debugLog(
      `batch ${input.targetLanguage} prompt for ${input.docKey}: blocks=${blocksWithIds.length}, memoryChars=${input.memoryText.length}, systemChars=${systemPrompt.length}, promptChars=${prompt.length}.`
    );
    const result = await generateText({
      model: this.modelHandle.model,
      system: systemPrompt,
      prompt
    });

    const texts = parseBatchTranslation(result.text, blocksWithIds);
    verboseLog(
      'batch',
      'cyan',
      `${input.targetLanguage}: parsed batch response for ${blocksWithIds.length} block id(s).`
    );

    return {
      texts,
      usage: normalizeUsage(result.usage)
    };
  }
}

function stripOuterMarkdownFence(text: string): string {
  const match = text.match(/^```(?:md|markdown)?\n([\s\S]*?)\n```$/i);
  if (!match) {
    return text;
  }

  return match[1] ?? text;
}

function parseBatchTranslation(
  text: string,
  expectedBlocks: Array<{ id: string }>
): string[] {
  const normalized = stripOuterMarkdownFence(text.trim());
  debugLog(
    `batch response parsing: expectedIds=${expectedBlocks.map((block) => block.id).join(', ')}, responseChars=${normalized.length}.`
  );
  const jsonMatch = normalized.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Batch translation did not return JSON.');
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    blocks?: Array<{ id?: unknown; text?: unknown }>;
  };
  const returnedBlocks = parsed.blocks ?? [];
  if (returnedBlocks.length !== expectedBlocks.length) {
    throw new Error(
      `Batch translation returned ${returnedBlocks.length} block(s), expected ${expectedBlocks.length}.`
    );
  }

  const textById = new Map<string, string>();
  for (const block of returnedBlocks) {
    if (typeof block.id !== 'string' || typeof block.text !== 'string') {
      throw new Error('Batch translation returned an invalid block entry.');
    }

    textById.set(block.id, stripOuterMarkdownFence(block.text.trim()));
  }

  return expectedBlocks.map((block) => {
    const translated = textById.get(block.id);
    if (!translated) {
      throw new Error(`Batch translation omitted block id ${block.id}.`);
    }

    return translated;
  });
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
