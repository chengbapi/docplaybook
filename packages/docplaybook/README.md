# docplaybook

`docplaybook` 是一个面向 Markdown 文档翻译的 CLI 工具。

它会扫描一个 workspace，将文件归并为多个文档集合，基于仓库内的 state 跟踪源文和译文是否需要处理，按需执行增量翻译同步，并从当前 source/target 对照中学习可复用的翻译经验。

## 安装

全局安装：

```bash
pnpm add -g docplaybook
```

安装后可以直接使用：

```bash
docplaybook --help
docplaybook init ./my-docs
docplaybook ./my-docs
```

如果你不想全局安装，也可以直接用 `pnpm dlx`：

```bash
pnpm dlx docplaybook --help
pnpm dlx docplaybook init ./my-docs
pnpm dlx docplaybook ./my-docs
```

## 使用

初始化一个 workspace：

```bash
docplaybook init ./examples/sample-workspace
```

它会：

- 引导你选择模型 provider 和具体 model
- 完成所需凭证配置，并在准备好后做一次轻量连通性检查
- 自动识别项目布局。当前会识别 `docusaurus`、`rspress`、`vitepress`，否则回退到 `sibling`
- 自动识别主文档语言，并让你确认
- 提示输入 `en,ja` 这样的 target languages
- 创建 `.docplaybook` 目录以及初始化配置，不会立即开始翻译

如果之后想继续添加语言，可以在同一个 workspace 里再次执行：

```bash
docplaybook init ./examples/sample-workspace
```

如果你在 CI 或非交互环境里运行，也可以显式传入参数：

```bash
docplaybook init ./examples/sample-workspace --source zh-CN --targets en,ja
```

执行一次翻译：

```bash
docplaybook translate ./examples/sample-workspace
```

如果你的项目里已经有现成的译文，可以先从现有双语文档生成第一版经验库：

```bash
docplaybook bootstrap ./examples/sample-workspace --langs en,ja
```

只整理人工修改并更新 memory：

```bash
docplaybook learn ./examples/sample-workspace
```

默认执行：

```bash
docplaybook ./examples/sample-workspace
```

查看详细过程：

```bash
docplaybook ./examples/sample-workspace --verbose
```

查看底层调试信息，例如 prompt 大小、请求排队时间和模型调用状态：

```bash
docplaybook ./examples/sample-workspace --debug
```

## Langfuse 可观测性

如果你想持续观察翻译效果和执行过程，可以为 `translate` 流程开启可选的 `Langfuse` tracing。

默认情况下它是关闭的。只有在显式设置 `DOCPLAYBOOK_LANGFUSE_ENABLED=true` 时才会启用。

最小配置示例（Langfuse Cloud）：

```bash
export DOCPLAYBOOK_LANGFUSE_ENABLED=true
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
export LANGFUSE_HOST=https://cloud.langfuse.com
```

然后正常执行：

```bash
docplaybook translate ./examples/sample-workspace
```

当前版本只追踪 `translate` 路径，不追踪 `learn`、`bootstrap` 或 `lint`。

会记录的信息包括：

- 哪个 source article 被翻译到了哪个 target article
- `docKey`、源/目标语言、触发原因、是否 `--force`
- 单次文章翻译的耗时和聚合 token 用量
- 每个底层模型调用是 `single`、`batch`，还是 `batch-fallback`
- batch 解析失败和限流重试等事件

为了保守处理敏感内容，默认不会把完整 prompt 或完整译文上传到 `Langfuse`。当前只记录元数据，例如字符数、block 数、token、耗时和错误摘要。

可以和现有日志配合使用：

- `--verbose`
  - 查看当前 CLI 在处理哪些文件、哪些目标语言
- `--debug`
  - 保留本地临时 trace 文件，适合深入看 prompt 和响应 payload
- `Langfuse`
  - 适合看运行历史、耗时、token、fallback、重试和跨多次运行的趋势

一个常见的回归分析流程是：

1. 先在 `Langfuse` 中筛选耗时最高、token 最高或 fallback 最多的翻译运行。
2. 找到对应的 `source_path`、`target_path`、`docKey` 和目标语言。
3. 再用 `--debug` 对同一类文档做本地重跑，检查 prompt 结构、memory 质量或 batch JSON 形状问题。
4. 把确认过的问题样本加入 `evals/docplaybook` 的人工评测流程，持续观察修复是否稳定。

如果你在短生命周期的 CLI/CI 环境中使用它，也可以额外设置：

```bash
export DOCPLAYBOOK_LANGFUSE_FLUSH_TIMEOUT_MS=8000
```

这会控制命令退出前等待 trace flush 的最长时间。

按 memory 对现有译文进行质量检查：

