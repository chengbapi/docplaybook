# GitHub Action

DocPlaybook provides a composite GitHub Action that runs `translate` on push and commits the translated files back to the branch. This keeps your translations in sync automatically without any extra infrastructure.

## Prerequisites

Before setting up the action, make sure:

1. You have run `docplaybook init .` locally and committed the resulting `.docplaybook/` directory to git (excluding cache and `.env*` files, which are gitignored by default).
2. Your `.docplaybook/config.json` is committed and includes the model configuration.
3. You have a model API key available to add as a GitHub secret.

The action relies on the config already being in the repo. It does not run `init`.

## Basic workflow

Create `.github/workflows/translate.yml` in your repo:

```yaml
name: Translate docs
on:
  push:
    branches: [main]
    paths: ['docs/**/*.md']
jobs:
  translate:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: docplaybook/docplaybook@v1
        with:
          working-directory: '.'
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

The `contents: write` permission is required so the action can commit translated files back to the branch.

## Adding your API key as a secret

1. Go to your repository on GitHub.
2. Navigate to **Settings > Secrets and variables > Actions**.
3. Click **New repository secret**.
4. Set the name to match the `apiKeyEnv` value in your config (e.g. `OPENAI_API_KEY`).
5. Paste your API key as the value.

The environment variable is passed to the action via the `env` block in your workflow. DocPlaybook reads it automatically — no changes to `config.json` are needed.

## Action inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `working-directory` | No | `.` | Path to the workspace root containing `.docplaybook/config.json` |
| `langs` | No | all configured languages | Comma-separated list of target languages to translate (e.g. `zh,ja`) |
| `commit-message` | No | `chore: sync translations [skip ci]` | Commit message for translated files |
| `node-version` | No | `20` | Node.js version to use |

## Customizing the path filter

The `paths` filter controls which file changes trigger the workflow. Adjust it to match your source docs location:

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'docs/en/**/*.md'
      - 'docs/en/**/*.mdx'
```

For a Docusaurus project where source docs are in `docs/`:

```yaml
paths:
  - 'docs/**/*.md'
  - 'docs/**/*.mdx'
```

For a sibling layout where source and translated files are mixed:

```yaml
paths:
  - '**/*.md'
```

## Translating specific languages

Use the `langs` input to limit which languages the action translates. This is useful if you want separate jobs per language or if you are rolling out languages incrementally:

```yaml
- uses: docplaybook/docplaybook@v1
  with:
    working-directory: '.'
    langs: 'zh,ja'
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Multiple languages with different providers

If different target languages use different model providers, you can run separate jobs:

```yaml
jobs:
  translate-openai:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: docplaybook/docplaybook@v1
        with:
          working-directory: '.'
          langs: 'zh,ja'
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Or override the model via environment variables supported by your config's `apiKeyEnv` field.

## The `[skip ci]` commit message

By default, the action commits translated files with the message `chore: sync translations [skip ci]`. The `[skip ci]` tag tells GitHub Actions not to re-run workflows triggered by that commit, preventing an infinite translation loop.

If you change `commit-message`, make sure to include `[skip ci]` (or the equivalent for your CI provider) to avoid re-triggering the workflow:

```yaml
- uses: docplaybook/docplaybook@v1
  with:
    commit-message: 'docs: update translations [skip ci]'
```

## Full example with all options

```yaml
name: Translate docs
on:
  push:
    branches: [main]
    paths:
      - 'docs/**/*.md'
      - 'docs/**/*.mdx'
jobs:
  translate:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: docplaybook/docplaybook@v1
        with:
          working-directory: '.'
          langs: 'zh,ja'
          commit-message: 'chore: sync translations [skip ci]'
          node-version: '20'
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## What the action does

The action runs the following steps internally:

1. Sets up Node.js.
2. Installs DocPlaybook.
3. Runs `docplaybook translate <working-directory>` (with `--langs` if specified).
4. Commits any new or modified translation files back to the branch.

It does not run `learn` or `bootstrap`. Those are intended for local use where a human can review and accept candidate rules interactively.
