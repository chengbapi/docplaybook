# クイックスタート

## プロジェクトへのインストール

既存のドキュメントプロジェクトにDocPlaybookを統合する場合、開発用依存としてインストールするのが一般的に最適です。

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

まだプロジェクトに追加したくない場合:

```bash
pnpm dlx docplaybook --help
npx docplaybook --help
yarn dlx docplaybook --help
```

## プロジェクトの初期化

インストール後、最初の実際のステップは次のとおりです:

```bash
pnpm exec docplaybook init .
```

`DocPlaybook` は初期化がほとんどのプロジェクトで同様に行えるよう設計されています。ドキュメントが既に `Docusaurus`、`Rspress`、または `VitePress` を使用している場合、DocPlaybook はそれを検出し、対応するパス規約を内部的に適用します。

サポートされているドキュメントフレームワークが検出されない場合は、`sibling` にフォールバックします。

`init` 実行中、DocPlaybook は次のことを行います:

- 可能な場合はワークスペースのレイアウトを検出する
- モデルプロバイダとモデルを選択する
- 必要な認証情報を収集する
- モデルの接続性をテストする
- ソース言語を検出する
- ターゲット言語を尋ねる
- `.docplaybook/config.json` を作成する
- `.docplaybook/memories/*.md` を作成する

既に翻訳済みのターゲットファイルが存在する場合、`init` は `bootstrap` の実行を提案し、既存のドキュメントから最初のプレイブックと言語メモリを推定できるようにします。

## プロバイダの設定

DocPlaybook は AI と LLM を利用しているため、プロバイダの設定は初期化の一部です。

`init` 中に次の操作を行います:

- プロバイダを選択する
- モデルIDを選択する
- 認証情報を提供する
- 接続チェックを実行する

チームに合ったプロバイダを選択できます。DocPlaybook は特定のプロバイダファミリーを必須としません。

チームのワークフローでは、多くのプロジェクトが設定ファイルでプロバイダとモデルを固定し、ローカル実行とCI実行の整合性を保ちます。

## レイアウトとフレームワークの規約

ユーザーフローは同じですが、出力レイアウトは DocPlaybook が検出するものによって異なります:

```text
sibling:
guide.md
guide.en.md
guide.ja.md

docusaurus:
docs/guide/intro.md
i18n/en/docusaurus-plugin-content-docs/current/guide/intro.md

rspress:
docs/guide/intro.md
docs/en/guide/intro.md

vitepress:
docs/guide/intro.md
docs/en/guide/intro.md
```

### Docusaurus

DocPlaybook が `Docusaurus` を検出すると、翻訳されたドキュメントを次の場所に書き込みます:

```text
i18n/<locale>/docusaurus-plugin-content-docs/current/
```

これは公式の Docusaurus ドキュメントの i18n 構造に従います。

### Rspress

DocPlaybook が `Rspress` を検出すると、翻訳されたドキュメントを次の場所に書き込みます:

```text
docs/<locale>/
```

これは Rspress に対する DocPlaybook の統合規約として理解してください。

### VitePress

DocPlaybook が `VitePress` を検出すると、翻訳されたドキュメントを次の場所に書き込みます:

```text
docs/<locale>/
```

これは VitePress プロジェクトで一般的に使われるローカライズされたドキュメントのレイアウトに従います。

### Sibling

サポートされているドキュメントフレームワークが検出されない場合、DocPlaybook は `sibling` にフォールバックし、翻訳ファイルがソースファイルの横に配置されます:

```text
guide.md
guide.en.md
guide.ja.md
```

## コアコマンド

これらは初期化後に使用するコマンドです。

### `docplaybook`

これは日常的に使うデフォルトのコマンドです。

```bash
pnpm exec docplaybook .
```

各サブステップを手動で選択せずに通常のプロジェクトワークフローを実行したい場合に使用します。

### `docplaybook bootstrap`

リポジトリで既に管理されている既存の翻訳ドキュメントから、最初のメモリファイルを生成します。

```bash
pnpm exec docplaybook bootstrap . --langs en,ja
```

`init` の後、ドキュメントサイトに既に翻訳ファイルがある場合に使用します。

### `docplaybook translate`

ソースドキュメントをターゲット言語に翻訳します。

```bash
pnpm exec docplaybook translate .
```

ソースドキュメントから翻訳出力のみを更新したい場合に使用します。

ターゲット言語を1つまたは2つだけ処理するには:

```bash
pnpm exec docplaybook translate . --langs ja
pnpm exec docplaybook translate . --langs en,ja
```

### `docplaybook learn`

人間のレビューによる編集をメモリファイルに吸収します。

```bash
pnpm exec docplaybook learn .
```

レビュー担当者が翻訳ドキュメントを更新し、その修正を後でDocPlaybookに再利用させたい場合に使用します。

`learn` は Git 優先です: `HEAD` にある翻訳ファイルと現在のワーキングツリーのバージョンを比較し、どの編集を再利用可能なガイダンスにするかを LLM に尋ねます。

学習を選択したターゲット言語に限定することもできます:

```bash
pnpm exec docplaybook learn . --langs ja
```

### `docplaybook lint`

翻訳をソースドキュメントおよびメモリと照合してレビューします。

```bash
pnpm exec docplaybook lint .
```

これは用語、トーン、完全性、Markdown の整合性、流暢さ、および全体的な品質に関するリンティング形式の所見とスコアを返します。

安全な修正を自動適用するには:

```bash
pnpm exec docplaybook lint . --fix
```

変更されたファイルだけでなくすべての翻訳ファイルをリンティングするには:

```bash
pnpm exec docplaybook lint . --scope all
```

スコープと言語フィルタを組み合わせることもできます:

```bash
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

## 次に行うこと

次は [プロジェクトワークフロー](/guide/workflow) を続けてください。
