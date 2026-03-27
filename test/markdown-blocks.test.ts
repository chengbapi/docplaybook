import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
