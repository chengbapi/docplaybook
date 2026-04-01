# CI 与 GitHub

CI 通常是团队集中管理单一提供商、单一模型和单一翻译预算的地方。

## 典型的 CI 作业

常见的 CI 职责包括：

- `docplaybook translate`
- `docplaybook lint`

典型命令：

```bash
pnpm exec docplaybook translate .
pnpm exec docplaybook lint . --fix --scope changed
```

如果你的流水线针对特定地区/语言：

```bash
pnpm exec docplaybook lint . --fix --scope changed --langs ja
```

如果你想要定期进行全面审查：

```bash
pnpm exec docplaybook lint . --scope all
```

## GitHub 工作流用法

一个实用的 GitHub 工作流如下：

1. 运行 `docplaybook translate .`
2. 提交或上传生成的翻译更改
3. 运行 `docplaybook lint . --fix --scope changed`
4. 如果 lint 仍报告不可接受的问题，则使作业失败

这样能为审查者同时提供更新后的翻译文档和明确的问题发现。

## 模型设置

两种模式效果良好：

### 共享模型，不同的密钥

将 provider 和 model 保存在 `.docplaybook/config.json` 中。

然后：

- 本地开发者将密钥保存在 `.docplaybook/.env.local`
- CI 通过环境变量注入机密

### 本地与 CI 使用不同模型

不要在 `config.json` 中锁定 `model`。

然后：

- 本地使用 `.docplaybook/.env.local`
- CI 在流水线中设置 `DOCPLAYBOOK_MODEL_*` 变量和提供商密钥

这更灵活，但本地与 CI 运行之间的输出更容易产生偏差。
