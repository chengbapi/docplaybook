# Introduction

## What problem it solves

Keeping multilingual documentation in sync is harder than it looks. The first machine translation is the easy part. The ongoing maintenance is where teams get stuck:

- A reviewer corrects a product term. The next translation run overwrites it.
- A page is carefully edited by a native speaker. A source update triggers a full retranslation that discards the edits.
- The same fix gets applied manually across dozens of pages because nothing captures it as a reusable rule.
- New team members have no record of past translation decisions.

DocPlaybook is built around a single idea: **human corrections should become reusable project knowledge**, not one-off edits that disappear on the next run.

## How it works

DocPlaybook operates as a loop of two verbs:

```
translate → human review → learn → better translations → ...
```

**`translate`** syncs your source docs to one or more target languages using an LLM. It tracks source file hashes in `.docplaybook/state/source-hashes.json` so it only retranslates files that have actually changed. Glossary terms are applied as deterministic post-processing patches, and memory rules are injected into the system prompt.

**`learn`** reads the current source and target files and asks the LLM to extract reusable guidance from any human edits. It runs interactively by default — you review each candidate rule, accept it, edit it, or skip it. Over time, this builds up a set of project-level knowledge assets that feed into every future translation.

Each time you run `translate` after a `learn` cycle, the LLM has better context. Term choices are consistent. Tone matches what reviewers expect. The glossary handles the most critical substitutions deterministically.

## The three knowledge assets

DocPlaybook stores its learned knowledge in three files under `.docplaybook/`:

**`glossary/<lang>.json`**
Deterministic term pairs. These are applied as post-processing patches after LLM translation, so they are guaranteed regardless of what the model outputs. Sorted alphabetically. Example: `{"Workspace": "ワークスペース"}`.

**`memories/<lang>.md`**
Per-language style and terminology rules injected into the LLM system prompt before translation. Covers things like preferred phrasings, formality level, which English terms should remain untranslated, and punctuation preferences for that language.

**`playbook.md`**
Cross-language rules that apply to all target languages. Covers voice, protected terms (product names, CLI commands), and general translation rules that are not language-specific.

All three files are plain text, committed to git, and editable by hand. They are designed to be read by both humans and LLMs.

## When to use DocPlaybook

DocPlaybook fits well when:

- You have a Markdown or MDX documentation site that needs to stay in sync across multiple languages.
- You have human reviewers who edit translated output and want those edits to stick.
- You want to automate translation in CI without losing reviewer corrections on each run.
- You are using Docusaurus, Rspress, VitePress, or any project with Markdown files.

DocPlaybook is not the right fit when:

- You need a translation management system with a web UI or translation memory database.
- Your content is not Markdown (e.g. mobile app strings, server-rendered HTML).
- You need certified human translation with full review workflows.

## Where to go next

Continue to [Quick Start](/guide/quick-start) to install DocPlaybook and run your first translation.
