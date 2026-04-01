import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDocumentSnapshot,
  getChangedBlockIndexes,
  parseMarkdownSnapshot,
  renderSnapshot
} from '../src/markdown/blocks.ts';

test('parseMarkdownSnapshot preserves frontmatter and code blocks as non-translatable', () => {
  const raw = [
    '---',
    'title: 示例文档',
    'slug: /guide/intro',
    '---',
    '',
    '# 标题',
    '',
    '这是一段正文。',
    '',
    '```ts',
    "console.log('do not translate');",
    '```',
    ''
  ].join('\n');

  const snapshot = parseMarkdownSnapshot('docs/guide.md', raw);

  assert.equal(snapshot.blocks[0]?.kind, 'frontmatter');
  assert.equal(snapshot.blocks[0]?.translatable, false);
  assert.equal(snapshot.blocks[1]?.kind, 'heading');
  assert.equal(snapshot.blocks[1]?.translatable, true);
  assert.equal(snapshot.blocks[2]?.kind, 'paragraph');
  assert.equal(snapshot.blocks[2]?.translatable, true);
  assert.equal(snapshot.blocks[3]?.kind, 'code');
  assert.equal(snapshot.blocks[3]?.translatable, false);

  const rendered = renderSnapshot(
    snapshot,
    snapshot.blocks.map((block) => block.raw)
  );

  assert.equal(rendered, raw);
});

test('parseDocumentSnapshot makes rspress homepage frontmatter translatable', () => {
  const raw = [
    '---',
    'pageType: home',
    '',
    'hero:',
    '  name: DocPlaybook',
    '  text: Translation Ops for MD / MDX',
    '  tagline: Git-first translation for multilingual docs.',
    '  actions:',
    '    - theme: brand',
    '      text: Introduction',
    '      link: /guide/introduction',
    'slug: /home',
    '---',
    '',
    '# Home',
    ''
  ].join('\n');

  const snapshot = parseDocumentSnapshot('docs/en/index.md', raw, { layoutKind: 'rspress' });

  assert.equal(snapshot.blocks[0]?.kind, 'frontmatter-value');
  assert.equal(snapshot.blocks[0]?.translatable, true);
  assert.deepEqual(
    snapshot.blocks.slice(0, 4).map((block) => block.raw.trim()),
    [
      'DocPlaybook',
      'Translation Ops for MD / MDX',
      'Git-first translation for multilingual docs.',
      'Introduction'
    ]
  );
  assert.equal(snapshot.blocks.some((block) => block.raw.includes('/home')), false);
});

test('parseDocumentSnapshot extracts translatable rspress nav and meta strings', () => {
  const navSnapshot = parseDocumentSnapshot(
    'docs/en/_nav.json',
    JSON.stringify([{ text: 'Guide', link: '/guide/introduction' }], null, 2)
  );
  const metaSnapshot = parseDocumentSnapshot(
    'docs/en/guide/_meta.json',
    JSON.stringify([{ type: 'file', name: 'intro', label: 'Introduction' }], null, 2)
  );

  assert.deepEqual(navSnapshot.blocks.map((block) => block.raw), ['Guide']);
  assert.deepEqual(metaSnapshot.blocks.map((block) => block.raw), ['Introduction']);
  assert.equal(renderSnapshot(navSnapshot, ['指南']).trim(), '[\n  {\n    "text": "指南",\n    "link": "/guide/introduction"\n  }\n]');
});

test('parseDocumentSnapshot extracts locale-specific strings from rspress i18n.json', () => {
  const raw = JSON.stringify({
    gettingStarted: {
      en: 'Getting Started',
      ja: 'はじめに',
      'zh-CN': '开始使用'
    },
    guide: {
      en: 'Guide',
      ja: 'ガイド',
      'zh-CN': '指南'
    }
  }, null, 2);

  const sourceSnapshot = parseDocumentSnapshot('i18n.json', raw, { layoutKind: 'rspress', language: 'en' });
  const targetSnapshot = parseDocumentSnapshot('i18n.json', raw, { layoutKind: 'rspress', language: 'ja' });

  assert.deepEqual(sourceSnapshot.blocks.map((block) => block.raw), ['Getting Started', 'Guide']);
  assert.deepEqual(targetSnapshot.blocks.map((block) => block.raw), ['はじめに', 'ガイド']);
  assert.equal(
    renderSnapshot(targetSnapshot, ['導入', 'ガイド']).trim(),
    '{\n  "gettingStarted": {\n    "en": "Getting Started",\n    "ja": "導入",\n    "zh-CN": "开始使用"\n  },\n  "guide": {\n    "en": "Guide",\n    "ja": "ガイド",\n    "zh-CN": "指南"\n  }\n}'
  );
});

test('getChangedBlockIndexes only returns changed translatable blocks', () => {
  const previous = parseMarkdownSnapshot(
    'docs/guide.md',
    ['# 标题', '', '第一段。', '', '```ts', 'const a = 1;', '```', ''].join('\n')
  );

  const next = parseMarkdownSnapshot(
    'docs/guide.md',
    ['# 标题', '', '第二段。', '', '```ts', 'const a = 2;', '```', ''].join('\n')
  );

  assert.deepEqual(getChangedBlockIndexes(previous, next), [1]);
});

test('parseMarkdownSnapshot keeps MDX JSX and ESM blocks non-translatable', () => {
  const raw = [
    "import { Callout } from './callout';",
    '',
    '# Title',
    '',
    '<Callout type="warning">',
    'Do not translate the prop names.',
    '</Callout>',
    '',
    'Translate this paragraph.',
    '',
    '{1 + 1}',
    ''
  ].join('\n');

  const snapshot = parseMarkdownSnapshot('docs/guide.mdx', raw);

  assert.equal(snapshot.blocks[0]?.kind, 'mdxjsEsm');
  assert.equal(snapshot.blocks[0]?.translatable, false);
  assert.equal(snapshot.blocks[1]?.kind, 'heading');
  assert.equal(snapshot.blocks[1]?.translatable, true);
  assert.equal(snapshot.blocks[2]?.kind, 'mdxJsxFlowElement');
  assert.equal(snapshot.blocks[2]?.translatable, false);
  assert.equal(snapshot.blocks[3]?.kind, 'paragraph');
  assert.equal(snapshot.blocks[3]?.translatable, true);
  assert.equal(snapshot.blocks[4]?.kind, 'mdxFlowExpression');
  assert.equal(snapshot.blocks[4]?.translatable, false);

  const rendered = renderSnapshot(
    snapshot,
    snapshot.blocks.map((block) => block.raw)
  );

  assert.equal(rendered, raw);
});
