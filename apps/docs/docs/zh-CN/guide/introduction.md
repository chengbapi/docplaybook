# 介绍

## DocPlaybook 能做什么

`DocPlaybook` 帮助文档团队以状态驱动的工作流维护多语言 Markdown 文档，而不是使用不透明的 Git 风格的前/后基线。

- 自行选择 LLM 提供商和模型。
- 使用源哈希跟踪以跳过未更改的文档，并刷新过时或缺失的翻译。
- 从审校中学习并重用术语、语气和风格决策。
- 通过具体的健康检查结果审阅翻译，而不是依赖模糊的模型输出。

## 最佳支持的集成

如果你已有文档站点，请从 [快速开始](/guide/quick-start) 开始。

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

- `Docusaurus` 遵循官方文档 i18n 结构：`i18n/<locale>/docusaurus-plugin-content-docs/current/...`
- `Rspress` 2.x 在 `docs/` 下使用语言目录：默认语言位于 `docs/en/...`，其他语言位于 `docs/<locale>/...`
- `VitePress` 遵循常见的本地化文档布局，位于 `docs/<locale>/...`
- 如果上述都不适用，`DocPlaybook` 会对通用 Markdown 项目回退到 `sibling` 模式。

## 典型工作流

在你的文档项目中安装，然后在已有文档所在位置初始化。

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

然后运行常规工作流：

```bash
pnpm exec docplaybook bootstrap . --langs en,ja
pnpm exec docplaybook .
pnpm exec docplaybook lint .
```

## 下一步

- [快速开始](/guide/quick-start) 用于安装、初始化、引导和命令基础
- [项目工作流](/guide/workflow) 用于脚本、钩子和 CI 模式
- [高级](/guide/advanced) 关于状态驱动的翻译行为和安全权衡
- [CI](/guide/ci) 如果你希望使用一个共享提供商和一个共享的翻译预算
