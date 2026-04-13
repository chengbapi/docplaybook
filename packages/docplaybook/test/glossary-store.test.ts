import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { GlossaryStore } from '../src/memories/glossary-store.ts';
import { buildTranslationSystemPrompt } from '../src/translation/prompts.ts';
import { initWorkspaceConfig } from '../src/config.ts';

async function createTempWorkspace(name: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `docplaybook-${name}-`));
}

test('GlossaryStore.load returns empty object when glossary file does not exist', async (t) => {
  const root = await createTempWorkspace('glossary-load-missing');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const store = new GlossaryStore(root);
  const result = await store.load('zh');
  assert.deepEqual(result, {});
});

test('GlossaryStore.mergeEntry writes and loads entries back sorted', async (t) => {
  const root = await createTempWorkspace('glossary-merge');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await initWorkspaceConfig({
    workspaceRoot: root,
    sourceLanguage: 'en',
    targetLanguages: ['zh'],
    layoutKind: 'sibling',
    model: { kind: 'gateway', model: 'openai/gpt-4o', apiKeyEnv: 'AI_GATEWAY_API_KEY' },
    force: true
  });

  const store = new GlossaryStore(root);
  await store.mergeEntry('zh', 'workspace', '工作区');
  await store.mergeEntry('zh', 'API', 'API');
  await store.mergeEntry('zh', 'Pull Request', '拉取请求');

  const loaded = await store.load('zh');
  assert.equal(loaded['workspace'], '工作区');
  assert.equal(loaded['API'], 'API');
  assert.equal(loaded['Pull Request'], '拉取请求');

  // Keys should be sorted alphabetically
  const keys = Object.keys(loaded);
  assert.deepEqual(keys, [...keys].sort());
});

test('GlossaryStore.countTerms returns the number of glossary entries', async (t) => {
  const root = await createTempWorkspace('glossary-count');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await initWorkspaceConfig({
    workspaceRoot: root,
    sourceLanguage: 'en',
    targetLanguages: ['ja'],
    layoutKind: 'sibling',
    model: { kind: 'gateway', model: 'openai/gpt-4o', apiKeyEnv: 'AI_GATEWAY_API_KEY' },
    force: true
  });

  const store = new GlossaryStore(root);
  assert.equal(await store.countTerms('ja'), 0);

  await store.mergeEntry('ja', 'workspace', 'ワークスペース');
  await store.mergeEntry('ja', 'Pull Request', 'プルリクエスト');
  assert.equal(await store.countTerms('ja'), 2);
});

test('GlossaryStore.patch replaces prose terms and leaves fenced code blocks unchanged', async (t) => {
  const root = await createTempWorkspace('glossary-patch-code');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await initWorkspaceConfig({
    workspaceRoot: root,
    sourceLanguage: 'en',
    targetLanguages: ['zh'],
    layoutKind: 'sibling',
    model: { kind: 'gateway', model: 'openai/gpt-4o', apiKeyEnv: 'AI_GATEWAY_API_KEY' },
    force: true
  });

  const store = new GlossaryStore(root);
  await store.mergeEntry('zh', 'workspace', '工作区');

  const input = [
    'Open the workspace settings.',
    '',
    '```bash',
    'cd workspace',
    '```',
    '',
    'The workspace is ready.',
  ].join('\n');

  const { text, patches } = await store.patch(input, 'zh');

  assert.match(text, /Open the 工作区 settings\./);
  assert.match(text, /The 工作区 is ready\./);
  // Code block content must be unchanged
  assert.match(text, /cd workspace/);
  assert.equal(patches, 2);
});

test('GlossaryStore.patch leaves inline code spans unchanged', async (t) => {
  const root = await createTempWorkspace('glossary-patch-inline');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await initWorkspaceConfig({
    workspaceRoot: root,
    sourceLanguage: 'en',
    targetLanguages: ['zh'],
    layoutKind: 'sibling',
    model: { kind: 'gateway', model: 'openai/gpt-4o', apiKeyEnv: 'AI_GATEWAY_API_KEY' },
    force: true
  });

  const store = new GlossaryStore(root);
  await store.mergeEntry('zh', 'workspace', '工作区');

  const input = 'Use the `workspace` command or open the workspace in your editor.';
  const { text, patches } = await store.patch(input, 'zh');

  // Inline code must not be replaced
  assert.match(text, /`workspace`/);
  // Prose occurrence must be replaced
  assert.match(text, /open the 工作区 in your editor/);
  assert.equal(patches, 1);
});

test('buildTranslationSystemPrompt includes glossary section when glossaryText is set', () => {
  const prompt = buildTranslationSystemPrompt({
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    memoryText: '- Use formal tone.',
    glossaryText: '- "workspace" → "工作区"\n- "Pull Request" → "拉取请求"',
    sourceBlock: '',
    docKey: 'guide'
  });

  assert.match(prompt, /Glossary \(use these exact term translations\):/);
  assert.match(prompt, /"workspace" → "工作区"/);
  assert.match(prompt, /"Pull Request" → "拉取请求"/);
});

test('buildTranslationSystemPrompt omits glossary section when glossaryText is absent', () => {
  const prompt = buildTranslationSystemPrompt({
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    memoryText: '- Use formal tone.',
    sourceBlock: '',
    docKey: 'guide'
  });

  assert.doesNotMatch(prompt, /Glossary/);
});

test('buildTranslationSystemPrompt omits glossary section when glossaryText is empty string', () => {
  const prompt = buildTranslationSystemPrompt({
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    memoryText: '- Use formal tone.',
    glossaryText: '',
    sourceBlock: '',
    docKey: 'guide'
  });

  assert.doesNotMatch(prompt, /Glossary/);
});
