# docplaybook

`docplaybook` 是一个面向 Markdown 文档翻译的本地优先 CLI 工具。

它会扫描一个 workspace，将文件归并为多个文档集合，按需执行一次增量翻译同步，并从人工编辑中学习可复用的翻译经验。

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
- 自动识别项目布局。当前会识别 `docusaurus`、`rspress`，否则回退到 `sibling`
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

查看底层调试信息，例如 block index、prompt 大小和请求队列状态：

```bash
docplaybook ./examples/sample-workspace --debug
```

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
- 支持三种布局：`sibling`、`docusaurus`、`rspress`
- 将 Markdown 拆成 block，只重译发生变化且可翻译的 block
- 每个 `source -> target` 目标文章只发一次翻译请求，而不是对 block 多次调用模型
- 保留 frontmatter、代码块、HTML block、分隔线等不可翻译内容
- 通过更新每个语言对对应的项目级翻译 playbook，从人工修改中学习
- 按 memory 对现有译文做多维度评分和问题检查，并支持 `lint --fix`
- 将运行时状态保存在仓库之外，避免快照和 hash 污染工作区

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
- `sibling`
  - 如果都没检测到，就使用同级文件布局
  - source: `guide.md`
  - target: `guide.en.md`、`guide.ja.md`

示例可以直接看：

- `examples/sample-workspace`
- `examples/docusaurus-workspace`
- `examples/rspress-workspace`

## 同步模型

当前版本的同步策略是：

- 保留 block 级逻辑，用它来判断哪些内容需要重译，以及最终如何按原位置回填
- 但翻译调用是“按目标文章”进行的：一篇 `guide.en.md` 只发一次模型请求
- 同一篇文章里需要重译的多个 block 会被打包成一个整体 payload，一次翻译返回后再按 block id 拆回目标位置
- 并发也只按“文章任务”计算：`concurrency.maxConcurrentRequests` 表示同时有多少篇目标文章在翻译

这意味着：

- 增量更新仍然是 block 级的，不会因为局部改动就整篇重写
- 但模型调用次数不再随着 block 数量线性增加，更适合长文档

默认入口 `docplaybook <workspace>` 会先执行 `learn`，再执行 `translate`。
这样可以先吸收已有人工修正，降低同时改动源文和译文时丢失人工修改的风险。

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

## 为什么运行态数据放在仓库之外

核心同步循环需要的不只是 Git 历史：

- 上一次处理后的源文快照
- 上一次自动生成的译文快照
- 当前磁盘上的译文快照

只有这样，agent 才能回答两个不同的问题：

- 相对上一次已处理基线，源文改了什么
- 相对上一次自动生成基线，人类对译文改了什么

这些基线属于运行时状态，而不是产品内容，所以它们会被存放到用户数据目录中：

- macOS: `~/Library/Application Support/docplaybook/workspaces/<workspace-id>/`
- Linux: `$XDG_STATE_HOME/docplaybook/workspaces/<workspace-id>/`
- Windows: `%LOCALAPPDATA%/docplaybook/workspaces/<workspace-id>/`

你也可以通过 `DOCPLAYBOOK_HOME` 覆盖这个根目录。

## 配置

项目配置和可追踪的经验文件保存在 workspace 内：

```text
<workspace>/
  .docplaybook/
    config.json
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

每个 memory 文件都会按标准格式维护这些章节：

- `## Terminology`
- `## Tone & Style`
- `## Formatting & Markdown`
- `## Protected Terms`
- `## Review Notes`

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
- `.env.local`
- `.env`

推荐实践：

- 将 `.docplaybook/config.json` 提交到仓库
- 将密钥放在 `.docplaybook/.env.local`
- 在自动化环境里使用 shell 环境变量或 CI secrets

## 翻译经验库

每个语言对都有一份可跟踪的 Markdown playbook，例如：

- `.docplaybook/memories/en.md`

这份文件会被注入到每一次翻译 prompt 中。它本质上就像项目级的翻译 skill 或 system context：

- 术语规则
- 偏好的表达方式
- 风格修正规则
- 可复用的人工覆盖

这也是这个工具和简单“翻译变更文件”脚本之间最大的区别。初稿当然重要，但更重要的是长期保留并复用人工修正。

当人工编辑某个翻译文档时，agent 会比较：

- 上一次源文快照
- 上一次自动生成的译文快照
- 当前译文文件

然后让 LLM 直接更新整份 playbook，并尽量保持它简洁、去重、适合继续进入 prompt。如果译文文件被进行了较大幅度的结构重排，agent 会给出 warning，并为了安全起见跳过经验生成。

## Layout 预设

第一版已经实现的 preset 是：

- `sibling`：`guide.md`、`guide.en.md`、`guide.ja.md`

目前只实现了 `sibling`。其它 layout 还没有实现。

## 当前限制

- 目前只实现了本地文件 workspace
- 目前只实现了 `sibling` layout preset
- 经验召回策略有意保持简单：每次都注入整个语言对 playbook
- 译文发生大幅结构编辑时，只会 warning，不会产出经验更新
- Markdown block 解析是 best-effort 的，对非常复杂的文档可能仍需继续打磨

## 近期方向

- 增强对列表、表格等复杂 Markdown 结构的 block 匹配能力
- 增加项目级 revise 流程，让新学到的经验可以按语言聚合后再更新 memory
- 继续优化长文档下的翻译耗时与可观测性
