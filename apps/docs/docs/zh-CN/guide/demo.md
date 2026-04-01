# 演示

此页面包含详细的操作演练。

主页应快速说明产品。此页面展示了 docs 仓库中真实的 DocPlaybook 循环是如何运行的，包含具体的文件更改、命令与预期输出。

## 演示仓库结构

```text
docs/
  en/
    guide/
      introduction.md
  ja/
    guide/
      introduction.md
.docplaybook/
  playbook.md
  memories/
    ja.md
```

在此示例中：

- 英语为源语言
- 日语为目标语言
- 团队已有术语记忆库

## 案例 1：仅翻译已更改的区块

作者在 `docs/en/guide/introduction.md` 中更新了一句英文。

修改前：

```md
Use the knowledge base to manage docs.
```

修改后：

```md
Use the knowledge base to manage team docs in one place.
```

项目记忆已包含：

```md
- Translate "knowledge base" as "Wiki".
```

运行：

```bash
docplaybook translate docs/en/guide/introduction.md --to ja
```

DocPlaybook 发送给模型的内容：

- 来自 Git 的源差异 (diff)
- 当前的日语目标文件
- `.docplaybook/playbook.md`
- `.docplaybook/memories/ja.md`

预期结果：

```md
Wiki を使ってチームのドキュメントを一元管理します。
```

关键点：

- 未更改的日文区块保持不变
- 术语遵循记忆库
- 仅重新生成已更改的源区块

## 案例 2：从审阅者的更正中学习

审阅者手动编辑日文翻译。

审阅前：

```md
ワークスペースを設定します。
```

审阅后：

```md
workspace を設定します。
```

团队希望在技术文档中保持 `workspace` 不翻译。

运行：

```bash
docplaybook learn docs/ja/guide/introduction.md --from en
```

预期效果：

- DocPlaybook 会检查该更正是否可复用
- 如果可以，它会建议进行结构化的记忆库更新

典型的记忆库补丁：

```md
- Keep "workspace" in English in Japanese docs.
- Prefer concise technical Japanese over explanatory paraphrase.
```

这是审阅工作转化为未来一致性的时刻。

## 案例 3：在合并前对已翻译页面进行 lint 检查

现在页面已翻译，但我们希望进行一次质量检查。

当前的日文文件包含：

```md
DocPlaybook は AI gateway mode をサポートします。
この機能はとても簡単に使えます。
```

项目规则已规定：

- 优先使用 `gateway`，不要使用 `AI gateway`
- 保持语气中性且技术性

运行：

```bash
docplaybook lint docs/ja/guide/introduction.md --from en
```

预期结果：

```text
warn  Terminology mismatch: use "gateway" instead of "AI gateway".
info  Tone drift: avoid promotional wording like "very easy".
```

这在提交前或在 CI 中非常有用，因为它能在不重写整个页面的情况下发现问题。

## 完整流程

一个实际的团队流程如下：

1. 编辑英文源文档。
2. 对需要更新的目标语言运行 `translate`。
3. 审核翻译文件。
4. 在重要的审阅者更正上运行 `learn`。
5. 在推送前或在 CI 中运行 `lint`。

## 为什么这种划分有效

每个命令各司其职：

- `translate` 使目标文档与源更改保持一致
- `learn` 捕获可复用的审阅者知识
- `lint` 检查当前翻译是否仍符合项目规则

正是这种划分使 DocPlaybook 在实践中易于理解，而不仅仅停留在理论上。
