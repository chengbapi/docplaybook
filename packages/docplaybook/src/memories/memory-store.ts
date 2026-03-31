import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getMemoriesDir, getPlaybookPath } from '../config.js';
import {
  normalizeMemoryText,
  normalizePlaybookText,
  renderInitialMemory,
  renderInitialPlaybook
} from './template.js';
import { ensureDir, pathExists } from '../utils.js';

export class MemoryStore {
  public constructor(private readonly workspaceRoot: string) {}

  public getMemoryPath(targetLanguage: string): string {
    return path.join(getMemoriesDir(this.workspaceRoot), `${targetLanguage}.md`);
  }

  public getPlaybookPath(): string {
    return getPlaybookPath(this.workspaceRoot);
  }

  public async readPlaybook(): Promise<string> {
    const playbookPath = this.getPlaybookPath();
    if (!(await pathExists(playbookPath))) {
      await this.writePlaybook(renderInitialPlaybook());
    }

    return fs.readFile(playbookPath, 'utf8');
  }

  public async writePlaybook(content: string): Promise<void> {
    const playbookPath = this.getPlaybookPath();
    await ensureDir(path.dirname(playbookPath));
    const normalizedPlaybook = this.normalizePlaybook(content).text;
    const normalized = normalizedPlaybook.endsWith('\n') ? normalizedPlaybook : `${normalizedPlaybook}\n`;
    await fs.writeFile(playbookPath, normalized, 'utf8');
  }

  public async read(targetLanguage: string): Promise<string> {
    const memoryPath = this.getMemoryPath(targetLanguage);
    if (!(await pathExists(memoryPath))) {
      await this.write(targetLanguage, renderInitialMemory(targetLanguage));
    }

    return fs.readFile(memoryPath, 'utf8');
  }

  public async write(targetLanguage: string, content: string): Promise<void> {
    const memoryPath = this.getMemoryPath(targetLanguage);
    await ensureDir(path.dirname(memoryPath));
    const normalizedMemory = normalizeMemoryText(targetLanguage, content).text;
    const normalized = normalizedMemory.endsWith('\n') ? normalizedMemory : `${normalizedMemory}\n`;
    await fs.writeFile(memoryPath, normalized, 'utf8');
  }

  public normalize(targetLanguage: string, content: string): { text: string; addedSections: string[] } {
    return normalizeMemoryText(targetLanguage, content);
  }

  public normalizePlaybook(content: string): { text: string; addedSections: string[] } {
    return normalizePlaybookText(content);
  }

  public composePromptContext(playbookText: string, memoryText: string, targetLanguage: string): string {
    return [
      '# Global Playbook',
      '',
      playbookText.trim(),
      '',
      `# ${targetLanguage} Memory`,
      '',
      memoryText.trim()
    ].join('\n');
  }

  public async readPromptContext(targetLanguage: string): Promise<string> {
    const [playbookText, memoryText] = await Promise.all([
      this.readPlaybook(),
      this.read(targetLanguage)
    ]);

    return this.composePromptContext(playbookText, memoryText, targetLanguage);
  }
}
