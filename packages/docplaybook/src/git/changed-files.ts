import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function getChangedWorkspaceFiles(workspaceRoot: string): Promise<Set<string> | null> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', workspaceRoot, 'status', '--porcelain=v1', '-z', '--untracked-files=all'],
      {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 8
      }
    );

    return parseGitStatusPorcelainZ(stdout);
  } catch {
    return null;
  }
}

export function parseGitStatusPorcelainZ(raw: string): Set<string> {
  const changed = new Set<string>();
  let index = 0;

  while (index < raw.length) {
    const status = raw.slice(index, index + 3);
    if (status.length < 3) {
      break;
    }

    index += 3;
    const nextNull = raw.indexOf('\0', index);
    if (nextNull === -1) {
      break;
    }

    const firstPath = raw.slice(index, nextNull);
    index = nextNull + 1;
    const code = status.slice(0, 2);

    if (code[0] === 'R' || code[0] === 'C') {
      const secondNull = raw.indexOf('\0', index);
      if (secondNull === -1) {
        break;
      }

      const renamedPath = raw.slice(index, secondNull);
      changed.add(normalizeGitPath(renamedPath));
      index = secondNull + 1;
      continue;
    }

    changed.add(normalizeGitPath(firstPath));
  }

  return changed;
}

function normalizeGitPath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/');
}
