# 记忆

DocPlaybook 将翻译指南保存在 Markdown 中，以便代理可以重复使用并且人类仍可编辑。

## 文件

DocPlaybook 维护两个级别的记忆：

- `.docplaybook/playbook.md`
- `.docplaybook/memories/<target>.md`

第一个为全局，第二个针对每个目标语言。

DocPlaybook 还保留 `.docplaybook/state/*.json`，但这些文件不是记忆。它们仅记录当前分支的处理进度。

## 全局 Playbook

`.docplaybook/playbook.md` 用于与语言无关的指南。

它包含：

- `## Voice`
- `## Protected Terms`
- `## Translation Rules`

典型示例：

- 文档应保持技术性和简洁明了
- 产品名称和 CLI 命令不应翻译
- 警告不应被弱化
- Markdown 结构应保持稳定

## 语言记忆

每个 `.docplaybook/memories/<target>.md` 文件用于语言特定的指南。

它包含：

- `## Terminology`
- `## Style Notes`

典型示例：

- 常见技术术语的首选翻译
- 是否应保留某些英文单词不翻译
- 目标语言的语气或正式程度选择
- 该目标语言的标点或措辞偏好

## 如何使用记忆

在翻译和 linting 期间，DocPlaybook 会合并：

1. 全局 playbook
2. 目标语言记忆

该组合上下文将成为当前运行的可重用翻译标准。

## 记忆如何更新

`docplaybook learn` 是记忆演进的主要方式。

当人工编辑已翻译的文档时，学习流程：

1. 检查当前目标文件的哈希是否已被学习过
2. 读取当前源文档和当前目标文档
3. 询问 LLM 哪些观察结果可作为可重用的指导，哪些应被忽略
4. 将语言无关的经验更新到 `playbook.md`
5. 将语言特定的术语和样式说明更新到 `memories/<target>.md`

这样一来，审查工作的效果会随着时间累积并产生复合效应。

## 记忆 与 状态

请明确区分：

- `playbook.md` 和 `memories/<target>.md` 是项目知识
- `.docplaybook/state/*.json` 是分支进度

状态文件可以被提交，以便切换分支时能恢复进度，但其内容是操作哈希，而不是人工编写的指导。

## bootstrap 如何初始化内存

对于已经包含已翻译页面的现有文档站点，`docplaybook bootstrap --langs ...` 会根据仓库中已有的源/目标对齐示例创建首批 memory 文件。

当项目已包含已翻译的文档时，这是在运行 `init` 之后推荐的第一步。

## 为什么采用最小化结构

第一个版本有意将 memory 保持精简：

- 全局规则放到 `playbook.md`
- 语言特定的规则放到 `memories/<target>.md`

这让代理更容易：

- 读取这些文件
- 安全地更新它们
- 保持简洁
- 避免在过多章节中重复规则

## 相关页面

- [代理](/guide/agents)
- [运行时模型](/guide/advanced)
- [配置](/guide/config)
- [快速开始](/guide/quick-start)
