# 配置

项目配置位于：

```text
<workspace>/.docplaybook/config.json
```

同一 `.docplaybook/` 目录还包含：

- `playbook.md`
- `memories/<lang>.md`
- `state/source-hashes.json`
- `state/learned-target-hashes.json`

`state/*.json` 文件是用于跟踪进度的文件。它们应当被提交，这样切换分支时可以恢复处理进度。

`config.json` 以 JSONC 格式读取，因此允许注释。

## 示例

```json
{
  "version": 1,
  "sourceLanguage": "zh-CN",
  "targetLanguages": ["en", "ja"],
  "ignorePatterns": ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.docplaybook/**"],
  "concurrency": {
    "maxConcurrentRequests": 6
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

## 重要字段

### `sourceLanguage`

工作区的源语言。

### `targetLanguages`

要生成并保持翻译的目标语言列表。

### `ignorePatterns`

在扫描期间需要忽略的额外 glob 模式。

### `concurrency.maxConcurrentRequests`

文章级并发。它控制可以同时翻译多少目标文章。

默认值为 `6`。当前实现将有效运行时限制封顶为 `20`，即使您在配置或通过覆盖的环境变量中设置了更高的值。

对于快速实验，您可以临时使用以下方式覆盖配置值：

```bash
DOCPLAYBOOK_MAX_CONCURRENT_REQUESTS=12 pnpm exec docplaybook translate .
```

### `layout.kind`

支持的值：

- `sibling`
- `docusaurus`
- `rspress`
- `vitepress`

`init` 会尝试从项目结构检测布局。如果无法检测到受支持的框架，则回退到 `sibling`。

### `model`

用于翻译和记忆更新的模型提供商和模型 ID。

DocPlaybook 不假定首选的 LLM 供应商。团队可以选择符合其质量、成本和政策需求的提供商。

在实践中，许多团队将 `model` 保存在 `config.json` 中以保持一致性：

- 本地开发使用相同的提供商和模型
- CI 使用相同的提供商和模型
- 翻译的语气和术语在多次运行间保持更稳定

如果团队希望每个用户有各自的选择，模型设置也可以在 `init` 期间保存在本地。

## 本地与 CI 的模型设置

对于本地与 CI 混合使用，有两种推荐模式。

### 推荐：共享模型，不同的机密

将提供商和模型保存在 `config.json` 中。

然后：

- 本地开发者将机密放在 `.docplaybook/.env.local`
- CI 通过环境变量注入机密

这能使翻译和 Lint 行为在不同环境中保持稳定。

### 灵活：本地与 CI 使用不同模型

如果本地开发和 CI 需要不同的提供商或模型 ID，请将 `model` 从 `config.json` 中移出。

然后：

- 本地在 `.docplaybook/.env.local` 中设置 `DOCPLAYBOOK_MODEL_*`
- CI 在流水线中设置相同的 `DOCPLAYBOOK_MODEL_*` 变量

这是受支持的，但通常会导致本地运行与 CI 之间的翻译输出不那么一致。
