# Gemworks — 设计文档

本文讲 gemworks 为什么做成现在这样、各部分怎么配合：§0–§3 是定位、目标与总体架构；§4–§5 是固化流程的格式与运行时；§6 是代码的组成；§7 是内置流程；§8 是各宿主上的界面；§9–§12 是测试、还没做的、取舍和宿主能力。

- 固化流程格式的规范文本是 [`workflow.md`](workflow.md)（中文版 [`workflow_CN.md`](workflow_CN.md)），两边说法不一致时以它为准。
- 代码注释里的「spec §x.y」引的是本文的章节号（§3.6 那几处引的是 workflow.md），所以改本文时章节号不动。

---

## 0. 一句话

Gemworks 让你正在用的 coding agent（Claude Code、Codex、Cursor、Pi 等）按流程干活，并把**写下一条提示词之前要看的东西**放在一处：在做哪件事、走到哪一步、等你定什么、做出了什么、别的会话定了什么。

流程有两种：

- **起步流程**（代码里叫 coach）只提醒、不拦人。模型每轮报告工作项走到了哪一步；做到某一步时，挂在那一步上的做法提醒到模型；gemworks 从你的纠正里学出新做法、提议增删步骤。只有你点了「改成规定」的那几步会拦。
- **固化流程**是一张 `geml-statechart` 状态图：按观察到的事实（退出码、文件、git 与 CI、人的勾选）推进，在工具调用前把关，每一步记进一本带哈希链的日志（journal）。

记录都留在项目主检出的 `.geml/` 里，不出本机。

## 1. 出发点

### 1.1 为什么是这个形态

用 agent 做一件要几天、好几个会话的活，难的不是写提示词，是每写一条之前要把前情找齐：上次做到哪、哪些事已经定了、哪些坑踩过、做出了什么。gemworks 替人记着这些，装上就开始记，状态带和看板天天摆在眼前，不用另开一个 IDE。

流程不是让人服从的固定规程。每个人、每个团队要防的坑不一样，所以一条流程是一串「这一步防什么坑」的步骤，用着用着会长：纠正一次，记成一条做法挂在那一步上；同类纠正攒多了，提议加一步；某一步老被跳过，提议删掉；每次改都要人同意。真正不能跳的步骤，人点一下改成规定，或者写一条固化流程。

### 1.2 为什么用状态图

| 要什么 | 用什么 |
|---|---|
| 流程的定义 | GEML 文档里的 `geml-statechart` 图块：状态、转换、变量。起步流程和固化流程是同一种格式 |
| 一步做完的条件 | 转换上的通行要求：对变量的 JSON Schema 由机器判，一句话由模型判，`approval` 由人判 |
| 按阶段给模型的指令 | 状态的 `description` 和 `prompt` 指向的章节 |
| 不可伪造的记录 | journal：每条修订一个 `data` 块，哈希链相连，能按坐标读、能用 `gemworks verify` 校验 |
| 项目里的存储 | 主检出的 `.geml/`，同一仓库的每个 worktree 共用 |

运行时只依赖已发布的 GEML 解析器 `@geml/geml`；状态图的载入与检查、监督器、信号、日志都在本仓库的 `src/core/` 里。

### 1.3 拆分

| 部分 | 做什么 | 在哪 |
|---|---|---|
| 核心 | 状态图、监督器、信号、日志、工具词典、工作项、做法、规定、提议、纠正账本、会话记录；纯函数 | `src/core/` |
| Node 一侧 | 加锁读写、git 与 gh 的事实、bridge、落盘 | `src/` 根目录、`src/store/` |
| Claude Code 插件 | 状态带、看板、对话框、问人、拦截 | `hooks/`、`src/hosts/claude-code/` |
| 其他宿主 | Codex、Cursor、Qwen Code、OpenCode、Devin、TRAE、Kiro、Antigravity 的钩子适配器；DeepSeek Harness、Pi 的进程内适配器 | `src/hosts/<宿主>/` |
| MCP 服务器 | 给只接 MCP 的宿主 | `src/mcp.ts` |
| 命令行 | `gemworks`（简写 `gwx`）：人的操作、各宿主的钩子入口与安装、纠正账本 | `src/cli.ts` |
| 内置流程 | 十条起步流程、四个固化流程模板 | `coach/`、`workflows/` |

流程市场（目录、预览、安装）搁置，见 §10。

## 2. 目标与边界

**目标**

- 同一个项目换个宿主，看到的是同一批工作项、做法和记录：它们都写在项目的 `.geml/` 里，每个宿主读写同一份。
- 内置流程和用户自己写的流程用同一种格式，引擎里没有内置流程的特殊通道。
- 判断「这一步做完了」靠观察到的事实，不靠模型自报：固化流程读退出码、文件、git 与 CI、人的勾选；起步流程里机器判的步要模型给出跑过的命令和结果，人判的步要人自己的话。
- 默认不挡路：起步流程只提醒；拦人的只有固化流程封住的岔口和人点成的规定。gemworks 自己出了错一律放行，两秒内定不下来的调用照常执行。
- 记录留在本机：`.geml/` 里的东西不上传；团队要共用的做法、规定和流程经「分享」写进仓库的 `.gemworks/`，由人提交。
- 词汇最少：gemworks 只在状态图的状态、变量、转换上挂几个属性，不给 GEML 加块类型、属性键或图格式。

**不做**

- 按分支的固化流程里，在仓库默认分支上直接做的活不记 journal：工作项是分支，默认分支上没有工作项。
- 用户在自己终端里跑的命令不写 `tool` 证据。
- 信号只产生布尔值。
- 插件不替用户切换分支。
- 要人点头的转换、人判的步、人勾选的变量，模型都碰不了。

## 3. 总体架构

```
┌──────────────────────────── 宿主 ────────────────────────────┐
│ Claude Code：插件模块（状态带、看板、对话框、拦截、问人）              │
│ Codex、Cursor、Qwen Code、OpenCode、Devin、TRAE、Kiro：钩子 + MCP    │
│ Antigravity：钩子 + MCP，只记录、不拦                                │
│ DeepSeek Harness、Pi：进程内适配器                                   │
│ 其他宿主：gemworks mcp                                              │
└───────────────────────────────┬──────────────────────────────┘
                                │ 工具调用、提示词、回合结束进；放行或拒绝、给模型的上下文出
┌────────────────── 核心（src/core/，宿主无关，纯函数）───────────────────┐
│ statechart   载入、静态检查                                            │
│ supervisor   通行要求、批准、用途封路、人专属命令、工具词典的判定             │
│ signals      变量的来源：tool、file、git、gh、human、elapsed；tool 证据随内容过期 │
│ stagehand    进入一个状态时写出阶段说明                                   │
│ journal      固化流程的日志：每个工作项一本，哈希链                         │
│ work         起步流程的工作项与进度                                       │
│ practices、growth   做法、规定、提议                                     │
│ corrections  纠正账本                                                  │
│ session-log  共享的会话记录与决定                                        │
└──────────────────────────────────────────────────────────────────┘
```

**数据布局**（项目内）

```
.geml/                    在主检出里，仓库的每个 worktree 读的都是这一份
  workflows/<name>.geml   一条固化流程：一个状态图块，后面跟着各阶段的提示词
  tools.geml              所有固化流程共用的工具词典
  project.geml            项目文档：meta flow-workflow 指定默认流程；#items 列着每个工作项和它的结局
  journals/<工作项>.geml   每个工作项一本 journal：一个分支，或一组文件中的一个
  sessions/               会话记录：各宿主的每个会话一份，含工作项上报与决定
  coach/<name>.geml       项目自己的起步流程：改过的内置流程、加的流程
  practices.geml          项目的做法
  rules.geml              项目的规定
  proposals.geml          等人答复的提议
  artifacts.geml          产物表：链接、在 git 里改过的文档、git 不留的文件
  artifacts/              git 不留的文件的副本，按内容哈希命名
  signoffs/<id>.geml      每个工作项的验收单
  references/             导入的参考流程
  board.geml              给没有面板的宿主的 GEML 看板
  exports/                导出的文件
  trace.log               Claude Code 插件的诊断记录（打开 trace 时）
  .gitignore              gemworks init 写出
.geml/                    在每个检出里
  context.geml            当前阶段的说明与变量，换阶段时重写
  backlog.geml            backlog 表
.gemworks/                在仓库里，由人提交：团队的流程、做法、规定
~/.gemworks/              在家目录：个人的做法、纠正账本、回收站，以及多数钩子宿主的会话状态
```

**包与目录**：仓库 `geml-spec/gemworks`，npm 包 `@geml/gemworks`，命令 `gemworks` 和 `gwx`。同一个包带着全部宿主的入口：Claude Code 插件（`.claude-plugin/`、`hooks/`）、Codex 插件（`.codex-plugin/`、`codex/`）、Antigravity 插件（`.antigravity-plugin/`、根目录的 `hooks.json` 和 `mcp_config.json`）、DeepSeek Harness（`exports["./dsh"]`、`cordis.patch.yml`、`client.js`）、Pi（`package.json` 的 `pi` 字段）；其余宿主由 `gemworks <宿主> install` 写进它们自己的配置。插件根目录就是仓库根目录。Claude Code 从 gemworks 自己的 marketplace 安装（`/plugin install gemworks --marketplace geml-spec/gemworks`，以 npm 包为来源），它依赖的 geml 插件来自 GEML 的 marketplace。Node 一侧打成 `dist/gemworks.mjs`（`@geml/geml` 内联，按块切开，每块不超过 256 KiB），装上不用再装依赖，需要 Node ≥ 22。发布时同一份构建还解开整份提交到 `plugin` 分支，给只从 GitHub 分支读插件的目录用（Anthropic 的插件目录、Antigravity）。

## 4. 流程文档

一条固化流程是一份 GEML 文件 `.geml/workflows/<name>.geml`：meta 块声明 `profile = "geml-statechart/v1"`，一个 `geml-statechart` 图块写状态机，后面是各阶段的提示词章节。状态机的骨架——状态、转换、通行要求、动作、变量——是 geml-statechart 的通用格式，任何 GEML 处理器都能检查；gemworks 在状态、变量、转换上挂几个自己的属性，把状态机接到 agent 上：状态给模型什么（`prompt`、`skills`），这一步用哪些用途（`tools`）、哪些用途只许在这一步用（`rules`），变量的值从哪来（`source`），转换要不要人点头（`approval`）。工具的权限与偏好不写在流程里，记在项目的工具词典 `.geml/tools.geml` 里（§5.3）。

gemworks 读的 meta 键有两个，都只在按文件划分工作项的流程里写：

| 键 | 意思 | 默认 |
|---|---|---|
| `flow-unit` | 一个工作项是什么：`branch`（每个分支一个），或 `file:<glob>`（每个匹配的文件一个，如 `file:episodes/*.geml`） | `branch` |
| `flow-state-key` | 按文件的流程里，工作项的状态写回那个文件 meta 的哪个键 | 不写回 |

### 4.1 一份完整的流程文档（开发流程）

内置的开发流程，装进项目后的样子（提示词章节只列开头两节）：

```geml
=== meta
title   = "发布流程"
profile = "geml-statechart/v1"
===

=== diagram {#flow format=geml-statechart caption="发布流程"}
{
  "initial": "build",

  "states": {
    "build": {
      "title": "构建",
      "description": "写代码和测试，直到测试通过、PR 开出来。",
      "prompt": "#build",
      "tools": ["edit", "test", "pr"]
    },
    "review": {
      "title": "评审",
      "description": "处理 review 意见，等 CI 绿、PR 合并。",
      "prompt": "#review",
      "tools": ["edit", "test"]
    },
    "deploy": {
      "title": "部署",
      "description": "部署到 staging 并验证。",
      "prompt": "#deploy",
      "rules": ["deploy-staging"]
    },
    "release": {
      "title": "上线",
      "description": "部署到 production。",
      "prompt": "#release",
      "rules": ["deploy-prod"]
    },
    "done": { "title": "完成", "final": true }
  },

  "vars": {
    "tests-pass":       { "default": false, "source": { "tool": "test" } },
    "pr-open":          { "default": false, "source": "pr-open" },
    "pr-merged":        { "default": false, "source": "pr-merged" },
    "ci-pass":          { "default": false, "source": "ci-success" },
    "review-ready":     { "default": false, "source": "human", "note": "测试只在 CI 里跑时，由人勾选" },
    "deployed-staging": { "default": false, "source": { "tool": "deploy-staging" } },
    "deployed-prod":    { "default": false, "source": { "tool": "deploy-prod" } }
  },

  "transitions": [
    { "from": "build", "to": "review",
      "guard": { "anyOf": [
        { "properties": { "tests-pass": { "const": true }, "pr-open": { "const": true } } },
        { "properties": { "pr-merged": { "const": true } } },
        { "properties": { "review-ready": { "const": true } } } ] } },

    { "from": "review", "to": "build",
      "guard": "review 要求改动",
      "actions": [ { "reset": ["tests-pass", "review-ready"] } ] },

    { "from": "review", "to": "deploy",
      "guard": { "properties": { "pr-merged": { "const": true }, "ci-pass": { "const": true } } } },

    { "from": "deploy", "to": "release",
      "guard": { "properties": { "deployed-staging": { "const": true } } },
      "approval": true },

    { "from": "release", "to": "done",
      "guard": { "properties": { "deployed-prod": { "const": true } } } }
  ]
}
===

# 构建 {#build}

在这个分支上写代码和测试。测试命令每跑一次，结果都会被记下……

# 评审 {#review}

PR 已开。逐条处理 review 意见……
```

