import test from 'node:test';
import assert from 'node:assert/strict';
import { trace } from '@opentelemetry/api';
import { UserFacingError } from '../src/errors.ts';
import { createObservability, readLangfuseConfigFromEnv } from '../src/observability.ts';

test('readLangfuseConfigFromEnv returns null when Langfuse is disabled', () => {
  assert.equal(readLangfuseConfigFromEnv({}), null);
  assert.equal(readLangfuseConfigFromEnv({ DOCPLAYBOOK_LANGFUSE_ENABLED: 'false' }), null);
});

test('readLangfuseConfigFromEnv requires credentials when Langfuse is enabled', () => {
  assert.throws(
    () =>
      readLangfuseConfigFromEnv({
        DOCPLAYBOOK_LANGFUSE_ENABLED: 'true',
        LANGFUSE_PUBLIC_KEY: 'pk_test'
      }),
    (error: unknown) => {
      assert.ok(error instanceof UserFacingError);
      assert.match(error.message, /LANGFUSE_SECRET_KEY/);
      return true;
    }
  );
});

test('noop observability span helpers do not throw', async () => {
  const observability = createObservability({ env: {} });

  const value = await observability.withSpan('docplaybook.test.noop', {}, async (span) => {
    span.setAttributes({
      one: 1,
      ignored: undefined
    });
    span.addEvent('docplaybook.test.event', {
      ok: true
    });
    observability.addEvent('docplaybook.test.current');
    return 42;
  });

  assert.equal(value, 42);
  await observability.flush();
});

test('enabled observability flushes via the runtime shutdown hook', async () => {
  let shutdownCount = 0;
  const observability = createObservability({
    env: {
      DOCPLAYBOOK_LANGFUSE_ENABLED: 'true',
      LANGFUSE_PUBLIC_KEY: 'pk_test',
      LANGFUSE_SECRET_KEY: 'sk_test',
      LANGFUSE_HOST: 'https://cloud.langfuse.com'
    },
    runtimeFactory: () => ({
      tracer: trace.getTracer('docplaybook-test'),
      shutdown: async () => {
        shutdownCount += 1;
      }
    })
  });

  await observability.withSpan('docplaybook.test.enabled', { ok: true }, async (span) => {
    span.addEvent('docplaybook.test.event');
  });
  await observability.flush();

  assert.equal(shutdownCount, 1);
});
