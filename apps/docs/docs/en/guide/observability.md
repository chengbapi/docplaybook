# Observability

DocPlaybook can send optional translation traces to Langfuse so you can inspect execution behavior and quality regressions over time.

This first version is intentionally narrow:

- it traces `translate`
- it does not trace `learn`
- it does not trace `bootstrap`
- it does not trace `lint`

## What Langfuse is used for here

In this project, Langfuse is the run-history layer for translation work:

- which source article produced which target article
- which target language and `docKey` were involved
- how long a translation run took
- how many tokens it used
- whether the run used `single`, `batch`, or `batch-fallback`
- whether the run hit retry or parse-failure events

This is different from local debug payload inspection:

- `--verbose` shows the current CLI workflow
- `--debug` keeps local temp traces with prompts and raw model output
- Langfuse shows the long-lived operational view across many runs

## Enable it locally

Langfuse is opt-in. Nothing changes unless you explicitly enable it.

```bash
export DOCPLAYBOOK_LANGFUSE_ENABLED=true
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
export LANGFUSE_HOST=https://cloud.langfuse.com
```

Then run translation normally:

```bash
pnpm exec docplaybook translate .
```

Optional:

```bash
export DOCPLAYBOOK_LANGFUSE_FLUSH_TIMEOUT_MS=8000
```

That controls how long the CLI waits for trace export before exiting.

## What is traced

For each translated target article, DocPlaybook emits one article-level trace/span with:

- `source_path`
- `target_path`
- `doc_key`
- source and target languages
- translation reason such as `startup`
- whether `--force` was used
- total elapsed time
- aggregated token usage for that article

Inside that article trace, DocPlaybook also emits model-call spans for:

- single-block translation
- batch translation
- batch parse failure followed by single-block fallback

The model-call spans include metadata such as:

- block count
- source chars
- prompt chars
- memory chars
- model label
- token usage

To stay conservative about sensitive content, DocPlaybook does not upload full prompts or full translated text to Langfuse in v1.

## How to read a trace

When you open one translation trace in Langfuse, read it in this order:

1. Check the article-level span for `source_path`, `target_path`, target language, total tokens, and elapsed time.
2. Inspect child spans to see whether the article used `single`, `batch`, or `batch-fallback`.
3. Look for events such as batch parse failures or rate-limit retries.
4. Compare similar articles across runs to see whether a prompt or memory change improved cost, latency, or failure rate.

If you need payload-level debugging after spotting a suspicious trace, rerun the same workspace with `--debug` and inspect the local temp trace files.

## How to optimize the project with this data

Langfuse traces are most useful when they feed concrete follow-up work:

- Find articles that are consistently slow or expensive.
  These are candidates for prompt simplification, memory cleanup, or batching threshold changes.
- Find repeated `batch-fallback` traces.
  These usually point to brittle JSON response formatting or prompt-shape issues.
- Compare token usage by target language or doc set.
  This helps spot where one locale or one document family is disproportionately costly.
- Correlate bad manual review results with traces.
  When a translation is weak, use the trace to capture the exact article/mode/metadata and add that case to `evals/docplaybook`.
- Watch retry-heavy runs.
  Repeated rate-limit retries can justify lower concurrency or provider changes.

## Recommended workflow

1. Run `translate` with Langfuse enabled.
2. In Langfuse, sort for high latency, high token usage, or repeated fallback.
3. Reproduce the worst offenders locally with `--debug`.
4. Adjust prompt, memory, batching, or concurrency.
5. Add representative failures to the manual eval pack in `evals/docplaybook`.
6. Re-run and compare the traces after the change.
