import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getMemoriesDir } from '../config.js';
import { ensureDir, pathExists } from '../utils.js';

export class MemoryStore {
  public constructor(
    private readonly workspaceRoot: string,
    private readonly sourceLanguage: string
  ) {}

  public getMemoryPath(targetLanguage: string): string {
    return path.join(
      getMemoriesDir(this.workspaceRoot),
      `${this.sourceLanguage}__${targetLanguage}.md`
    );
  }

  public async read(targetLanguage: string): Promise<string> {
    const memoryPath = this.getMemoryPath(targetLanguage);
    if (!(await pathExists(memoryPath))) {
      await this.write(
        targetLanguage,
        `# Translation Playbook: ${this.sourceLanguage} -> ${targetLanguage}\n\n`
      );
    }

    return fs.readFile(memoryPath, 'utf8');
  }

  public async write(targetLanguage: string, content: string): Promise<void> {
    const memoryPath = this.getMemoryPath(targetLanguage);
    await ensureDir(path.dirname(memoryPath));
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    await fs.writeFile(memoryPath, normalized, 'utf8');
  }
}
