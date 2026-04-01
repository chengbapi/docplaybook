import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseGitStatusPorcelainZ, readGitHeadFile } from '../src/git/changed-files.js';

const execFileAsync = promisify(execFile);

test('parseGitStatusPorcelainZ parses modified, untracked, and renamed paths', () => {
  const raw = [' M README.ja.md', '\0', '?? docs/new.en.md', '\0', 'R  old.md', '\0', 'docs/renamed.md', '\0'].join('');
  const changed = parseGitStatusPorcelainZ(raw);

  assert.deepEqual(
    [...changed].sort(),
    ['README.ja.md', 'docs/new.en.md', 'docs/renamed.md']
  );
});

test('readGitHeadFile reads committed file content from HEAD', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'docplaybook-git-head-'));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await execFileAsync('git', ['-C', root, 'init'], { encoding: 'utf8' });
  await execFileAsync('git', ['-C', root, 'config', 'user.email', 'docplaybook@example.com'], { encoding: 'utf8' });
  await execFileAsync('git', ['-C', root, 'config', 'user.name', 'Docplaybook Test'], { encoding: 'utf8' });
  await fs.writeFile(path.join(root, 'README.md'), '# first\n', 'utf8');
  await execFileAsync('git', ['-C', root, 'add', '.'], { encoding: 'utf8' });
  await execFileAsync('git', ['-C', root, 'commit', '-m', 'init'], { encoding: 'utf8' });

  await fs.writeFile(path.join(root, 'README.md'), '# second\n', 'utf8');

  const head = await readGitHeadFile(root, 'README.md');
  assert.equal(head, '# first\n');
});
