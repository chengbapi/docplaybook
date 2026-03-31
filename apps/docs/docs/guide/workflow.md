# Project Workflow

After installation and initialization, most teams turn DocPlaybook into a repeatable project workflow.

## Recommended local loop

For day-to-day work, the most useful local sequence is:

1. `docplaybook translate .`
2. `docplaybook learn .`
3. `docplaybook lint . --fix`

This works well because:

- `translate` refreshes target docs from source changes
- `learn` writes reusable project guidance into `playbook.md` and `memories/<lang>.md`
- `lint --fix` cleans up safe translation issues before the pull request

`learn` belongs in local development because it changes project guidance files that should be reviewed in code review.

## Add package scripts

Most teams add package scripts first:

```json
{
  "scripts": {
    "docs:translate": "docplaybook translate .",
    "docs:learn": "docplaybook learn .",
    "docs:lint": "docplaybook lint . --fix",
    "docs:i18n": "docplaybook translate . && docplaybook learn . && docplaybook lint . --fix"
  }
}
```

Then run them with your package manager:

```bash
pnpm docs:i18n
npm run docs:i18n
yarn docs:i18n
```

## Manual usage

Common manual patterns are:

- run `docplaybook translate .` when source docs changed
- run `docplaybook learn .` after reviewers have edited translations
- run `docplaybook lint . --fix` before merge
- run `docplaybook lint . --scope all` when you want a full workspace review instead of only changed files

If you only want to work on selected locales in one branch, add `--langs`:

```bash
pnpm exec docplaybook translate . --langs ja
pnpm exec docplaybook learn . --langs ja
pnpm exec docplaybook lint . --fix --langs ja
```

## Git hooks

A lightweight hook pattern is to lint before pushing:

```bash
pnpm exec docplaybook lint . --fix
```

This is a good fit when you want explicit findings before code review starts.

## CI

CI is usually where teams centralize one shared provider, one shared model, and one shared translation budget.

For the CI-specific setup, provider strategy, and example flows, see [CI](/guide/ci).
