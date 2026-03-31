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
    'docs/nested/intro.en.md',
    'docs/reference/api.mdx',
    'docs/reference/api.en.mdx'
  ];

  const docSets = adapter.buildDocSets(files, workspaceRoot, baseConfig);

  assert.equal(docSets.length, 4);
  assert.deepEqual(
    docSets.map((docSet) => docSet.docKey),
    ['docs/faq', 'docs/guide', 'docs/nested/intro', 'docs/reference/api']
  );

  const guide = docSets.find((docSet) => docSet.docKey === 'docs/guide');
  assert.ok(guide);
  assert.equal(guide.source.relativePath, 'docs/guide.md');
  assert.equal(guide.targets.en.relativePath, 'docs/guide.en.md');
  assert.equal(guide.targets.en.exists, true);
  assert.equal(guide.targets.ja.exists, true);
  assert.equal(guide.targets.en.absolutePath, path.join(workspaceRoot, 'docs/guide.en.md'));

  const api = docSets.find((docSet) => docSet.docKey === 'docs/reference/api');
  assert.ok(api);
  assert.equal(api.source.relativePath, 'docs/reference/api.mdx');
  assert.equal(api.targets.en.relativePath, 'docs/reference/api.en.mdx');
  assert.equal(api.targets.en.exists, true);
  assert.equal(api.targets.ja.relativePath, 'docs/reference/api.ja.mdx');
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

test('vitepress and rspress layouts preserve .mdx paths', () => {
  const files = [
    'docs/guide/intro.mdx',
    'docs/en/guide/intro.mdx'
  ];

  const rspressDocSets = createLayoutAdapter('rspress').buildDocSets(files, '/workspace', {
    ...baseConfig,
    layout: { kind: 'rspress' }
  });
  const vitepressDocSets = createLayoutAdapter('vitepress').buildDocSets(files, '/workspace', {
    ...baseConfig,
    layout: { kind: 'vitepress' }
  });

  assert.equal(rspressDocSets[0]?.source.relativePath, 'docs/guide/intro.mdx');
  assert.equal(rspressDocSets[0]?.targets.en.relativePath, 'docs/en/guide/intro.mdx');
  assert.equal(vitepressDocSets[0]?.source.relativePath, 'docs/guide/intro.mdx');
  assert.equal(vitepressDocSets[0]?.targets.en.relativePath, 'docs/en/guide/intro.mdx');
});

test('vitepress layout maps docs to docs/<lang> target files and ignores localized dirs as sources', () => {
  const adapter = createLayoutAdapter('vitepress');
  const workspaceRoot = '/workspace';
  const files = [
    'docs/guide/intro.md',
    'docs/index.md',
    'docs/en/guide/intro.md',
    'docs/ja/index.md'
  ];

  const docSets = adapter.buildDocSets(files, workspaceRoot, {
    ...baseConfig,
    layout: { kind: 'vitepress' }
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

test('detectWorkspaceLayout detects docusaurus, rspress, and vitepress projects', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'docplaybook-layout-detect-'));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const docusaurusRoot = path.join(root, 'docusaurus');
  const rspressRoot = path.join(root, 'rspress');
  const vitepressRoot = path.join(root, 'vitepress');
  const plainRoot = path.join(root, 'plain');

  await fs.mkdir(docusaurusRoot, { recursive: true });
  await fs.writeFile(path.join(docusaurusRoot, 'docusaurus.config.ts'), 'export default {};', 'utf8');

  await fs.mkdir(path.join(rspressRoot, 'docs', '.rspress'), { recursive: true });
  await fs.writeFile(path.join(rspressRoot, 'docs', '.rspress', 'config.ts'), 'export default {};', 'utf8');

  await fs.mkdir(path.join(vitepressRoot, 'docs', '.vitepress'), { recursive: true });
  await fs.writeFile(path.join(vitepressRoot, 'docs', '.vitepress', 'config.ts'), 'export default {};', 'utf8');

  await fs.mkdir(plainRoot, { recursive: true });

  const docusaurus = await detectWorkspaceLayout(docusaurusRoot);
  const rspress = await detectWorkspaceLayout(rspressRoot);
  const vitepress = await detectWorkspaceLayout(vitepressRoot);
  const plain = await detectWorkspaceLayout(plainRoot);

  assert.equal(docusaurus?.kind, 'docusaurus');
  assert.equal(rspress?.kind, 'rspress');
  assert.equal(vitepress?.kind, 'vitepress');
  assert.equal(plain, null);
});
