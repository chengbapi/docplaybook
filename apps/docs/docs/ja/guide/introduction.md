import PackageManagerTabs from '../../../theme/components/PackageManagerTabs';

# はじめに

## DocPlaybookが行うこと

`DocPlaybook` は、不透明な Git スタイルの前後ベースラインの代わりに、状態駆動のワークフローで多言語 Markdown ドキュメントを管理するために、ドキュメントチームを支援します。

- 独自の LLM プロバイダとモデルを選択できます。
- `source-hash` トラッキングを使用して、変更のないドキュメントをスキップし、古くなったまたは欠落している翻訳を更新します。
- レビューから学習し、用語、トーン、スタイルの決定を再利用します。
- 漠然としたモデル出力ではなく、具体的なヘルスチェックの所見に基づいて翻訳をレビューします。

## サポートが最も充実している統合

既にドキュメントサイトをお持ちの場合は、[Quick Start](/guide/quick-start) から始めてください。

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

- `Docusaurus` は公式のドキュメント i18n 構成に従います: `i18n/<locale>/docusaurus-plugin-content-docs/current/...`
- `Rspress` 2.x は `docs/` 配下に言語ディレクトリを使用します: デフォルト言語は `docs/en/...` にあり、他のロケールは `docs/<locale>/...` に配置されます
- `VitePress` は一般的なローカライズされたドキュメント構成で `docs/<locale>/...` を使用します
- どれにも該当しない場合、`DocPlaybook` は汎用の Markdown プロジェクト向けに `sibling` モードにフォールバックします。

## 次に進むべき項目

- [Quick Start](/guide/quick-start) — インストール、初期化、レイアウト検出、ブートストラップ
- [Commands](/guide/commands) — `init` 実行後の CLI 操作
- [Translate](/guide/translate) — ソース駆動の同期動作について
- [Runtime Model](/guide/advanced) — ランタイムの振る舞いと安全性のトレードオフについて
