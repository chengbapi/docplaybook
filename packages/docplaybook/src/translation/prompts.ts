import type {
  BootstrapExample,
  LearnCandidate,
  ManualCorrection,
  TranslationContext
} from '../types.js';

export function buildTranslationSystemPrompt(context: TranslationContext): string {
  const lines = [
    `You are a documentation translation agent.`,
    `Translate from ${context.sourceLanguage} to ${context.targetLanguage}.`,
    'Preserve Markdown structure, links, emphasis, and inline code.',
    'Do not add explanations, notes, or commentary.',
    'Do not wrap the result in triple backticks or fenced code blocks.',
    'Keep tone consistent with technical documentation.',
    'If the source block should remain unchanged, return it unchanged.',
    '',
    'Project translation guidance:',
    context.memoryText.trim() || '(empty)'
  ];

  if (context.glossaryText?.trim()) {
    lines.push('');
    lines.push('Glossary (use these exact term translations):');
    lines.push(context.glossaryText.trim());
  }

  return lines.join('\n');
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
  scope: 'playbook' | 'memory';
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
    input.scope === 'playbook'
      ? `You maintain a global translation playbook for ${input.sourceLanguage} source documents across all target languages.`
      : `You maintain a reusable language memory for ${input.targetLanguage} translations from ${input.sourceLanguage}.`,
    input.scope === 'playbook'
      ? 'Update the playbook using the corrections below.'
      : 'Update the language memory using the corrections below.',
    'Keep the file concise, deduplicated, and written for future LLM prompts.',
    input.scope === 'playbook'
      ? 'Keep only language-agnostic reusable guidance. Do not store language-specific terminology lists here.'
      : 'Keep only target-language-specific reusable guidance, such as terminology and style notes.',
    'Ignore one-off content edits.',
    'If a new rule conflicts with an older rule, keep the new rule and remove or rewrite the old one.',
    'Do not add ```md, ```markdown, or any other fenced code wrapper.',
    'Return the full updated Markdown file and nothing else.',
    '',
    input.scope === 'playbook' ? 'Current playbook:' : 'Current language memory:',
    '```md',
    input.memoryText.trim(),
    '```',
    '',
    'New human corrections:',
    serializedCorrections
  ].join('\n');
}

export function buildLearnJudgePrompt(input: {
  sourceLanguage: string;
  targetLanguage: string;
  currentPlaybook: string;
  currentMemory: string;
  candidates: LearnCandidate[];
}): string {
  const serializedCandidates = input.candidates.map((candidate) =>
    [
      `## Candidate: ${candidate.docKey}`,
      `Document key: ${candidate.docKey}`,
      `Source path: ${candidate.sourcePath}`,
      `Target path: ${candidate.targetPath}`,
      '',
      'Current source document:',
      '```md',
      candidate.sourceDocument.trim(),
      '```',
      '',
      'Current target document:',
      '```md',
      candidate.targetDocument.trim(),
      '```'
    ].join('\n')
  ).join('\n\n');

  return [
    `You review translated documentation from ${input.sourceLanguage} to ${input.targetLanguage}.`,
    'Extract reusable translation guidance from the current source and target documents.',
    '',
    'Scope rules:',
    '- "glossary": A deterministic term mapping — the same source phrase always maps to the same target phrase.',
    '  Format proposedRule as: "source term" → "target term"',
    '  Example: "Pull Request" → "Pull Request"  or  "API" → "API"',
    '- "memory": Contextual or stylistic guidance that needs LLM judgment to apply.',
    '  Format proposedRule as a concise rule sentence starting with "-".',
    '  Example: - Use 「应当」instead of 「应该」in technical documentation.',
    '- "playbook": Cross-language guidance applicable to all target languages. Same format as memory.',
    '- "ignore": Page-specific content, one-off phrasing, or observations too vague to be reusable.',
    '',
    'Return strict JSON only with this shape:',
    '{"items":[{"docKey":"...","blockIndex":1,"shouldLearn":true,"scope":"memory","category":"terminology","reason":"...","proposedRule":"..."}]}',
    '',
    'Current playbook:',
    '```md',
    input.currentPlaybook.trim(),
    '```',
    '',
    `Current ${input.targetLanguage} memory:`,
    '```md',
    input.currentMemory.trim(),
    '```',
    '',
    'Document review candidates:',
    serializedCandidates
  ].join('\n');
}

export function buildRuleMergePrompt(input: {
  scope: 'playbook' | 'memory';
  sourceLanguage: string;
  targetLanguage: string;
  memoryText: string;
  rules: string[];
}): string {
  return [
    input.scope === 'playbook'
      ? `You maintain a global translation playbook for ${input.sourceLanguage} source documents across all target languages.`
      : `You maintain a reusable language memory for ${input.targetLanguage} translations from ${input.sourceLanguage}.`,
    'Merge the reusable rules below into the current Markdown file.',
    'Keep the file concise, deduplicated, and written for future LLM prompts.',
    input.scope === 'playbook'
      ? 'Keep only language-agnostic reusable guidance.'
      : 'Keep only target-language-specific reusable guidance.',
    'If a new rule conflicts with an older rule, keep the new rule and rewrite or remove the old one.',
    'Do not add fenced code blocks. Return the full updated Markdown file only.',
    '',
    'Current file:',
    '```md',
    input.memoryText.trim(),
    '```',
    '',
    'New reusable rules:',
    ...input.rules.map((rule, index) => `${index + 1}. ${rule}`)
  ].join('\n');
}

export function buildBootstrapMemoryPrompt(input: {
  scope: 'playbook' | 'memory';
  sourceLanguage: string;
  targetLanguage: string;
  memoryText: string;
  examples: BootstrapExample[];
}): string {
  const serializedExamples = input.examples.map((example) =>
    [
      `## Document: ${example.docKey}`,
      `Source path: ${example.sourcePath}`,
      `Target path: ${example.targetPath}`,
      '',
      ...example.pairs.flatMap((pair) => [
        `### Pair ${pair.blockIndex}`,
        'Source:',
        '```md',
        pair.sourceBlock.trim(),
        '```',
        '',
        'Target:',
        '```md',
        pair.targetBlock.trim(),
        '```',
        ''
      ])
    ].join('\n')
  ).join('\n\n');

  return [
    input.scope === 'playbook'
      ? `You are creating a global translation playbook for ${input.sourceLanguage} source documents across all target languages.`
      : `You are creating a reusable ${input.targetLanguage} translation memory from ${input.sourceLanguage} source documents.`,
    'Infer concise, reusable guidance from the aligned examples below.',
    input.scope === 'playbook'
      ? 'Focus on cross-language voice, protected terms, and translation rules.'
      : 'Focus on target-language terminology and style preferences.',
    'Ignore page-specific content details. Keep only reusable rules.',
    'Return the full Markdown file only, without fenced code blocks.',
    '',
    'Current file:',
    '```md',
    input.memoryText.trim(),
    '```',
    '',
    'Aligned source/target examples:',
    serializedExamples
  ].join('\n');
}
