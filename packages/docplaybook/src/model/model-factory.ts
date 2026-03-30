import { gateway } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { UserFacingError } from '../errors.js';
import type { ModelConfig } from '../types.js';

export interface ModelHandle {
  model: LanguageModel;
  label: string;
}

export function createModelHandle(config: ModelConfig): ModelHandle {
  switch (config.kind) {
    case 'gateway': {
      const apiKeyEnv = config.apiKeyEnv ?? 'AI_GATEWAY_API_KEY';
      if (!process.env[apiKeyEnv]) {
        throw new UserFacingError(
          `Missing environment variable ${apiKeyEnv} for gateway model "${config.model}".`
        );
      }

      return {
        model: gateway(config.model),
        label: `gateway:${config.model}`
      };
    }
    case 'openai': {
      const apiKeyEnv = config.apiKeyEnv ?? 'OPENAI_API_KEY';
      const apiKey = process.env[apiKeyEnv];
      const baseURL = config.baseUrlEnv ? process.env[config.baseUrlEnv] : undefined;

      if (!apiKey) {
        throw new UserFacingError(
          `Missing environment variable ${apiKeyEnv} for OpenAI model "${config.model}".`
        );
      }

      const provider = createOpenAI({
        apiKey,
        baseURL
      });

      return {
        model: provider(config.model),
        label: `openai:${config.model}`
      };
    }
    case 'anthropic': {
      const apiKeyEnv = config.apiKeyEnv ?? 'ANTHROPIC_API_KEY';
      const authTokenEnv = config.authTokenEnv ?? 'ANTHROPIC_AUTH_TOKEN';
      const apiKey = process.env[apiKeyEnv];
      const authToken = process.env[authTokenEnv];
      const baseURL = config.baseUrlEnv ? process.env[config.baseUrlEnv] : undefined;

      if (!apiKey && !authToken) {
        throw new UserFacingError(
          `Missing environment variables ${apiKeyEnv} or ${authTokenEnv} for Anthropic model "${config.model}".`
        );
      }

      const provider = createAnthropic({
        apiKey,
        authToken,
        baseURL
      });

      return {
        model: provider(config.model),
        label: `anthropic:${config.model}`
      };
    }
    case 'openai-compatible': {
      const apiKey = process.env[config.apiKeyEnv];
      const baseURL = process.env[config.baseUrlEnv];

      if (!apiKey) {
        throw new UserFacingError(
          `Missing environment variable ${config.apiKeyEnv} for ${config.providerName}.`
        );
      }

      if (!baseURL) {
        throw new UserFacingError(
          `Missing environment variable ${config.baseUrlEnv} for ${config.providerName}.`
        );
      }

      const provider = createOpenAICompatible({
        name: config.providerName,
        apiKey,
        baseURL
      });

      return {
        model: provider(config.model),
        label: `${config.providerName}:${config.model}`
      };
    }
  }
}
