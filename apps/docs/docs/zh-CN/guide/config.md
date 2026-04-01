# 配置

项目配置位于：

```text
<workspace>/.docplaybook/config.json
```

该文件以 JSONC 格式读取，因此允许使用注释。

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

扫描过程中需要忽略的额外 glob 模式。

### `concurrency.maxConcurrentRequests`

文章级并发。它控制可以同时翻译多少目标文章。

默认值为 `6`。当前实现将有效运行时限制上限封顶为 `20`，即使你在配置或覆盖环境变量中设置了更高的值也如此。

用于快速试验，你可以临时使用以下方式覆盖配置值：

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

DocPlaybook 不假定首选的 LLM 供应商。团队可以根据其质量、成本和策略需求选择合适的提供商。

在实践中，许多团队为了保持一致性，会将 `model` 保存在 `config.json` 中：

- 本地开发使用相同的提供商和模型
- CI 使用相同的提供商和模型
- 翻译的语气和术语在多次运行中保持更稳定

如果团队希望为每个用户提供自由度，则可以在 `init` 过程中将模型设置保留为本地配置。

## 本地与 CI 的模型设置

对于混合本地与 CI 的使用场景，有两种推荐的模式。

### 推荐：共享模型，不同密钥

将提供商和模型保存在 `config.json` 中。

然后：

- 本地开发者将机密放在 `.docplaybook/.env.local` 中
- CI 通过环境变量注入机密

这可以保持翻译和 lint 行为在不同环境之间的稳定性。

### 灵活：本地与 CI 使用不同模型

如果本地开发与 CI 需要不同的提供商或模型 ID，请将 `model` 保持在 `config.json` 之外。
