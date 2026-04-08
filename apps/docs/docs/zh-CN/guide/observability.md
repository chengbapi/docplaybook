# 可观测性

`DocPlaybook` 可以把可选的翻译 trace 发送到 `Langfuse`，用于长期观察执行过程和翻译质量回归。

这个第一版刻意收敛范围：

- 追踪 `translate`
- 不追踪 `learn`
- 不追踪 `bootstrap`
- 不追踪 `lint`

## 这个项目里 Langfuse 的用途

在这个项目中，`Langfuse` 主要承担翻译运行历史的观测层：

- 哪个 source article 生成了哪个 target article
- 这次运行对应哪个目标语言和 `docKey`
- 单次翻译耗时多久
- 消耗了多少 token
- 底层模型调用走的是 `single`、`batch` 还是 `batch-fallback`
- 是否出现了重试、batch 解析失败等事件

它和本地调试信息的分工不同：

- `--verbose`
  - 看当前 CLI 正在处理什么
- `--debug`
  - 在本地保存 prompt 和原始响应的临时 trace
- `Langfuse`
  - 看跨多次运行的历史、耗时、token、fallback 和重试趋势

## 如何在本地启用

`Langfuse` 默认关闭。只有显式开启后才会发送 trace。

```bash
export DOCPLAYBOOK_LANGFUSE_ENABLED=true
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
export LANGFUSE_HOST=https://cloud.langfuse.com
```

然后正常执行翻译：

```bash
pnpm exec docplaybook translate .
```

可选配置：

```bash
export DOCPLAYBOOK_LANGFUSE_FLUSH_TIMEOUT_MS=8000
```

它控制命令退出前等待 trace flush 的最长时间。

## 会追踪什么

对每一篇被翻译的目标文章，`DocPlaybook` 会记录一个文章级 trace/span，包含：

- `source_path`
- `target_path`
- `doc_key`
- source / target language
- 本次翻译的原因，例如 `startup`
- 是否使用了 `--force`
- 总耗时
- 这篇文章的聚合 token 用量

在文章级 trace 内部，还会记录模型调用级 span，用于表示：

- 单块翻译
- batch 翻译
- batch 解析失败后回退到 single-block 翻译

模型调用级 span 目前会带上这些元数据：

- block 数量
- source 字符数
- prompt 字符数
- memory 字符数
- model label
- token 用量

为了更保守地处理敏感内容，v1 默认不会把完整 prompt 或完整译文上传到 `Langfuse`。

## 如何阅读一条 trace

打开一条翻译 trace 后，建议按下面的顺序看：

1. 先看文章级 span 的 `source_path`、`target_path`、目标语言、总 token 和总耗时。
2. 再看子 span，确认这次翻译走的是 `single`、`batch` 还是 `batch-fallback`。
3. 查看是否有 batch 解析失败或 rate-limit retry 事件。
4. 对比同类文章在不同运行中的 trace，判断 prompt 或 memory 的变化是否改善了成本、耗时或失败率。

如果需要继续看 payload 级细节，再用 `--debug` 重跑同一类文档，检查本地临时 trace。

## 如何用这些数据优化项目

`Langfuse` trace 最有价值的地方，是把它转成明确的工程动作：

- 找出总是很慢或很贵的文章。
  这些通常值得检查 prompt 是否过长、memory 是否过大，或者 batch 切分策略是否合理。
- 找出频繁出现 `batch-fallback` 的运行。
  这通常意味着 JSON 约束不够稳，或者 batch prompt 结构过脆。
- 按目标语言或 doc set 对比 token 成本。
  这样可以发现是否某个语言、某类文档显著更昂贵。
- 把差的翻译结果和 trace 关联起来。
  当人工审阅发现问题时，可以把对应 trace 所在的文章和模式沉淀进 `evals/docplaybook`。
- 关注重试很多的运行。
  如果 rate-limit retry 频繁出现，可能需要降低并发或调整 provider。

## 推荐工作流

1. 开启 `Langfuse` 后运行 `translate`。
2. 在 `Langfuse` 中优先查看高耗时、高 token 或 fallback 多的运行。
3. 对最差样本用 `--debug` 本地重跑。
4. 调整 prompt、memory、batching 或并发配置。
5. 把典型失败样本加入 `evals/docplaybook`。
6. 修改后再次运行，并对比新的 trace。
