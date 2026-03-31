# Flow Demo

This page shows the three core DocPlaybook loops in a concrete, Git-first way.

The point is to make each model call understandable:

- what goes in
- what the model should do
- what should come back out

## Translate

`translate` is source-driven.

It compares source docs in Git with the current working tree, keeps unchanged target blocks stable, and only asks the model to regenerate the changed target blocks.

```text
Source A (Git HEAD)
+ Source A (working tree)
+ playbook.md
+ memories/<lang>.md
+ current target B
-> LLM
-> updated target B
```

Concrete example:

- source before: `使用知识库管理文档。`
- source after: `使用知识库统一管理团队文档。`
- memory rule: `Translate "知识库" as "Wiki".`
- expected target: `Use the Wiki to manage team docs in one place.`

What to verify:

- only changed blocks are regenerated
- memory and playbook rules are still visible in the result
- code fences, links, and inline code are preserved

## Learn

`learn` is target-diff-driven.

It looks at a translated file before and after review, compares that edit against the current source, and asks the model whether the edit should become reusable project guidance.

```text
Target B (Git HEAD)
+ Target B (working tree)
+ current source A
+ playbook.md
+ memories/<lang>.md
-> LLM
-> structured updates for playbook.md and memories/<lang>.md
```

Concrete example:

- source block: `使用知识库管理文档。`
- before translation: `Use the knowledge base to manage docs.`
- after translation: `Use the Wiki to manage docs.`
- expected memory update: add a terminology rule such as `Translate "知识库" as "Wiki".`

What to verify:

- recurring, reusable fixes become memory
- one-off page rewrites are ignored
- the result is a structured update, not a vague explanation

## Lint

`lint` is a rule-aware review step.

It reads the current source, current target, playbook, language memory, and lint rules, then asks the model to return an issue list.

```text
Source A
+ Target B
+ playbook.md
+ memories/<lang>.md
+ lint rules
-> LLM
-> score + issue list + optional safe fixes
```

Concrete example:

- memory prefers `gateway`
- current translation says `AI gateway`
- expected finding: terminology mismatch

What to verify:

- findings point to real translation issues
- lint respects project language rules
- suggested fixes stay safe and local

## Mental model

Use this quick map when deciding which command to run:

- `translate`
  - source changed, target should catch up
- `learn`
  - translation review happened, project memory should improve
- `lint`
  - translation exists, quality should be checked

That is the whole loop:

1. edit source docs
2. run `translate`
3. reviewers improve target docs
4. run `learn`
5. run `lint`
