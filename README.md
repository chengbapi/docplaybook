# docplaybook

`docplaybook` 是一个面向 Markdown 文档翻译的本地优先 CLI 工具。

它会监听一个 workspace，将文件归并为多个文档集合，在源文档发生变化时增量更新翻译版本，并从人工编辑中学习可复用的翻译经验。它的长期目标是让核心引擎与文档来源解耦，这样同一套同步和经验学习流程，今天可以用于本地文件，未来也可以用于云文档。

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

- 监听整个 workspace，而不是只监听单个文件
- 将多个文档归并为多个 doc set
- 先支持同级文件布局：`guide.md`、`guide.en.md`、`guide.ja.md`
- 将 Markdown 拆成 block，只重译发生变化且可翻译的 block
- 保留 frontmatter、代码块、HTML block、分隔线等不可翻译内容
- 通过更新每个语言对对应的项目级翻译 playbook，从人工修改中学习
- 将运行时状态保存在仓库之外，避免快照和 hash 污染工作区

## 架构

第一版有意拆成几个层次：

- `DocumentProvider`：文档从哪里来。第一种 provider 是本地文件。
- `LayoutAdapter`：文件如何映射成逻辑上的 doc set。第一种 preset 是 `sibling`。
- `TranslationEngine`：基于 Vercel AI SDK 的 block 级翻译。
- `MemoryEngine`：根据人工修正更新纯文本翻译 playbook。
- `RuntimeStore`：将快照、hash 和上一次生成的基线保存在仓库之外。

CLI 内部使用的核心对象有：

- `Workspace`：一次 `docplaybook <path>` 传入的根目录
- `DocSet`：一份源文档及其多个翻译版本
- `DocumentRef`：某一种语言下的一个具体文件

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
      zh-CN__en.md
      zh-CN__ja.md
```

推荐的模型配置形式：

- `gateway`：使用 Vercel AI Gateway，并传入类似 `openai/gpt-5-mini` 这样的 gateway 模型字符串
- `openai`：使用官方 provider 包直接调用 OpenAI
- `anthropic`：使用官方 provider 包直接调用 Anthropic
- `openai-compatible`：使用用户指定的 OpenAI 兼容端点，例如 OpenRouter 或自托管网关

`.docplaybook/config.json` 按 JSONC 读取，所以可以包含 `//` 或 `/* ... */` 注释，方便把说明直接写在配置旁边。

使用 Vercel AI Gateway 的 `.docplaybook/config.json` 示例：

