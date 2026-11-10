# 命令行

[← 回到 README](../README.zh.md)

## CLI

```
usage: gemworks <check|snapshot|verify|export|init|use|migrate|status|mark|unmark|advance|pause|resume|rollback|run|hook|mcp> ...
  check <workflow.geml>                   static checks of the workflow and its tool dictionary (exit 1 on errors)
  snapshot <journal.geml> [--json]        the last revision
  verify <journal.geml> [--workflow f]    hash chain and consistency
  export <journal.geml> --to md           revision table with per-step diffs
  init [dir] [--template coding|dev|matter|video] [--no-activate]  write a bundled workflow into .geml/workflows/
  use <workflow>                          make a workflow the default for new work items
  migrate                                 move the earlier layout (a workflow directory in the checkout) into the project's home
  status [--json]                         the work item, the stage, its variables and next steps
  mark <variable> | unmark <variable>     a person ticks or clears a variable whose source is a person
  advance <state>                         a person moves the workflow
  pause | resume                          a person holds the work item (evidence is recorded, nothing moves) or lets it go
  rollback [<rev>|checkpoint]             a person restores an earlier revision's state and variables
  run [--profile name] <task>             add the bundle to a dsh profile and run the task there
  hook                                    the Claude Code bridge: one JSON request on stdin, one answer on stdout
  codex                                   the Codex hook: one event on stdin, its answer on stdout (exit 0 always)
  antigravity <Event> | install           the Antigravity editor's hook (one event on stdin), or put its hooks and MCP server in place
  cursor [install]                        Cursor's hook (one event on stdin, its answer on stdout, exit 0 always), or put its hooks and MCP server in place
  mcp [--host h] [--root dir]             the model's tools over stdio MCP (host default: mcp)
  corrections [--baseline a..b] [--trial a..b] [--since day] [--by work] [--json]
                                          how often you corrected the agent, per 100 prompts, by kind and by week
  corrections guide | pending [--limit n] | label [file] [--import]
                                          the labelling guide; your prompts not labelled yet (JSONL); labels written back
```

- `check` 先跑 `geml check`，再跑状态机的检查（`statechart-*`：没有初始状态、转换指向
  不存在的状态、标了 `final` 的状态有出边、通行要求读了 `vars` 里没声明的变量……），再跑流程的检查（`flow-*`：
  `prompt` 解析不到、`source` 不是已知的任何形式、同两个状态之间有两条转换、一个状态
  有两条机器判的出边、机器判的边成环……），并对照流程读词典——项目的
  `.geml/tools.geml` 对照它的所有流程读（`flow-tools`：哪个流程都没有的状态、一个用途
  有两个首选……）。`prompt` 对照项目解析——就是 `.geml/workflows/` 里放着这个流程的
  那个项目，当前目录是这个项目的检出时就用当前目录——绝不解析到项目之外。
- `snapshot`、`verify`、`export` 读一本 journal。`verify` 重算整条链：修订号连续、每个
  `parent` 等于前一块的哈希、每个哈希按内容重算、并且——给了流程时——每次记录的转换
  都对应一条声明过的边。删掉**末尾**一段块是这条链唯一检测不出的改动。
- `init` 把一份内置流程写成一个文件 `<dir>/.geml/workflows/<template>.geml`（默认
  `coding`，`--template dev`、`matter` 或 `video` 则是那一份），把它的词典行
  并进 `.geml/tools.geml`，除非给了 `--no-activate` 就设为默认流程，并在没有
  `.geml/.gitignore` 时写一份。项目已有的流程绝不覆盖。
- `use` 在 `.geml/project.geml` 里改指 `.geml/workflows/` 下的另一个流程（见
  [切换流程](#切换流程)）。
- `migrate` 把旧布局搬进主检出（见[项目布局](development.zh.md#项目布局)），并说明什么搬到了哪里。
- `status` 打开项目——工作项还没有 journal 和 `.geml/context.geml` 时就开一本、写一份——
  然后打印工作项、当前阶段、每个变量和它从哪读，以及每条出边、由谁走、通行要求是否
  成立。`--json` 打印完整的状态。
- `mark` 与 `unmark` 是人勾上、取消一个 `source` 为 `"human"` 的变量；随后通行要求成立
  的机器判的边会被走（`marked review-ready · entered #review`）。`advance` 是人走当前状态
  的一条出边：通行要求必须成立，标了 `approval` 的边不再要另一次同意（这条命令本身就是
  审批），journal 记 `by=human`。`rollback` 以人的身份恢复某条早先修订的状态与变量。
  这几条命令模型一条都不能跑：运行 `gemworks mark|unmark|advance|pause|resume` 的命令行——直接跑，
  经 `npx`、`npm exec`、`node dist/cli.js`，或放在 `bash -c`、`pwsh -c`、`sudo sh -c`、
  `eval`、命令替换里——在每个状态都会在执行前被拒，这次拒绝记进 journal。
- `hook` 是 Claude Code 插件的桥：hooks 模块往它的 stdin 写一个 JSON 请求，从
  stdout 读一行应答。
- `codex` 是 Codex 插件的 hook（[Codex](hosts.zh.md#codex)）：stdin 一个事件，stdout 给
  应答，不论出什么事都以 0 退出。
- `antigravity <Event>` 是 Antigravity 编辑器的 hook，stdin 一个事件；`antigravity install`
  把它的 hooks 写进 `~/.gemini/config/hooks.json`，把 MCP 服务写进
  `~/.gemini/config/mcp_config.json`。
- `cursor` 是 Cursor 的 hook（[Cursor](hosts.zh.md#cursor)）：stdin 一个事件，stdout 给应答，
  没话说或出了错都给 `{}`，不论出什么事都以 0 退出。`cursor install` 把它的 hooks 写进
  `~/.cursor/hooks.json`，把 MCP 服务写进 `~/.cursor/mcp.json`。
- `mcp` 用 stdio MCP 提供模型可调的工具——固化流程的 `status`、`move`、`set`，`note`，
  以及工作循环的 `work`、`practice`、`propose`、`answer`、`ask`、`artifact`——给没有自己的
  Gemworks 外壳的宿主用（`--host` 指定词典里的 `Bash(…)` 键对应哪个宿主的工具名，默认
  `mcp`，它不跑任何命令）。在这种宿主上看不到任何工具调用：`tool` 证据永远写不了，什么都
  不拒。`status` 回答之前会重新读一遍 git 和文件变量，并带上阶段的文字、进行中的工作项和
  这一步的做法；改变了阶段的 `move` 把新阶段的文字附在结果后面。模型记下的东西会重写那一页
  GEML 看板 `.geml/board.geml`（见 [hosts.zh.md](hosts.zh.md) 的「其他宿主（MCP）」一节）。
- `corrections` 是你的纠正账本：不带子命令时，按每 100 条提示词算你纠正了 agent 几次，
  拿一段基线期对比一段试用期（默认是本周之前的八周和本周），按纠正的种类、按周分开，
  加 `--by work` 再按活的种类分开。`guide` 打印归类指南，`pending` 把还没归类的提示词按
  JSON 行打出来，`label` 把填好归类的这些行收回去。
- `run` 是唯一会伸到这个包外面的动词：它在 PATH 上找 `dsh`（找不到就退回
  `npx -y @deepseek-ai/dsh`），把 bundle 加进 profile（不指定就是 `headless`），然后
  把任务交过去，并把 dsh 的退出码原样传回。加失败时它把 dsh 自己的话打出来，再给出
  手工执行的两条命令，绝不在一个没装监督器的 profile 上把任务跑起来。

在一个仓库的功能分支上：

```
$ gemworks init
wrote .geml/workflows/coding.geml (active)
$ gemworks status
feat/rate-limit · #explore
  command = ""
  goal = ""
  plan = ""
  tests-pass = false  (tool:test)
  touched = ""
  → #plan  by move  when goal and touched are recorded
$ gemworks advance plan            # 模型判的转换，人也能走
entered #plan
```

之后在 `#verify` 里、还没有一次跑绿的记录时：

```
$ gemworks advance review
gemworks: verify→review: the guard does not hold (tests-pass=false)
$ gemworks mark tests-pass
gemworks: tests-pass reads its value from the use test; only a variable whose source is "human" is ticked
```

### 工作项与 journal

CLI 每个工作项一本 journal。coding 流程（`flow-unit = "branch"`，默认）里，工作项就是
你所在的分支，它的 journal 是 `.geml/journals/<branch>.geml`——`feat/rate-limit` 写的是
`.geml/journals/feat/rate-limit.geml`。切换分支，下一条命令就作用于那个分支的 journal。
默认分支、游离的 `HEAD`、还没有提交的分支、不是 git 仓库的目录都没有工作项：
`gemworks status` 会说明（`main · not tracked (work items are branches)`），并且什么都不
记录。`flow-unit = "file:<glob>"` 的流程每个匹配的文件一本 journal；它的工作项是宿主的
写入调用最近一次改动的那个文件，所以单靠 CLI 没有工作项。写了 `flow-state-key` 的流程，
文件还在那个 meta 键下记着工作项现在的阶段：操作结束后它说的不一样就写回，日志不在时
就读它，所以到了日志没去过的机器上，工作项从这个阶段起步。Claude Code 插件与
`gemworks mcp` 用的就是这些 journal。

宿主适配器则每个会话一本：DeepSeek Harness 写 `<journalDir>/<session>.geml`，pi agent
写 `<会话目录>/gemworks/<session>.geml`，`#journal` 块里都是 `"item": "session:<id>"`。
两种 journal 互不相干：`gemworks mark` 与 `gemworks advance` 作用于工作项的 journal，从不
作用于某个会话的。

### 切换流程

`gemworks use <name>` 改的是默认流程：**新**工作项在哪份流程下开始。已有 journal 的
工作项继续用它的 journal 开始时的那份流程，所以 `use` 不需要提醒什么；`gemworks status`
和 `/gemworks` 在工作项的流程不是默认流程时会点名，看板的流程页显示的就是这个工作项
自己的流程：

```
$ gemworks use dev
default workflow: dev (a work item with a journal keeps its own)
$ gemworks status
feat/rate-limit · #explore · workflow coding (default dev)
```

流程文件没了的 journal 打不开，并且会说明：把文件找回来，或者把 journal 挪开——改名，
或者删掉——下一个操作就在默认流程下重新开始这个工作项。改了名的 journal 仍然是
journal：`gemworks verify` 拿它开始时的流程来验它。

```sh
mv .geml/journals/feat/rate-limit.geml .geml/journals/feat/rate-limit.coding.geml
gemworks status
gemworks verify .geml/journals/feat/rate-limit.coding.geml --workflow .geml/workflows/coding.geml
```

### 出错时

- 退出码：`0` 完成；`1` 操作失败，stderr 上一行以 `gemworks:` 开头的话，绝不是堆栈；
  `2` 用法错误——未知的动词、缺参数、动词没有的选项（`status --jsno`）。
- 没有流程：``no workflow here: run `gemworks init` ``。有好几个却没选：
  ``choose one with `gemworks use <name>` ``。`.geml/project.geml` 里的名字或
  `GEMWORKS_STATECHART` 找不到文件时照实说。流程有 error 时把它们打出来：
  `<file>: <code>: <message>`。
- 没有工作项：`status` 打印原因并以 0 退出；`mark`、`unmark`、`advance`、`rollback`
  以 1 退出，原因相同。
- 被拒的推进打印原因，以 1 退出；那条转换存在时，这次拒绝也记进 journal。`mark`
  拒绝 source 不是人的变量，也拒绝模型写的变量。
- 不能续用的 journal（校验不通过，或它的状态没了）会说出自己的路径和出路：把它挪开。
- 别的进程拿着 journal 的锁时等 5 秒，之后命令失败，说出锁文件和持有者；确实没有
  gemworks 进程在跑，就删掉那个锁文件。
- `.geml/context.geml` 写不了绝不让命令失败：journal 照写，下一条命令会把上下文文档
  写好。
