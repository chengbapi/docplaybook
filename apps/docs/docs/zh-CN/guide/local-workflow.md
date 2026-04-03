# 本地工作流程

大多数团队在源更改时使用明确的本地循环，并在审阅者编辑之后运行单独的 `learn` 步骤。

## 源更改循环

用于日常源更新：

1. `docplaybook translate .`
2. `docplaybook lint . --fix`

这样做很有效，因为：

- `translate` 会补上过时或缺失的目标文档
- `lint --fix` 在审阅前清理可自动修复的问题

## 审阅者编辑循环

当审阅者更改已翻译的文档时：

1. `docplaybook learn .`
2. `docplaybook lint . --scope changed`

这样可以让可复用的指导文件在常规代码审查中保持可审阅。

## 包脚本

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

通过您的包管理器运行它们：

```bash
pnpm docs:sync
npm run docs:sync
yarn docs:sync
```

## `Git` 钩子

一个实用的本地钩子模式是在推送之前运行 `lint`：

```bash
pnpm exec docplaybook lint . --fix
```

这会在代码审查开始前给出明确的问题反馈。
