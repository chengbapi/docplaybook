# docplaybook

`docplaybook` は Markdown ドキュメント翻訳向けのローカルファーストな CLI ツールです。

を監視し、ファイルを複数のドキュメント集合に統合し、ソース文書が変更された際に翻訳版をインクリメンタルに更新し、人による編集から再利用可能な翻訳ノウハウを学習します。長期的な目標はコアエンジンをドキュメントのソースから切り離すことで、同じ同期とノウハウ学習のワークフローを現在はローカルファイルに、将来的にはクラウドドキュメントにも適用できるようにすることです。

## なぜ経験ライブラリが重要か

ほとんどの翻訳自動化ツールはまずまずの初稿を生成できます。本当の問題点は、しばしば人によるレビューや修正の後に現れます：

- レビュアーが製品用語を一度修正しても、次の翻訳で同じミスが繰り返される
- 入念にリライトされた一節が、その後のインクリメンタルな同期で部分的に再翻訳され、レビュー担当者の好みの表現が失われる
- 同じ修正を多数のドキュメントで繰り返さなければならない。ツールがそれをプロジェクトレベルの再利用可能な知識として定着させていないためだ
- 新しい同僚がドキュメントワークフローに参加しても、信頼できる過去の翻訳判断の記録が手に入らない
- ある用語が一つの文書で正しく修正されても、ドキュメントサイト内の他のページは古い訳を保持している

このプロジェクトの核心理念は、手作業による修正を一度きりの編集操作に終わらせるのではなく、プロジェクト全体で追跡・再利用できる翻訳ナレッジとして蓄積するべきだ、ということです。

## 典型的な問題点の例

### 1. 用語のずれ

原文：

```md
飞书知识库支持权限控制。
```

模型把 `知识库` 翻译成 `Knowledge Base`，但团队实际希望它被翻成 `Wiki`，因为那才是这个产品的正式名称。

有人手动把它改对了。结果一周后，这句话源文稍微变了一下，文件再次被同步，工具又把它写回成了 `Knowledge Base`。

这正是本项目试图避免的那种重复回归。

### 2. 人工审阅成果丢失

某个翻译页面已经被人工认真审过并润色过了。之后源页面只有一个段落发生变化，但一个过于粗暴的同步工具，常常会重写目标页面中过多内容，从而把附近原本已经改好的表达也一起冲掉。

按 block 进行同步可以减少这种影响范围，而经验库则能帮助后续翻译继续继承那些已经被修正过的风格和术语。

### 3. 同样的修复在整站反复出现

假设某位审阅者做了这些修改：

- `租户` を `tenant account` から `tenant` に変更する
- `知识库` を `knowledge base` から `wiki` に変更する
- `空间` を `workspace` から `space` に変更する

追跡可能なナレッジベースがなければ、レビュー担当者は数十のドキュメントで同じ3箇所の修正を繰り返す可能性があります。一度これらの決定がプロジェクトレベルの playbook に書き込まれれば、その後のすべての翻訳でそれらが継承されます。

### 4. プロジェクトの知識が人の頭の中にしか存在しない

多くのドキュメントチームでは、実際の翻訳ルールが書き残されていないことが多い：

- どの用語を原文のままにして翻訳してはいけないか
- どの製品名に公式の英語名称があるか
- 全体の語調は簡潔にすべきか、それとも説明的にすべきか
- API のフィールド名は直訳すべきか、それとも英語のままにすべきか

これらの知識がレビュー担当者の頭の中にしかないと、翻訳品質は「たまたま誰がその文書をレビューするか」に大きく左右されます。追跡可能なノウハウのドキュメントがあれば、これらの判断をプロジェクトの資産に変えることができます。

### 5. 新しい経験は一つのファイルだけに留めるべきではない

もし新しい翻訳ルールがあるドキュメント内で見つかった場合、それがずっとそのファイルに閉じ込められていてはいけません。このツールの長期的な方向性は：一度新しいノウハウを学習したら、それを workspace 全体の他のコンテンツに適用して再検証できるようにすること、特に用語類や他の高い再利用性を持つ修正に対してです。

## できること

- ワークスペース全体を監視し、単一ファイルだけを監視するのではない
- 複数のドキュメントをまとめて複数の doc set に統合する
- まず同じ階層のファイル配置をサポートする：`guide.md`、`guide.en.md`、`guide.ja.md`
- Markdown をブロックに分割し、変更があって翻訳可能なブロックのみを再翻訳する
- frontmatter、コードブロック、HTML ブロック、区切り線など翻訳すべきでないコンテンツは保持する
- 各言語ペアに対応するプロジェクトレベルの翻訳 playbook を更新することで、人手での修正から学習する
- ランタイム状態をリポジトリ外に保存し、スナップショットやハッシュによるワークスペースの汚染を避ける

