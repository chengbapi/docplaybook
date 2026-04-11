# DocPlaybook 产品设计

> 本文档定义 DocPlaybook 的产品形态、核心命令和设计原则。所有后续工程改造以此为参照。

## 1. 产品定位

> **DocPlaybook 是一个让团队的翻译知识可以沉淀和复用的 Markdown 翻译同步工具。**

差异化的支点是两个动词:

- **`translate`** —— 把源同步到译
- **`learn`** —— 把人的修改沉淀成下一次的规则

其他一切命令、配置、状态都围绕这两个动词服务。

---

## 2. 设计原则

这五条原则在产品迭代中具有否决权。任何新功能提案都要先过这五条。

### 2.1 少即是多
每砍掉一个命令,就少教用户一个概念。命令数量是产品复杂度的硬指标。

### 2.2 Flag 是模式,不是触发条件
`--dry` / `--interactive` 是"怎么做"(模式),不要让 flag 承载"什么时候做"(触发条件)的语义。触发条件应该由用户的显式动作决定。

### 2.3 配置优先于命令
能用编辑文件解决的,不要做命令。Glossary、Memory、Playbook 都是配置文件,用户在编辑器里维护,**不需要** `glossary add` 这类命令。

### 2.4 信任用户 + 提供工具
把责任边界讲清楚,不要做技术兜底来"保护"用户。用户跑 `learn` 就是在声明"我审核过了",工具不去猜也不去拦。

### 2.5 可见 > 自动
宁愿 `--dry` + 手动按回车,也不要 watch / 隐式失效这种"魔法自动化"。用户对工具的信任来自可预期性。

---

## 3. 命令表

```
docplaybook init [workspace]              一次性设置
docplaybook bootstrap [workspace]         一次性冷启动学习
docplaybook translate [path]              核心:同步源到译
    --dry                                 零成本预览
    --interactive                         每批确认
    --force                               忽略 hash,强制重翻
    --langs zh,ja                         语言筛选
docplaybook learn [path]                  核心:沉淀人改为规则
    --interactive                         每条规则确认(默认开启)
    --force                               忽略 learned hash,重新审视所有译文
    --langs zh,ja                         语言筛选
docplaybook status                        只读:可见性
```

**已废弃**:`lint`、`retranslate`、`relearn`。

- `lint` 的能力(规则回归检查)不再单独提供。需要重翻就用 `translate --force <path>`。
- `retranslate` / `relearn` 合并为对应命令的 `--force` flag。

---

## 4. 命令详细设计

### 4.1 `translate` —— 核心动词

日常 90% 的使用场景。把源文档的变化同步到所有目标语言。

**参数**:
- `[path]` —— 作用域控制。可选,默认整个 workspace。例:`translate docs/api/`、`translate docs/api/users.md`。
- `--dry` —— **零成本预览**。不调任何 LLM,纯本地计算。
- `--interactive` —— 调 LLM 但每批前询问用户。
- `--force` —— 忽略 source hash,强制重翻指定范围内的所有文件。
- `--langs zh,ja` —— 限定目标语言。

**`--dry` 的工作流程**:
```
1. 扫 doc set                          (现有逻辑)
2. 比对 source hash → 算出 missing/stale
3. 数 block 数、字符数 → 用 tiktoken 估 token
4. 查模型定价表 → 算成本
5. 输出报告,结束
```

**0 次 LLM 调用**。这是 `--dry` 的全部意义:让用户在按下"真的执行"之前,**用零成本看清要发生什么**。

输出示例:
```
docplaybook translate --dry --langs zh

Plan (no LLM calls made):
  docs/guide/intro.md       [stale]    8 blocks  ~1.2k tok
  docs/guide/auth.md        [missing] 12 blocks  ~2.0k tok
  docs/api/users.md         [stale]    3 blocks  ~0.4k tok

Total: 3 files, 23 blocks, ~3.6k input tokens
Estimated cost: $0.04 (gpt-4o-mini)
Run without --dry to execute.
```

**翻译完成后必须输出 summary**:
- 翻译了哪些文件
- 用了多少 token、多少钱、耗时
- **命中了哪些 memory 规则 / glossary 条目**(让 memory 这个核心差异点被看见)
- 哪些块走了 batch fallback(暗示模型不稳定)

### 4.2 `learn` —— 产品的灵魂

日常使用占比 10%,但每次执行都在为团队积累资产。

**职责**:读取人改过的译文,从中提取可复用的规则,分类后写入 glossary 或 memory。

