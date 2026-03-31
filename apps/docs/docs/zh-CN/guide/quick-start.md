# 快速开始

## 在你的项目中安装

如果你要将 DocPlaybook 集成到现有文档项目中，通常将其作为开发依赖安装是最合适的。

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:16px 0 22px;">
  <div style="padding:14px 16px;border:1px solid #e5e7eb;border-radius:16px;">
    <div style="font-weight:700;margin-bottom:10px;">pnpm</div>
    <pre style="margin:0;white-space:pre-wrap;"><code>pnpm add -D docplaybook
pnpm exec docplaybook --help</code></pre>
  </div>
  <div style="padding:14px 16px;border:1px solid #e5e7eb;border-radius:16px;">
    <div style="font-weight:700;margin-bottom:10px;">npm</div>
    <pre style="margin:0;white-space:pre-wrap;"><code>npm install --save-dev docplaybook
npx docplaybook --help</code></pre>
  </div>
  <div style="padding:14px 16px;border:1px solid #e5e7eb;border-radius:16px;">
    <div style="font-weight:700;margin-bottom:10px;">yarn</div>
    <pre style="margin:0;white-space:pre-wrap;"><code>yarn add -D docplaybook
yarn exec docplaybook --help</code></pre>
  </div>
</div>

如果你暂时不想将其添加到项目中：

```bash
pnpm dlx docplaybook --help
npx docplaybook --help
yarn dlx docplaybook --help
```

## 初始化项目

安装完成后，真正的第一步是：

```bash
pnpm exec docplaybook init .
```

`DocPlaybook` 的设计使得初始化在不同项目间大致相同。如果你的文档已经使用 `Docusaurus`、`Rspress` 或 `VitePress`，DocPlaybook 会检测到并在内部应用匹配的路径约定。

如果未检测到受支持的文档框架，则回退到 `sibling`。

在运行 `init` 时，DocPlaybook 将会：

- 在可能的情况下检测工作区布局
- 选择模型提供商和模型
- 收集所需的凭据
- 测试模型连接性
- 检测源语言
- 询问目标语言
- 创建 `.docplaybook/config.json`
- 创建 `.docplaybook/memories/*.md`

如果目标翻译文件已存在，`init` 还会建议运行 `bootstrap`，以便可以从这些现有文档推断出第一个 playbook 和语言记忆。

## 提供商设置

DocPlaybook 由 AI 驱动并基于大语言模型，因此提供商设置是初始化的一部分。

在 init 过程中，你将：

- 选择提供商
- 选择模型 ID
- 提供凭据
- 运行连接性检查

你可以选择适合团队的提供商。DocPlaybook 不要求必须使用特定的提供商家族。

在团队工作流中，许多项目会在配置中锁定提供商和模型，以便本地运行和 CI 运行保持一致。

## 布局与框架约定

用户流程保持不变，但输出布局取决于 DocPlaybook 检测到的内容：

```text
sibling:
guide.md
guide.en.md
guide.ja.md

docusaurus:
docs/guide/intro.md
i18n/en/docusaurus-plugin-content-docs/current/guide/intro.md

rspress:
docs/guide/intro.md
docs/en/guide/intro.md

vitepress:
docs/guide/intro.md
docs/en/guide/intro.md
```

### Docusaurus

当 DocPlaybook 检测到 `Docusaurus` 时，它会将翻译后的文档写入：

```text
i18n/<locale>/docusaurus-plugin-content-docs/current/
```

此结构遵循官方 Docusaurus 文档的 i18n（国际化）结构。

### Rspress

当 DocPlaybook 检测到 `Rspress` 时，它会将翻译后的文档写入：

```text
docs/<locale>/
```

这应被理解为 DocPlaybook 针对 Rspress 的集成约定。

### VitePress

当 DocPlaybook 检测到 `VitePress` 时，它会将翻译后的文档写入：

```text
docs/<locale>/
```

这遵循 VitePress 项目中常用的本地化文档布局。

### Sibling

如果未检测到受支持的文档框架，DocPlaybook 将回退到 `sibling`，在该模式下翻译文件与源文件并列存放：

```text
guide.md
guide.en.md
guide.ja.md
```

## 核心命令

以下是初始化后你会使用的命令。

### `docplaybook`

这是日常默认使用的命令。

```bash
pnpm exec docplaybook .
```

当你想要按常规项目工作流程运行，而不想手动决定每个子步骤时使用此命令。

### `docplaybook bootstrap`

从仓库中已跟踪的现有翻译文档构建首批记忆文件。

```bash
pnpm exec docplaybook bootstrap . --langs en,ja
```

当文档站点已包含翻译文件时，在 `init` 之后使用此命令。

### `docplaybook translate`

将源文档翻译为目标语言。

```bash
pnpm exec docplaybook translate .
```

当你只想根据源文档更新翻译输出时使用此命令。

仅处理一到两种目标语言时：

```bash
pnpm exec docplaybook translate . --langs ja
pnpm exec docplaybook translate . --langs en,ja
```

### `docplaybook learn`

将人工审阅的编辑吸收到记忆文件中。

```bash
pnpm exec docplaybook learn .
```

当审阅者已更新翻译文档并且你希望 DocPlaybook 日后重用这些修正时使用此命令。

`learn` 以 Git 为先：它将 `HEAD` 中的翻译文件与当前工作树版本进行比较，然后询问 LLM 哪些编辑应成为可重用的指导。

你也可以将学习限制为选定的目标语言：

```bash
pnpm exec docplaybook learn . --langs ja
```

### `docplaybook lint`

将翻译与源文档和记忆进行对照审查。

```bash
pnpm exec docplaybook lint .
```

这会返回类 lint 的发现和关于术语、语气、完整性、Markdown 完整性、流畅度和总体质量的评分。

要自动应用安全修复：

```bash
pnpm exec docplaybook lint . --fix
```

对每个翻译文件进行 lint（而非仅对已更改的文件）：

```bash
pnpm exec docplaybook lint . --scope all
```

你还可以将作用域与语言过滤器结合使用：

```bash
pnpm exec docplaybook lint . --fix --scope changed --langs ja
```

## 日志

详细日志：

```bash
pnpm exec docplaybook . --verbose
```

调试日志：

```bash
pnpm exec docplaybook . --debug
```

## 下一步

继续阅读 [项目工作流程](/guide/workflow)。
