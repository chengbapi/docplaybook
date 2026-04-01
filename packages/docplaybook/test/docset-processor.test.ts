import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { initWorkspaceConfig } from '../src/config.ts';
import { getLearnedTargetHashesPath, getSourceHashesPath } from '../src/config.ts';
import { createLayoutAdapter } from '../src/layouts/index.ts';
import { MemoryStore } from '../src/memories/memory-store.ts';
import { LocalFolderProvider } from '../src/providers/local-folder-provider.ts';
import { DocSetProcessor } from '../src/service/docset-processor.ts';
import type { AppConfig, BootstrapExample, DocSet, LearnCandidate, LearnJudgement, TranslationContext } from '../src/types.ts';
import type { Translator } from '../src/translation/translator.ts';
import type { MemoryUpdater } from '../src/translation/memory-updater.ts';
import { sha256 } from '../src/utils.ts';

const execFileAsync = promisify(execFile);

function fakeUsage(totalTokens = 15): { inputTokens: number; outputTokens: number; totalTokens: number } {
  return {
    inputTokens: Math.max(0, totalTokens - 5),
    outputTokens: Math.min(5, totalTokens),
    totalTokens
  };
}

async function runGit(root: string, args: string[]): Promise<void> {
  await execFileAsync('git', ['-C', root, ...args], { encoding: 'utf8' });
}

async function initGitRepo(root: string): Promise<void> {
  await runGit(root, ['init']);
  await runGit(root, ['config', 'user.email', 'docplaybook@example.com']);
  await runGit(root, ['config', 'user.name', 'Docplaybook Test']);
}

async function commitAll(root: string, message: string): Promise<void> {
  await runGit(root, ['add', '.']);
  await runGit(root, ['commit', '-m', message]);
}

async function createTempWorkspace(testName: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `docplaybook-${testName}-`));
}

async function setupWorkspace(
  root: string,
  sourceRaw: string,
  targetRaw?: string
): Promise<AppConfig> {
  await fs.mkdir(path.join(root, 'docs'), { recursive: true });
  await fs.writeFile(path.join(root, 'docs/guide.md'), sourceRaw, 'utf8');
  if (targetRaw !== undefined) {
    await fs.writeFile(path.join(root, 'docs/guide.en.md'), targetRaw, 'utf8');
  }

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
  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  const files = await provider.scanMarkdownFiles();
  return adapter.buildDocSets(files, root, config)[0]!;
}

