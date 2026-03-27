import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import type { RootContent } from 'mdast';
import type { DocumentSnapshot, MarkdownBlock } from '../types.js';
import { nowIso, sha256 } from '../utils.js';

const NON_TRANSLATABLE_TYPES = new Set([
  'code',
  'definition',
  'frontmatter',
  'html',
  'thematicBreak'
]);

interface FrontmatterSlice {
  raw: string;
  body: string;
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

function makeBlock(index: number, kind: string, prefix: string, raw: string): MarkdownBlock {
  return {
    index,
    kind,
    prefix,
    raw,
    translatable: isTranslatable(kind, raw),
    hash: sha256(raw)
  };
}

export function parseMarkdownSnapshot(relativePath: string, raw: string): DocumentSnapshot {
  const { raw: frontmatterRaw, body } = splitFrontmatter(raw);
  const blocks: MarkdownBlock[] = [];
  let tail = '';
  let blockIndex = 0;

  if (frontmatterRaw) {
    blocks.push(makeBlock(blockIndex, 'frontmatter', '', frontmatterRaw));
    blockIndex += 1;
  }

  if (body.length > 0) {
    const tree = fromMarkdown(body, {
      extensions: [gfm()],
      mdastExtensions: [gfmFromMarkdown()]
    });

    const children = tree.children.filter((child): child is RootContent & { position: NonNullable<RootContent['position']> } => {
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
    tail
  };
}

export function renderSnapshot(snapshot: DocumentSnapshot, blockRaws: string[]): string {
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
