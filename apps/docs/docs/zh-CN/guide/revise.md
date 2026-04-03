# 修订

`learn` 将审阅者的编辑转换为可重用的指导。

## 它的作用

对于每个目标文档，`DocPlaybook` 会：

1. 检查当前目标哈希是否已被 `learn` 学习
2. 如果该确切版本已处理则跳过该目标
3. 读取当前的源文档和目标文档
4. 询问模型哪些观察结果应成为可重用的指导
5. 更新：
   - `.docplaybook/playbook.md`
   - `.docplaybook/memories/<lang>.md`

这意味着 `learn` 基于当前的源/目标对，而不是基于 `Git` 的前后差异。

## 何时运行

在审阅者对已翻译文档做出重要修改后，您应运行 `learn`。

典型情况：

- 术语更正应成为全项目的指导
- 目标语言的风格决策应在以后重用
- 审阅者澄清了某个产品术语在某个语言／地区中的用法

## 典型用法

对所有已配置的目标语言运行：

```bash
pnpm exec docplaybook learn .
```

仅针对单个语种／地区运行：

```bash
pnpm exec docplaybook learn . --langs ja
```

强制重新学习：

```bash
pnpm exec docplaybook learn . --force
```

或使用显式别名：

```bash
pnpm exec docplaybook relearn .
```

## 指导划分

请明确区分：

- `playbook.md` 存储共享的项目知识
- `memories/<lang>.md` 存储目标语言的指导
- `.docplaybook/state/*.json` 仅存储分支进度
