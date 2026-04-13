import { context, trace, SpanStatusCode, type Span, type Tracer } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor, isDefaultExportSpan } from '@langfuse/otel';
import Langfuse from 'langfuse';
import { UserFacingError } from './errors.js';

type AttributeValue = string | number | boolean;
type AttributeMap = Record<string, AttributeValue | null | undefined>;

export interface ObservabilitySpan {
  setAttributes(attributes: AttributeMap): void;
  addEvent(name: string, attributes?: AttributeMap): void;
}

export interface GenerationLogInput {
  docKey: string;
  targetLanguage: string;
  callMode: 'single' | 'batch';
  modelLabel: string;
  systemPrompt: string;
  userPrompt: string;
  output: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

export interface DocplaybookObservability {
  readonly enabled: boolean;
  withSpan<T>(
    name: string,
    attributes: AttributeMap,
    run: (span: ObservabilitySpan) => Promise<T> | T
  ): Promise<T>;
  addEvent(name: string, attributes?: AttributeMap): void;
  logGeneration(input: GenerationLogInput): void;
  flush(): Promise<void>;
}

export interface LangfuseConfig {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
  flushTimeoutMs: number;
}

interface ObservabilityRuntime {
  tracer: Tracer;
  shutdown(): Promise<void>;
}

interface ObservabilityOptions {
  env?: NodeJS.ProcessEnv;
  runtimeFactory?: (config: LangfuseConfig) => ObservabilityRuntime;
}

const DOCPLAYBOOK_TRACER_NAME = 'docplaybook';
const DEFAULT_LANGFUSE_HOST = 'https://cloud.langfuse.com';
const DEFAULT_FLUSH_TIMEOUT_MS = 5_000;

export const noopObservability: DocplaybookObservability = {
  enabled: false,
  async withSpan<T>(_name: string, _attributes: AttributeMap, run: (span: ObservabilitySpan) => Promise<T> | T): Promise<T> {
    return run(noopSpan);
  },
  addEvent(): void {},
  logGeneration(): void {},
  async flush(): Promise<void> {}
};

const noopSpan: ObservabilitySpan = {
  setAttributes(): void {},
  addEvent(): void {}
};

class OpenTelemetryObservability implements DocplaybookObservability {
  public readonly enabled = true;

  public constructor(
    private readonly tracer: Tracer,
    private readonly shutdownFn: () => Promise<void>,
    private readonly langfuseClient: Langfuse | null = null
  ) {}

  public async withSpan<T>(
    name: string,
    attributes: AttributeMap,
    run: (span: ObservabilitySpan) => Promise<T> | T
  ): Promise<T> {
    return this.tracer.startActiveSpan(
      name,
      { attributes: toSpanAttributes(attributes) },
      async (span) => {
        const wrapped = new OpenTelemetrySpan(span);
        try {
          return await run(wrapped);
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error)
          });
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  public addEvent(name: string, attributes?: AttributeMap): void {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) {
      return;
    }

    activeSpan.addEvent(name, toSpanAttributes(attributes ?? {}));
  }

  public logGeneration(input: GenerationLogInput): void {
    if (!this.langfuseClient) {
      return;
    }

    const trace = this.langfuseClient.trace({
      name: 'docplaybook.translate',
      metadata: {
        docKey: input.docKey,
        targetLanguage: input.targetLanguage,
        callMode: input.callMode
      }
    });

    trace.generation({
      name: `translate.${input.callMode}`,
      model: input.modelLabel,
      input: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt }
      ],
      output: input.output,
      usage: {
        input: input.usage.inputTokens,
        output: input.usage.outputTokens,
        total: input.usage.totalTokens
      },
      metadata: {
        docKey: input.docKey,
        targetLanguage: input.targetLanguage
      }
    });
  }

  public async flush(): Promise<void> {
    await this.shutdownFn();
  }
}

class OpenTelemetrySpan implements ObservabilitySpan {
  public constructor(private readonly span: Span) {}

  public setAttributes(attributes: AttributeMap): void {
    this.span.setAttributes(toSpanAttributes(attributes));
  }

  public addEvent(name: string, attributes?: AttributeMap): void {
    this.span.addEvent(name, toSpanAttributes(attributes ?? {}));
  }
}

export function createObservability(options: ObservabilityOptions = {}): DocplaybookObservability {
  const config = readLangfuseConfigFromEnv(options.env ?? process.env);
  if (!config) {
    return noopObservability;
  }

  const runtime = (options.runtimeFactory ?? createLangfuseRuntime)(config);

  const langfuseClient = new Langfuse({
    publicKey: config.publicKey,
    secretKey: config.secretKey,
    baseUrl: config.baseUrl,
    flushAt: 20,
    requestTimeout: config.flushTimeoutMs
  });

  return new OpenTelemetryObservability(
    runtime.tracer,
    async () => {
      await withTimeout(
        Promise.all([runtime.shutdown(), langfuseClient.flushAsync()]),
        config.flushTimeoutMs,
        'Timed out while flushing Langfuse.'
      );
    },
    langfuseClient
  );
}

export function readLangfuseConfigFromEnv(env: NodeJS.ProcessEnv): LangfuseConfig | null {
  const enabled = readBooleanEnv(env.DOCPLAYBOOK_LANGFUSE_ENABLED);
  if (!enabled) {
    return null;
  }

  const publicKey = env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = env.LANGFUSE_SECRET_KEY?.trim();
  const baseUrl = env.LANGFUSE_HOST?.trim() || env.LANGFUSE_BASE_URL?.trim() || DEFAULT_LANGFUSE_HOST;
  const flushTimeoutMs = readPositiveInt(env.DOCPLAYBOOK_LANGFUSE_FLUSH_TIMEOUT_MS) ?? DEFAULT_FLUSH_TIMEOUT_MS;

  const missing: string[] = [];
  if (!publicKey) {
    missing.push('LANGFUSE_PUBLIC_KEY');
  }
  if (!secretKey) {
    missing.push('LANGFUSE_SECRET_KEY');
  }

  if (missing.length > 0) {
    throw new UserFacingError(
      `Langfuse is enabled, but required environment variables are missing: ${missing.join(', ')}.`
    );
  }

  return {
    publicKey: publicKey!,
    secretKey: secretKey!,
    baseUrl,
    flushTimeoutMs
  };
}

function createLangfuseRuntime(config: LangfuseConfig): ObservabilityRuntime {
  const sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey: config.publicKey,
        secretKey: config.secretKey,
        baseUrl: config.baseUrl,
        exportMode: 'immediate',
        shouldExportSpan: ({ otelSpan }) =>
          otelSpan.name.startsWith('docplaybook.') || isDefaultExportSpan(otelSpan)
      })
    ]
  });
  sdk.start();

  return {
    tracer: trace.getTracer(DOCPLAYBOOK_TRACER_NAME),
    shutdown: async () => {
      await sdk.shutdown();
    }
  };
}

function readBooleanEnv(raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }

  switch (raw.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true;
    default:
      return false;
  }
}

function readPositiveInt(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }

  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function toSpanAttributes(attributes: AttributeMap): Record<string, AttributeValue> {
  return Object.fromEntries(
    Object.entries(attributes).filter((entry): entry is [string, AttributeValue] => entry[1] !== undefined && entry[1] !== null)
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new UserFacingError(message));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
