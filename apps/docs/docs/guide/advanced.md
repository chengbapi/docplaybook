# Advanced

This page covers the Git-first execution model behind DocPlaybook: how translation stays block-aware without relying on hidden runtime baselines.

## Translate model

DocPlaybook keeps block-level structure but uses article-level translation requests.

### How it works

1. Parse the current source Markdown into blocks.
2. Read the same source file from Git `HEAD`.
3. Compare the two source snapshots and find changed translatable blocks.
4. Read the current target document, if it exists.
5. Reuse unchanged target blocks when source and target shapes still align.
6. Send one translation request for the target article.
7. Split the returned result by block id and write only the updated target positions.

### Why this model

- Git is the only before/after authority, so the change source is easy to inspect and review.
- Block-level diff keeps replacements precise.
- One request per target article reduces repeated prompt overhead.
- Article-level concurrency is easier to reason about than block-level concurrency.

## Learn model

`docplaybook learn` is also Git-first.

For each changed translated file, DocPlaybook:

1. reads the target file from Git `HEAD`
2. reads the current working tree version
3. parses both into Markdown blocks
4. extracts changed translatable blocks when the shapes still align
5. asks the LLM which edits are reusable guidance
6. writes reusable cross-language rules to `playbook.md`
7. writes reusable target-language rules to `memories/<lang>.md`

If block structure changed too much, the file is skipped for safety instead of trying to infer unstable alignments.

## Bootstrap model

`docplaybook bootstrap --langs ...` is the cold-start path for existing docs sites.

It:

- scans aligned source/target pairs that already exist in the repo
- builds a first global playbook
- builds a first language memory for each selected locale

Bootstrap does not create hidden baseline state. It only updates the Markdown memory files inside the repo.

## Safety model

The current design is intentionally simple:

- Git tracks source and target file history
- Markdown block parsing finds structural units
- the LLM judges semantic meaning and reusable guidance
- memory files persist long-term project knowledge

There is no extra runtime directory to keep in sync across branches or teammates.

## Related pages

- [Config](/guide/config)
- [Agents](/guide/agents)
- [Memory](/guide/memory)
- [Project Workflow](/guide/workflow)
- [CI](/guide/ci)
