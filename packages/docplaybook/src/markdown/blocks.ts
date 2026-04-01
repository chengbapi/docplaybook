import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { gfm } from 'micromark-extension-gfm';
import { mdxjs } from 'micromark-extension-mdxjs';
import type { DocumentSnapshot, LayoutKind, MarkdownBlock } from '../types.js';
import { nowIso, sha256 } from '../utils.js';
import {
  getSupportedMarkdownExtension,
  isRspressI18nJsonPath,
  isRspressMetadataJsonPath
} from './files.js';

const NON_TRANSLATABLE_TYPES = new Set([
  'code',
  'definition',
  'frontmatter',
  'html',
  'thematicBreak',
  'mdxFlowExpression',
  'mdxTextExpression',
  'mdxJsxFlowElement',
  'mdxJsxTextElement',
  'mdxjsEsm'
]);

interface FrontmatterSlice {
  raw: string;
  body: string;
}

export interface DocumentParseOptions {
  layoutKind?: LayoutKind;
  language?: string;
}

function splitFrontmatter(raw: string): FrontmatterSlice {
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) {
    return { raw: '', body: raw };
  }

  const lines = raw.split(/\r?\n/);
  let offset = 0;
  let closingLineIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    offset += line.length;
    if (index < lines.length - 1) {
      offset += raw.includes('\r\n') ? 2 : 1;
    }

    if (index > 0 && line.trim() === '---') {
      closingLineIndex = index;
      break;
    }
  }

  if (closingLineIndex === -1) {
    return { raw: '', body: raw };
  }

  return {
    raw: raw.slice(0, offset),
    body: raw.slice(offset)
  };
}

function isTranslatable(nodeType: string, raw: string): boolean {
  if (NON_TRANSLATABLE_TYPES.has(nodeType)) {
    return false;
  }

  return raw.trim().length > 0;
}

function makeBlock(
  index: number,
  kind: string,
  prefix: string,
  raw: string,
  translatableOverride?: boolean
): MarkdownBlock {
  return {
    index,
    kind,
    prefix,
    raw,
    translatable: translatableOverride ?? isTranslatable(kind, raw),
    hash: sha256(raw)
  };
}

export function parseDocumentSnapshot(
  relativePath: string,
  raw: string,
  options: DocumentParseOptions = {}
): DocumentSnapshot {
  if (isRspressI18nJsonPath(relativePath)) {
    return parseRspressI18nSnapshot(relativePath, raw, options.language);
  }

  if (isRspressMetadataJsonPath(relativePath)) {
    return parseRspressJsonSnapshot(relativePath, raw);
  }

  return parseMarkdownSnapshot(relativePath, raw, options);
}

export function parseMarkdownSnapshot(
  relativePath: string,
  raw: string,
  options: DocumentParseOptions = {}
): DocumentSnapshot {
  const { raw: frontmatterRaw, body } = splitFrontmatter(raw);
  const blocks: MarkdownBlock[] = [];
  let tail = '';
  let blockIndex = 0;
  const extension = getSupportedMarkdownExtension(relativePath);
  const isMdx = extension === '.mdx';

  if (frontmatterRaw) {
    const frontmatterBlocks = shouldUseRspressFrontmatterWhitelist(relativePath, options.layoutKind)
      ? parseRspressFrontmatterBlocks(frontmatterRaw, blockIndex)
      : [makeBlock(blockIndex, 'frontmatter', '', frontmatterRaw)];

    blocks.push(...frontmatterBlocks);
    blockIndex += frontmatterBlocks.length;
  }

  if (body.length > 0) {
    const tree = fromMarkdown(body, {
      extensions: isMdx ? [gfm(), mdxjs()] : [gfm()],
      mdastExtensions: isMdx ? [gfmFromMarkdown(), mdxFromMarkdown()] : [gfmFromMarkdown()]
    });

    const children = tree.children.filter((child): child is (typeof tree.children)[number] & {
      position: NonNullable<(typeof tree.children)[number]['position']>;
    } => {
      return Boolean(child.position);
    });

    if (children.length === 0) {
      blocks.push(makeBlock(blockIndex, 'document', '', body));
      blockIndex += 1;
    } else {
      let cursor = 0;
      children.forEach((child, childIndex) => {
        const start = child.position.start.offset ?? 0;
        const end = child.position.end.offset ?? body.length;
        const prefix = body.slice(cursor, start);
        const blockRaw = body.slice(start, end);
        blocks.push(makeBlock(blockIndex, child.type, prefix, blockRaw));
        blockIndex += 1;
        cursor = end;

        if (childIndex === children.length - 1) {
          tail = body.slice(cursor);
        }
      });
    }
  }

  return {
    relativePath,
    hash: sha256(raw),
    updatedAt: nowIso(),
    blocks,
    tail,
    format: 'markdown'
  };
}

