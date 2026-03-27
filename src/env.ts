import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { pathExists } from './utils.js';

export const WORKSPACE_ENV_LOCAL_FILENAME = '.env.docplaybook.local';

const ENV_FILENAMES = [
  WORKSPACE_ENV_LOCAL_FILENAME,
  '.env.docplaybook',
  '.env.translator-agent.local',
  '.env.translator-agent',
  '.env.local',
  '.env'
];

function escapeEnvKey(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatEnvValue(value: string): string {
  return JSON.stringify(value);
}

export async function loadWorkspaceEnv(workspaceRoot: string): Promise<void> {
  for (const filename of ENV_FILENAMES) {
    const envPath = path.join(workspaceRoot, filename);
    if (await pathExists(envPath)) {
      loadDotenv({
        path: envPath,
        override: false,
        quiet: true
      });
    }
  }
}

export function getWorkspaceLocalEnvPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, WORKSPACE_ENV_LOCAL_FILENAME);
}

export async function writeWorkspaceEnvValues(
  workspaceRoot: string,
  values: Record<string, string>
): Promise<string> {
  const envPath = getWorkspaceLocalEnvPath(workspaceRoot);
  const raw = (await pathExists(envPath)) ? await fs.readFile(envPath, 'utf8') : '';
  const lines = raw.length > 0 ? raw.replace(/\r\n/g, '\n').trimEnd().split('\n') : [];

  for (const [key, value] of Object.entries(values)) {
    const rendered = `${key}=${formatEnvValue(value)}`;
    const matcher = new RegExp(`^\\s*(?:export\\s+)?${escapeEnvKey(key)}=`);
    const index = lines.findIndex((line) => matcher.test(line));

    if (index >= 0) {
      lines[index] = rendered;
    } else {
      lines.push(rendered);
    }
  }

  const nextRaw = `${lines.join('\n')}\n`;
  await fs.writeFile(envPath, nextRaw, 'utf8');
  return envPath;
}
