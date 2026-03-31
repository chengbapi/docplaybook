# CI

Running `DocPlaybook` in CI is often a strong default for team documentation workflows.

## Why run it in CI

- the team can standardize on one provider and one model
- translation quality and tone are more stable across runs
- cost can be centralized in a team account or CI budget
- docs authors do not each need their own LLM setup just to keep translations aligned

## Typical CI responsibilities

The most common CI jobs are:

- `docplaybook translate`
  - generate or refresh translated docs from source content
- `docplaybook lint`
  - review translated docs against the current memory standard

In CI, `lint` usually works best as:

- `docplaybook lint . --fix --scope changed`
  - fix safe issues
  - only touch translation files changed in the current git working tree
- `docplaybook lint . --fix --scope changed --langs ja`
  - same behavior, but only for selected locales when your pipeline is split by language

`learn` is usually not a CI job. It changes `playbook.md` and `memories/<lang>.md`, so those edits should normally be created locally and reviewed in code review.

## Package manager examples

### pnpm

```bash
pnpm exec docplaybook translate .
pnpm exec docplaybook lint . --fix --scope changed
```

### npm

```bash
npx docplaybook translate .
npx docplaybook lint . --fix --scope changed
```

### yarn

```bash
yarn exec docplaybook translate .
yarn exec docplaybook lint . --fix --scope changed
```

## Provider and model

DocPlaybook does not require a specific LLM provider. You can choose the provider that fits your team.

There are two practical patterns:

### Lock the model in config

Keep the provider and model in `.docplaybook/config.json` so that:

- local runs and CI runs behave the same way
- translation output is more predictable
- lint results are easier to compare over time

In this mode, local and CI can still use different secrets:

- local developers keep keys in `.docplaybook/.env.local`
- CI injects keys through environment variables

### Keep the model local to each environment

If local developers need one provider/model and CI needs another, do not lock `model` in `config.json`.

Instead:

- local uses `.docplaybook/.env.local`
- CI sets `DOCPLAYBOOK_MODEL_*` variables and provider secrets in the pipeline

This is more flexible, but output can drift more between local runs and CI runs.

## Example flow

```bash
pnpm exec docplaybook translate .
pnpm exec docplaybook lint . --fix --scope changed
```

If you also want a periodic full review job:

```bash
pnpm exec docplaybook lint . --scope all
```

## Pull request usage

A practical CI pattern is:

1. run `docplaybook translate .`
2. commit or upload generated translation changes
3. run `docplaybook lint . --fix --scope changed`
4. fail the job if lint finds unacceptable issues

This gives reviewers both updated translated files and explicit quality findings.
