import path from 'node:path';
import type { AppConfig, DocSet, DocumentRef, LayoutKind } from '../types.js';
import { assertNever, sha256 } from '../utils.js';
import {
  isRspressI18nJsonPath,
  isRspressMetadataJsonPath,
  getSupportedMarkdownExtension,
  stripSupportedMarkdownExtension
} from '../markdown/files.js';

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
      const extension = getSupportedMarkdownExtension(relativePath);
      if (!extension) {
        continue;
      }

      if (this.detectTargetLanguage(relativePath, config.targetLanguages, extension)) {
        continue;
      }

      const docKey = stripSupportedMarkdownExtension(relativePath);
      const source: DocumentRef = {
        language: config.sourceLanguage,
        relativePath,
        absolutePath: path.join(workspaceRoot, relativePath),
        isSource: true,
        exists: true
      };

      const targets = Object.fromEntries(
        config.targetLanguages.map((language) => {
          const targetRelativePath = `${docKey}.${language}${extension}`;
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

  private detectTargetLanguage(
    relativePath: string,
    targetLanguages: string[],
    extension: string
  ): string | null {
    for (const language of targetLanguages) {
      if (relativePath.endsWith(`.${language}${extension}`)) {
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
      const extension = getSupportedMarkdownExtension(relativePath);
      const isRspressJson = isRspressMetadataJsonPath(relativePath);
      if (!relativePath.startsWith('docs/') || (!extension && !isRspressJson)) {
        continue;
      }

      const docRelativePath = relativePath.slice('docs/'.length);
      const docKey = extension ? stripSupportedMarkdownExtension(relativePath) : relativePath;
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
      const extension = getSupportedMarkdownExtension(relativePath);
      const isRspressJson = isRspressMetadataJsonPath(relativePath);
      const isRspressI18n = isRspressI18nJsonPath(relativePath);
      if ((!relativePath.startsWith('docs/') && !isRspressI18n) || (!extension && !isRspressJson && !isRspressI18n)) {
        continue;
      }

      const docKey = extension ? stripSupportedMarkdownExtension(relativePath) : relativePath;
      const source: DocumentRef = {
        language: config.sourceLanguage,
        relativePath,
        absolutePath: path.join(workspaceRoot, relativePath),
        isSource: true,
        exists: true
      };

      let targets: Record<string, DocumentRef>;

      if (isRspressI18n) {
        targets = Object.fromEntries(
          config.targetLanguages.map((language) => {
            const target: DocumentRef = {
              language,
              relativePath,
              absolutePath: path.join(workspaceRoot, relativePath),
              isSource: false,
              exists: fileSet.has(relativePath)
            };
            return [language, target];
          })
        );
      } else {
        const docRelativePath = relativePath.slice('docs/'.length);
        const sourceDocRelativePath = this.getSourceDocRelativePath(docRelativePath, config.sourceLanguage);
        if (!sourceDocRelativePath) {
          continue;
        }

        targets = Object.fromEntries(
          config.targetLanguages.map((language) => {
            const targetRelativePath = path.posix.join('docs', language, sourceDocRelativePath);
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
      }

      docSets.push({
        id: sha256(docKey).slice(0, 16),
        docKey,
        source,
        targets
      });
    }

    return docSets.sort((left, right) => left.docKey.localeCompare(right.docKey));
  }

  private getSourceDocRelativePath(docRelativePath: string, sourceLanguage: string): string | null {
    const [firstSegment, ...restSegments] = docRelativePath.split('/');
    if (firstSegment !== sourceLanguage) {
      return null;
    }

    const remaining = restSegments.join('/');
    return remaining.length > 0 ? remaining : path.posix.basename(docRelativePath);
  }
}

class VitePressLayoutAdapter implements LayoutAdapter {
  public readonly kind = 'vitepress';

  public buildDocSets(files: string[], workspaceRoot: string, config: AppConfig): DocSet[] {
    const fileSet = new Set(files);
    const docSets: DocSet[] = [];

    for (const relativePath of files) {
      const extension = getSupportedMarkdownExtension(relativePath);
      if (!relativePath.startsWith('docs/') || !extension) {
        continue;
      }

      const docRelativePath = relativePath.slice('docs/'.length);
      if (this.detectTargetLanguage(docRelativePath, config.targetLanguages)) {
        continue;
      }

      const docKey = stripSupportedMarkdownExtension(relativePath);
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
    case 'vitepress':
      return new VitePressLayoutAdapter();
    default:
      return assertNever(kind);
  }
}
