# CI

CIで`DocPlaybook`を実行することは、チームのドキュメントワークフローにおける強力なデフォルトであることが多い。

## CIで実行する理由

- チームは単一のプロバイダとモデルに標準化できる
- 翻訳の品質とトーンが実行ごとにより安定する
- コストをチームのアカウントやCIの予算に集約できる
- ドキュメント作成者が翻訳の整合性を保つためだけに各自でLLM環境を用意する必要がなくなる

## 一般的なCIの責務

最も一般的なCIジョブは次のとおりです。

- `docplaybook translate`
  - ソースコンテンツから翻訳済みドキュメントを生成または更新する
- `docplaybook lint`
  - 翻訳されたドキュメントを現在のメモリ標準と照らしてレビューする

CIでは、`lint`は通常次のように扱うのが最適です。

- `docplaybook lint . --fix --scope changed`
  - 安全な問題を修正する
  - 現在のgitワーキングツリーで変更された翻訳ファイルのみを扱う
- `docplaybook lint . --fix --scope changed --langs ja`
  - 同じ動作だが、パイプラインを言語ごとに分割している場合に選択したロケールだけを対象とする

`learn`は通常CIジョブではありません。`playbook.md`と`memories/<lang>.md`を変更するため、これらの編集は通常ローカルで作成し、コードレビューで確認するべきです。

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

実務的には2つのパターンがあります：

### 設定でモデルをロックする

プロバイダーとモデルを `.docplaybook/config.json` に保持すると、次のことが可能になります：

- ローカル実行とCI実行が同じ挙動になる
- 翻訳出力がより予測可能になる
- lintの結果を時間経過で比較しやすくなる

このモードでも、ローカルとCIは異なるシークレットを使えます：

- ローカル開発者はキーを `.docplaybook/.env.local` に保存しておく
- CIは環境変数を通じてキーを注入する

### モデルを各環境にローカルで保持する

ローカル開発者があるプロバイダー/モデルを必要とし、CIが別のものを必要とする場合は、`config.json` に `model` を固定しないでください。

代わりに：

- ローカルは `.docplaybook/.env.local` を使用する
- CIはパイプラインで `DOCPLAYBOOK_MODEL_*` 変数とプロバイダーのシークレットを設定する

こちらの方が柔軟ですが、ローカル実行とCI実行の間で出力がより乖離する可能性があります。

## 例のフロー

```bash
pnpm exec docplaybook translate .
pnpm exec docplaybook lint . --fix --scope changed
```

定期的な完全レビューのジョブも実行したい場合：

```bash
pnpm exec docplaybook lint . --scope all
```

## プルリクエストでの使用

実用的なCIパターンは：

1. `docplaybook translate .` を実行する
2. 生成された翻訳変更をコミットするかアップロードする
3. `docplaybook lint . --fix --scope changed` を実行する
4. lintが受け入れられない問題を検出した場合、ジョブを失敗させる

これによりレビュー担当者は、更新された翻訳ファイルと明確な品質の指摘の両方を得られます。
