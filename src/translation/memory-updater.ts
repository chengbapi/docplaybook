import { generateText } from 'ai';
import type { ManualCorrection } from '../types.js';
import { buildMemoryUpdatePrompt } from './prompts.js';
import type { ModelHandle } from '../model/model-factory.js';

export class MemoryUpdater {
  public constructor(private readonly modelHandle: ModelHandle) {}

  public async updateMemory(input: {
    sourceLanguage: string;
    targetLanguage: string;
    memoryText: string;
    corrections: ManualCorrection[];
  }): Promise<string> {
    if (input.corrections.length === 0) {
      return input.memoryText;
    }

    const result = await generateText({
      model: this.modelHandle.model,
      prompt: buildMemoryUpdatePrompt(input)
    });

    return result.text.trimEnd();
  }
}
