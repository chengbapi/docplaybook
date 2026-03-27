import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';

function runCli(
  args: string[],
  cwd: string,
  envOverrides: Record<string, string | undefined> = {}
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env };

    for (const [key, value] of Object.entries(envOverrides)) {
      if (value === undefined) {
        delete childEnv[key];
      } else {
        childEnv[key] = value;
      }
    }

    const child = spawn(
      process.execPath,
      ['--import', 'tsx', path.join(process.cwd(), 'src/cli.ts'), ...args],
      {
        cwd,
        env: childEnv,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test('CLI shows a friendly missing-config message without a stack trace', async (t) => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'docplaybook-cli-output-'));
  t.after(async () => {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  });

  const result = await runCli([workspaceRoot, '--once'], process.cwd());

  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /No docplaybook config was found for this workspace\./);
  assert.match(result.stderr, /docplaybook init/);
  assert.doesNotMatch(result.stderr, /\n\s+at\s+/);
  assert.doesNotMatch(result.stderr, /loadConfig/);
});

test('init saves config and skips the first translation when credentials are missing', async (t) => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'docplaybook-init-output-'));
  t.after(async () => {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  });

  await fs.writeFile(
    path.join(workspaceRoot, 'README.md'),
    ['# 欢迎', '', '这是一个测试 workspace。', ''].join('\n'),
    'utf8'
  );

  const result = await runCli(
    ['init', workspaceRoot, '--source', 'zh-CN', '--targets', 'en', '--model-kind', 'openai'],
    process.cwd(),
    {
      OPENAI_API_KEY: undefined,
      OPENAI_BASE_URL: undefined
    }
  );

  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Initialized docplaybook/);
  assert.match(result.stdout, /Skipped the first translation because required model credentials are not configured yet\./);
  assert.match(result.stdout, /OPENAI_API_KEY/);

  const configPath = path.join(workspaceRoot, 'docplaybook', 'config.json');
  const targetPath = path.join(workspaceRoot, 'README.en.md');

  assert.equal(await fs.stat(configPath).then(() => true, () => false), true);
  assert.equal(await fs.stat(targetPath).then(() => true, () => false), false);
});
