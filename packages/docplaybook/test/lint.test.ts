import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMemoryText } from '../src/memories/template.ts';
import { QualityLinter } from '../src/quality/linter.ts';
import type { DocumentSnapshot } from '../src/types.ts';

function createSnapshot(relativePath: string, raw: string): DocumentSnapshot {
  return {
    relativePath,
    hash: `${relativePath}-hash`,
    updatedAt: '2026-03-30T00:00:00.000Z',
    tail: '',
    blocks: [
      {
        index: 0,
        kind: 'paragraph',
        prefix: '',
        raw,
        translatable: true,
        hash: `${relativePath}-block-hash`
      }
    ]
  };
}

test('normalizeMemoryText adds the standard lintable sections', () => {
  const result = normalizeMemoryText('en', '# Memory: en\n');

  assert.deepEqual(result.addedSections, [
    'Terminology',
    'Style Notes'
  ]);
  assert.match(result.text, /## Terminology/);
  assert.match(result.text, /## Style Notes/);
});

test('QualityLinter parses scores, findings, and block fixes from model JSON', async () => {
  const linter = new QualityLinter(
    { model: {} as never, label: 'test-model' },
    async () => ({
      text: JSON.stringify({
        scores: {
          terminology: 91,
          tone: 88,
          completeness: 95,
          markdown: 90,
          fluency: 89,
          overall: 90
        },
        findings: [
          {
            severity: 'warn',
            category: 'terminology',
            message: 'Use "Wiki" instead of "knowledge base".',
            sourceBlockIndex: 1,
            targetBlockIndex: 1,
            suggestion: 'Align the term with the playbook.',
            fix: {
              targetBlockIndex: 1,
              text: 'Use Wiki.'
            }
          }
        ]
      }),
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30
      }
    }) as never
  );

  const result = await linter.lintDocument({
    sourceLanguage: 'zh-CN',
    targetLanguage: 'en',
    docKey: 'docs/guide',
    memoryText: '# Global Playbook\n\n# en Memory',
    sourceSnapshot: createSnapshot('docs/guide.md', '使用知识库。'),
    targetSnapshot: createSnapshot('docs/guide.en.md', 'Use knowledge base.'),
    fix: true
  });

  assert.equal(result.scores.overall, 90);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.category, 'terminology');
  assert.equal(result.findings[0]?.fix?.targetBlockIndex, 1);
  assert.equal(result.findings[0]?.fix?.text, 'Use Wiki.');
  assert.equal(result.usage.totalTokens, 30);
});

test('QualityLinter strips target block wrapper lines from fix text', async () => {
  const linter = new QualityLinter(
    { model: {} as never, label: 'test-model' },
    async () => ({
      text: JSON.stringify({
        scores: {
          terminology: 90,
          tone: 90,
          completeness: 90,
          markdown: 90,
          fluency: 90,
          overall: 90
        },
        findings: [
          {
            severity: 'warn',
            category: 'terminology',
            message: 'Short label should stay concise.',
            targetBlockIndex: 1,
            fix: {
              targetBlockIndex: 1,
              text: '## Target Block 1\nKind: json-string\nTranslatable: yes\n简介'
            }
          }
        ]
      }),
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30
      }
    }) as never
  );

  const result = await linter.lintDocument({
    sourceLanguage: 'en',
    targetLanguage: 'zh-CN',
    docKey: 'docs/_nav.json',
    memoryText: '# Global Playbook\n\n# zh-CN Memory',
    sourceSnapshot: createSnapshot('docs/en/_nav.json', 'Introduction'),
    targetSnapshot: createSnapshot('docs/zh-CN/_nav.json', '介绍'),
    fix: true
  });

  assert.equal(result.findings[0]?.fix?.text, '简介');
});
