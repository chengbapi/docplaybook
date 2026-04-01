# CI

在 CI 中运行 `DocPlaybook` 通常是团队文档工作流的一个稳健默认选择。

## 为什么在 CI 中运行它

- 团队可以统一使用一个提供商和一个模型
- 翻译质量和语调在不同运行之间更稳定
- 成本可以集中到团队账户或 CI 预算中
- 文档作者不需要各自配置 LLM，仅为保持翻译一致性

## 常见的 CI 职责

最常见的 CI 任务包括：

- `docplaybook translate`
  - 生成或刷新来自源内容的翻译文档
- `docplaybook lint`
  - 根据当前的记忆标准审查翻译文档

在 CI 中，`lint` 通常以以下方式运行效果最好：

- `docplaybook lint . --fix --scope changed`
  - 自动修复可安全修复的问题
  - 只修改当前 git 工作树中已更改的翻译文件
- `docplaybook lint . --fix --scope changed --langs ja`
  - 相同行为，但仅针对所选语言（当你的流水线按语言拆分时）

`learn` 通常不是 CI 任务。它会更改 `playbook.md` 和 `memories/<lang>.md`，因此这些修改通常应在本地创建并在代码审查中进行审核。

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

## 提供商和模型

DocPlaybook 不要求使用特定的 LLM 提供商。你可以选择适合你们团队的提供商。

有两种实用的模式：

### 在配置中锁定模型

在 `.docplaybook/config.json` 中保留 provider 和 model，以便：

- 本地运行与 CI 运行的行为相同
- 翻译输出更可预测
- lint 结果更容易随时间比较

在此模式下，本地和 CI 仍可使用不同的密钥：

- 本地开发者将密钥保存在 `.docplaybook/.env.local`
- CI 通过环境变量注入密钥

### 将模型保留在各环境本地

如果本地开发者需要一个 provider/model 而 CI 需要另一个，则不要在 `config.json` 中锁定 `model`。

相反：

- 本地使用 `.docplaybook/.env.local`
- CI 在流水线中设置 `DOCPLAYBOOK_MODEL_*` 变量和 provider 的密钥

这种方式更灵活，但本地运行与 CI 运行之间的输出可能更容易发生偏差。

## 示例流程

```bash
pnpm exec docplaybook translate .
pnpm exec docplaybook lint . --fix --scope changed
```

如果你还想要一个定期的完整审查作业：

```bash
pnpm exec docplaybook lint . --scope all
```

## 拉取请求的使用

一个实用的 CI 模式是：

1. 运行 `docplaybook translate .`
2. 提交或上传生成的翻译更改
3. 运行 `docplaybook lint . --fix --scope changed`
4. 如果 lint 发现不可接受的问题，则使作业失败

这会同时为审阅者提供更新后的翻译文件以及具体的质量发现。
