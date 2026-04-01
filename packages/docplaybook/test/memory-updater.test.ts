import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryUpdater } from '../src/translation/memory-updater.ts';

test('MemoryUpdater.mergeRules appends only new memory rules and preserves existing sections', async () => {
  const updater = new MemoryUpdater({ model: {} } as never);
  const current = [
    '# Memory: ja',
    '',
    'This file stores reusable translation guidance specific to ja.',
    '',
    '## Terminology',
    '',
    '- Translate "provider" as プロバイダー.',
    '',
    '## Style Notes',
    '',
    '- Keep Japanese concise.'
  ].join('\n');

  const result = await updater.mergeRules({
    scope: 'memory',
    sourceLanguage: 'en',
    targetLanguage: 'ja',
    memoryText: current,
    rules: [
      'Translate "provider" as プロバイダー.',
      'Translate "memory" as メモリ.',
      'Prefer neutral technical Japanese.'
    ]
  });

  assert.equal(result.usage.totalTokens, 0);
  assert.match(result.text, /- Translate "provider" as プロバイダー\./);
  assert.equal(result.text.match(/Translate "provider" as プロバイダー\./g)?.length, 1);
  assert.match(result.text, /- Translate "memory" as メモリ\./);
  assert.match(result.text, /- Prefer neutral technical Japanese\./);
  assert.match(result.text, /## Terminology/);
  assert.match(result.text, /## Style Notes/);
});

test('MemoryUpdater.mergeRules routes playbook rules to stable sections without replacing the whole file', async () => {
  const updater = new MemoryUpdater({ model: {} } as never);
  const current = [
    '# Playbook',
    '',
    'This file stores reusable translation guidance that applies across every target language.',
    '',
    '## Voice',
    '',
    '- Maintain a technical voice.',
    '',
    '## Protected Terms',
    '',
    '- Keep CLI commands verbatim.',
    '',
    '## Translation Rules',
    '',
    '- Preserve Markdown structure.'
  ].join('\n');

  const result = await updater.mergeRules({
    scope: 'playbook',
    sourceLanguage: 'en',
    targetLanguage: 'ja',
    memoryText: current,
    rules: [
      'Prefer neutral technical phrasing over promotional language.',
      'Keep file paths verbatim and render them as inline code.',
      'Do not alter frontmatter keys.'
    ]
  });

  assert.match(result.text, /- Maintain a technical voice\./);
  assert.match(result.text, /- Prefer neutral technical phrasing over promotional language\./);
  assert.match(result.text, /- Keep file paths verbatim and render them as inline code\./);
  assert.match(result.text, /- Do not alter frontmatter keys\./);
});