## アーキテクチャ

初版は意図的にいくつかの層に分割している：

- `DocumentProvider`：ドキュメントの取得元。最初の provider はローカルファイル
- `LayoutAdapter`：ファイルを論理的な doc set にマッピングする方法。最初の preset は `sibling`
- `TranslationEngine`：Vercel AI SDK に基づくブロック単位の翻訳
- `MemoryEngine`：手動での修正に基づき、テキスト翻訳 playbook を更新する
- `RuntimeStore`：スナップショット、ハッシュ、最後に生成したベースラインをリポジトリ外に保存する

CLI 内部で使用されるコアオブジェクトは次の通り：

- `Workspace`：`docplaybook <path>` 実行時に渡されるルートディレクトリ
- `DocSet`：1つのソースドキュメントとそれに対応する複数の翻訳版
- `DocumentRef`：特定の言語における具体的なファイル

## なぜランタイムデータをリポジトリの外に置くのか

コア同期ループが必要とするのは Git の履歴だけではありません：

- 前回処理後の原文スナップショット
- 前回自動生成された訳文スナップショット
- 現在ディスク上の訳文スナップショット

こうすることで、エージェントは2つの異なる質問に答えられるようになります：

- 前回処理済みのベースラインと比較して、原文が何を変更したか
- 前回自動生成されたベースラインと比較して、人間が訳文を何を変更したか

これらのベースラインはランタイム状態に属し、製品コンテンツではないため、ユーザーデータディレクトリに保存されます：

- macOS: `~/Library/Application Support/docplaybook/workspaces/<workspace-id>/`
- Linux: `$XDG_STATE_HOME/docplaybook/workspaces/<workspace-id>/`
- Windows: `%LOCALAPPDATA%/docplaybook/workspaces/<workspace-id>/`

このルートディレクトリは `DOCPLAYBOOK_HOME` で上書きできます。

## 設定

プロジェクトの設定と追跡可能な経験ファイルは workspace 内に保存されます：

```text
<workspace>/
  .docplaybook/
    config.json
    memories/
      zh-CN__en.md
      zh-CN__ja.md
```

推奨されるモデル設定形式：

- `gateway`：Vercel AI Gateway を使用し、`openai/gpt-5-mini` のような gateway モデル文字列を渡します
- `openai`：公式プロバイダーパッケージを使用して直接 OpenAI を呼び出します
- `anthropic`：公式プロバイダーパッケージを使用して直接 Anthropic を呼び出します
- `openai-compatible`：ユーザー指定の OpenAI 互換エンドポイントを使用します（例: OpenRouter やセルフホストされたゲートウェイ）

`.docplaybook/config.json` は JSONC として読み込まれるため、`//` や `/* ... */` のコメントを含めることができ、説明を設定のそばに直接書くのに便利です。

Vercel AI Gateway を使用した `.docplaybook/config.json` の例：

```json
{
  "version": 1,
  "sourceLanguage": "zh-CN",
  "targetLanguages": ["en", "ja"],
  "ignorePatterns": ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.docplaybook/**"],
  "concurrency": {
    "maxConcurrentRequests": 6
  },
  "batch": {
    "maxBlocksPerBatch": 8,
    "maxCharsPerBatch": 6000
  },
  "layout": {
    "kind": "sibling"
  },
  "model": {
    "kind": "gateway",
    "model": "openai/gpt-5-mini",
    "apiKeyEnv": "AI_GATEWAY_API_KEY"
  }
}
```

`ignorePatterns` は docplaybook 自身の無視ルールを補うためだけのもので、`.gitignore` のルールはここが空配列でもデフォルトで併用されます。

`concurrency.maxConcurrentRequests` は1回の sync で全ての target と batch が共有するグローバルなリクエスト同時実行プールで、デフォルトは `6`、最大は `20` をサポートします。プロバイダがレート制限を起こしやすい場合は控えめにしてください。

`batch.maxBlocksPerBatch` は一度のバッチ翻訳で最大いくつの block をまとめるかを制御します。長いドキュメントで呼び出し回数が多すぎると感じる場合は、この値を調整してください。

`model` のセクションは明確にユーザーが制御するものです。API key は決してリポジトリに保存してはいけません：

