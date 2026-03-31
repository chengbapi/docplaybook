# 流程演示

本页以具体且以 Git 为先的方式展示 DocPlaybook 的三大核心循环。

目的是让每次模型调用都易于理解：

- 输入内容
- 模型应做的事
- 应输出的内容

## 翻译

`translate` 以源文件为驱动。

它将 Git 中的源文档与当前工作树进行比较，保持未改动的目标块不变，仅请求模型重新生成已更改的目标块。

```text
Source A (Git HEAD)
+ Source A (working tree)
+ playbook.md
+ memories/<lang>.md
+ current target B
-> LLM
-> updated target B
```

具体示例：

- 源之前： `使用知识库管理文档。`
- 源之后： `使用知识库统一管理团队文档。`
- 记忆规则： `Translate "知识库" as "Wiki".`
- 预期目标： `Use the Wiki to manage team docs in one place.`

需要验证的内容：

- 仅重新生成已更改的块
- 结果中仍可见记忆和 playbook 规则
- 代码块、链接和行内代码都被保留

## 学习

`learn` 以目标差异为驱动。

它查看翻译文件在审校前后的内容，将该编辑与当前源文件比较，并询问模型该编辑是否应成为可复用的项目指导。

```text
Target B (Git HEAD)
+ Target B (working tree)
+ current source A
+ playbook.md
+ memories/<lang>.md
-> LLM
-> structured updates for playbook.md and memories/<lang>.md
```

具体示例：

- 源块： `使用知识库管理文档。`
- 翻译前： `Use the knowledge base to manage docs.`
- 翻译后： `Use the Wiki to manage docs.`
- 预期记忆更新：添加术语规则，例如 `Translate "知识库" as "Wiki".`

需要验证的内容：

- 经常出现且可复用的修正会成为记忆
- 一次性的页面重写会被忽略
- 结果应是结构化的更新，而非含糊的解释

## 语法检查

`lint` 是一个规则感知的审查步骤。

它读取当前源文档、当前目标文档、playbook、语言记忆和 lint 规则，然后要求模型返回问题清单。

```text
Source A
+ Target B
+ playbook.md
+ memories/<lang>.md
+ lint rules
-> LLM
-> score + issue list + optional safe fixes
```

具体示例：

- 记忆偏好使用 `gateway`
- 当前翻译写成了 `AI gateway`
- 预期发现：术语不一致

需要验证的内容：

- 发现应指向真实的翻译问题
- lint 尊重项目语言规则
- 建议的修复应安全且局部

## 心智模型

在决定运行哪个命令时，请参考下述快速地图：

- `translate`
  - 源已更改，目标应跟上
- `learn`
  - 发生了翻译审校，项目记忆应得到改进
- `lint`
  - 已存在翻译，应检查质量

这就是整个循环：

1. 编辑源文档
2. 运行 `translate`
3. 审校者改进目标文档
4. 运行 `learn`
5. 运行 `lint`
