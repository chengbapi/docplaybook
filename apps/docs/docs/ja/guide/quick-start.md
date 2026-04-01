import PackageManagerTabs from '../../../theme/components/PackageManagerTabs';

# クイックスタート

## プロジェクトへのインストール

既存のドキュメントプロジェクトに DocPlaybook を統合する場合、通常は開発依存（dev dependency）としてインストールするのが最適です。

<PackageManagerTabs variant="help" />

まだプロジェクトに追加したくない場合：

```bash
pnpm dlx docplaybook --help
npx docplaybook --help
yarn dlx docplaybook --help
```

## プロジェクトを初期化する

インストール後、最初の実際の手順は次のとおりです：

```bash
pnpm exec docplaybook init .
```

`DocPlaybook` は初期化がプロジェクト間でほぼ同じになるよう設計されています。ドキュメントが既に `Docusaurus`、`Rspress`、または `VitePress` を使用している場合、DocPlaybook はそれを検出し、内部で対応するパス規約を適用します。

サポートされるドキュメントフレームワークが検出されない場合は、`sibling` にフォールバックします。

`init` 中、DocPlaybook は次のことを行います：

- 可能な場合はワークスペースのレイアウトを検出する
- モデルプロバイダーとモデルを選択する
- 必要な認証情報を収集する
- モデルの接続性をテストする
- ソース言語を検出する
- ターゲット言語を尋ねる
- `.docplaybook/config.json` を作成する
- `.docplaybook/memories/*.md` を作成する
- `.docplaybook/playbook.md` を作成する

翻訳済みのターゲットファイルがすでに存在する場合、`init` は `bootstrap` の実行を提案し、最初のプレイブックと言語メモリを既存のドキュメントから推定できるようにします。

翻訳と学習の実行が始まると、DocPlaybook は `.docplaybook/state/*.json` も管理します。これらのファイルはブランチの進行状況を追跡し、そのブランチとともにコミットされることを想定しています。

## 既存の翻訳済みドキュメントをブートストラップする

リポジトリにすでに整列された翻訳ドキュメントが含まれている場合、`init` の後に `bootstrap` を実行してください：

```bash
pnpm exec docplaybook bootstrap . --langs ja
```

既存の翻訳から初期プロジェクトガイダンスを推定するために `bootstrap` を使用します：

- `.docplaybook/playbook.md`
- `.docplaybook/memories/<lang>.md`

その後、通常のメンテナンスでは `translate`、`learn`、および `lint` を使用します。

## Provider setup

DocPlaybook は AI 駆動で LLM ベースのため、プロバイダーの設定は初期化の一部です。

初期化時に次のことを行います:

- プロバイダーを選択する
- モデル ID を選択する
- 資格情報を提供する
- 接続チェックを実行する

チームに適したプロバイダーを選択できます。DocPlaybook は特定のプロバイダーファミリーを必須としません。

チームのワークフローでは、多くのプロジェクトがプロバイダーとモデルを設定ファイルに固定し、ローカル実行と CI 実行の一貫性を保ちます。

## Layouts and framework conventions

ユーザーフローは同じですが、出力レイアウトは DocPlaybook が検出する内容によって変わります:

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

DocPlaybook が `Docusaurus` を検出すると、翻訳されたドキュメントを以下に書き込みます:

```text
i18n/<locale>/docusaurus-plugin-content-docs/current/
```

これは公式 Docusaurus ドキュメントの i18n 構成に従っています。

### Rspress

DocPlaybook が `Rspress` を検出すると、翻訳されたドキュメントを以下に書き込みます:

```text
docs/<locale>/
```

これは Rspress 向けの DocPlaybook 統合規約として理解してください。

### VitePress

DocPlaybookが`VitePress`を検出すると、翻訳されたドキュメントを次に書き込みます:

```text
docs/<locale>/
```

これはVitePressプロジェクトで使用される一般的なローカライズされたドキュメントのレイアウトに従います。

### Sibling

サポートされているドキュメントフレームワークが検出されない場合、DocPlaybookは`sibling`にフォールバックし、翻訳されたファイルはソースファイルの隣に配置されます:

```text
guide.md
guide.en.md
guide.ja.md
```

## 次に行うこと

続けて[コマンド](/guide/commands)を参照してください。
