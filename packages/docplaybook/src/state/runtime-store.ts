import { promises as fs } from 'node:fs';
import type { WorkspaceRuntimeState } from '../types.js';
import { ensureDir, nowIso, pathExists, sha256 } from '../utils.js';
import { getWorkspaceRuntimeDir, getWorkspaceStatePath } from './runtime-paths.js';

export class RuntimeStore {
  public constructor(private readonly workspaceRoot: string) {}

  public async load(): Promise<WorkspaceRuntimeState> {
    const statePath = await getWorkspaceStatePath(this.workspaceRoot);
    const runtimeDir = await getWorkspaceRuntimeDir(this.workspaceRoot);

    await ensureDir(runtimeDir);

    if (!(await pathExists(statePath))) {
      return {
        version: 1,
        workspaceId: sha256(this.workspaceRoot).slice(0, 16),
        updatedAt: nowIso(),
        docSets: {}
      };
    }

    const raw = await fs.readFile(statePath, 'utf8');
    return JSON.parse(raw) as WorkspaceRuntimeState;
  }

  public async save(state: WorkspaceRuntimeState): Promise<void> {
    const statePath = await getWorkspaceStatePath(this.workspaceRoot);
    const runtimeDir = await getWorkspaceRuntimeDir(this.workspaceRoot);
    await ensureDir(runtimeDir);
    await fs.writeFile(
      statePath,
      `${JSON.stringify({ ...state, updatedAt: nowIso() }, null, 2)}\n`,
      'utf8'
    );
  }
}
