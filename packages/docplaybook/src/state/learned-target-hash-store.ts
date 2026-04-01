import { promises as fs } from 'node:fs';
import { getLearnedTargetHashesPath, getStateDir } from '../config.js';
import { ensureDir, pathExists } from '../utils.js';

export class LearnedTargetHashStore {
  private state: Record<string, string> | null = null;

  public constructor(private readonly workspaceRoot: string) {}

  public async get(key: string): Promise<string | undefined> {
    const state = await this.load();
    return state[key];
  }

  public async set(key: string, hash: string): Promise<void> {
    const state = await this.load();
    state[key] = hash;
    await this.save(state);
  }

  private async load(): Promise<Record<string, string>> {
    if (this.state) {
      return this.state;
    }

    const statePath = getLearnedTargetHashesPath(this.workspaceRoot);
    if (!(await pathExists(statePath))) {
      this.state = {};
      return this.state;
    }

    const raw = await fs.readFile(statePath, 'utf8');
    this.state = JSON.parse(raw) as Record<string, string>;
    return this.state;
  }

  private async save(state: Record<string, string>): Promise<void> {
    const stateDir = getStateDir(this.workspaceRoot);
    await ensureDir(stateDir);
    await fs.writeFile(getLearnedTargetHashesPath(this.workspaceRoot), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    this.state = state;
  }
}
