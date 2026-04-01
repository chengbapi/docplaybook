  

# 介绍

## `DocPlaybook` 的功能

`DocPlaybook` 帮助文档团队使用基于状态的工作流维护多语言 Markdown 文档，而不是使用不透明的 Git 样式前后基线。

- 选择您自己的 `LLM` 提供商和模型。
- 使用 `source-hash` 跟踪以跳过未更改的文档，并刷新过时或缺失的翻译。
- 从审校中学习并重用术语、语气和风格决策。
- 使用具体的 `health-check` 发现来审查翻译，而不是模糊的模型输出。

## 最佳支持的集成

如果您已经有文档站点，请从 [Quick Start](/guide/quick-start) 开始。

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

- `Docusaurus` 遵循官方文档的 i18n 结构：`i18n/<locale>/docusaurus-plugin-content-docs/current/...`
- `Rspress` 2.x 在 `docs/` 下使用语言目录：默认语言位于 `docs/en/...`，其他语言位于 `docs/<locale>/...`
- `VitePress` 遵循常见的本地化文档布局：`docs/<locale>/...`
- 如果上述都不适用，`DocPlaybook` 将对通用 Markdown 项目回退到 `sibling` 模式。

## 下一步

- [Quick Start](/guide/quick-start) 用于安装、初始化、布局检测和引导
- [Commands](/guide/commands) 用于 `init` 之后的 CLI 命令集
- [Translate](/guide/translate) 关于源驱动的同步行为
- [Runtime Model](/guide/advanced) 关于运行时行为和安全权衡
