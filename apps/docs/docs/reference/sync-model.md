# Sync Model

docplaybook keeps block-level structure but uses article-level translation requests.

## How it works

1. Parse the source Markdown into blocks.
2. Compare the current source with the stored runtime baseline.
3. Find the target blocks that need regeneration.
4. Send one translation request for the target article.
5. Split the returned result by block id.
6. Replace only the changed target positions.

## Why this model

- Block-level diff keeps replacements precise.
- One request per target article reduces repeated prompt overhead.
- Article-level concurrency is easier to reason about than block-level concurrency.

## Memory learning

When a human edits a generated translation, docplaybook:

1. compares the current target file with the generated baseline
2. asks the model whether the change is a major rewrite
3. extracts reusable corrections
4. updates the language-pair memory file

Memory files are stored in:

```text
.docplaybook/memories/<target>.md
```

Each memory file follows a standard structure:

- `## Terminology`
- `## Tone & Style`
- `## Formatting & Markdown`
- `## Protected Terms`
- `## Review Notes`

## Lint

`docplaybook lint` compares:

1. the source document
2. the translated document
3. the current language memory

It returns multi-dimensional scores plus explicit findings, and `--fix` can apply block-safe replacements automatically.
