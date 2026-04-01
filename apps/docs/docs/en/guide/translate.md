# Translate

`translate` keeps target docs aligned with source docs.

## What it does

For each target document, DocPlaybook:

1. parses the current source document
2. computes the current source hash
3. compares that hash with the last saved hash for the target
4. skips the target if the hash is unchanged and the target already exists
5. refreshes the target article if the source changed or the target is missing

This is article-level translation with structure-aware writeback. It is not Git diff translation.

## Typical usage

Catch up all configured target languages:

```bash
pnpm exec docplaybook translate .
```

Limit the run to one locale:

```bash
pnpm exec docplaybook translate . --langs ja
```

Force a full refresh:

```bash
pnpm exec docplaybook translate . --force
```

Or with the explicit alias:

```bash
pnpm exec docplaybook retranslate .
```

## What stays safe

Translation remains block-aware even though the processing decision is document-level.

DocPlaybook preserves:

- Markdown structure
- code fences
- frontmatter structure
- protected framework-specific fields

For `Rspress`, this also includes the framework-specific resources covered by `layout.kind = "rspress"`:

- regular docs under `docs/<lang>/...`
- `_nav.json`
- `_meta.json`
- locale entries inside `i18n.json`
- whitelisted homepage frontmatter fields in `index.md`