**参数**:
- `[path]` —— 作用域控制
- `--interactive` —— 每条规则让用户 accept / edit / skip(**默认开启**)
- `--force` —— 忽略 learned hash,重新审视所有译文
- `--langs zh,ja` —— 限定目标语言

**输出两类资产**:

| 类型 | 形态 | 判定 |
|---|---|---|
| **Glossary 候选** | 结构化(term → translation) | 修改是机械的、确定的:同源短语 → 同目标短语反复出现 |
| **Memory 候选** | 自然语言规则 | 修改是上下文相关的、风格性的、需要 LLM 理解的 |

由 LLM 在 learn 阶段做分类,用户在 interactive 模式下确认。

交互示例:
```
docplaybook learn

Reading edits in 3 files...
Found 4 candidates:

[Glossary] zh
  "Pull Request" → 保留原文 (不译为「拉取请求」)
  Detected in: 4 files, consistent
  (a)ccept / (e)dit / (s)kip / (q)uit
> a

[Glossary] zh
  "issue" → 「议题」
  Detected in: 3 files, consistent
> a

[Memory] zh
  风格偏好:技术文档使用「应当」而非「应该」
  Detected in: 2 files
> a

Saved 2 glossary entries to glossary/zh.json
Saved 1 memory rule to memories/zh.md
Skipped 1.
```

**责任边界(必须在 README 显著位置说明)**:

> ⚠️ 运行 `learn` 之前,请确认你已经在编辑器里审核过译文。learn 会从你的修改中提取规则,如果未审核就跑,AI 可能在学习自己写错的内容。**`learn` 的语义是"我审完了,从我的修改中学吧"**。

工具不做技术兜底,边界由用户的显式动作来定义。

### 4.3 `status` —— 只读的可见性

不写任何东西,只回答"我现在在哪"。

```
docplaybook status

Workspace: /docs (Rspress)
Source: en  Targets: zh, ja, fr

  zh   ████████░░  42/50 docs   3 stale  5 missing
  ja   ██████░░░░  30/50 docs  10 stale 10 missing
  fr   ░░░░░░░░░░   0/50 docs   0 stale 50 missing

Memory:
  playbook.md       12 rules    last updated 3d ago
  memories/zh.md    47 rules    last updated 1d ago
  memories/ja.md    23 rules    last updated 2w ago

Glossary:
  glossary/zh.json  18 terms
  glossary/ja.json   7 terms

Last translate: 2 hours ago, $0.42, 12.4k tokens
```

**没有这个命令,团队 lead 永远不知道翻译健康度**。这是 status 命令而不是 status 子系统——逻辑很简单。

### 4.4 `init` 与 `bootstrap` —— 一次性命令

- `init` 维持现状,处理交互式设置
- `bootstrap` 维持现状,从已有双语文档冷启动 memory

这两个命令不在日常使用路径上,设计上**不需要新增能力**,不抢占核心动词的注意力。

---

## 5. 文件组织

```
.docplaybook/
├── config.json              # 主配置                进仓库
├── playbook.md              # 跨语言通用规则        进仓库
├── memories/
│   └── <lang>.md            # 单语规则              进仓库
├── glossary/
│   └── <lang>.json          # 硬术语表              进仓库
├── state/                   # 团队共享元数据        进仓库 ✓
│   ├── source-hashes.json
│   ├── learned-target-hashes.json
│   └── translation-meta.json
└── cache/                   # 纯本地加速            .gitignore ✗
```

### 5.1 配置层(人写或 learn 写,都是配置)

| 文件 | 谁写 | 怎么用 |
|---|---|---|
| `config.json` | 人 | 主配置(语言、模型、layout 等) |
| `playbook.md` | 人 | 跨语言通用规则,翻译时注入 prompt |
| `memories/<lang>.md` | 人 + learn | 单语规则,翻译时注入 prompt |
| `glossary/<lang>.json` | 人 + learn | 硬术语表,翻译后做后处理校验 |

**Glossary 和 Memory 的对称性**:形态和用途不同,但来源对称——都可以人写,都可以由 learn 学习。

### 5.2 State —— 团队共享元数据

State 文件**进仓库**,理由:

| 不进仓库 | 进仓库 |
|---|---|
| 团队成员各自维护本地 state,新人 clone 后要全量重翻 | 共享增量进度,新人零成本继续 |
| CI 每次都全量跑,浪费 token | CI 接续本地进度,只翻真正变动的部分 |
| `learn` 的元数据在团队间无法共享 | learn 行为在所有机器上一致 |
| 状态丢了就丢了,没法 review | state 变化 = git diff,可见可审 |

**state 不是缓存,是团队的共享元数据**。

### 5.3 让 state 进仓库不痛的三件事

