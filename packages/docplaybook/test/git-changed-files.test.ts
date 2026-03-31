import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGitStatusPorcelainZ } from '../src/git/changed-files.js';

test('parseGitStatusPorcelainZ parses modified, untracked, and renamed paths', () => {
  const raw = [' M README.ja.md', '\0', '?? docs/new.en.md', '\0', 'R  old.md', '\0', 'docs/renamed.md', '\0'].join('');
  const changed = parseGitStatusPorcelainZ(raw);

  assert.deepEqual(
    [...changed].sort(),
    ['README.ja.md', 'docs/new.en.md', 'docs/renamed.md']
  );
});
