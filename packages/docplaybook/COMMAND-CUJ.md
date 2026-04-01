# DocPlaybook Command Journeys

This note describes the current command model for `docplaybook` from real user journeys, not from internal implementation details.

## Design principles

- The main unit is a docs workspace, not a single file.
- `layout.kind` decides path mapping and framework-specific file handling.
- Incremental behavior should prefer workspace state over Git reconstruction when possible.
- Commands should map cleanly to what the user is trying to do right now:
  - connect
  - catch up
  - maintain
  - check status
- `lint --scope changed` can remain Git-aware because that matches common CI and pre-push workflows.

## Critical user journeys

### 1. Attach DocPlaybook to an existing translated docs site

Common examples:

- an existing `Rspress` site with `docs/en`, `docs/ja`, `docs/zh-CN`
- an existing `Docusaurus` site with `i18n/<lang>/...`
- an existing `VitePress` site with localized docs already present

Expected flow:

1. `init`
2. optionally learn from existing aligned translations
3. translate any missing targets immediately

Desired command behavior:

- `init`
  - detect source language
  - detect `layout.kind`
  - write `.docplaybook/config.json`
  - detect whether translated target docs already exist
  - suggest the next step instead of doing too much automatically
- `bootstrap`
  - infer the first `playbook.md` and `memories/<lang>.md` from existing aligned source/target docs
  - this is the cold-start path for repositories that already have translations
- `translate`
  - create missing targets immediately
  - refresh targets whose source hash changed

Product interpretation:

- `init` connects DocPlaybook to the workspace
- `bootstrap` learns from the past
- `translate` catches up missing or stale translations

### 2. Day-to-day maintenance

Common examples:

- a new source page was added
- an existing source page changed
- a reviewer manually improved a translated page

Expected flow:

- new source doc: translate immediately
- changed source doc: retranslate that target doc
- changed translated doc: learn and update memory

Desired command behavior:

- `translate`
  - state-driven
  - if source hash unchanged and target exists, skip
  - if source hash changed or target is missing, translate the whole document safely
- `learn`
  - state-driven
  - if target hash unchanged since last learn, skip
  - if target changed, extract reusable rules from the current source/target pair
  - write updates into `playbook.md` and `memories/<lang>.md`

Product interpretation:

- `translate` keeps translations in sync with source docs
- `learn` absorbs reviewer knowledge into reusable project memory

### 3. Understand current workspace status

Common examples:

- before push
- in CI
- after a batch of translations
- when a maintainer wants confidence instead of another translation run

Expected flow:

- run one command and understand:
  - what looks healthy
  - what looks stale
  - what should be fixed

Current command:

- `lint`

- `lint` means "review translated docs against current project guidance and report health"

## Recommended command model

### Core commands

- `init`
  - attach DocPlaybook to a workspace
- `bootstrap`
  - learn initial memory from already-existing translations
- `translate`
  - create missing translations and refresh stale ones
- `learn`
  - absorb reviewer corrections into reusable memory
- `lint`
  - report translation health and optionally apply safe fixes

### Force variants

These exist, but stay secondary:

- `translate --force`
- `learn --force`
- `retranslate`
- `relearn`

## Suggested default journeys

### Existing translated docs site

1. `docplaybook init .`
2. `docplaybook bootstrap . --langs ja,zh-CN`
3. `docplaybook translate .`

### New source docs were added or changed

1. `docplaybook translate .`
2. `docplaybook lint . --fix --scope changed`

### Reviewer edited translations

1. `docplaybook learn .`
2. `docplaybook lint . --scope changed`

### Before push

1. `docplaybook translate .`
2. `docplaybook lint . --fix --scope changed`

### Full workspace review

1. `docplaybook lint . --scope all`

## Missing or under-described common scenarios

These are common enough that the product and docs should acknowledge them explicitly.

### Add a new target language later

Example:

- a repo starts with `ja`
- later wants to add `zh-CN`

Expected flow:

1. rerun `init` or update config to include the new target language
2. run `bootstrap --langs zh-CN` only if aligned human translations already exist
3. otherwise run `translate --langs zh-CN`

### Framework-specific translatable files

This is especially important for `Rspress`.

Expected behavior under `layout.kind = "rspress"`:

- translate regular docs
- translate `_nav.json`
- translate `_meta.json`
- translate locale content inside `i18n.json`
- translate whitelisted homepage frontmatter text fields in `index.md`

This should feel automatic once layout is detected.

### Partial-language maintenance

Teams often update only one locale in one branch.

Expected flow:

- `translate --langs ja`
- `learn --langs ja`
- `lint --langs ja --scope changed`

### CI vs local workflow

Current split:

- local:
  - `learn`
  - `translate`
  - optional `lint --fix`
- CI:
  - `lint --scope changed`
  - optionally `lint --scope all` on scheduled or release workflows

### State reset / recovery

When state becomes confusing, users need a safe reset story.

Expected options:

- `translate --force`
- `learn --force`
- or remove `.docplaybook/state/*` and rerun

This should be documented clearly because state-driven behavior is central.

## Current direction

For now, the product should move toward this mental model:

- `init`: connect
- `bootstrap`: infer from history
- `translate`: catch up docs
- `learn`: absorb reviewer knowledge
- `lint`: inspect translation health

That model maps well to both existing translated sites and day-to-day maintenance.
