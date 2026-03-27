import { generateText } from 'ai';
import type { ManualCorrection, MemoryUpdateResult, ModelUsageStats } from '../types.js';
import { buildMemoryUpdatePrompt } from './prompts.js';
import type { ModelHandle } from '../model/model-factory.js';

export class MemoryUpdater {
  public constructor(private readonly modelHandle: ModelHandle) {}

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

    const result = await generateText({
      model: this.modelHandle.model,
      prompt: buildMemoryUpdatePrompt(input)
    });

    return {
      text: result.text.trimEnd(),
      usage: normalizeUsage(result.usage)
    };
  }
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
