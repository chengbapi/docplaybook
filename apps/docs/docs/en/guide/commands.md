# Commands

Full CLI reference for DocPlaybook. All commands accept an optional path argument to scope the operation to a specific file, directory, or workspace root.

## `docplaybook init [workspace]`

```bash
docplaybook init .
docplaybook init ./my-docs
```

Initializes a DocPlaybook workspace. Run this once per project before using `translate` or `learn`.

During init, DocPlaybook will:

- auto-detect your docs framework layout (Docusaurus, Rspress, VitePress, or `sibling`)
- prompt for source language and target languages
- prompt for model provider, model name, and API key environment variable
- run a connectivity check against the model
- create `.docplaybook/config.json`
- create `.docplaybook/memories/<lang>.md` for each target language
- create `.docplaybook/playbook.md`
- create `.docplaybook/.gitignore`

If the repo already contains translated docs, `init` will suggest running `bootstrap` to seed the initial memory from existing translations.

**Options:**

| Flag | Description |
|---|---|
| `--source <lang>` | Source language code (e.g. `en`, `zh-CN`) |
| `--targets <langs>` | Comma-separated target language codes (e.g. `zh,ja`) |
| `--layout <kind>` | Force layout: `sibling`, `docusaurus`, `rspress`, `vitepress` |
| `--model-kind <kind>` | Model provider: `openai`, `anthropic`, `openai-compatible`, `gateway` |
| `--model <id>` | Model ID (e.g. `gpt-4o`, `claude-sonnet-4-5`) |
| `--api-key-env <name>` | Environment variable name for the API key |
| `--force` | Re-initialize even if config already exists |

---

## `docplaybook translate [path]`

```bash
docplaybook translate
docplaybook translate .
docplaybook translate docs/guide/introduction.md
docplaybook translate docs/guide/
```

Translates source files to all configured target languages. Skips files where the source hash has not changed since the last translation.

The path argument scopes the operation. You can pass a workspace root, a subdirectory, or a single file.

Glossary terms in `.docplaybook/glossary/<lang>.json` are applied as deterministic post-processing patches after LLM translation. Memory rules from `.docplaybook/memories/<lang>.md` and `.docplaybook/playbook.md` are injected into the LLM system prompt.

**Options:**

| Flag | Description |
|---|---|
| `--dry` | Show what would be translated and estimated token cost. No LLM calls are made. |
| `--force` | Retranslate all files, even if the source hash matches. |
| `--langs <langs>` | Comma-separated list of target languages to translate (e.g. `zh,ja`). |
| `--lang <lang>` | Single target language to translate. |

**Examples:**

```bash
# Preview without translating
docplaybook translate --dry

# Translate everything
docplaybook translate .

# Translate only Japanese
docplaybook translate --lang ja

# Force-retranslate specific languages
docplaybook translate --langs zh,ja --force

# Translate a single file
docplaybook translate docs/guide/introduction.md
```

---

## `docplaybook learn [path]`

```bash
docplaybook learn
docplaybook learn .
docplaybook learn docs/guide/
```

Reads current source and target files and extracts reusable rules from human edits. Skips files where the target hash has not changed since the last `learn` run.

Candidates are classified into four scopes:

| Scope | Written to |
|---|---|
| `glossary` | `.docplaybook/glossary/<lang>.json` |
| `memory` | `.docplaybook/memories/<lang>.md` |
| `playbook` | `.docplaybook/playbook.md` |
| `ignore` | Discarded |

**Interactive mode (default in a TTY):** each candidate is shown one at a time. Press:
- `a` or Enter — accept as-is
- `e` — open an editor to modify before saving
- `s` — skip this candidate
- `q` — quit and save accepted candidates so far

**Non-interactive mode:** use `--no-interactive` to auto-accept all candidates. Suitable for CI pipelines.

**Options:**

| Flag | Description |
|---|---|
| `--no-interactive` | Auto-save all candidates without prompting. |
| `--force` | Relearn even if the target hash matches. |
| `--langs <langs>` | Comma-separated list of target languages to learn from. |
| `--lang <lang>` | Single target language to learn from. |

**Examples:**

```bash
# Interactive learn (normal local use)
docplaybook learn .

# Non-interactive for CI
docplaybook learn . --no-interactive

# Learn only from Japanese translations
docplaybook learn --lang ja --force
```

---

## `docplaybook status [workspace]`

```bash
docplaybook status
docplaybook status .
```

Read-only. Shows translation completion per language. Does not call the LLM.

Output includes:

- percentage complete per language
- count of up-to-date, stale, and missing files
- count of memory rules per language
- count of glossary terms per language
- suggestion to run `translate` if stale or missing files exist

**Example output:**

```
zh   84%  42 up to date  6 stale  2 missing   18 memory rules  34 glossary terms
ja   91%  46 up to date  2 stale  2 missing   12 memory rules  21 glossary terms

Run `docplaybook translate` to sync stale and missing files.
```

---

## `docplaybook bootstrap [workspace]`

```bash
docplaybook bootstrap . --langs ja
docplaybook bootstrap . --langs zh,ja
```

One-time command. Builds initial memory files from existing translated docs already in the repo. Use this after `init` when the project already has aligned source and target files.

`bootstrap` scans aligned source/target document pairs and uses the LLM to infer:

- `.docplaybook/playbook.md`
- `.docplaybook/memories/<lang>.md` for each specified language

It is a cold-start step. After bootstrapping, normal maintenance uses `translate` and `learn`.

**Options:**

| Flag | Description |
|---|---|
| `--langs <langs>` | Required. Comma-separated target languages to bootstrap. |
| `--lang <lang>` | Required (alternative). Single target language. |

---

## Global flags

These flags apply to all commands:

| Flag | Description |
|---|---|
| `--verbose` | Show detailed per-file progress output. |
| `--debug` | Show debug-level output including prompt sizes, queue times, and model call status. |
| `--help` | Show command help. |