链条是 **状态 → 工具 → 变量 → 转换 → 状态**：`build` 声明了用途 `test`，词典把它绑到本项目的 `npm test`；那条命令以 0 退出，`tests-pass` 变成 true；`build→review` 的通行要求读它，成立就自动走；进入 `review`，模型换一节提示词、换一组用途。流程里只写用途、不写命令，所以同一份流程搬到 Rust 项目一字不改，那里的词典把 `test` 绑到 `cargo test`。

`build` 不会卡住：PR 在 gemworks 看到它开着之前就合并了，或者测试只在 CI 里跑、本地从不出现测试证据，通行要求的另外两支（PR 已合并、人勾了 `review-ready`）都能放行。写代码、测试、开 PR 在哪一步都能做；两条规定封路：staging 部署只在 `deploy` 能跑，production 部署只在 `release` 能跑。

`gemworks init` 同时把起步词典写进项目的 `.geml/tools.geml`：

```geml
=== table {#tools}
| tool                                | for            | allow | deny | default | params |
|-------------------------------------|----------------|-------|------|---------|--------|
| Read                                |                | *     |      |         |        |
| Edit                                | edit           |       |      |         |        |
| Bash(npm test)                      | test           |       |      | yes     |        |
| Bash(gh pr create)                  | pr             |       |      |         |        |
| Bash(wrangler deploy --env staging) | deploy-staging |       |      |         |        |
| Bash(wrangler deploy)               | deploy-prod    |       |      |         |        |
===
```

`Bash(wrangler deploy)` 按整词匹配前缀：带 `--env production` 的和不带 `--env` 的部署都算 production，`wrangler deployments list` 不算；`wrangler deploy --env staging` 归字面部分更长的那个键。实际的起步词典每种写法多一行（`npx`、`pnpm`、`bunx` 前缀，`test` 另绑 `pnpm test`、`yarn test`、`cargo test`、`pytest`、`go test`）。

### 4.2 构件

| 构件 | 写法 | 含义 |
|---|---|---|
| 状态机 | `diagram {format=geml-statechart}`，正文是 JSON | 状态、转换、变量；保留键、通行要求的三种写法、`reset`、画法、`data=` 见 geml-statechart 自己的词汇表 |
| 状态 | `states` 里的一项 | `title`、`description` 给人看也给模型看；`final: true` 标终态，一张图可以有几个（§5.1）。gemworks 的属性：`prompt`，提示词，一个章节（本文件的 `#id` 或 `doc.geml#id`）或整份文档，`./` 开头的路径相对流程所在目录，其余相对项目根；`skills`，skill 名的列表，交给宿主；`tools`，这一步用的用途；`rules`，只许在声明它的状态里用的用途（也算这一步用的用途） |
| 变量 | `vars` 里的一项 | `default` 定类型。gemworks 的属性：`source`（值从哪来，见下）、`note` |
| 转换 | `transitions` 里的一项 | `guard`，以及 `actions` 里的 `reset`：走这条边时把列出的变量在同一条修订里还原成默认值，通行要求读的是还原之前的值。gemworks 的属性：`approval: true`（要人此刻点头）、`note`（给模型的说明）、`label`（人按的那个按钮上的字，不写时取目标状态的 `title`） |
| 通行要求块 | `format=json` 的 `data` 块，`guard` 用 `#id` 引用 | 长的、几条转换共用的通行要求 |
| 提示词 | 普通的章节或文档，`prompt` 引用 | 进入状态时展开进阶段说明 |
| 工作项单位 | meta `flow-unit` | 见上表 |

**`source`：变量的值从哪来。**

| 写法 | 何时写 | 值 |
|---|---|---|
| 没有 `source` | 模型调用 `set` | 模型写的值，类型须与默认值相同 |
| `{ "tool": "<用途>" }` | 绑到这个用途的一次工具调用结束时（§5.2） | 成功 true，失败 false |
| `{ "file": "<glob>" }` | 写文件或运行命令的调用结束时、会话开始时、看板刷新时 | 有文件匹配时 true |
| `"committed"` `"pr-open"` `"pr-merged"` `"ci-success"` | 会话开始时、运行了 `git` 或 `gh` 的调用结束时、看板刷新时 | git 与 CI 的事实（§5.2） |
| `"human"` | 人在看板上勾选，或在自己终端运行 `gemworks mark` | 勾上 true，取消 false |
| `{ "elapsed": "<ISO 8601 时长>" }` | 打开工作项时，和每次写操作开始时（§5.2） | 当前状态已停留至少这么久时 true；进入状态时回到 false |

有 `source` 的变量是证据，模型写不了，默认值必须是 `false`；没有 `source` 的是模型自己的记事本。

**三种通行要求，三种判断者。**

| 通行要求 | 谁判 | 怎么走 |
|---|---|---|
| 对象，或引用通行要求块 | 机器 | 一次改动之后成立就自动走；一个状态至多一条这样的、不要批准的出边 |
| 一句话 | 模型 | 原文随阶段说明交给模型；模型认为成立时 `move` |
| `approval: true` | 人 | 看板上按，或 `gemworks advance`；写了通行要求则它也须满足；从不自动走 |

没有通行要求、也不要批准的转换，模型 `move` 或人走。

**用途。** 状态的 `tools` 列出这一步要用的用途——`edit`、`test`、`pr`、`image`——都是作者自己起的词；工具词典把用途绑到本项目的具体工具（§5.3）。绑到用途的调用产生的 `tool` 证据，只在声明了这个用途的状态里算数。`rules` 里的用途还封路：只有声明它的状态能用，别的状态里的调用被拒绝——production 部署只在 `release` 跑得了，就是这样写出来的。没绑用途的工具，按词典里那一行的允许与拒绝判；词典里没有它就放行，交给宿主自己的权限规则。

### 4.3 静态检查

`gemworks check <流程文件>` 先跑 `geml check`：那里报 error 就不再往下读。声明了 `geml-statechart/v1` 时，这一步包括状态机格式自己的检查（`statechart-body`、`statechart-initial`、`statechart-state`、`statechart-transition`、`statechart-guard`、`statechart-actions`、`statechart-vars`、`statechart-current`、`statechart-unreachable`）。然后读项目的工具词典（对照项目的所有流程），报 gemworks 自己的：

| id | 级别 | 何时 |
|---|---|---|
| `flow-statechart` | error | 文件里没有 `geml-statechart` 图块，或者不止一个 |
| `flow-attr` | error | `prompt` 解析不到；`skills`、`tools`、`rules` 不是名字的数组；`approval` 不是 `true`；`source` 不是上表的写法；有 `source` 的变量默认值不是 `false`；`note` 不是字符串；`label` 不是非空字符串 |
| `flow-source` | warning | 变量 `source.tool` 的用途没有任何状态声明，这个变量永远立不起来；词典里 `for` 的用途没有任何状态声明 |
| `flow-dup-edge` | error | 同一对状态之间有两条转换（journal 按 `from→to` 记转换） |
| `flow-auto-ambiguous` | error | 一个状态有多于一条机器判的、不要批准的出边 |
| `flow-auto-cycle` | warning | 自动走的边首尾相接成环：通行要求若同时满足，流程会原地打转，运行时在第一个会二次进入的状态前停下 |
| `flow-unit` | error | `flow-unit` 不是 `branch`，也不是 `file:` 加一个非空 glob；`flow-state-key` 写在按分支的流程里，或不是一个键名 |
| `flow-tools` | error | 工具词典表头不对；`allow`、`deny` 里有流程没有的状态；`params` 不是 JSON 对象；同一用途有两个 `default` |

诊断里转换写作 `from→to`。每条检查都钉在 [`checks.json`](checks.json) 里，由 `test/core/checks-conformance.test.mjs` 逐例重放。

## 5. 运行时

### 5.1 推进

| 谁 | 怎么发生 | `by` |
|---|---|---|
| 模型 | `move` 走一条出边：一句话的通行要求的边，或没有通行要求的边；机器判的边不由它走（通行要求满足时自己走），要批准的边也不行 | `model` |
| 人 | 在看板上按一条边，或在自己终端运行 `gemworks advance <state>`；这本身就是批准 | `human` |
| 自动 | 一次改动之后，当前状态那条机器判的、不要批准的出边的通行要求满足了，立即走 | 记那次改动的来源：信号写入后 `signal`（带 `signal=<变量>`），模型动作后 `model`，人推进后 `human` |

一次写入了几个信号时，自动走的边记在它的通行要求所读的变量对应的那个信号名下（通行要求的 `properties` 或 `required` 里出现的第一个），没有则记最后写入的信号。

一次改动之后连着自动走，走到某个本次已经进入过的状态（出发时所在的状态也算），就停在它前面；自动走的自环因此永远不会被走。

一次转换（模型的 `move`、人的推进）之后的第一条自动边，不会把流程直接带回这次转换刚离开的状态：人把流程从评审退回构建时，「构建 → 评审」的通行要求即使仍满足，流程也停在构建。只有刚离开的那个状态被挡，也只在这一次改动里挡：之后的下一次改动（例如测试重新跑绿）照常走这条边。回滚不算这样的转换。

通行要求对三种来源一视同仁。

**暂停。** 人暂停的工作项，证据照记（信号、过期、时钟都写进 journal），但任何转换都不走：模型的 `move` 被拒绝并记一条 `refused`，人的 `advance` 被拒绝，机器判的边等着；继续时以人的身份走此刻已满足的机器判的边（§5.5）。

**终态。** 进了标 `final` 的状态，工作项就关闭：没有出边，模型、人、自动都走不了；`tool` 证据不再过期；状态带显示 ✓ 加该状态的 `title`。闸照旧按这个状态声明的用途判——一集发布之后不该再动剧本，一条分支完成之后再改是新的改动；出路是换工作项（新分支、下一集），或者人 `rollback` 回到之前的修订。模型到不了终态，除非作者给了一条模型判的转换进去。`initial` 是单个状态：起点看情况（PR 已合并的分支一进来就该在评审）用一条机器判的出边表达，进入时事实一读到就自动走，journal 里也留下凭什么走的记录。

### 5.2 条件变量与信号

| `source` | 何时读 | 值 |
|---|---|---|
| 没有 | 模型调用 `set` | 模型写的值，类型须与默认值相同 |
| `{ "tool": "<用途>" }` | 绑到这个用途的一次工具调用结束时（怎么对上用途见下） | 成功 true，失败 false：命令看退出码，其他工具看 `isError` |
| `{ "file": "<glob>" }` | 写文件或运行命令的调用结束时（构建、渲染产生文件，和编辑一样确定；路径在项目之外或在 `.geml`、`.git`、`node_modules` 里时不算）、会话开始时、看板刷新时 | 有文件匹配时 true |
| `"committed"` `"pr-open"` `"pr-merged"` `"ci-success"` | 会话开始时、命令行在任一命令位置运行了 `git` 或 `gh` 的调用结束时（经启动器运行的如 `sudo git switch main`，交给 shell 的字符串里的如 `bash -c "git checkout -b x"` 也算；只当别的命令的参数写出来不算）、看板刷新时 | 按当前分支查询，见下 |
| `"human"` | 只来自人：看板上的勾选框，或在自己终端运行 `gemworks mark <变量>`（`gemworks unmark <变量>` 取消） | 勾上 true，取消 false |
| `{ "elapsed": "<ISO 8601 时长>" }` | 时钟：每次打开工作项时和每次写操作开始时，和 `tool` 证据的过期一起，持锁 | 从进入当前状态的修订到现在已满这个时长时 true；进入状态与回滚都把它还原成 false，重新计时 |

