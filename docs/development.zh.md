# 项目布局与开发

[← 回到 README](../README.zh.md)

## 项目布局

```
.geml/                          在主检出里：仓库的每个 worktree 读的都是这一份
  workflows/<name>.geml         一份流程：一个状态机块，后面跟着各阶段的提示词
  tools.geml                    所有流程共用的工具词典：哪个工具是哪个用途，哪里允许、哪里拒绝
  project.geml                  项目文档：meta flow-workflow 指定默认流程；#items 列着每个工作项和它的结局
  artifacts.geml                每个工作项的产物：链接、在 git 里改过的文档、git 不留的文件，各在哪、第几版
  artifacts/                    git 不留的文件的副本，按内容哈希命名
  journals/<item>.geml          每个工作项一本 journal：一个分支，或一组文件中的一个
  sessions/                     项目的会话记录，各家宿主的会话都在这里
  coach/<name>.geml             项目自己的轻流程：改过的起步流程、加的流程
  practices.geml                项目的做法，各挂在它所属流程的那一步上
  proposals.geml                提议加的步骤和新的一类活，等你说行或不行
  board.geml                    一页 GEML 看板，给没有自己面板的宿主
  exports/                      看板导出的文件
  .gitignore                    gemworks 自己的文件，由 gemworks init 写出：它们都不进 git
.geml/                          在每个检出里
  context.geml                  当前阶段的文字与变量，每次换阶段重写
  backlog.geml                  backlog 表
```

旧布局——检出里每个流程一个目录（`flow.geml`、`guide.geml`、`tools.geml`）——
照样能读。Claude Code 会话的第一次 status，或者
`gemworks migrate`，会把它搬进主检出：每个目录合成一个文件、guide 的各节并进去，
词典的行并进 `.geml/tools.geml`。git 跟踪着的
只复制、留在原处，由你 `git rm`；其余的挪进 `~/.gemworks/trash/`。在旧 `flow.geml`
下开始的 journal，接着在它搬去的那个文件下走。

`gemworks init` 写出的项目文档：

```geml
=== meta
title         = "Gemworks"
flow-workflow = "coding"
===
```

它下面 gemworks 维护一张表 `#items`：项目有过的每个工作项和它的结局，看板每次列工作项时
从 git 读——分支还在、没合并是 `doing`；main 收进了它的提交、或者 PR 已合并，而分支或
worktree 还在，是 `merged`；那些也删了是 `closed`；分支没合并就删了、或者一个提交都
没有，是 `dropped`。文件类的工作项走到流程终点算 `closed`，停在 `parked` 算 `dropped`。
表里记着 git 记不住的——删掉的分支最后的提交、有过几个提交；只重写这张表，你写在它
周围的不动。

产物记在 `artifacts.geml` 的 `#artifacts` 表里，一行一版。工作项写过的文件里 git 不留的，
每回合结束和打开看板时各看一次，内容变了就在 `artifacts/` 存一份副本；单个超过 20 MB
只记位置和哈希。GEML 文档只存一份副本，之后的版本记进它的 `.gemlhistory`。在 git 里的
文档只记路径和最后改它的提交。Artifact 工具发布的页面自动记成链接；别的链接和生成的
图片，模型用 `artifact` 工具记。

默认流程是 `GEMWORKS_STATECHART` 指定的文件（相对项目根的路径），否则是
`flow-workflow` 指定的那个，否则是项目唯一的那个流程。CLI、Claude Code 插件、
`gemworks mcp`、DeepSeek Harness 适配器与 pi agent 适配器都这样找。backlog 提交进仓库；
gemworks 自己的文件不进 git。

## 开发

```sh
npm install           # 从 npm 装 @geml/geml，以及测试要对照的各宿主的包
npm run build         # tsc + 打包
npm test              # 构建，再跑全部 node:test 套件（node test/all.mjs）
npm run test:claude   # 构建，再 claude plugin validate 与 claude plugin test（需要 claude CLI）
```

`npm run build` 先跑 `tsc`，再打包 Claude Code 插件启动的 CLI：`dist/gemworks.mjs` 和它加载的
`dist/gemworks-*.mjs`，`@geml/geml` 原样拷进 `dist/vendor/geml/`，装上的插件不需要再装依赖。
包里每个文件都不到 256 KiB——到了这个大小，Anthropic 插件目录会把那一版扣下等人工审——由
`test/hooks-split.test.mjs` 守着。`hooks/register.tsx` 和从它拆出来的 `hooks/act.tsx`（按钮按下后
做什么）在没有 Node 的环境里运行：它们只 import `dist/hosts/claude-code/` 与 `dist/core/` 下不依赖
Node 的模块，`test/hooks-purity.test.mjs` 沿着这条 import 链逐个检查。hooks 的测试放在 `tests/`
（`claude plugin test` 不进 `node_modules`）；其余由 `test/` 下的 node:test 测，其中
`test/fastpath-parity.test.mjs` 把插件的快路径钉在 workspace 会拒绝、会记录、会询问的
范围上，`test/checks-conformance.test.mjs` 回放
`spec/checks.json`。

`src/core/` 是纯函数库——不碰 `node:fs`、`process`、`console`，也不 import 任何
宿主的包（这几条都有测试钉着）——所以 CLI、Claude Code 的桥、`gemworks mcp` 和两个适配器
共用同一份实现：`statechart.ts` 经解析器的 statechart 模块载入流程，`dictionary.ts`
放键、模式和决定，`signals.ts` 放按来源分的证据，`supervisor.ts` 放闸和动词，
`asking.ts` 放首选工具的那个问题和答案写下的东西。I/O 放在它旁边：`src/host-fs.ts`
（文件、锁、原子写入、遍历项目）、`src/host-git.ts`（git 与 gh，每次都是带超时的参数
数组）、`src/dictionary-io.ts`（磁盘上的词典，每次重读、在它的锁下重写），以及
`src/workspace.ts`——为 CLI 和任何建在它上面的宿主，对一个项目一次只做一个加锁的操作。

目录结构就是从这条规矩来的：`src/core/supervisor.ts` 做判断，`src/hosts/dsh/` 与
`src/hosts/pi/` 只做翻译。两个适配器谁都不许 import 对方的宿主——宿主包都是可选
peer，只装了一家 harness 的人绝不能被解析到另一家的包上，这条有测试拦着。每个宿主
还各有一份 parity 测试（`dsh-parity`、`pi-parity`），拿我们依赖的形状去对已安装的
包做断言：宿主改了接口，红在这儿，而不是红在用户的会话里。

Claude Code 外壳也按这条规矩分在桥的两侧。`src/bridge.ts` 是 `gemworks hook` 的 Node
一侧：每个请求都重新打开 workspace（打开时读 git 的事实，而且别的进程可能在两次请求之间
写过 journal 或词典），并且每个请求都给应答，抛了异常也一样；`src/attribution.ts` 说
一次调用作用在哪个检出、哪个工作项。`src/hosts/claude-code/` 是 hooks 模块 import 的、
不依赖 Node 的一侧：请求与应答的类型、快路径、读 Claude Code 工具结果的函数，以及
状态带、看板与 `/gemworks` 的文字——都是纯函数。`src/mcp.ts` 用 stdio MCP 提供同样的
动词（`src/verbs.ts`）和工作循环的工具（`src/loop.ts`）；`src/codex.ts` 与
`src/antigravity.ts` 是这两家的 hooks，`src/board-file.ts` 写出它们和 `gemworks mcp` 打开的
那一页 GEML 看板。
