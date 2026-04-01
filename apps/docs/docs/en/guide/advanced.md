# Advanced

This page covers the state-driven execution model behind DocPlaybook: how translation stays block-aware without depending on Git before/after baselines.

## Translate model

DocPlaybook keeps block-level structure but uses article-level translation requests.

### How it works

1. Parse the current source Markdown into blocks.
2. Compute a source hash for the current source file.
3. Compare that hash with the last saved hash for each target document.
4. Skip the target when the source hash is unchanged and the target already exists.
5. Read the current target document, if it exists.
6. Send one translation request for the target article when the source changed or the target is missing.
7. Split large articles into smaller batch requests when needed.
8. Reassemble the translated result and write the refreshed target document safely.

### Why this model

- Source-hash state makes the "should I process this file?" decision very cheap.
- One request per target article reduces repeated prompt overhead.
- Article-level concurrency is easier to reason about than block-level concurrency.
- Large documents can be chunked without changing the top-level "one target article" mental model.

## Learn model

`docplaybook learn` is also state-driven.

For each target document, DocPlaybook:

1. checks whether the current target hash was already learned
2. reads the current source document
3. reads the current target document
4. asks the LLM which observations are reusable guidance
5. writes reusable cross-language rules to `playbook.md`
6. writes reusable target-language rules to `memories/<lang>.md`

This makes learn simpler, but also means it is closer to "extract rules from the current source/target pair" than "reconstruct the exact reviewer diff".

## Bootstrap model

`docplaybook bootstrap --langs ...` is the cold-start path for existing docs sites.

It:

- scans aligned source/target pairs that already exist in the repo
- builds a first global playbook
- builds a first language memory for each selected locale

Bootstrap does not create complex hidden baselines. It only updates the Markdown memory files inside the repo.

## Safety model

The current design is intentionally simple:

- `.docplaybook/state/*` tracks whether a source or target version was already processed
- Markdown block parsing finds structural units
- the LLM judges semantic meaning and reusable guidance
- memory files persist long-term project knowledge

There is no Git baseline reconstruction step for `translate` or `learn`.

## Related pages

- [Config](/guide/config)
- [Agents](/guide/agents)
- [Memory](/guide/memory)
- [Project Workflow](/guide/workflow)
- [CI](/guide/ci)
