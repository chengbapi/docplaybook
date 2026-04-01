# クイックスタート

## プロジェクトにインストール

既存のドキュメントプロジェクトにDocPlaybookを統合する場合、通常は開発依存（dev dependency）としてインストールするのが最適です。

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:16px 0 22px;">
  <div style="padding:14px 16px;border:1px solid #e5e7eb;border-radius:16px;">
    <div style="font-weight:700;margin-bottom:10px;">pnpm</div>
    <pre style="margin:0;white-space:pre-wrap;"><code>pnpm add -D docplaybook
pnpm exec docplaybook --help</code></pre>
  </div>
  <div style="padding:14px 16px;border:1px solid #e5e7eb;border-radius:16px;">
    <div style="font-weight:700;margin-bottom:10px;">npm</div>
    <pre style="margin:0;white-space:pre-wrap;"><code>npm install --save-dev docplaybook
npx docplaybook --help</code></pre>
  </div>
  <div style="padding:14px 16px;border:1px solid #e5e7eb;border-radius:16px;">
    <div style="font-weight:700;margin-bottom:10px;">yarn</div>
    <pre style="margin:0;white-space:pre-wrap;"><code>yarn add -D docplaybook
yarn exec docplaybook --help</code></pre>
  </div>
</div>

まだプロジェクトに追加したくない場合：

```bash
pnpm dlx docplaybook --help
npx docplaybook --help
yarn dlx docplaybook --help
```

## プロジェクトの初期化

インストール後、最初の実際の手順は次のとおりです：

```bash
pnpm exec docplaybook init .
```

`DocPlaybook` は、初期化がほとんどのプロジェクトで同様になるよう設計されています。ドキュメントが既に `Docusaurus`、`Rspress`、または `VitePress` を使用している場合、DocPlaybook はそれを検出して内部で対応するパス規約を適用します。

サポートされているドキュメントフレームワークが検出されない場合は、`sibling` にフォールバックします。

`init` 実行中、DocPlaybook は次のことを行います：

- 可能な場合はワークスペースのレイアウトを検出する
- モデルプロバイダとモデルを選択する
- 必要な認証情報を収集する
- モデルの接続性をテストする
- ソース言語を検出する
- ターゲット言語を尋ねる
- `.docplaybook/config.json` を作成する
- `.docplaybook/memories/*.md` を作成する
- `.docplaybook/playbook.md` を作成する

翻訳済みのターゲットファイルが既に存在する場合、`init` は `bootstrap` の実行を提案します。これにより、最初のプレイブックと言語メモリを既存のドキュメントから推測できます。

## プロバイダ設定

DocPlaybook はAI駆動かつLLMベースのため、プロバイダの設定は初期化の一部です。

`init` 中に、次のことを行います：

- プロバイダを選択する
- モデルIDを選択する
- 認証情報を提供する
- 接続チェックを実行する

チームに合ったプロバイダを選択できます。DocPlaybook は特定のプロバイダファミリーを要求しません。

チームのワークフローでは、多くのプロジェクトがローカル実行とCI実行の整合性を保つために、providerとmodelを設定で固定します。

## レイアウトとフレームワークの慣例

ユーザーフローは変わりませんが、出力レイアウトはDocPlaybookが検出した内容によって決まります:

```text
sibling:
guide.md
guide.en.md
guide.ja.md

docusaurus:
docs/guide/intro.md
i18n/en/docusaurus-plugin-content-docs/current/guide/intro.md

rspress:
docs/en/guide/intro.md
docs/ja/guide/intro.md

vitepress:
docs/guide/intro.md
docs/en/guide/intro.md
```

### Docusaurus

DocPlaybookが`Docusaurus`を検出すると、翻訳されたドキュメントを次の場所に書き込みます:

```text
i18n/<locale>/docusaurus-plugin-content-docs/current/
```

これは公式のDocusaurusドキュメントのi18n構造に従います。

### Rspress

DocPlaybookが`Rspress`を検出すると、翻訳されたドキュメントを次の場所に書き込みます:

```text
docs/<locale>/
```

これはRspress向けのDocPlaybook統合上の慣例として理解してください。

### VitePress

DocPlaybookが`VitePress`を検出すると、翻訳されたドキュメントを次の場所に書き込みます:

```text
docs/<locale>/
```

これはVitePressプロジェクトで使用される一般的なローカライズドドキュメントのレイアウトに従います。

### Sibling

サポートされているドキュメントフレームワークが検出されない場合、DocPlaybookは`sibling`にフォールバックし、翻訳ファイルはソースファイルの隣に配置されます:

```text
guide.md
guide.en.md
guide.ja.md
```

## コアコマンド

これらは初期化後に使用するコマンドです。

### `docplaybook`

これは日常的に使用するデフォルトのコマンドです。

```bash
pnpm exec docplaybook .
```

各サブステップを手動で決めずに、通常のプロジェクトワークフローを実行したいときに使用します。

Today that default workflow is:

1. `learn`
2. `translate`

### `docplaybook bootstrap`

リポジトリで既に管理されている翻訳済みドキュメントから、最初のメモリファイルを作成します。

```bash
pnpm exec docplaybook bootstrap . --langs en,ja
```

ドキュメントサイトに既に翻訳ファイルが含まれている場合、`init` の後にこれを使用します。

### `docplaybook translate`

ソースドキュメントをターゲット言語に翻訳します。

```bash
pnpm exec docplaybook translate .
```

ソースドキュメントから翻訳出力のみを更新したい場合に使用します。

`translate` は状態駆動です: ターゲットドキュメントのソースハッシュが変更されておらず、ターゲットが既に存在する場合、DocPlaybook はそれをスキップします。

ターゲット言語を1つまたは2つだけ処理するには:

```bash
pnpm exec docplaybook translate . --langs ja
pnpm exec docplaybook translate . --langs en,ja
```

### `docplaybook learn`

人間のレビューによる編集をメモリファイルに取り込みます。

```bash
pnpm exec docplaybook learn .
```

レビュアーが翻訳済みドキュメントを更新し、その修正を後でDocPlaybookに再利用させたい場合に使用します。

`learn` は状態駆動です: 直近の `learn` 実行以降でコンテンツハッシュが変わっていないターゲットファイルはスキップし、変更されたターゲットについては現在のソース/ターゲットのペアから再利用可能なガイダンスを抽出します。

学習を選択したターゲット言語に限定することもできます:

```bash
pnpm exec docplaybook learn . --langs ja
```

### `docplaybook lint`

翻訳をソースドキュメントとメモリに照らしてレビューします。

```bash
pnpm exec docplaybook lint .
```

これにより、用語、トーン、網羅性、Markdown の整合性、流暢さ、全体的な品質に関する lint スタイルの所見とスコアが返されます。

安全な修正を自動的に適用するには:

```bash
pnpm exec docplaybook lint . --fix
```

変更されたファイルのみではなく、翻訳されたすべてのファイルをリントするには:

```bash
pnpm exec docplaybook lint . --scope all
```

また、スコープと言語フィルタを組み合わせることもできます:

```bash
pnpm exec docplaybook lint . --fix --scope changed --langs ja
```

## ログ

詳細なログ:

```bash
pnpm exec docplaybook . --verbose
```

デバッグログ:
