# Agents

DocPlaybook is built around LLM agents, not just one-off translation calls.

The agents are responsible for translating docs, learning from review, maintaining reusable guidance files, and linting translated output against that guidance.

## What agents maintain

DocPlaybook keeps two layers of AI-maintained guidance:

- `.docplaybook/playbook.md`
- `.docplaybook/memories/<target>.md`

The agent updates these files over time so future translation and lint runs can reuse earlier decisions.

## Agent responsibilities

### Translate

The translation agent:

- reads the source document
- reads the global playbook and the target-language memory
- checks whether the source hash changed for each target document
- skips targets that are already up to date
- refreshes the whole target document when the source changed or the target is missing

### Learn

The learning agent:

- checks whether the target hash changed since the last learn run
- skips targets that were already learned in their current version
- lets the LLM extract reusable guidance from the current source/target pair
- updates `.docplaybook/playbook.md` with language-agnostic rules
- updates `.docplaybook/memories/<target>.md` with language-specific terminology and style notes

### Lint

The lint agent:

- reads the source document
- reads the translated document
- reads the global playbook and the target-language memory
- scores quality across multiple dimensions
- emits explicit findings
- can apply safe fixes with `--fix`

## Global vs language-specific guidance

The agent keeps this split intentionally:

- `playbook.md`
  - language-agnostic guidance
  - shared voice
  - protected terms
  - project-wide translation rules
- `memories/<target>.md`
  - language-specific terminology
  - language-specific style notes

This keeps the first version simple while still letting the agent learn useful rules over time.

## Why this model

This agent-based structure helps DocPlaybook stay useful over repeated runs:

- translations get more consistent
- human review effort compounds instead of getting lost
- lint has a clearer standard to judge against
- guidance stays editable because it is stored in Markdown

## Related pages

- [Quick Start](/guide/quick-start)
- [Advanced](/guide/advanced)
- [Config](/guide/config)
