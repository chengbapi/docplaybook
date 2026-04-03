# 翻译

`translate` 使目标文档与源文档保持一致。

## 它的作用

对于每个目标文档，DocPlaybook：

1. 解析当前源文档
2. 计算当前源文档的哈希
3. 将该哈希与目标文档的上次保存哈希进行比较
4. 如果哈希未改变且目标文档已存在，则跳过该目标
5. 如果源已更改或目标缺失，则刷新目标文章

这是具有结构感知回写的文章级翻译。它不是基于 Git 差异的翻译。

## 典型用法

同步所有已配置的目标语言：

```bash
pnpm exec docplaybook translate .
```

将运行限制为单个语言环境：

```bash
pnpm exec docplaybook translate . --langs ja
```

强制全量刷新：

```bash
pnpm exec docplaybook translate . --force
```

或使用显式别名：

```bash
pnpm exec docplaybook retranslate .
```

## 保持不变的内容

尽管处理决策在文档级别，翻译仍具备块级感知。

DocPlaybook 会保留：

- `Markdown` 结构
- `code fences`
- `frontmatter` 结构
- 受保护的框架特定字段

对于 `Rspress`，这还包括由 `layout.kind = "rspress"` 涵盖的框架特定资源：

- 位于 `docs/<lang>/...` 下的常规文档
- `_nav.json`
- `_meta.json`
- `i18n.json` 中的 `locale` 条目
- `index.md` 中被白名单允许的首页 `frontmatter` 字段