- **`tool` 证据会过期**：`source` 是 `tool` 的变量写下非默认值时，那条修订记下工作项内容的指纹（`tree`）。之后每次对该工作项的操作开始时（持锁），指纹若已变，就在一条修订里把这些变量还原成默认值（`cause=expire`），随后照常评估自动边。指纹：按分支的流程是检出里工作内容的 git tree（git 不忽略的每个已跟踪、未跟踪文件在磁盘上的样子，从 index 的副本算，真实的 index 不动；`.geml` 与 `node_modules` 不算）；按文件的流程是那个文件内容的哈希。所以测试通过之后改了代码、rebase、pull 都要重跑，只是提交了不用。`file` 与 git 的事实本来就按当下重读；`human` 是人的判断，不过期。
- **退出码怎么判定**（Claude Code）：调用以错误结束时 `isError` 为 true，`text` 以 `Exit code <n>` 开头，取这个 `n`；未以错误结束且结果里没有 `returnCodeInterpretation` 时退出码为 0。Claude Code 把少数非零码当作正常结束（`grep` 无匹配、`diff` 有差异），这类结果按非零处理，所以测试命令里 grep 没找到不会被当成通过。别的宿主怎么拿退出码见 §8。
- **调用怎么对上用途**：运行命令的工具，命令行拆成简单命令（跳过开头的 `NAME=value` 赋值），每条简单命令去掉引号与转义、把每段空白并成一个空格后，与词典里 `Bash(…)` 的键匹配：`*` 匹配任意一段文字；没有 `*` 的键匹配前缀，前缀止于词的边界（`Bash(npm test)` 匹配 `npm test -- --watch`，不匹配 `npm tests`）；`Bash()` 匹配所有命令；字面部分最长的键优先。写文件的工具按 `<工具>(<路径>)` 取键，词典里可以写 `Edit(docs/*)` 这样的行；其他工具按工具名匹配（可带 `*`）。匹配到的键绑着用途（`for`），这条调用就属于那个用途。只有命令行整个就是用 `&&` 连接的简单命令时，退出码才算数：命令行在引号之外含 `;`、`||`、管道、后台 `&`、换行、`$(`、`${`、`$[`、反引号、`(`、词首的 `#`，或引号没闭合、有空命令，就不写 `tool` 证据，因为退出码说明不了匹配到的那条命令；某条简单命令的命令字是 shell 关键字、会结束 shell 或改变后续命令含义的内建命令（`exit`、`exec`、`trap`、`eval`、`source` 等），或由展开拼出来时，也不写。**用途封路**则在整条命令行的任意位置查找，并在去掉引号和反斜杠、并好空白的副本里再查一遍，所以复合命令行里或包装器（`npx …`、`bash -c "…"`）里的部署照样被拒绝，`wran"gler"  deploy` 也一样。
- **PowerShell**：命令行是 PowerShell 的工具（DeepSeek Harness 的 `pwsh`）不按上面的 sh 规则读：不写 `tool` 证据，封路在原样的命令行和去掉反引号转义的副本里查找。
- **局限**：`tool` 证据的意思是「绑到这个用途的一条命令以 0 退出」，不是「测试套件通过了」：参数、环境和被改过的脚本都会改变命令实际运行的内容，所以词典里的键要写够长（`Bash(npm test)`，不是 `Bash(npm)`）。用途封路只看得见命令行的文字，区分大小写：变量、`eval`、编码后的字符串、模型自己写的脚本都能绕过它，所以脚本名也要一并守住；要真正拦住一条命令，得让 agent 手里没有执行它所需的凭据。
- 后台运行的命令（结果里有 `backgroundTaskId`）在调用结束时还没有退出码，不写 `tool` 证据。
- 子 agent 的工具调用同样经过主会话，它跑的测试照样记入信号——记进它所在检出的工作项（§5.7）。
- **git 与 CI 的事实**，按当前分支：`committed` 是这个分支有默认分支没有的提交，只问 git；`pr-open`、`pr-merged` 看以这个分支为 head 的最新一个 PR；`ci-success` 看分支所在提交上每个 CI workflow 最近一次运行，至少有一次、且每次都以 `success`、`skipped` 或 `neutral` 结束时为 true，还在跑的不算成功。`vars` 里有后三种来源时才问 `gh`（`GEMWORKS_GH` 可以指定程序）；没有 `gh`、没登录或没有可问的 GitHub remote 时，这三种变量不写入、保持原值，标为「不可用」，状态带说明原因：谁都确认不了的事实，从不当成 false。Claude Code 的 `Bash` 结果带 `gitOperation`（提交、推送、合并、PR 的创建与合并）时，git 的事实连同 `gh` 一起重读；不带时只重读 git 自己的事实，所以 `git status` 之类不会多问一次 `gh`。
- **人专属命令**：`gemworks mark`、`unmark`、`advance`、`pause`、`resume` 只能由人在自己终端运行。模型的命令行里在命令位置出现它们（经 `npx`、`npm exec`、`pnpm dlx` 等启动器、`bash -c "…"`、`eval` 的参数也算）一律被拒绝并记一条 `refused`；只是提到（`echo gemworks mark`、提交信息里写到）不拒绝。命令字由展开拼成或引号不闭合时，命令行里同时有 `gemworks` 和这五个词之一就拒绝。

### 5.3 工具：词典、询问与偏好

每一步能用哪些工具、同类工具里首选哪个、参数默认取什么，都不写进流程，记在项目的工具词典 `.geml/tools.geml` 里：一张 `#tools` 表，项目的所有流程共用，和流程一样留在本机，在使用中由人的选择长出来：

```geml
=== table {#tools}
| tool                        | for   | allow | deny | default | params |
|-----------------------------|-------|-------|------|---------|--------|
| Read                        |       | *     |      |         |        |
| Edit                        | edit  |       |      |         |        |
| Bash(npm test)              | test  |       |      | yes     |        |
| Bash(gh pr create)          | pr    |       |      |         |        |
| mcp__jimeng__generate_image | image |       |      | yes     | `{"ratio": "9:16", "model": "seedream-4.0"}` |
| mcp__flux__generate         | image |       |      |         | `{"steps": 28}` |
===
```

- `tool`：工具名，可带 `*`（`mcp__geml__*`）。一个工具一行，名字区分大小写；同名的第二行不算，并给一条警告。运行命令的工具按命令记（§5.2）。
- `for`：用途——流程在状态的 `tools` 或 `rules` 里声明的词；同一用途的工具互为替代。
- `allow`、`deny`：状态名的列表，`*` 表示所有状态。
- `default`：`yes` 表示同一用途里的首选，每个用途至多一个；一个用途登记的第一个工具自动成为首选。
- `params`：一个 JSON 对象：调用这个工具时，模型没给的参数用它补上。

**一次调用怎么判**（在调用所属工作项的当前状态 S 里，§5.7）：

1. 先判任何状态都生效的规则：人专属命令拒绝（§5.2）；只切换工作项的命令行放行（§5.7）；gemworks 自己的工具放行。
2. 取这次调用的键（§5.2）。
3. 每个键各判一次：绑着用途的键，S 声明了这个用途就放行；这个用途写在别的状态的 `rules` 里就拒绝（理由写明「deploy-prod 只在 #release 里用」）；其余用途照样放行，只是证据不在 S 里算数。没绑用途的键，那一行在 S 或 `*` 上拒绝就拒绝（理由写明「你在 #S 拒绝过它」），允许就放行；词典里没有这个键，也放行。
4. 有一个键被拒绝：整次调用拒绝，理由列出每个被拒的键，记一条 `refused`。
5. 否则放行，宿主自己的权限规则照常生效；调用结束时，绑着用途的键按变量的 `source` 写证据。

**偏好**：

- 阶段说明列出本阶段的工具：每个用途的首选和它的默认参数（§5.4）。模型一般照着用。
- 调用带 `params` 的工具时，模型没给的参数由 gemworks 补上（改写这次调用的输入），模型给了的不覆盖。只对输入是结构化数据的工具做（MCP 工具、内置工具），命令行不改写。
- 模型用了某个用途里不是首选的工具时问人：这次允许 / 以后默认用它 / 拒绝（让模型改用首选），选择写回词典。
- 绑定或解绑用途、改首选、加行，在看板的工具页上做，或者直接改 `tools.geml`。

**起步词典**：`gemworks init`、`/gemworks add` 复制内置流程时带上它的起步词典：`*` 行预先允许宿主的只读工具（`Read`、`Grep`、`Glob`）；流程声明的用途预先绑好常见的工具（§4.1）；要严格的流程预先写好拒绝（coding 流程在 `explore` 拒绝 `Edit`、`Write`）；其余工具照常运行。

**为什么由插件自己问**：插件借不到宿主的权限框——挂在宿主权限钩子上的回答在桌面会话里不被调用，auto 权限模式下宿主的权限提示由分类模型代答，人看不到；插件的问题框（`$.ui.ask`）总问到人，返回所选选项的原文，还能给出偏好需要的几个选项。没有问题框的宿主（各钩子宿主）不问：调用放行，模型收到一句说明，人在 `tools.geml` 里改。

### 5.4 Stagehand

Stagehand 分两层：核心只写文件，宿主负责把文件交给模型。

- **核心**：进入一个状态时（任一来源），取这个状态的 `description`，展开 `prompt` 指向的章节或整份文档（其中的 `embed` 在进程内展开；解析符号链接之后落在项目之外的文件从不读），后面加上要用的 skill、本阶段的用途与各自绑定的工具（首选与默认参数）、变量的当前值，和接下来能去的状态（每条出边：机器判的列出还缺的变量，一句话的给原文，要批准的标出，以及 `note`）。整段按字节计不超过 16 KB：`description`、skill、工具、变量与出边总在内，`prompt` 的内容分剩下的字节，放不下的只列出地址，模型需要时自己去取。
- 结果写进检出里的 `.geml/context.geml`：`=== text {#current}` 是这段说明；`=== data {#stage}` 是 `{"item", "state", "rev", "at"}`，`rev` 是进入这个阶段的修订；`=== data {#vars}` 是当前的变量值，同一阶段里的修订只重写它。`#vars` 是只读视图：`geml get .geml/context.geml '#vars["tests-pass"]'` 读一个值；写入只经动词和信号，因为 journal 只追加、带哈希链，每次写入都要过类型与「有来源的变量模型写不了」的规则。上下文文档按检出各一份，不进 git。
- **宿主**：Claude Code 把 `#current` 放进提示词和工具结果的上下文交给模型（§8.4），换了工作项时当场交接（§5.7）；钩子宿主在会话开始、提交提示词和阶段变化时交；没有注入通道的宿主由 skill 要求模型每轮先读 `.geml/context.geml`，`status` 也返回同一段。

### 5.5 journal

- 每个工作项一本 journal，单位由流程的 `flow-unit` 决定：
  - `branch`：路径 `.geml/journals/<分支名>.geml`，放在**仓库主工作树**里，所有检出共用：同一个分支在哪个检出里做都是同一本，worktree 删掉了记录也还在；这个目录自带一个内容为 `*` 的 `.gitignore`。当前在仓库默认分支上时引擎不工作，状态带显示「main · 不记录」。
  - `file:<glob>`：路径 `.geml/journals/<文件相对路径去掉扩展名>.geml`，按检出各一份；当前工作项是最近一次被写入的匹配文件，用户也可以在看板上切换；不依赖 git。
  - 不在 git 里的项目：项目根的 `.geml/journals/`。
  - 工作项 id 里的 `/` 成为子目录。
- journal 是一份普通的 GEML 文档，每条记录是一个追加写的 `data` 块：

```geml
=== data {#journal}
{ "item": "feat/rate-limit", "workflow": ".geml/workflows/dev.geml", "workflow-hash": "sha256:…", "created": "2026-10-12T09:00:00Z" }
===

=== data {#rev-0}
{ "rev": 0, "state": "build", "cause": "enter", "at": "2026-10-12T09:00:00Z",
  "vars": { "tests-pass": false, "pr-open": false }, "parent": null, "hash": "sha256:…" }
===

=== data {#rev-1}
{ "rev": 1, "state": "build", "cause": "patch", "by": "signal", "signal": "tests-pass", "call": "toolu_…",
  "tree": "tree:…", "at": "…", "vars": { "tests-pass": true, "pr-open": false }, "parent": "sha256:…", "hash": "sha256:…" }
===

=== data {#refused-1}
{ "rev": 1, "at": "…", "tool": "Edit", "call": "toolu_…", "key": "Edit", "reason": "你在 #explore 拒绝过 Edit" }
===

=== data {#wrote-1}
{ "rev": 1, "at": "…", "tool": "Write", "path": "src/limit.ts", "call": "toolu_…" }
===
```

- 修订的字段：`cause` 是做了什么（`enter`、`transition`、`patch`、`rollback`、`expire`、`pause`、`resume`），`by` 是谁（`model`、`human`、`signal`），`signal` 是触发的信号变量，`from` 是转换前的状态，`restores` 是回滚恢复的修订，`call` 是触发它的工具调用，`tree` 是命令证据的内容指纹；`hash` 是这一块去掉 `hash` 之后规范 JSON 的 sha256，`parent` 是上一条修订的 `hash`。重排、删改任何一条修订都会断链；只有删掉末尾的一串块是链查不出来的，所以 journal 的尾部只和它所在的存储一样可信。
- `#refused-N` 是一次拒绝：记下它发生在哪个修订之后、被拒的工具、调用、理由，以及闸判的那个词典键或命令模式（`key`）。`#wrote-N` 是工作项写过的一个文件：哪个修订、何时、哪个工具、相对项目根的路径、哪次调用；每个文件每个阶段记一次。这两种块都在哈希链之外，不增加修订。
- 坐标能读到任何一个值：`geml get .geml/journals/feat/a.geml '#rev-3["vars"]["tests-pass"]'`。
- journal 盲追加：每一块自己完整，写的时候不必读文件。第一次在某个工作项上有 gemworks 事件时创建，`rev=0` 的修订 `cause=enter`；归到别的检出的观察只在真要记录时才建那本 journal。
- 工作项记住自己的流程：`#journal` 的 `workflow` 记着它开始时的流程文件，之后一直按它推进；新工作项用项目的默认流程（`.geml/project.geml` 的 meta `flow-workflow`）。那个流程文件不存在、journal 校验不过、或当前状态已不在流程里时，这个工作项上的每个操作都失败；出路是恢复流程文件，或把 journal 挪开从默认流程重新开始。
- 同一工作项的多次会话、多个会话追加到同一本，哈希链连续；写入持文件锁（`<journal>.lock`），拿不到锁时等待后重试，超时则这次写入失败并在状态带报错，不静默丢弃。
- 人用 `gemworks rollback <修订|checkpoint>` 回滚：恢复那个修订的状态与变量（`checkpoint` 是进入当前阶段的修订），不撤销已经发生的副作用。
- 人用 `gemworks pause` 暂停工作项（看板与状态带上也能按）：记一条 `cause=pause`、`by=human`、状态与变量不变的修订（§5.1）；`gemworks resume` 记一条 `resume` 修订。`#current` 不因暂停重写；模型从 `status` 的回答和被拒的 `move` 得知暂停。
- `gemworks verify` 校验一本 journal：链；`cause` 与 `from`、`restores` 一致；每次记录的转换都是状态机里的一条转换；`by=signal` 时 `signal` 是有来源的变量；`pause`、`resume` 是 `by=human`、保持状态与变量、暂停的是没暂停的工作项、继续的是暂停着的。

