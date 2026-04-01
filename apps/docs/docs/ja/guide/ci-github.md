# CI と GitHub

CI は通常、チームが1つのプロバイダー、1つのモデル、1つの翻訳予算を集中管理する場所です。

## 典型的な CI ジョブ

一般的な CI の責務は次のとおりです:

- `docplaybook translate`
- `docplaybook lint`

一般的なコマンド:

```bash
pnpm exec docplaybook translate .
pnpm exec docplaybook lint . --fix --scope changed
```

パイプラインがロケール固有の場合:

```bash
pnpm exec docplaybook lint . --fix --scope changed --langs ja
```

定期的な全体レビューを行いたい場合:

```bash
pnpm exec docplaybook lint . --scope all
```

## GitHub ワークフローの使用

実用的な GitHub ワークフローの例は次のとおりです:

1. `docplaybook translate .` を実行する
2. 生成された翻訳の変更をコミットするかアップロードする
3. `docplaybook lint . --fix --scope changed` を実行する
4. lint がまだ許容できない問題を報告する場合、ジョブを失敗させる

これによりレビュアーは、更新された翻訳ドキュメントと明確な検出結果の両方を得られます。

## モデルの設定

2つのパターンが有効です:

### モデル共有、シークレットを分ける

プロバイダーとモデルを `.docplaybook/config.json` に保持します。

その場合:

- ローカル開発者は鍵を `.docplaybook/.env.local` に保持する
- CI は環境変数を通じてシークレットを注入する

### ローカルと CI で異なるモデル

`config.json` に `model` を固定しないでください。

その場合:

- ローカルは `.docplaybook/.env.local` を使用する
- CI はパイプライン内で `DOCPLAYBOOK_MODEL_*` 変数とプロバイダーのシークレットを設定する

これはより柔軟ですが、ローカルと CI の実行間で出力がずれやすくなります。
