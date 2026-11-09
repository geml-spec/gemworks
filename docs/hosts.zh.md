# 各宿主的安装与用法

[← 回到 README](../README.zh.md)

## 安装

### Claude Code

```text
/plugin marketplace add geml-spec/geml
/plugin marketplace add geml-spec/gemworks
/plugin install gemworks@gemworks
```

在会话的输入框里逐行输入，最后一行装的时候选范围。第一行加的是 GEML 自己的插件市场：
gemworks 依赖 geml 插件，加了这个市场，装 gemworks 时会一并装上 geml；没加的话
gemworks 能装上，但加载不起来。gemworks 市场里的条目从 npm 装已发布的 `gemworks` 包。
在命令行里用 `claude plugin marketplace add …` 和 `claude plugin install gemworks@gemworks`
也一样。

装上之后：

- **输入框上方常驻一行**，终端和桌面 app 都有：
  `G · ⧗ feat/rate-limit · review · ci-pass ✓ · pr-merged ✓ · → #deploy 需批准  [批准] [打回 build] [待处理 3]`
  ——GEML 的 G 标、工作项、阶段、下一道通行要求读的变量、下一步以及它在等什么；然后是
  此刻最紧要的一两个动作（批准或打回、勾上、放行一次、继续、重试）和红色的待处理计数，
  点它打开看板的待处理页；有流程时这一行末尾总有一个「看板」按钮。问不了 gh 时有一段黄色说明；工作项的流程不是默认流程时点名
  它；暂停了会说。在默认分支上显示 `⧗ main · not tracked (work items are branches)`；
  项目里没有流程时写"没有流程"，并按目录里有什么建议一个内置流程（有 geml-media 文档或
  `episodes/` 建议 video；有 wrangler、fly、vercel、Dockerfile 一类部署配置建议 dev；有
  package.json、Cargo.toml 一类构建清单建议 coding；都没有建议 dev），一个按钮加上它，
  另一个打开设置选别的；桥接还没应答时写"启动中"。文字跟着偏好语言或系统语言走：
  中文、English、日本語。
- **`/gemworks`**：当前状态；`/gemworks board [标签]` 打开看板；`/gemworks pause`、
  `/gemworks resume` 暂停、继续工作项；`/gemworks use <流程>` 改默认流程；`/gemworks add`
  列出内置流程，`/gemworks add <流程>` 把一份复制进 `.geml/workflows/`——项目还没有流程
  时同时设为默认流程，否则提示用 `/gemworks use`。
- **看板**，六个标签页，打开停在待处理：待处理（只有你能做的事——通行要求已满足的
  批准、要勾的变量、模型在同一个键上反复被拒、桥接坏了——每项带按钮）、
  工作项（先是当前工作项的产物——`#result` 一节、写过的文件、提交——再是按结局分组的
  工作项：在做、已合并、已收尾、放下，各带 worktree、提交数和 PR；已合并但 worktree
  或分支还在的，出一张收尾卡片，确认后由模型在提交都进了 main 时删掉两者；然后是
  backlog）、记录（顶部"自上次之后"的
  摘要，然后是最新在前的 journal，可筛选；一条展开能看凭什么、哪次调用、在哪份内容上、
  还算不算数）、流程（从模型画出的流程图，叠着运行时：一层一行状态盒子，当前阶段强调色，阶段里的工作项数做角标；每层下面一行一条出边，标着条件成不成立，现在能走的边是带数字热键的按钮——桌面、编辑器、手机、终端都一样；然后是时钟、人勾选的变量）、工具（词典每一行
  在当前状态的处境，能就地改的都有按钮，输入框加一行）、会话（你发过的 prompt 按当时阶段
  分组，附这一轮做了什么；勾中一条可以定位到对话里那一处，或交给模型用随附的
  `split-session` skill 把它和之后的轮次、或只它这一轮拆成单独的会话，原会话先备份；
  每个会话标题旁的「导出」把记录导出为 GEML，先问存到哪：下载、桌面、本项目的
  `.geml/exports/`，或自己填的文件夹、文件）。头部常驻分享（现在在哪、记录、
  本会话、流程——复制文字、写到 `.geml/exports/`、或发 PR 评论）、设置（桌面提醒、状态带
  显示什么、默认流程、添加内置流程或从路径导入、偏好语言）、升级、关于。
