# 設定

プロジェクトの設定は次の場所にあります：

```text
<workspace>/.docplaybook/config.json
```

ファイルは JSONC として読み込まれるため、コメントが使用できます。

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

ワークスペースのソース言語です。

### `targetLanguages`

生成して翻訳を保持する対象言語のリスト。

### `ignorePatterns`

スキャン中に無視する追加のグロブパターン。

### `concurrency.maxConcurrentRequests`

記事単位の同時実行数。 同時に翻訳されるターゲット記事の数を制御します。

### `layout.kind`

サポートされている値：

- `sibling`
- `docusaurus`
- `rspress`
- `vitepress`

`init` はプロジェクト構成からレイアウトを検出しようとします。サポート対象のフレームワークが検出できない場合は `sibling` にフォールバックします。

### `model`

翻訳とメモリ更新に使用されるモデルプロバイダとモデルID。

DocPlaybook は特定の LLM ベンダーを想定していません。チームは品質、コスト、ポリシー要件に合ったプロバイダを選択できます。

実務上、多くのチームは一貫性のために `config.json` に `model` を保持します：

- ローカル開発では同じプロバイダとモデルを使用する
- CI でも同じプロバイダとモデルを使用する
- 翻訳のトーンと用語が実行間でより安定する

もしチームがユーザーごとの自由を好む場合、`init` 時にモデル設定をローカルに保持することもできます。

## ローカルとCIのモデル設定

ローカルと CI を併用する場合の良いパターンが2つあります。

### 推奨：モデルは共有、シークレットは別

`config.json` にプロバイダとモデルを保持します。

その場合：

- ローカル開発者はシークレットを `.docplaybook/.env.local` に置く
- CI は環境変数経由でシークレットを注入する

これにより翻訳とリンターの動作が環境間で安定します。

### 柔軟：ローカルとCIで異なるモデル

ローカル開発と CI で異なるプロバイダやモデルIDが必要な場合は、`model` を `config.json` から外しておきます。

その場合：

- ローカルは `.docplaybook/.env.local` に `DOCPLAYBOOK_MODEL_*` を設定する
- CI はパイプラインで同じ `DOCPLAYBOOK_MODEL_*` 変数を設定する

これはサポートされていますが、通常はローカル実行と CI 間で翻訳結果の一貫性が低くなります。