```json
{
  "version": 1,
  "sourceLanguage": "zh-CN",
  "targetLanguages": ["en", "ja"],
  "ignorePatterns": ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.docplaybook/**"],
  "batch": {
    "maxBlocksPerBatch": 8,
    "maxCharsPerBatch": 6000
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

`batch.maxBlocksPerBatch` 可以控制一次批量翻译最多合并多少个 block；如果你觉得长文档调用次数还是太多，可以先调这个值。

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
- `.env.docplaybook.local`（兼容旧位置）
- `.env.docplaybook`（兼容旧位置）
- `.env.local`
- `.env`

推荐实践：

- 将 `.docplaybook/config.json` 提交到仓库
- 将密钥放在 `.docplaybook/.env.local`
- 在自动化环境里使用 shell 环境变量或 CI secrets

## 翻译经验库

每个语言对都有一份可跟踪的 Markdown playbook，例如：

- `.docplaybook/memories/zh-CN__en.md`

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

内部模型已经为未来的 preset 预留了形态：

- `docusaurus`
- `rspress`

这两个目前还是预留状态。当前引擎已经把文档视为“按 doc set 分组的离散文件”，这比“只处理单文件”的模型更适合 docs-as-code 类文档站。

## 安装

项目级安装，适合本地开发：

```bash
npm install
```

不做全局安装，直接在仓库里运行：

```bash
npm run dev -- --help
```

从本地仓库做全局安装：

```bash
npm install
npm run build
npm link
```

之后就可以在任意目录中使用：

```bash
docplaybook --help
docplaybook init ./my-docs
docplaybook ./my-docs
```

先打包再做全局安装：

```bash
npm pack
npm install -g ./docplaybook-0.1.0.tgz
```

移除全局 link：

```bash
npm unlink -g docplaybook
```

## 命令

构建：

```bash
npm run build
```

初始化一个 workspace，推荐先直接运行交互式初始化：

```bash
npm run dev -- init ./examples/sample-workspace
```

它会：

- 先引导你选择模型 provider 和具体 model
- 完成所需凭证配置，并在准备好后做一次轻量连通性检查
- 再自动识别主文档语言，并让你确认
- 然后提示输入 `en,ja` 这样的 target languages
- 创建 `.docplaybook` 目录以及初始化配置，不会立即开始翻译

如果之后想继续添加语言，可以在同一个 workspace 里再次执行：

```bash
npm run dev -- init ./examples/sample-workspace
```

然后输入新的目标语言，例如 `fr,de`。已有语言会保留，只会追加新的语言配置和记忆文件。

如果你在 CI 或非交互环境里运行，也可以显式传入参数：

```bash
npm run dev -- init ./examples/sample-workspace --source zh-CN --targets en,ja
```

初始化完成后，你可以按需手动执行一次翻译，或者直接进入 watch 模式。

使用 OpenAI 官方直连初始化：

```bash
npm run dev -- init ./examples/sample-workspace --model-kind openai --model gpt-5-mini
```

使用 Anthropic 官方直连初始化：

```bash
npm run dev -- init ./examples/sample-workspace --model-kind anthropic --model claude-sonnet-4-5
```

使用自定义 OpenAI 兼容 provider 初始化：

```bash
npm run dev -- init ./examples/sample-workspace --model-kind openai-compatible --provider-name openrouter --model google/gemini-2.5-flash --api-key-env OPENROUTER_API_KEY --base-url-env OPENROUTER_BASE_URL
```

默认执行一次后退出：

```bash
npm run dev -- ./examples/sample-workspace
```

持续监听：

```bash
npm run dev -- ./examples/sample-workspace --watch
```

## 调研记录

当前方案参考了一些解决相邻问题的工具，但它们并没有完整覆盖“本地优先 + 经验学习闭环”这一形态：

- [Azure co-op-translator](https://github.com/Azure/co-op-translator)：它和“增量文档翻译”这个问题非常接近，会跟踪源文和译文状态，只处理变更内容；但它并不是围绕“由人工修正生成可跟踪纯文本经验文件”来设计的。
- [Lingo.dev CLI](https://lingo.dev/en/cli)：它会维护 delta lock file，并在源文变化前尽量保留人工覆盖，这一点对 docs 仓库里的增量同步行为很有参考价值。
- [GitLocalize](https://docs.gitlocalize.com/about.html)：它提供基于 segment 的 docs-as-code 持续本地化能力，也支持 translation memory 和 glossary；能力上很接近，但产品形态更偏平台流程，而不是本地 agent 骨架。
- [Crowdin GitHub integration](https://store.crowdin.com/github)：它代表了一种成熟的持续本地化产品模型，具备 translation memory、AI 和仓库同步能力；但相比这里的本地优先 CLI 方案要重得多。
- [Docusaurus i18n](https://docusaurus.io/docs/i18n/introduction)：它说明了多语言文档通常会按 locale-aware 目录结构拆成离散文件。
- [Rspress i18n](https://rspress.rs/guide/basic/i18n)：它同样说明了本地化文档是以离散文件存在的，因此 layout adapter 是有必要的。
- [Vercel AI SDK provider selection](https://ai-sdk.dev/docs/getting-started/choosing-a-provider)：它说明模型选择应该始终保持用户可配置，而不是被硬编码到工具里。

## 当前限制

- 目前只实现了本地文件 workspace
- 目前只实现了 `sibling` layout preset
- 经验召回策略有意保持简单：每次都注入整个语言对 playbook
- 译文发生大幅结构编辑时，只会 warning，不会产出经验更新
- Markdown block 解析是 best-effort 的，对非常复杂的文档可能仍需继续打磨

## 近期方向

- 增强对列表、表格等复杂 Markdown 结构的 block 匹配能力
- 补齐 Docusaurus 和 Rspress 的 layout adapter
- 增加项目级 revalidation 流程，让新学到的经验可以回扫并检查已有翻译
- 在不改动核心翻译与经验引擎的前提下，增加飞书文档等云文档 provider
