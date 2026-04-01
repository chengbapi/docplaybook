# Local Workflow

Most teams use an explicit local loop for source changes, and a separate `learn` step after reviewer edits.

## Source-change loop

For day-to-day source updates:

1. `docplaybook translate .`
2. `docplaybook lint . --fix`

This works well because:

- `translate` catches up stale or missing target docs
- `lint --fix` cleans up safe issues before review

## Reviewer-edit loop

When reviewers changed translated docs:

1. `docplaybook learn .`
2. `docplaybook lint . --scope changed`

This keeps reusable guidance files reviewable in normal code review.

## Package scripts

```json
{
  "scripts": {
    "docs:translate": "docplaybook translate .",
    "docs:learn": "docplaybook learn .",
    "docs:lint": "docplaybook lint . --fix",
    "docs:sync": "docplaybook translate . && docplaybook lint . --fix"
  }
}
```

Run them with your package manager:

```bash
pnpm docs:sync
npm run docs:sync
yarn docs:sync
```

## Git hook

A practical local hook pattern is to run lint before pushing:

```bash
pnpm exec docplaybook lint . --fix
```

This gives explicit findings before code review starts.
