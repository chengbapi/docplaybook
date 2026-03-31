# プロジェクトワークフロー

インストールと初期化の後、ほとんどのチームは DocPlaybook を再現可能なプロジェクトワークフローに組み込みます。

各モデルの相互作用を視覚的に説明したい場合は、[Flow Demo](/guide/demo) を参照してください。

## 推奨ローカルループ

日々の作業では、最も有用なローカルでの順序は次のとおりです:

1. `docplaybook learn .`
2. `docplaybook translate .`
3. `docplaybook lint . --fix`

この方法がうまく機能する理由は次のとおりです:

- `learn` は再利用可能なプロジェクトガイダンスを `playbook.md` と `memories/<lang>.md` に書き込みます
- `translate` は Git で追跡されたソースの変更から対象ドキュメントを更新します
- `lint --fix` はプルリクエスト前に安全な翻訳上の問題を修正します

`learn` はプロジェクトガイダンスファイルを変更するためローカル開発で実行すべきで、これらはコードレビューで確認されるべきです。

## パッケージスクリプトの追加

ほとんどのチームは最初にパッケージスクリプトを追加します:

```json
{
  "scripts": {
    "docs:translate": "docplaybook translate .",
    "docs:learn": "docplaybook learn .",
    "docs:lint": "docplaybook lint . --fix",
    "docs:i18n": "docplaybook learn . && docplaybook translate . && docplaybook lint . --fix"
  }
}
```

その後、パッケージマネージャーでそれらを実行します:

```bash
pnpm docs:i18n
npm run docs:i18n
yarn docs:i18n
```

## 手動での使用

一般的な手動パターンは次のとおりです:

- run `docplaybook bootstrap . --langs en,ja` once after `init` if the repo already has translated docs
- run `docplaybook learn .` after reviewers have edited translations
- run `docplaybook translate .` when source docs changed
- run `docplaybook lint . --fix` before merge
- run `docplaybook lint . --scope all` when you want a full workspace review instead of only changed files

1つのブランチで選択したロケールのみを作業したい場合は、`--langs` を追加します:

```bash
pnpm exec docplaybook translate . --langs ja
pnpm exec docplaybook learn . --langs ja
pnpm exec docplaybook lint . --fix --langs ja
```

## Git フック

軽量なフックのパターンとして、push 前に lint を実行する方法があります:

```bash
pnpm exec docplaybook lint . --fix
```

コードレビューが始まる前に明示的な指摘を得たい場合に適しています。

## CI

CI は通常、チームが共有プロバイダ、共有モデル、共有の翻訳予算を集中管理する場所です。

CI 固有のセットアップ、プロバイダ戦略、例のフローについては [CI](/guide/ci) を参照してください。
