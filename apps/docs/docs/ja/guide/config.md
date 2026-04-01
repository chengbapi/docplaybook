# 設定

Project config lives in:

```text
<workspace>/.docplaybook/config.json
```

同じ `.docplaybook/` ディレクトリには次のファイルも含まれます:

- `playbook.md`
- `memories/<lang>.md`
- `state/source-hashes.json`
- `state/learned-target-hashes.json`

`state/*.json` ファイルは進行状況を追跡するファイルです。ブランチを切り替えたときに処理の進行状況が復元されるよう、これらはコミットすることを意図しています。

このファイルは JSONC として読み込まれるため、コメントを記述できます。

## 例

```json
{
  "version": 1,
  "sourceLanguage": "zh-CN",
  "targetLanguages": ["en", "ja"],
  "ignorePatterns": ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.docplaybook/**"],
  "concurrency": {
    "maxConcurrentRequests": 6
  },
  "layout": {
    "kind": "sibling"
  },
  "model": {
    "kind": "gateway",
    "model": "openai/gpt-5-mini",
    "apiKeyEnv": "AI_GATEWAY_API_KEY"
  }
}
```

## 重要なフィールド

### `sourceLanguage`

ワークスペースのソース言語。

### `targetLanguages`

生成し、翻訳を維持するターゲット言語のリスト。

### `ignorePatterns`

スキャン時に無視する追加のグロブパターン。

### `concurrency.maxConcurrentRequests`

記事レベルの同時実行数。これは同時に翻訳できるターゲット記事の数を制御します。

デフォルトは `6` です。現在の実装では、config やオーバーライド用の環境変数でより高い値を設定しても、有効な実行時間の上限は `20` に制限されます。

簡単な実験では、次の方法で一時的に config の値を上書きできます:

```bash
DOCPLAYBOOK_MAX_CONCURRENT_REQUESTS=12 pnpm exec docplaybook translate .
```

### `layout.kind`

サポートされている値:

- `sibling`
- `docusaurus`
- `rspress`
- `vitepress`

`init` はプロジェクト構成からレイアウトを検出しようとします。サポートされているフレームワークが検出できない場合は、`sibling` にフォールバックします。

### `model`

翻訳とメモリ更新に使用されるモデルプロバイダとモデルID。

DocPlaybook は特定の LLM ベンダーを前提としません。チームは品質、コスト、ポリシーの要件に合ったプロバイダを選択できます。

実務では、多くのチームが一貫性のために `model` を `config.json` に保持します:

- ローカル開発では同じプロバイダとモデルを使用する
- CI でも同じプロバイダとモデルを使用する
- 翻訳のトーンや用語が実行ごとにより安定する

代わりにユーザーごとの自由度を重視する場合は、`init` 時にモデル設定をローカルに保持することもできます。

## ローカルと CI のモデル設定

ローカルと CI を混在させる場合には、良いパターンが2つあります。

### 推奨: 共有モデル、異なるシークレット

プロバイダとモデルを `config.json` に保持します。

次に:

- ローカルの開発者はシークレットを `.docplaybook/.env.local` に配置します
- CI は環境変数経由でシークレットを注入します

これにより、翻訳とリンタの動作が環境間で安定します。

### 柔軟性: ローカルとCIで異なるモデル

ローカルの開発環境とCIで異なるプロバイダやモデルIDが必要な場合、`config.json` から `model` を外しておいてください。

次に:

- ローカルでは `.docplaybook/.env.local` に `DOCPLAYBOOK_MODEL_*` を設定します
- CI はパイプライン内で同じ `DOCPLAYBOOK_MODEL_*` 変数を設定します

これはサポートされていますが、通常はローカル実行とCI間で翻訳出力の一貫性が低下します。
