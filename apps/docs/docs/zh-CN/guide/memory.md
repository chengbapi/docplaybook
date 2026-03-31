# 记忆

DocPlaybook 将翻译指南保存在 Markdown 中，以便代理可以重用且仍可由人类编辑。

## 文件

DocPlaybook 维护两级记忆：

- `.docplaybook/playbook.md`
- `.docplaybook/memories/<target>.md`

第一项为全局记忆。第二项针对每个目标语言的特定记忆。

## 全局 playbook

`.docplaybook/playbook.md` 用于语言无关的指导。

它包含：

- `## Voice`
- `## Protected Terms`
- `## Translation Rules`

典型示例：

- 文档应保持技术性和直接
- 产品名称和 CLI 命令不应翻译
- 警告不应被弱化
- Markdown 结构应保持稳定

## 语言记忆

每个 `.docplaybook/memories/<target>.md` 文件用于语言特定的指导。

它包含：

- `## Terminology`
- `## Style Notes`

典型示例：

- 首选术语翻译用于重复出现的技术术语
- 是否应保留某些英文词不翻译
- 该目标语言的语气或形式选择
- 针对该目标语言的标点或措辞偏好

## 记忆的使用方式

在翻译和 linting 过程中，DocPlaybook 会组合：

1. 全局 playbook
2. 目标语言记忆

该组合上下文成为当前运行的可复用翻译标准。

## 记忆如何更新

`docplaybook learn` 是记忆演进的主要方式。

当人工编辑已翻译的文档时，学习流程如下：

1. 将 Git `HEAD` 中已编辑的目标文件与当前工作树版本进行比较
2. 在块形状仍然对齐时提取已更改的可翻译块
3. 询问 LLM 哪些编辑是可复用的修正，哪些应被忽略
4. 用语言无关的经验更新 `playbook.md`
5. 用语言特定的术语和样式备注更新 `memories/<target>.md`

这使审查工作随时间累积。

## bootstrap 如何初始化记忆

对于已经有翻译页面的现有文档站点，`docplaybook bootstrap --langs ...` 会从仓库中已对齐的源/目标示例创建首批记忆文件。

当项目已包含已翻译的文档时，这通常是 `init` 之后推荐的第一步。

## 为什么结构保持最小化

第一版有意将记忆保持精简：

- 全局规则放到 `playbook.md`
- 语言特定规则放到 `memories/<target>.md`

这使代理更容易：

- 读取这些文件
- 安全地更新它们
- 保持它们简洁
- 避免在过多部分中重复规则

## 相关页面

- [代理](/guide/agents)
- [高级](/guide/advanced)
- [配置](/guide/config)
- [快速开始](/guide/quick-start)