- **模型可调的三个工具**：`status`、`move`、`set`，列为 `mcp__gemworks__status`、
  `mcp__gemworks__move`、`mcp__gemworks__set`。它们的 schema 不随状态变，prompt 缓存不会
  因此失效。调用它们从不被闸拒；动词自己的规矩——三种判断者、带 source 的变量——
  照样生效。
- **词典里没有行的工具照常放行，不问人**：它安不安全，由宿主自己的权限系统按实际参数判断。
  词典只回答"这是哪个用途"，从而决定它在哪些阶段能用；要拒绝或绑定，在看板或
  `.geml/tools.geml` 里写一行。绑到某个用途、但该用途的首选是另一个工具（`default` = `yes`）
  的工具会问一次——只这一次，或者改成首选——一行的 `params` 补上调用没写的参数。
- **把阶段的上下文交给模型。** 一次调用让阶段变了，新的 `#current` 随这次调用的结果交给
  模型；两次提交之间变了（人在看板上推进了、会话开始时补齐了 git 的事实），随下一次
  提交交给模型。子 agent 的调用让阶段变了，子 agent 读到它，主线程的下一次提交也照样
  带上。在另一个检出（子 agent 的 worktree）里的工具调用按那个检出的工作项裁决，它的
  阶段交给在那里干活的子 agent。`/clear` 之后的下一次提交重新带上。