test('DocSetProcessor retranslates the full document when source hash changes', async (t) => {
  const root = await createTempWorkspace('state-translate');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await initGitRepo(root);
  const config = await setupWorkspace(
    root,
    ['# 欢迎', '', '第一段。', '', '第二段。', ''].join('\n'),
    ['# Welcome', '', 'First paragraph.', '', 'Second paragraph.', ''].join('\n')
  );
  await commitAll(root, 'initial docs');

  await fs.writeFile(
    path.join(root, 'docs/guide.md'),
    ['# 欢迎', '', '第一段。', '', '第二段（已更新）。', ''].join('\n'),
    'utf8'
  );

  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  const translatedBlocks: TranslationContext[] = [];
  let translateBatchCalls = 0;
  const translator = {
    async translateBlock(context: TranslationContext) {
      translatedBlocks.push(context);
      return {
        text: context.sourceBlock.includes('已更新') ? 'Second paragraph (updated).' : context.sourceBlock,
        usage: fakeUsage()
      };
    },
    async translateBlocks(input: { blocks: Array<{ index: number; sourceBlock: string }> }) {
      translateBatchCalls += 1;
      return {
        texts: input.blocks.map((block) =>
          block.sourceBlock.includes('已更新') ? 'Second paragraph (updated).' : block.sourceBlock
        ),
        usage: fakeUsage(20)
      };
    }
  } as unknown as Translator;
  const memoryUpdater = {
    async judgeLearnCandidates() {
      return { items: [], usage: fakeUsage(0) };
    },
    async mergeRules(input: { memoryText: string }) {
      return { text: input.memoryText, usage: fakeUsage(0) };
    },
    async bootstrapMemory(input: { memoryText: string }) {
      return { text: input.memoryText, usage: fakeUsage(0) };
    }
  } as unknown as MemoryUpdater;

  const processor = new DocSetProcessor(
    root,
    config,
    provider,
    translator,
    memoryUpdater,
    new Set<string>()
  );

  await processor.translateDocSet(await loadGuideDocSet(root, config), 'test', ['en']);

  const targetRaw = await fs.readFile(path.join(root, 'docs/guide.en.md'), 'utf8');
  assert.match(targetRaw, /^# 欢迎$/m);
  assert.match(targetRaw, /^第一段。$/m);
  assert.match(targetRaw, /^Second paragraph \(updated\)\.$/m);
  assert.equal(translatedBlocks.length, 0);
  assert.equal(translateBatchCalls, 1);
});

test('DocSetProcessor learns reusable rules from git-tracked translation edits', async (t) => {
  const root = await createTempWorkspace('git-learn');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await initGitRepo(root);
  const config = await setupWorkspace(
    root,
    ['# 欢迎', '', '使用知识库。', ''].join('\n'),
    ['# Welcome', '', 'Use Knowledge Base.', ''].join('\n')
  );
  await commitAll(root, 'initial docs');

  await fs.writeFile(
    path.join(root, 'docs/guide.en.md'),
    ['# Welcome', '', 'Use Wiki.', ''].join('\n'),
    'utf8'
  );

  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  let judgedCandidates: LearnCandidate[] = [];
  const memoryUpdater = {
    async judgeLearnCandidates(input: { candidates: LearnCandidate[] }) {
      judgedCandidates = input.candidates;
      const items: LearnJudgement[] = input.candidates.map((candidate) => ({
        docKey: candidate.docKey,
        blockIndex: candidate.blockIndex,
        shouldLearn: true,
        scope: 'memory',
        category: 'terminology',
        reason: 'Recurring product term.',
        proposedRule: 'Translate "知识库" as "Wiki".'
      }));
      return { items, usage: fakeUsage(20) };
    },
    async mergeRules(input: { memoryText: string; rules: string[] }) {
      return {
        text: `${input.memoryText.trim()}\n- ${input.rules.join('\n- ')}\n`,
        usage: fakeUsage(10)
      };
    },
    async bootstrapMemory(input: { memoryText: string }) {
      return { text: input.memoryText, usage: fakeUsage(0) };
    }
  } as unknown as MemoryUpdater;
  const translator = {
    async translateBlock() {
      return { text: '', usage: fakeUsage(0) };
    },
    async translateBlocks() {
      return { texts: [], usage: fakeUsage(0) };
    }
  } as unknown as Translator;

  const processor = new DocSetProcessor(
    root,
    config,
    provider,
    translator,
    memoryUpdater,
    new Set<string>()
  );

  await processor.learnWorkspace([await loadGuideDocSet(root, config)], ['en']);

  assert.equal(judgedCandidates.length, 1);
  assert.match(judgedCandidates[0]?.sourceDocument ?? '', /使用知识库。/);
  assert.match(judgedCandidates[0]?.targetDocument ?? '', /Use Wiki\./);

  const memory = await new MemoryStore(root).read('en');
  assert.match(memory, /Translate "知识库" as "Wiki"\./);
});

test('DocSetProcessor bootstrap builds playbook and memory from aligned docs only', async (t) => {
  const root = await createTempWorkspace('bootstrap');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const config = await setupWorkspace(
    root,
    ['# 欢迎', '', '使用知识库。', ''].join('\n'),
    ['# Welcome', '', 'Use Wiki.', ''].join('\n')
  );

  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  const seenExamples: Array<{ scope: 'playbook' | 'memory'; examples: BootstrapExample[] }> = [];
  const memoryUpdater = {
    async judgeLearnCandidates() {
      return { items: [], usage: fakeUsage(0) };
    },
    async mergeRules(input: { memoryText: string }) {
      return { text: input.memoryText, usage: fakeUsage(0) };
    },
    async bootstrapMemory(input: {
      scope: 'playbook' | 'memory';
      memoryText: string;
      examples: BootstrapExample[];
    }) {
      seenExamples.push({ scope: input.scope, examples: input.examples });
      return {
        text: input.scope === 'playbook'
          ? '# Playbook\n\n## Translation Rules\n\n- Preserve project terminology.\n'
          : '# Memory: en\n\n## Terminology\n\n- 知识库 -> Wiki\n',
        usage: fakeUsage(12)
      };
    }
  } as unknown as MemoryUpdater;
  const translator = {
    async translateBlock() {
      return { text: '', usage: fakeUsage(0) };
    },
    async translateBlocks() {
      return { texts: [], usage: fakeUsage(0) };
    }
  } as unknown as Translator;

  const processor = new DocSetProcessor(
    root,
    config,
    provider,
    translator,
    memoryUpdater,
    new Set<string>()
  );

  await processor.bootstrapWorkspace([await loadGuideDocSet(root, config)], ['en']);

  assert.equal(seenExamples.length, 2);
  assert.equal(seenExamples[0]?.examples[0]?.pairs[0]?.sourceBlock.trim(), '# 欢迎');
  assert.equal(seenExamples[0]?.examples[0]?.pairs[1]?.targetBlock.trim(), 'Use Wiki.');

  const playbook = await new MemoryStore(root).readPlaybook();
  const memory = await new MemoryStore(root).read('en');
  assert.match(playbook, /Preserve project terminology/);
  assert.match(memory, /知识库 -> Wiki/);
});

test('DocSetProcessor bootstrap uses all aligned docs by default when no limit is provided', async (t) => {
  const root = await createTempWorkspace('bootstrap-all-default');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await fs.mkdir(path.join(root, 'docs'), { recursive: true });
  await fs.writeFile(path.join(root, 'docs/guide.md'), '# 欢迎\n\n使用知识库。\n', 'utf8');
  await fs.writeFile(path.join(root, 'docs/faq.md'), '# 常见问题\n\n查看空间。\n', 'utf8');
  await fs.writeFile(path.join(root, 'docs/guide.en.md'), '# Welcome\n\nUse Wiki.\n', 'utf8');
  await fs.writeFile(path.join(root, 'docs/faq.en.md'), '# FAQ\n\nView the space.\n', 'utf8');

  await initGitRepo(root);

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

  const config: AppConfig = {
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

  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  const adapter = createLayoutAdapter('sibling');
  const docSets = adapter.buildDocSets(await provider.scanMarkdownFiles(), root, config);
  let exampleCount = 0;

  const memoryUpdater = {
    async judgeLearnCandidates() {
      return { items: [], usage: fakeUsage(0) };
    },
    async mergeRules(input: { memoryText: string }) {
      return { text: input.memoryText, usage: fakeUsage(0) };
    },
    async bootstrapMemory(input: {
      scope: 'playbook' | 'memory';
      memoryText: string;
      examples: BootstrapExample[];
    }) {
      exampleCount = Math.max(exampleCount, input.examples.length);
      return {
        text: input.memoryText,
        usage: fakeUsage(0)
      };
    }
  } as unknown as MemoryUpdater;
  const translator = {
    async translateBlock() {
      return { text: '', usage: fakeUsage(0) };
    },
    async translateBlocks() {
      return { texts: [], usage: fakeUsage(0) };
    }
  } as unknown as Translator;

  const processor = new DocSetProcessor(
    root,
    config,
    provider,
    translator,
    memoryUpdater,
    new Set<string>()
  );

  await processor.bootstrapWorkspace(docSets, ['en']);

  assert.equal(exampleCount, 2);
});

test('DocSetProcessor skips translation when saved source hash matches and target exists', async (t) => {
  const root = await createTempWorkspace('translate-skip-by-hash');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const sourceRaw = ['# 欢迎', '', '第一段。', ''].join('\n');
  const targetRaw = ['# Welcome', '', 'First paragraph.', ''].join('\n');
  const config = await setupWorkspace(root, sourceRaw, targetRaw);
  await fs.mkdir(path.dirname(getSourceHashesPath(root)), { recursive: true });
  await fs.writeFile(
    getSourceHashesPath(root),
    `${JSON.stringify({ 'docs/guide.en.md': sha256(sourceRaw) }, null, 2)}\n`,
    'utf8'
  );

  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  let translateCalls = 0;
  const translator = {
    async translateBlock() {
      translateCalls += 1;
      return { text: '', usage: fakeUsage(0) };
    },
    async translateBlocks() {
      translateCalls += 1;
      return { texts: [], usage: fakeUsage(0) };
    }
  } as unknown as Translator;
  const memoryUpdater = {
    async judgeLearnCandidates() {
      return { items: [], usage: fakeUsage(0) };
    },
    async mergeRules(input: { memoryText: string }) {
      return { text: input.memoryText, usage: fakeUsage(0) };
    },
    async bootstrapMemory(input: { memoryText: string }) {
      return { text: input.memoryText, usage: fakeUsage(0) };
    }
  } as unknown as MemoryUpdater;

  const processor = new DocSetProcessor(root, config, provider, translator, memoryUpdater, new Set<string>());
  await processor.translateDocSet(await loadGuideDocSet(root, config), 'test', ['en']);

  assert.equal(translateCalls, 0);
});

test('DocSetProcessor retranslates when force is enabled even if source hash matches', async (t) => {
  const root = await createTempWorkspace('translate-force-by-hash');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const sourceRaw = ['# 欢迎', '', '第一段。', ''].join('\n');
  const targetRaw = ['# Welcome', '', 'First paragraph.', ''].join('\n');
  const config = await setupWorkspace(root, sourceRaw, targetRaw);
  await fs.mkdir(path.dirname(getSourceHashesPath(root)), { recursive: true });
  await fs.writeFile(
    getSourceHashesPath(root),
    `${JSON.stringify({ 'docs/guide.en.md': sha256(sourceRaw) }, null, 2)}\n`,
    'utf8'
  );

  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  let translateCalls = 0;
  const translator = {
    async translateBlock(context: TranslationContext) {
      translateCalls += 1;
      return { text: context.sourceBlock, usage: fakeUsage(0) };
    },
    async translateBlocks(input: { blocks: Array<{ sourceBlock: string }> }) {
      translateCalls += 1;
      return { texts: input.blocks.map((block) => block.sourceBlock), usage: fakeUsage(0) };
    }
  } as unknown as Translator;
  const memoryUpdater = {
    async judgeLearnCandidates() {
      return { items: [], usage: fakeUsage(0) };
    },
    async mergeRules(input: { memoryText: string }) {
      return { text: input.memoryText, usage: fakeUsage(0) };
    },
    async bootstrapMemory(input: { memoryText: string }) {
      return { text: input.memoryText, usage: fakeUsage(0) };
    }
  } as unknown as MemoryUpdater;

  const processor = new DocSetProcessor(root, config, provider, translator, memoryUpdater, new Set<string>());
  await processor.translateDocSet(await loadGuideDocSet(root, config), 'test', ['en'], { force: true });

  assert.equal(translateCalls, 1);
});

test('DocSetProcessor skips learn when saved learned-target hash matches current target', async (t) => {
  const root = await createTempWorkspace('learn-skip-by-hash');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await initGitRepo(root);
  const config = await setupWorkspace(
    root,
    ['# 欢迎', '', '使用知识库。', ''].join('\n'),
    ['# Welcome', '', 'Use Knowledge Base.', ''].join('\n')
  );
  await commitAll(root, 'initial docs');

  await fs.writeFile(
    path.join(root, 'docs/guide.en.md'),
    ['# Welcome', '', 'Use Wiki.', ''].join('\n'),
    'utf8'
  );

  const currentTargetRaw = await fs.readFile(path.join(root, 'docs/guide.en.md'), 'utf8');
  await fs.mkdir(path.dirname(getLearnedTargetHashesPath(root)), { recursive: true });
  await fs.writeFile(
    getLearnedTargetHashesPath(root),
    `${JSON.stringify({ 'docs/guide.en.md': sha256(currentTargetRaw) }, null, 2)}\n`,
    'utf8'
  );

  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  let judgedCalls = 0;
  const memoryUpdater = {
    async judgeLearnCandidates() {
      judgedCalls += 1;
      return { items: [], usage: fakeUsage(0) };
    },
    async mergeRules(input: { memoryText: string }) {
      return { text: input.memoryText, usage: fakeUsage(0) };
    },
    async bootstrapMemory(input: { memoryText: string }) {
      return { text: input.memoryText, usage: fakeUsage(0) };
    }
  } as unknown as MemoryUpdater;
  const translator = {
    async translateBlock() {
      return { text: '', usage: fakeUsage(0) };
    },
    async translateBlocks() {
      return { texts: [], usage: fakeUsage(0) };
    }
  } as unknown as Translator;

  const processor = new DocSetProcessor(root, config, provider, translator, memoryUpdater, new Set<string>());
  await processor.learnWorkspace([await loadGuideDocSet(root, config)], ['en']);

  assert.equal(judgedCalls, 0);
});

test('DocSetProcessor relearns when force is enabled even if learned-target hash matches', async (t) => {
  const root = await createTempWorkspace('learn-force-by-hash');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await initGitRepo(root);
  const config = await setupWorkspace(
    root,
    ['# 欢迎', '', '使用知识库。', ''].join('\n'),
    ['# Welcome', '', 'Use Knowledge Base.', ''].join('\n')
  );
  await commitAll(root, 'initial docs');

  await fs.writeFile(
    path.join(root, 'docs/guide.en.md'),
    ['# Welcome', '', 'Use Wiki.', ''].join('\n'),
    'utf8'
  );

  const currentTargetRaw = await fs.readFile(path.join(root, 'docs/guide.en.md'), 'utf8');
  await fs.mkdir(path.dirname(getLearnedTargetHashesPath(root)), { recursive: true });
  await fs.writeFile(
    getLearnedTargetHashesPath(root),
    `${JSON.stringify({ 'docs/guide.en.md': sha256(currentTargetRaw) }, null, 2)}\n`,
    'utf8'
  );

  const provider = new LocalFolderProvider(root, config.ignorePatterns ?? []);
  let judgedCalls = 0;
  const memoryUpdater = {
    async judgeLearnCandidates(input: { candidates: LearnCandidate[] }) {
      judgedCalls += 1;
      const items: LearnJudgement[] = input.candidates.map((candidate) => ({
        docKey: candidate.docKey,
        blockIndex: candidate.blockIndex,
        shouldLearn: true,
        scope: 'memory',
        category: 'terminology',
        reason: 'Recurring product term.',
        proposedRule: 'Translate "知识库" as "Wiki".'
      }));
      return { items, usage: fakeUsage(0) };
    },
    async mergeRules(input: { memoryText: string; rules: string[] }) {
      return { text: `${input.memoryText}\n${input.rules.join('\n')}`, usage: fakeUsage(0) };
    },
    async bootstrapMemory(input: { memoryText: string }) {
      return { text: input.memoryText, usage: fakeUsage(0) };
    }
  } as unknown as MemoryUpdater;
  const translator = {
    async translateBlock() {
      return { text: '', usage: fakeUsage(0) };
    },
    async translateBlocks() {
      return { texts: [], usage: fakeUsage(0) };
    }
  } as unknown as Translator;

  const processor = new DocSetProcessor(root, config, provider, translator, memoryUpdater, new Set<string>());
  await processor.learnWorkspace([await loadGuideDocSet(root, config)], ['en'], { force: true });

  assert.equal(judgedCalls, 1);
});
