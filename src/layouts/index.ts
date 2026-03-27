import path from 'node:path';
import type { AppConfig, DocSet, DocumentRef, LayoutKind } from '../types.js';
import { assertNever, sha256 } from '../utils.js';

export interface LayoutAdapter {
  kind: LayoutKind;
  buildDocSets(files: string[], workspaceRoot: string, config: AppConfig): DocSet[];
}

class SiblingLayoutAdapter implements LayoutAdapter {
  public readonly kind = 'sibling';

  public buildDocSets(files: string[], workspaceRoot: string, config: AppConfig): DocSet[] {
    const fileSet = new Set(files);
    const docSets: DocSet[] = [];

    for (const relativePath of files) {
      if (!relativePath.endsWith('.md')) {
        continue;
      }

      if (this.detectTargetLanguage(relativePath, config.targetLanguages)) {
        continue;
      }

      const docKey = relativePath.slice(0, -'.md'.length);
      const source: DocumentRef = {
        language: config.sourceLanguage,
        relativePath,
        absolutePath: path.join(workspaceRoot, relativePath),
        isSource: true,
        exists: true
      };

      const targets = Object.fromEntries(
        config.targetLanguages.map((language) => {
          const targetRelativePath = `${docKey}.${language}.md`;
          const target: DocumentRef = {
            language,
            relativePath: targetRelativePath,
            absolutePath: path.join(workspaceRoot, targetRelativePath),
            isSource: false,
            exists: fileSet.has(targetRelativePath)
          };
          return [language, target];
        })
      );

      docSets.push({
        id: sha256(docKey).slice(0, 16),
        docKey,
        source,
        targets
      });
    }

    return docSets.sort((left, right) => left.docKey.localeCompare(right.docKey));
  }

  private detectTargetLanguage(relativePath: string, targetLanguages: string[]): string | null {
    for (const language of targetLanguages) {
      if (relativePath.endsWith(`.${language}.md`)) {
        return language;
      }
    }

    return null;
  }
}

class UnimplementedLayoutAdapter implements LayoutAdapter {
  public constructor(public readonly kind: LayoutKind) {}

  public buildDocSets(): DocSet[] {
    throw new Error(
      `Layout "${this.kind}" is reserved for a future preset. The first implementation only supports "sibling".`
    );
  }
}

export function createLayoutAdapter(kind: LayoutKind): LayoutAdapter {
  switch (kind) {
    case 'sibling':
      return new SiblingLayoutAdapter();
    case 'docusaurus':
      return new UnimplementedLayoutAdapter(kind);
    case 'rspress':
      return new UnimplementedLayoutAdapter(kind);
    default:
      return assertNever(kind);
  }
}
