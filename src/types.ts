export type LayoutKind = 'sibling' | 'docusaurus' | 'rspress';

export interface GatewayModelConfig {
  kind: 'gateway';
  model: string;
  apiKeyEnv?: string;
}

export interface OpenAIModelConfig {
  kind: 'openai';
  model: string;
  apiKeyEnv?: string;
  baseUrlEnv?: string;
}

export interface AnthropicModelConfig {
  kind: 'anthropic';
  model: string;
  apiKeyEnv?: string;
  authTokenEnv?: string;
  baseUrlEnv?: string;
}

export interface OpenAICompatibleModelConfig {
  kind: 'openai-compatible';
  providerName: string;
  model: string;
  baseUrlEnv: string;
  apiKeyEnv: string;
}

export type ModelConfig =
  | GatewayModelConfig
  | OpenAIModelConfig
  | AnthropicModelConfig
  | OpenAICompatibleModelConfig;

export type ModelKind = ModelConfig['kind'];

export interface StoredAppConfig {
  version: 1;
  sourceLanguage: string;
  targetLanguages: string[];
  ignorePatterns?: string[];
  concurrency?: ConcurrencyConfig;
  batch?: {
    maxBlocksPerBatch?: number;
    maxCharsPerBatch?: number;
  };
  layout: {
    kind: LayoutKind;
  };
  model?: ModelConfig;
}

export interface AppConfig extends StoredAppConfig {
  model: ModelConfig;
}

export interface ConcurrencyConfig {
  maxConcurrentRequests?: number;
}

export interface DocumentRef {
  language: string;
  relativePath: string;
  absolutePath: string;
  isSource: boolean;
  exists: boolean;
}

export interface DocSet {
  id: string;
  docKey: string;
  source: DocumentRef;
  targets: Record<string, DocumentRef>;
}

export interface MarkdownBlock {
  index: number;
  kind: string;
  prefix: string;
  raw: string;
  translatable: boolean;
  hash: string;
}

export interface DocumentSnapshot {
  relativePath: string;
  hash: string;
  updatedAt: string;
  blocks: MarkdownBlock[];
  tail: string;
}

export interface TargetRuntimeState {
  language: string;
  generated?: DocumentSnapshot;
  accepted?: DocumentSnapshot;
}

export interface DocSetRuntimeState {
  docSetId: string;
  source?: DocumentSnapshot;
  targets: Record<string, TargetRuntimeState>;
  updatedAt: string;
}

export interface WorkspaceRuntimeState {
  version: 1;
  workspaceId: string;
  updatedAt: string;
  docSets: Record<string, DocSetRuntimeState>;
}

export interface TranslationContext {
  sourceLanguage: string;
  targetLanguage: string;
  memoryText: string;
  sourceBlock: string;
  existingTranslation?: string;
  docKey: string;
}

export interface ManualCorrection {
  index: number;
  sourceBlock: string;
  previousTranslation: string;
  correctedTranslation: string;
}

export interface ModelUsageStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface TranslationResult {
  text: string;
  usage: ModelUsageStats;
}

export interface BatchTranslationResult {
  texts: string[];
  usage: ModelUsageStats;
}

export interface MemoryUpdateResult {
  text: string;
  usage: ModelUsageStats;
}

export interface RewriteJudgementResult {
  isMajorRewrite: boolean;
  reason: string;
  usage: ModelUsageStats;
}

export interface ProviderEvent {
  kind: 'add' | 'change' | 'unlink';
  absolutePath: string;
  relativePath: string;
}
