import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createLayoutAdapter } from '../src/layouts/index.ts';
import type { AppConfig } from '../src/types.ts';

const config: AppConfig = {
  version: 1,
  provider: {
    kind: 'local'
  },
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
  watch: {
    ignore: []
  }
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

  const docSets = adapter.buildDocSets(files, workspaceRoot, config);

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

  const faq = docSets.find((docSet) => docSet.docKey === 'docs/faq');
  assert.ok(faq);
  assert.equal(faq.targets.en.exists, false);
  assert.equal(faq.targets.ja.exists, false);
});
