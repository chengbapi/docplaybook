const STANDARD_SECTIONS = [
  'Terminology',
  'Tone & Style',
  'Formatting & Markdown',
  'Protected Terms',
  'Review Notes'
] as const;

export function renderInitialMemory(sourceLanguage: string, targetLanguage: string): string {
  return [
    `# Translation Playbook: ${sourceLanguage} -> ${targetLanguage}`,
    '',
    'This file is injected into every translation prompt for this language pair.',
    '',
    '## Terminology',
    '',
    '- Add approved translations for product terms and recurring vocabulary.',
    '',
    '## Tone & Style',
    '',
    '- Describe the preferred tone, sentence style, and level of formality.',
    '',
    '## Formatting & Markdown',
    '',
    '- Record Markdown-specific rules, capitalization patterns, and formatting constraints.',
    '',
    '## Protected Terms',
    '',
    '- List names, commands, API fields, and branded terms that should stay unchanged.',
    '',
    '## Review Notes',
    '',
    '- Add concise reusable review lessons. Remove stale rules when newer ones replace them.',
    ''
  ].join('\n');
}

export function normalizeMemoryText(
  sourceLanguage: string,
  targetLanguage: string,
  content: string
): { text: string; addedSections: string[] } {
  const normalized = content.trimEnd();
  const lines = normalized.length > 0 ? normalized.split('\n') : [];
  const expectedTitle = `# Translation Playbook: ${sourceLanguage} -> ${targetLanguage}`;
  const nextLines = [...lines];

  if (nextLines.length === 0) {
    return {
      text: renderInitialMemory(sourceLanguage, targetLanguage).trimEnd(),
      addedSections: [...STANDARD_SECTIONS]
    };
  }

  if (!nextLines[0]?.startsWith('# ')) {
    nextLines.unshift('', expectedTitle);
  } else {
    nextLines[0] = expectedTitle;
  }

  const addedSections: string[] = [];
  for (const section of STANDARD_SECTIONS) {
    const heading = `## ${section}`;
    if (nextLines.some((line) => line.trim() === heading)) {
      continue;
    }

    addedSections.push(section);
    nextLines.push('', heading, '', '-');
  }

  return {
    text: nextLines.join('\n').trimEnd(),
    addedSections
  };
}
