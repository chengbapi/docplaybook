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

class DocusaurusLayoutAdapter implements LayoutAdapter {
  public readonly kind = 'docusaurus';

  public buildDocSets(files: string[], workspaceRoot: string, config: AppConfig): DocSet[] {
    const fileSet = new Set(files);
    const docSets: DocSet[] = [];

    for (const relativePath of files) {
      if (!relativePath.startsWith('docs/') || !relativePath.endsWith('.md')) {
        continue;
      }

      const docRelativePath = relativePath.slice('docs/'.length);
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
          const targetRelativePath = path.posix.join(
            'i18n',
            language,
            'docusaurus-plugin-content-docs',
            'current',
            docRelativePath
          );

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
}

class RspressLayoutAdapter implements LayoutAdapter {
  public readonly kind = 'rspress';

  public buildDocSets(files: string[], workspaceRoot: string, config: AppConfig): DocSet[] {
    const fileSet = new Set(files);
    const docSets: DocSet[] = [];

    for (const relativePath of files) {
      if (!relativePath.startsWith('docs/') || !relativePath.endsWith('.md')) {
        continue;
      }

      const docRelativePath = relativePath.slice('docs/'.length);
      if (this.detectTargetLanguage(docRelativePath, config.targetLanguages)) {
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
          const targetRelativePath = path.posix.join('docs', language, docRelativePath);
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

  private detectTargetLanguage(docRelativePath: string, targetLanguages: string[]): string | null {
    const firstSegment = docRelativePath.split('/')[0] ?? '';

    for (const language of targetLanguages) {
      if (firstSegment === language) {
        return language;
      }
    }

    return null;
  }
}

export function createLayoutAdapter(kind: LayoutKind): LayoutAdapter {
  switch (kind) {
    case 'sibling':
      return new SiblingLayoutAdapter();
    case 'docusaurus':
      return new DocusaurusLayoutAdapter();
    case 'rspress':
      return new RspressLayoutAdapter();
    default:
      return assertNever(kind);
  }
}
