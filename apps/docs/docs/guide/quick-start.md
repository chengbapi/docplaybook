# Quick Start

## 1. Initialize a workspace

```bash
docplaybook init ./my-docs
```

The init flow will:

- choose a model provider and model
- collect the required credentials
- test model connectivity
- detect the workspace layout when possible
- detect the source language
- ask for target languages
- create `.docplaybook/config.json` and memory files

## 2. Run translate, learn, or the default flow

```bash
docplaybook translate ./my-docs
docplaybook learn ./my-docs
docplaybook ./my-docs
docplaybook lint ./my-docs
```

- `translate`: update target docs from the source language
- `learn`: scan manual edits and update language memories
- default command: run `learn` first, then `translate`
- `lint`: score translations against the current memory and report concrete issues

## 3. Inspect the result

Supported layouts:

```text
sibling:
guide.md
guide.en.md
guide.ja.md

docusaurus:
docs/guide/intro.md
i18n/en/docusaurus-plugin-content-docs/current/guide/intro.md

rspress:
docs/guide/intro.md
docs/en/guide/intro.md
```

## 4. Use logs when needed

Detailed logs:

```bash
docplaybook ./my-docs --verbose
```

Debug logs:

```bash
docplaybook ./my-docs --debug
```
