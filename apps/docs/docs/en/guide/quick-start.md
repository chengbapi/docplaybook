# Quick Start

## Install in your project

If you are integrating DocPlaybook into an existing docs project, installing it as a dev dependency is usually the best fit.

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:16px 0 22px;">
  <div style="padding:14px 16px;border:1px solid #e5e7eb;border-radius:16px;">
    <div style="font-weight:700;margin-bottom:10px;">pnpm</div>
    <pre style="margin:0;white-space:pre-wrap;"><code>pnpm add -D docplaybook
pnpm exec docplaybook --help</code></pre>
  </div>
  <div style="padding:14px 16px;border:1px solid #e5e7eb;border-radius:16px;">
    <div style="font-weight:700;margin-bottom:10px;">npm</div>
    <pre style="margin:0;white-space:pre-wrap;"><code>npm install --save-dev docplaybook
npx docplaybook --help</code></pre>
  </div>
  <div style="padding:14px 16px;border:1px solid #e5e7eb;border-radius:16px;">
    <div style="font-weight:700;margin-bottom:10px;">yarn</div>
    <pre style="margin:0;white-space:pre-wrap;"><code>yarn add -D docplaybook
yarn exec docplaybook --help</code></pre>
  </div>
</div>

If you prefer not to add it to the project yet:

```bash
pnpm dlx docplaybook --help
npx docplaybook --help
yarn dlx docplaybook --help
```

## Initialize the project

After installation, the first real step is:

```bash
pnpm exec docplaybook init .
```

`DocPlaybook` is designed so that initialization is mostly the same across projects. If your docs already use `Docusaurus`, `Rspress`, or `VitePress`, DocPlaybook detects that and applies the matching path convention internally.

If no supported docs framework is detected, it falls back to `sibling`.

During `init`, DocPlaybook will:

- detect the workspace layout when possible
- choose a model provider and model
- collect the required credentials
- test model connectivity
- detect the source language
- ask for target languages
- create `.docplaybook/config.json`
- create `.docplaybook/memories/*.md`
- create `.docplaybook/playbook.md`

If translated target files already exist, `init` will also suggest running `bootstrap` so the first playbook and language memories can be inferred from those existing docs.

## Provider setup

DocPlaybook is AI-powered and LLM-based, so provider setup is part of initialization.

During init, you will:

- choose the provider
- choose the model id
- provide credentials
- run a connectivity check

You can choose the provider that fits your team. DocPlaybook does not require one specific provider family.

In team workflows, many projects lock provider and model in config so local runs and CI runs stay consistent.

## Layouts and framework conventions

The user flow stays the same, but the output layout depends on what DocPlaybook detects:

```text
sibling:
guide.md
guide.en.md
guide.ja.md

docusaurus:
docs/guide/intro.md
i18n/en/docusaurus-plugin-content-docs/current/guide/intro.md

rspress:
docs/en/guide/intro.md
docs/ja/guide/intro.md

vitepress:
docs/guide/intro.md
docs/en/guide/intro.md
```

### Docusaurus

When DocPlaybook detects `Docusaurus`, it writes translated docs into:

```text
i18n/<locale>/docusaurus-plugin-content-docs/current/
```

This follows the official Docusaurus docs i18n structure.

### Rspress

When DocPlaybook detects `Rspress`, it writes translated docs into:

```text
docs/<locale>/
```

This should be understood as a DocPlaybook integration convention for Rspress.

### VitePress

When DocPlaybook detects `VitePress`, it writes translated docs into:

```text
docs/<locale>/
```

This follows the common localized docs layout used in VitePress projects.

### Sibling

If no supported docs framework is detected, DocPlaybook falls back to `sibling`, where translated files sit next to the source file:

```text
guide.md
guide.en.md
guide.ja.md
```

## Core commands

These are the commands you will use after initialization.

### `docplaybook`

This is the default day-to-day command.

```bash
pnpm exec docplaybook .
```

Use this when you want the normal project workflow without deciding each sub-step manually.

Today that default workflow is:

1. `learn`
2. `translate`

### `docplaybook bootstrap`

Build the first memory files from existing translated docs already tracked in the repo.

```bash
pnpm exec docplaybook bootstrap . --langs en,ja
```

Use this after `init` when the docs site already contains translated files.

### `docplaybook translate`

Translate source docs into target languages.

```bash
pnpm exec docplaybook translate .
```

Use this when you only want translation output updated from the source docs.

`translate` is state-driven: if the source hash for a target document did not change and the target already exists, DocPlaybook skips it.

To process only one or two target languages:

```bash
pnpm exec docplaybook translate . --langs ja
pnpm exec docplaybook translate . --langs en,ja
```

### `docplaybook learn`

Absorb human review edits into memory files.

```bash
pnpm exec docplaybook learn .
```

Use this when reviewers have updated translated docs and you want DocPlaybook to reuse those corrections later.

`learn` is state-driven: it skips target files whose content hash has not changed since the last learn run, and for changed targets it extracts reusable guidance from the current source/target pair.

You can also limit learning to selected target languages:

```bash
pnpm exec docplaybook learn . --langs ja
```

### `docplaybook lint`

Review translations against source docs and memory.

```bash
pnpm exec docplaybook lint .
```

This returns lint-style findings and scores for terminology, tone, completeness, Markdown integrity, fluency, and overall quality.

To apply safe fixes automatically:

```bash
pnpm exec docplaybook lint . --fix
```

To lint every translated file instead of only changed files:

```bash
pnpm exec docplaybook lint . --scope all
```

And you can combine scope with language filters:

```bash
pnpm exec docplaybook lint . --fix --scope changed --langs ja
```

## Logs

Detailed logs:

```bash
pnpm exec docplaybook . --verbose
```

Debug logs:

```bash
pnpm exec docplaybook . --debug
```

## What to do next

Continue with [Project Workflow](/guide/workflow).
