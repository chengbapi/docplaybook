# Memory

DocPlaybook keeps translation guidance in Markdown so it can be reused by agents and still remain editable by humans.

## Files

DocPlaybook maintains two levels of memory:

- `.docplaybook/playbook.md`
- `.docplaybook/memories/<target>.md`

The first is global. The second is specific to each target language.

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

When a human edits a generated translation, the learning flow:

1. compares the edited target file with the generated baseline
2. decides whether the changes are reusable corrections or a major rewrite
3. updates `playbook.md` with language-agnostic lessons
4. updates `memories/<target>.md` with language-specific terminology and style notes

This lets review effort compound over time.

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
- [Advanced](/guide/advanced)
- [Config](/guide/config)
- [Quick Start](/guide/quick-start)