### 5.6 backlog

检出里的 `.geml/backlog.geml` 是一张表：

```geml
=== table {#backlog}
| id          | title                  | branch           |
|-------------|------------------------|------------------|
| rate-limit  | 登录接口加限流          | feat/rate-limit  |
| dark-mode   | 设置页支持深色模式      |                  |
===
```

`branch` 列为空即待办；按文件的流程用 `file` 列代替 `branch` 列。某个工作项第一次创建 journal 时，若有待办项，看板提示把其中一项绑定到它；也可以在看板上手动绑定。已绑定项的进度从对应 journal 读出，表里不重复存状态。

绑定只改那一行的 `branch`（或 `file`）单元格，文档里的其余字节——别的列和它们的对齐、别的行、正文、meta、别的块、换行符——原样保留。`id` 为空的行读表时报诊断，也不能被绑定；`id` 重复的行同样不能；已绑定到别处的行不能改绑。

### 5.7 工作项的边界：岔出去再回来

做 A 的途中常会插进一件无关的事：agent 顺手发现 B 文档没修订、C 有个 bug，用户要 rebase、开 PR。做完要回到 A 原来的状态，并且 A 的状态与变量不被那件事改动。gemworks 以工作项为隔离单位，每个工作项一本 journal、一份变量；那件事落在另一个工作项上（另一个分支、另一个检出、另一集），就回得来、不串。本节的规则保证每次调用归到它真正作用的工作项上。

**调用从哪里开始、每条命令在哪里跑。** 宿主报告每次调用的起始目录（Claude Code：钩子里读 `$.session.cwd()`，按发起调用的循环作答，§12）。每条简单命令的目录是起始目录，加上 `&&` 链里它之前的 `cd`、`pushd`、`chdir`；目标写不定（含 `$`、`~`、反引号，`-`，缺省）时目录未知。写文件的工具按目标文件所在的目录。目录属于哪个检出，看它的 git 顶层。

**记录从准。** 信号只写进确定归属的工作项：

| 调用落在 | 记进 |
|---|---|
| 会话的检出（含其子目录） | 会话当前的工作项 |
| 另一个检出，它有流程、有活跃的工作项 | 那个检出的当前工作项（它的分支、它那份流程） |
| 别处，或目录未知 | 不写信号 |

**拦截从严。** 人专属命令在哪里跑都拒；journal 与上下文文档的写入在哪里都拒。写文件的工具按目标文件所属工作项的闸。命令只有在整行每条命令都确定落在同一个、有活跃工作项的另一个检出里时，才用那个工作项的闸；其余情况（别处、目录未知、混合、对方工作项不活跃、流程载入失败）一律按会话当前工作项的闸——命令从哪里开始跑不等于它作用在哪里，`cd /tmp && rm -rf <项目>/src` 照样被拒。

**重读事实跟会话走。** git 事实重读、文件来源重读，在调用不确定属于另一个检出时作用于会话的工作项：重读的是真实事实，总是对的。文件信号的遍历不进入嵌套的检出（含 `.git` 的目录）。另一个检出用它自己的 `.geml/` 找流程，`GEMWORKS_STATECHART` 只指定会话的流程。

**动词。** 调用方循环的目录确定落在另一个检出（有活跃工作项）时，动词作用于那个检出的工作项——隔离 worktree 里的子 agent 推进的是它自己的分支；否则作用于会话的工作项。

**按文件的流程。** `tool` 证据与闸都跟随命令行写到的那个文件（恰好写到本检出的一个匹配文件）；写到不是本检出匹配文件的文件、通配或花括号时不记；一个文件都没写时归当前那个文件。

**换工作项当场交接。** 一次应答所在的工作项，与上次交给主循环的上下文（`item@rev` 记号）不是同一个时，新工作项的阶段说明随这次工具结果交给模型，前面加一行：

```
[gemworks] now on fix/doc-b · #build (new work item)
[gemworks] back on feat/a · #build · rev 3 · tests ✓ · pr ✗
```

子 agent 的调用拿到它自己工作项的说明，不记为已交给主循环。

**每个工作项记住自己的流程**（§5.5）。`gemworks use` 只改项目的默认流程，已开始的工作项不受影响；所以岔出去的那件事可以用另一种流程，回来时 A 仍按它的流程。当前工作项按默认流程的单位解析。

**只切换工作项的命令行在任何状态都放行**：不拒、不问，在工具词典之前判（§5.3），监督器和快路径用同一个函数。`&&` 链里每条简单命令都是下列之一：`git switch <分支>`、`git switch -c|-C|--create|--force-create <分支> [<起点>]`；`git checkout -b|-B <分支> [<起点>]`，`git checkout <分支>`（`<分支>` 是已有的本地分支时）；`git worktree add [-b|-B <分支>] [--detach] <路径> [<起点>]`；`cd <路径>`。带其他选项（`-f`、`--force`、`--discard-changes`、`--merge`、`--`、路径参数）的不算。所以即使在某个阶段拒绝过 `Bash(git)`，也总能离开去做别的事。`git switch` 会把未提交的改动带过去，这是 git 的行为。拒绝的理由里提示这个出口。

**引导。** 内置流程的提示词与 `skills/gemworks-mcp/SKILL.md` 写明：和当前工作项无关的改动，另开分支或 worktree 做（子 agent 可用隔离 worktree），做完切回来。

**局限。** 目录按命令文字判断：变量、脚本，`npm --prefix`、`git -C` 这类参数里的目录都不跟踪；经符号链接的路径，快路径与 CLI 的判断可能不一致。

**不做。**
- 每次用户输入先判断「属于当前流程还是新流程」：插进来的事一半是 agent 途中发现的，用户输入时判断不到；判断本身不隔离，隔离靠活落在哪里；它是模型判断，违背凭事实推进；每次多一次模型调用，只接 MCP 的宿主也没有输入钩子。
- 显式的「岔出去 / 回来」动词：在会话的检出、会话的分支上顺手做的事，观察到的就是这个工作项自己的事实，记在它名下是对的；那种情况下的「污染」是 PR 混进无关改动，属于 git 与评审，靠引导解决。

**还没做：两种单位的流程同时推进。** dev 走 feat/A 的同时 video 走 ep02：各流程按自己的单位解析当前工作项，观察按匹配到的信号表分发，状态带并列显示——状态图里的正交区域。「每个工作项记住自己的流程」是它的前提。

## 6. 代码的组成

| 目录 | 是什么 |
|---|---|
| `src/core/` | 宿主无关的纯模块：状态图、监督器、信号、日志、工具词典、工作项、做法、规定、提议、纠正账本、会话记录，以及 GEML 看板页、验收单页这些页面。只用 `node:crypto` 算哈希 |
| `src/` 根目录 | Node 一侧：`bridge.ts`（插件经命令行发来的请求）、`workspace.ts`（加锁执行一次操作）、`host-git.ts`（git 与 gh 的事实）、`host-fs.ts`（锁、原子写、glob）、`loop.ts`（Node 宿主上的工作循环工具和规定检查）、`mcp.ts`、`cli.ts`、`project.ts` 与 `project-home.ts`（项目、流程文件、旧布局迁移） |
| `src/store/` | 落盘：产物、GEML 看板文件、纠正账本、工具词典、Claude Code 记忆、项目大纲、做法、会话记录、验收单 |
| `src/hosts/claude-code/` | Claude Code 插件的纯部分：状态带、看板各页的行、文案表、协议、快路径。看板行、快路径和协议别的宿主也在用 |
| `hooks/` | 插件模块本身：`register.tsx`（钩子与渲染）、`act.tsx`（按钮动作）、`manual.tsx`（流程页的做法与步骤块）、`outward.tsx`（外发操作问询）。它从 `dist/` 导入编译好的纯模块 |
| `src/hosts/<宿主>/` | 其他宿主的适配器。有钩子的宿主是 `adapter.ts`（读写、起进程）加 `hook.ts`（纯的事件读取器）；Devin、Kiro、OpenCode、Qwen Code、TRAE 共用 `src/hosts/hooked.ts`；`dsh/`、`pi/` 是进程内加载的两家 |
| `coach/`、`workflows/` | 内置流程（§7） |
| `skills/`、`host-skills/` | Claude Code 读的技能；只读一个目录的宿主读的技能，geml 插件的两个技能也在这里 |
| `test/` | node:test 测试，目录跟着 `src/` 走（§9） |

**两份构建产物。** `tsc` 编出 `dist/`：npm 的 `gemworks`、`gwx` 命令是 `dist/cli.js`，库入口是 `dist/index.js`，插件模块逐个导入 `dist/` 下的纯模块。`scripts/bundle.mjs` 再用 esbuild 打出 `dist/gemworks.mjs`：插件的 bridge 和各宿主的钩子都跑它，`@geml/geml` 内联，按块切开，每块不超过 256 KiB。

**不能挪的路径。** `dist/gemworks.mjs` 的绝对路径会被各宿主的 install 写进用户机器上的配置，所以它永远不改名、不挪位置；`dist/cli.js`、`dist/index.js`、`dist/hosts/dsh/plugin.js`、`dist/hosts/pi/extension.js` 是包对外的入口，同样不动。四份宿主清单的目录（`.claude-plugin`、`.codex-plugin`、`.antigravity-plugin`、`.agents/plugins`）和 Antigravity 读的 `hooks.json`、`mcp_config.json` 都在根目录。

**纯与写状态的分界。** `src/core/` 是纯的；写盘的是 `src/` 根目录的 bridge、workspace、host-git、host-fs，`src/store/`，以及各宿主适配器。插件模块运行在没有 Node 的环境里：journal、工具词典、上下文文档、backlog、产物表要加锁写，经 bridge 交给 Node 一侧；会话记录、提议、规定、项目自己的起步流程这些整份读写的文件，它用引擎的文件接口自己写。渲染钩子是纯的，只读状态，不写。

## 7. 内置流程

gemworks 带两组流程：`coach/` 里的十条起步流程（§7.5），和 `workflows/` 里的四个固化流程模板——开发（`dev`）、视频（`video`）、事项（`matter`）、编码（`coding`）。固化流程模板由 `gemworks init --template <名字>`（不写时是 `coding`）或 `/gemworks add <名字>` 装进项目的 `.geml/workflows/<名字>.geml`，它的起步词典同时并进 `.geml/tools.geml`。项目还没有固化流程时，`/gemworks` 按项目的样子建议一个：有 `episodes/` 目录或 geml-media 文档建议视频，有部署配置建议开发，有构建清单建议编码，都没有建议开发。

### 7.1 开发流程

`flow-unit = "branch"`。§4.1 即其全文结构：`build → review → deploy → release → done`，五个状态，只在顺序真正要紧处设状态（编辑和测试反复交替，不值得两个状态）。

| 封路点 | 机制 |
|---|---|
| 合并且 CI 通过前不能部署 | `deploy-staging` 写在 `deploy` 的 `rules` 里，`deploy-prod` 写在 `release` 的 `rules` 里；进 `deploy` 的通行要求是 `pr-merged` 且 `ci-pass` |
| production 要人点头 | 进 `release` 的转换 `approval: true`，通行要求是 staging 已部署 |

写代码、测试、开 PR 在哪一步都能做。测试证据随工作内容过期：测完又改了代码就要重跑。

### 7.2 视频流程

`flow-unit = "file:episodes/*.geml"`：每一集的 `.geml` 文件是一个工作项，不依赖 git。建立在 geml-media 上：剧本是 `media-text`，剪辑是 `media` 时间线。一集只占一个文件：本集的素材块与生成日志也写在里面，几集共用的角色卡、配音样本放在别的文档，用 `speaker=`、`of=` 引用。引用是有方向的，`geml media todo` 从本集出发，只看得见它够得着的生成记录。

```
script ─→ assets ─→ cut ─→ render ─→ review ─→ publish ─→ done
              ↑        ↑ ↑       │          │
              │        │ └───────┘ fix-cut  │
              │        └────── recut ───────┤
              └───────── reshoot ───────────┘
```

```json
"vars": {
  "script-final": { "default": false, "source": "human", "note": "剧本定稿" },
  "assets-done":  { "default": false, "source": { "tool": "todo-check" } },
  "no-stale":     { "default": false, "source": { "tool": "stale-check" } },
  "rendered":     { "default": false, "source": { "tool": "render" } },
  "approved":     { "default": false, "source": "human", "note": "审片通过" },
  "published":    { "default": false, "source": "human", "note": "已发布" }
}
```

用途都写在 `rules` 里，各自封在自己那一步：`assets` 是 `image`、`video`、`voice`、`import`、`log`、`todo-check`，`cut` 是 `lay`、`stale-check`，`render` 是 `render`。

