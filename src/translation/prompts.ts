import type { DocumentSnapshot, ManualCorrection, TranslationContext } from '../types.js';

export function buildTranslationSystemPrompt(context: TranslationContext): string {
  return [
    `You are a documentation translation agent.`,
    `Translate from ${context.sourceLanguage} to ${context.targetLanguage}.`,
    'Preserve Markdown structure, links, emphasis, and inline code.',
    'Do not add explanations, notes, or commentary.',
    'Do not wrap the result in triple backticks or fenced code blocks.',
    'Keep tone consistent with technical documentation.',
    'If the source block should remain unchanged, return it unchanged.',
    '',
    'Project translation playbook:',
    context.memoryText.trim() || '(empty)'
  ].join('\n');
}

export function buildTranslationPrompt(context: TranslationContext): string {
  return [
    `Document key: ${context.docKey}`,
    '',
    'Source block:',
    '```md',
    context.sourceBlock.trim(),
    '```',
    '',
    'Existing translation (if any):',
    '```md',
    context.existingTranslation?.trim() || '',
    '```',
    '',
    'Return only the translated Markdown block.',
    'Do not add ```md, ```markdown, or any other fenced code wrapper.'
  ].join('\n');
}

export function buildBatchTranslationPrompt(input: {
  docKey: string;
  blocks: Array<{
    id: string;
    index: number;
    sourceBlock: string;
    existingTranslation?: string;
  }>;
}): string {
  return [
    `Document key: ${input.docKey}`,
    '',
    'Translate each block independently.',
    'Return every translated block with its original block id.',
    'Preserve the exact ids you were given.',
    'Do not add numbering, explanations, or fenced code blocks.',
    'Return strict JSON only with this shape:',
    '{"blocks":[{"id":"...", "text":"..."}]}',
    '',
    ...input.blocks.flatMap((block, idx) => [
      `Block ${idx + 1} (id ${block.id}, source index ${block.index}):`,
      'Source block:',
      '```md',
      block.sourceBlock.trim(),
      '```',
      '',
      'Existing translation (if any):',
      '```md',
      block.existingTranslation?.trim() || '',
      '```',
      '',
      idx < input.blocks.length - 1 ? '---' : ''
    ]).filter(Boolean),
  ].join('\n');
}

export function buildMemoryUpdatePrompt(input: {
  sourceLanguage: string;
  targetLanguage: string;
  memoryText: string;
  corrections: ManualCorrection[];
}): string {
  const serializedCorrections = input.corrections
    .map((correction) =>
      [
        `## Correction ${correction.index}`,
        '',
        'Source block:',
        '```md',
        correction.sourceBlock.trim(),
        '```',
        '',
        'Previous translation:',
        '```md',
        correction.previousTranslation.trim(),
        '```',
        '',
        'Human-corrected translation:',
        '```md',
        correction.correctedTranslation.trim(),
        '```'
      ].join('\n')
    )
    .join('\n\n');

  return [
    `You maintain a reusable translation playbook for ${input.sourceLanguage} -> ${input.targetLanguage}.`,
    'Update the playbook using the corrections below.',
    'Keep the file concise, deduplicated, and written for future LLM prompts.',
    'Only keep reusable translation guidance. Ignore one-off content edits.',
    'If a new rule conflicts with an older rule, keep the new rule and remove or rewrite the old one.',
    'Do not add ```md, ```markdown, or any other fenced code wrapper.',
    'Return the full updated Markdown file and nothing else.',
    '',
    'Current playbook:',
    '```md',
    input.memoryText.trim(),
    '```',
    '',
    'New human corrections:',
    serializedCorrections
  ].join('\n');
}

export function buildRewriteJudgePrompt(input: {
  sourceLanguage: string;
  targetLanguage: string;
  generatedTargetSnapshot: DocumentSnapshot;
  currentTargetSnapshot: DocumentSnapshot;
}): string {
  const generatedBlocks = input.generatedTargetSnapshot.blocks
    .filter((block) => block.translatable)
    .map((block, index) => [`## Block ${index + 1}`, '', block.raw.trim()].join('\n'))
    .join('\n\n');
  const currentBlocks = input.currentTargetSnapshot.blocks
    .filter((block) => block.translatable)
    .map((block, index) => [`## Block ${index + 1}`, '', block.raw.trim()].join('\n'))
    .join('\n\n');

  return [
    `You evaluate whether edits to a translated ${input.sourceLanguage} -> ${input.targetLanguage} document are a major rewrite.`,
    'A major rewrite means the human substantially rewrote the translated document, so the edits should not be learned as reusable translation memory.',
    'A non-major rewrite means the human mostly made localized corrections, terminology fixes, or style adjustments that are safe to learn.',
    'Be conservative: if the edits look like targeted correction rather than a full rewrite, return false.',
    'Return strict JSON only with this shape:',
    '{"isMajorRewrite": boolean, "reason": string}',
    '',
    'Previously generated translation:',
    '```md',
    generatedBlocks,
    '```',
    '',
    'Current human-edited translation:',
    '```md',
    currentBlocks,
    '```'
  ].join('\n');
}
