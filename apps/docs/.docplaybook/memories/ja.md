# Memory: ja

This file stores reusable translation guidance specific to ja.

- Updated: 2026-04-01T00:00:00Z

## Terminology

- Use ソースドキュメント for "source document" and ターゲットドキュメント for "target document". Avoid ターゲット文書.
- Maintain and reuse approved translations for recurring product terms and technical vocabulary.

## Punctuation and typography
- Use Japanese (full‑width) punctuation in running Japanese prose: 、。：「」『』：（）・〜（例：これは例です。）
- Preserve ASCII punctuation and spacing inside inline code, command examples, JSON, logs, code snippets, file names, and other technical tokens (for example, keep parentheses, commas, colons, quotes as ASCII within `docplaybook translate`, `{"key": "value"}`, etc.).
- When text mixes languages, apply full‑width punctuation to the Japanese portions and keep ASCII punctuation for embedded technical/English tokens.

## UI labels and short titles
- Translate UI labels and short titles concisely (one or two words) — avoid verbose explanations. Examples: Translate → 翻訳, Learn → 学習, Lint → リント.
- Keep command tokens, CLI commands, API method names, and other executable identifiers verbatim and formatted as inline code (for example, `docplaybook translate`).

## Frontmatter, identifiers, and protected names
- Do not translate structured frontmatter fields or any identifiers used by the site or tooling. Preserve protected names (product names, platform names, internal identifiers) verbatim in frontmatter and structured data.
- Only translate human‑facing copy fields when appropriate; keep casing and spacing from identifiers intact.

- Do not insert ASCII spaces between inline code/English tokens and Japanese particles. Place the particle immediately after the token: use `DocPlaybook`の or DocPlaybookの (no space) rather than `DocPlaybook` の. Keep spacing consistent whether the token is backticked or plain.

- For preference statements in technical contexts, use 明確な優先/推奨表現. Prefer phrasing such as 「メモリは 'gateway' を優先し、'AI gateway' は使用しません。」 or 「用語の不一致：メモリは 'gateway' を推奨し、'AI gateway' は避けます。」 Avoid 好む/好みません for technical preference statements.
## Style Notes


-

- In Japanese pages, consistently format protected technical tokens using inline code (backticks) in running text and headings. Apply this uniformly to product/framework names (e.g., `DocPlaybook`, `Docusaurus`), mode identifiers (e.g., `sibling`), and CLI commands (e.g., `pnpm exec docplaybook init .`). Do not alternate between plain and code-styled forms on the same page or section.
