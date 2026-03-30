import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { UserFacingError } from './errors.js';
import { renderInitialMemory } from './memories/template.js';
import type { AppConfig, LayoutKind, ModelConfig, ModelKind, StoredAppConfig } from './types.js';
import { ensureDir, nowIso, pathExists, unique } from './utils.js';
import { resolveModelConfig } from './model/model-config.js';

const gatewayModelSchema = z.object({
  kind: z.literal('gateway'),
  model: z.string().min(1),
  apiKeyEnv: z.string().min(1).optional()
}).strict();

const openAIModelSchema = z.object({
  kind: z.literal('openai'),
  model: z.string().min(1),
  apiKeyEnv: z.string().min(1).optional(),
  baseUrlEnv: z.string().min(1).optional()
}).strict();

const anthropicModelSchema = z.object({
  kind: z.literal('anthropic'),
  model: z.string().min(1),
  apiKeyEnv: z.string().min(1).optional(),
  authTokenEnv: z.string().min(1).optional(),
  baseUrlEnv: z.string().min(1).optional()
}).strict();

const openAICompatibleModelSchema = z.object({
  kind: z.literal('openai-compatible'),
  providerName: z.string().min(1),
  model: z.string().min(1),
  baseUrlEnv: z.string().min(1),
  apiKeyEnv: z.string().min(1)
}).strict();

const configSchema = z.object({
  version: z.literal(1),
  sourceLanguage: z.string().min(1),
  targetLanguages: z.array(z.string().min(1)).min(1),
  ignorePatterns: z.array(z.string().min(1)).optional(),
  concurrency: z.object({
    maxConcurrentRequests: z.number().int().min(1).max(20).optional()
  }).strict().optional(),
  batch: z.object({
    maxBlocksPerBatch: z.number().int().positive().optional(),
    maxCharsPerBatch: z.number().int().positive().optional()
  }).strict().optional(),
  layout: z.object({
    kind: z.enum(['sibling', 'docusaurus', 'rspress'])
  }).strict(),
  model: z.union([
    gatewayModelSchema,
    openAIModelSchema,
    anthropicModelSchema,
    openAICompatibleModelSchema
  ]).optional()
}).strict();

export interface InitOptions {
  workspaceRoot: string;
  sourceLanguage: string;
  targetLanguages: string[];
  layoutKind: LayoutKind;
  model?: ModelConfig;
  force?: boolean;
}

