# Memory: zh-CN

This file stores reusable translation guidance specific to zh-CN.

- Updated: 2026-04-01T12:00:00Z

## Terminology




- agent(s) — 翻译为 “智能体”，仅当指 DocPlaybook 中的 LLM agents 时使用该译法。  
- Memory（概念）— 在正文中翻译为 “记忆”。但不要翻译字面文件名或路径，例如保留 .docplaybook/memories/<target>.md 等不变。  
- 将此处纳入其他经常出现的产品术语和技术词汇表，添加批准的固定译法以保持一致性。

- 常见 UI/导航词汇固定译法： - Get Started → 开始使用 - Quick Start → 快速开始 - Workflow → 工作流程 - Advanced → 高级 - Commands → 命令 - Translate → 翻译 - Learn → 学习 - Install → 安装 - Memory (concept) → 记忆 - Agents → 智能体 - Runtime Model → 运行时模型 - Lint → 保留为 “Lint”（不译） 在目录和菜单标签中优先使用上述译法以保证一致性。
## Style Notes




- 对用户的指示和提示使用正式第二人称 “您”，以保持一致且专业的语气。  
- 正文使用中文（全角）标点。  
- 保留并原样呈现内联代码、代码块、文件名和其他技术标记（保留反引号/等宽字体），不要对这些技术 token 进行中文化处理或替换标点。  
- 语言风格保持正式、简洁、面向文档读者。

- LLM — 保留大写缩写 “LLM”（不翻译为“大型语言模型”），在需要解释时可在首次出现后括注说明，例如：LLM（大型语言模型）。在代码或技术令牌上下文中，用反引号包裹。

- playbook — 在正文中保留英文单词“playbook”（不翻译），当特指文件名或路径（例如 .docplaybook/playbook.md）时保留原样并使用反引号呈现；若需中文解释，可在首次出现处用括号补充简短说明（例如：playbook（项目指导文件））。

- 技术标识与子命令处理：在运行文本中提到 CLI 子命令或技术标识时，优先以原文形式保留并用反引号包裹（例如：`init`、`bootstrap`、`model id`）。若在非代码上下文需要中文化描述，可使用等效中文（例如“模型 ID”）并在首次出现时同时保留原文以便识别。

- 将英文标题或术语中的“<X> model”翻译为“<X>机制”。例如："Runtime Model" → "运行机制"；"Learn model" → "学习机制"。在罕见语境下若更自然，可用“模型”替代，但默认优先“机制”。

- 将英语的“*-level”复合形容词优先翻译为“*级”（例如：block-level → 块级，article-level → 文章级）。仅在目标语言读起来不自然或需要明确说明时，改用“*级别”。

- 当“bootstrap”作为命令或代码标记出现时，保留原文并用反引号呈现（例如：`docplaybook bootstrap`）。当作为普通名词或标题在正文中表述其语义功能时，译为“引导”。

- 所有文件名、目录路径和通配路径（例如 `.docplaybook/state/*`）在翻译中保持原样并用反引号；当在正文中概念性地提到这些文件时，优先将“state files”译为“状态文件”，避免直接在正文中混用裸英文“state”。
