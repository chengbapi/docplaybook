# ローカルワークフロー

ほとんどのチームは、ソース変更のために明示的なローカルループを使用し、レビュアーの編集後に別の `learn` ステップを実行します。

## ソース変更ループ

日常的なソース更新:

1. `docplaybook translate .`
2. `docplaybook lint . --fix`

これが有効な理由:

- `translate` は古くなっているか欠落しているターゲットドキュメントを補います
- `lint --fix` はレビュー前に安全な問題を自動修正します

## レビュアー編集ループ

レビュアーが翻訳済みドキュメントを変更したとき:

1. `docplaybook learn .`
2. `docplaybook lint . --scope changed`

これにより、再利用可能なガイダンスファイルを通常のコードレビューでレビューできる状態に保ちます。

## パッケージスクリプト

```json
{
  "scripts": {
    "docs:translate": "docplaybook translate .",
    "docs:learn": "docplaybook learn .",
    "docs:lint": "docplaybook lint . --fix",
    "docs:sync": "docplaybook translate . && docplaybook lint . --fix"
  }
}
```

お使いのパッケージマネージャーで実行します:

```bash
pnpm docs:sync
npm run docs:sync
yarn docs:sync
```

## Git フック

実用的なローカルフックのパターンは、プッシュ前に lint を実行することです:

```bash
pnpm exec docplaybook lint . --fix
```

これにより、コードレビューが始まる前に明確な問題点が示されます。
