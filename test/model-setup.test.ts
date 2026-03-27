import test from 'node:test';
import assert from 'node:assert/strict';
import { UserFacingError } from '../src/errors.ts';
import { testModelConnection } from '../src/init/model-setup.ts';

async function withEnv<T>(
  vars: Record<string, string | undefined>,
  run: () => Promise<T> | T
): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('testModelConnection sends a lightweight connectivity prompt', async () => {
  let prompt = '';

  await withEnv({ OPENAI_API_KEY: 'test-openai-key' }, () =>
    testModelConnection(
      {
        kind: 'openai',
        model: 'gpt-5-mini',
        apiKeyEnv: 'OPENAI_API_KEY'
      },
      async (input) => {
        prompt = input.prompt;
        return { text: 'OK' };
      }
    )
  );

  assert.equal(prompt, 'Reply with OK only.');
});

test('testModelConnection wraps provider failures with a user-facing message', async () => {
  await withEnv({ ANTHROPIC_AUTH_TOKEN: 'test-token' }, () =>
    assert.rejects(
      () =>
        testModelConnection(
          {
            kind: 'anthropic',
            model: 'claude-sonnet-4-5',
            authTokenEnv: 'ANTHROPIC_AUTH_TOKEN'
          },
          async () => {
            throw new Error('401 Unauthorized');
          }
        ),
      (error: unknown) => {
        assert.ok(error instanceof UserFacingError);
        assert.match(error.message, /Model connectivity check failed/);
        assert.match(error.message, /401 Unauthorized/);
        return true;
      }
    )
  );
});