export function renderSnapshot(snapshot: DocumentSnapshot, blockRaws: string[]): string {
  if ((snapshot.format === 'rspress-json' || snapshot.format === 'rspress-i18n-json') && snapshot.jsonRoot && snapshot.jsonPointers) {
    const nextRoot = JSON.parse(JSON.stringify(snapshot.jsonRoot));

    snapshot.jsonPointers.forEach((pointer, index) => {
      const nextValue = blockRaws[index] ?? snapshot.blocks[index]?.raw ?? '';
      setNestedString(nextRoot, pointer, nextValue);
    });

    return `${JSON.stringify(nextRoot, null, 2)}\n`;
  }

  return snapshot.blocks
    .map((block, index) => `${block.prefix}${blockRaws[index] ?? block.raw}`)
    .join('') + snapshot.tail;
}

export function getChangedBlockIndexes(
  previousSnapshot: DocumentSnapshot | undefined,
  nextSnapshot: DocumentSnapshot
): number[] {
  if (!previousSnapshot) {
    return nextSnapshot.blocks.filter((block) => block.translatable).map((block) => block.index);
  }

  const maxBlocks = Math.max(previousSnapshot.blocks.length, nextSnapshot.blocks.length);
  const changed: number[] = [];

  for (let index = 0; index < maxBlocks; index += 1) {
    const previousBlock = previousSnapshot.blocks[index];
    const nextBlock = nextSnapshot.blocks[index];

    if (!nextBlock) {
      continue;
    }

    if (!previousBlock || previousBlock.hash !== nextBlock.hash || previousBlock.kind !== nextBlock.kind) {
      if (nextBlock.translatable) {
        changed.push(index);
      }
    }
  }

  return changed;
}

export function snapshotsHaveSameShape(
  left: DocumentSnapshot | undefined,
  right: DocumentSnapshot | undefined
): boolean {
  if (!left || !right) {
    return false;
  }

  if (left.blocks.length !== right.blocks.length) {
    return false;
  }

  return left.blocks.every((block, index) => {
    const other = right.blocks[index];
    return Boolean(other) && block.kind === other.kind && block.translatable === other.translatable;
  });
}

function shouldUseRspressFrontmatterWhitelist(relativePath: string, layoutKind: LayoutKind | undefined): boolean {
  if (layoutKind !== 'rspress') {
    return false;
  }

  const extension = getSupportedMarkdownExtension(relativePath);
  if (!extension) {
    return false;
  }

  const segments = relativePath.split('/');
  return segments.length === 3 && segments[0] === 'docs' && pathBasename(relativePath) === `index${extension}`;
}

function parseRspressFrontmatterBlocks(frontmatterRaw: string, startIndex: number): MarkdownBlock[] {
  const pointers = extractRspressFrontmatterValuePointers(frontmatterRaw);
  if (pointers.length === 0) {
    return [makeBlock(startIndex, 'frontmatter', '', frontmatterRaw)];
  }

  const blocks: MarkdownBlock[] = [];
  let cursor = 0;

  pointers.forEach((pointer, localIndex) => {
    blocks.push(
      makeBlock(
        startIndex + localIndex,
        'frontmatter-value',
        frontmatterRaw.slice(cursor, pointer.valueStart),
        frontmatterRaw.slice(pointer.valueStart, pointer.valueEnd),
        true
      )
    );
    cursor = pointer.valueEnd;
  });

  const trailing = frontmatterRaw.slice(cursor);
  if (trailing.length > 0) {
    blocks.push(makeBlock(startIndex + blocks.length, 'frontmatter-tail', trailing, '', false));
  }

  return blocks;
}

function parseRspressJsonSnapshot(relativePath: string, raw: string): DocumentSnapshot {
  const root = JSON.parse(raw) as unknown;
  const pointers: string[][] = [];
  const blocks: MarkdownBlock[] = [];
  const translatableKeys = relativePath.endsWith('/_nav.json')
    ? new Set(['text'])
    : new Set(['label', 'text']);

  walkRspressJson(root, [], translatableKeys, (pointer, value) => {
    pointers.push(pointer);
    blocks.push(makeBlock(blocks.length, 'json-string', '', value, true));
  });

  return {
    relativePath,
    hash: sha256(raw),
    updatedAt: nowIso(),
    blocks,
    tail: '',
    format: 'rspress-json',
    jsonRoot: root,
    jsonPointers: pointers
  };
}