```bash
docplaybook lint ./examples/sample-workspace
```

自动修复可安全替换的 block：

```bash
docplaybook lint ./examples/sample-workspace --fix
```

## 为什么经验库很重要

大多数翻译自动化工具都能生成一份还不错的初稿。真正的痛点，往往出现在人工审阅和修改之后：

- 审阅者修正过一次产品术语，但下一轮翻译又犯了同样的错误
- 一段已经被精心润色过的内容，在后续增量同步时部分被重译，丢掉了审阅者偏好的表达
- 同一个修正必须在很多文档里重复做，因为工具从来没有把它沉淀成项目级的可复用知识
- 新同事加入文档流程时，拿不到一份可靠的历史翻译决策记录
- 某个术语在一篇文档里被改正确了，但整个文档站里的其他页面还保留着旧译法

这个项目的核心理念是：人工修正不应只是一次性的编辑操作，而应该沉淀为整个项目都能追踪和复用的翻译经验。

## 典型痛点示例

### 1. 术语漂移

原文：

```md
飞书知识库支持权限控制。
```

模型把 `知识库` 翻译成 `Knowledge Base`，但团队实际希望它被翻成 `Wiki`，因为那才是这个产品的正式名称。

有人手动把它改对了。结果一周后，这句话源文稍微变了一下，文件再次被同步，工具又把它写回成了 `Knowledge Base`。

这正是本项目试图避免的那种重复回归。

### 2. 人工审阅成果丢失

某个翻译页面已经被人工认真审过并润色过了。之后源页面只有一个段落发生变化，但一个过于粗暴的同步工具，常常会重写目标页面中过多内容，从而把附近原本已经改好的表达也一起冲掉。

按 block 进行同步可以减少这种影响范围，而经验库则能帮助后续翻译继续继承那些已经被修正过的风格和术语。

### 3. 同样的修复在整站反复出现

假设某位审阅者做了这些修改：

- 将 `租户` 从 `tenant account` 改为 `tenant`
- 将 `知识库` 从 `knowledge base` 改为 `wiki`
- 将 `空间` 从 `workspace` 改为 `space`

如果没有可追踪的经验库，审阅者可能需要在几十篇文档里重复做同样的三处修正。一旦这些决策被写入项目级 playbook，后续所有翻译都能继承它们。

### 4. 项目知识只存在于人的脑子里

在很多文档团队里，真正的翻译规则其实并没有写下来：

- 哪些术语必须保留原文，不能翻译
- 哪些产品名有官方英文叫法
- 整体语气应该简洁，还是更偏解释型
- API 字段名应不应该直译，还是应该保持英文

如果这些知识只存在于审阅者脑中，翻译质量就会高度依赖“刚好是谁来审这篇文档”。一份可跟踪的经验文件，可以把这些决策变成项目资产。

### 5. 新经验不应该只停留在一个文件里

如果某条新的翻译规则是在一篇文档中被发现的，它就不应该永远被困在那一个文件里。这个工具的长期方向是：一旦学习到新的经验，就可以把它应用到并重新验证整个 workspace 的其他内容，尤其是术语类和其他高度可复用的修正。

## 它能做什么

- 将多个文档归并为多个 doc set
- 支持四种布局：`sibling`、`docusaurus`、`rspress`、`vitepress`
- 将 Markdown 拆成 block，以便安全地识别可翻译内容并写回原位置
- 每个 `source -> target` 目标文章只发一次翻译请求，而不是对 block 多次调用模型
- 保留 frontmatter、代码块、HTML block、分隔线等不可翻译内容
- 从当前 source/target 文档对中提炼可复用规则，并沉淀进项目级翻译 playbook
- 按 memory 对现有译文做多维度评分和问题检查，并支持 `lint --fix`
- 不依赖仓库外的复杂 baseline；`.docplaybook/state` 记录分支上的处理进度，memory 文件记录长期项目知识

## Layout

`docplaybook init` 会先尝试根据项目目录自动判断 layout：

- `docusaurus`
  - 检测到 `docusaurus.config.*`
  - source: `docs/**/*.md`
  - target: `i18n/<lang>/docusaurus-plugin-content-docs/current/**/*.md`
- `rspress`
  - 检测到 `rspress.config.*`、`.rspress/config.*` 或 `docs/.rspress/config.*`
  - source: `docs/**/*.md`
  - target: `docs/<lang>/**/*.md`
- `vitepress`
  - 检测到 `.vitepress/config.*` 或 `docs/.vitepress/config.*`
  - source: `docs/**/*.md`
  - target: `docs/<lang>/**/*.md`
- `sibling`
  - 如果都没检测到，就使用同级文件布局
  - source: `guide.md`
  - target: `guide.en.md`、`guide.ja.md`

