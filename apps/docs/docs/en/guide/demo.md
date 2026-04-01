# Demo

This page is where the detailed walkthrough lives.

The homepage should explain the product quickly. This page shows what a real DocPlaybook loop looks like inside a docs repo, with concrete file changes, commands, and expected outputs.

## Demo repo shape

```text
docs/
  en/
    guide/
      introduction.md
  ja/
    guide/
      introduction.md
.docplaybook/
  playbook.md
  memories/
    ja.md
```

In this example:

- English is the source language
- Japanese is the target language
- the team already has a terminology memory

## Case 1: translate only the changed blocks

The writer updates one English sentence in `docs/en/guide/introduction.md`.

Before:

```md
Use the knowledge base to manage docs.
```

After:

```md
Use the knowledge base to manage team docs in one place.
```

Project memory already contains:

```md
- Translate "knowledge base" as "Wiki".
```

Run:

```bash
docplaybook translate docs/en/guide/introduction.md --to ja
```

What DocPlaybook sends into the model:

- the source diff from Git
- the current Japanese target file
- `.docplaybook/playbook.md`
- `.docplaybook/memories/ja.md`

Expected result:

```md
Wiki を使ってチームのドキュメントを一元管理します。
```

What matters here:

- unchanged Japanese blocks stay untouched
- terminology follows memory
- only the changed source block is regenerated

## Case 2: learn from a reviewer correction

A reviewer edits the Japanese translation manually.

Before review:

```md
ワークスペースを設定します。
```

After review:

```md
workspace を設定します。
```

The team wants to keep `workspace` untranslated in technical docs.

Run:

```bash
docplaybook learn docs/ja/guide/introduction.md --from en
```

Expected effect:

- DocPlaybook checks whether the correction is reusable
- if yes, it proposes a structured memory update

Typical memory patch:

```md
- Keep "workspace" in English in Japanese docs.
- Prefer concise technical Japanese over explanatory paraphrase.
```

This is the moment where review work turns into future consistency.

## Case 3: lint a translated page before merge

Now the page is translated, but we want a quality pass.

Current Japanese file contains:

```md
DocPlaybook は AI gateway mode をサポートします。
この機能はとても簡単に使えます。
```

Project rules already say:

- prefer `gateway`, not `AI gateway`
- keep tone neutral and technical

Run:

```bash
docplaybook lint docs/ja/guide/introduction.md --from en
```

Expected findings:

```text
warn  Terminology mismatch: use "gateway" instead of "AI gateway".
info  Tone drift: avoid promotional wording like "very easy".
```

This is useful right before commit or in CI because it catches issues without rewriting the whole page.

## Full loop

One realistic team loop looks like this:

1. Edit English source docs.
2. Run `translate` for the target languages that need updates.
3. Review the translated files.
4. Run `learn` on important reviewer corrections.
5. Run `lint` before push or in CI.

## Why this split works

Each command has one job:

- `translate` keeps target docs aligned with source changes
- `learn` captures reusable reviewer knowledge
- `lint` checks whether the current translation still matches project rules

That separation is what makes DocPlaybook understandable in practice, not just in theory.
