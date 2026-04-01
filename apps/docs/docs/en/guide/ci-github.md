# CI and GitHub

CI is usually where teams centralize one provider, one model, and one translation budget.

## Typical CI jobs

The common CI responsibilities are:

- `docplaybook translate`
- `docplaybook lint`

Typical commands:

```bash
pnpm exec docplaybook translate .
pnpm exec docplaybook lint . --fix --scope changed
```

If your pipeline is locale-specific:

```bash
pnpm exec docplaybook lint . --fix --scope changed --langs ja
```

If you want a periodic full review:

```bash
pnpm exec docplaybook lint . --scope all
```

## GitHub workflow usage

A practical GitHub workflow is:

1. run `docplaybook translate .`
2. commit or upload generated translation changes
3. run `docplaybook lint . --fix --scope changed`
4. fail the job if lint still reports unacceptable issues

That gives reviewers both updated translated docs and explicit findings.

## Model setup

Two patterns work well:

### Shared model, different secrets

Keep the provider and model in `.docplaybook/config.json`.

Then:

- local developers keep keys in `.docplaybook/.env.local`
- CI injects secrets through environment variables

### Different model in local and CI

Do not lock `model` in `config.json`.

Then:

- local uses `.docplaybook/.env.local`
- CI sets `DOCPLAYBOOK_MODEL_*` variables and provider secrets in the pipeline

This is more flexible, but output drifts more easily between local and CI runs.