#### a) 合并冲突好解
- **稳定排序**:所有 key 按字典序写入,避免无意义 diff
- **格式化 JSON**:每行一个条目,让 git 三方合并能 work
- **冲突解决约定**(写在文档里):
  > 遇到 state 文件冲突时,接受双方的并集。如果同一文件的 hash 不一致,不用纠结,下次 `translate` 会自然识别并重翻。**state 冲突没有"对错",只有"过期"**。

#### b) 不污染工作树
- 只在状态真正变化时写(hash 没变就不重写文件)
- 工作流约定:`translate` 完成后,**和译文一起提交 state**,作为同一个 commit

#### c) State 与 Cache 从一开始就分开
未来可能有真正的本地缓存(LLM 响应缓存等),那些不应该进仓库。两个目录的边界要清晰:

- `state/` —— 进仓库,影响团队行为
- `cache/` —— 不进仓库,纯本地加速

`.gitignore` 模板:
```
.docplaybook/cache/
.docplaybook/.env*
```

---

## 6. 已经决定不做的事

记录"不做什么"和"做什么"同样重要。这些是讨论中明确否决的功能:

| 功能 | 否决理由 |
|---|---|
| **Watch 模式** | 频繁未定稿改动会烧 token;debounce / 阈值 / 标记文件等方案都做不出比"手动 translate"更好的体验。要优化的是 translate 的启动速度,不是加监听。 |
| **Provenance 写进 frontmatter** | 污染产物。改用 sidecar `state/translation-meta.json`。 |
| **Memory log 命令** | git log 已经覆盖。 |
| **Review 命令** | 现有"用户在编辑器审核 → learn"流程已经自洽,不需要专门的 review 命令。 |
| **`--audit` flag** | flag 不应承载"什么时候做"的语义。要重检就 `translate --force <path>`。 |
| **隐式失效**(memory 变后自动 stale) | 太魔法,违反"可见 > 自动"原则。 |
| **`lint` 命令** | 与 translate 概念重叠,UX 模糊。能力分散到 `--dry` / `--force`。 |
| **`retranslate` / `relearn` 命令** | 合并为 `--force` flag。 |
| **`learn` 守卫**(`current == last_ai_write` 检查) | 用户责任边界由文档说明,工具不做技术兜底。 |
| **多源语言** | 需求小众,等真实用户提再说。 |
| **`--since` 时间过滤** | 路径作用域 + git 操作可以替代。 |
| **per-language style guide** | 用 glossary + playbook + memory 表达即可,不需要独立机制。 |

---

## 7. 实施路线图

按 ROI 分四档,**第一档先做完再考虑第二档**。

### 🟢 第一档:信任改造(目标 1 周)

完成后用户对工具的信任感会**质变**,且全是减法和小步快跑式的改动,风险低。

| 序号 | 任务 | 价值 |
|---|---|---|
| 1 | **`translate --dry`** | 零成本预览 + 成本估算,消除"按回车恐惧" |
| 2 | **`translate [path]`** 路径作用域 | 消除"全量恐惧",支持小步快跑 |
| 3 | **translate 后的 summary 报告** | 让 memory / glossary 命中信息可见,核心差异点首次被用户感知 |
| 4 | **删除 lint / retranslate / relearn** | 减法,UX 收敛 |
| 5 | **state vs cache 目录分离 + .gitignore 模板** | 为后续奠定文件组织 |

### 🟡 第二档:质量与可见性(目标 2-3 周)

| 序号 | 任务 | 价值 |
|---|---|---|
| 6 | **Glossary 一等公民**(配置文件 + 翻译时注入 + 后处理校验) | 解决硬术语约束,企业用户进门门槛 |
| 7 | **`learn --interactive`**(默认开启) | 让 learn 安全可控 |
| 8 | **learn 同时输出 glossary + memory 候选** | 让差异化能力闭环 |
| 9 | **`status` 命令** | 团队 lead 的可见性入口 |

### 🟠 第三档:工作流集成(目标 1-2 月)

| 序号 | 任务 | 价值 |
|---|---|---|
| 10 | **GitHub Action** | 从工具变成产品的关键一步 |
| 11 | **锚点与跨文档链接完整性** | 修复 i18n 文档站老问题 |

### 🔵 第四档:延后或观望

- 多源语言
- `--since` 过滤
- Memory 规则有效性分析
- LLM 响应本地缓存

---

## 8. 一句话产品形态

> **两个动词**(translate / learn),**三类资产**(glossary / memory / playbook),**一个状态目录**(state),**一份共识**(learn 之前请审核)。

其他都是辅助。