示例可以直接看：

- `examples/sample-workspace`
- `examples/docusaurus-workspace`
- `examples/rspress-workspace`
- `examples/vitepress-workspace`

## 同步模型

当前版本的同步策略是：

- 保留 block 级结构，用它来识别可翻译内容并安全写回
- `translate` 对每个目标文件记录 source hash
- 如果 source hash 没变且目标文件已存在，就直接跳过
- 如果 source hash 变了或目标文件缺失，就整篇刷新这个 target document
- 翻译调用仍然是“按目标文章”进行的：一篇 `guide.en.md` 只发一次模型请求
- 同一篇文章里的可翻译内容会按文章级请求组织；必要时会按批次切分，但仍然以同一篇目标文章为单位安全写回
- 并发也只按“文章任务”计算：`concurrency.maxConcurrentRequests` 表示同时有多少篇目标文章在翻译

这意味着：

- 增量判断是文档级的，是否处理由 source hash 决定
- 文档结构仍然是 block-aware 的，所以 frontmatter、Markdown 结构和框架特有文件可以被安全处理
- 模型调用次数不再随着 block 数量线性增加，更适合长文档

默认入口 `docplaybook <workspace>` 会先执行 `learn`，再执行 `translate`。
这适合“本地先吸收已有译文修正，再同步源文变化”的日常循环。

`learn` 当前是 state-driven 的：

- 对每个目标译文文件记录 learned target hash
- target hash 没变时跳过，避免重复学习同一个版本
- target hash 变了时，读取当前 source 和当前 target
- 让 LLM 判断哪些观察应该写入全局 `playbook.md`，哪些应该写入语言级 memory

这意味着：

- 不需要复杂的 before/after baseline 目录
- 同一个 target 版本只会 learn 一次，除非你显式 `--force`
- 团队协作时真正共享的长期知识仍然是仓库里的源文、译文和 memory 文件

## Lint

`docplaybook lint` 会把原文、译文和当前 language memory 一起交给模型，像 `eslint` 一样输出明确的问题列表。

评分维度包括：

- 术语一致性
- 语气与风格一致性
- 内容完整性
- Markdown 完整性
- 语言流畅度
- 综合分数

每条问题都会尽量明确到具体目标 block；如果加上 `--fix`，会自动回写那些可以安全按 block 替换的修复建议。

## State 驱动

主流程优先使用 workspace 内的 tracked state，而不是 Git before/after baseline。

系统只依赖两类长期数据：

- `.docplaybook/state/*` 中的 source/target hash
- 仓库内的 `playbook.md` 和 `memories/<lang>.md`

这样设计有几个好处：

- 增量判断足够简单：变了就处理，没变就跳过
- 切换分支时，处理进度也会跟着分支恢复
- 不需要维护复杂的 Git diff 或额外快照基线
- `state` 只负责“是否需要处理”，memory 文件负责持久化长期经验
- `lint --scope changed` 仍然可以单独保持 Git-aware，用于 CI 和 pre-push 场景

## 配置

项目配置和可追踪的经验文件保存在 workspace 内：

```text
<workspace>/
  .docplaybook/
    config.json
    state/
      source-hashes.json
      learned-target-hashes.json
    memories/
      en.md
      ja.md
```

推荐的模型配置形式：

- `gateway`：使用 Vercel AI Gateway，并传入类似 `openai/gpt-5-mini` 这样的 gateway 模型字符串
- `openai`：使用官方 provider 包直接调用 OpenAI
- `anthropic`：使用官方 provider 包直接调用 Anthropic
- `openai-compatible`：使用用户指定的 OpenAI 兼容端点，例如 OpenRouter 或自托管网关

`.docplaybook/config.json` 按 JSONC 读取，所以可以包含 `//` 或 `/* ... */` 注释，方便把说明直接写在配置旁边。

DocPlaybook 会维护两层 AI 生成的翻译规则文件：

- `.docplaybook/playbook.md`
  - `## Voice`
  - `## Protected Terms`
  - `## Translation Rules`
- `.docplaybook/memories/<target>.md`
  - `## Terminology`
  - `## Style Notes`

使用 Vercel AI Gateway 的 `.docplaybook/config.json` 示例：

```json
{
  "version": 1,
  "sourceLanguage": "zh-CN",
  "targetLanguages": ["en", "ja"],
  "ignorePatterns": ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.docplaybook/**"],
  "concurrency": {
    "maxConcurrentRequests": 6
  },
  "layout": {
    "kind": "sibling"
  },
  "model": {
    "kind": "gateway",
    "model": "openai/gpt-5-mini",
    "apiKeyEnv": "AI_GATEWAY_API_KEY"
  }
}
```

