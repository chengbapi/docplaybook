# デモ

このページには詳細な手順のウォークスルーが掲載されています。

ホームページは製品を素早く説明するべきです。このページは、ドキュメントリポジトリ内での実際の DocPlaybook ループが、具体的なファイル変更、コマンド、および期待される出力とともにどのように見えるかを示します。

## デモリポジトリの構成

```text
docs/
  en/
    guide/
      introduction.md
  ja/
    guide/
      introduction.md
.docplaybook/
  playbook.md
  memories/
    ja.md
```

この例では：

- 英語がソース言語
- 日本語がターゲット言語
- チームは既に用語メモリを持っている

## ケース1: 変更されたブロックのみを翻訳する

ライターが `docs/en/guide/introduction.md` の英語の文を1つ更新します。

変更前：

```md
Use the knowledge base to manage docs.
```

変更後：

```md
Use the knowledge base to manage team docs in one place.
```

プロジェクトメモリには既に次が含まれています：

```md
- Translate "knowledge base" as "Wiki".
```

実行：

```bash
docplaybook translate docs/en/guide/introduction.md --to ja
```

DocPlaybook がモデルに送るもの：

- Git からのソース差分
- 現在の日本語ターゲットファイル
- `.docplaybook/playbook.md`
- `.docplaybook/memories/ja.md`

期待される結果：

```md
Wiki を使ってチームのドキュメントを一元管理します。
```

ここで重要な点：

- 変更されていない日本語のブロックはそのままにする
- 用語はメモリに従う
- 変更されたソースブロックのみ再生成する

## ケース2: レビュアーの修正から学ぶ

レビュアーが日本語訳を手動で編集する。

レビュー前:

```md
ワークスペースを設定します。
```

レビュー後:

```md
workspace を設定します。
```

チームは技術ドキュメントで`workspace`を翻訳せずそのままにしておきたい。

実行:

```bash
docplaybook learn docs/ja/guide/introduction.md --from en
```

期待される効果:

- DocPlaybookがその修正が再利用可能か確認する
- 再利用可能であれば、構造化されたメモリ更新を提案する

典型的なメモリパッチ:

```md
- Keep "workspace" in English in Japanese docs.
- Prefer concise technical Japanese over explanatory paraphrase.
```

ここがレビュー作業が将来の一貫性へと変わる瞬間です。

## ケース3: マージ前に翻訳済みページをリンティングする

ページは翻訳済みだが、品質チェックを行いたい。

現在の日本語ファイルには次の内容が含まれる:

```md
DocPlaybook は AI gateway mode をサポートします。
この機能はとても簡単に使えます。
```

プロジェクトのルールには既に次のように記されている:

- `gateway`を推奨し、`AI gateway`は使用しない
- トーンは中立的かつ技術的に保つ

Run:

```bash
docplaybook lint docs/ja/guide/introduction.md --from en
```

Expected findings:

```text
warn  Terminology mismatch: use "gateway" instead of "AI gateway".
info  Tone drift: avoid promotional wording like "very easy".
```

This is useful right before commit or in CI because it catches issues without rewriting the whole page.

## Full loop

One realistic team loop looks like this:

1. Edit English source docs.
2. Run `translate` for the target languages that need updates.
3. Review the translated files.
4. Run `learn` on important reviewer corrections.
5. Run `lint` before push or in CI.

## Why this split works

Each command has one job:

- `translate` keeps target docs aligned with source changes
- `learn` captures reusable reviewer knowledge
- `lint` checks whether the current translation still matches project rules

That separation is what makes DocPlaybook understandable in practice, not just in theory.
