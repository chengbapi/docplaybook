import { generateText } from 'ai';
import type {
  BootstrapExample,
  LearnCandidate,
  LearnJudgement,
  MemoryUpdateResult,
  ModelUsageStats
} from '../types.js';
import {
  buildBootstrapMemoryPrompt,
  buildLearnJudgePrompt
} from './prompts.js';
import type { ModelHandle } from '../model/model-factory.js';
import { debugLog } from '../ui.js';

export class MemoryUpdater {
  public constructor(private readonly modelHandle: ModelHandle) {}

  public async judgeLearnCandidates(input: {
    sourceLanguage: string;
    targetLanguage: string;
    currentPlaybook: string;
    currentMemory: string;
    candidates: LearnCandidate[];
  }): Promise<{ items: LearnJudgement[]; usage: ModelUsageStats }> {
    if (input.candidates.length === 0) {
      return {
        items: [],
        usage: zeroUsage()
      };
    }

    const prompt = buildLearnJudgePrompt(input);
    debugLog(
      `learn-judge ${input.targetLanguage}: candidates=${input.candidates.length}, promptChars=${prompt.length}.`
    );
    const result = await generateText({
      model: this.modelHandle.model,
      prompt
    });

    return {
      items: parseLearnJudgements(result.text),
      usage: normalizeUsage(result.usage)
    };
  }

  public async mergeRules(input: {
    scope: 'playbook' | 'memory';
    sourceLanguage: string;
    targetLanguage: string;
    memoryText: string;
    rules: string[];
  }): Promise<MemoryUpdateResult> {
    if (input.rules.length === 0) {
      return {
        text: input.memoryText,
        usage: zeroUsage()
      };
    }

    return {
      text: mergeRulesLocally(input).trimEnd(),
      usage: zeroUsage()
    };
  }

  public async bootstrapMemory(input: {
    scope: 'playbook' | 'memory';
    sourceLanguage: string;
    targetLanguage: string;
    memoryText: string;
    examples: BootstrapExample[];
  }): Promise<MemoryUpdateResult> {
    if (input.examples.length === 0) {
      return {
        text: input.memoryText,
        usage: zeroUsage()
      };
    }

    const prompt = buildBootstrapMemoryPrompt(input);
    debugLog(
      `bootstrap-${input.scope} ${input.targetLanguage}: examples=${input.examples.length}, promptChars=${prompt.length}.`
    );
    const result = await generateText({
      model: this.modelHandle.model,
      prompt
    });

    return {
      text: stripOuterMarkdownFence(result.text).trimEnd(),
      usage: normalizeUsage(result.usage)
    };
  }
}

function parseLearnJudgements(text: string): LearnJudgement[] {
  const normalized = stripOuterMarkdownFence(text);
  const match = normalized.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Learn judgement did not return JSON.');
  }

  const parsed = JSON.parse(match[0]) as {
    items?: Array<Record<string, unknown>>;
  };

  return (parsed.items ?? []).map((item) => ({
    docKey: typeof item.docKey === 'string' ? item.docKey : '',
    blockIndex: toPositiveInt(item.blockIndex),
    shouldLearn: Boolean(item.shouldLearn),
    scope: normalizeScope(item.scope),
    category: normalizeCategory(item.category),
    reason: typeof item.reason === 'string' && item.reason.trim().length > 0
      ? item.reason.trim()
      : 'No reason provided.',
    proposedRule: typeof item.proposedRule === 'string' ? item.proposedRule.trim() : ''
  }));
}

function normalizeScope(value: unknown): LearnJudgement['scope'] {
  switch (value) {
    case 'playbook':
    case 'memory':
    case 'glossary':
    case 'ignore':
      return value;
    default:
      return 'ignore';
  }
}

export function parseGlossaryRule(rule: string): { source: string; target: string } | null {
  // Accepts: "source" → "target"  or  "source" -> "target"  or  source → target
  const quoted = rule.match(/^"(.+?)"\s*(?:→|->)\s*"(.+?)"$/);
  if (quoted) {
    return { source: quoted[1]!.trim(), target: quoted[2]!.trim() };
  }

  const unquoted = rule.match(/^(.+?)\s*(?:→|->)\s*(.+?)$/);
  if (unquoted) {
    return { source: unquoted[1]!.trim(), target: unquoted[2]!.trim() };
  }

  return null;
}

function normalizeCategory(value: unknown): LearnJudgement['category'] {
  switch (value) {
    case 'terminology':
    case 'style':
    case 'protected_term':
    case 'format':
    case 'one_off':
    case 'rewrite':
    case 'other':
      return value;
    default:
      return 'other';
  }
}

function toPositiveInt(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 0;
}

function stripOuterMarkdownFence(text: string): string {
  const normalized = text.trim();
  const match = normalized.match(/^```(?:md|markdown|json)?\n([\s\S]*?)\n```$/i);
  if (!match) {
    return normalized;
  }

  return match[1] ?? normalized;
}

