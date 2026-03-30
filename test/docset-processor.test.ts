import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { initWorkspaceConfig } from '../src/config.ts';
import { createLayoutAdapter } from '../src/layouts/index.ts';
import { MemoryStore } from '../src/memories/memory-store.ts';
import { LocalFolderProvider } from '../src/providers/local-folder-provider.ts';
import { DocSetProcessor } from '../src/service/docset-processor.ts';
import { RuntimeStore } from '../src/state/runtime-store.ts';
import type {
  AppConfig,
  DocSet,
  ManualCorrection,
  TranslationContext
} from '../src/types.ts';
import type { Translator } from '../src/translation/translator.ts';
import type { MemoryUpdater } from '../src/translation/memory-updater.ts';

function translateMarkdownLikeModel(sourceBlock: string, prefix: string): string {
  if (sourceBlock.startsWith('# ')) {
    return `# ${prefix}${sourceBlock.slice(2)}`;
  }

  return `${prefix}${sourceBlock}`;
}

function fakeUsage(totalTokens = 15): { inputTokens: number; outputTokens: number; totalTokens: number } {
  return {
    inputTokens: Math.max(0, totalTokens - 5),
    outputTokens: Math.min(5, totalTokens),
    totalTokens
  };
}

async function createTempWorkspace(testName: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `docplaybook-${testName}-`));
}

