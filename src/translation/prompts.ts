import type { ManualCorrection, TranslationContext } from '../types.js';

export function buildTranslationSystemPrompt(context: TranslationContext): string {
  return [
    `You are a documentation translation agent.`,
    `Translate from ${context.sourceLanguage} to ${context.targetLanguage}.`,
    'Preserve Markdown structure, links, emphasis, and inline code.',
    'Do not add explanations, notes, or commentary.',
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
    'Return only the translated Markdown block.'
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
