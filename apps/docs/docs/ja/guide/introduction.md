  

# はじめに

## `DocPlaybook` の機能

`DocPlaybook` は、不透明な Git スタイルの前後比較ベースラインの代わりに、状態駆動ワークフローで多言語の `Markdown` ドキュメントを維持するようにドキュメントチームを支援します。

- `LLM` プロバイダとモデルを選択できます。
- `source-hash` トラッキングを使用して、変更のないドキュメントをスキップし、古くなったまたは欠落している翻訳を更新します。
- レビューから学習し、用語、トーン、スタイルの決定を再利用します。
- 曖昧なモデル出力の代わりに、具体的なヘルスチェックの所見で翻訳をレビューします。

## サポートが最も充実している統合

既にドキュメントサイトがある場合は、[クイックスタート](/guide/quick-start)から始めてください。

<div style="display:flex;flex-wrap:wrap;gap:12px;margin:14px 0 28px;">
  <a href="/docplaybook/guide/quick-start" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid #e5e7eb;border-radius:14px;text-decoration:none;color:inherit;">
    <img src="/docplaybook/framework-rspress.svg" alt="Rspress" style="height:22px;width:22px;object-fit:contain;" />
    <span>Rspress</span>
  </a>
  <a href="/docplaybook/guide/quick-start" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid #e5e7eb;border-radius:14px;text-decoration:none;color:inherit;">
    <img src="/docplaybook/framework-docusaurus.svg" alt="Docusaurus" style="height:22px;width:22px;object-fit:contain;" />
    <span>Docusaurus</span>
  </a>
  <a href="/docplaybook/guide/quick-start" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid #e5e7eb;border-radius:14px;text-decoration:none;color:inherit;">
    <img src="/docplaybook/framework-vitepress.svg" alt="VitePress" style="height:22px;width:22px;object-fit:contain;" />
    <span>VitePress</span>
  </a>
</div>

- `Docusaurus` は公式ドキュメントの i18n 構造に従います： `i18n/<locale>/docusaurus-plugin-content-docs/current/...`
- `Rspress` 2.x は `docs/` 配下に言語ディレクトリを使用します：デフォルト言語は `docs/en/...` に置かれ、その他のロケールは `docs/<locale>/...` に置かれます。
- `VitePress` は `docs/<locale>/...` の一般的なローカライズ構成に従います。
- どれも該当しない場合、`DocPlaybook` は汎用 `Markdown` プロジェクト向けに `sibling` モードをフォールバックします。

## 次に進む

- [クイックスタート](/guide/quick-start) — インストール、初期化、レイアウト検出、ブートストラップ
- [コマンド](/guide/commands) — `init`の後の CLI 機能
- [翻訳](/guide/translate) — ソース駆動の同期動作
- [ランタイムモデル](/guide/advanced) — ランタイムの挙動と安全性のトレードオフ
