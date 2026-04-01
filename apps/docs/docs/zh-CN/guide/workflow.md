# 项目工作流

安装和初始化后，大多数团队会将 DocPlaybook 转换为可重复的项目工作流。

如果想查看每个模型交互的可视化说明，请参阅 [Flow Demo](/guide/demo)。

## 推荐的本地循环

对于日常工作，最有用的明确本地步骤顺序是：

1. `docplaybook translate .`
2. `docplaybook lint . --fix`

之所以有效，是因为：

- `translate` 会在源内容更改或目标缺失时刷新目标文档
- `lint --fix` 在拉取请求前清理可安全修复的翻译问题
- `learn` 保持为人工触发，可在审阅者编辑后运行，而不是在每次源更改时运行

当审阅者编辑了翻译后，将 `docplaybook learn .` 作为单独的本地步骤运行。它会更新 `playbook.md` 和 `memories/<lang>.md`，因此这些更改应像其他源文件一样进行审查。

默认命令 `docplaybook .` 当前会运行：

1. `docplaybook learn .`
2. `docplaybook translate .`

## 添加包脚本

大多数团队会先添加包脚本：

```json
{
  "scripts": {
    "docs:translate": "docplaybook translate .",
    "docs:learn": "docplaybook learn .",
    "docs:lint": "docplaybook lint . --fix",
      "docs:sync": "docplaybook translate . && docplaybook lint . --fix"
  }
}
```

然后使用你的包管理器运行它们：

```bash
pnpm docs:sync
npm run docs:sync
yarn docs:sync
```

## 手动使用

常见的手动操作模式包括：

- 如果仓库已包含翻译文档，在 `init` 之后运行一次 `docplaybook bootstrap . --langs en,ja`
- 在审阅者编辑翻译后运行 `docplaybook learn .`
- 当源文档更改时运行 `docplaybook translate .`
- 在合并前运行 `docplaybook lint . --fix`
- 当你想对整个工作区进行全面检查而非仅检查更改的文件时，运行 `docplaybook lint . --scope all`

如果你只想在某个分支上处理选定的语言，请添加 `--langs`：

```bash
pnpm exec docplaybook translate . --langs ja
pnpm exec docplaybook learn . --langs ja
pnpm exec docplaybook lint . --fix --langs ja
```

## Git 钩子

一种轻量级的钩子模式是在推送之前进行 lint 检查：

```bash
pnpm exec docplaybook lint . --fix
```

当你希望在代码审查开始前获得明确的问题发现时，这种方式很适合。

## CI
