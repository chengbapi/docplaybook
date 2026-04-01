# Commands

This page covers the core CLI surface after `init`.

## Default command

```bash
pnpm exec docplaybook .
```

The default local workflow currently runs:

1. `learn`
2. `translate`

Use it when you want the normal maintenance loop without choosing each step manually.

## `docplaybook bootstrap`

```bash
pnpm exec docplaybook bootstrap . --langs ja
```

Use `bootstrap` when the repository already contains aligned translated docs and you want DocPlaybook to infer the first project memory from that existing content.

`bootstrap`:

- scans aligned source and target documents already in the repo
- writes the first `.docplaybook/playbook.md`
- writes the first `.docplaybook/memories/<lang>.md`

It is a cold-start step. It does not keep the workspace in sync after that. Day-to-day updates still use `translate`, `learn`, and `lint`.

## `docplaybook translate`

```bash
pnpm exec docplaybook translate .
```

Use this when source docs changed and target docs need to catch up.

`translate` is state-driven:

- if the source hash for a target document is unchanged and the target already exists, it skips
- if the source hash changed or the target is missing, it refreshes the target article safely

You can limit the run to selected languages:

```bash
pnpm exec docplaybook translate . --langs ja
pnpm exec docplaybook translate . --langs en,ja
```

## `docplaybook learn`

```bash
pnpm exec docplaybook learn .
```

Use this after reviewers edited translated docs and you want those corrections to become reusable project guidance.

`learn` is also state-driven:

- if the target hash is unchanged since the last learn run, it skips
- if the target changed, it reads the current source/target pair and updates `playbook.md` and `memories/<lang>.md`

You can limit learning to selected languages:

```bash
pnpm exec docplaybook learn . --langs ja
```

## `docplaybook lint`

```bash
pnpm exec docplaybook lint .
```

Use this to review translated docs against source docs and current project guidance.

Typical variants:

```bash
pnpm exec docplaybook lint . --fix
pnpm exec docplaybook lint . --scope all
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
