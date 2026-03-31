# Advanced

This page covers the translation model behind DocPlaybook: how it keeps block-level precision while translating at the article level.

## Translate model

DocPlaybook keeps block-level structure but uses article-level translation requests.

### How it works

1. Parse the source Markdown into blocks.
2. Compare the current source with the stored runtime baseline.
3. Find the target blocks that need regeneration.
4. Send one translation request for the target article.
5. Split the returned result by block id.
6. Replace only the changed target positions.
7. Preserve the rest of the translated document as-is.

### Why this model

- Block-level diff keeps replacements precise.
- One request per target article reduces repeated prompt overhead.
- Article-level concurrency is easier to reason about than block-level concurrency.

## Baseline safety

Translation is baseline-based.

That means DocPlaybook does not treat the target file as disposable output. It compares:

- the current source document
- the stored source baseline
- the stored generated target baseline
- the current target document

This reduces the risk of destroying an entire translated page just because a few source blocks changed.

In normal translation runs, only the target positions that actually need regeneration are replaced.

## Related pages

- [Config](/guide/config)
- [Agents](/guide/agents)
- [Memory](/guide/memory)
- [Project Workflow](/guide/workflow)
- [CI](/guide/ci)
