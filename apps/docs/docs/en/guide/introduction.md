# Introduction

## What DocPlaybook does

`DocPlaybook` helps documentation teams maintain multilingual Markdown docs with a state-driven workflow instead of opaque Git-style before/after baselines.

- Choose your own LLM provider and model.
- Use source-hash tracking to skip unchanged docs and refresh stale or missing translations.
- Learn from review and reuse terminology, tone, and style decisions.
- Review translations with concrete health-check findings instead of vague model output.

## Best supported integrations

If you already have a docs site, start with [Quick Start](/guide/quick-start).

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

- `Docusaurus` follows the official docs i18n structure: `i18n/<locale>/docusaurus-plugin-content-docs/current/...`
- `Rspress` 2.x uses language directories under `docs/`: the default language lives in `docs/en/...`, and other locales live in `docs/<locale>/...`
- `VitePress` follows the common localized docs layout under `docs/<locale>/...`
- If none of those fit, `DocPlaybook` falls back to `sibling` mode for generic Markdown projects.

## Typical workflow

Install in your docs project, then initialize it where your docs already live.

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

Then run the regular workflow:

```bash
pnpm exec docplaybook bootstrap . --langs en,ja
pnpm exec docplaybook .
pnpm exec docplaybook lint .
```

## Where to go next

- [Quick Start](/guide/quick-start) for installation, initialization, bootstrap, and command basics
- [Project Workflow](/guide/workflow) for scripts, hooks, and CI patterns
- [Advanced](/guide/advanced) for state-driven translation behavior and safety tradeoffs
- [CI](/guide/ci) if you want one shared provider and one shared translation budget