- `gateway` モードは AI SDK Gateway のモデル文字列を使用し、環境変数から API キーを読み取ります
- `openai` モードは公式の OpenAI provider パッケージを使用し、環境変数から API キーを読み取ります
- `anthropic` モードは公式の Anthropic provider パッケージを使用し、環境変数から API キーまたは認証トークンを読み取ります
- `openai-compatible` モードは環境変数で base URL と API キーを提供することで、任意の OpenAI 互換エンドポイントに接続できます

`openai` の設定例：

```json
{
  "kind": "openai",
  "model": "gpt-5-mini",
  "apiKeyEnv": "OPENAI_API_KEY",
  "baseUrlEnv": "OPENAI_BASE_URL"
}
```

`anthropic` の設定例：

```json
{
  "kind": "anthropic",
  "model": "claude-sonnet-4-5",
  "apiKeyEnv": "ANTHROPIC_API_KEY",
  "authTokenEnv": "ANTHROPIC_AUTH_TOKEN",
  "baseUrlEnv": "ANTHROPIC_BASE_URL"
}
```

`openai-compatible` 設定例：

```json
{
  "kind": "openai-compatible",
  "providerName": "openrouter",
  "model": "google/gemini-2.5-flash",
  "baseUrlEnv": "OPENROUTER_BASE_URL",
  "apiKeyEnv": "OPENROUTER_API_KEY"
}
```

モデルクライアントを作成する前に、`docplaybook` はこれらの env ファイルも自動的に読み込みます：

- `.docplaybook/.env.local`
- `.docplaybook/.env`
- `.env.docplaybook.local`（旧位置との互換性あり）
- `.env.docplaybook`（旧位置との互換性あり）
- `.env.local`
- `.env`

推奨事項：

- `.docplaybook/config.json` をリポジトリにコミットする
- キーを `.docplaybook/.env.local` に保存する
- 自動化環境ではシェルの環境変数や CI のシークレットを使用する

## 翻訳メモリ

各言語ペアには追跡可能な Markdown プレイブックがあり、例えば：

- `.docplaybook/memories/zh-CN__en.md`

このファイルは各翻訳プロンプトに注入されます。これは本質的にプロジェクトレベルの翻訳スキルやシステムコンテキストのようなものです：

- 用語規則
- 好ましい表現
- スタイル修正ルール
- 再利用可能な手動上書き

これがこのツールと単純な「翻訳差分ファイル」スクリプトとの最大の違いです。初稿はもちろん重要ですが、より重要なのは人工修正を長期的に保持して再利用することです。

人が翻訳ドキュメントを編集したとき、エージェントは次を比較します：

- 前回のソースのスナップショット
- 前回自動生成された翻訳のスナップショット
- 現在の翻訳ファイル

その後、LLM に playbook 全体を直接更新させ、できるだけ簡潔に、重複を除き、プロンプトに続けて入れられる形に保ちます。もし翻訳ファイルが大幅に構造変更されている場合、エージェントは警告を出し、安全を期して経験生成をスキップします。

## Layout プリセット

初版ですでに実装されているプリセットは次のとおりです：

- `sibling`：`guide.md`、`guide.en.md`、`guide.ja.md`

内部モデルは将来の preset のための形態を予め用意しています：

- `docusaurus`
- `rspress`

これら二つは現在まだ予約状態です。現在のエンジンはドキュメントを「按 doc set 分组的離散文件」と見なしており、これは「只处理单文件」のモデルよりも docs-as-code 類のドキュメントサイトに適しています。

## インストール

プロジェクト単位のインストール（ローカル開発向け）：

```bash
npm install
```

グローバルインストールは行わず、リポジトリ内で直接実行：

```bash
npm run dev -- --help
```

ローカルリポジトリからグローバルにインストール：

```bash
npm install
npm run build
npm link
```

これで任意のディレクトリで使用できるようになります：

```bash
docplaybook --help
docplaybook init ./my-docs
docplaybook ./my-docs
```

まずパッケージ化してからグローバルインストールを行います：

```bash
npm pack
npm install -g ./docplaybook-0.1.0.tgz
```

グローバルなリンクを削除：

```bash
npm unlink -g docplaybook
```

## コマンド

ビルド：

```bash
npm run build
```

ワークスペースを初期化します。まずは対話式の初期化を直接実行することを推奨します：

```bash
npm run dev -- init ./examples/sample-workspace
```

それは次のことを行います：

- まずモデルの provider と具体的な model を選択するよう案内します
- 必要な認証情報の設定を完了し、準備ができたら軽い接続確認を行います
- メインドキュメントの言語を自動で検出し、確認を求めます
- その後、`en,ja` のような target languages を入力するよう促します
- `.docplaybook` ディレクトリを作成し、設定を初期化します。翻訳はすぐには開始しません

