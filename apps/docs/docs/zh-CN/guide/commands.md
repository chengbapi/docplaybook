# 命令

本页介绍在运行 `init` 之后的核心 CLI 接口。

## 默认命令

```bash
pnpm exec docplaybook .
```

当前默认的本地工作流程会运行：

1. `learn`
2. `translate`

当你想要正常的维护循环而无需手动选择每个步骤时使用它。

## `docplaybook bootstrap`

```bash
pnpm exec docplaybook bootstrap . --langs ja
```

当仓库中已经包含对齐的翻译文档，并且你希望 DocPlaybook 从现有内容推断出第一个项目记忆时，请使用 `bootstrap`。

`bootstrap`：

- 扫描仓库中已对齐的源文档和目标文档
- 写入第一个 `.docplaybook/playbook.md`
- 写入第一个 `.docplaybook/memories/<lang>.md`

这是一个冷启动步骤。之后它不会保持工作区同步。日常更新仍然使用 `translate`、`learn` 和 `lint`。

## `docplaybook translate`

```bash
pnpm exec docplaybook translate .
```

当源文档已更改且目标文档需要跟进时使用此命令。

`translate` 是基于状态的：

- 如果目标文档对应的源哈希未更改且目标已存在，则跳过
- 如果源哈希已更改或目标缺失，则安全地刷新目标文章

你可以将运行限制为选定的语言：

```bash
pnpm exec docplaybook translate . --langs ja
pnpm exec docplaybook translate . --langs en,ja
```

## `docplaybook learn`

```bash
pnpm exec docplaybook learn .
```

在审阅者编辑了翻译文档并且你希望这些修正成为可重用的项目指导时使用此命令。

`learn` 也是基于状态的：

- 如果自上次 learn 运行以来目标哈希未更改，则跳过
- 如果目标已更改，它会读取当前的源/目标对并更新 `playbook.md` 和 `memories/<lang>.md`

你可以将学习限制为选定的语言：

```bash
pnpm exec docplaybook learn . --langs ja
```

## `docplaybook lint`

```bash
pnpm exec docplaybook lint .
```

使用此命令可将翻译文档与源文档和当前项目指南进行对比审查。

典型变体：

```bash
pnpm exec docplaybook lint . --fix
pnpm exec docplaybook lint . --scope all
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