起步词典绑好命令类的用途：`todo-check` 绑 `geml media todo*--check`，`stale-check` 绑 `geml check*--severity media-stale-clip=error`，`render` 绑 `geml media build*--out`，`import`、`log`、`lay` 绑各自的 `geml media` 子命令；`geml` 前面的 `npx`、`bunx`、`pnpm dlx`、`yarn dlx`、`npm exec` 启动器各一行。生图、生视频、配音工具在使用中登记。信号与闸跟随命令行写到的那一集（§5.7），所以流程的提示词要求每条命令都写本集的文件并带 `--root .`。三个 `tool` 证据随这一集文件的内容过期：文件改了，待办检查、过期检查与出片都要重新过。

| 边 | 怎么走 |
|---|---|
| `script→assets` | 自动，剧本定稿 |
| `assets→cut` | 自动，`geml media todo --check` 通过 |
| `cut→render` | 自动，`geml check` 没有过期片段 |
| `render→review` | 自动，出片成功 |
| `render→cut` | 模型或人（出片失败、要改剪辑）；`reset` 清掉 `no-stale` |
| `review→assets`、`review→cut` | 模型或人（要重出镜头、要改剪辑）；前者清掉 `assets-done`、`no-stale`、`rendered`，后者清掉 `no-stale`、`rendered` |
| `review→publish` | 自动，审片通过 |
| `publish→done` | 自动，已发布 |

- **封路**：生成素材只能在 `assets`，排时间线只能在 `cut`，出片只能在 `render`；进 `render` 要求没有过期片段，所以改了提示词却没重新生成素材，就出不了片。出片命令在别处被拒绝，`bash -c "…"` 里的、去掉引号之后的照样被拒；它只看文字，`bun`、`tsx` 之类别的启动器、变量与脚本都能绕过它。
- 三个 `human` 来源的变量只能由人勾选。
- 六个非终态的 `prompt` 各指流程文件里的一节：`script` 写台词与分镜、一集一个文件；`assets` 生成与登记（`geml media todo`、`geml media import`、`geml media log`）；`cut` 时间线与对齐（`geml media lay`）；`render` 出片选项与出片失败；`review` 审片与返工；`publish` 发布。
- 生图、生视频、配音工具的首选与默认参数记在工具词典里（§5.3）：同一部剧的画幅比例、模型这类参数写成默认参数，全剧一致。
- **返工**走 `review→assets`、`review→cut`，出片失败走 `render→cut`：这三条转换用 `reset`（§4.2）把上一轮的证据清回默认值，待办检查、过期检查与出片都要重新过一遍，新片也要人重新审。`review` 里 `approved` 总是 false（勾上它流程就离开了 `review`），不必复位。
- **状态带上的待办数**：工作项的文件声明了 geml-media 时，bridge 在刷新和读看板时用解析器的 `todo` 在进程内数出待办，经的是解析器同一个受限的文件宿主，所以与 `geml media todo <本集文件> --root . --json` 列出的条数相同；数随应答带回，带着数的时候所在的状态，状态带只在那个工作项、仍在那个状态时显示（`待办 7 项`，999 以上显示 `待办 999+ 项`）。数待办要给本集够得着的每个素材文件算哈希，所以别的请求不数；读文件前看一眼时限（10 秒），超时、出错或文件读不到时没有数，状态带不显示，不当成「无待办」。它只用于显示，不进信号。
- **还没做：库文档布局。** 素材块与生成日志放在几集共用的库文档里时，是库引用剧本、剧本不引用库，从本集出发的 `geml media todo` 看不见那些生成记录，待办永远清不掉；交一个目录给它，又会把别的集的待办算进来。要支持这种布局，`todo` 需要一个「从本集出发、连同引用了本集的库文档」的入口，过期检查也一样。在那之前，规则是一集一个文件。

### 7.3 事项流程

`flow-unit = "file:.geml/matters/*.geml"`、`flow-state-key = "state"`：每件事一个文件，工作项的状态写回那个文件 meta 的 `state`。适合「查清楚、出方案、人定了再做」的活：

| 状态 | 做什么 |
|---|---|
| `noted` 记下 | 把现象和证据写进事项；查明原因后写出方案，交给人定 |
| `deciding` 待你定 | 方案在事项里，等人选。只回答问题、补事项，不改别的文件 |
| `doing` 实施 | 按人选的方案改，改完跑一次检查 |
| `checking` 待验收 | 结果在事项的 `#result` 一节，等人验收；不再改别的文件 |
| `parked` 搁置 | 先放着，人随时可以重新打开 |
| `done` 完成 | 终态 |

每个非终态都把 `note`（写事项文件）放在 `rules` 里；`doing` 另把 `edit`、`check` 放进 `rules`，所以改别的文件、跑检查只能在实施这一步。`noted→deciding` 由模型走；`doing→checking` 在检查通过（`check-pass`）时自动走；其余转换都要人按，按钮上的字是各自的 `label`：直接做、先放着、按方案做、换个方向、通过、要改、重新打开。

### 7.4 编码流程

`flow-unit = "branch"`。`explore → plan → implement → verify → review → done`，读法是四句话：

1. 写下计划之前不能改文件：`edit` 只写在 `implement` 的 `rules` 里，起步词典还在 `explore` 拒绝 `Edit`、`Write`；进 `plan`、`implement` 要模型先写下 `goal`、`touched`、`plan`、`command` 四个变量（一句话的通行要求，由模型判）。
2. 改文件的时候不能跑那条命令：`test` 只写在 `verify` 的 `rules` 里。
3. 没有记录在案的测试结果不能说做完：`verify→review` 要 `tests-pass`，它的来源是 `test` 用途的退出码。
4. 最后一步是人的：`review→done` 要人此刻点头。

`verify→implement`、`review→implement` 把 `tests-pass` 清回 false。

### 7.5 起步流程

十条起步流程，每一步写着谁判、要求什么、防什么坑：

| 流程 | 步骤（谁判） |
|---|---|
| 新设计 `design` | 讨论（人）→ 出样稿 → 你点头（人） |
| 新功能 `feature` | 样稿（人）→ 实现 → 验证（事实）→ 你确认（人） |
| bugfix | 复现 → 找根因 → 先写会失败的测试 → 修 → 验证（事实）→ 你确认（人） |
| 优化 `optimize` | 测基线（事实）→ 改 → 复测（事实）→ 你确认（人） |
| 线上事故 `incident` | 定级 → 止血 → 确认恢复（人）→ 复盘 → 跟进 |
| 代码审查 `review` | 看全貌 → 先审主体 → 看其余 → 写意见 → 批准（人） |
| 调研选型 `research` | 问清目标（人）→ 列方案 → 小实验 → 你拍板（人）→ 记下决定 |
| 重构 `refactor` | 先有测试（事实）→ 小步改 → 行为没变（事实）→ 你确认（人） |
| 文档 `docs` | 定类型 → 写 → 照着做一遍 → 你确认（人） |
| 数据分析 `analysis` | 问清口径（人）→ 看数据 → 写查询 → 对数 → 你确认（人） |

没标的步由模型判。起步流程也是 `geml-statechart` 文档，每个状态多几个属性：`judge`（`fact`、`you` 或 `model`）、`prevents`（这一步防什么坑）、`answers`（人判的步上两个按钮的字），`expires`（工作一变就要重新满足）。项目可以改：`.geml/coach/<名字>.geml` 是项目自己的版本，仓库的 `.gemworks/flows/<名字>.geml` 是团队的，都没有时用内置的；项目还可以加自己的流程。

**工作循环。**

- **工作项**：模型每轮结束前用 `work` 报告这一轮做的工作项——哪条流程、满足了哪几步、还差什么、接下来做什么、最后要成什么样；进度从满足的步推出，所以可以跳步。事实判的步要附上跑过的命令和结果，人判的步要附上人自己的原话（不然留给人在状态带或看板上按）。一轮里动了文件却没报，回合结束时退回模型一次。工作项记在会话记录里，每个会话、每个宿主读同一份。
- **做法**：只提醒、不拦。模型用 `practice` 把「这样做能避开刚才那个坑」记成一条做法，挂在某条流程的某一步上；做到那一步时，它随提示词交给模型。分三层：个人的（`~/.gemworks/practices.geml`）跟着人到每个项目，项目的（`.geml/practices.geml`）只管这个项目，团队的（`.gemworks/practices.geml`）只经「分享给团队」写入、由人提交。
- **规定**：人在流程页把一条做法「改成规定」，模型用 `rule` 把它写成一条：一个工具键加一个要先满足的步。之后那一步没满足时，匹配的调用被拦下，有调用前钩子的宿主都拦（Antigravity 没有这种钩子）。规定文件只有人能改，模型写它的调用一律被拒。
- **提议**：模型用 `propose` 提议给某条流程加一步，或建一类新的活；某条流程最近 5 件完成的工作项里有 4 件跳过了同一步，gemworks 提议删掉它；没有流程可挂的一类活 7 天里被纠正 10 次以上，提议为它建一条流程。都要人同意才改。
- **纠正账本**：一个小模型给人打的每条提示词打标——任务、拍板、纠正、问进度、催、告知、打断；纠正再分九类加「其他」，六类是某一步的检查能接住的，三类要人自己判断。说同一件事的纠正归成一个主题，主题关联到说这件事的做法，账本记下每条做法之后还被纠正了几次，流程页上画成卡片。账本是个人的（`~/.gemworks/corrections.geml`），跨项目。Claude Code 用宿主的模型打标，Pi 用会话自己的模型；在设置里可以关掉，关掉后不再读提示词。
- **验收单**：每个工作项一张，写着每一步谁判、凭什么、什么时候（`.geml/signoffs/<id>.geml`）。
- **参考与分享**：别的项目的 `.gemworks/` 或导出的流程文件可以导入当参考，和本项目流程不同的步骤变成提议；一条流程连同它的做法、规定可以分享给团队，写进 `.gemworks/`。

## 8. 各宿主的界面

| 宿主 | 人看到的 | 节 |
|---|---|---|
| Claude Code | 输入框上方的状态带、右边的看板面板、对话框 | §8.1–§8.7 |
| Codex | GEML 看板文件 | §8.9、§8.13 |
| DeepSeek Harness | 网页右侧栏里的看板 | §8.10 |
| Cursor、Qwen Code、OpenCode、Devin、TRAE、Kiro、Antigravity | GEML 看板文件 | §8.11、§8.13 |
| Pi | 编辑框上方几行状态、`/gemworks` 打开的看板 | §8.12 |
| 其他接 MCP 的宿主 | GEML 看板文件 | §8.5、§8.13 |

### 8.1 状态带（AbovePrompt）

终端与桌面 app 都画（`AbovePrompt` 只在这两处出现），两处文字相同；桌面上按钮是原生按钮，终端上是 `[ 标签 ]`，按钮从左到右配数字快捷键（状态带持有焦点时生效，空输入框里的裸数字也行）。

- **行首是 gemworks 的标**：桌面上画棱镜 V 形标（青紫两色的 Svg，按它打开看板），终端没有 Svg，画一个紫色的 `»`。
- **中间是此刻轮到人的一件事**：一个动词、它的名字、几个淡色的字，后面至多三个选项按钮（主选项在前），再后面是「还有 N 件」，悬停时在这一行的位置上整条显示。轮到哪一件，按这个次序取：
  1. 宿主的问卷占着这一行时让给问卷；
  2. 桥接坏了、装得不对：一行原因，后面「重试」；bundle 没有构建时带上该跑的构建命令；
  3. 刚判出的打字回答（`判定`）：人打的话被读成了哪个选项，可以撤回；或者它在问什么；
  4. 要人做的事（`attention.ts`）：上一轮用 `ask` 留下的问题和它的选项、工作项走到了人判的一步（选项是那一步的按钮字，默认「好了」「没好」）、出了错的事；
  5. 固化流程里等人的事：要批准的转换、要勾的变量、被拦的工具；暂停时是「已暂停 · 阶段不变，照常记录」和「继续」；
  6. 都没有时是「我在做」：这个会话正在做的工作项和它走到的那一步；固化流程下是阶段名（红色），视频流程再加待办数（§7.2）；什么都没有时写「空闲」。
- **初始化**：第一次启动时后台读项目以前的会话，期间显示「正在了解这个项目以前的会话（n/N），只存在本机 .geml/ 目录」，读完显示一次「初始化完毕」。
- **行尾**：今天新学到的做法、等着人答的提议（按一下到流程页看），再后面是截图按钮（桌面端调起系统区域截图，并提示用哪个键粘贴）和看板按钮。
- 文字与按钮由纯函数算出（`band.ts` 的 `bandView`、`attention.ts`、`coach.ts` 的 `coachBand`），插件模块只用各界面都有的 `Box`、`Text`、`Button` 排版，桌面上另用 `Svg` 画标；按钮的宽度先从文字里扣掉，文字放不下的那一段截断加 `…`。画不出来时画一行原因，不留空白。

### 8.2 看板（Pane）与对话框

面板顶部常驻一行：标、名字、版本（有新版本时标出），右侧是分享、设置、升级、关于四个图标按钮。下面五个页签是一排按钮，顺序：**会话 → 工作项 → 产物 → 流程 → 工具**，打开时在工作项。

