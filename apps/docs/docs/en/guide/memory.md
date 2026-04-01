# Memory

DocPlaybook keeps translation guidance in Markdown so it can be reused by agents and still remain editable by humans.

## Files

DocPlaybook maintains two levels of memory:

- `.docplaybook/playbook.md`
- `.docplaybook/memories/<target>.md`

The first is global. The second is specific to each target language.

DocPlaybook also keeps `.docplaybook/state/*.json`, but those files are not memory. They only record processing progress for the current branch.

## Global playbook

`.docplaybook/playbook.md` is for language-agnostic guidance.

It keeps:

- `## Voice`
- `## Protected Terms`
- `## Translation Rules`

Typical examples:

- the documentation should stay technical and direct
- product names and CLI commands should not be translated
- warnings should not be softened
- Markdown structure should stay stable

## Language memory

Each `.docplaybook/memories/<target>.md` file is for language-specific guidance.

It keeps:

- `## Terminology`
- `## Style Notes`

Typical examples:

- preferred translations for recurring technical terms
- whether certain English words should stay untranslated
- language-specific tone or formality choices
- punctuation or phrasing preferences for that target language

## How memory is used

During translation and linting, DocPlaybook combines:

1. the global playbook
2. the target-language memory

That combined context becomes the reusable translation standard for the current run.

## How memory is updated

`docplaybook learn` is the main way memory evolves.

When a human edits a translated document, the learning flow:

1. checks whether the current target file hash has already been learned
2. reads the current source document and current target document
3. asks the LLM which observations are reusable guidance and which should be ignored
4. updates `playbook.md` with language-agnostic lessons
5. updates `memories/<target>.md` with language-specific terminology and style notes

This lets review effort compound over time.

## Memory vs state

Keep this split clear:

- `playbook.md` and `memories/<target>.md` are project knowledge
- `.docplaybook/state/*.json` is branch progress

State files may be committed so branch switching restores progress, but their contents are operational hashes, not human-authored guidance.

## How bootstrap initializes memory

For existing documentation sites that already have translated pages, `docplaybook bootstrap --langs ...` creates the first memory files from aligned source/target examples already in the repo.

This is the recommended first step after `init` when the project already contains translated docs.

## Why the structure is minimal

The first version keeps memory intentionally small:

- global rules go to `playbook.md`
- language-specific rules go to `memories/<target>.md`

This makes it easier for agents to:

- read the files
- update them safely
- keep them concise
- avoid duplicating rules across too many sections

## Related pages

- [Agents](/guide/agents)
- [Runtime Model](/guide/advanced)
- [Config](/guide/config)
- [Quick Start](/guide/quick-start)
