# コマンド

このページでは `init` の後のコアな CLI 操作を説明します。

## デフォルトコマンド

```bash
pnpm exec docplaybook .
```

デフォルトのローカルワークフローは現在、次を実行します:

1. `learn`
2. `translate`

個々のステップを手動で選ばず、通常の保守ループを実行したいときに使用します。

## `docplaybook bootstrap`

```bash
pnpm exec docplaybook bootstrap . --langs ja
```

リポジトリにすでに整列された翻訳ドキュメントが含まれており、その既存の内容から DocPlaybook に最初のプロジェクトメモリを推測させたい場合に `bootstrap` を使用します。

`bootstrap`:

- リポジトリ内の整列済みのソースおよびターゲット文書をスキャンします
- 最初の `.docplaybook/playbook.md` を書き込みます
- 最初の `.docplaybook/memories/<lang>.md` を書き込みます

これはコールドスタートの手順です。その後ワークスペースを同期し続けるものではありません。日常的な更新は引き続き `translate`、`learn`、`lint` を使用します。

## `docplaybook translate`

```bash
pnpm exec docplaybook translate .
```

ソース文書が変更され、ターゲット文書を追従させる必要があるときにこれを使用します。

`translate` は状態駆動です:

- ターゲット文書に対応するソースのハッシュが変更されておらず、かつターゲットが既に存在する場合はスキップします
- ソースのハッシュが変更されたかターゲットが存在しない場合は、ターゲット記事を安全に更新します

実行を選択した言語に限定できます:

```bash
pnpm exec docplaybook translate . --langs ja
pnpm exec docplaybook translate . --langs en,ja
```

## `docplaybook learn`

```bash
pnpm exec docplaybook learn .
```

レビュアーが翻訳文書を編集した後、その修正を再利用可能なプロジェクトガイダンスに反映させたい場合にこれを使用します。

`learn` も状態駆動です:

- 最後の learn 実行以降、ターゲットのハッシュが変更されていない場合はスキップします
- ターゲットが変更されている場合は、現在のソース/ターゲットのペアを読み取り、`playbook.md` と `memories/<lang>.md` を更新します

学習を選択した言語に限定できます:

```bash
pnpm exec docplaybook learn . --langs ja
```

## `docplaybook lint`

```bash
pnpm exec docplaybook lint .
```

翻訳文書をソース文書や現在のプロジェクトガイダンスと照合してレビューするために使用します。

典型的なバリエーション:

```bash
pnpm exec docplaybook lint . --fix
pnpm exec docplaybook lint . --scope all
pnpm exec docplaybook lint . --fix --scope changed --langs ja
```

## ログ

詳細ログ:

```bash
pnpm exec docplaybook . --verbose
```

デバッグログ:

```bash
pnpm exec docplaybook . --debug
```