| 页签 | 内容 | 操作 |
|---|---|---|
| 会话 | 这个项目的所有会话（各宿主的都在），本会话每一轮问了什么、做了什么、调了几次工具、被拒几次；别的会话；项目的 Claude Code 记忆；各会话定下的事 | 展开一轮看它的回答；「整理」：勾选几轮，拆成新会话或删除（可以连同之后的），交给模型用随附的 split-session 技能去做，原会话先备份；导出会话；改记忆的提示语、删记忆（进 `~/.gemworks/trash/`） |
| 工作项 | 顶部是等人的事；在走的工作项按轮到谁分组，每项一排步骤格子（满足的、跳过的、站着的那一步）、还差什么、接下来做什么；完成和放弃的折叠起来；暂缓的分支和 PR；工具和 CI 的建议；有固化流程时，它的工作项和 backlog | 人判的步：好了 / 没好（或那一步自己的按钮字）；继续、搁置、关闭；按文件的流程「切过去」；把待办项绑到当前工作项；按工作项的箭头到流程页看它 |
| 产物 | 项目的全部产物：发布的链接、在 git 里改过的文档、git 不留的文件的副本；按天、按类、按工作项看，分页 | 打开、看某一版的副本和历史 |
| 流程 | 起步流程的手册：每条流程的每一步谁判、要求什么、防什么坑，挂在步上的做法、规定和提议，纠正账本的卡片；下面一节是固化流程：状态图、各状态的用途、人勾的变量、时钟 | 「添加一类活 ▾」：加起步流程或固化流程模板、从路径导入、导入参考；答提议；做法改成规定、改层、分享给团队、写进 CLAUDE.md；导出流程；固化流程上人可走的边是按钮，人勾的变量能勾 |
| 工具 | 每个工具按天的用量，按类分组；词典里的行；放行过的外发操作 | 搜索；给新用途命名；撤销一条放行；有固化流程时：设为首选、在 #状态 也允许、加一行「工具 \| 用途」 |

看板上的操作都经桥接执行，执行完重读看板；操作被拒时弹一条提示说明原因。`/gemworks board [页签]` 打开它。桌面面板的元素一多就会失灵，所以每页都控制元素数（`budget.ts`），长列表分页。

**对话框**（同一个面板 `gemworks-dialog`，Esc 关闭）：

- 设置：语言（跟随系统 / 中文 / English / 日本語）；状态带：打字回答（让小模型把打的话读成按钮）；学习：从纠正里提议做法和流程步骤；桌面提醒（§8.6）。设置存在插件自己的 store 里，跨会话。
- 升级：当前版本、npm 上的最新版本（可以再查一次）、更新要运行的命令、这一版有什么（读 CHANGELOG）。
- 关于：一句话、插件与解析器的版本、许可、文档与仓库链接。
- 分享：分享什么（现在在哪 / 一条流程，连同它的做法与规定 / 本会话 / 固化流程一个工作项的记录）× 怎么给（复制一段文字 / 写成文件 / PR 评论），「去掉命令行里的绝对路径」开关，下面是预览。文件写到 `.geml/exports/`；PR 评论跑 `gh pr comment --body`。

**流程页的图**：`geml-statechart` 是数据，图是它的投影，所以图从模型画，不从 SVG 画。解析器的渲染器给出拓扑（`flowOf`：状态按层、每条边是顺行、跨层/回头还是自环，没有像素）、几何（`layoutOf`）和画好的 SVG；`core/picture.ts` 把运行时叠上去：当前阶段、当前阶段每条机器判的出边的通行要求是否满足、每个阶段里的工作项数、暂停、刚走过的那条边、现在可走的边。插件模块在每个界面上都用面板自己的元素画它：一层一行带边框的状态盒子（当前态强调色、终点双线框、角标），盒子下面一行一条出边，可走的边是带数字热键的真 `Button`，刚走过的边成功色，要批准的边警告色，其余灰字并给机器判的条件标 ✓ / ✗。`Svg` 元素是隔离的叶子，点击传不回插件，所以面板上不用它画图；DeepSeek Harness 的网页看板把同一份 SVG 内联进页面，图上可走的边本身能点。

### 8.3 `/gemworks` 命令

`/gemworks`（当前工作项、阶段、信号、下一步、拒绝计数，暂停时标出）、`/gemworks board [sessions|items|made|flow|tools]`（打开看板停在那一页，`artifacts` 等于 `made`）、`/gemworks pause`、`/gemworks resume`、`/gemworks use <流程>`（切换项目的默认固化流程：之后新开的工作项用它，已开始的按各自的流程继续）、`/gemworks add [流程]`（不带参数列出内置的固化流程模板，带名字时装进项目）、`/gemworks trace on|off`（打开或关掉诊断记录，写进 `.geml/trace.log` 和对话）。项目还没有固化流程时，`/gemworks` 的回答里带上按项目样子建议的那一个（§7）。其他参数回一段用法。

### 8.4 插件模块接线

插件模块运行在没有 Node、没有 DOM 的环境里，`$.fs` 只能整份读写，不能追加、改名或加锁。要加锁写的文件（journal、上下文文档、backlog、工具词典、产物表）只由 Node 一侧写；两侧之间是一座桥：`node <插件目录>/dist/gemworks.mjs hook`，stdin 一个 JSON 请求，stdout 一行 JSON 应答，不论应答说什么退出码都是 0。请求按用途分三组：固化流程的（`status`、`refresh`、`before`、`after`、`verb`、`learn`、`mark`、`advance`、`pause`、`resume`、`rollback`、`bind`、`new-item`、`use`、`add`、`import`、`board`、`export`）；工作循环与记录的（`practices`、`practice-add`、`practice-set`、`practice-share`、`corrections` 及 `corrections-add`、`-check`、`-dismiss`、`-themes`，`artifacts`、`artifact`、`made`、`signoff`、`backfill-list`、`backfill-one`、`turn-ids`、`memory`、`memory-set`、`memory-delete`）；状态带的（`attention`、`outward`）。CLI 每个请求都重新打开工作区，请求只带调用的命令与路径，不带文件内容。请求与应答的类型只在不依赖 Node 的 `src/hosts/claude-code/protocol.ts` 里定义一次。`before`、`after` 与 `verb` 请求带上这次调用的起始目录，CLI 按 §5.7 归属。

- **快路径**：每个应答都带一份状态与策略快照（读一遍 journal 与工具词典得出）。调用前由纯函数（`fastpath.ts`）判断：人专属命令与封路用途的命令请 CLI 记录并拒绝；只切换工作项的命令行放行；其余按 §5.3，全部能当场判定的不起子进程；模型没用首选时用 `$.ui.ask` 问人，答案经 `learn` 写进词典；带默认参数的工具，插件模块补上缺的参数。读命令行用的是监督器自己的扫描函数（`src/core/command-line.ts`），快路径与 CLI 判断得完全一样，`test/claude-code/fastpath-parity.test.mjs` 对着工作区钉住这一点。调用后只在会改变状态、策略或 journal 时起 `after`。调用可能落在别的检出时快路径不按会话的策略放行，交给 CLI 定夺。
- **git 信号**在会话开始、看板打开与刷新、结果带 `gitOperation` 的调用之后重读，连同 `gh`；命令行运行了 `git` 或 `gh` 而结果不带 `gitOperation` 时只重读 git 自己的事实。
- **上下文**：阶段变了，新的 `#current` 放进这次工具结果的 `context`；主线程的调用记下已交给模型的 `item@rev`，子 agent 的不记。`prompt.submit` 时 `item@rev` 与已交的不同、且是当前工作项，把 `#current` 放进 `context`。换了工作项时连同交接行（§5.7）。
- **失败放行**：Node 缺失、桥接失败或超时（每次 15 秒；`refresh`、`board`、`use`、`add` 45 秒）、应答无法解析时，调用照常执行、什么都不记，状态带显示原因；任何决定两秒内定不下来就放行。会话开始时没找到 Node，之后的工具调用、提交或 `/gemworks` 时再找；找到了却没拿到应答，至多一分钟重试一次。每个会拦截的钩子都带 `.catch`：钩子自己出错时调用照常执行。Node 的候选依次是 PATH 上的 `node`、shell 找到的、各安装器的默认位置，每个探测 10 秒，第一个主版本 ≥ 22 的就是。

| 事件 | 做什么 |
|---|---|
| `session.start` | 注册十个模型工具与 `/gemworks`（没注册上的记下来由状态带显示）；读设置与上次留下的状态；找 Node，经桥接取一次状态，再在后台补齐 git 与文件信号、读看板、读做法与纠正账本、读项目的会话记录；项目第一次启动时开始初始化补录 |
| `session.attach`、`session.detach` | 记下正在驱动这个会话的客户端（桌面、经 Remote Control 的手机），给环境行用 |
| `session.end` | 清掉「已交给模型」的记号：`/clear` 之后的下一次提交重新带上阶段说明和常驻指令；存下用量 |
| `session.compact` | 主线程的压缩可能把常驻指令压掉，下一次提交重新带上 |
| `tool.call` | 一个处理所有调用的钩子：先查规定（`ruleHold`）和外发操作（`outward.tsx`），再走快路径与工具词典，补默认参数，调用后按需请 `after`，把新阶段的说明放进结果的 `context`；另有十个钩子各接一个 gemworks 自己的工具（`mcp__gemworks__status` 等） |
| `prompt.compose` | 往系统提示里加五段说明：多会话记录、`ask`、工作项、做法、提议 |
| `prompt.submit` | 记下这条提示词（会话页用）；在 `context` 里交给模型：阶段说明（变了时）、在走的工作项、当前步的做法、别的会话新定的事、工作循环的常驻指令；后台给这条提示词打标进纠正账本，判断它是不是在回答状态带上的问题 |
| `classic.Stop` | 一轮里动了文件却没报工作项时，退回模型一次，带上提醒 |
| `turn.complete` | 主线程一轮结束：回答的第一句记到这一轮的提示词上；收产物；刷新仓库事实；有新的等人的事时发桌面提醒 |
| `session.append`（`door: "prompt"`） | 宿主把人的提示词存成一行时，把这行的 `uuid` 记到会话页对应的那一轮上（之后定位、整理靠它） |
| `command.run` | `/gemworks` 各子命令（§8.3） |
| `ui.render` | 状态带（`AbovePrompt`）、看板（`Pane` `gemworks-board`）、对话框（`Pane` `gemworks-dialog`）；每个按钮的 `onPress` 走同一个 `act`（`actions.ts` 的动作联合，`hooks/act.tsx` 里每个动作一个分支） |

`prompt.submit` 的 `context` 与工具结果的 `context` 只给模型看，不显示给人。渲染钩子是纯的，只读状态。

### 8.5 模型工具（跨宿主共用）

| 工具 | 做什么 |
|---|---|
| `status`、`move`、`set` | 固化流程的三个动词：`status` 只读，给出工作项、阶段、变量、每条出边与通行要求是否满足，以及本阶段的说明；`move {to}` 走一条出边；`set {变量: 值, …}` 写模型自己的变量 |
| `note` | 记下这一轮的决定，项目的其他会话在下一条提示词旁看到 |
| `work` | 报告工作项（§7.5） |
| `practice` | 记一条做法 |
| `propose` | 提议加一步或一类新的活 |
| `ask` | 留一个问题和它的几个答案给人，在状态带上用按钮问 |
| `artifact` | 补记宿主自己看不见的产物：一个链接、生成的一张图或一个文件 |
| `answer` | 替人答一条提议（没有看板按钮的宿主才有） |
| `rule` | 人按了「改成规定」之后，把那条规定写下（只有 Claude Code 有） |

参数结构固定，不随状态变，免得提示缓存失效。Claude Code 里由插件在会话开始时用 `$.tool.register` 注册，模型看到的是 `mcp__gemworks__<名字>`；只接 MCP 的宿主经 `gemworks mcp` 看到同样的名字（宿主按服务名分命名空间）；DeepSeek Harness 与 Pi 注册为 `gemworks_<名字>`。它们是 gemworks 自己的工具，不经工具词典；动词自己的规则（通行要求、批准、变量类型）照样生效：模型对要批准的边调用 `move` 一律被拒绝并记一条 `refused`，回答里提示由人在看板上或用 `gemworks advance` 批准。人勾的变量与回滚不是模型的工具。

只接 MCP 的宿主用 `gemworks mcp [--host <宿主>] [--root <目录>]`（stdio MCP）。每次调用都重新打开工作区；打不开工作区、读不了 journal 都是一条错误结果，服务不会因此退出。改变了阶段的调用把新的 `#current` 附在结果后面。这类宿主不把自己的工具调用交给 gemworks，所以工具调用观察不到，`tool` 证据立不起来，工具词典与规定都不起作用；`git`、`file` 来源只在模型调用 `status` 时重读；通行要求要读 `tool` 证据的转换，只有同时接受一个人勾的变量时才走得了。技能 `skills/gemworks-mcp/SKILL.md` 要求这类宿主每轮先读 `.geml/context.geml#current`，推了代码、开了 PR 或写了阶段要的文件之后调用 `status`，不运行人专属命令。

### 8.6 提醒

桌面提醒走 `$.ui.notify`（用户自己的通知渠道），各有设置开关：状态带上出现了要人回答的问题（固化流程的批准也算）；工作项走到了要人确认的一步；工具被规定或固化流程拦下（同一原因几分钟内只提一次）；固化流程的阶段变化（默认关）；有新版本（在看板上说）。

### 8.7 设置与词条表

- 设置（§8.2 对话框）存在插件的 `$.store`（`settings`），`settings.ts` 读写：语言、各项提醒、打字回答、学习、诊断记录；缺的、类型不对的字段取默认。
- **词条表** `text.ts`：键是中文原文（带 `{0}` 空位），值是英文与日文；`wordsFor(lang)` 给出 `t(key, …args)`，没有译文的键回落到中文。语言：设置里选了就用它；「跟随系统」按 CLI 报告的 locale，其次 `LANG`（`zh*` 中文、`ja*` 日文、其余英文），都没有时中文。状态带、看板、对话框、提醒与 `/gemworks` 的回答都经 `t`；流程自己的标题、说明与变量名照作者写的。`test/claude-code/text.test.mjs` 扫描每个 `t("…")`，钉住每个键都有英文和日文、空位一致。

### 8.8 还没有的

| 项 | 为什么还没有 |
|---|---|
| 分享成一个链接 | 没有服务端 |
| 升级对话框里一键升级 | 插件拿不到自己的 marketplace 名，先给命令 |
| Claude Code 面板上点图 | `Svg` 元素把标记隔离画，没有把点击传回插件的通道；按钮在图下面 |
| 钩子宿主上问人 | 钩子答不了问题；用了非首选工具时调用放行，模型收到一句说明首选是哪个，人在 `tools.geml` 里改 |
| 钩子宿主在 Windows 上的命令证据 | 包命令拿退出码的壳是 POSIX shell，Windows 上不包，`tool` 证据写不了 |
| Antigravity 上拦调用 | 它没有调用前的钩子，只记录 |
| 别的宿主上的「改成规定」、提议删一步、导入参考 | 这些按钮在 Claude Code 的看板上；在那里定的规定，别的宿主照样拦（§7.5） |
| DeepSeek Harness 的状态带与会话页 | 它的网页没有输入框上方的位置；会话页的操作是 Claude Code 记录文件上的，dsh 的会话是它自己的 |

### 8.9 Codex 适配器

Codex 的插件能带 hooks，每个 hook 要人先在 `/hooks` 里信任（装上不等于信任，未信任的静默跳过）。随包的 Codex 清单是 `.codex-plugin/plugin.json`；`codex/mcp.json` 在插件目录里起 `gemworks mcp --host codex`（命令是 `node ./dist/gemworks.mjs`、`cwd` 为 `.`：Codex 不替换服务器参数里的 `${PLUGIN_ROOT}`），每次调用的项目取自调用的 `_meta["x-codex-turn-metadata"].workspaces`（几个时取有 `.geml/` 的那个）；`codex/hooks.json` 把 SessionStart、UserPromptSubmit、PreToolUse、PostToolUse、Stop 都交给同一条命令 `node "${PLUGIN_ROOT}/dist/gemworks.mjs" codex`。`.codexignore` 把源码、测试、node_modules 留在包外，`dist/` 必须在。

每个事件是一个新进程：`src/hosts/codex/adapter.ts` 在进程内调 bridge 的 `handleRequest`，用和 Claude Code 插件一样的函数判断（`fastpath.ts`）；`src/hosts/codex/hook.ts` 读事件、拼应答，是纯的。模型上次读到的 `item@rev` 记在 `PLUGIN_DATA`（没有就临时目录）下，按会话一个文件。

| 事件 | 做什么 |
|---|---|
| `SessionStart` | 记下会话；把工作循环的常驻指令、`note` 工具的说明和阶段说明交给模型；看板有内容时打开一次 GEML 看板 |
| `UserPromptSubmit` | 记下提示词；把变了的阶段说明、别的会话新定的事、在走的工作项、当前步的做法交给模型 |
| `PreToolUse` | gemworks 自己的工具放过。先查规定，被拦即 `permissionDecision: "deny"`；再按固化流程判：拒绝同样 `deny` 带原因（CLI 记一条 `refused`）；用的不是首选时调用放行，`additionalContext` 告诉模型首选是哪个；结构化输入的工具用 `updatedInput` 补默认参数；`Bash` 命令的退出码是证据时，把命令包成 `( 命令 ); __gemworks_status=$?; printf '\n[gemworks exit %s]\n' "$__gemworks_status"; exit $__gemworks_status`：子 shell 里跑，宿主看到的退出状态不变，输出末尾多一行标记；Windows 不包 |
| `PostToolUse` | 包过的命令先还原；退出码取输出里最后一个 `[gemworks exit N]`，没有就是不知道（不写 `tool` 证据）；`apply_patch` 只取补丁里 `*** Add/Update/Delete File:` 的路径；写到的项目文件记进会话记录，命令里有提交时记下；需要时发 `after`，阶段变了把交接行与新阶段的说明交给模型 |
| `Stop` | 回答记进会话记录，写 GEML 看板；这一轮动了文件却没报工作项时，以 `decision: "block"` 带提醒退回模型一次 |

项目没有记录可写、事件读不懂、出错（原因到 stderr）时什么都不说，退出码 0。宿主工具表 `codex`：`Bash` 运行命令，`apply_patch` 写文件。

### 8.10 DeepSeek Harness 界面

dsh 的 web GUI（`dsh --profile web`）里，看板是右侧栏的一个标签页：引导页列出它，点开即看板。两半：

- **宿主半边**（`src/hosts/dsh/board.ts`，`plugin.ts` 挂路由）：`GET /api/gemworks/board?session=<id>&tab=&filter=&expanded=&lang=` 答一个页签的行、页签列表与表头；`POST /api/gemworks/act` `{ session, action }` 跑一次按键。行由 Claude Code 看板的同一组函数生成：会话的监督（状态图、监督器、词典、journal）站在 Claude Code 桥的工作区的位置，所以两个看板说同样的话。宿主做不了的按键不画：按钮行只留这个宿主有的操作。
- **浏览器半边**（`client.js`，`package.json` 的 `dsh.client` 加 `exports["./client"]`）：手写的 ModuleLoader bundle，注册标签页类型与正文，只画宿主给的行、把按键发回去；标签页可见时每 3 秒读一次；语言按 dsh 的 locale（zh / en / ja）。文件链接经 dsh 自己的 `session/openWorkspacePath` 打开。按键或打开失败的原因留在看板上，直到下一次按键。

页签有四个：工作项、记录、流程、工具；会话没有固化流程时只有工作项和流程。bundle 的行名必须是路径（`./dist/hosts/dsh/plugin.js`），不能是 `@geml/gemworks/dsh`：dsh-client-modules 只为裸包名或路径命名的行找 manifest，子路径找不到包，浏览器半边就不进 boot 图（§12）。固化流程的 journal 按会话记在 `<journalDir>/<session>.geml`，会话重启后读回。工作循环（工具、会话记录、规定）在 `recordSession` 里，有没有固化流程都在。

### 8.11 其他钩子宿主

Cursor、Qwen Code、OpenCode、Devin、TRAE、Kiro 都是每个事件起一次 `gemworks <宿主>` 进程，在进程内调 bridge 的 `handleRequest`，和 Claude Code 插件用同一套函数判断；Qwen Code、OpenCode、Devin、TRAE、Kiro 的决策共用 `src/hosts/hooked.ts`，各自的 `hook.ts` 只管把宿主的事件读成同一种形状、把回答写回宿主的形状。`gemworks <宿主> install` 把钩子和 MCP 服务器写进宿主自己的配置；在项目之外启动的 MCP 服务器从钩子留下的指针（`~/.gemworks/<宿主>/active.json`）得知会话和项目。

| 事件 | 做什么 |
|---|---|
| 会话开始 | 把工作循环的常驻指令、`note` 工具的说明和阶段说明交给模型；看板有内容时打开一次 GEML 看板 |
| 提交提示词 | 记下提示词；交给模型：变了的阶段说明、别的会话新定的事、在走的工作项、当前步的做法 |
| 调用前 | 先查规定，再按固化流程判，拒绝就拦下；补默认参数；退出码是证据的命令包上（不在 Windows 上） |
| 调用后 | 读回退出码、请 `after`；写到的文件记进会话记录 |
| 回合结束 | 记下回答，写 GEML 看板；这一轮动了文件却没报工作项时退回模型一次 |

宿主之间的差别：Cursor 的提交提示词钩子只能放行或拦下、不能对模型说话，所以那段上下文等到这一轮第一次工具调用的结果里才送到；Antigravity 没有调用前的事件，只记录不拦，提示词和回答从它的对话记录里读。

### 8.12 Pi

Pi 的扩展分两块。**工作循环**（`src/hosts/pi/loop.ts`）总是在：注册 `gemworks_<名字>` 的循环工具和 `note`；每条提示词和回答记进项目的会话记录；每次运行的系统提示里带上常驻指令、在走的工作项、当前步的做法、别的会话的决定；编辑框上方几行状态（一个 widget）；`/gemworks` 在终端里打开看板浮层（Esc、q、Enter 关闭），别的界面给一条通知；运行结束时把留下的问题连同答案问出来，选的答案作为人的话发回；动了文件却没报工作项时退回一次；规定在 `tool_call` 上拦；每条打的提示词用会话自己的模型打标进纠正账本（`ledger-run.ts`）。**固化流程的监督**（`src/hosts/pi/extension.ts`）只在项目有固化流程时挂上：`tool_call` 上的闸、三个动词、命令结果的证据，journal 同时写进 Pi 的会话树。

### 8.13 GEML 看板文件

没有自己面板的宿主（Codex、Antigravity、Cursor、各钩子宿主、只接 MCP 的宿主），每轮重写项目的 `.geml/board.geml`：一页 GEML，分五块——等人的事（上一轮留下的问题、人判的步、提议）、工作项和它们站着的那一步与那一步的做法、产物、每条有工作项的流程的图、别的会话最近定的事。页上没有按钮：每一行等人的事都写着在对话里怎么说。VS Code 一类的编辑器装上 GEML 扩展，在侧边打开就能看，文件一改自动刷新；Chrome 的 GEML Viewer 也能看。生成它的是纯函数（`core/board-page.ts`），读记录、写文件的是 `src/store/board.ts`。

## 9. 测试策略

- **纯函数各有单测**：核心全是纯函数——每条静态检查、每种信号、三种推进来源、工具词典的判定与学习、用途封路、journal 加锁与续链、工作项与进度、做法、规定、提议、纠正账本、会话记录；Claude Code 插件的纯部分（状态带、看板各页、待处理、会话页、分享、设置、时间与词条表、`/gemworks` 的文字）也是，含中日韩字符宽度。
- **目录跟着 `src/` 走**：`test/` 下是 node:test 测试（`*.test.mjs`），跑的是编译后的 `dist/`，分 `core/`、`claude-code/`、`hosts/`、`store/`、`workflows/`（内置流程从头走到尾）、`package/`（包里发出去的东西），`src/` 根目录模块的测试在 `test/` 顶层。`node test/all.mjs` 分几条并行跑全部，也可以只跑点名的几个文件。
- **钉住格式与一致**：[`checks.json`](checks.json) 钉住静态检查，`test/core/checks-conformance.test.mjs` 逐例重放；`test/claude-code/fastpath-parity.test.mjs` 对着工作区钉住快路径——工作区会拒绝或记录的调用都请 `before`，会改变状态、策略或 journal 的调用都请 `after`；`test/claude-code/actions.test.mjs` 钉住看板的每个按钮动作在 `act()` 里都有处理分支。
- **桥接与宿主**：bridge 经打包后的 `dist/gemworks.mjs` 在临时 git 仓库里逐个请求测（`gh` 用 `GEMWORKS_GH` 指向的替身）；各钩子宿主的适配器按真实事件经 bundle 驱动；DeepSeek Harness 用一个真的 dsh agent 走工具管线；Pi 用一个按 Pi 接口写的替身，`pi-parity` 测试让替身和真 Pi 的形状保持一致；`gemworks mcp` 逐条消息测。
- **插件模块**：`test/claude-code/hooks.test.ts` 由 `claude plugin test` 在引擎的测试宿主里按真实事件顺序驱动（会话开始、工具调用写信号、自动边推进、结果里带上新阶段、看板按钮、桥接坏掉与错误应答与没有 Node 时放行、注册被拒、各界面上的状态带与看板等），桥接由测试脚本应答。另有三个检查：`hooks-types` 拿引擎写出的插件 API 声明对插件模块做类型检查，并且不许用到声明里标为弃用的调用（有理由保留的回退写在例外表里）；`hooks-purity` 沿插件模块的静态 import 链检查，不许任何需要 Node 的东西进来；`hooks-split` 检查包里除图片、字体以外的每个文件都不到 256 KiB、整个插件不超过 512 个文件，这是 Anthropic 插件目录的上限。
- **门与 CI**：同步一次试用版之前，四道门各跑一次：`npm run build`、`claude plugin validate .`、`claude plugin test .`、`node test/all.mjs` 加这次改动碰到的测试文件；类型检查找不到声明时算失败，不算跳过。CI 在每次推送到 main 时，在 Linux、macOS、Windows 三个平台上跑全部 node:test 测试；Linux 上另跑覆盖率（`npm run coverage`：c8 经源码映射按 `src/` 计，行低于 95%、分支低于 85% 就失败）；`engine.yml` 在最新版 Claude Code 上跑 `claude plugin validate` 和 `claude plugin test`，每周一也跑一次，引擎接口变了一周之内就会发现。
- **端到端**：`npm run walkthrough` 起一个真的 Pi agent，载入本包，用一个按脚本回答的模型把编码流程从头走到尾；gemworks 自己的开发也用 gemworks 记录。

## 10. 还没做的

