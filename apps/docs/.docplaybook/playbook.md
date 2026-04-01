# Playbook

This file stores reusable translation guidance that applies across every target language.

- Updated: 2026-04-01T00:00:00.000Z

## Voice








- Maintain a technical, direct, and concise voice.
- Preserve the force of warnings, imperatives, and safety guidance — translate them literally and do not soften or add promotional language.
- Prefer neutral technical phrasing over conversational or marketing language.

## Protected tokens

- Do not translate or alter CLI commands, file paths, filenames, product/framework names, config keys, environment variable names, model IDs, API fields, route names, or other machine-readable tokens.
- Keep these tokens verbatim. When they appear in running prose, render them as inline code (backticks). Leave them unchanged inside code blocks or when already formatted as code.

## Structure and technical content

- Preserve Markdown structure and technical blocks exactly: do not change code fence markers, block boundaries, frontmatter keys, or block types (code, YAML/JSON, frontmatter, lists, headings). Maintain start/end fences.
- Do not translate or alter structured JSON/YAML content, configuration snippets, code examples, or inline code tokens. Leave syntax, spacing, and punctuation that affect parsing unchanged.
- Maintain block types and spacing so structure-aware writeback and parsers remain unaffected.

## Clarity and brevity

- Be concise and unambiguous: choose the shortest clear phrasing that preserves technical meaning and actionable steps.
- When marking protected tokens in translated prose, render them as inline code (backticks) unless they already appear as code.
## Protected Terms








-

- Treat hyphenated internal identifiers (e.g., source-hash, health-check, memory-patch) as protected tokens: do not translate them, preserve spelling and hyphens exactly, and render them as inline code (backticks) in running prose unless they already appear formatted as code.

- Preserve product/framework names and acronyms verbatim across translations: keep original capitalization and spelling (e.g., Docusaurus, Rspress, VitePress, LLM, CI, GitHub). Do not translate these names; enclose them in backticks when used as inline code or technical tokens.

- Always preserve protected tokens verbatim (product/framework names, CLI commands, file paths, hyphenated identifiers, model IDs, config keys, environment variables). In running prose and headings render them as inline code (backticks) unless they already appear as code or inside a code block. Do not translate, change capitalization, or insert translations/inflections inside the token.

- 所有命令、子命令、文件名、路径、配置键、模型 ID 等机器可识别的技术 token 在运行文本中必须保持原文并用反引号呈现（例如：`docplaybook learn`、`.docplaybook/state/*`）。不要对这些 token 添加目标语言标点或翻译替换。
## Translation Rules








-
