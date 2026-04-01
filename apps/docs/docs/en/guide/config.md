# Config

Project config lives in:

```text
<workspace>/.docplaybook/config.json
```

The file is read as JSONC, so comments are allowed.

## Example

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

## Important fields

### `sourceLanguage`

The source language of the workspace.

### `targetLanguages`

The list of target languages to generate and keep translated.

### `ignorePatterns`

Additional globs to ignore during scanning.

### `concurrency.maxConcurrentRequests`

Article-level concurrency. It controls how many target articles can be translated at the same time.

The default is `6`. The current implementation caps the effective runtime limit at `20`, even if you set a higher value in config or an override env var.

For quick experiments, you can temporarily override the config value with:

```bash
DOCPLAYBOOK_MAX_CONCURRENT_REQUESTS=12 pnpm exec docplaybook translate .
```

### `layout.kind`

Supported values:

- `sibling`
- `docusaurus`
- `rspress`
- `vitepress`

`init` tries to detect the layout from the project structure. If it cannot detect a supported framework, it falls back to `sibling`.

### `model`

The model provider and model id used for translation and memory updates.

DocPlaybook does not assume a preferred LLM vendor. Teams can choose the provider that fits their quality, cost, and policy needs.

In practice, many teams keep `model` in `config.json` for consistency:

- local development uses the same provider and model
- CI uses the same provider and model
- translation tone and terminology stay more stable across runs

If a team wants per-user freedom instead, model settings can also be kept local during `init`.

## Local vs CI model setup

There are two good patterns for mixed local and CI usage.

### Recommended: shared model, different secrets

Keep the provider and model in `config.json`.

Then:

- local developers put secrets in `.docplaybook/.env.local`
- CI injects secrets through environment variables

This keeps translation and lint behavior stable across environments.

### Flexible: different model in local and CI

If local development and CI need different providers or model ids, keep `model` out of `config.json`.

Then:

- local sets `DOCPLAYBOOK_MODEL_*` in `.docplaybook/.env.local`
- CI sets the same `DOCPLAYBOOK_MODEL_*` variables in the pipeline

This is supported, but it usually makes translation output less consistent between local runs and CI.