async function setupWorkspace(root: string, sourceRaw: string): Promise<AppConfig> {
  await fs.mkdir(path.join(root, 'docs'), { recursive: true });
  await fs.writeFile(path.join(root, 'docs/guide.md'), sourceRaw, 'utf8');

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

  return {
    version: 1,
    sourceLanguage: 'zh-CN',
    targetLanguages: ['en'],
    layout: { kind: 'sibling' },
    model: {
      kind: 'gateway',
      model: 'openai/gpt-5-mini',
      apiKeyEnv: 'AI_GATEWAY_API_KEY'
    },
    ignorePatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.docplaybook/**']
  };
}

async function loadGuideDocSet(root: string, config: AppConfig): Promise<DocSet> {
  const adapter = createLayoutAdapter('sibling');
  const files = ['docs/guide.md'];
  return adapter.buildDocSets(files, root, config)[0]!;
}

async function loadReadmeDocSet(root: string, config: AppConfig): Promise<DocSet> {
  const adapter = createLayoutAdapter('sibling');
  const files = ['README.md'];
  return adapter.buildDocSets(files, root, config)[0]!;
}

test('DocSetProcessor creates translations while preserving non-translatable code blocks', async (t) => {
  const root = await createTempWorkspace('initial-sync');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const runtimeHome = path.join(root, '.runtime');
  const previousRuntimeHome = process.env.DOCPLAYBOOK_HOME;
  process.env.DOCPLAYBOOK_HOME = runtimeHome;
  t.after(() => {
    if (previousRuntimeHome === undefined) {
      delete process.env.DOCPLAYBOOK_HOME;
    } else {
      process.env.DOCPLAYBOOK_HOME = previousRuntimeHome;
    }
  });

  const config = await setupWorkspace(
    root,
    ['# 欢迎', '', '这是一段介绍。', '', '```ts', "console.log('keep me');", '```', ''].join('\n')
  );
  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  const runtimeStore = new RuntimeStore(root);
  const translatorCalls: TranslationContext[] = [];
  const memoryUpdateCalls: ManualCorrection[][] = [];

  const translator = {
    async translateBlock(context: TranslationContext): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      translatorCalls.push(context);
      return {
        text: translateMarkdownLikeModel(context.sourceBlock, 'EN:'),
        usage: fakeUsage()
      };
    },
    async translateBlocks(input: {
      blocks: Array<{ index: number; sourceBlock: string }>;
    }): Promise<{ texts: string[]; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      return {
        texts: input.blocks.map((block) => translateMarkdownLikeModel(block.sourceBlock, 'EN:')),
        usage: fakeUsage(30)
      };
    }
  } as unknown as Translator;

  const memoryUpdater = {
    async updateMemory(input: { memoryText: string; corrections: ManualCorrection[] }): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      memoryUpdateCalls.push(input.corrections);
      return {
        text: input.memoryText,
        usage: fakeUsage(0)
      };
    }
  } as unknown as MemoryUpdater;

  const processor = new DocSetProcessor(
    root,
    config,
    provider,
    runtimeStore,
    translator,
    memoryUpdater,
    new Set<string>()
  );

  const docSet = await loadGuideDocSet(root, config);
  await processor.processDocSet(docSet, 'startup');

  const targetRaw = await fs.readFile(path.join(root, 'docs/guide.en.md'), 'utf8');
  assert.match(targetRaw, /^# EN:欢迎$/m);
  assert.match(targetRaw, /^EN:这是一段介绍。$/m);
  assert.match(targetRaw, /console\.log\('keep me'\);/);
  assert.equal(translatorCalls.length, 0);
  assert.equal(memoryUpdateCalls.length, 0);
});

test('DocSetProcessor can bootstrap README translations for multiple target languages', async (t) => {
  const root = await createTempWorkspace('readme-bootstrap');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const runtimeHome = path.join(root, '.runtime');
  const previousRuntimeHome = process.env.DOCPLAYBOOK_HOME;
  process.env.DOCPLAYBOOK_HOME = runtimeHome;
  t.after(() => {
    if (previousRuntimeHome === undefined) {
      delete process.env.DOCPLAYBOOK_HOME;
    } else {
      process.env.DOCPLAYBOOK_HOME = previousRuntimeHome;
    }
  });

  await fs.writeFile(
    path.join(root, 'README.md'),
    ['# 欢迎', '', '这是项目说明。', ''].join('\n'),
    'utf8'
  );

  await initWorkspaceConfig({
    workspaceRoot: root,
    sourceLanguage: 'zh-CN',
    targetLanguages: ['en', 'ja'],
    layoutKind: 'sibling',
    model: {
      kind: 'gateway',
      model: 'openai/gpt-5-mini',
      apiKeyEnv: 'AI_GATEWAY_API_KEY'
    },
    force: true
  });

  const config: AppConfig = {
    version: 1,
    sourceLanguage: 'zh-CN',
    targetLanguages: ['en', 'ja'],
    layout: { kind: 'sibling' },
    model: {
      kind: 'gateway',
      model: 'openai/gpt-5-mini',
      apiKeyEnv: 'AI_GATEWAY_API_KEY'
    },
    ignorePatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.docplaybook/**']
  };

  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  const runtimeStore = new RuntimeStore(root);
  const translatorCalls: TranslationContext[] = [];

  const translator = {
    async translateBlock(context: TranslationContext): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      translatorCalls.push(context);
      return {
        text: translateMarkdownLikeModel(
          context.sourceBlock,
          `${context.targetLanguage.toUpperCase()}:`
        ),
        usage: fakeUsage()
      };
    },
    async translateBlocks(input: {
      blocks: Array<{ index: number; sourceBlock: string }>;
      targetLanguage: string;
    }): Promise<{ texts: string[]; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      return {
        texts: input.blocks.map((block) => translateMarkdownLikeModel(block.sourceBlock, `${input.targetLanguage.toUpperCase()}:`)),
        usage: fakeUsage(30)
      };
    }
  } as unknown as Translator;

  const memoryUpdater = {
    async updateMemory(input: { memoryText: string; corrections: ManualCorrection[] }): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      return {
        text: input.memoryText,
        usage: fakeUsage(0)
      };
    }
  } as unknown as MemoryUpdater;

  const processor = new DocSetProcessor(
    root,
    config,
    provider,
    runtimeStore,
    translator,
    memoryUpdater,
    new Set<string>()
  );

  const docSet = await loadReadmeDocSet(root, config);
  await processor.processDocSet(docSet, 'startup');

  const readmeEn = await fs.readFile(path.join(root, 'README.en.md'), 'utf8');
  const readmeJa = await fs.readFile(path.join(root, 'README.ja.md'), 'utf8');

  assert.match(readmeEn, /^# EN:欢迎$/m);
  assert.match(readmeEn, /^EN:这是项目说明。$/m);
  assert.match(readmeJa, /^# JA:欢迎$/m);
  assert.match(readmeJa, /^JA:这是项目说明。$/m);
  assert.equal(translatorCalls.length, 0);
});

test('DocSetProcessor learns from human corrections and uses updated memory on future syncs', async (t) => {
  const root = await createTempWorkspace('memory-learning');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const runtimeHome = path.join(root, '.runtime');
  const previousRuntimeHome = process.env.DOCPLAYBOOK_HOME;
  process.env.DOCPLAYBOOK_HOME = runtimeHome;
  t.after(() => {
    if (previousRuntimeHome === undefined) {
      delete process.env.DOCPLAYBOOK_HOME;
    } else {
      process.env.DOCPLAYBOOK_HOME = previousRuntimeHome;
    }
  });

  const config = await setupWorkspace(
    root,
    ['# 欢迎', '', '飞书知识库支持权限控制。', '', '第二段保持不变。', ''].join('\n')
  );
  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  const runtimeStore = new RuntimeStore(root);
  const translatorCalls: TranslationContext[] = [];
  const memoryUpdateCalls: ManualCorrection[][] = [];

  const translator = {
    async translateBlock(context: TranslationContext): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      translatorCalls.push(context);
      const hasLearnedWikiRule = context.memoryText.includes('Translate "知识库" as "Wiki"');
      return {
        text: hasLearnedWikiRule
          ? translateMarkdownLikeModel(context.sourceBlock, 'EN_WITH_MEMORY:')
          : translateMarkdownLikeModel(context.sourceBlock, 'EN:'),
        usage: fakeUsage()
      };
    },
    async translateBlocks(input: {
      blocks: Array<{ index: number; sourceBlock: string }>;
      memoryText: string;
    }): Promise<{ texts: string[]; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      const hasLearnedWikiRule = input.memoryText.includes('Translate "知识库" as "Wiki"');
      return {
        texts: input.blocks.map((block) =>
          hasLearnedWikiRule
            ? translateMarkdownLikeModel(block.sourceBlock, 'EN_WITH_MEMORY:')
            : translateMarkdownLikeModel(block.sourceBlock, 'EN:')
        ),
        usage: fakeUsage(30)
      };
    }
  } as unknown as Translator;

  const memoryUpdater = {
    async updateMemory(input: {
      memoryText: string;
      corrections: ManualCorrection[];
    }): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      memoryUpdateCalls.push(input.corrections);
      return {
        text: `${input.memoryText.trim()}\n- Translate "知识库" as "Wiki" for Feishu product docs.\n`,
        usage: fakeUsage(30)
      };
    }
  } as unknown as MemoryUpdater;

  const processor = new DocSetProcessor(
    root,
    config,
    provider,
    runtimeStore,
    translator,
    memoryUpdater,
    new Set<string>()
  );

  const docSet = await loadGuideDocSet(root, config);
  await processor.processDocSet(docSet, 'initial');

  const correctedTarget = [
    '# EN:欢迎',
    '',
    'Feishu Wiki supports permission control.',
    '',
    'EN:第二段保持不变。',
    ''
  ].join('\n');
  await fs.writeFile(path.join(root, 'docs/guide.en.md'), correctedTarget, 'utf8');

  await processor.processDocSet(docSet, 'manual-edit');

  assert.equal(memoryUpdateCalls.length, 1);
  assert.equal(memoryUpdateCalls[0]?.length, 1);
  assert.equal(memoryUpdateCalls[0]?.[0]?.correctedTranslation, 'Feishu Wiki supports permission control.');

  const memoryStore = new MemoryStore(root, 'zh-CN');
  const updatedMemory = await memoryStore.read('en');
  assert.match(updatedMemory, /Translate "知识库" as "Wiki"/);

  await fs.writeFile(
    path.join(root, 'docs/guide.md'),
    ['# 欢迎', '', '飞书知识库支持细粒度权限控制。', '', '第二段保持不变。', ''].join('\n'),
    'utf8'
  );

  await processor.processDocSet(docSet, 'source-change');

  assert.ok(
    translatorCalls.some(
      (call) =>
        call.sourceBlock.includes('飞书知识库支持细粒度权限控制。') &&
        call.memoryText.includes('Translate "知识库" as "Wiki"')
    )
  );

  const nextTargetRaw = await fs.readFile(path.join(root, 'docs/guide.en.md'), 'utf8');
  assert.match(nextTargetRaw, /EN_WITH_MEMORY:飞书知识库支持细粒度权限控制。/);
  assert.match(nextTargetRaw, /EN:第二段保持不变。/);
});

test('DocSetProcessor strips outer markdown fences before writing updated memory', async (t) => {
  const root = await createTempWorkspace('memory-fence-strip');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const runtimeHome = path.join(root, '.runtime');
  const previousRuntimeHome = process.env.DOCPLAYBOOK_HOME;
  process.env.DOCPLAYBOOK_HOME = runtimeHome;
  t.after(() => {
    if (previousRuntimeHome === undefined) {
      delete process.env.DOCPLAYBOOK_HOME;
    } else {
      process.env.DOCPLAYBOOK_HOME = previousRuntimeHome;
    }
  });

  const config = await setupWorkspace(
    root,
    ['# 欢迎', '', '飞书知识库支持权限控制。', ''].join('\n')
  );
  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  const runtimeStore = new RuntimeStore(root);

  const translator = {
    async translateBlock(context: TranslationContext): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      return {
        text: translateMarkdownLikeModel(context.sourceBlock, 'EN:'),
        usage: fakeUsage()
      };
    },
    async translateBlocks(input: {
      blocks: Array<{ index: number; sourceBlock: string }>;
    }): Promise<{ texts: string[]; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      return {
        texts: input.blocks.map((block) => translateMarkdownLikeModel(block.sourceBlock, 'EN:')),
        usage: fakeUsage(20)
      };
    }
  } as unknown as Translator;

  const memoryUpdater = {
    async updateMemory(): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      return {
        text: ['```md', '# Translation Playbook: zh-CN -> en', '', '- Translate "知识库" as "Wiki".', '```', ''].join('\n'),
        usage: fakeUsage(20)
      };
    }
  } as unknown as MemoryUpdater;

  const processor = new DocSetProcessor(
    root,
    config,
    provider,
    runtimeStore,
    translator,
    memoryUpdater,
    new Set<string>()
  );

  const docSet = await loadGuideDocSet(root, config);
  await processor.processDocSet(docSet, 'initial');

  await fs.writeFile(
    path.join(root, 'docs/guide.en.md'),
    ['# EN:欢迎', '', 'Feishu Wiki supports permission control.', ''].join('\n'),
    'utf8'
  );

  await processor.processDocSet(docSet, 'manual-edit');

  const memoryStore = new MemoryStore(root, 'zh-CN');
  const updatedMemory = await memoryStore.read('en');
  assert.doesNotMatch(updatedMemory, /```md/);
  assert.doesNotMatch(updatedMemory, /^```$/m);
  assert.match(updatedMemory, /Translate "知识库" as "Wiki"/);
});

test('DocSetProcessor skips memory generation for large manual rewrites', async (t) => {
  const root = await createTempWorkspace('skip-large-rewrites');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const runtimeHome = path.join(root, '.runtime');
  const previousRuntimeHome = process.env.DOCPLAYBOOK_HOME;
  process.env.DOCPLAYBOOK_HOME = runtimeHome;
  t.after(() => {
    if (previousRuntimeHome === undefined) {
      delete process.env.DOCPLAYBOOK_HOME;
    } else {
      process.env.DOCPLAYBOOK_HOME = previousRuntimeHome;
    }
  });

  const config = await setupWorkspace(
    root,
    [
      '# 标题',
      '',
      '第一段。',
      '',
      '第二段。',
      '',
      '第三段。',
      '',
      '第四段。',
      ''
    ].join('\n')
  );

  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  const runtimeStore = new RuntimeStore(root);
  const memoryUpdateCalls: ManualCorrection[][] = [];
  let warningCount = 0;
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warningCount += 1;
    originalWarn(...args);
  };
  t.after(() => {
    console.warn = originalWarn;
  });

  const translator = {
    async translateBlock(context: TranslationContext): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      return {
        text: translateMarkdownLikeModel(context.sourceBlock, 'EN:'),
        usage: fakeUsage()
      };
    },
    async translateBlocks(input: {
      blocks: Array<{ index: number; sourceBlock: string }>;
    }): Promise<{ texts: string[]; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      return {
        texts: input.blocks.map((block) => translateMarkdownLikeModel(block.sourceBlock, 'EN:')),
        usage: fakeUsage(30)
      };
    }
  } as unknown as Translator;

  const memoryUpdater = {
    async updateMemory(input: { memoryText: string; corrections: ManualCorrection[] }): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      memoryUpdateCalls.push(input.corrections);
      return {
        text: input.memoryText,
        usage: fakeUsage(0)
      };
    }
  } as unknown as MemoryUpdater;

  const processor = new DocSetProcessor(
    root,
    config,
    provider,
    runtimeStore,
    translator,
    memoryUpdater,
    new Set<string>()
  );

  const docSet = await loadGuideDocSet(root, config);
  await processor.processDocSet(docSet, 'initial');

  const rewrittenTarget = [
    'Custom heading rewrite',
    '',
    'Custom paragraph one rewrite.',
    '',
    'Custom paragraph two rewrite.',
    '',
    'Custom paragraph three rewrite.',
    '',
    'EN:第四段。',
    ''
  ].join('\n');
  await fs.writeFile(path.join(root, 'docs/guide.en.md'), rewrittenTarget, 'utf8');

  const memoryStore = new MemoryStore(root, 'zh-CN');
  const beforeMemory = await memoryStore.read('en');

  await processor.processDocSet(docSet, 'manual-rewrite');

  const afterMemory = await memoryStore.read('en');
  assert.equal(memoryUpdateCalls.length, 0);
  assert.equal(afterMemory, beforeMemory);
  assert.equal(warningCount, 0);

  const targetAfterSkip = await fs.readFile(path.join(root, 'docs/guide.en.md'), 'utf8');
  assert.equal(targetAfterSkip, rewrittenTarget);
});

test('DocSetProcessor strips outer markdown fences from translated blocks', async (t) => {
  const root = await createTempWorkspace('strip-markdown-fence');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const runtimeHome = path.join(root, '.runtime');
  const previousRuntimeHome = process.env.DOCPLAYBOOK_HOME;
  process.env.DOCPLAYBOOK_HOME = runtimeHome;
  t.after(() => {
    if (previousRuntimeHome === undefined) {
      delete process.env.DOCPLAYBOOK_HOME;
    } else {
      process.env.DOCPLAYBOOK_HOME = previousRuntimeHome;
    }
  });

  const config = await setupWorkspace(
    root,
    ['# 欢迎', '', '列表说明。', ''].join('\n')
  );
  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  const runtimeStore = new RuntimeStore(root);

  const translator = {
    async translateBlock(context: TranslationContext): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      return {
        text: ['```md', translateMarkdownLikeModel(context.sourceBlock, 'EN:'), '```'].join('\n'),
        usage: fakeUsage()
      };
    },
    async translateBlocks(input: {
      blocks: Array<{ index: number; sourceBlock: string }>;
    }): Promise<{ texts: string[]; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      return {
        texts: input.blocks.map((block) => ['```md', translateMarkdownLikeModel(block.sourceBlock, 'EN:'), '```'].join('\n')),
        usage: fakeUsage(30)
      };
    }
  } as unknown as Translator;

  const memoryUpdater = {
    async updateMemory(input: { memoryText: string; corrections: ManualCorrection[] }): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      return {
        text: input.memoryText,
        usage: fakeUsage(0)
      };
    }
  } as unknown as MemoryUpdater;

  const processor = new DocSetProcessor(
    root,
    config,
    provider,
    runtimeStore,
    translator,
    memoryUpdater,
    new Set<string>()
  );

  const docSet = await loadGuideDocSet(root, config);
  await processor.processDocSet(docSet, 'startup');

  const targetRaw = await fs.readFile(path.join(root, 'docs/guide.en.md'), 'utf8');
  assert.doesNotMatch(targetRaw, /```md/);
  assert.doesNotMatch(targetRaw, /^```$/m);
  assert.match(targetRaw, /^# EN:欢迎$/m);
});

test('DocSetProcessor translates one target article in a single model call', async (t) => {
  const root = await createTempWorkspace('batch-translation');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const runtimeHome = path.join(root, '.runtime');
  const previousRuntimeHome = process.env.DOCPLAYBOOK_HOME;
  process.env.DOCPLAYBOOK_HOME = runtimeHome;
  t.after(() => {
    if (previousRuntimeHome === undefined) {
      delete process.env.DOCPLAYBOOK_HOME;
    } else {
      process.env.DOCPLAYBOOK_HOME = previousRuntimeHome;
    }
  });

  const config = await setupWorkspace(
    root,
    ['# 标题', '', '第一段。', '', '第二段。', '', '第三段。', ''].join('\n')
  );
  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  const runtimeStore = new RuntimeStore(root);
  let singleCalls = 0;
  let batchCalls = 0;

  const translator = {
    async translateBlock(context: TranslationContext): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      singleCalls += 1;
      return {
        text: translateMarkdownLikeModel(context.sourceBlock, 'EN:'),
        usage: fakeUsage()
      };
    },
    async translateBlocks(input: {
      blocks: Array<{ index: number; sourceBlock: string }>;
    }): Promise<{ texts: string[]; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      batchCalls += 1;
      return {
        texts: input.blocks.map((block) => translateMarkdownLikeModel(block.sourceBlock, 'EN:')),
        usage: fakeUsage(40)
      };
    }
  } as unknown as Translator;

  const memoryUpdater = {
    async updateMemory(input: { memoryText: string; corrections: ManualCorrection[] }): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
      return {
        text: input.memoryText,
        usage: fakeUsage(0)
      };
    }
  } as unknown as MemoryUpdater;

  const processor = new DocSetProcessor(
    root,
    config,
    provider,
    runtimeStore,
    translator,
    memoryUpdater,
    new Set<string>()
  );

  const docSet = await loadGuideDocSet(root, config);
  await processor.processDocSet(docSet, 'startup');

  assert.equal(batchCalls, 1);
  assert.equal(singleCalls, 0);
});
