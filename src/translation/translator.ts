import { generateText } from 'ai';
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

const BLOCK_SEPARATOR = '<<<DOCPLAYBOOK_BLOCK>>>';

export class Translator {
  public constructor(private readonly modelHandle: ModelHandle) {}

  public async translateBlock(context: TranslationContext): Promise<TranslationResult> {
    const result = await generateText({
      model: this.modelHandle.model,
      system: buildTranslationSystemPrompt(context),
      prompt: buildTranslationPrompt(context)
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
    const result = await generateText({
      model: this.modelHandle.model,
      system: buildTranslationSystemPrompt({
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        memoryText: input.memoryText,
        sourceBlock: '',
        docKey: input.docKey
      }),
      prompt: buildBatchTranslationPrompt(input)
    });

    const texts = splitBatchTranslation(result.text, input.blocks.length);

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

function splitBatchTranslation(text: string, expectedCount: number): string[] {
  const normalized = text.trim();
  const parts = normalized.split(BLOCK_SEPARATOR).map((part) => stripOuterMarkdownFence(part.trim()));

  if (parts.length !== expectedCount) {
    throw new Error(
      `Batch translation returned ${parts.length} block(s), expected ${expectedCount}.`
    );
  }

  return parts;
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
