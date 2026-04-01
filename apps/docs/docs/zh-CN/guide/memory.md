# 记忆

DocPlaybook 将翻译指南以 Markdown 格式保存，以便代理重用且仍可被人工编辑。

## 文件

DocPlaybook 维护两级记忆：

- `.docplaybook/playbook.md`
- `.docplaybook/memories/<target>.md`

第一个是全局的，第二个针对每个目标语言。

## 全局 Playbook

`.docplaybook/playbook.md` 用于与语言无关的指导。

它包含：

- `## Voice`
- `## Protected Terms`
- `## Translation Rules`

典型示例：

- 文档应保持技术性和直接性
- 产品名称和 CLI 命令不应被翻译
- 警告不应被弱化
- 应保持 Markdown 结构不变

## 语言记忆

每个 `.docplaybook/memories/<target>.md` 文件用于特定语言的指导。

它包含：

- `## Terminology`
- `## Style Notes`

典型示例：

- 常见技术术语的首选翻译
- 是否某些英文词应保留原文不译
- 目标语言的语气或正式度偏好
- 该目标语言的标点或措辞偏好

## 记忆的使用方式

在翻译和 linting 过程中，DocPlaybook 会合并：

1. 全局 playbook
2. 目标语言记忆

该合并上下文将成为当前运行的可复用翻译标准。

## 记忆的更新方式

`docplaybook learn` 是记忆演进的主要方式。

当人工编辑译文时，学习流程：

1. 检查当前目标文件的哈希是否已被学习过
2. 读取当前源文档和当前目标文档
3. 询问 LLM 哪些观察结果可作为可重用的指导，哪些应被忽略
4. 使用与语言无关的经验更新 `playbook.md`
5. 将与语言相关的术语和风格说明更新到 `memories/<target>.md`

这样审查工作可以随着时间产生累积效应。

## bootstrap 如何初始化记忆

对于已经包含已翻译页面的现有文档站点，`docplaybook bootstrap --langs ...` 会从仓库中已对齐的源/目标示例创建首批记忆文件。

当项目已包含已翻译文档时，这是在 `init` 之后推荐的第一步。

## 为什么结构保持精简

第一版有意将记忆保持精简：

- 全局规则放在 `playbook.md`
- 语言特定规则放在 `memories/<target>.md`

这使代理更容易：

- 阅读这些文件
- 安全地更新它们
- 保持它们简洁
- 避免在过多部分中重复规则

## 相关页面

- [Agents](/guide/agents)
- [Advanced](/guide/advanced)
- [Config](/guide/config)
- [Quick Start](/guide/quick-start)
