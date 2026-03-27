import { generateText } from 'ai';
import type { TranslationContext } from '../types.js';
import { buildTranslationPrompt, buildTranslationSystemPrompt } from './prompts.js';
import type { ModelHandle } from '../model/model-factory.js';

export class Translator {
  public constructor(private readonly modelHandle: ModelHandle) {}

  public async translateBlock(context: TranslationContext): Promise<string> {
    const result = await generateText({
      model: this.modelHandle.model,
      system: buildTranslationSystemPrompt(context),
      prompt: buildTranslationPrompt(context)
    });

    return result.text.trimEnd();
  }
}
