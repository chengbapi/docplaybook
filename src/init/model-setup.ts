import { generateText, type LanguageModel } from 'ai';
import { getWorkspaceLocalEnvPath, writeWorkspaceEnvValues } from '../env.js';
import {
  defaultModelForKind,
  getMissingModelEnvRequirements,
  getModelEnvRequirements,
  resolveModelConfig
} from '../model/model-config.js';
import { createModelHandle } from '../model/model-factory.js';
import { UserFacingError } from '../errors.js';
import type { ModelConfig, ModelKind } from '../types.js';
import { bold, cyan, green, red, yellow } from '../ui.js';
import {
  canPrompt,
  promptModelId,
  promptModelKind,
  promptModelKindWithDefault,
  promptModelScope,
  promptOptionalValue,
  promptProviderName,
  promptRetryModelSetupStep,
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

export interface PrepareInitModelResult {
  model: ModelConfig;
  envSetup: EnsureModelEnvResult;
  scope: 'workspace' | 'local';
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
  const defaultModel = options.model || defaultModelForKind(modelKind);
  const model = options.model ?? (canPrompt() ? await promptModelId(defaultModel) : defaultModel);

  if (modelKind !== 'openai-compatible') {
    return resolveModelConfig({
      modelKind,
      model,
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
    model,
    apiKeyEnv: options.apiKeyEnv || `${envPrefix}_API_KEY`,
    baseUrlEnv: options.baseUrlEnv || `${envPrefix}_BASE_URL`
  });
}

export async function ensureModelEnvForInit(
  workspaceRoot: string,
  model: ModelConfig,
  options: {
    forcePrompt?: boolean;
  } = {}
): Promise<EnsureModelEnvResult> {
  let missing = getMissingModelEnvRequirements(model);
  const envPath = getWorkspaceLocalEnvPath(workspaceRoot);

  if (missing.length === 0 && !options.forcePrompt) {
    return {
      ready: true,
      envPath,
      wroteValues: false,
      missingLabels: []
    };
  }

  const nextValues: Record<string, string> = {};

  if (canPrompt()) {
    const requirements = options.forcePrompt ? getModelEnvRequirements(model) : missing;
    console.log('');
    console.log(`${cyan(bold('Model setup'))} ${model.kind}`);

    for (const requirement of requirements) {
      const envNames = requirement.names.join(' or ');
      const value = await promptRequiredRequirementValue({
        secret: requirement.secret,
        prompt: requirement.secret
          ? `${requirement.label} (${envNames}): `
          : `${requirement.label} (${envNames}): `
      });

      nextValues[requirement.saveToEnvName] = value;
      process.env[requirement.saveToEnvName] = value;
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

async function promptRequiredRequirementValue(input: {
  secret: boolean;
  prompt: string;
}): Promise<string> {
  while (true) {
    const value = input.secret
      ? await promptSecret(input.prompt)
      : await promptOptionalValue(input.prompt);

    if (value.trim()) {
      return value.trim();
    }

    console.log(yellow('This value is required.'));
  }
}

export async function prepareInitModel(
  workspaceRoot: string,
  options: ModelSetupOptions
): Promise<PrepareInitModelResult> {
  let currentOptions: ModelSetupOptions = { ...options };
  let model =
    canPrompt()
      ? await resolveInteractiveInitModelConfig(currentOptions)
      : await resolveInitModelConfig(currentOptions);
  let envSetup = await ensureModelEnvForInit(workspaceRoot, model);
  const scope = canPrompt() ? await promptModelScope() : 'workspace';

  while (envSetup.ready) {
    try {
      console.log('');
      console.log(`${cyan(bold('Testing model connectivity'))} ${model.kind}`);
      await testModelConnection(model);
      console.log(green('Model connectivity check passed.'));
      return { model, envSetup, scope };
    } catch (error) {
      if (!canPrompt()) {
        throw error;
      }

      console.log('');
      console.log(red(error instanceof Error ? error.message : String(error)));

      const retryStep = await promptRetryModelSetupStep();

      if (retryStep === 1) {
        currentOptions = {};
        model = await resolveInteractiveInitModelConfig(currentOptions);
        envSetup = await ensureModelEnvForInit(workspaceRoot, model, { forcePrompt: true });
        continue;
      }

      if (retryStep === 2) {
        currentOptions = {
          ...currentOptions,
          modelKind: model.kind,
          model: undefined,
          providerName: model.kind === 'openai-compatible' ? model.providerName : undefined,
          apiKeyEnv: model.apiKeyEnv,
          authTokenEnv: model.kind === 'anthropic' ? model.authTokenEnv : undefined,
          baseUrlEnv: model.kind !== 'gateway' ? model.baseUrlEnv : undefined
        };
        model = await resolveInitModelConfig(currentOptions);
        envSetup = await ensureModelEnvForInit(workspaceRoot, model);
        continue;
      }

      envSetup = await ensureModelEnvForInit(workspaceRoot, model, { forcePrompt: true });
    }
  }

  return { model, envSetup, scope };
}

async function resolveInteractiveInitModelConfig(
  options: ModelSetupOptions
): Promise<ModelConfig> {
  const modelKind = await promptModelKindWithDefault(options.modelKind ?? 'openai');
  return resolveInitModelConfig({
    ...options,
    modelKind
  });
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

export function getModelOverrideEnvValues(model: ModelConfig): Record<string, string> {
  switch (model.kind) {
    case 'gateway':
      return {
        DOCPLAYBOOK_MODEL_KIND: model.kind,
        DOCPLAYBOOK_MODEL: model.model,
        DOCPLAYBOOK_MODEL_API_KEY_ENV: model.apiKeyEnv ?? 'AI_GATEWAY_API_KEY'
      };
    case 'openai':
      return {
        DOCPLAYBOOK_MODEL_KIND: model.kind,
        DOCPLAYBOOK_MODEL: model.model,
        DOCPLAYBOOK_MODEL_API_KEY_ENV: model.apiKeyEnv ?? 'OPENAI_API_KEY',
        ...(model.baseUrlEnv ? { DOCPLAYBOOK_MODEL_BASE_URL_ENV: model.baseUrlEnv } : {})
      };
    case 'anthropic':
      return {
        DOCPLAYBOOK_MODEL_KIND: model.kind,
        DOCPLAYBOOK_MODEL: model.model,
        ...(model.apiKeyEnv ? { DOCPLAYBOOK_MODEL_API_KEY_ENV: model.apiKeyEnv } : {}),
        ...(model.authTokenEnv ? { DOCPLAYBOOK_MODEL_AUTH_TOKEN_ENV: model.authTokenEnv } : {}),
        ...(model.baseUrlEnv ? { DOCPLAYBOOK_MODEL_BASE_URL_ENV: model.baseUrlEnv } : {})
      };
    case 'openai-compatible':
      return {
        DOCPLAYBOOK_MODEL_KIND: model.kind,
        DOCPLAYBOOK_MODEL: model.model,
        DOCPLAYBOOK_MODEL_PROVIDER_NAME: model.providerName,
        DOCPLAYBOOK_MODEL_API_KEY_ENV: model.apiKeyEnv,
        DOCPLAYBOOK_MODEL_BASE_URL_ENV: model.baseUrlEnv
      };
  }
}
