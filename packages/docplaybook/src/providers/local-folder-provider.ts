import { promises as fs } from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import picomatch from 'picomatch';
import type { ProviderEvent } from '../types.js';
import { pathExists } from '../utils.js';
import { isSupportedMarkdownPath } from '../markdown/files.js';

export class LocalFolderProvider {
  private readonly ignoreMatcherPromise: Promise<(relativePath: string) => boolean>;

  public constructor(
    private readonly workspaceRoot: string,
    private readonly ignorePatterns: string[]
  ) {
    this.ignoreMatcherPromise = this.createIgnoreMatcher();
  }

  public async scanMarkdownFiles(): Promise<string[]> {
    const files: string[] = [];
    await this.scanDir(this.workspaceRoot, files, await this.ignoreMatcherPromise);
    return files;
  }

  public async read(relativePath: string): Promise<string> {
    return fs.readFile(path.join(this.workspaceRoot, relativePath), 'utf8');
  }

  public async write(relativePath: string, content: string): Promise<void> {
    const absolutePath = path.join(this.workspaceRoot, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');
  }

  public async exists(relativePath: string): Promise<boolean> {
    return pathExists(path.join(this.workspaceRoot, relativePath));
  }

  public async watch(
    onEvent: (event: ProviderEvent) => Promise<void> | void
  ): Promise<() => Promise<void>> {
    const ignored = await this.ignoreMatcherPromise;
    const watcher = chokidar.watch(this.workspaceRoot, {
      ignored: (watchedPath) => ignored(this.toRelativePath(watchedPath)),
      ignoreInitial: true,
      persistent: true
    });

    watcher.on('all', (kind, absolutePath) => {
      const relativePath = this.toRelativePath(absolutePath);
      if (!isSupportedMarkdownPath(relativePath)) {
        return;
      }

      void onEvent({
        kind: kind === 'add' || kind === 'change' || kind === 'unlink' ? kind : 'change',
        absolutePath,
        relativePath
      });
    });

    return async () => {
      await watcher.close();
    };
  }

  private async scanDir(
    dir: string,
    files: string[],
    ignored: (relativePath: string) => boolean
  ): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      const relativePath = this.toRelativePath(absolutePath);

      if (ignored(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.scanDir(absolutePath, files, ignored);
        continue;
      }

      if (entry.isFile() && isSupportedMarkdownPath(relativePath)) {
        files.push(relativePath);
      }
    }
  }

  private async createIgnoreMatcher(): Promise<(relativePath: string) => boolean> {
    const configuredPatterns = this.ignorePatterns.map((pattern) => ({
      negate: false,
      matcher: picomatch(pattern, { dot: true })
    }));
    const gitignorePatterns = await this.loadGitignoreMatchers();
    const rules = [...configuredPatterns, ...gitignorePatterns];

    return (relativePath: string) => {
      if (!relativePath || relativePath === '.') {
        return false;
      }

      let ignored = false;

      for (const rule of rules) {
        if (rule.matcher(relativePath)) {
          ignored = !rule.negate;
        }
      }

      return ignored;
    };
  }

  private async loadGitignoreMatchers(): Promise<Array<{
    negate: boolean;
    matcher: (relativePath: string) => boolean;
  }>> {
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    if (!(await pathExists(gitignorePath))) {
      return [];
    }

    const raw = await fs.readFile(gitignorePath, 'utf8');
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const rules: Array<{ negate: boolean; matcher: (relativePath: string) => boolean }> = [];

    for (const line of lines) {
      const normalized = line.trim();
      if (!normalized || normalized.startsWith('#')) {
        continue;
      }

      const negate = normalized.startsWith('!');
      const pattern = negate ? normalized.slice(1) : normalized;
      const globs = this.toGitignoreGlobs(pattern);

      for (const glob of globs) {
        rules.push({
          negate,
          matcher: picomatch(glob, { dot: true })
        });
      }
    }

    return rules;
  }

  private toGitignoreGlobs(pattern: string): string[] {
    const normalized = pattern.replace(/^\/+/, '');
    const directoryOnly = normalized.endsWith('/');
    const base = normalized.replace(/\/+$/, '');
    const hasSlash = base.includes('/');

    if (!base) {
      return [];
    }

    if (directoryOnly) {
      return hasSlash ? [`${base}/**`] : [`${base}/**`, `**/${base}/**`];
    }

    return hasSlash ? [base] : [base, `**/${base}`];
  }

  private toRelativePath(absolutePath: string): string {
    const relative = path.relative(this.workspaceRoot, absolutePath);
    return relative === '' ? '.' : relative.split(path.sep).join('/');
  }
}
