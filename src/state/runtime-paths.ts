import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256 } from '../utils.js';

function defaultRuntimeHome(): string {
  if (process.env.DOCPLAYBOOK_HOME) {
    return process.env.DOCPLAYBOOK_HOME;
  }

  if (process.env.TRANSLATOR_AGENT_HOME) {
    return process.env.TRANSLATOR_AGENT_HOME;
  }

  const home = os.homedir();
  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'docplaybook');
    case 'win32':
      return path.join(process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local'), 'docplaybook');
    default:
      return path.join(process.env.XDG_STATE_HOME ?? path.join(home, '.local', 'state'), 'docplaybook');
  }
}

export async function getWorkspaceRuntimeDir(workspaceRoot: string): Promise<string> {
  const resolvedRoot = await fs.realpath(workspaceRoot);
  return path.join(defaultRuntimeHome(), 'workspaces', sha256(resolvedRoot).slice(0, 16));
}

export async function getWorkspaceStatePath(workspaceRoot: string): Promise<string> {
  return path.join(await getWorkspaceRuntimeDir(workspaceRoot), 'state.json');
}
