import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { UserFacingError } from './errors.js';
import type { AppConfig, LayoutKind, ModelConfig } from './types.js';
import { ensureDir, nowIso, pathExists, unique } from './utils.js';

const gatewayModelSchema = z.object({
  kind: z.literal('gateway'),
  model: z.string().min(1),
  apiKeyEnv: z.string().min(1).optional()
});

const openAIModelSchema = z.object({
  kind: z.literal('openai'),
  model: z.string().min(1),
  apiKeyEnv: z.string().min(1).optional(),
  baseUrlEnv: z.string().min(1).optional()
});

const anthropicModelSchema = z.object({
  kind: z.literal('anthropic'),
  model: z.string().min(1),
  apiKeyEnv: z.string().min(1).optional(),
  authTokenEnv: z.string().min(1).optional(),
  baseUrlEnv: z.string().min(1).optional()
});

const openAICompatibleModelSchema = z.object({
  kind: z.literal('openai-compatible'),
  providerName: z.string().min(1),
  model: z.string().min(1),
  baseUrlEnv: z.string().min(1),
  apiKeyEnv: z.string().min(1)
});

const configSchema = z.object({
  version: z.literal(1),
  provider: z.object({
    kind: z.literal('local')
  }),
  sourceLanguage: z.string().min(1),
  targetLanguages: z.array(z.string().min(1)).min(1),
  layout: z.object({
    kind: z.enum(['sibling', 'docusaurus', 'rspress'])
  }),
  model: z.union([
    gatewayModelSchema,
    openAIModelSchema,
    anthropicModelSchema,
    openAICompatibleModelSchema
  ]),
  watch: z
    .object({
      ignore: z.array(z.string().min(1)).optional()
    })
    .optional()
});

export interface InitOptions {
  workspaceRoot: string;
  sourceLanguage: string;
  targetLanguages: string[];
  layoutKind: LayoutKind;
  model: ModelConfig;
  force?: boolean;
}

export const CONFIG_DIRNAME = 'docplaybook';
export const CONFIG_BASENAME = 'config.json';
export const MEMORIES_DIRNAME = 'memories';
export const DEFAULT_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/docplaybook/**',
  '**/translator-agent/**'
];

export function getConfigDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, CONFIG_DIRNAME);
}

export function getConfigPath(workspaceRoot: string): string {
  return path.join(getConfigDir(workspaceRoot), CONFIG_BASENAME);
}

export function getMemoriesDir(workspaceRoot: string): string {
  return path.join(getConfigDir(workspaceRoot), MEMORIES_DIRNAME);
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
  const parsed = JSON.parse(raw);
  return configSchema.parse(parsed);
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

  const config: AppConfig = {
    version: 1,
    provider: {
      kind: 'local'
    },
    sourceLanguage: existingConfig && !options.force ? existingConfig.sourceLanguage : options.sourceLanguage,
    targetLanguages: unique([
      ...(existingConfig && !options.force ? existingConfig.targetLanguages : []),
      ...options.targetLanguages
    ]),
    layout: {
      kind: existingConfig && !options.force ? existingConfig.layout.kind : options.layoutKind
    },
    model: existingConfig && !options.force ? existingConfig.model : options.model,
    watch: {
      ignore: existingConfig?.watch?.ignore ?? DEFAULT_IGNORE_PATTERNS
    }
  };

  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  for (const targetLanguage of config.targetLanguages) {
    const memoryPath = path.join(
      getMemoriesDir(options.workspaceRoot),
      `${config.sourceLanguage}__${targetLanguage}.md`
    );

    if ((await pathExists(memoryPath)) && !options.force) {
      continue;
    }

    const seed = [
      `# Translation Playbook: ${config.sourceLanguage} -> ${targetLanguage}`,
      '',
      'This file is injected into every translation prompt for this language pair.',
      '',
      `- Updated: ${nowIso()}`,
      '- Add reusable corrections, terminology, and style preferences here.',
      '- Keep it concise and deduplicated so it stays prompt-friendly.',
      ''
    ].join('\n');

    await fs.writeFile(memoryPath, seed, 'utf8');
  }
}
