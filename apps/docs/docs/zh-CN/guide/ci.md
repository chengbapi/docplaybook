# CI

在 CI 中运行 `DocPlaybook` 通常是团队文档工作流程的一个稳健默认选项。

## 为什么在 CI 中运行

- 团队可以在一个提供商和一个模型上实现标准化
- 翻译质量和语气在各次运行中更稳定
- 成本可以集中到团队账户或 CI 预算
- 文档作者不需要为了保持翻译一致而各自配置自己的 LLM

## 典型的 CI 职责

最常见的 CI 任务有：

- `docplaybook translate`
  - 从源内容生成或刷新翻译文档
- `docplaybook lint`
  - 根据当前的 memory 标准审查翻译文档

在 CI 中，`lint` 通常最好以以下方式运行：

- `docplaybook lint . --fix --scope changed`
  - 修复可安全修复的问题
  - 仅修改当前 git 工作树中已更改的翻译文件
- `docplaybook lint . --fix --scope changed --langs ja`
  - 行为相同，但仅针对选定的语言/本地化（当你的流水线按语言拆分时）

`learn` 通常不是 CI 任务。它会修改 `playbook.md` 和 `memories/<lang>.md`，因此这些更改通常应在本地创建并在代码审查中进行审核。

## 包管理器示例

### pnpm

```bash
pnpm exec docplaybook translate .
pnpm exec docplaybook lint . --fix --scope changed
```

### npm

```bash
npx docplaybook translate .
npx docplaybook lint . --fix --scope changed
```

### yarn

```bash
yarn exec docplaybook translate .
yarn exec docplaybook lint . --fix --scope changed
```

## 提供商与模型

DocPlaybook 不要求使用特定的 LLM 提供商。你可以选择适合你团队的提供商。

有两种实用的模式：

### 在配置中锁定模型

将提供商和模型保存在 `.docplaybook/config.json` 中，以便：

- 本地运行与 CI 运行行为一致
- 翻译输出更可预测
- lint 结果更容易随时间比较

在此模式下，本地和 CI 仍然可以使用不同的密钥：

- 本地开发者将密钥保存在 `.docplaybook/.env.local` 中
- CI 通过环境变量注入密钥

### 在每个环境中保持模型本地化

如果本地开发者需要一种提供商/模型，而 CI 需要另一种，请不要在 `config.json` 中锁定 `model`。

相反：

- 本地使用 `.docplaybook/.env.local`
- CI 在流水线中设置 `DOCPLAYBOOK_MODEL_*` 变量和提供商密钥

这种方式更灵活，但本地运行与 CI 运行之间的输出可能会发生更大偏差。

## 示例流程

```bash
pnpm exec docplaybook translate .
pnpm exec docplaybook lint . --fix --scope changed
```

如果你还想要一个定期的完整审查任务：

```bash
pnpm exec docplaybook lint . --scope all
```

## 拉取请求用法

一个实用的 CI 模式是：

1. 运行 `docplaybook translate .`
2. 提交或上传生成的翻译更改
3. 运行 `docplaybook lint . --fix --scope changed`
4. 如果 lint 发现不可接受的问题，则使作业失败

这为审阅者同时提供更新后的翻译文件和明确的质量发现。
