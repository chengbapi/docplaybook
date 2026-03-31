# CI

CIで`DocPlaybook`を実行することは、チームのドキュメントワークフローにおける強力なデフォルトになることが多い。

## なぜCIで実行するのか

- チームが1つのプロバイダと1つのモデルに標準化できる
- 翻訳の品質とトーンが実行ごとに安定する
- コストをチームのアカウントやCI予算に集約できる
- ドキュメント作成者が翻訳を揃えるためだけに各自でLLMのセットアップを用意する必要がない

## 一般的なCIの責務

一般的なCIジョブは次のとおりです:

- `docplaybook translate`
  - ソースコンテンツから翻訳済みドキュメントを生成または更新する
- `docplaybook lint`
  - 現在のメモリ標準に照らして翻訳をレビューする

CIでは、`lint`は通常次のように実行するのが最適です:

- `docplaybook lint . --fix --scope changed`
  - 安全な問題を修正する
  - 現在の git ワーキングツリーで変更された翻訳ファイルのみを操作する
- `docplaybook lint . --fix --scope changed --langs ja`
  - 動作は同じだが、パイプラインを言語ごとに分割している場合は選択したロケールのみを対象にする

`learn`は通常CIジョブではありません。`playbook.md`と`memories/<lang>.md`を変更するため、これらの編集は通常ローカルで作成しコードレビューで確認するべきです。

## パッケージマネージャーの例

### pnpm

```bash
pnpm exec docplaybook translate .
pnpm exec docplaybook lint . --fix --scope changed
```

### npm

```bash
npx docplaybook translate .
npx docplaybook lint . --fix --scope changed
```

### yarn

```bash
yarn exec docplaybook translate .
yarn exec docplaybook lint . --fix --scope changed
```

## プロバイダとモデル

DocPlaybookは特定のLLMプロバイダを要求しません。チームに合ったプロバイダを選択できます。

実務的なパターンは2つあります:

### 設定でモデルを固定する

プロバイダとモデルを`.docplaybook/config.json`に保持すると、次のようになります:

- ローカル実行とCI実行が同じ挙動になる
- 翻訳出力がより予測可能になる
- lintの結果を時間を通じて比較しやすくなる

このモードでも、ローカルとCIで異なるシークレットを使用できます:

- ローカルの開発者はキーを`.docplaybook/.env.local`に保持する
- CIは環境変数を通じてキーを注入する

### 各環境ごとにモデルを保持する

ローカルの開発者があるプロバイダ/モデルを必要とし、CIが別のものを必要とする場合、`config.json`で`model`を固定しないでください。

代わりに:

- ローカルは`.docplaybook/.env.local`を使用する
- CIはパイプライン内で`DOCPLAYBOOK_MODEL_*`変数とプロバイダのシークレットを設定する

これはより柔軟ですが、ローカル実行とCI実行の間で出力がより乖離する可能性があります。

## 例のフロー

```bash
pnpm exec docplaybook translate .
pnpm exec docplaybook lint . --fix --scope changed
```

定期的なフルレビューのジョブも欲しい場合:

```bash
pnpm exec docplaybook lint . --scope all
```

## プルリクエストでの使い方

実用的なCIパターンは次のとおりです:

1. `docplaybook translate .` を実行する
2. 生成された翻訳の変更をコミットまたはアップロードする
3. `docplaybook lint . --fix --scope changed` を実行する
4. lintが受け入れられない問題を検出した場合はジョブを失敗させる

これによりレビュワーは、更新された翻訳ファイルと明示的な品質の指摘の両方を得られます。
