import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { loadWorkspaceEnv } from '../src/env.ts';
import { createModelHandle } from '../src/model/model-factory.ts';

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

test('createModelHandle supports official OpenAI configuration', async () => {
  await withEnv(
    {
      OPENAI_API_KEY: 'test-openai-key',
      OPENAI_BASE_URL: undefined
    },
    async () => {
      const handle = createModelHandle({
        kind: 'openai',
        model: 'gpt-5-mini',
        apiKeyEnv: 'OPENAI_API_KEY',
        baseUrlEnv: 'OPENAI_BASE_URL'
      });

      assert.equal(handle.label, 'openai:gpt-5-mini');
      assert.equal(typeof handle.model, 'object');
    }
  );
});

test('createModelHandle supports official Anthropic configuration with auth token fallback', async () => {
  await withEnv(
    {
      ANTHROPIC_API_KEY: undefined,
      ANTHROPIC_AUTH_TOKEN: 'test-anthropic-token',
      ANTHROPIC_BASE_URL: undefined
    },
    async () => {
      const handle = createModelHandle({
        kind: 'anthropic',
        model: 'claude-sonnet-4-5',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        authTokenEnv: 'ANTHROPIC_AUTH_TOKEN',
        baseUrlEnv: 'ANTHROPIC_BASE_URL'
      });

      assert.equal(handle.label, 'anthropic:claude-sonnet-4-5');
      assert.equal(typeof handle.model, 'object');
    }
  );
});

test('createModelHandle supports openai-compatible custom providers', async () => {
  await withEnv(
    {
      OPENROUTER_API_KEY: 'test-openrouter-key',
      OPENROUTER_BASE_URL: 'https://openrouter.example.com/v1'
    },
    async () => {
      const handle = createModelHandle({
        kind: 'openai-compatible',
        providerName: 'openrouter',
        model: 'google/gemini-2.5-flash',
        apiKeyEnv: 'OPENROUTER_API_KEY',
        baseUrlEnv: 'OPENROUTER_BASE_URL'
      });

      assert.equal(handle.label, 'openrouter:google/gemini-2.5-flash');
      assert.equal(typeof handle.model, 'object');
    }
  );
});

test('loadWorkspaceEnv loads docplaybook-specific env files before general ones', async (t) => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), 'docplaybook-env-test-')
  );
  t.after(async () => {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  });

  await fs.mkdir(path.join(workspaceRoot, '.docplaybook'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, '.env'), 'TEST_PRIORITY=from-env\n', 'utf8');
  await fs.writeFile(
    path.join(workspaceRoot, '.env.local'),
    'TEST_PRIORITY=from-env-local\n',
    'utf8'
  );
  await fs.writeFile(
    path.join(workspaceRoot, '.docplaybook', '.env'),
    'TEST_PRIORITY=from-agent-env\n',
    'utf8'
  );
  await fs.writeFile(
    path.join(workspaceRoot, '.docplaybook', '.env.local'),
    'TEST_PRIORITY=from-agent-env-local\n',
    'utf8'
  );

  await withEnv(
    {
      TEST_PRIORITY: undefined
    },
    async () => {
      await loadWorkspaceEnv(workspaceRoot);
      assert.equal(process.env.TEST_PRIORITY, 'from-agent-env-local');
    }
  );
});
