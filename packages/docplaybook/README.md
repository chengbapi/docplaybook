# docplaybook

CLI for Markdown translation sync — translate docs with an LLM, learn from human edits, and keep translations in sync automatically.

## Quick start

```bash
# Install
npm install -g docplaybook

# Initialize in your docs repo
docplaybook init .

# Preview what would be translated (no LLM calls)
docplaybook translate --dry

# Translate stale and missing files
docplaybook translate
```

## How it works

DocPlaybook has two verbs and three knowledge assets.

**Two verbs:**

- `translate` — sync source docs to target languages using an LLM. Skips files whose source hash hasn't changed.
- `learn` — read current source/target pairs and extract reusable rules from human edits. Interactive by default.

**Three knowledge assets** stored in `.docplaybook/`:

| File | Purpose |
|---|---|
| `glossary/<lang>.json` | Deterministic term pairs applied as post-processing patches |
| `memories/<lang>.md` | Per-language style and terminology rules injected into the LLM prompt |
| `playbook.md` | Cross-language rules (voice, protected terms, translation rules) |

Translation state is tracked in `.docplaybook/state/source-hashes.json` and committed to git so the whole team shares progress.

## Commands

| Command | Description |
|---|---|
| `docplaybook init [workspace]` | Detect layout, create config, prompt for provider and languages |
| `docplaybook translate [path]` | Translate stale and missing files |
| `docplaybook learn [path]` | Extract reusable rules from human-edited translations |
| `docplaybook status [workspace]` | Show translation completion % per language |
| `docplaybook bootstrap [workspace]` | Build initial memory from existing translated docs |

### translate flags

| Flag | Description |
|---|---|
| `--dry` | Show what would be translated and estimated token cost |
| `--force` | Retranslate even if source hash matches |
| `--langs zh,ja` | Limit to specific languages |

### learn flags

| Flag | Description |
|---|---|
| `--no-interactive` | Auto-save all candidates (for CI) |
| `--force` | Relearn even if target hash matches |

## Model setup

DocPlaybook supports OpenAI, Anthropic, and any OpenAI-compatible provider. Set the model in `.docplaybook/config.json`:

**OpenAI:**
```json
{
  "model": {
    "kind": "openai",
    "model": "gpt-4o",
    "apiKeyEnv": "OPENAI_API_KEY"
  }
}
```

**Anthropic:**
```json
{
  "model": {
    "kind": "anthropic",
    "model": "claude-sonnet-4-5",
    "apiKeyEnv": "ANTHROPIC_API_KEY"
  }
}
```

**OpenAI-compatible (e.g. DeepSeek):**
```json
{
  "model": {
    "kind": "openai-compatible",
    "providerName": "deepseek",
    "model": "deepseek-chat",
    "baseUrlEnv": "DEEPSEEK_BASE_URL",
    "apiKeyEnv": "DEEPSEEK_API_KEY"
  }
}
```

API keys are always read from environment variables — never stored in config.

## GitHub Action

Add to your repo to automatically translate on push:

```yaml
# .github/workflows/translate.yml
name: Translate docs
on:
  push:
    branches: [main]
    paths: ['docs/**/*.md']
jobs:
  translate:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: docplaybook/docplaybook@v1
        with:
          working-directory: '.'
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Supported layouts

DocPlaybook auto-detects your docs framework:

| Layout | Source | Target |
|---|---|---|
| `sibling` (default) | `guide.md` | `guide.zh.md`, `guide.ja.md` |
| `docusaurus` | `docs/guide.md` | `i18n/zh/docusaurus-plugin-content-docs/current/guide.md` |
| `rspress` | `docs/en/guide.md` | `docs/zh/guide.md` |
| `vitepress` | `docs/guide.md` | `docs/zh/guide.md` |

## Full documentation

[https://chengbapi.github.io/docplaybook/](https://chengbapi.github.io/docplaybook/)
