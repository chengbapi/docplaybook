# はじめに

## DocPlaybook が行うこと

`DocPlaybook` は、ドキュメントチームがローカルの非公開なランタイム状態ではなく、Git ファーストなワークフローで多言語の Markdown ドキュメントを維持するのを支援します。

- 任意の LLM プロバイダとモデルを選択できます。
- Git 管理されたソース差分を使って、再生成が必要な翻訳ブロックだけを更新します。
- レビューから学習し、用語、トーン、スタイルの判断を再利用します。
- あいまいなモデル出力ではなく、具体的なリント風の指摘で翻訳をレビューします。

## 最もサポートされている統合

既にドキュメントサイトがある場合は、[Quick Start](/guide/quick-start) から始めてください。

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

- `Docusaurus` は公式ドキュメントの i18n 構成に従います: `i18n/<locale>/docusaurus-plugin-content-docs/current/...`
- `Rspress` 2.x では `docs/` 配下に言語ディレクトリを置きます。既定言語は `docs/en/...`、他の言語は `docs/<locale>/...` です
- `VitePress` はローカライズされたドキュメントの一般的なレイアウトに従います: `docs/<locale>/...`
- それらのいずれにも該当しない場合、`DocPlaybook` は一般的な Markdown プロジェクト向けに `sibling` モードにフォールバックします。

## 一般的なワークフロー

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

次に通常のワークフローを実行します:

```bash
pnpm exec docplaybook bootstrap . --langs en,ja
pnpm exec docplaybook .
pnpm exec docplaybook lint .
```

## 次に進むべき内容

- [Quick Start](/guide/quick-start): インストール、初期化、プロバイダ設定、レイアウト規約について
- [Quick Start](/guide/quick-start): インストール、初期化、ブートストラップ、およびコマンドについて
- [Project Workflow](/guide/workflow): スクリプト、フック、CI パターンについて
- [Advanced](/guide/advanced): Git ベースの翻訳挙動と安全性に関するトレードオフについて
- [CI](/guide/ci): 共有プロバイダと共有の翻訳予算を使いたい場合