`ignorePatterns` 只用来补充 docplaybook 自己的忽略规则；`.gitignore` 里的规则会默认一起生效，即使这里是空数组。

`concurrency.maxConcurrentRequests` 是文章级并发池，表示“同时有多少篇目标文章正在翻译”，默认 `6`，最高支持 `20`。如果 provider 容易触发限流，先保守一点。

`model` 这一段是明确交给用户控制的。API key 永远不应保存在仓库里：

- `gateway` 模式使用 AI SDK Gateway 的模型字符串，并从环境变量读取 API key
- `openai` 模式使用官方 OpenAI provider 包，并从环境变量读取 API key
- `anthropic` 模式使用官方 Anthropic provider 包，并从环境变量读取 API key 或 auth token
- `openai-compatible` 模式允许你通过环境变量提供 base URL 和 API key，接入任意 OpenAI 兼容端点

`openai` 配置示例：

```json
{
  "kind": "openai",
  "model": "gpt-5-mini",
  "apiKeyEnv": "OPENAI_API_KEY",
  "baseUrlEnv": "OPENAI_BASE_URL"
}
```

`anthropic` 配置示例：

```json
{
  "kind": "anthropic",
  "model": "claude-sonnet-4-5",
  "apiKeyEnv": "ANTHROPIC_API_KEY",
  "authTokenEnv": "ANTHROPIC_AUTH_TOKEN",
  "baseUrlEnv": "ANTHROPIC_BASE_URL"
}
```

`openai-compatible` 配置示例：

```json
{
  "kind": "openai-compatible",
  "providerName": "openrouter",
  "model": "google/gemini-2.5-flash",
  "baseUrlEnv": "OPENROUTER_BASE_URL",
  "apiKeyEnv": "OPENROUTER_API_KEY"
}
```

在创建模型客户端之前，`docplaybook` 还会自动加载这些 env 文件：

- `.docplaybook/.env.local`
- `.docplaybook/.env`
- `.env.docplaybook.local`
- `.env.docplaybook`
- `.env.translator-agent.local`
- `.env.translator-agent`
- `.env.local`
- `.env`

推荐实践：

- 将 `.docplaybook/config.json` 提交到仓库
- 将 `.docplaybook/state/*.json` 提交到仓库，让处理进度跟随分支
- 将密钥放在 `.docplaybook/.env.local`
- 在自动化环境里使用 shell 环境变量或 CI secrets

关于 `state` 的约定：

- `state` 只表示处理进度，不表示业务知识
- review 时默认忽略 `state` 的语义内容
- merge conflict 以当前分支重新运行后的最新结果为准
- 长期项目知识仍然只存放在 `playbook.md` 和 `memories/<lang>.md`

## 翻译经验库

每个语言对都有一份可跟踪的 Markdown playbook，例如：

- `.docplaybook/memories/en.md`

这份文件会被注入到每一次翻译 prompt 中。它本质上就像项目级的翻译 skill 或 system context：

- 术语规则
- 偏好的表达方式
- 风格修正规则
- 可复用的人工覆盖

这也是这个工具和简单“翻译变更文件”脚本之间最大的区别。初稿当然重要，但更重要的是长期保留并复用人工修正。

当人工编辑某个翻译文档时，agent 会读取：

- 当前目标译文
- 当前源文
- 当前 `playbook.md`
- 当前 `memories/<lang>.md`

然后让 LLM 判断这些 source/target 对照里哪些属于可复用规则，并把它们合并进 `playbook.md` 或 `memories/<lang>.md`。

## 当前限制

- 目前只实现了本地文件 workspace
- 经验召回策略有意保持简单：每次都注入整个语言对 playbook
- `learn` 当前基于 source/target 成品对照提炼规则，而不是严格的 reviewer diff 归因
- `bootstrap` 默认会使用所有 aligned docs；当某种语言的对齐文档很多时，交互模式下会提示你是否限制本次样本量
- Markdown block 解析是 best-effort 的，对非常复杂的文档可能仍需继续打磨

## 评测

仓库内置了一套轻量的手工评测包，放在 `evals/docplaybook/`。

它适合做这些事：

- 跟踪 `translate` / `learn` / `bootstrap` 的语义效果
- 对同一批案例做多轮人工复评
- 量化 prompt 或模型调整后的改进情况

常用命令：

```bash
pnpm evals:review
pnpm evals:summary
```

`evals:review` 会逐个展示案例，要求你记录：

- `pass` / `mixed` / `fail`
- `0-5` 分
- 备注

结果会保存到 `evals/docplaybook/results/*.json`，之后可以用 `evals:summary` 汇总。

## 当前重点

- 增强对列表、表格等复杂 Markdown 结构的 block 匹配能力
- 继续优化长文档下的翻译耗时与可观测性
