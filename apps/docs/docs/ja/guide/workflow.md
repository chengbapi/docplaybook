# プロジェクトのワークフロー

インストールと初期化の後、ほとんどのチームは DocPlaybook を繰り返し使えるプロジェクトワークフローにします。

各モデルの相互作用を視覚的に説明したい場合は、[Flow Demo](/guide/demo) を参照してください。

## 推奨されるローカルループ

日々の作業では、最も有用な明示的なローカルの順序は次のとおりです：

1. `docplaybook translate .`
2. `docplaybook lint . --fix`

これは次の理由で有効です：

- `translate` はソースが変更されたときやターゲットが存在しないときにターゲットドキュメントを更新します
- `lint --fix` はプルリクエスト前に安全な翻訳の問題を修正します
- `learn` は意図的に実行されるもので、ソースの変更ごとにではなくレビュアーの編集後に実行できます

レビュアーが翻訳を編集した場合は、別のローカル手順として `docplaybook learn .` を実行してください。これにより `playbook.md` と `memories/<lang>.md` が更新されるため、これらの変更は他のソースファイルと同様にレビューする必要があります。

デフォルトコマンド `docplaybook .` は現在、次を実行します：

1. `docplaybook learn .`
2. `docplaybook translate .`

## package スクリプトの追加

ほとんどのチームはまず package スクリプトを追加します：

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

その後、パッケージマネージャーでそれらを実行します：

```bash
pnpm docs:sync
npm run docs:sync
yarn docs:sync
```

## 手動での使用

一般的な手動パターンは次のとおりです：

- リポジトリに既に翻訳済みのドキュメントがある場合、`init` の後に一度 `docplaybook bootstrap . --langs en,ja` を実行する
- レビュアーが翻訳を編集した後に `docplaybook learn .` を実行する
- ソースドキュメントが変更されたときに `docplaybook translate .` を実行する
- マージ前に `docplaybook lint . --fix` を実行する
- 変更されたファイルのみではなくワークスペース全体のレビューを行いたい場合は `docplaybook lint . --scope all` を実行する

一つのブランチで選択したロケールだけ作業したい場合は、`--langs` を追加してください：

```bash
pnpm exec docplaybook translate . --langs ja
pnpm exec docplaybook learn . --langs ja
pnpm exec docplaybook lint . --fix --langs ja
```

## Git フック

軽量なフックパターンとしては、プッシュ前に lint を実行する方法があります：

```bash
pnpm exec docplaybook lint . --fix
```

これは、コードレビューが始まる前に明確な指摘事項を得たい場合に適しています。

## CI
