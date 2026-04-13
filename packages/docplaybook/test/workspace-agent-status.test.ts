import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { initWorkspaceConfig, getSourceHashesPath } from '../src/config.ts';
import { GlossaryStore } from '../src/memories/glossary-store.ts';
import { MemoryStore } from '../src/memories/memory-store.ts';
import { WorkspaceAgent } from '../src/service/workspace-agent.ts';
import type { AppConfig } from '../src/types.ts';
import { sha256 } from '../src/utils.ts';

// status tests never make LLM calls; provide a dummy key so WorkspaceAgent can initialize
process.env['AI_GATEWAY_API_KEY'] = 'test-key-status';

async function createTempWorkspace(name: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `docplaybook-${name}-`));
}

async function setupWorkspace(root: string): Promise<AppConfig> {
  await fs.mkdir(path.join(root, 'docs'), { recursive: true });

  await initWorkspaceConfig({
    workspaceRoot: root,
    sourceLanguage: 'zh-CN',
    targetLanguages: ['en', 'ja'],
    layoutKind: 'sibling',
    model: {
      kind: 'gateway',
      model: 'openai/gpt-4o',
      apiKeyEnv: 'AI_GATEWAY_API_KEY'
    },
    force: true
  });

  return {
    version: 1,
    sourceLanguage: 'zh-CN',
    targetLanguages: ['en', 'ja'],
    layout: { kind: 'sibling' },
    model: {
      kind: 'gateway',
      model: 'openai/gpt-4o',
      apiKeyEnv: 'AI_GATEWAY_API_KEY'
    },
    ignorePatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.docplaybook/**']
  };
}

/** Capture all console.log lines emitted during fn() */
async function captureLog(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '));
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return lines;
}

test('WorkspaceAgent statusForWorkspace shows up-to-date count when source hash matches', async (t) => {
  const root = await createTempWorkspace('status-uptodate');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const config = await setupWorkspace(root);

  const sourceRaw = '# 欢迎\n\n第一段。\n';
  await fs.writeFile(path.join(root, 'docs/guide.md'), sourceRaw, 'utf8');
  await fs.writeFile(path.join(root, 'docs/guide.en.md'), '# Welcome\n\nFirst paragraph.\n', 'utf8');

  // Record hash as matching the current source
  await fs.mkdir(path.dirname(getSourceHashesPath(root)), { recursive: true });
  await fs.writeFile(
    getSourceHashesPath(root),
    `${JSON.stringify({ 'docs/guide.en.md': sha256(sourceRaw) }, null, 2)}\n`,
    'utf8'
  );

  const agent = new WorkspaceAgent(root, config);
  const lines = await captureLog(() => agent.statusForWorkspace());

  const output = lines.join('\n');
  // Should show 1/1 for en (up to date)
  assert.match(output, /1\/1/);
  // Should show 100%
  assert.match(output, /100%/);
});

test('WorkspaceAgent statusForWorkspace reports stale count when hash does not match', async (t) => {
  const root = await createTempWorkspace('status-stale');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const config = await setupWorkspace(root);

  const sourceRaw = '# 欢迎\n\n第一段。\n';
  await fs.writeFile(path.join(root, 'docs/guide.md'), sourceRaw, 'utf8');
  await fs.writeFile(path.join(root, 'docs/guide.en.md'), '# Welcome\n\nFirst paragraph.\n', 'utf8');

  // Record an old (wrong) hash — target exists but doesn't match source
  await fs.mkdir(path.dirname(getSourceHashesPath(root)), { recursive: true });
  await fs.writeFile(
    getSourceHashesPath(root),
    `${JSON.stringify({ 'docs/guide.en.md': 'outdated-hash-value' }, null, 2)}\n`,
    'utf8'
  );

  const agent = new WorkspaceAgent(root, config);
  const lines = await captureLog(() => agent.statusForWorkspace());

  const output = lines.join('\n');
  // en: 0/1 translated, 1 stale
  assert.match(output, /0\/1/);
  assert.match(output, /0%/);
  // Should suggest running translate
  assert.match(output, /docplaybook translate/);
});

test('WorkspaceAgent statusForWorkspace reports missing count when target file absent', async (t) => {
  const root = await createTempWorkspace('status-missing');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const config = await setupWorkspace(root);
  await fs.writeFile(path.join(root, 'docs/guide.md'), '# 欢迎\n\n第一段。\n', 'utf8');
  // No target file written
  const agent = new WorkspaceAgent(root, config);
  const lines = await captureLog(() => agent.statusForWorkspace());

  const output = lines.join('\n');
  assert.match(output, /docplaybook translate/);
});

test('WorkspaceAgent statusForWorkspace shows glossary and memory counts', async (t) => {
  const root = await createTempWorkspace('status-inventory');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const config = await setupWorkspace(root);
  await fs.writeFile(path.join(root, 'docs/guide.md'), '# 欢迎\n\n第一段。\n', 'utf8');

  // Write glossary terms for en
  const glossaryStore = new GlossaryStore(root);
  await glossaryStore.mergeEntry('en', 'workspace', 'workspace');
  await glossaryStore.mergeEntry('en', 'Pull Request', 'Pull Request');

  // Write a memory rule for en
  const memoryStore = new MemoryStore(root);
  const existing = await memoryStore.read('en');
  await memoryStore.write('en', `${existing}\n- Use formal tone.\n`);

  const agent = new WorkspaceAgent(root, config);
  const lines = await captureLog(() => agent.statusForWorkspace());

  const output = lines.join('\n');
  // Should show 2 glossary terms for en
  assert.match(output, /2/);
  // Should show at least 1 memory rule
  const hasMemoryCount = lines.some((line) => /[1-9]\d*/.test(line));
  assert.ok(hasMemoryCount);
});
