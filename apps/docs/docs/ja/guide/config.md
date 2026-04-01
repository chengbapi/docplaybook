# 設定

プロジェクトの設定は次の場所にあります:

```text
<workspace>/.docplaybook/config.json
```

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

生成して翻訳を保持する対象言語のリスト。

### `ignorePatterns`

スキャン時に無視する追加のグロブパターン。

### `concurrency.maxConcurrentRequests`

記事レベルの並列性。何件のターゲット記事を同時に翻訳できるかを制御します。

デフォルトは `6` です。現在の実装では、設定やオーバーライド用の環境変数でより大きな値を設定しても、実行時の有効な上限は `20` に制限されます。

簡単な実験のために、一時的に設定値を次の方法で上書きできます:

```bash
DOCPLAYBOOK_MAX_CONCURRENT_REQUESTS=12 pnpm exec docplaybook translate .
```

### `layout.kind`

サポートされる値:

- `sibling`
- `docusaurus`
- `rspress`
- `vitepress`

`init` はプロジェクト構造からレイアウトを検出しようとします。サポートされるフレームワークを検出できない場合は、`sibling` にフォールバックします。

### `model`

翻訳とメモリ更新に使用されるモデルプロバイダとモデルID。

DocPlaybook は特定のLLMベンダーを想定しません。チームは品質、コスト、ポリシーの要件に合ったプロバイダを選択できます。

実際には、多くのチームが一貫性を保つために `config.json` に `model` を保持します:

- ローカル開発が同じプロバイダとモデルを使用する
- CIが同じプロバイダとモデルを使用する
- 翻訳のトーンと用語が実行間でより安定して維持される

チームがユーザーごとの自由を優先する場合、モデル設定は `init` の際にローカルに保持することもできます。

## ローカルとCIのモデル設定

ローカルとCIを混在させる場合に適したパターンが2つあります。

### 推奨: 共有モデル、異なるシークレット

プロバイダとモデルを `config.json` に保持します。

その場合:

- ローカル開発者はシークレットを `.docplaybook/.env.local` に置く
- CI は環境変数を通じてシークレットを注入する

これにより、翻訳とリンティングの動作が環境間で安定します。

### 柔軟: ローカルとCIで異なるモデル

ローカル開発とCIで異なるプロバイダやモデルIDが必要な場合、`config.json` に `model` を含めないでください。