その後さらに言語を追加したい場合は、同じ workspace 内で再度実行できます：

```bash
npm run dev -- init ./examples/sample-workspace
```

次に新しいターゲット言語を入力します。例えば `fr,de`。既存の言語は保持され、新しい言語の設定と記憶ファイルのみが追加されます。

CIや非対話環境で実行する場合は、引数を明示的に渡すこともできます：

```bash
npm run dev -- init ./examples/sample-workspace --source zh-CN --targets en,ja
```

初期化が完了したら、必要に応じて手動で一度翻訳を実行するか、そのまま watch モードに入ることができます。

OpenAI の公式直結を使用して初期化：

```bash
npm run dev -- init ./examples/sample-workspace --model-kind openai --model gpt-5-mini
```

Anthropic 公式の直接接続を使用して初期化：

```bash
npm run dev -- init ./examples/sample-workspace --model-kind anthropic --model claude-sonnet-4-5
```

カスタムの OpenAI 互換プロバイダーを使用して初期化：

```bash
npm run dev -- init ./examples/sample-workspace --model-kind openai-compatible --provider-name openrouter --model google/gemini-2.5-flash --api-key-env OPENROUTER_API_KEY --base-url-env OPENROUTER_BASE_URL
```

デフォルトでは一度実行して終了します：

```bash
npm run dev -- ./examples/sample-workspace
```

継続的な待ち受け：

```bash
npm run dev -- ./examples/sample-workspace --watch
```

## 調査記録

現在のソリューションは隣接する問題を解決するいくつかのツールを参考にしているが、それらは「ローカル優先 + 経験学習の閉ループ」という形態を完全にはカバーしていない：

- [Azure co-op-translator](https://github.com/Azure/co-op-translator)：これは「増分ドキュメント翻訳」に非常に近く、原文と訳文の状態を追跡し、変更部分のみを処理する。しかし、手作業で修正して追跡可能なプレーンテキストの経験ファイルを生成することを目的に設計されてはいない。
- [Lingo.dev CLI](https://lingo.dev/en/cli)：`delta lock file` を維持し、ソースが変わる前にできるだけ手動オーバーライドを保持する。これは docs リポジトリでの増分同期挙動に参考になる。
- [GitLocalize](https://docs.gitlocalize.com/about.html)：セグメントベースの docs-as-code 継続ローカリゼーション機能を提供し、翻訳メモリと用語集もサポートする。機能的には近いが、プロダクトとしてはローカルエージェントの骨組みではなくプラットフォーム中心のフロー寄りである。
- [Crowdin GitHub integration](https://store.crowdin.com/github)：成熟した継続ローカリゼーション製品モデルを示しており、翻訳メモリ、AI、リポジトリ同期機能を備えている。しかしここで想定しているローカル優先の CLI 方式に比べると遥かに重厚である。
- [Docusaurus i18n](https://docusaurus.io/docs/i18n/introduction)：多言語ドキュメントは通常ロケール対応のディレクトリ構成で個別ファイルに分割されることを示している。
- [Rspress i18n](https://rspress.rs/guide/basic/i18n)：これもまた、ローカライズされたドキュメントが個別ファイルとして存在することを示しており、したがってレイアウトアダプタが必要である。
- [Vercel AI SDK provider selection](https://ai-sdk.dev/docs/getting-started/choosing-a-provider)：モデル選択は常にユーザが設定可能であるべきで、ツールにハードコードされるべきではないことを示している。

## 現在の制限

- 現在はローカルファイルのワークスペースのみ実装している
- 現在は `sibling` レイアウトプリセットのみ実装している
- 経験のリコール戦略は意図的にシンプルにしている：毎回言語ペア全体のプレイブックを注入する
- 翻訳文に大幅な構造編集が発生した場合、警告を出すだけで、経験の更新は行わない
- Markdown ブロック解析はベストエフォートであり、非常に複雑なドキュメントに対してはさらなる改善が必要な場合がある

## 今後の方針

- リストや表、その他複雑な Markdown 構造に対するブロックマッチング能力を強化する
- Docusaurus と Rspress のレイアウトアダプタを補完する
- プロジェクトレベルの再検証プロセスを追加し、新たに学習した経験が既存の翻訳を再走査してチェックできるようにする
- コアの翻訳・経験エンジンを変更しない前提で、Feishu ドキュメントなどのクラウドドキュメントプロバイダを追加する