export const CONFIG_DIRNAME = '.docplaybook';
export const CONFIG_BASENAME = 'config.json';
export const MEMORIES_DIRNAME = 'memories';
export const DEFAULT_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/.docplaybook/**'
];
export const DEFAULT_MAX_CONCURRENT_REQUESTS = 6;
export const MAX_MAX_CONCURRENT_REQUESTS = 20;
export const DEFAULT_MAX_BLOCKS_PER_BATCH = 8;
export const DEFAULT_MAX_CHARS_PER_BATCH = 6_000;

export function getConfigDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, CONFIG_DIRNAME);
}

export function getConfigPath(workspaceRoot: string): string {
  return path.join(getConfigDir(workspaceRoot), CONFIG_BASENAME);
}

export function getMemoriesDir(workspaceRoot: string): string {
  return path.join(getConfigDir(workspaceRoot), MEMORIES_DIRNAME);
}

function parseJsonc(raw: string): unknown {
  let result = '';
  let inString = false;
  let stringQuote = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]!;
    const next = raw[index + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      } else if (char === '\n' || char === '\r') {
        result += char;
      }
      continue;
    }

    if (inString) {
      result += char;

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === stringQuote) {
        inString = false;
        stringQuote = '';
      }

      continue;
    }

    if ((char === '"' || char === "'") && !inString) {
      inString = true;
      stringQuote = char;
      result += char;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    result += char;
  }

  return JSON.parse(result);
}

export async function loadConfig(workspaceRoot: string): Promise<AppConfig> {
  const configPath = getConfigPath(workspaceRoot);
  if (!(await pathExists(configPath))) {
    throw new UserFacingError(
      [
        'No docplaybook config was found for this workspace.',
        `Expected file: ${configPath}`,
        '',
        'Run one of these commands first:',
        `  docplaybook init ${workspaceRoot}`,
        `  cd ${workspaceRoot} && docplaybook init .`
      ].join('\n')
    );
  }

  const raw = await fs.readFile(configPath, 'utf8');
  const parsed = parseJsonc(raw);
  const stored = configSchema.parse(parsed) as StoredAppConfig;
  const resolvedModel = stored.model ?? resolveModelConfigFromEnv(process.env);

  if (!resolvedModel) {
    throw new UserFacingError(
      [
        'No model configuration was found for this workspace.',
        `Update ${configPath} or set DOCPLAYBOOK_MODEL_KIND and related DOCPLAYBOOK_MODEL_* variables in .docplaybook/.env.local.`,
        '',
        'You can re-run:',
        `  docplaybook init ${workspaceRoot}`
      ].join('\n')
    );
  }

  return {
    ...stored,
    model: resolvedModel
  };
}

export async function initWorkspaceConfig(options: InitOptions): Promise<void> {
  const configDir = getConfigDir(options.workspaceRoot);
  const configPath = getConfigPath(options.workspaceRoot);
  const existingConfig = (await pathExists(configPath))
    ? await loadConfig(options.workspaceRoot)
    : undefined;

  if (
    existingConfig &&
    !options.force &&
    existingConfig.sourceLanguage !== options.sourceLanguage
  ) {
    throw new UserFacingError(
      `Existing source language is ${existingConfig.sourceLanguage}, but init requested ${options.sourceLanguage}. Use --force to replace it.`
    );
  }

  if (existingConfig && !options.force && existingConfig.layout.kind !== options.layoutKind) {
    throw new UserFacingError(
      `Existing layout is ${existingConfig.layout.kind}, but init requested ${options.layoutKind}. Use --force to replace it.`
    );
  }

  await ensureDir(configDir);
  await ensureDir(getMemoriesDir(options.workspaceRoot));

  const config: StoredAppConfig = {
    version: 1,
    sourceLanguage: existingConfig && !options.force ? existingConfig.sourceLanguage : options.sourceLanguage,
    targetLanguages: unique([
      ...(existingConfig && !options.force ? existingConfig.targetLanguages : []),
      ...options.targetLanguages
    ]),
    ignorePatterns: existingConfig?.ignorePatterns ?? DEFAULT_IGNORE_PATTERNS,
    concurrency: existingConfig?.concurrency ?? {
      maxConcurrentRequests: DEFAULT_MAX_CONCURRENT_REQUESTS
    },
    batch: existingConfig?.batch ?? {
      maxBlocksPerBatch: DEFAULT_MAX_BLOCKS_PER_BATCH,
      maxCharsPerBatch: DEFAULT_MAX_CHARS_PER_BATCH
    },
    layout: {
      kind: existingConfig && !options.force ? existingConfig.layout.kind : options.layoutKind
    },
    model: existingConfig && !options.force ? existingConfig.model : options.model
  };

  await fs.writeFile(configPath, renderConfigJsonc(config), 'utf8');

  for (const targetLanguage of config.targetLanguages) {
    const memoryPath = path.join(getMemoriesDir(options.workspaceRoot), `${targetLanguage}.md`);

    if ((await pathExists(memoryPath)) && !options.force) {
      continue;
    }

    const seed = renderInitialMemory(config.sourceLanguage, targetLanguage).replace(
      '## Terminology',
      `- Updated: ${nowIso()}\n\n## Terminology`
    );

    await fs.writeFile(memoryPath, seed, 'utf8');
  }
}

function renderConfigJsonc(config: StoredAppConfig): string {
  const ignorePatterns = config.ignorePatterns ?? DEFAULT_IGNORE_PATTERNS;
  const maxConcurrentRequests =
    config.concurrency?.maxConcurrentRequests ?? DEFAULT_MAX_CONCURRENT_REQUESTS;
  const maxBlocksPerBatch =
    config.batch?.maxBlocksPerBatch ?? DEFAULT_MAX_BLOCKS_PER_BATCH;
  const maxCharsPerBatch =
    config.batch?.maxCharsPerBatch ?? DEFAULT_MAX_CHARS_PER_BATCH;

  const modelLines = config.model
    ? [`  "model": ${JSON.stringify(config.model, null, 2).split('\n').join('\n  ')}`]
    : [
        '  // Model config is resolved from local env for this workspace.',
        '  // Edit .docplaybook/config.json if you want to lock the provider/model for everyone.'
      ];

  return [
    '{',
    '  "version": 1,',
    `  "sourceLanguage": ${JSON.stringify(config.sourceLanguage)},`,
    `  "targetLanguages": ${JSON.stringify(config.targetLanguages)},`,
    '  // Additional ignore globs for docplaybook scanning and watch.',
    '  // .gitignore rules are also applied by default, even if this array is empty.',
    `  "ignorePatterns": ${JSON.stringify(ignorePatterns)},`,
    '  // Shared request pool across all translation batches in a sync run.',
    '  // Increase carefully if your provider rate limits aggressively.',
    '  "concurrency": {',
    `    "maxConcurrentRequests": ${maxConcurrentRequests}`,
    '  },',
    '  // Batching reduces repeated prompt overhead on long documents.',
    '  "batch": {',
    `    "maxBlocksPerBatch": ${maxBlocksPerBatch},`,
    `    "maxCharsPerBatch": ${maxCharsPerBatch}`,
    '  },',
    '  "layout": {',
    `    "kind": ${JSON.stringify(config.layout.kind)}`,
    `  }${config.model ? ',' : ''}`,
    ...modelLines,
    '}',
    ''
  ].join('\n');
}

function resolveModelConfigFromEnv(env: NodeJS.ProcessEnv): ModelConfig | undefined {
  const modelKind = env.DOCPLAYBOOK_MODEL_KIND as ModelKind | undefined;
  const model = env.DOCPLAYBOOK_MODEL;

  if (!modelKind || !model) {
    return undefined;
  }

  return resolveModelConfig({
    modelKind,
    model,
    providerName: env.DOCPLAYBOOK_MODEL_PROVIDER_NAME,
    apiKeyEnv: env.DOCPLAYBOOK_MODEL_API_KEY_ENV,
    authTokenEnv: env.DOCPLAYBOOK_MODEL_AUTH_TOKEN_ENV,
    baseUrlEnv: env.DOCPLAYBOOK_MODEL_BASE_URL_ENV
  });
}
