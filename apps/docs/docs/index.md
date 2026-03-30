# docplaybook

`docplaybook` is a local-first CLI for Markdown translation sync.

It keeps block-level diffing and replacement, but translates each target article with a single model request. It also learns reusable translation rules from human edits and stores them in project-level memory files.

## Why it exists

- Keep translated docs in sync without rewriting entire files.
- Reuse human terminology and style corrections across the project.
- Make translation decisions visible and versionable through Markdown memory files.

## Highlights

- One request per target article
- Block-level diff and replacement
- Project-level translation memory
- Article-level concurrency control
- Local-first workspace setup

## Get started

```bash
pnpm add -g docplaybook
docplaybook init ./my-docs
docplaybook auto ./my-docs
```

Continue with [Quick Start](/guide/quick-start) or inspect the [config reference](/reference/config).
