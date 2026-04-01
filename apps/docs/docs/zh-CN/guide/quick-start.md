import PackageManagerTabs from '../../../theme/components/PackageManagerTabs';

# 快速开始

## 在项目中安装

如果你要将 DocPlaybook 集成到现有的文档项目中，通常将其作为开发依赖安装是最合适的。

<PackageManagerTabs variant="help" />

如果你暂时不想把它添加到项目中：

```bash
pnpm dlx docplaybook --help
npx docplaybook --help
yarn dlx docplaybook --help
```

## 初始化项目

安装完成后，第一步是：

```bash
pnpm exec docplaybook init .
```

`DocPlaybook` 设计为初始化在大多数项目中基本一致。如果你的文档已经使用 `Docusaurus`、`Rspress` 或 `VitePress`，DocPlaybook 会检测到并在内部应用相应的路径约定。

如果未检测到受支持的文档框架，则回退到 `sibling`。

在运行 `init` 时，DocPlaybook 将会：

- 在可能的情况下检测工作区布局
- 选择模型提供者和模型
- 收集所需凭证
- 测试模型连通性
- 检测源语言
- 询问目标语言
- 创建 `.docplaybook/config.json`
- 创建 `.docplaybook/memories/*.md`
- 创建 `.docplaybook/playbook.md`

如果目标翻译文件已经存在，`init` 还会建议运行 `bootstrap`，以便可以从这些现有文档推断出第一个 playbook 和语言记忆。

在翻译和学习运行开始后，DocPlaybook 还会维护 `.docplaybook/state/*.json`。这些文件记录分支进度，应该随分支一起提交。

## 引导现有的翻译文档

如果仓库已经包含对齐的翻译文档，请在 `init` 之后运行 `bootstrap`：

```bash
pnpm exec docplaybook bootstrap . --langs ja
```

使用 `bootstrap` 从现有翻译中推断初始项目指导：

- `.docplaybook/playbook.md`
- `.docplaybook/memories/<lang>.md`

之后，日常维护使用 `translate`、`learn` 和 `lint`。

## 提供商设置

DocPlaybook 由 AI 驱动并基于大型语言模型 (LLM)，因此提供商设置是初始化的一部分。

在初始化期间，您将：

- 选择提供商
- 选择模型 ID
- 提供凭据
- 运行连接性检查

您可以选择适合团队的提供商。DocPlaybook 不强制使用特定的提供商系列。

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

这应被理解为 DocPlaybook 对 Rspress 的集成约定。

### VitePress

当 DocPlaybook 检测到 `VitePress` 时，会将翻译后的文档写入：

```text
docs/<locale>/
```

这遵循 VitePress 项目中常用的本地化文档布局。

### Sibling

如果未检测到受支持的文档框架，DocPlaybook 会回退到 `sibling`，在此模式下翻译后的文件与源文件并列存放：

```text
guide.md
guide.en.md
guide.ja.md
```

## 下一步

继续阅读 [Commands](/guide/commands)。
