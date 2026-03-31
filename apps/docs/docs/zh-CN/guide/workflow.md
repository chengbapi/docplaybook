# 项目工作流

安装并初始化之后，大多数团队会将 DocPlaybook 转变为可复用的项目工作流程。

如果你想要每个模型交互的可视化说明，请参阅 [流程演示](/guide/demo)。

## 推荐的本地循环

在日常工作中，最有用的本地顺序是：

1. `docplaybook learn .`
2. `docplaybook translate .`
3. `docplaybook lint . --fix`

这样做效果好的原因是：

- `learn` 将可复用的项目指导写入 `playbook.md` 和 `memories/<lang>.md`
- `translate` 根据 Git 跟踪的源文件更改刷新目标文档
- `lint --fix` 在拉取请求之前修复安全的翻译问题

`learn` 应该在本地开发中运行，因为它会修改应在代码评审中审查的项目指导文件。

## 添加包脚本

大多数团队首先添加包脚本：

```json
{
  "scripts": {
    "docs:translate": "docplaybook translate .",
    "docs:learn": "docplaybook learn .",
    "docs:lint": "docplaybook lint . --fix",
    "docs:i18n": "docplaybook learn . && docplaybook translate . && docplaybook lint . --fix"
  }
}
```

然后使用你的包管理器运行它们：

```bash
pnpm docs:i18n
npm run docs:i18n
yarn docs:i18n
```

## 手动使用

常见的手动操作模式包括：

- 若仓库已有翻译文档，则在 `init` 之后运行一次 `docplaybook bootstrap . --langs en,ja`
- 在审阅者编辑完翻译后运行 `docplaybook learn .`
- 当源文档发生更改时运行 `docplaybook translate .`
- 在合并前运行 `docplaybook lint . --fix`
- 当你希望对整个工作区进行完整审查而不仅仅是更改的文件时，运行 `docplaybook lint . --scope all`

如果你只想在某个分支上处理选定的语言区域，请添加 `--langs`：

```bash
pnpm exec docplaybook translate . --langs ja
pnpm exec docplaybook learn . --langs ja
pnpm exec docplaybook lint . --fix --langs ja
```

## Git 钩子

一种轻量级的钩子模式是在推送之前运行 lint：

```bash
pnpm exec docplaybook lint . --fix
```

当你希望在代码评审开始前得到明确的问题反馈时，这很合适。

## CI

CI 通常是团队集中管理单一提供者、单一模型和统一翻译预算的地方。

有关 CI 特定的设置、提供者策略和示例流程，请参见 [持续集成（CI）](/guide/ci)。
