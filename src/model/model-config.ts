import type { ModelConfig, ModelKind } from '../types.js';

export interface ResolveModelConfigOptions {
  modelKind: ModelKind;
  model?: string;
  apiKeyEnv?: string;
  authTokenEnv?: string;
  providerName?: string;
  baseUrlEnv?: string;
}

export interface ModelEnvRequirement {
  names: string[];
  label: string;
  secret: boolean;
  saveToEnvName: string;
}

export function defaultModelForKind(modelKind: ModelKind): string {
  switch (modelKind) {
    case 'gateway':
      return 'openai/gpt-5-mini';
    case 'openai':
      return 'gpt-5-mini';
    case 'anthropic':
      return 'claude-sonnet-4-5';
    case 'openai-compatible':
      return 'google/gemini-2.5-flash';
  }
}

export function resolveModelConfig(options: ResolveModelConfigOptions): ModelConfig {
  const model = options.model || defaultModelForKind(options.modelKind);

  if (options.modelKind === 'gateway') {
    return {
      kind: 'gateway',
      model,
      apiKeyEnv: options.apiKeyEnv || 'AI_GATEWAY_API_KEY'
    };
  }

  if (options.modelKind === 'openai') {
    return {
      kind: 'openai',
      model,
      apiKeyEnv: options.apiKeyEnv || 'OPENAI_API_KEY',
      baseUrlEnv: options.baseUrlEnv || 'OPENAI_BASE_URL'
    };
  }

  if (options.modelKind === 'anthropic') {
    return {
      kind: 'anthropic',
      model,
      apiKeyEnv: options.apiKeyEnv || 'ANTHROPIC_API_KEY',
      authTokenEnv: options.authTokenEnv || 'ANTHROPIC_AUTH_TOKEN',
      baseUrlEnv: options.baseUrlEnv || 'ANTHROPIC_BASE_URL'
    };
  }

  return {
    kind: 'openai-compatible',
    providerName: options.providerName || 'custom-provider',
    model,
    baseUrlEnv: options.baseUrlEnv || 'OPENAI_BASE_URL',
    apiKeyEnv: options.apiKeyEnv || 'OPENAI_API_KEY'
  };
}

export function getModelEnvRequirements(config: ModelConfig): ModelEnvRequirement[] {
  switch (config.kind) {
    case 'gateway':
      return [
        {
          names: [config.apiKeyEnv ?? 'AI_GATEWAY_API_KEY'],
          label: 'Vercel AI Gateway API key',
          secret: true,
          saveToEnvName: config.apiKeyEnv ?? 'AI_GATEWAY_API_KEY'
        }
      ];
    case 'openai':
      return [
        {
          names: [config.apiKeyEnv ?? 'OPENAI_API_KEY'],
          label: 'OpenAI API key',
          secret: true,
          saveToEnvName: config.apiKeyEnv ?? 'OPENAI_API_KEY'
        }
      ];
    case 'anthropic':
      return [
        {
          names: [config.apiKeyEnv ?? 'ANTHROPIC_API_KEY', config.authTokenEnv ?? 'ANTHROPIC_AUTH_TOKEN'],
          label: 'Anthropic API key or auth token',
          secret: true,
          saveToEnvName: config.apiKeyEnv ?? 'ANTHROPIC_API_KEY'
        }
      ];
    case 'openai-compatible':
      return [
        {
          names: [config.apiKeyEnv],
          label: `${config.providerName} API key`,
          secret: true,
          saveToEnvName: config.apiKeyEnv
        },
        {
          names: [config.baseUrlEnv],
          label: `${config.providerName} base URL`,
          secret: false,
          saveToEnvName: config.baseUrlEnv
        }
      ];
  }
}

export function getMissingModelEnvRequirements(
  config: ModelConfig,
  env: NodeJS.ProcessEnv = process.env
): ModelEnvRequirement[] {
  return getModelEnvRequirements(config).filter((requirement) => {
    return !requirement.names.some((name) => Boolean(env[name]));
  });
}
