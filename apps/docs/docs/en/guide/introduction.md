import PackageManagerTabs from '../../../theme/components/PackageManagerTabs';

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

## Where to go next

- [Quick Start](/guide/quick-start) for installation, initialization, layout detection, and bootstrap
- [Commands](/guide/commands) for the CLI surface after `init`
- [Translate](/guide/translate) for source-driven sync behavior
- [Runtime Model](/guide/advanced) for runtime behavior and safety tradeoffs
