import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { UserFacingError } from '../errors.js';
import type { ModelKind } from '../types.js';
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
      'Model provider:',
      choiceLabel(1, 'OpenAI official (Recommended)'),
      choiceLabel(2, 'Anthropic official'),
      choiceLabel(3, 'Vercel AI Gateway'),
      choiceLabel(4, 'OpenAI-compatible custom provider'),
      `Choose a provider [${defaultChoice}]: `
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

  const answer = await askLine(`Model ID [${defaultValue}]: `);
  return answer.trim() || defaultValue;
}

export async function promptRetryModelSetupStep(): Promise<1 | 2 | 3> {
  if (!canPrompt()) {
    throw new UserFacingError('Model connectivity check failed.');
  }

  const answer = await askLine(
    [
      'Choose where to go back:',
      choiceLabel(1, 'Provider'),
      choiceLabel(2, 'Model'),
      choiceLabel(3, 'Credentials'),
      'Retry from step [2]: '
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

export async function promptProviderName(defaultValue = 'custom-provider'): Promise<string> {
  if (!canPrompt()) {
    return defaultValue;
  }

  const answer = await askLine(
    `Provider name (used in config labels) [${defaultValue}]: `
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

  output.write(question);

  const stream = input;
  const previousRawMode = stream.isTTY ? stream.isRaw : false;

  if (stream.isTTY) {
    stream.setRawMode(true);
  }

  stream.resume();

  return new Promise((resolve, reject) => {
    let value = '';

    const cleanup = () => {
      stream.off('data', onData);
      if (stream.isTTY) {
        stream.setRawMode(previousRawMode);
      }
      output.write('\n');
    };

    const onData = (chunk: Buffer) => {
      const text = chunk.toString('utf8');

      for (const char of text) {
        if (char === '\u0003') {
          cleanup();
          reject(new UserFacingError('Cancelled.'));
          return;
        }

        if (char === '\r' || char === '\n') {
          cleanup();
          resolve(value.trim());
          return;
        }

        if (char === '\u007f') {
          value = value.slice(0, -1);
          continue;
        }

        value += char;
      }
    };

    stream.on('data', onData);
  });
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
      ? `Detected source language: ${defaultLanguage}. Press Enter to accept, or type another language code (for example: en, zh-CN, ja): `
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

  const question =
    existingTargets.length === 0
      ? 'Target languages (comma-separated, e.g. en,ja): '
      : `Target languages to add (comma-separated). Existing: ${existingTargets.join(', ')}. Leave empty to keep current targets: `;
  const answer = await askLine(question);
  const values = answer
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0 && existingTargets.length === 0) {
    throw new UserFacingError('At least one target language is required.');
  }

  return values;
}
