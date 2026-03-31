# フロー デモ

このページでは、DocPlaybook の 3 つの主要なループを、具体的で Git を優先した方法で示します。

ポイントは、各モデル呼び出しを分かりやすくすることです:

- 入力内容
- モデルが行うこと
- 出力内容

## Translate

`translate` はソース駆動です。

Git のソース文書と現在のワーキングツリーを比較し、変更のないターゲットブロックを安定させ、変更されたターゲットブロックのみをモデルに再生成させます。

```text
Source A (Git HEAD)
+ Source A (working tree)
+ playbook.md
+ memories/<lang>.md
+ current target B
-> LLM
-> updated target B
```

具体例:

- 変更前のソース: `使用知识库管理文档。`
- 変更後のソース: `使用知识库统一管理团队文档。`
- メモリルール: `Translate "知识库" as "Wiki".`
- 期待されるターゲット: `Use the Wiki to manage team docs in one place.`

確認事項:

- 変更されたブロックのみが再生成される
- メモリとプレイブックのルールが結果に残っている
- コードフェンス、リンク、インラインコードが保持される

## Learn

`learn` はターゲット差分駆動です。

レビュー前後の翻訳ファイルを比較し、その編集を現在のソースと照合して、その編集が再利用可能なプロジェクトガイダンスになるべきかをモデルに尋ねます。

```text
Target B (Git HEAD)
+ Target B (working tree)
+ current source A
+ playbook.md
+ memories/<lang>.md
-> LLM
-> structured updates for playbook.md and memories/<lang>.md
```

具体例:

- ソースブロック: `使用知识库管理文档。`
- 翻訳前: `Use the knowledge base to manage docs.`
- 翻訳後: `Use the Wiki to manage docs.`
- 期待されるメモリ更新: 用語ルールを追加（例: `Translate "知识库" as "Wiki".`）

確認事項:

- 繰り返し発生し再利用可能な修正はメモリに追加される
- 一回限りのページ書き換えは無視される
- 結果は曖昧な説明ではなく構造化された更新である

## Lint

`lint` はルールを考慮したレビュー手順です。

現在のソース、現在のターゲット、プレイブック、言語メモリ、lint ルールを読み取り、モデルに対して問題の一覧を返すように要求します。

```text
Source A
+ Target B
+ playbook.md
+ memories/<lang>.md
+ lint rules
-> LLM
-> score + issue list + optional safe fixes
```

具体例:

- メモリは `gateway` を優先する
- 現在の翻訳は `AI gateway` としている
- 期待される指摘: 用語の不一致

確認事項:

- 指摘は実際の翻訳問題を指す
- lint はプロジェクトの言語ルールを尊重する
- 提案される修正は安全で局所的に留まる

## メンタルモデル

どのコマンドを実行するか判断する際に、このクイックマップを使用してください:

- `translate`
  - ソースが変更され、ターゲットが追従する必要がある
- `learn`
  - 翻訳レビューが行われ、プロジェクトメモリが改善されるべき
- `lint`
  - 翻訳が存在し、品質をチェックする必要がある

これが全体のループです:

1. ソース文書を編集する
2. `translate` を実行する
3. レビュー担当がターゲット文書を改善する
4. `learn` を実行する
5. `lint` を実行する
