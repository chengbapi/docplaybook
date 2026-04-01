# DocPlaybook Evals

This directory keeps a lightweight manual evaluation pack for the Git-first DocPlaybook workflow.

It is intentionally inside the main repo instead of a separate project so the cases can evolve with the implementation.

## What is here

- `cases/translate/*.json`
  - evaluate Git-based source diff translation behavior
- `cases/learn/*.json`
  - evaluate Git-first before/after learning behavior
- `cases/bootstrap/*.json`
  - evaluate bootstrap quality from existing bilingual docs
- `results/*.json`
  - saved review runs
- `review.mjs`
  - interactive reviewer for scoring runs with fixed, easy-to-read cases
- `summary.mjs`
  - aggregate saved results

## Why manual evals first

DocPlaybook's hardest problems are semantic:

- whether `learn` kept only reusable rules
- whether `bootstrap` inferred specific and safe guidance
- whether `translate` changed only what it should

Those are hard to judge from unit tests alone, so this pack makes human review structured and repeatable.

## Recommended usage

1. Run DocPlaybook on a branch or a sample workspace.
2. Inspect the real output:
   - translated Markdown files
   - `.docplaybook/playbook.md`
   - `.docplaybook/memories/<lang>.md`
   - `git diff` if helpful
3. List available cases if you want:

```bash
pnpm evals:review -- --list
```

4. Review only one category or one fixed case if you want:

```bash
pnpm evals:review -- --category learn
pnpm evals:review -- --case learn_term_fix_should_enter_memory
```

5. Run the interactive review:

```bash
pnpm evals:review
```

6. For each case, compare the real result with:
   - example input or pattern
   - expected result
   - should NOT happen

7. Record `pass` / `mixed` / `fail`, a `0-5` score, and notes.
8. Summarize results with:

```bash
pnpm evals:summary
```

## How to read a case

Each case is intentionally concrete.

- `kind`
  - `good`: a positive behavior we want
  - `bad`: a failure mode we want to avoid
- `input`
  - a small example or pattern, such as:
    - source block contains `知识库`
    - translation changed from `knowledge base` to `Wiki`
- `expected`
  - what the tool should do
- `should_not_happen`
  - obvious wrong outcomes

Example:

- `learn_term_fix_should_enter_memory`
  - input:
    - source block: `使用知识库管理文档。`
    - before translation: `Use the knowledge base to manage docs.`
    - after translation: `Use the Wiki to manage docs.`
  - expected:
    - `learn` treats this as reusable terminology
    - `memories/en.md` gains a concrete rule such as `Translate "知识库" as "Wiki".`

## Scoring guidance

- `pass`
  - behavior clearly matches the expected good outcome
- `mixed`
  - partially correct, but still has visible product risk
- `fail`
  - behavior clearly violates the case expectation

Suggested score bands:

- `5`
  - strong result, safe to ship for this case
- `4`
  - mostly correct, minor polish left
- `3`
  - usable but concerning
- `2`
  - weak result, should improve before relying on it
- `1`
  - poor result
- `0`
  - completely wrong

## Notes format

Good review notes usually capture:

- what the tool actually did
- whether the issue came from Git diffing, block pairing, prompt quality, or memory quality
- whether the problem is deterministic or model-dependent

## Current eval focus

The first pack emphasizes:

- translation precision
- learn judgement quality
- bootstrap conservatism

It does not yet automate model execution. It is a structured review harness for comparing real runs and iterating on prompts and behavior.
