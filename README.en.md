# docplaybook

`docplaybook` is a local-first CLI tool for translating Markdown documents.

It watches a workspace, merges files into multiple document collections, incrementally updates translated versions when the source documents change, and learns reusable translation experience from manual edits. Its long-term goal is to decouple the core engine from document sources so that the same sync and experience-learning workflows that work with local files today can also be used with cloud documents in the future.

## Why the experience repository matters

Most translation automation tools can produce a decent first draft. The real pain points often appear after human review and edits:

- A reviewer corrected a product term once, but the next round of translation makes the same mistake again
- A passage that was carefully edited gets partially retranslated during later incremental syncs, losing the reviewer's preferred phrasing
- The same correction has to be repeated across many documents because the tool never crystallized it into project-level reusable knowledge
- When a new colleague joins the documentation workflow, they don't have access to a reliable record of past translation decisions
- A term is corrected in one document, but other pages across the docs site still retain the old translation

The core idea of this project is: human corrections should not be one-off edits, but should be captured as translation experience that can be tracked and reused across the entire project.

## Typical pain points

### 1. Terminology Drift

Original:

```md
飞书知识库支持权限控制。
```

模型把 `知识库` 翻译成 `Knowledge Base`，但团队实际希望它被翻成 `Wiki`，因为那才是这个产品的正式名称。

Someone manually corrected it. A week later, the source sentence changed slightly, the file was synced again, and the tool wrote it back to `Knowledge Base`.

This is exactly the kind of repeated regression this project seeks to prevent.

### 2. Loss of manual review results

A translation page had been carefully reviewed and polished manually. Later, only one paragraph in the source page changed, but an overly coarse synchronization tool often rewrites too much of the target page, thereby wiping out nearby expressions that had already been fixed.

Synchronizing by block can reduce this scope of impact, and an experience repository can help subsequent translations inherit the styles and terminology that have already been corrected.

### 3. The same fixes repeatedly appear across the site

Suppose a reviewer made these changes:

- Change `租户` from `tenant account` to `tenant`
- Change `知识库` from `knowledge base` to `wiki`
- Change `空间` from `workspace` to `space`

If there is no traceable repository of experience, reviewers may need to repeat the same three fixes across dozens of documents. Once these decisions are written into a project-level playbook, all subsequent translations can inherit them.

### 4. Project knowledge exists only in people's heads

In many documentation teams, the actual translation rules are not written down:

- Which terms must be kept in the original language and not translated
- Which product names have official English names
- Whether the overall tone should be concise or more explanatory
- Whether API field names should be translated literally or kept in English

If this knowledge exists only in reviewers' heads, translation quality will heavily depend on "who happens to review the document." A traceable experience document can turn these decisions into a project asset.

### 5. New experience should not be confined to a single file

If a new translation rule is discovered in a single document, it should not be trapped there forever. The long-term direction for this tool is: once a new experience is learned, it can be applied to and re-validated across the rest of the workspace, especially terminology and other highly reusable fixes.

## What it can do

- Watch the entire workspace, not just individual files
- Merge multiple documents into multiple doc sets
- Initial support for sibling file layout: `guide.md`, `guide.en.md`, `guide.ja.md`
- Split Markdown into blocks and only retranslate blocks that changed and are translatable
- Preserve non-translatable content such as frontmatter, code blocks, HTML blocks, separators, etc.
- Learn from manual edits by updating a project-level translation playbook for each language pair
- Store runtime state outside the repository to avoid snapshot and hash pollution of the workspace

## Architecture

The first version is intentionally split into several layers:

- `DocumentProvider`: Where documents come from. The first provider is local files.
- `LayoutAdapter`: How files map to logical doc sets. The first preset is `sibling`.
- `TranslationEngine`: Block-level translation based on the Vercel AI SDK.
- `MemoryEngine`: Update the plaintext translation playbook based on manual corrections.
- `RuntimeStore`: Store snapshots, hashes, and the last generated baseline outside the repository.

Core objects used internally by the CLI include:

- `Workspace`: The root directory passed to `docplaybook <path>`
- `DocSet`: A source document and its multiple translated versions
- `DocumentRef`: A specific file for a particular language

## Why runtime state is stored outside the repository

The core synchronization loop requires more than just the Git history:

- A snapshot of the source texts after the last processing
- A snapshot of the last automatically generated translations
- A snapshot of the translations currently on disk

Only then can the agent answer two distinct questions:

- What changed in the source texts compared to the last processed baseline
- What humans changed in the translations compared to the last automatically generated baseline

These baselines are runtime state, not product content, so they are stored in the user data directory:

- macOS: `~/Library/Application Support/docplaybook/workspaces/<workspace-id>/`
- Linux: `$XDG_STATE_HOME/docplaybook/workspaces/<workspace-id>/`
- Windows: `%LOCALAPPDATA%/docplaybook/workspaces/<workspace-id>/`

