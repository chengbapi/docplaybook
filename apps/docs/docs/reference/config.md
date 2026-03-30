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

## Fields

### `sourceLanguage`

The source language of the workspace.

### `targetLanguages`

The list of target languages to generate and keep in sync.

### `ignorePatterns`

Additional globs to ignore during scanning.

### `concurrency.maxConcurrentRequests`

Article-level concurrency. It controls how many target articles can be translated at the same time.

### `layout.kind`

Supported values:

- `sibling`
- `docusaurus`
- `rspress`

`init` will try to detect the layout from the project structure. If it cannot detect Docusaurus or Rspress, it falls back to `sibling`.

### `model`

The model provider and model id used for translation and memory updates.

## Memory format

Each `.docplaybook/memories/<target>.md` file is expected to include:

- `## Terminology`
- `## Tone & Style`
- `## Formatting & Markdown`
- `## Protected Terms`
- `## Review Notes`

If `lint` finds missing sections, it reports them as memory issues. `lint --fix` also writes the missing standard sections back to the file.
