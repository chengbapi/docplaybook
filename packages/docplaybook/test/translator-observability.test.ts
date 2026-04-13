import test from 'node:test';
import assert from 'node:assert/strict';
import { Translator } from '../src/translation/translator.ts';
import type { DocplaybookObservability, ObservabilitySpan } from '../src/observability.ts';
import type { ModelHandle } from '../src/model/model-factory.ts';

interface RecordedSpan {
  name: string;
  attributes: Record<string, string | number | boolean>;
  events: Array<{
    name: string;
    attributes: Record<string, string | number | boolean>;
  }>;
  parentName?: string;
}

class RecordingObservability implements DocplaybookObservability {
  public readonly enabled = true;
  public readonly spans: RecordedSpan[] = [];
  private readonly stack: RecordedSpan[] = [];

  public async withSpan<T>(
    name: string,
    attributes: Record<string, string | number | boolean | null | undefined>,
    run: (span: ObservabilitySpan) => Promise<T> | T
  ): Promise<T> {
    const current: RecordedSpan = {
      name,
      attributes: compactAttributes(attributes),
      events: [],
      parentName: this.stack.at(-1)?.name
    };
    this.spans.push(current);
    this.stack.push(current);

    try {
      return await run({
        setAttributes: (next) => {
          Object.assign(current.attributes, compactAttributes(next));
        },
        addEvent: (eventName, next) => {
          current.events.push({
            name: eventName,
            attributes: compactAttributes(next ?? {})
          });
        }
      });
    } finally {
      this.stack.pop();
    }
  }

  public addEvent(name: string, attributes?: Record<string, string | number | boolean | null | undefined>): void {
    const current = this.stack.at(-1);
    if (!current) {
      return;
    }

    current.events.push({
      name,
      attributes: compactAttributes(attributes ?? {})
    });
  }

  public logGeneration(): void {}

  public async flush(): Promise<void> {}
}

const fakeModelHandle = {
  model: {} as ModelHandle['model'],
  label: 'openai:gpt-5-mini'
} satisfies ModelHandle;

test('translateBlock emits a single model-call span with usage metadata', async () => {
  const observability = new RecordingObservability();
  const translator = new Translator(
    fakeModelHandle,
    observability,
    async () => ({
      text: 'Hello world',
      usage: {
        inputTokens: 11,
        outputTokens: 7,
        totalTokens: 18
      }
    })
  );

  const result = await translator.translateBlock({
    sourceLanguage: 'zh-CN',
    targetLanguage: 'en',
    memoryText: '- Keep CLI commands in English.',
    sourceBlock: '你好，世界',
    docKey: 'guide.intro'
  });

  assert.equal(result.text, 'Hello world');
  assert.equal(observability.spans.length, 1);
  assert.equal(observability.spans[0]?.name, 'docplaybook.translate.model_call');
  assert.equal(observability.spans[0]?.attributes['docplaybook.call_mode'], 'single');
  assert.equal(observability.spans[0]?.attributes['docplaybook.doc_key'], 'guide.intro');
  assert.equal(observability.spans[0]?.attributes['docplaybook.target_language'], 'en');
  assert.equal(observability.spans[0]?.attributes['docplaybook.total_tokens'], 18);
});

test('translateBlocks emits batch metadata and usage on success', async () => {
  const observability = new RecordingObservability();
  const translator = new Translator(
    fakeModelHandle,
    observability,
    async ({ prompt }) => {
      const ids = [...prompt.matchAll(/\(id ([a-f0-9]{8}),/g)].map((match) => match[1]!);
      return {
        text: JSON.stringify({
          blocks: ids.map((id, index) => ({
            id,
            text: `Translated ${index + 1}`
          }))
        }),
        usage: {
          inputTokens: 21,
          outputTokens: 10,
          totalTokens: 31
        }
      };
    }
  );

  const result = await translator.translateBlocks({
    sourceLanguage: 'zh-CN',
    targetLanguage: 'en',
    memoryText: 'Use Wiki, not Knowledge Base.',
    docKey: 'guide.batch',
    blocks: [
      { index: 0, sourceBlock: '第一段。' },
      { index: 1, sourceBlock: '第二段。' }
    ]
  });

  assert.deepEqual(result.texts, ['Translated 1', 'Translated 2']);
  assert.equal(result.usage.totalTokens, 31);
  assert.equal(observability.spans.length, 1);
  assert.equal(observability.spans[0]?.attributes['docplaybook.call_mode'], 'batch');
  assert.equal(observability.spans[0]?.attributes['docplaybook.block_count'], 2);
  assert.equal(observability.spans[0]?.attributes['docplaybook.total_tokens'], 31);
  assert.equal(observability.spans[0]?.events.length, 0);
});

test('translateBlocks records a batch parse failure and falls back to single-block spans', async () => {
  const observability = new RecordingObservability();
  let callCount = 0;
  const translator = new Translator(
    fakeModelHandle,
    observability,
    async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          text: 'not json',
          usage: {
            inputTokens: 30,
            outputTokens: 5,
            totalTokens: 35
          }
        };
      }

      return {
        text: `Translated fallback ${callCount - 1}`,
        usage: {
          inputTokens: 8,
          outputTokens: 4,
          totalTokens: 12
        }
      };
    }
  );

  const result = await translator.translateBlocks({
    sourceLanguage: 'zh-CN',
    targetLanguage: 'en',
    memoryText: 'Prefer concise English.',
    docKey: 'guide.fallback',
    blocks: [
      { index: 0, sourceBlock: '第一段。' },
      { index: 1, sourceBlock: '第二段。' }
    ]
  });

  assert.deepEqual(result.texts, ['Translated fallback 1', 'Translated fallback 2']);
  assert.equal(result.usage.totalTokens, 24);
  assert.equal(observability.spans.length, 3);
  assert.equal(observability.spans[0]?.attributes['docplaybook.call_mode'], 'batch-fallback');
  assert.equal(
    observability.spans[0]?.events.some((event) => event.name === 'docplaybook.translate.batch_parse_failed'),
    true
  );
  assert.equal(
    observability.spans.filter((span) => span.attributes['docplaybook.call_mode'] === 'single').length,
    2
  );
});

function compactAttributes(
  attributes: Record<string, string | number | boolean | null | undefined>
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(attributes).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== null)
  );
}
