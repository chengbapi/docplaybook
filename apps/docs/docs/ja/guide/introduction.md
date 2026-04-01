# はじめに

## DocPlaybookが行うこと

`DocPlaybook` は、不透明なGit式の前後比較ベースではなく、状態駆動のワークフローを用いてドキュメントチームが多言語のMarkdownドキュメントを維持するのを支援します。

- 使用するLLMプロバイダーとモデルを選択できます。
- source-hashトラッキングを使って、変更のないドキュメントをスキップし、古くなったまたは欠落している翻訳を更新します。
- レビューから学習し、用語、トーン、スタイルの判断を再利用します。
- あいまいなモデル出力の代わりに、具体的なヘルスチェックの所見で翻訳をレビューします。

## 最もよくサポートされている統合

すでにドキュメントサイトをお持ちの場合は、[Quick Start](/guide/quick-start) から始めてください。

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
- `Rspress` 2.x は `docs/` 以下に言語ディレクトリを使用します: デフォルト言語は `docs/en/...` にあり、その他のロケールは `docs/<locale>/...` に置かれます。
- `VitePress` は一般的なローカライズされたドキュメント構成 `docs/<locale>/...` に従います。
- これらのどれにも当てはまらない場合、`DocPlaybook` は汎用のMarkdownプロジェクト向けに `sibling` モードにフォールバックします。

## 典型的なワークフロー

ドキュメントプロジェクトにインストールし、既にドキュメントが存在する場所で初期化してください。

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:16px 0 20px;">
  <div style="padding:14px 16px;border:1px solid #e5e7eb;border-radius:16px;">
    <div style="font-weight:700;margin-bottom:10px;">pnpm</div>
    <pre style="margin:0;white-space:pre-wrap;"><code>pnpm add -D docplaybook
pnpm exec docplaybook init .</code></pre>
  </div>
  <div style="padding:14px 16px;border:1px solid #e5e7eb;border-radius:16px;">
    <div style="font-weight:700;margin-bottom:10px;">npm</div>
    <pre style="margin:0;white-space:pre-wrap;"><code>npm install --save-dev docplaybook
npx docplaybook init .</code></pre>
  </div>
  <div style="padding:14px 16px;border:1px solid #e5e7eb;border-radius:16px;">
    <div style="font-weight:700;margin-bottom:10px;">yarn</div>
    <pre style="margin:0;white-space:pre-wrap;"><code>yarn add -D docplaybook
yarn exec docplaybook init .</code></pre>
  </div>
</div>

その後、通常のワークフローを実行します：

```bash
pnpm exec docplaybook bootstrap . --langs en,ja
pnpm exec docplaybook .
pnpm exec docplaybook lint .
```

## 次のステップ

- インストール、初期化、ブートストラップ、コマンドの基本については [Quick Start](/guide/quick-start) を参照してください
- スクリプト、フック、CIパターンについては [Project Workflow](/guide/workflow) を参照してください
- 状態駆動の翻訳挙動と安全性のトレードオフについては [Advanced](/guide/advanced) を参照してください
- 共有のプロバイダーと共通の翻訳予算を利用したい場合は [CI](/guide/ci) を参照してください
