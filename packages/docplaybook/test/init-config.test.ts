import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { detectWorkspaceSourceLanguage } from '../src/init/detect-language.ts';
import { getConfigPath, initWorkspaceConfig, loadConfig } from '../src/config.ts';
import { LocalFolderProvider } from '../src/providers/local-folder-provider.ts';

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
    path.join(root, '.docplaybook', 'memories', 'en.md'),
    ['# Translation Playbook', '', 'This internal memory file should be ignored by language detection.', ''].join('\n'),
    'utf8'
  );

  const detected = await detectWorkspaceSourceLanguage(root);

  assert.ok(detected);
  assert.equal(detected.language, 'zh-CN');
  assert.ok(detected.sampleFiles.includes('README.md'));
  assert.equal(detected.sampleFiles.includes('docs/guide.en.md'), false);
  assert.equal(detected.sampleFiles.includes('docs/guide.ja.md'), false);
  assert.equal(detected.sampleFiles.includes('.docplaybook/memories/en.md'), false);
});

test('detectWorkspaceSourceLanguage accepts README.mdx samples', async (t) => {
  const root = await createTempWorkspace('detect-language-mdx');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await fs.writeFile(
    path.join(root, 'README.mdx'),
    [
      "import { Callout } from './callout';",
      '',
      '# 欢迎使用',
      '',
      '<Callout type="tip">不要翻译组件名。</Callout>',
      '',
      '这是一个中文 MDX 项目说明文档，用来测试主语言识别功能是否会优先读取 README，而不是内部 memory 或目标语言文件。',
      '',
      '它包含安装、初始化、翻译、学习和 lint 等说明，整体内容都应该被判断为中文。',
      '',
      '## 使用方式',
      '',
      '先安装依赖，再执行初始化，然后根据需要运行 translate、learn 和 lint。',
      ''
    ].join('\n'),
    'utf8'
  );

  const detected = await detectWorkspaceSourceLanguage(root);

  assert.ok(detected);
  assert.equal(detected.language, 'zh-CN');
  assert.deepEqual(detected.sampleFiles, ['README.mdx']);
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
  assert.match(raw, /"targetLanguages": \["en","ja"]/);
  assert.match(raw, /"ignorePatterns": \["\*\*\/node_modules\/\*\*","\*\*\/\.git\/\*\*","\*\*\/dist\/\*\*","\*\*\/\.docplaybook\/\*\*"]/);
  assert.match(raw, /"maxConcurrentRequests": 6/);
  assert.match(raw, /"maxBlocksPerBatch": 8/);
});

test('loadConfig supports comments in .docplaybook/config.json', async (t) => {
  const root = await createTempWorkspace('config-comments');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await fs.mkdir(path.join(root, '.docplaybook'), { recursive: true });
  await fs.writeFile(
    path.join(root, '.docplaybook', 'config.json'),
    [
      '{',
      '  // Workspace translation settings',
      '  "version": 1,',
      '  "sourceLanguage": "zh-CN",',
      '  "targetLanguages": [',
      '    "en", // English docs',
      '    "ja"',
      '  ],',
      '  "layout": {',
      '    "kind": "sibling"',
      '  },',
      '  "model": {',
      '    "kind": "openai",',
      '    "model": "gpt-5-mini",',
      '    "apiKeyEnv": "OPENAI_API_KEY"',
      '  },',
      '  "ignorePatterns": [',
      '    "**/.docplaybook/**"',
      '  ]',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );

  const config = await loadConfig(root);

  assert.equal(config.sourceLanguage, 'zh-CN');
  assert.deepEqual(config.targetLanguages, ['en', 'ja']);
  assert.equal(config.model.kind, 'openai');
});

test('loadConfig resolves model config from env when config.json leaves it unlocked', async (t) => {
  const root = await createTempWorkspace('config-model-env');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const previousEnv = {
    DOCPLAYBOOK_MODEL_KIND: process.env.DOCPLAYBOOK_MODEL_KIND,
    DOCPLAYBOOK_MODEL: process.env.DOCPLAYBOOK_MODEL,
    DOCPLAYBOOK_MODEL_API_KEY_ENV: process.env.DOCPLAYBOOK_MODEL_API_KEY_ENV
  };
  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  process.env.DOCPLAYBOOK_MODEL_KIND = 'openai';
  process.env.DOCPLAYBOOK_MODEL = 'gpt-5-mini';
  process.env.DOCPLAYBOOK_MODEL_API_KEY_ENV = 'OPENAI_API_KEY';

  await fs.mkdir(path.join(root, '.docplaybook'), { recursive: true });
  await fs.writeFile(
    path.join(root, '.docplaybook', 'config.json'),
    [
      '{',
      '  "version": 1,',
      '  "sourceLanguage": "zh-CN",',
      '  "targetLanguages": ["en"],',
      '  "ignorePatterns": ["**/.docplaybook/**"],',
      '  "layout": {',
      '    "kind": "sibling"',
      '  }',
      '  // Model config is resolved from local env for this workspace.',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );

  const config = await loadConfig(root);

  assert.equal(config.model.kind, 'openai');
  assert.equal(config.model.model, 'gpt-5-mini');
});

test('loadConfig rejects legacy watch.ignore config', async (t) => {
  const root = await createTempWorkspace('reject-legacy-watch-ignore');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await fs.mkdir(path.join(root, '.docplaybook'), { recursive: true });
  await fs.writeFile(
    path.join(root, '.docplaybook', 'config.json'),
    [
      '{',
      '  "version": 1,',
      '  "sourceLanguage": "zh-CN",',
      '  "targetLanguages": ["en"],',
      '  "layout": { "kind": "sibling" },',
      '  "model": {',
      '    "kind": "openai",',
      '    "model": "gpt-5-mini"',
      '  },',
      '  "watch": {',
      '    "ignore": ["**/.docplaybook/**"]',
      '  }',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );

  await assert.rejects(() => loadConfig(root), /Invalid docplaybook config|Unrecognized key/);
});

test('LocalFolderProvider applies .gitignore rules in addition to ignorePatterns', async (t) => {
  const root = await createTempWorkspace('gitignore-defaults');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await fs.writeFile(path.join(root, '.gitignore'), 'ignored-docs/\n*.secret.md\n', 'utf8');
  await fs.mkdir(path.join(root, 'ignored-docs'), { recursive: true });
  await fs.mkdir(path.join(root, 'docs'), { recursive: true });
  await fs.writeFile(path.join(root, 'ignored-docs', 'a.md'), '# hidden\n', 'utf8');
  await fs.writeFile(path.join(root, 'docs', 'guide.secret.md'), '# hidden too\n', 'utf8');
  await fs.writeFile(path.join(root, 'docs', 'guide.md'), '# visible\n', 'utf8');
  await fs.writeFile(path.join(root, 'docs', 'guide.mdx'), '# visible mdx\n', 'utf8');

  const provider = new LocalFolderProvider(root, []);
  const files = await provider.scanMarkdownFiles();

  assert.deepEqual(files, ['docs/guide.md', 'docs/guide.mdx']);
});