| 事 | 要点 |
|---|---|
| 流程市场 | 搁置：一条流程该怎么执行还没理清，理清之前不设计市场。设想是 git 仓库作目录、索引为 GEML 文档，安装前预览各阶段、指令和封路点并过静态检查 |
| 两种单位的流程同时推进 | 见 §5.7 |
| 视频的库文档布局 | 见 §7.2 |
| DeepSeek Harness 与 Pi 上的完整固化流程 | 这两个宿主的固化流程按会话记一本 journal（工作项是 `session:<id>`），命令和工具的证据照记，git 与文件来源的信号不读，也不写 `.geml/context.geml` |
| 工具偏好的个人层 | 家目录下一份工具词典，项目的覆盖它：个人习惯的工具与参数跨项目复用 |
| 偏好按状态覆盖、固定参数 | 同一用途在不同阶段首选不同（草图用便宜的模型、成片用好的）；不许模型改的参数 |
| 命令的默认参数 | 命令行不改写，给命令定默认参数要另想办法 |
| 按块读的节省计数、代码影响面、投影到 Obsidian | 按块读文档和代码地图由 geml 插件的技能提供；读省了多少、改动影响面在状态带上的显示、把 journal 与代码地图投影到 Obsidian 都还没有 |

## 11. 备选方案与取舍

| 问题 | 选了 | 没选 | 理由 |
|---|---|---|---|
| 流程是什么 | 一串「这一步防什么坑」的步骤，会随使用长出来；只提醒，不拦人 | 让人服从的固定规程 | 每个人、每个团队要防的坑不一样；必须守住的步骤由人点成规定，或写成固化流程 |
| 状态怎么写 | 状态机图块里的节点 | 章节；专门的块类型 | 节点就是状态，属性挂在节点上；大段的提示词仍是章节，`prompt` 引用它 |
| 转换怎么声明 | 图块里的 `transitions` | 一张表；每条边一个块 | 通行要求、动作、属性都在一条转换上；和节点在一处，图从定义画出 |
| 通行要求怎么判 | 三种：对象由机器判，一句话由模型判，`approval` 由人判 | 只有机器判的通行要求，手动边不写 | 模型判断的通行要求也该写出来，它是给模型的指令；有通行要求的机器判边自动走 |
| 流程图 | 由定义画出（`geml-statechart`） | 手写 Mermaid，检查它与表一致 | 一份定义，不会不一致；`--to md` 投影成 Mermaid，GitHub 上照样是图 |
| 工具怎么指 | 用途：流程写用途，词典把用途绑到项目的工具 | 流程里写命令正则；`only-in` 列 | 流程不认识用户的项目，`npm test` 还是 `cargo test` 由项目的词典说；流程搬到别的项目一字不改 |
| 封路怎么写 | 状态的 `rules`：只有这里列出的用途封在声明它的状态里 | 声明了的用途一律只在声明它的状态里能用 | 默认不挡路：写代码、跑测试在哪一步都该能做，只有真正要紧的岔口（部署、出片）才封 |
| 工具权限 | 工具词典里人写的、在看板上点出来的行；没有行的工具交给宿主自己的权限 | 流程里按状态写死工具清单；全局 `mode` 开关 | 工具集一直在变（新的 MCP 服务、插件）；gemworks 只管流程要的封路和人定的规定，其余不另起一套 |
| 怎么问人 | 插件自己的问题框 | 宿主的权限框 | 借不到宿主的权限框，auto 模式下也问不到人（§12）；偏好要几个选项 |
| 推进来源记在哪 | 属性 `by` | 扩充 `cause` 取值 | `cause` 说做了什么，`by` 说谁做的，两者正交 |
| journal 单位 | 由流程的 `flow-unit` 声明：开发按分支，视频按剧集文件 | 全局固定按分支；按日期、按会话 | 一个工作项的全部阶段落在同一处；做视频的人不一定用 git |
| 流程的存放形状 | 一个文件：状态图加各阶段的提示词章节，放在主检出的 `.geml/workflows/` | 一个目录：`flow.geml` 加自带的提示词文档 | 复制、导入、分享都是一个文件；放在主检出里，所有 worktree 共用同一份 |
| 变量怎么声明 | 图块里的 `vars`，默认值定类型，`source` 写值从哪来 | 一张表；一份 JSON Schema 加一张信号表 | 通行要求读的、动作写的和声明在一处；要坐标寻址时把定义放进 `data` 块，图用 `data=` 引用 |
| 状态机格式放哪 | GEML 的通用格式 `geml-statechart/v1`，gemworks 只在上面挂自己的属性 | 写进 GEML 规范；gemworks 自己的 profile | 通用的格式不该归一个运行时；gemworks 不给 GEML 加块类型、属性键或图格式，`geml check` 不装 gemworks 也能查状态机 |
| journal 的形状 | 每条一个核心 `data` 块 | 专门的块类型 | 坐标能读到任何一个字段；journal 不必声明 profile |
| 插进来的无关事怎么隔离 | 按每次调用的目录归到它作用的工作项（§5.7） | 每次用户输入先判断属于哪个流程；显式的岔出去 / 回来动词 | 隔离靠活落在哪里；agent 途中发现的事输入时判断不到；凭事实而不是模型判断 |
| journal 放在哪 | 按分支的放在仓库主工作树、各检出共用；按文件的按检出 | 按检出各一份 | 工作项是分支，同一分支在哪个检出做都是同一本；worktree 删了记录也在 |
| 证据何时作废 | `tool` 证据随工作内容过期（按 git tree） | 按行选是否过期；只靠返工边的 `reset`；指纹里含 `HEAD` | 内置流程里找不到不该过期的命令证据；测完又改、rebase 不经过任何边；提交不改变内容 |
| 多个会话怎么共享 | 项目的会话记录与决定放在主检出的 `.geml/sessions/`，每个宿主读写同一份，决定随下一条提示词转告 | 每个会话各管各的 | 同一个项目常开着好几个会话、好几个宿主；A 里定的事 B 要知道 |

## 12. 宿主能力

下表是对各宿主接口实测或读其声明得出的结论，设计里依赖它们的地方标在最后一列。

| 问题 | 结论 | 落在 |
|---|---|---|
| 插件模块能否给模型附加上下文 | 能：`prompt.submit` 的 `context`、`tool.call` 结果的 `context`，用户都看不见 | §5.4、§8.4 |
| 插件加的系统提示段落能否到模型 | 不一定：Team 或 Enterprise 组织下，宿主自带的一个插件先接住 `prompt.compose`，gemworks 加的段落到不了模型；所以常驻指令在一个对话里第一次也随 `prompt.submit` 的 `context` 交 | §8.4 |
| `Bash` 的退出码 | 非零：`isError` 加 `text` 开头的 `Exit code <n>`；零：无错误且无 `returnCodeInterpretation` | §5.2 |
| Claude Code 能否隐藏工具 | 不能，只能挪到 ToolSearch 后面或改描述；所以靠拒绝 | §5.3 |
| 插件怎么开面板 | `$.ui.open({ id, title })` 加 `ui.render` `{ component: "Pane", requestId: id }` | §8.4 |
| 插件模块的运行环境 | 没有 Node 与 DOM；可以用相对路径 import 插件里的 `.js`；`$.process.run` 按参数向量起本机进程，起不来或超时即 reject；`$.fs` 只能整份读写，不能追加、改名、加锁 | §6、§8.4 |
| 插件测试（`claude plugin test`） | 运行插件目录下的 `*.test.ts(x)`，不进 `node_modules`；引擎调用（`process.run`、`fs.read`、`ui.open` 等）由测试自己的钩子应答，每个应答都要在测试第一次调用 `$` 之前注册 | §9 |
| `claude plugin validate` | 拒绝找不到文件的相对 import；拒绝不是函数字面量（也不是函数名）的钩子；匹配条件取自 import 的常量时显示为 `requestId=?`，所以匹配值直接写字面量；列出每个拦截钩子是否带 `.catch` | §8.4 |
| 钩子的顺序与失败 | 不带匹配条件、先注册的 `tool.call` 钩子在带匹配条件的之上运行，插件自己工具的调用也先经过它，由它 `next(e)` 传下去；带 `.catch(($, e, next) => next(e))` 的钩子抛异常时调用照常执行 | §8.4 |
| 插件注册的工具 | `$.tool.register` 的 `inputSchema` 是 JSON Schema，`enum`、`required`、`additionalProperties: false` 都会校验，调用由插件的钩子应答 | §8.5 |
| 每次调用的目录 | `tool.call` 的输入只有工具参数、`tool`、`tool_use_id`，子 agent 的另带 `agentId`，没有 cwd。钩子里读 `$.session.cwd()` 按发起调用的循环作答：主循环是 shell 当前目录（调用开始时的）；普通子 agent 是父会话的目录；隔离 worktree 的子 agent 是 `<项目>/.claude/worktrees/agent-<id>`，另一个 git 检出。`$.session.root()` 不随 shell `cd`、也不随子 agent 的 worktree 变 | §5.7、§8.4 |
| 插件能否借宿主的权限框问人 | 不能：插件挂在宿主权限钩子上返回 `ask` 的钩子在桌面会话里不被调用；auto 权限模式下宿主自己的权限提示由分类模型代答，人看不到 | §5.3 |
| 插件自己问人 | 能：`tool.call` 钩子里调用 `$.ui.ask(问题, 选项)`，auto 模式下也问到人，返回所选选项的原文；钩子据此返回 `{ deny }` 时调用不执行，模型以工具错误的形式收到理由 | §5.3、§8.4 |
| 界面元素 | 各界面都有 `Box` `Text` `Button` `Input` `Select` `Link` `Code` `Markdown`，没有标签元素；桌面、编辑器、手机另有 `Svg`，终端没有；`AbovePrompt` 只在终端与桌面出现，`Pane` 各界面都有；对话框式面板用 `$.ui.open({ id, focus, closeOnEscape, … })`，Esc 关掉 | §8.1、§8.2 |
| 状态带上的按钮 | `AbovePrompt` 的元素表含 `Button`。桌面画原生按钮；终端画 `[ 标签 ]`，`hotkey`（一位数字或小写字母）只在状态带持有焦点时生效，空输入框里的裸数字也能按；`variant: "primary"` 标主动作 | §8.1 |
| 面板画矢量图 | `Svg` 元素：`source`（整份 `<svg>…</svg>`，至多 131072 字符）、`alt`（必填）、`isInteractive`（放进无脚本的沙箱帧）。它是叶子：点击只能挂在外面的 `Button` 上，而 `Button` 只收文字子元素；所以图上某条边要能按，只能用面板自己的元素画 | §8.2 |
| 面板能放多少 | 桌面面板的元素树超过约 1100 个元素就会失灵（空白、按钮不动） | §8.2 |
| 提醒与存储 | `$.ui.notify(text, { title })` 走用户自己的通知渠道；`$.ui.toast` 右上角几秒；`$.store` 是插件自己的 JSON 文件，跨会话、跨热重载；`$.env.get("LANG")` 可读系统语言 | §8.6、§8.7 |
| 提示词历史与会话记录 | `$.session.messages()` 给最近的 user/assistant 消息，没有时间戳与 id，所以会话页的列表由插件在 `prompt.submit` 时自己记；`session.append` 每存一行带 `uuid`，`door: "prompt"` 是人的提示词那一行；`$.ui.scroll` 能滚到对话里那一行，只在插件回应人自己的输入时可用。没有删除或拆分会话记录的接口：拆分由随附的 split-session 技能在模型手里做，先备份再改写；自动模式的分类器把插件代码里改写会话记录文件判为篡改，所以看板不自己改文件 | §8.2 |
| Codex 的插件钩子 | 加载插件的 hooks，但每个 hook 要人先在 `/hooks` 里信任，未信任的静默跳过。事件有 PreToolUse、PostToolUse、UserPromptSubmit、SessionStart、Stop 等；stdin 一个 JSON（`session_id`、`cwd`、`hook_event_name`，工具事件带 `tool_name`、`tool_use_id`、`tool_input`，PostToolUse 另带 `tool_response`）。PreToolUse 的 `permissionDecision: "deny"` 拦下，`"allow"` 加 `updatedInput` 改写，`additionalContext` 只加上下文，`"ask"` 不支持。PostToolUse 的 Bash 结果是一个字符串，没有退出码；包命令的壳里 `exit 3` 仍让宿主看到 3 | §8.9 |
| Codex 插件的 MCP 服务器 | 服务器参数里的 `${PLUGIN_ROOT}` 原样传给进程；`cwd: "."` 解析到插件目录；服务器的环境只剩 HOME、PATH 等几项；`tools/call` 的 `_meta["x-codex-turn-metadata"]` 带 `session_id`、`turn_id` 与 `workspaces` | §8.9 |
| DeepSeek Harness 的浏览器半边 | 包的 `dsh.client` 加 `exports["./client"]` 声明浏览器 bundle；只为裸包名或路径命名的 loader 行找 manifest，子路径行得不到包、不进 boot 图；右侧栏按会话，`sidebarRightTabs.register` 注册类型、`slots.inject("sidebar.right.pane.tab")` 给正文；宿主路由用 `webServer.register({ kind: "prefix", path, handler })`；http 页面里的 `file:` 链接浏览器不开 | §8.10 |
| 出处 | `plugin-authoring` 技能里的 `types/claude-code.d.ts` 是插件 API 的全部声明；插件被引擎加载过之后，同一份声明也落在插件目录的 `.claude-plugin/types/` 里 | — |

还不清楚的：

1. 桌面 app 分屏时，面板是否和状态带一样只在左栏出现。
2. Codex 上真模型看到输出末尾的 `[gemworks exit N]` 会不会受干扰。