function parseRspressI18nSnapshot(
  relativePath: string,
  raw: string,
  language: string | undefined
): DocumentSnapshot {
  const root = JSON.parse(raw) as Record<string, unknown>;
  const pointers: string[][] = [];
  const blocks: MarkdownBlock[] = [];

  if (!language) {
    return {
      relativePath,
      hash: sha256(raw),
      updatedAt: nowIso(),
      blocks: [makeBlock(0, 'json-string', '', raw, false)],
      tail: '',
      format: 'rspress-i18n-json',
      jsonRoot: root,
      jsonPointers: []
    };
  }

  for (const [messageKey, messageValue] of Object.entries(root)) {
    if (!messageValue || typeof messageValue !== 'object' || Array.isArray(messageValue)) {
      continue;
    }

    const localized = (messageValue as Record<string, unknown>)[language];
    if (typeof localized !== 'string') {
      continue;
    }

    pointers.push([messageKey, language]);
    blocks.push(makeBlock(blocks.length, 'json-string', '', localized, true));
  }

  return {
    relativePath,
    hash: sha256(raw),
    updatedAt: nowIso(),
    blocks,
    tail: '',
    format: 'rspress-i18n-json',
    jsonRoot: root,
    jsonPointers: pointers
  };
}

function walkRspressJson(
  value: unknown,
  pointer: string[],
  translatableKeys: Set<string>,
  onString: (pointer: string[], value: string) => void
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkRspressJson(item, [...pointer, String(index)], translatableKeys, onString);
    });
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPointer = [...pointer, key];
    if (typeof nestedValue === 'string' && translatableKeys.has(key)) {
      onString(nextPointer, nestedValue);
      continue;
    }

    walkRspressJson(nestedValue, nextPointer, translatableKeys, onString);
  }
}

function setNestedString(root: unknown, pointer: string[], nextValue: string): void {
  let current = root as Record<string, unknown> | unknown[];

  for (let index = 0; index < pointer.length - 1; index += 1) {
    const segment = pointer[index]!;
    current = Array.isArray(current)
      ? current[Number(segment)] as Record<string, unknown> | unknown[]
      : current[segment] as Record<string, unknown> | unknown[];
  }

  const last = pointer[pointer.length - 1]!;
  if (Array.isArray(current)) {
    current[Number(last)] = nextValue;
    return;
  }

  current[last] = nextValue;
}

function pathBasename(relativePath: string): string {
  const segments = relativePath.split('/');
  return segments[segments.length - 1] ?? relativePath;
}

function extractRspressFrontmatterValuePointers(frontmatterRaw: string): Array<{
  valueStart: number;
  valueEnd: number;
}> {
  const lines = frontmatterRaw.split(/(\r?\n)/);
  const pointers: Array<{ valueStart: number; valueEnd: number }> = [];
  const stack: Array<{ indent: number; key: string }> = [];
  let offset = 0;

  for (let index = 0; index < lines.length; index += 2) {
    const line = lines[index] ?? '';
    const newline = lines[index + 1] ?? '';
    const trimmed = line.trim();

    if (trimmed === '---' || trimmed.length === 0) {
      offset += line.length + newline.length;
      continue;
    }

    const indent = line.length - line.trimStart().length;
    while (stack.length > 0 && indent < stack[stack.length - 1]!.indent) {
      stack.pop();
    }

    if (trimmed.startsWith('- ')) {
      const listBody = trimmed.slice(2);
      const colonIndex = listBody.indexOf(':');
      if (colonIndex !== -1) {
        const key = listBody.slice(0, colonIndex).trim();
        const value = listBody.slice(colonIndex + 1).trimStart();
        if (value.length === 0) {
          stack.push({ indent: indent + 2, key });
        }
      }
      offset += line.length + newline.length;
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      offset += line.length + newline.length;
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    const valueRaw = line.slice(colonIndex + 1);
    const value = valueRaw.trimStart();
    const pathSegments = [...stack.map((item) => item.key), key];

    if (value.length === 0) {
      stack.push({ indent, key });
      offset += line.length + newline.length;
      continue;
    }

    if (isRspressFrontmatterPathTranslatable(pathSegments)) {
      const leadingSpaceLength = valueRaw.length - value.length;
      const valueStart = offset + colonIndex + 1 + leadingSpaceLength;
      const valueEnd = offset + line.length;
      pointers.push({ valueStart, valueEnd });
    }

    offset += line.length + newline.length;
  }

  return pointers;
}

function isRspressFrontmatterPathTranslatable(pathSegments: string[]): boolean {
  const path = pathSegments.join('.');
  return (
    path === 'title'
    || path === 'description'
    || path === 'hero.name'
    || path === 'hero.text'
    || path === 'hero.tagline'
    || path === 'hero.actions.text'
    || path === 'features.title'
    || path === 'features.details'
  );
}
