  

# Quick Start

## Install in your project

If you are integrating DocPlaybook into an existing docs project, installing it as a dev dependency is usually the best fit.

<PackageManagerTabs variant="help" />

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

After translation and learning runs begin, DocPlaybook also maintains `.docplaybook/state/*.json`. Those files track branch progress and are meant to be committed with the branch.

## Bootstrap existing translated docs

If the repository already contains aligned translated docs, run `bootstrap` after `init`:

```bash
pnpm exec docplaybook bootstrap . --langs ja
```

Use `bootstrap` to infer the initial project guidance from existing translations:

- `.docplaybook/playbook.md`
- `.docplaybook/memories/<lang>.md`

After that, normal maintenance uses `translate`, `learn`, and `lint`.

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

## What to do next

Continue with [Commands](/guide/commands).