You can also override this root directory via `DOCPLAYBOOK_HOME`.

## Configuration

Project configuration and traceable experience files are stored in the workspace:

```text
<workspace>/
  .docplaybook/
    config.json
    memories/
      zh-CN__en.md
      zh-CN__ja.md
```

Recommended model configuration formats:

- `gateway`: Use the Vercel AI Gateway, passing a gateway model string like `openai/gpt-5-mini`
- `openai`: Use the official provider package to call OpenAI directly
- `anthropic`: Use the official provider package to call Anthropic directly
- `openai-compatible`: Use a user-specified OpenAI-compatible endpoint, such as OpenRouter or a self-hosted gateway

`.docplaybook/config.json` is read as JSONC, so it can contain `//` or `/* ... */` comments, making it convenient to write explanations directly next to the configuration.

Example `.docplaybook/config.json` using the Vercel AI Gateway:

```json
{
  "version": 1,
  "sourceLanguage": "zh-CN",
  "targetLanguages": ["en", "ja"],
  "ignorePatterns": ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.docplaybook/**"],
  "concurrency": {
    "maxConcurrentRequests": 6
  },
  "batch": {
    "maxBlocksPerBatch": 8,
    "maxCharsPerBatch": 6000
  },
  "layout": {
    "kind": "sibling"
  },
  "model": {
    "kind": "gateway",
    "model": "openai/gpt-5-mini",
    "apiKeyEnv": "AI_GATEWAY_API_KEY"
  }
}
```

`ignorePatterns` is only used to supplement docplaybook's own ignore rules; rules in `.gitignore` are applied by default as well, even if this is an empty array.

`concurrency.maxConcurrentRequests` is the global request concurrency pool shared by all targets and batches in a single sync; default `6`, maximum supported `20`. If the provider is prone to rate limiting, start more conservatively.

`batch.maxBlocksPerBatch` controls how many blocks can be merged per batch translation; if you find the number of calls for long documents is still too high, try adjusting this value first.

The `model` section is explicitly left for the user to control. API keys should never be stored in the repository:

- The `gateway` mode uses the AI SDK Gateway model string and reads the API key from environment variables
- The `openai` mode uses the official OpenAI provider package and reads the API key from environment variables
- The `anthropic` mode uses the official Anthropic provider package and reads the API key or auth token from environment variables
- The `openai-compatible` mode lets you provide a base URL and API key via environment variables to connect to any OpenAI-compatible endpoint

`openai` configuration example:

```json
{
  "kind": "openai",
  "model": "gpt-5-mini",
  "apiKeyEnv": "OPENAI_API_KEY",
  "baseUrlEnv": "OPENAI_BASE_URL"
}
```

`anthropic` configuration example:

```json
{
  "kind": "anthropic",
  "model": "claude-sonnet-4-5",
  "apiKeyEnv": "ANTHROPIC_API_KEY",
  "authTokenEnv": "ANTHROPIC_AUTH_TOKEN",
  "baseUrlEnv": "ANTHROPIC_BASE_URL"
}
```

`openai-compatible` configuration example:

```json
{
  "kind": "openai-compatible",
  "providerName": "openrouter",
  "model": "google/gemini-2.5-flash",
  "baseUrlEnv": "OPENROUTER_BASE_URL",
  "apiKeyEnv": "OPENROUTER_API_KEY"
}
```

在创建模型客户端之前，`docplaybook` 还会自动加载这些 env 文件：

- `.docplaybook/.env.local`
- `.docplaybook/.env`
- `.env.docplaybook.local` (legacy location)
- `.env.docplaybook` (legacy location)
- `.env.local`
- `.env`

推荐实践：

- 将 `.docplaybook/config.json` 提交到仓库
- 将密钥放在 `.docplaybook/.env.local`
- 在自动化环境里使用 shell 环境变量或 CI secrets

## 翻译经验库

每个语言对都有一份可跟踪的 Markdown playbook，例如：

- `.docplaybook/memories/zh-CN__en.md`

这份文件会被注入到每一次翻译 prompt 中。它本质上就像项目级的翻译 skill 或 system context：

- Terminology rules
- Preferred phrasing
- Style correction rules
- Reusable manual overrides

This is also the biggest difference between this tool and a simple "translate changed files" script. The first draft is of course important, but what's more important is retaining and reusing human edits over the long term.

When a human edits a translated document, the agent compares:

- Previous source snapshot
- Previous automatically generated translation snapshot
- Current translation file

Then it has the LLM directly update the entire playbook, keeping it concise, deduplicated, and suitable for reuse in prompts. If the translation file has been significantly restructured, the agent will issue a warning and, to be safe, skip generating the experience.

## Layout presets

The presets implemented in the first version are:

