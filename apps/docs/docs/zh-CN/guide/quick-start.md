# 快速开始

## 在你的项目中安装

如果要将 DocPlaybook 集成到现有的文档项目中，通常将其作为开发依赖进行安装是最合适的。

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

安装完成后，第一个实际步骤是：

```bash
pnpm exec docplaybook init .
```

`DocPlaybook` 的设计使得初始化在大多数项目中基本相同。如果你的文档已经使用 `Docusaurus`、`Rspress` 或 `VitePress`，DocPlaybook 会检测到并在内部应用对应的路径约定。

如果未检测到受支持的文档框架，则会回退为 `sibling`。

在执行 `init` 时，DocPlaybook 将会：

- 在可能的情况下检测工作区布局
- 选择模型提供商和模型
- 收集所需凭据
- 测试模型连接性
- 检测源语言
- 询问目标语言
- 创建 `.docplaybook/config.json`
- 创建 `.docplaybook/memories/*.md`
- 创建 `.docplaybook/playbook.md`

如果已存在已翻译的目标文件，`init` 还会建议运行 `bootstrap`，以便从这些现有文档推断出第一个 playbook 和语言记忆。

## 提供商设置

DocPlaybook 由 AI 提供支持且基于 LLM，因此提供商设置是初始化的一部分。

在初始化过程中，你将：

- 选择提供商
- 选择模型 ID
- 提供凭据
- 运行连接性检查

你可以选择适合团队的提供商。DocPlaybook 不要求使用特定的提供商家族。

在团队工作流程中，许多项目会在配置中锁定 provider 和 model，以便本地运行和 CI 运行保持一致。

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
docs/en/guide/intro.md
docs/ja/guide/intro.md

vitepress:
docs/guide/intro.md
docs/en/guide/intro.md
```

### Docusaurus

当 DocPlaybook 检测到 `Docusaurus` 时，它会将翻译后的文档写入：

```text
i18n/<locale>/docusaurus-plugin-content-docs/current/
```

这遵循官方 Docusaurus 文档的 i18n 结构。

### Rspress

当 DocPlaybook 检测到 `Rspress` 时，它会将翻译后的文档写入：

```text
docs/<locale>/
```

这应被视为 DocPlaybook 针对 Rspress 的集成约定。

### VitePress

当 DocPlaybook 检测到 `VitePress` 时，它会将翻译后的文档写入：

```text
docs/<locale>/
```

这遵循 VitePress 项目中常用的本地化文档布局。

### Sibling

如果未检测到受支持的文档框架，DocPlaybook 会回退到 `sibling`，在此翻译文件会位于源文件旁边：

```text
guide.md
guide.en.md
guide.ja.md
```

## 核心命令

这些是初始化后将使用的命令。

### `docplaybook`

这是默认的日常命令。

```bash
pnpm exec docplaybook .
```

当你想使用常规项目工作流而不需要手动决定每个子步骤时使用它。

当前的默认工作流为：

1. `learn`
2. `translate`

### `docplaybook bootstrap`

从仓库中已跟踪的现有翻译文档构建初始记忆文件。

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

`translate` 是基于状态的：如果目标文档的源哈希未改变且目标已存在，DocPlaybook 会跳过它。

仅处理一两种目标语言时：

```bash
pnpm exec docplaybook translate . --langs ja
pnpm exec docplaybook translate . --langs en,ja
```

### `docplaybook learn`

将人工审阅的修改吸收到记忆文件中。

```bash
pnpm exec docplaybook learn .
```

当审阅者已更新翻译文档且你希望 DocPlaybook 日后重用这些修正时使用此命令。

`learn` 是基于状态的：它会跳过自上次 `learn` 运行以来内容哈希未改变的目标文件，对于已更改的目标，它会从当前的源/目标对中提取可重用的指导。

您也可以将学习限制为选定的目标语言：

```bash
pnpm exec docplaybook learn . --langs ja
```

### `docplaybook lint`

将翻译与源文档和 memory 对照审查。

```bash
pnpm exec docplaybook lint .
```

这将返回 lint 风格的检查结果和关于术语、语气、完整性、Markdown 完整性、流利度以及整体质量的评分。

要自动应用安全修复：

```bash
pnpm exec docplaybook lint . --fix
```

要对每个翻译文件运行 lint，而不是只对已更改的文件：

```bash
pnpm exec docplaybook lint . --scope all
```

您还可以将范围与语言筛选组合使用：

```bash
pnpm exec docplaybook lint . --fix --scope changed --langs ja
```

## 日志

详细日志：

```bash
pnpm exec docplaybook . --verbose
```

调试日志：
