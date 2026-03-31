const PLAYBOOK_SECTIONS = ['Voice', 'Protected Terms', 'Translation Rules'] as const;
const MEMORY_SECTIONS = ['Terminology', 'Style Notes'] as const;

export function renderInitialPlaybook(): string {
  return [
    '# Playbook',
    '',
    'This file stores reusable translation guidance that applies across every target language.',
    '',
    '## Voice',
    '',
    '- Describe the overall documentation voice, such as technical, direct, calm, or concise.',
    '',
    '## Protected Terms',
    '',
    '- List names, commands, API fields, paths, and branded terms that should stay unchanged.',
    '',
    '## Translation Rules',
    '',
    '- Record concise language-agnostic rules, such as preserving structure, warnings, and code.',
    ''
  ].join('\n');
}

export function renderInitialMemory(targetLanguage: string): string {
  return [
    `# Memory: ${targetLanguage}`,
    '',
    `This file stores reusable translation guidance specific to ${targetLanguage}.`,
    '',
    '## Terminology',
    '',
    '- Add approved translations for recurring product terms and technical vocabulary.',
    '',
    '## Style Notes',
    '',
    '- Describe language-specific preferences, such as formality, sentence style, or punctuation.',
    ''
  ].join('\n');
}

export function normalizePlaybookText(content: string): { text: string; addedSections: string[] } {
  const normalized = content.trimEnd();
  const lines = normalized.length > 0 ? normalized.split('\n') : [];
  const expectedTitle = '# Playbook';
  const nextLines = [...lines];

  if (nextLines.length === 0) {
    return {
      text: renderInitialPlaybook().trimEnd(),
      addedSections: [...PLAYBOOK_SECTIONS]
    };
  }

  if (!nextLines[0]?.startsWith('# ')) {
    nextLines.unshift('', expectedTitle);
  } else {
    nextLines[0] = expectedTitle;
  }

  const addedSections: string[] = [];
  for (const section of PLAYBOOK_SECTIONS) {
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

export function normalizeMemoryText(
  targetLanguage: string,
  content: string
): { text: string; addedSections: string[] } {
  const normalized = content.trimEnd();
  const lines = normalized.length > 0 ? normalized.split('\n') : [];
  const expectedTitle = `# Memory: ${targetLanguage}`;
  const nextLines = [...lines];

  if (nextLines.length === 0) {
    return {
      text: renderInitialMemory(targetLanguage).trimEnd(),
      addedSections: [...MEMORY_SECTIONS]
    };
  }

  if (!nextLines[0]?.startsWith('# ')) {
    nextLines.unshift('', expectedTitle);
  } else {
    nextLines[0] = expectedTitle;
  }

  const addedSections: string[] = [];
  for (const section of MEMORY_SECTIONS) {
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
