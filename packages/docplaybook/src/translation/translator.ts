import { generateText } from 'ai';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
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
import type { DocplaybookObservability } from '../observability.js';
import { noopObservability } from '../observability.js';
import { debugLog, isDebugEnabled, verboseLog } from '../ui.js';

const BATCH_SPLIT_THRESHOLD = readPositiveIntEnv('DOCPLAYBOOK_BATCH_SPLIT_THRESHOLD') ?? 30;
const BATCH_CHUNK_SIZE = readPositiveIntEnv('DOCPLAYBOOK_BATCH_CHUNK_SIZE') ?? 16;
const DEBUG_TRACE_DIR = path.join(os.tmpdir(), 'docplaybook-llm-trace');

export class Translator {
  public constructor(
    private readonly modelHandle: ModelHandle,
    private readonly observability: DocplaybookObservability = noopObservability,
    private readonly runner: typeof generateText = generateText
  ) {}

  public async translateBlock(context: TranslationContext): Promise<TranslationResult> {
    const systemPrompt = buildTranslationSystemPrompt(context);
    const prompt = buildTranslationPrompt(context);
    return this.observability.withSpan(
      'docplaybook.translate.model_call',
      {
        'docplaybook.call_mode': 'single',
        'docplaybook.doc_key': context.docKey,
        'docplaybook.target_language': context.targetLanguage,
        'docplaybook.source_chars': context.sourceBlock.length,
        'docplaybook.memory_chars': context.memoryText.length,
        'docplaybook.system_prompt_chars': systemPrompt.length,
        'docplaybook.prompt_chars': prompt.length,
        'docplaybook.block_count': 1,
        'docplaybook.model_label': this.modelHandle.label
      },
      async (span) => {
        debugLog(
          `single-block ${context.targetLanguage} prompt for ${context.docKey}: sourceChars=${context.sourceBlock.length}, memoryChars=${context.memoryText.length}, systemChars=${systemPrompt.length}, promptChars=${prompt.length}.`
        );
        const result = await this.runner({
          model: this.modelHandle.model,
          system: systemPrompt,
          prompt
        });
        await writeDebugTrace({
          kind: 'single',
          docKey: context.docKey,
          targetLanguage: context.targetLanguage,
          blockCount: 1,
          sourceChars: context.sourceBlock.length,
          systemPrompt,
          prompt,
          responseText: result.text
        });
        const usage = normalizeUsage(result.usage);
        span.setAttributes({
          'docplaybook.input_tokens': usage.inputTokens,
          'docplaybook.output_tokens': usage.outputTokens,
          'docplaybook.total_tokens': usage.totalTokens
        });

        this.observability.logGeneration({
          docKey: context.docKey,
          targetLanguage: context.targetLanguage,
          callMode: 'single',
          modelLabel: this.modelHandle.label,
          systemPrompt,
          userPrompt: prompt,
          output: result.text,
          usage
        });

        return {
          text: stripOuterMarkdownFence(result.text.trim()),
          usage
        };
      }
    );
  }

  public async translateBlocks(input: {
    sourceLanguage: string;
    targetLanguage: string;
    memoryText: string;
    glossaryText?: string;
    docKey: string;
    blocks: Array<{
      index: number;
      sourceBlock: string;
      existingTranslation?: string;
    }>;
  }): Promise<BatchTranslationResult> {
    if (input.blocks.length > BATCH_SPLIT_THRESHOLD) {
      const chunks = chunkBlocks(input.blocks, BATCH_CHUNK_SIZE);
      const usage = zeroUsage();
      const texts: string[] = [];
      debugLog(
        `batch ${input.targetLanguage} chunking for ${input.docKey}: totalBlocks=${input.blocks.length}, chunkCount=${chunks.length}, chunkSize=${BATCH_CHUNK_SIZE}.`
      );

      for (const [index, chunk] of chunks.entries()) {
        debugLog(
          `batch ${input.targetLanguage} chunk ${index + 1}/${chunks.length} for ${input.docKey}: blocks=${chunk.length}, sourceChars=${chunk.reduce((sum, block) => sum + block.sourceBlock.length, 0)}.`
        );
        const chunkResult = await this.translateBatchChunk({
          ...input,
          blocks: chunk
        });
        texts.push(...chunkResult.texts);
        addUsage(usage, chunkResult.usage);
      }

      return {
        texts,
        usage
      };
    }

    return this.translateBatchChunk(input);
  }