在仓库里开始用：`/gemworks add dev`（或 `npx -y gemworks init --template dev`），
再把 `.geml/tools.geml` 改成项目的测试与部署命令、把 `.geml/workflows/dev.geml` 里各阶段的文字改成项目自己的约定——
[开发流程](workflows.zh.md#开发流程)一节把它走一遍。

**需要 Node ≥ 22。** hooks 模块在 Claude Code 里运行，没有 Node；凡是碰项目文件的
事——journal、`.geml/context.geml`、词典、backlog——都由打包好的 CLI `dist/gemworks.mjs`
做，每个请求起一次（`node dist/gemworks.mjs hook`：stdin 一个 JSON 请求，stdout 一行
应答）。会话开始时插件找 Node：先在会话的 PATH 上跑 `node --version`；不够再问 shell
——Unix 上是登录 shell（`/bin/sh -lc "command -v node"`），Windows 上是
`cmd.exe /d /c where node`，不是本系统的那个立刻失败——再看安装器放它的地方
（`%ProgramFiles%\nodejs`、`%LOCALAPPDATA%\Programs\nodejs`、nvm-windows 的
`%NVM_SYMLINK%`、Volta、Homebrew、`/usr/local/bin`），第一个主版本 ≥ 22 的就是。每次探测
给 10 秒：node.exe 第一次被杀毒软件读一遍会慢。会话开始时没找到 Node，之后的工具调用、
提交或 `/gemworks` 十秒后就会再试；找到了 Node 但没拿到应答，再试至多一分钟一次。

**失败放行。** 找不到 Node、CLI 失败或超时（15 秒；看板、刷新、`use` 与 `add` 45 秒）、
应答无法解析时，工具调用照常执行、什么都不记，输入框上方那一行显示原因。所以拒绝
只在这座桥正常时生效。应答说请求本身失败了（journal 读不了、锁一直被占）时，插件沿用
手上最近一份策略；从没构建过的 bundle 会连同该跑的构建命令一起说出来。

**这里的用途是什么。** Claude Code 不能把工具从模型的工具表里拿掉，所以阶段的文字
写明本状态声明了哪些用途、每个绑到哪个工具（`Tools here:` 之后每个用途一行：
`edit: Edit`、`test: Bash(npm test)`）——模型看得见的告示牌；调用绑到本状态没声明的
用途的工具，在调用时、执行之前被拒
（`gemworks: Edit is edit, which is used only in #implement; the workflow is in
#explore`），并记为 `#refused-N`。拒绝时会点出每个状态都允许的那条出路：切换工作项
（`git switch`、`git checkout -b`、`git worktree add`、`cd`）。只许人做的命令
（`gemworks mark|unmark|advance|pause|resume`）与封路用途的命令模式，读任何带命令行的工具调用
（Bash、Monitor），命令行里任何位置，去掉引号之后。

**大多数调用不起子进程。** 每个应答都带一份状态与策略的快照——用途、词典的行、文件
glob——插件只在调用可能被拒或被记时才在调用前问 CLI，只在证据可能读到它时才在
调用后问：键绑到了某个变量所读用途、并且带退出码的命令；绑到这样一个用途的工具；写了
文件变量或工作项单位指定的文件；流程有文件变量时的任何执行；命令行任意位置运行了 git
或 gh（切换分支会换掉工作项）；Bash 结果报告了 git 操作；或者 CLI 刚记下了这次调用。
可能作用在另一个检出里的调用一律交给 CLI，由它归属。关于 pull request 与 CI 的 gh 查询
只在会话开始、看板打开或刷新、结果报告了 git 操作（commit、push、合并、PR）的调用之后
进行——`git status` 不会多问一次 gh。

在本仓库里开发这个插件：

```sh
cd integrations/gemworks && npm install && npm run build
cd ../.. && claude --plugin-dir integrations/gemworks
cd integrations/gemworks && npm run test:claude   # claude plugin validate + claude plugin test
```

### 其他宿主（MCP）

`gemworks mcp` 用 stdio MCP 提供同样的三个工具；在宿主的 MCP 配置里登记为
`npx -y gemworks mcp --host <宿主>`（宿主在项目之外启动服务时加 `--root <目录>`）。
skill `skills/gemworks-mcp/SKILL.md` 要求模型每轮先读阶段（`status`，或
`.geml/context.geml` 的 `#current`）——这类宿主没有把它交给模型的通道。这类宿主
没有的：

- 没有输入框上方那一行，也没有看板；人在终端里用 `gemworks advance` 与 `gemworks mark`
  推进流程、勾变量。
- Gemworks 看不到宿主的任何工具调用，所以 `tool` 证据永远写不了、什么都不拒——封路的
  用途与只许人做的命令都一样。通行要求不论谁推进都生效，`gemworks advance` 也一样，所以
  通行要求要读 `tool` 证据的转换，只有在它也接受一个人勾的变量时才走得了：开发流程的
  `review-ready` 能把 `#build` 带到 `#review`，`#release` 却等着 production 部署的退出码，
  在这类宿主上永远到不了 `#done`，除非给它的通行要求加一个 `human` 变量。
- git 与文件变量在模型调用 `status` 时读；改变了阶段的 `move` 把新的 `#current` 附在
  结果后面。
- 模型走标了 `approval` 的转换会被拒，与 Claude Code 上一样。

### Codex

Codex 照上面拿到三个 MCP 工具，hooks 信任之后还拿到闸：插件的
`.codex-plugin/plugin.json` 指向同一份 `skills/`、`codex/mcp.json`
（`gemworks mcp --host codex`）和 `codex/hooks.json`——SessionStart、UserPromptSubmit、
PreToolUse、PostToolUse、Stop 都跑 `node "${PLUGIN_ROOT}/dist/gemworks.mjs" codex`。从本仓库的
Codex marketplace（`.agents/plugins/marketplace.json`，本地来源，先在
`integrations/gemworks` 里 `npm run build`）装：Codex 里 `/plugins` 安装，再 `/hooks`
逐条审阅、信任这五个 hook——装插件不等于信任，没信任的 hook 一声不响地跳过。

hooks 信任之后，Codex 上有的就是 Claude Code 上的减去状态带和看板：阶段文字在会话开始、
变化之后的下一条 prompt、以及改变了它的那次调用的结果里交给模型；封路用途或只许人做的命令
被拒并说明原因；词典里没有行的工具照常放行；工具的默认参数补齐；补丁写的文件，以及回合结束时的回答和这一轮的提交，记进项目的会话记录；退出码是证据的 shell 命令被包一层、把退出码打印在输出末尾
（`[gemworks exit N]`，调用后读回来——Codex 的结果不带退出码；命令自己的退出状态照样到
Codex；Windows 上不包）。这里的编辑器是 `apply_patch`：内置词典把它绑到 `edit`，补丁
只按路径判断，不扫它的文本。

### DeepSeek Harness

```sh
dsh plugin --profile web add gemworks
```

先不启动、只验证这一层，再启动：

```sh
dsh --profile web --dump-config   # 应能看到 "# == gemworks" 这一层
dsh --profile web
```

bundle 贡献三行：**监督器**（适配器模块 `dist/hosts/dsh/plugin.js`，按路径命名，dsh 才会
连同这个包的浏览器半边一起找到；按 agent 挂载；会话的工作目录里找不到流程时它什么都不做——
这就是 `onMissing: skip`）、**GEML MCP server**
（`npx -y @geml/geml mcp --root .`，限定在会话自己的项目目录内，于是模型一次改一个块
而不是重写整个文件），以及 `skills/` 下的四个**技能**——写作、代码图谱、gemworks 与
split-session（只用于 Claude Code 的会话，它自己写明了）。
要覆盖哪一行，在你 profile 的 `cordis.patch.yml` 里按 `id` 重写，注意把该行需要的每个键
都写全。

监督器那一行不设 `statechart`，于是流程按 `gemworks` 的方式、从会话的工作目录找；
要钉死一个文件，就在这一行里设 `statechart: <路径>`。没有流程的项目被安静地放过。有好几个
流程却没选、名字找不到、或者流程有 error 时，会记日志，这个 agent 不受监督——
`onMissing: fail` 则让它启动失败。

这个宿主上 `move` 与 `set` 在每次通过的动作之后重注册，所以 `move` 的枚举恰好是模型
能走的转换、`set` 的参数恰好是它能写的变量；类型不对的值在动词之前就被 dsh 自己的
校验器拒了。闸跑在 `tools/pre-execute` 里：拒绝就带理由 deny，词典里没有行的键照常放行。`pwsh`
是例外：它的命令行是 PowerShell，sh 的扫描器读不了，所以只有两条不用解析的规则对它
生效——只许人做的动词和封路用途的模式，在整段文字里搜索——它的退出码不记到任何
用途名下。

web GUI（`dsh --profile web`）里，**看板**是右侧栏的一个标签页：引导页列出「Gemworks」，
点开画的就是 Claude Code 看板的那些行——六个标签页里的五个（待处理、工作项、记录、
流程、工具；会话页是人的 prompt 列表与 Claude Code 记录文件上的动作，dsh 的会话是它
自己的）。按键在宿主上跑：人的转换、勾变量、暂停与继续，以及写进 `.geml/tools.geml` 的学习——
「设为首选」「在这个阶段也允许」与「加一行」输入框——监督器下一次判定就重读到。这个宿主
做不了的（导出、对话框、切换流程）不画按钮。文件链接经 dsh 自己的会话接口打开文件，
没有应用认领的就在文件管理器里显示。流程页的图在这里是同一份数据画成的 SVG：现在能走的转换用强调色画，点一下就走。两半分别是 `src/hosts/dsh/board.ts`（路由在
`/api/gemworks` 下）与 `client.js`（包的 `dsh.client` bundle）；监督器那一行按路径命名，
正是为了浏览器半边（见上）。journal 仍按会话记在 `journalDir` 下，会话恢复时读回。

### pi agent

```sh
pi install npm:gemworks
```

同一个包就是一个 pi package：`pi.extensions` 指向监督器，`pi.skills` 指向同样那
四个技能——它们本来就是一个技能一个 `SKILL.md` 文件夹，正是 pi agent 自己的约定。

流程在**扩展加载时**读一次，因为三个动词必须在第一个会话开始之前注册好，而它们
的 schema 来自流程。它按 `gemworks` 的方式从 pi 启动时所在的目录找；要换别的，用环境
变量说——那个时刻命令行 flag 还没解析：

```sh
GEMWORKS_STATECHART=path/to/workflow.geml pi   # 用这个流程，而不是项目的默认流程
GEMWORKS_JOURNAL_DIR=/var/journals pi      # 默认 <会话目录>/gemworks
```

没有流程时：不注册、不监听，`pi` 的行为和没装这个包完全一样。有好几个流程却没选、
名字找不到、或者流程有 error 时：每个会话都会说明，并且不受监督。

pi agent 这边有一件事只读过它发布的类型与随包文档、没有实测，接真模型跑的时候正是要看
它们：fork 之后 `getBranch()` 给的是分支还是整棵树（`hash`/`parent` 是按它
返回的东西算的，出问题由 `gemworks verify` 抓）。

不装 harness、只用 CLI，就是[在一个项目上开始用](advanced.zh.md#在一个项目上开始用)第 2 步装上的
`gemworks` 命令：

```sh
gemworks init
gemworks check .geml/workflows/coding.geml
```

git 变量询问 pull request 与 CI 时用的 `gh` 若不是 PATH 上那个，用 `GEMWORKS_GH` 指定。
