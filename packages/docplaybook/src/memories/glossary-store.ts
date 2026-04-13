import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getGlossaryPath } from '../config.js';
import { ensureDir, pathExists } from '../utils.js';

// Glossary format: { "source term": "target term" }
// Applied as post-processing after translation — deterministic string replacement.
// Only prose sections are patched; fenced code blocks and inline code are preserved.

export class GlossaryStore {
  private cache = new Map<string, Record<string, string>>();

  public constructor(private readonly workspaceRoot: string) {}

  public async load(lang: string): Promise<Record<string, string>> {
    if (this.cache.has(lang)) {
      return this.cache.get(lang)!;
    }

    const glossaryPath = getGlossaryPath(this.workspaceRoot, lang);
    if (!(await pathExists(glossaryPath))) {
      this.cache.set(lang, {});
      return {};
    }

    const raw = await fs.readFile(glossaryPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, string>;
    this.cache.set(lang, parsed);
    return parsed;
  }

  public async countTerms(lang: string): Promise<number> {
    const glossary = await this.load(lang);
    return Object.keys(glossary).length;
  }

  public async mergeEntry(lang: string, source: string, target: string): Promise<void> {
    const glossary = await this.load(lang);
    glossary[source] = target;
    // Sort keys alphabetically for stable diffs
    const sorted = Object.fromEntries(Object.entries(glossary).sort(([a], [b]) => a.localeCompare(b)));
    this.cache.set(lang, sorted);
    const glossaryPath = getGlossaryPath(this.workspaceRoot, lang);
    await ensureDir(path.dirname(glossaryPath));
    await fs.writeFile(glossaryPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
  }

  public async patch(text: string, lang: string): Promise<{ text: string; patches: number }> {
    const glossary = await this.load(lang);
    const entries = Object.entries(glossary);
    if (entries.length === 0) {
      return { text, patches: 0 };
    }

    let patches = 0;
    const result = applyGlossaryToText(text, entries, (count) => { patches += count; });
    return { text: result, patches };
  }
}

/**
 * Applies glossary replacements to prose sections only.
 * Fenced code blocks (``` ... ```) and inline code (` ... `) are skipped.
 */
function applyGlossaryToText(
  text: string,
  entries: Array<[string, string]>,
  onPatches: (count: number) => void
): string {
  // Split text into segments: code blocks and prose
  // Regex matches fenced code blocks OR inline code spans
  const codePattern = /(`{3,}[\s\S]*?`{3,}|`[^`\n]+`)/g;
  const segments: Array<{ code: true; text: string } | { code: false; text: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(codePattern)) {
    if (match.index! > lastIndex) {
      segments.push({ code: false, text: text.slice(lastIndex, match.index) });
    }
    segments.push({ code: true, text: match[0] });
    lastIndex = match.index! + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ code: false, text: text.slice(lastIndex) });
  }

  const result = segments.map((segment) => {
    if (segment.code) {
      return segment.text;
    }

    let prose = segment.text;
    for (const [source, target] of entries) {
      if (!source || source === target) {
        continue;
      }
      const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'g');
      const before = prose;
      prose = prose.replace(re, target);
      if (prose !== before) {
        const count = (before.match(re) ?? []).length;
        onPatches(count);
      }
    }

    return prose;
  });

  return result.join('');
}