- `sibling`: `guide.md`, `guide.en.md`, `guide.ja.md`

The internal model has reserved a form for future presets:

- `docusaurus`
- `rspress`

Both of these are currently reserved. The engine now treats documentation as “discrete files grouped by doc set”, which is better suited for docs-as-code style documentation sites than a “single-file-only” model.

## Installation

Project-level installation, suitable for local development:

```bash
npm install
```

Do not install globally; run it directly in the repository:

```bash
npm run dev -- --help
```

Install globally from a local repository:

```bash
npm install
npm run build
npm link
```

You can then use it in any directory:

```bash
docplaybook --help
docplaybook init ./my-docs
docplaybook ./my-docs
```

Package first, then install globally:

```bash
npm pack
npm install -g ./docplaybook-0.1.0.tgz
```

Remove global link:

```bash
npm unlink -g docplaybook
```

## Commands

Build:

```bash
npm run build
```

Initialize a workspace — we recommend running the interactive initialization first:

```bash
npm run dev -- init ./examples/sample-workspace
```

It will:

- Guide you to select a model provider and a specific model
- Complete required credential configuration, and perform a lightweight connectivity check once ready
- Automatically detect the primary document language and ask you to confirm
- Then prompt you to enter target languages like `en,ja`
- Create a `.docplaybook` directory and initialize configuration, and will not start translating immediately

If you want to add languages later, you can run it again in the same workspace:

```bash
npm run dev -- init ./examples/sample-workspace
```

Then enter the new target languages, for example `fr,de`. Existing languages will be kept; only new language configuration and memory files will be added.

If you're running in CI or a non-interactive environment, you can also pass parameters explicitly:

```bash
npm run dev -- init ./examples/sample-workspace --source zh-CN --targets en,ja
```

After initialization is complete, you can run a translation manually as needed, or go straight into watch mode.

Initialize using the official OpenAI direct connection:

```bash
npm run dev -- init ./examples/sample-workspace --model-kind openai --model gpt-5-mini
```

Initialize using Anthropic's official direct connection:

```bash
npm run dev -- init ./examples/sample-workspace --model-kind anthropic --model claude-sonnet-4-5
```

Initialize using a custom OpenAI-compatible provider:

```bash
npm run dev -- init ./examples/sample-workspace --model-kind openai-compatible --provider-name openrouter --model google/gemini-2.5-flash --api-key-env OPENROUTER_API_KEY --base-url-env OPENROUTER_BASE_URL
```

Defaults to run once and then exit:

```bash
npm run dev -- ./examples/sample-workspace
```

Continuous listening:

```bash
npm run dev -- ./examples/sample-workspace --watch
```

## Research Notes

The current solution references several tools that address adjacent problems, but they do not fully cover the "local-first + experience-learning loop" pattern:

- [Azure co-op-translator](https://github.com/Azure/co-op-translator): It is very close to the "incremental document translation" problem — it tracks source and translated states and only processes changes; however, it is not designed around "generating trackable plain-text experience files from human corrections."
- [Lingo.dev CLI](https://lingo.dev/en/cli): It maintains a delta lock file and attempts to preserve manual overrides before the source changes; this is a useful reference for incremental sync behavior in docs repositories.
- [GitLocalize](https://docs.gitlocalize.com/about.html): It provides segment-based docs-as-code continuous localization and supports translation memory and glossaries; capability-wise it's close, but the product is more of a platform workflow rather than a local agent skeleton.
- [Crowdin GitHub integration](https://store.crowdin.com/github): It represents a mature continuous localization product model with translation memory, AI, and repository synchronization; but it's much heavier compared to the local-first CLI approach here.
- [Docusaurus i18n](https://docusaurus.io/docs/i18n/introduction): It shows that multilingual documentation is usually split into discrete files organized by locale-aware directory structures.
- [Rspress i18n](https://rspress.rs/guide/basic/i18n): It likewise demonstrates that localized docs exist as discrete files, so a layout adapter is necessary.
- [Vercel AI SDK provider selection](https://ai-sdk.dev/docs/getting-started/choosing-a-provider): It shows that model/provider selection should always remain user-configurable rather than hard-coded into the tool.

## Current Limitations

- Currently only a local file workspace is implemented
- Currently only the `sibling` layout preset is implemented
- The experience recall strategy is intentionally simple: it injects the entire language-pair playbook each time
- When translations undergo major structural edits, the system only issues a warning and does not produce experience updates
- Markdown block parsing is best-effort; very complex documents may still require further refinement

## Near-term Directions

- Improve block-matching capabilities for complex Markdown structures such as lists and tables
- Complete layout adapters for Docusaurus and Rspress
- Add a project-level revalidation process to back-scan and validate existing translations with newly learned experiences
- Add cloud document providers such as Feishu Docs without modifying the core translation and experience engines
