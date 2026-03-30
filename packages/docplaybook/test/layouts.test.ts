import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createLayoutAdapter } from '../src/layouts/index.ts';
import { detectWorkspaceLayout } from '../src/init/detect-layout.ts';
import type { AppConfig } from '../src/types.ts';

const baseConfig: AppConfig = {
  version: 1,
  sourceLanguage: 'zh-CN',
  targetLanguages: ['en', 'ja'],
  layout: {
    kind: 'sibling'
  },
  model: {
    kind: 'gateway',
    model: 'openai/gpt-5-mini',
    apiKeyEnv: 'AI_GATEWAY_API_KEY'
  },
  ignorePatterns: []
};

test('sibling layout groups multiple doc sets and ignores localized files as sources', () => {
  const adapter = createLayoutAdapter('sibling');
  const workspaceRoot = '/workspace';
  const files = [
    'docs/guide.md',
    'docs/guide.en.md',
    'docs/guide.ja.md',
    'docs/faq.md',
    'docs/nested/intro.md',
    'docs/nested/intro.en.md'
  ];

  const docSets = adapter.buildDocSets(files, workspaceRoot, baseConfig);

  assert.equal(docSets.length, 3);
  assert.deepEqual(
    docSets.map((docSet) => docSet.docKey),
    ['docs/faq', 'docs/guide', 'docs/nested/intro']
  );

  const guide = docSets.find((docSet) => docSet.docKey === 'docs/guide');
  assert.ok(guide);
  assert.equal(guide.source.relativePath, 'docs/guide.md');
  assert.equal(guide.targets.en.relativePath, 'docs/guide.en.md');
  assert.equal(guide.targets.en.exists, true);
  assert.equal(guide.targets.ja.exists, true);
  assert.equal(guide.targets.en.absolutePath, path.join(workspaceRoot, 'docs/guide.en.md'));
});

test('docusaurus layout maps docs to i18n target files', () => {
  const adapter = createLayoutAdapter('docusaurus');
  const workspaceRoot = '/workspace';
  const files = [
    'docs/guide/intro.md',
    'docs/faq.md',
    'i18n/en/docusaurus-plugin-content-docs/current/guide/intro.md',
    'i18n/ja/docusaurus-plugin-content-docs/current/faq.md'
  ];

  const docSets = adapter.buildDocSets(files, workspaceRoot, {
    ...baseConfig,
    layout: { kind: 'docusaurus' }
  });

  assert.deepEqual(
    docSets.map((docSet) => docSet.docKey),
    ['docs/faq', 'docs/guide/intro']
  );

  const intro = docSets.find((docSet) => docSet.docKey === 'docs/guide/intro');
  assert.ok(intro);
  assert.equal(
    intro.targets.en.relativePath,
    'i18n/en/docusaurus-plugin-content-docs/current/guide/intro.md'
  );
  assert.equal(intro.targets.en.exists, true);
  assert.equal(intro.targets.ja.exists, false);
});

test('rspress layout maps docs to docs/<lang> target files and ignores localized dirs as sources', () => {
  const adapter = createLayoutAdapter('rspress');
  const workspaceRoot = '/workspace';
  const files = [
    'docs/guide/intro.md',
    'docs/index.md',
    'docs/en/guide/intro.md',
    'docs/ja/index.md'
  ];

  const docSets = adapter.buildDocSets(files, workspaceRoot, {
    ...baseConfig,
    layout: { kind: 'rspress' }
  });

  assert.deepEqual(
    docSets.map((docSet) => docSet.docKey),
    ['docs/guide/intro', 'docs/index']
  );

  const intro = docSets.find((docSet) => docSet.docKey === 'docs/guide/intro');
  assert.ok(intro);
  assert.equal(intro.targets.en.relativePath, 'docs/en/guide/intro.md');
  assert.equal(intro.targets.en.exists, true);
  assert.equal(intro.targets.ja.exists, false);
});

test('detectWorkspaceLayout detects docusaurus and rspress projects', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'docplaybook-layout-detect-'));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const docusaurusRoot = path.join(root, 'docusaurus');
  const rspressRoot = path.join(root, 'rspress');
  const plainRoot = path.join(root, 'plain');

  await fs.mkdir(docusaurusRoot, { recursive: true });
  await fs.writeFile(path.join(docusaurusRoot, 'docusaurus.config.ts'), 'export default {};', 'utf8');

  await fs.mkdir(path.join(rspressRoot, 'docs', '.rspress'), { recursive: true });
  await fs.writeFile(path.join(rspressRoot, 'docs', '.rspress', 'config.ts'), 'export default {};', 'utf8');

  await fs.mkdir(plainRoot, { recursive: true });

  const docusaurus = await detectWorkspaceLayout(docusaurusRoot);
  const rspress = await detectWorkspaceLayout(rspressRoot);
  const plain = await detectWorkspaceLayout(plainRoot);

  assert.equal(docusaurus?.kind, 'docusaurus');
  assert.equal(rspress?.kind, 'rspress');
  assert.equal(plain, null);
});
