import { franc } from 'franc';
import { DEFAULT_IGNORE_PATTERNS } from '../config.js';
import { parseMarkdownSnapshot } from '../markdown/blocks.js';
import { LocalFolderProvider } from '../providers/local-folder-provider.js';

const LANGUAGE_MAP: Record<string, string> = {
  cmn: 'zh-CN',
  zho: 'zh-CN',
  eng: 'en',
  jpn: 'ja',
  kor: 'ko',
  fra: 'fr',
  fre: 'fr',
  deu: 'de',
  ger: 'de',
  spa: 'es',
  por: 'pt',
  ita: 'it',
  rus: 'ru'
};

export interface DetectedLanguage {
  language: string;
  rawCode: string;
  sampleFiles: string[];
}

function isLikelyLocalizedVariant(relativePath: string): boolean {
  const basename = relativePath.split('/').pop() ?? relativePath;
  return /\.[a-z]{2}(?:-[a-zA-Z]{2,4})?\.md$/i.test(basename);
}

function isInternalDocplaybookPath(relativePath: string): boolean {
  return relativePath.split('/').includes('.docplaybook');
}

function preferImportantFiles(left: string, right: string): number {
  const leftScore = left === 'README.md' ? 0 : left.split('/').length;
  const rightScore = right === 'README.md' ? 0 : right.split('/').length;

  if (leftScore !== rightScore) {
    return leftScore - rightScore;
  }

  return left.localeCompare(right);
}

function extractTextForDetection(raw: string): string {
  const snapshot = parseMarkdownSnapshot('detection.md', raw);
  return snapshot.blocks
    .filter((block) => block.translatable)
    .map((block) => block.raw)
    .join('\n')
    .replace(/`[^`]+`/g, ' ')
    .replace(/\[[^\]]+\]\([^)]+\)/g, ' ')
    .replace(/[#>*_\-\[\]!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function detectWorkspaceSourceLanguage(
  workspaceRoot: string
): Promise<DetectedLanguage | null> {
  const provider = new LocalFolderProvider(workspaceRoot, DEFAULT_IGNORE_PATTERNS);
  const files = (await provider.scanMarkdownFiles()).sort(preferImportantFiles);

  if (files.length === 0) {
    return null;
  }

  const candidates = files.filter((relativePath) => {
    return !isInternalDocplaybookPath(relativePath) && !isLikelyLocalizedVariant(relativePath);
  });
  const selectedFiles = (candidates.length > 0 ? candidates : files).slice(0, 8);
  const chunks: string[] = [];

  for (const relativePath of selectedFiles) {
    const raw = await provider.read(relativePath);
    const text = extractTextForDetection(raw);
    if (text.length > 0) {
      chunks.push(text);
    }
  }

  const sample = chunks.join('\n').slice(0, 8_000);
  if (sample.length < 20) {
    return null;
  }

  const rawCode = franc(sample, { minLength: 20 });
  if (rawCode === 'und') {
    return null;
  }

  return {
    language: LANGUAGE_MAP[rawCode] ?? rawCode,
    rawCode,
    sampleFiles: selectedFiles
  };
}
