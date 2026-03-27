import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { detectWorkspaceSourceLanguage } from '../src/init/detect-language.ts';
import { getConfigPath, initWorkspaceConfig, loadConfig } from '../src/config.ts';

async function createTempWorkspace(testName: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `docplaybook-init-${testName}-`));
}

test('detectWorkspaceSourceLanguage prefers workspace markdown and detects Chinese README', async (t) => {
  const root = await createTempWorkspace('detect-language');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await fs.writeFile(
    path.join(root, 'README.md'),
    ['# 欢迎使用', '', '这是一个中文项目说明，用来测试主语言识别。', '', '支持安装、配置和使用方式。', ''].join('\n'),
    'utf8'
  );
  await fs.mkdir(path.join(root, 'docs'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'docs/guide.en.md'),
    ['# English guide', '', 'This file should not be used as the source-language sample.', ''].join('\n'),
    'utf8'
  );
  await fs.writeFile(
    path.join(root, 'docs/guide.ja.md'),
    ['# Japanese guide', '', 'このファイルは主言語の判定サンプルに含めるべきではありません。', ''].join('\n'),
    'utf8'
  );
  await fs.mkdir(path.join(root, '.docplaybook', 'memories'), { recursive: true });
  await fs.writeFile(
    path.join(root, '.docplaybook', 'memories', 'zh-CN__en.md'),
    ['# Translation Playbook', '', 'This internal memory file should be ignored by language detection.', ''].join('\n'),
    'utf8'
  );

  const detected = await detectWorkspaceSourceLanguage(root);

  assert.ok(detected);
  assert.equal(detected.language, 'zh-CN');
  assert.ok(detected.sampleFiles.includes('README.md'));
  assert.equal(detected.sampleFiles.includes('docs/guide.en.md'), false);
  assert.equal(detected.sampleFiles.includes('docs/guide.ja.md'), false);
  assert.equal(detected.sampleFiles.includes('.docplaybook/memories/zh-CN__en.md'), false);
});

test('initWorkspaceConfig merges target languages on repeated init', async (t) => {
  const root = await createTempWorkspace('merge-targets');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await initWorkspaceConfig({
    workspaceRoot: root,
    sourceLanguage: 'zh-CN',
    targetLanguages: ['en'],
    layoutKind: 'sibling',
    model: {
      kind: 'gateway',
      model: 'openai/gpt-5-mini',
      apiKeyEnv: 'AI_GATEWAY_API_KEY'
    },
    force: true
  });

  await initWorkspaceConfig({
    workspaceRoot: root,
    sourceLanguage: 'zh-CN',
    targetLanguages: ['ja'],
    layoutKind: 'sibling',
    model: {
      kind: 'openai',
      model: 'gpt-5-mini',
      apiKeyEnv: 'OPENAI_API_KEY'
    }
  });

  const config = await loadConfig(root);
  assert.deepEqual(config.targetLanguages, ['en', 'ja']);
  assert.equal(config.model.kind, 'gateway');

  const configPath = getConfigPath(root);
  const raw = await fs.readFile(configPath, 'utf8');
  assert.match(raw, /"targetLanguages": \[\n    "en",\n    "ja"\n  ]/);
});
