# 配置

项目配置位于：

```text
<workspace>/.docplaybook/config.json
```

该文件以 JSONC 格式读取，因此允许注释。

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

扫描时要忽略的额外 glob 模式。

### `concurrency.maxConcurrentRequests`

文章级并发。它控制可以同时翻译多少个目标文章。

### `layout.kind`

支持的值：

- `sibling`
- `docusaurus`
- `rspress`
- `vitepress`

`init` 会尝试从项目结构检测布局。如果无法检测到受支持的框架，则回退到 `sibling`。

### `model`

用于翻译和记忆更新的模型提供商及模型 ID。

DocPlaybook 不假定首选的 LLM 供应商。团队可以选择符合其质量、成本和策略需求的提供商。

在实践中，许多团队为了保持一致性，会将 `model` 保存在 `config.json` 中：

- 本地开发使用相同的提供商和模型
- CI 使用相同的提供商和模型
- 翻译语气和术语在多次运行间保持更稳定

如果团队希望为每个用户保留自由度，则可以在 `init` 期间将模型设置保存在本地。

## 本地与 CI 的模型设置

针对混合本地和 CI 使用，有两种推荐模式。

### Recommended: shared model, different secrets

在 `config.json` 中保留提供商和模型。

然后：

- 本地开发者将密钥放在 `.docplaybook/.env.local`
- CI 通过环境变量注入密钥

这可使翻译和 lint 行为在不同环境之间保持稳定。

### Flexible: different model in local and CI

如果本地开发和 CI 需要不同的提供商或模型 ID，请将 `model` 放在 `config.json` 之外。

然后：

- 本地在 `.docplaybook/.env.local` 中设置 `DOCPLAYBOOK_MODEL_*`
- CI 在流水线中设置相同的 `DOCPLAYBOOK_MODEL_*` 变量

这是受支持的，但通常会使本地运行与 CI 之间的翻译输出不那么一致。
