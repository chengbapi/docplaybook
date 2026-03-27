import { generateText, type LanguageModel } from 'ai';
import path from 'node:path';
import { getWorkspaceLocalEnvPath, writeWorkspaceEnvValues } from '../env.js';
import { getMissingModelEnvRequirements, resolveModelConfig } from '../model/model-config.js';
import { createModelHandle } from '../model/model-factory.js';
import { UserFacingError } from '../errors.js';
import type { ModelConfig, ModelKind } from '../types.js';
import {
  canPrompt,
  promptModelKind,
  promptOptionalValue,
  promptProviderName,
  promptSecret
} from './prompts.js';

export interface ModelSetupOptions {
  modelKind?: ModelKind;
  model?: string;
  apiKeyEnv?: string;
  authTokenEnv?: string;
  providerName?: string;
  baseUrlEnv?: string;
}

export interface EnsureModelEnvResult {
  ready: boolean;
  envPath: string;
  wroteValues: boolean;
  missingLabels: string[];
}

export type ModelConnectionTester = (input: {
  model: LanguageModel;
  prompt: string;
}) => Promise<{ text: string }>;

function toEnvPrefix(providerName: string): string {
  const normalized = providerName
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  return normalized || 'CUSTOM_PROVIDER';
}

export async function resolveInitModelConfig(options: ModelSetupOptions): Promise<ModelConfig> {
  const modelKind = options.modelKind ?? (canPrompt() ? await promptModelKind() : 'openai');

  if (modelKind !== 'openai-compatible') {
    return resolveModelConfig({
      modelKind,
      model: options.model,
      apiKeyEnv: options.apiKeyEnv,
      authTokenEnv: options.authTokenEnv,
      providerName: options.providerName,
      baseUrlEnv: options.baseUrlEnv
    });
  }

  const providerName = options.providerName || (await promptProviderName('openrouter'));
  const envPrefix = toEnvPrefix(providerName);

  return resolveModelConfig({
    modelKind,
    providerName,
    model: options.model,
    apiKeyEnv: options.apiKeyEnv || `${envPrefix}_API_KEY`,
    baseUrlEnv: options.baseUrlEnv || `${envPrefix}_BASE_URL`
  });
}

export async function ensureModelEnvForInit(
  workspaceRoot: string,
  model: ModelConfig
): Promise<EnsureModelEnvResult> {
  let missing = getMissingModelEnvRequirements(model);
  const envPath = getWorkspaceLocalEnvPath(workspaceRoot);

  if (missing.length === 0) {
    return {
      ready: true,
      envPath,
      wroteValues: false,
      missingLabels: []
    };
  }

  const nextValues: Record<string, string> = {};

  if (canPrompt()) {
    console.log('');
    console.log(`Model setup for ${model.kind}:`);

    for (const requirement of missing) {
      const envNames = requirement.names.join(' or ');
      const prompt =
        requirement.secret
          ? `${requirement.label} is not set (${envNames}). Paste it now to save in ${path.basename(envPath)}, or leave empty to configure later: `
          : `${requirement.label} is not set (${envNames}). Enter it now to save in ${path.basename(envPath)}, or leave empty to configure later`;

      const value = requirement.secret
        ? await promptSecret(prompt)
        : await promptOptionalValue(prompt);

      if (value.trim()) {
        nextValues[requirement.saveToEnvName] = value.trim();
        process.env[requirement.saveToEnvName] = value.trim();
      }
    }

    if (Object.keys(nextValues).length > 0) {
      await writeWorkspaceEnvValues(workspaceRoot, nextValues);
    }

    missing = getMissingModelEnvRequirements(model);
  }

  return {
    ready: missing.length === 0,
    envPath,
    wroteValues: Object.keys(nextValues).length > 0,
    missingLabels: missing.map((requirement) => `${requirement.label} (${requirement.names.join(' or ')})`)
  };
}

export async function testModelConnection(
  model: ModelConfig,
  tester: ModelConnectionTester = async ({ model: languageModel, prompt }) => {
    return generateText({
      model: languageModel,
      prompt
    });
  }
): Promise<void> {
  const handle = createModelHandle(model);

  try {
    await tester({
      model: handle.model,
      prompt: 'Reply with OK only.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserFacingError(
      `Model connectivity check failed for ${handle.label}. ${message}`
    );
  }
}