function normalizeUsage(usage: {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  totalTokens: number | undefined;
}): ModelUsageStats {
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0
  };
}

function zeroUsage(): ModelUsageStats {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  };
}

type MemoryScope = 'playbook' | 'memory';

function mergeRulesLocally(input: {
  scope: MemoryScope;
  targetLanguage: string;
  memoryText: string;
  rules: string[];
}): string {
  const lines = input.memoryText.trimEnd().split('\n');
  const sectionOrder = input.scope === 'playbook'
    ? ['## Voice', '## Protected Terms', '## Translation Rules']
    : ['## Terminology', '## Style Notes'];

  const sections = new Map<string, string[]>();
  let currentSection = '';
  for (const line of lines) {
    if (sectionOrder.includes(line.trim())) {
      currentSection = line.trim();
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
      }
      continue;
    }

    if (!currentSection) {
      continue;
    }

    const bucket = sections.get(currentSection);
    if (bucket) {
      bucket.push(line);
    }
  }

  for (const heading of sectionOrder) {
    if (!sections.has(heading)) {
      sections.set(heading, []);
    }
  }

  const normalizedExisting = new Set(
    Array.from(sections.values())
      .flat()
      .map((line) => normalizeRuleLine(line))
      .filter(Boolean)
  );

  let addedCount = 0;
  for (const rule of input.rules) {
    const trimmed = normalizeRuleText(rule);
    if (!trimmed) {
      continue;
    }

    const normalized = normalizeRuleLine(`- ${trimmed}`);
    if (normalizedExisting.has(normalized)) {
      continue;
    }

    const heading = classifyRuleSection(input.scope, trimmed);
    const bucket = sections.get(heading);
    if (!bucket) {
      continue;
    }

    if (bucket.length > 0 && bucket[bucket.length - 1] !== '') {
      bucket.push('');
    }
    bucket.push(`- ${trimmed}`);
    normalizedExisting.add(normalized);
    addedCount += 1;
  }

  if (addedCount === 0) {
    return input.memoryText.trimEnd();
  }

  const output: string[] = [];
  let activeSection = '';
  let skippingPlaceholder = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (sectionOrder.includes(trimmed)) {
      if (activeSection) {
        writeSection(output, sections.get(activeSection) ?? []);
      }
      output.push(line);
      activeSection = trimmed;
      skippingPlaceholder = true;
      continue;
    }

    if (!activeSection) {
      output.push(line);
      continue;
    }

    if (skippingPlaceholder && normalizeRuleLine(line) === '-') {
      continue;
    }

    if (skippingPlaceholder && trimmed === '') {
      output.push(line);
      continue;
    }

    skippingPlaceholder = false;
  }

  if (activeSection) {
    writeSection(output, sections.get(activeSection) ?? []);
  }

  return trimExtraTrailingLines(output).join('\n');
}

function writeSection(output: string[], sectionLines: string[]): void {
  const cleaned = trimExtraTrailingLines(sectionLines);
  if (output.length > 0 && output[output.length - 1] !== '') {
    output.push('');
  }
  output.push(...cleaned);
}

function trimExtraTrailingLines(lines: string[]): string[] {
  const next = [...lines];
  while (next.length > 0 && next[next.length - 1] === '') {
    next.pop();
  }
  return next;
}

function normalizeRuleText(text: string): string {
  return text.replace(/^\s*-\s*/, '').replace(/\s+/g, ' ').trim();
}

function normalizeRuleLine(line: string): string {
  return normalizeRuleText(line).toLowerCase();
}

function classifyRuleSection(scope: MemoryScope, rule: string): string {
  const normalized = rule.toLowerCase();

  if (scope === 'memory') {
    if (
      normalized.includes('translate ') ||
      normalized.includes('use ') ||
      normalized.includes('term') ||
      normalized.includes('terminology') ||
      normalized.includes('keep ') ||
      normalized.includes('render ')
    ) {
      return '## Terminology';
    }

    return '## Style Notes';
  }

  if (
    normalized.includes('voice') ||
    normalized.includes('tone') ||
    normalized.includes('concise') ||
    normalized.includes('promotional') ||
    normalized.includes('marketing') ||
    normalized.includes('neutral')
  ) {
    return '## Voice';
  }

  if (
    normalized.includes('protected') ||
    normalized.includes('verbatim') ||
    normalized.includes('inline code') ||
    normalized.includes('identifier') ||
    normalized.includes('token') ||
    normalized.includes('path') ||
    normalized.includes('file name') ||
    normalized.includes('filename') ||
    normalized.includes('api') ||
    normalized.includes('command')
  ) {
    return '## Protected Terms';
  }

  return '## Translation Rules';
}
