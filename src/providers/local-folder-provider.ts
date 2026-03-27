import { promises as fs } from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import picomatch from 'picomatch';
import type { ProviderEvent } from '../types.js';
import { pathExists } from '../utils.js';

export class LocalFolderProvider {
  public constructor(
    private readonly workspaceRoot: string,
    private readonly ignorePatterns: string[]
  ) {}

  public async scanMarkdownFiles(): Promise<string[]> {
    const files: string[] = [];
    await this.scanDir(this.workspaceRoot, files);
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
    const ignored = this.createIgnoreMatcher();
    const watcher = chokidar.watch(this.workspaceRoot, {
      ignored: (watchedPath) => ignored(this.toRelativePath(watchedPath)),
      ignoreInitial: true,
      persistent: true
    });

    watcher.on('all', (kind, absolutePath) => {
      const relativePath = this.toRelativePath(absolutePath);
      if (!relativePath.endsWith('.md')) {
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

  private async scanDir(dir: string, files: string[]): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      const relativePath = this.toRelativePath(absolutePath);

      if (this.createIgnoreMatcher()(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.scanDir(absolutePath, files);
        continue;
      }

      if (entry.isFile() && relativePath.endsWith('.md')) {
        files.push(relativePath);
      }
    }
  }

  private createIgnoreMatcher(): (relativePath: string) => boolean {
    const matchers = this.ignorePatterns.map((pattern) => picomatch(pattern, { dot: true }));
    return (relativePath: string) => {
      if (!relativePath || relativePath === '.') {
        return false;
      }

      return matchers.some((matcher) => matcher(relativePath));
    };
  }

  private toRelativePath(absolutePath: string): string {
    const relative = path.relative(this.workspaceRoot, absolutePath);
    return relative === '' ? '.' : relative.split(path.sep).join('/');
  }
}
