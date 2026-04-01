import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { UserFacingError } from '../errors.js';
import type { ModelKind } from '../types.js';
import { bold, cyan, dim, green, yellow } from '../ui.js';
import type { DetectedLanguage } from './detect-language.js';

export function canPrompt(): boolean {
  return Boolean(input.isTTY && output.isTTY);
}

async function askLine(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

function choiceLabel(index: number, label: string): string {
  return `  ${index}) ${label}`;
}

function promptHeader(title: string, subtitle?: string): string {
  return [
    cyan(bold(title)),
    subtitle ? dim(subtitle) : ''
  ].filter(Boolean).join('\n');
}

function promptOption(index: number, label: string, options: {
  recommended?: boolean;
  selected?: boolean;
  description?: string;
} = {}): string {
  const badges = [
    options.recommended ? green('recommended') : '',
    options.selected ? yellow('default') : ''
  ].filter(Boolean);
  const renderedLabel = badges.length > 0 ? `${label} ${dim(`(${badges.join(', ')})`)}` : label;

  return [
    choiceLabel(index, renderedLabel),
    options.description ? `     ${dim(options.description)}` : ''
  ].filter(Boolean).join('\n');
}

export async function promptModelKind(): Promise<ModelKind> {
  return promptModelKindWithDefault('openai');
}

function modelKindToChoice(kind: ModelKind): string {
  switch (kind) {
    case 'openai':
      return '1';
    case 'anthropic':
      return '2';
    case 'gateway':
      return '3';
    case 'openai-compatible':
      return '4';
  }
}

export async function promptModelKindWithDefault(defaultKind: ModelKind): Promise<ModelKind> {
  if (!canPrompt()) {
    return defaultKind;
  }

  const defaultChoice = modelKindToChoice(defaultKind);

  const answer = await askLine(
    [
      promptHeader('Model Provider', 'Choose how docplaybook should call the model.'),
      promptOption(1, 'OpenAI official', {
        recommended: true,
        selected: defaultChoice === '1',
        description: 'Best default if you are using the official OpenAI API directly.'
      }),
      promptOption(2, 'Anthropic official', {
        selected: defaultChoice === '2',
        description: 'Use Anthropic directly with an API key or auth token.'
      }),
      promptOption(3, 'Vercel AI Gateway', {
        selected: defaultChoice === '3',
        description: 'Use a gateway model string such as openai/gpt-5-mini.'
      }),
      promptOption(4, 'OpenAI-compatible custom provider', {
        selected: defaultChoice === '4',
        description: 'Use OpenRouter or any other compatible base URL.'
      }),
      '',
      `${bold('Provider')} [${defaultChoice}]: `
    ].join('\n')
  );

  switch (answer.trim() || defaultChoice) {
    case '1':
      return 'openai';
    case '2':
      return 'anthropic';
    case '3':
      return 'gateway';
    case '4':
      return 'openai-compatible';
    default:
      throw new UserFacingError('Unknown provider choice. Please choose 1, 2, 3, or 4.');
  }
}

export async function promptModelId(defaultValue: string): Promise<string> {
  if (!canPrompt()) {
    return defaultValue;
  }

  const answer = await askLine(
    [
      promptHeader('Model ID', 'Enter the exact model identifier to use for translation.'),
      `${bold('Model ID')} [${defaultValue}]: `
    ].join('\n')
  );
  return answer.trim() || defaultValue;
}

export async function promptRetryModelSetupStep(): Promise<1 | 2 | 3> {
  if (!canPrompt()) {
    throw new UserFacingError('Model connectivity check failed.');
  }

  const answer = await askLine(
    [
      promptHeader('Retry Model Setup', 'Choose which step to revisit before trying the connectivity check again.'),
      promptOption(1, 'Provider'),
      promptOption(2, 'Model', { selected: true }),
      promptOption(3, 'Credentials'),
      '',
      `${bold('Retry from step')} [2]: `
    ].join('\n')
  );

  switch (answer.trim() || '2') {
    case '1':
      return 1;
    case '2':
      return 2;
    case '3':
      return 3;
    default:
      throw new UserFacingError('Unknown retry choice. Please choose 1, 2, or 3.');
  }
}

export async function promptModelScope(): Promise<'workspace' | 'local'> {
  if (!canPrompt()) {
    return 'workspace';
  }

  const answer = await askLine(
    [
      promptHeader('Model Scope', 'Choose whether the provider/model should be shared in config or kept local to your machine.'),
      promptOption(1, 'Lock in workspace config', {
        recommended: true,
        selected: true,
        description: 'Everyone using this repo will default to the same provider and model.'
      }),
      promptOption(2, 'Keep model local only', {
        description: 'Provider/model go to .docplaybook/.env.local, so teammates can choose their own.'
      }),
      '',
      `${bold('Scope')} [1]: `
    ].join('\n')
  );

  switch (answer.trim() || '1') {
    case '1':
      return 'workspace';
    case '2':
      return 'local';
    default:
      throw new UserFacingError('Unknown scope choice. Please choose 1 or 2.');
  }
}

export async function promptProviderName(defaultValue = 'custom-provider'): Promise<string> {
  if (!canPrompt()) {
    return defaultValue;
  }

  const answer = await askLine(
    [
      promptHeader('Provider Name', 'Used for labels and env var naming in openai-compatible mode.'),
      `${bold('Provider name')} [${defaultValue}]: `
    ].join('\n')
  );
  return answer.trim() || defaultValue;
}

export async function promptOptionalValue(
  question: string,
  defaultValue?: string
): Promise<string> {
  if (!canPrompt()) {
    return defaultValue ?? '';
  }

  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = await askLine(`${question}${suffix}: `);
  return answer.trim() || defaultValue || '';
}

export async function promptSecret(question: string): Promise<string> {
  if (!canPrompt()) {
    return '';
  }
  return askLine(question);
}

export async function confirmSourceLanguage(
  detected: DetectedLanguage | null
): Promise<string> {
  if (!canPrompt()) {
    return detected?.language ?? 'zh-CN';
  }

  const defaultLanguage = detected?.language ?? 'zh-CN';
  const answer = await askLine(
    detected
      ? `Detected source language: ${defaultLanguage}. Enter another language code if you want to change it (for example: en, zh-CN, ja) [${defaultLanguage}]: `
      : `Could not detect the source language. Type a language code (for example: en, zh-CN, ja) [${defaultLanguage}]: `
  );

  return answer.trim() || defaultLanguage;
}

export async function promptTargetLanguages(existingTargets: string[]): Promise<string[]> {
  if (!canPrompt()) {
    if (existingTargets.length > 0) {
      return [];
    }

    throw new UserFacingError(
      'Target languages are required in non-interactive mode. Pass --targets like "en,ja".'
    );
  }

  while (true) {
    const question =
      existingTargets.length === 0
        ? 'Target languages (comma-separated, e.g. en,ja): '
        : `Target languages to add (comma-separated). Existing: ${existingTargets.join(', ')} [leave empty to keep current]: `;
    const answer = await askLine(question);
    const values = answer
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (values.length > 0) {
      return values;
    }

    if (existingTargets.length > 0) {
      return [];
    }

    console.log(yellow('At least one target language is required.'));
  }
}

export async function promptBootstrapNow(languages: string[]): Promise<boolean> {
  if (!canPrompt()) {
    return false;
  }

  const answer = await askLine(
    [
      promptHeader(
        'Bootstrap Existing Translations',
        `Detected existing translated files for: ${languages.join(', ')}.`
      ),
      'Bootstrap will infer the first playbook and language memories from the existing translated docs.',
      '',
      `${bold('Run bootstrap now?')} [Y/n]: `
    ].join('\n')
  );

  const normalized = answer.trim().toLowerCase();
  return normalized === '' || normalized === 'y' || normalized === 'yes';
}

export async function promptBootstrapDocLimit(
  targetLanguage: string,
  totalDocs: number
): Promise<number | null> {
  if (!canPrompt()) {
    return null;
  }

  const answer = await askLine(
    [
      promptHeader(
        'Bootstrap Sample Size',
        `${targetLanguage} has ${totalDocs} aligned translated document(s).`
      ),
      'Press Enter to use all of them, or type a smaller document limit for this bootstrap run.',
      '',
      `${bold('Document limit')} [all]: `
    ].join('\n')
  );

  const normalized = answer.trim().toLowerCase();
  if (normalized === '' || normalized === 'all') {
    return null;
  }

  const numeric = Number(normalized);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new UserFacingError('Document limit must be a positive integer or left empty.');
  }

  return numeric;
}
