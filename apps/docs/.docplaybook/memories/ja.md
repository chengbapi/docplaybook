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

## Style Notes

-