  private async translateBatchChunk(input: {
    sourceLanguage: string;
    targetLanguage: string;
    memoryText: string;
    glossaryText?: string;
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
    const totalSourceChars = input.blocks.reduce((sum, block) => sum + block.sourceBlock.length, 0);
    const systemPrompt = buildTranslationSystemPrompt({
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      memoryText: input.memoryText,
      glossaryText: input.glossaryText,
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
    const batchStartedAt = Date.now();
    return this.observability.withSpan(
      'docplaybook.translate.model_call',
      {
        'docplaybook.call_mode': 'batch',
        'docplaybook.doc_key': input.docKey,
        'docplaybook.target_language': input.targetLanguage,
        'docplaybook.source_chars': totalSourceChars,
        'docplaybook.memory_chars': input.memoryText.length,
        'docplaybook.system_prompt_chars': systemPrompt.length,
        'docplaybook.prompt_chars': prompt.length,
        'docplaybook.block_count': blocksWithIds.length,
        'docplaybook.model_label': this.modelHandle.label
      },
      async (span) => {
        const result = await this.runner({
          model: this.modelHandle.model,
          system: systemPrompt,
          prompt
        });
        await writeDebugTrace({
          kind: 'batch',
          docKey: input.docKey,
          targetLanguage: input.targetLanguage,
          blockCount: blocksWithIds.length,
          sourceChars: totalSourceChars,
          systemPrompt,
          prompt,
          responseText: result.text
        });
        const usage = normalizeUsage(result.usage);
        span.setAttributes({
          'docplaybook.input_tokens': usage.inputTokens,
          'docplaybook.output_tokens': usage.outputTokens,
          'docplaybook.total_tokens': usage.totalTokens
        });

        try {
          const texts = parseBatchTranslation(result.text, blocksWithIds);
          verboseLog(
            'batch',
            'cyan',
            `${input.targetLanguage}: parsed batch response for ${blocksWithIds.length} block id(s) in ${Date.now() - batchStartedAt}ms.`
          );
          debugLog(
            `batch ${input.targetLanguage} success for ${input.docKey}: blocks=${blocksWithIds.length}, sourceChars=${totalSourceChars}, elapsedMs=${Date.now() - batchStartedAt}.`
          );

          this.observability.logGeneration({
            docKey: input.docKey,
            targetLanguage: input.targetLanguage,
            callMode: 'batch',
            modelLabel: this.modelHandle.label,
            systemPrompt,
            userPrompt: prompt,
            output: result.text,
            usage
          });

          return {
            texts,
            usage
          };
        } catch (error) {
          console.warn(
            `Batch translation JSON parse failed for ${input.docKey} (${input.targetLanguage}); falling back to single-block translation.`
          );
          debugLog(
            `batch ${input.targetLanguage} parse failure for ${input.docKey}: blocks=${blocksWithIds.length}, sourceChars=${totalSourceChars}, elapsedMs=${Date.now() - batchStartedAt}, error=${error instanceof Error ? error.message : String(error)}`
          );
          span.setAttributes({
            'docplaybook.call_mode': 'batch-fallback'
          });
          span.addEvent('docplaybook.translate.batch_parse_failed', {
            'docplaybook.error_message': error instanceof Error ? error.message : String(error)
          });
          return this.translateBlocksIndividually(input);
        }
      }
    );
  }

  private async translateBlocksIndividually(input: {
    sourceLanguage: string;
    targetLanguage: string;
    memoryText: string;
    glossaryText?: string;
    docKey: string;
    blocks: Array<{
      index: number;
      sourceBlock: string;
      existingTranslation?: string;
    }>;
  }): Promise<BatchTranslationResult> {
    const texts: string[] = [];
    const usage = zeroUsage();
    const startedAt = Date.now();
    const totalSourceChars = input.blocks.reduce((sum, block) => sum + block.sourceBlock.length, 0);
    debugLog(
      `single-block fallback ${input.targetLanguage} for ${input.docKey}: blocks=${input.blocks.length}, sourceChars=${totalSourceChars}.`
    );

    for (const block of input.blocks) {
      const blockStartedAt = Date.now();
      const translated = await this.translateBlock({
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        memoryText: input.memoryText,
        glossaryText: input.glossaryText,
        sourceBlock: block.sourceBlock,
        existingTranslation: block.existingTranslation,
        docKey: input.docKey
      });
      texts.push(translated.text);
      addUsage(usage, translated.usage);
      debugLog(
        `single-block fallback ${input.targetLanguage} block for ${input.docKey}: index=${block.index + 1}, sourceChars=${block.sourceBlock.length}, elapsedMs=${Date.now() - blockStartedAt}.`
      );
    }

    debugLog(
      `single-block fallback ${input.targetLanguage} complete for ${input.docKey}: blocks=${input.blocks.length}, sourceChars=${totalSourceChars}, elapsedMs=${Date.now() - startedAt}.`
    );

    return {
      texts,
      usage
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

function chunkBlocks<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

async function writeDebugTrace(input: {
  kind: 'single' | 'batch';
  docKey: string;
  targetLanguage: string;
  blockCount: number;
  sourceChars: number;
  systemPrompt: string;
  prompt: string;
  responseText: string;
}): Promise<void> {
  if (!isDebugEnabled()) {
    return;
  }

  await fs.mkdir(DEBUG_TRACE_DIR, { recursive: true });
  const safeDocKey = sanitizeForFilename(input.docKey);
  const filePath = path.join(
    DEBUG_TRACE_DIR,
    `${Date.now()}-${input.kind}-${input.targetLanguage}-${safeDocKey}-${randomUUID().slice(0, 8)}.json`
  );
  await fs.writeFile(
    filePath,
    `${JSON.stringify({
      kind: input.kind,
      docKey: input.docKey,
      targetLanguage: input.targetLanguage,
      blockCount: input.blockCount,
      sourceChars: input.sourceChars,
      systemPrompt: input.systemPrompt,
      prompt: input.prompt,
      responseText: input.responseText
    }, null, 2)}\n`,
    'utf8'
  );
  debugLog(`llm trace saved: ${filePath}`);
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'doc';
}

function readPositiveIntEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }

  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}
