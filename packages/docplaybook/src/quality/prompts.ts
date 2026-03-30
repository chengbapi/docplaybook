import type { DocumentSnapshot } from '../types.js';

export function buildLintPrompt(input: {
  sourceLanguage: string;
  targetLanguage: string;
  docKey: string;
  memoryText: string;
  sourceSnapshot: DocumentSnapshot;
  targetSnapshot: DocumentSnapshot;
  fix: boolean;
}): string {
  const sourceBlocks = input.sourceSnapshot.blocks
    .map((block) =>
      [
        `## Source Block ${block.index + 1}`,
        `Kind: ${block.kind}`,
        `Translatable: ${block.translatable ? 'yes' : 'no'}`,
        block.raw.trim()
      ].join('\n')
    )
    .join('\n\n');

  const targetBlocks = input.targetSnapshot.blocks
    .map((block) =>
      [
        `## Target Block ${block.index + 1}`,
        `Kind: ${block.kind}`,
        `Translatable: ${block.translatable ? 'yes' : 'no'}`,
        block.raw.trim()
      ].join('\n')
    )
    .join('\n\n');

  return [
    `You lint a translated Markdown document from ${input.sourceLanguage} to ${input.targetLanguage}.`,
    'Use the translation playbook as the quality standard.',
    'Score the translation on these dimensions from 0 to 100:',
    '- terminology',
    '- tone',
    '- completeness',
    '- markdown',
    '- fluency',
    '- overall',
    'Find concrete issues, like a Markdown linter or review tool.',
    'Be specific and actionable. Only report real issues.',
    input.fix
      ? 'When a finding can be safely fixed by replacing exactly one translated block, include a fix with the target block index and the full replacement Markdown block.'
      : 'Do not include speculative fixes unless you are confident.',
    'If the playbook is missing standard sections or is too weak to enforce consistency, add memory findings.',
    'Return strict JSON only with this shape:',
    '{"scores":{"terminology":0,"tone":0,"completeness":0,"markdown":0,"fluency":0,"overall":0},"findings":[{"severity":"warn","category":"terminology","message":"...","sourceBlockIndex":1,"targetBlockIndex":1,"suggestion":"...","fix":{"targetBlockIndex":1,"text":"..."}}]}',
    '',
    `Document key: ${input.docKey}`,
    '',
    'Translation playbook:',
    '```md',
    input.memoryText.trim(),
    '```',
    '',
    'Source document blocks:',
    '```md',
    sourceBlocks,
    '```',
    '',
    'Target document blocks:',
    '```md',
    targetBlocks,
    '```'
  ].join('\n');
}
