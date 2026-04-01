# Revise

`learn` turns reviewer edits into reusable guidance.

## What it does

For each target document, DocPlaybook:

1. checks whether the current target hash was already learned
2. skips the target if that exact version was already processed
3. reads the current source and target documents
4. asks the model which observations should become reusable guidance
5. updates:
   - `.docplaybook/playbook.md`
   - `.docplaybook/memories/<lang>.md`

This means `learn` is based on the current source/target pair, not on a Git before/after diff.

## When to run it

Use `learn` after reviewers made important edits to translated docs.

Typical cases:

- a terminology correction should become project-wide guidance
- a target-language style decision should be reused later
- a reviewer clarified how a product term should appear in one locale

## Typical usage

Learn across all configured target languages:

```bash
pnpm exec docplaybook learn .
```

Learn only one locale:

```bash
pnpm exec docplaybook learn . --langs ja
```

Force a relearn:

```bash
pnpm exec docplaybook learn . --force
```

Or with the explicit alias:

```bash
pnpm exec docplaybook relearn .
```

## Guidance split

Keep this distinction clear:

- `playbook.md` stores shared project knowledge
- `memories/<lang>.md` stores target-language guidance
- `.docplaybook/state/*.json` stores branch progress only
