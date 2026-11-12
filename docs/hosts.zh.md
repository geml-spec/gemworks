# 各宿主的安装与用法

[← 回到 README](../README.zh.md)

## 安装

### Claude Code

```text
/plugin marketplace add geml-spec/geml
/plugin install gemworks --marketplace geml-spec/gemworks
```

在会话的输入框里逐行输入（Claude Code 2.1.275 以上），装的时候选范围。第一行加的是
GEML 自己的插件市场：gemworks 依赖 geml 插件，加了这个市场，装 gemworks 时会一并装上
geml；没加的话 gemworks 能装上，但加载不起来。第二行加上 gemworks 的市场并安装，这个市场
里的条目从 npm 装已发布的 `gemworks` 包。在命令行里依次用
`claude plugin marketplace add geml-spec/geml`、
`claude plugin marketplace add geml-spec/gemworks`、
`claude plugin install gemworks@gemworks` 也一样。

装上之后：

- **输入框上方常驻一行**，终端和桌面 app 都有：Gemworks 的标志，然后是此刻轮到你的
  那一件事——回答末尾提的问题、只有你能判的一步、固化流程里要批准或要勾的变量、模型在
  一次被拒的调用上卡住、桥接坏了——带至多三个选项按钮，主选项在前；不点，直接打字回答
  也行。还有别的事在等时，`还有 N 件` 点开看板。没有事等你时，写模型在做什么（`我在做`）
  和工作项走到哪一步；暂停了的工作项只给「继续」。右边是今天新学到几条做法、有几条提议
  在等（点了都打开流程页），然后是「看板」按钮，桌面 app 上旁边还有截图按钮。第一次读
  这个项目以前的会话时，这一行显示读到第几个。项目里没有自己的流程时用轻流程，所以这一行
  从不说缺流程；桥接还没应答时写"启动中"。文字跟着偏好语言或系统语言走：中文、English、
  日本語。
- **`/gemworks`**：当前状态；`/gemworks board [标签]` 打开看板（`sessions`、`items`、
  `made`、`flow`、`tools`）；`/gemworks pause`、`/gemworks resume` 暂停、继续工作项；
  `/gemworks use <流程>` 改默认的固化流程；`/gemworks add` 列出内置的固化流程，
  `/gemworks add <流程>` 把一份复制进 `.geml/workflows/`——项目还没有固化流程时同时设为
  默认流程，否则提示用 `/gemworks use`；`/gemworks trace on|off` 把点击和画面记到
  `.geml/trace.log`，排查看板问题时用。项目里没有固化流程时，`/gemworks` 说明它在用轻流程，
  并按目录里有什么建议一个内置的固化流程（有 geml-media 文档或 `episodes/` 建议 video；
  有 wrangler、fly、vercel、Dockerfile 一类部署配置建议 dev；有 package.json、Cargo.toml
  一类构建清单建议 coding；都没有建议 dev）。
- **看板**，五个页签，打开停在「工作项」。**会话**：本会话的每一轮，问了什么、做了什么；
  一轮可以定位到对话里那一处，「整理」里勾中的轮次可以用随附的 `split-session` skill 拆成
  单独的会话或删掉，原会话先备份；然后是这个项目的其他会话、项目的 Claude Code 记忆、
  各会话定下的事。每个会话标题旁的「导出」把记录导出为 GEML，先问存到哪：下载、桌面、
  本项目的 `.geml/exports/`，或自己填的文件夹、文件。**工作项**：最上面是等你的事，
  每项带按钮（一个问题、只有你能判的一步、通行要求已满足的批准、要勾的变量、模型在一次
  被拒的调用上卡住、桥接坏了）；然后是进行中的工作项，各走到哪一步、还差什么；再是固化
  流程按结局分组的工作项——在做、已合并、已收尾、放下，各带 worktree、提交和 PR；已合并
  但 worktree 或分支还在的，出一张收尾卡片——以及 backlog。**产物**：项目里做出来的一切，
  不论哪个工作项做的——文件、提交、页面、链接——按版本列着，点开就看。**流程**：每条
  流程有哪几步、每一步防什么坑、上面挂着哪些做法、有哪些提议在等；「固化流程」下面是从
  模型画出的流程图，叠着运行时——现在能走的出边是带数字热键的按钮，桌面、编辑器、手机、
  终端都一样——标题旁可以展开添加内置的固化流程，或从路径导入一份。**工具**：词典每一行
  在当前状态的处境，能就地改的都有按钮，输入框加一行。头部常驻分享（现在在哪、一条流程、
  本会话、或固化流程里这个工作项的记录——复制文字、写到 `.geml/exports/`、或发 PR 评论）、
  设置（偏好语言、打字回答状态带上的问题、从你的纠正里学、桌面提醒）、升级、关于。
- **模型可调的工具**，列为 `mcp__gemworks__<名字>`：`work`（这一轮涉及的工作项）、`note`
  （这一轮定下的事，给项目的其他会话看）、`practice`（学到的做法，挂在它所属的那一步上）、
  `propose`（提议加一步或一类新活，由你在流程页上同意）、`ask`（这一轮末尾的问题，挂到
  状态带上）、`artifact`（gemworks 自己看不到的链接或生成的文件）、`rule`（你在一条做法上
  点了「改成规定」之后才用）；固化流程还有 `status`、`move`、`set`。它们的 schema 不随
  状态变，prompt 缓存不会因此失效。调用 `status`、`move`、`set` 从不被闸拒；动词自己的
  规矩——三种判断者、带 source 的变量——照样生效。
- **词典里没有行的工具照常放行，不问人**：它安不安全，由宿主自己的权限系统按实际参数判断。
  词典只回答"这是哪个用途"，从而决定它在哪些阶段能用；要拒绝或绑定，在看板或
  `.geml/tools.geml` 里写一行。绑到某个用途、但该用途的首选是另一个工具（`default` = `yes`）
  的工具会问一次——只这一次，或者改成首选——一行的 `params` 补上调用没写的参数。
- **把阶段的上下文交给模型。** 一次调用让阶段变了，新的 `#current` 随这次调用的结果交给
  模型；两次提交之间变了（人在看板上推进了、会话开始时补齐了 git 的事实），随下一次
  提交交给模型。子 agent 的调用让阶段变了，子 agent 读到它，主线程的下一次提交也照样
  带上。在另一个检出（子 agent 的 worktree）里的工具调用按那个检出的工作项裁决，它的
  阶段交给在那里干活的子 agent。`/clear` 之后的下一次提交重新带上。

要加一条固化流程，从 `/gemworks add dev`（或 `npx -y @geml/gemworks init --template dev`）开始，
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
`edit: Edit`、`test: Bash(npm test)`）——模型看得见的告示牌；调用绑到封路用途（写在
状态的 `rules` 里的用途）、而本状态没声明这个用途的工具，在调用时、执行之前被拒
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
npm install && npm run build
claude --plugin-dir .
npm run test:claude   # 构建，再 claude plugin validate + claude plugin test
```

### 其他宿主（MCP）

`gemworks mcp` 用 stdio MCP 提供模型可调的工具：工作循环的 `work`、`practice`、
`propose`、`answer`（照你对一条提议的回答去做）、`ask`、`artifact`，`note`，以及固化流程的
`status`、`move`、`set`。在宿主的 MCP 配置里登记为 `npx -y @geml/gemworks mcp --host <宿主>`
（宿主在项目之外启动服务时加 `--root <目录>`）。skill `skills/gemworks-mcp/SKILL.md`
要求模型每轮先调用 `status`——阶段、进行中的工作项、这一步的做法都在里面——这类宿主
没有把它们交给模型的通道。这类宿主没有的：

- 没有输入框上方那一行，也没有看板面板：看板是下面那一页 GEML，上面没有按钮，所以人在
  终端里用 `gemworks advance` 与 `gemworks mark` 推进固化流程、勾变量。
- Gemworks 看不到宿主的任何工具调用，所以 `tool` 证据永远写不了、什么都不拒——封路的
  用途与只许人做的命令都一样。通行要求不论谁推进都生效，`gemworks advance` 也一样，所以
  通行要求要读 `tool` 证据的转换，只有在它也接受一个人勾的变量时才走得了：开发流程的
  `review-ready` 能把 `#build` 带到 `#review`，`#release` 却等着 production 部署的退出码，
  在这类宿主上永远到不了 `#done`，除非给它的通行要求加一个 `human` 变量。
- git 与文件变量在模型调用 `status` 时读；改变了阶段的 `move` 把新的 `#current` 附在
  结果后面。
- 模型走标了 `approval` 的转换会被拒，与 Claude Code 上一样。

**一页 GEML 看板。** 没有自己面板的宿主拿到项目主检出里的 `.geml/board.geml`：等你定的事、
工作项、产物、流程，还有别的会话定下的事。模型每次用这些工具记下东西都会重写它（Codex 和
Antigravity 上每条提示词、每轮结束时也重写），每个会话打开一次：会话开始时有进行中的
工作项就打开，否则在第一次记下东西时打开；`GEMWORKS_OPEN_BOARD=0` 只写不打开。语言按
`GEMWORKS_LANG`（`zh`、`en` 或 `ja`），没设就按系统语言。在 VS Code 一类的编辑器里装上
GEML 扩展，侧边打开就能看，文件一改自动刷新；也可以用 Chrome 的 GEML Viewer 看，不过要
手动刷新。这页上没有按钮，要你定的事直接在对话里回答。

### Codex

Codex 照上面拿到 MCP 工具和那一页 GEML 看板，hooks 信任之后还拿到每条提示词旁的工作循环
和闸：插件的 `.codex-plugin/plugin.json` 指向 `host-skills/`、`codex/mcp.json`
（`node ./dist/gemworks.mjs mcp --host codex`）和 `codex/hooks.json`——SessionStart、
UserPromptSubmit、PreToolUse、PostToolUse、Stop 都跑 `node "${PLUGIN_ROOT}/dist/gemworks.mjs" codex`。
从本仓库的 Codex marketplace（`.agents/plugins/marketplace.json`，它从 npm 装 `@geml/gemworks`，
所以本机要有 npm）装：终端里先 `codex plugin marketplace add geml-spec/gemworks`，再
`codex plugin add gemworks@gemworks`，然后在 Codex 里 `/hooks` 逐条审阅、信任这五个 hook——
装插件不等于信任，没信任的 hook 一声不响地跳过。

hooks 信任之后，Codex 上有的就是 Claude Code 上的减去状态带和看板面板：会话开始时告诉
模型工作循环的工具和各条流程的步骤，有进行中的工作项就打开那一页看板；每条提示词带上
进行中的工作项、当前这一步的做法和别的会话新定下的事；改了东西却没报工作项的一轮，在
结束时被打回一次；阶段文字在会话开始、变化之后的下一条 prompt、以及改变了它的那次调用的
结果里交给模型；封路用途或只许人做的命令
被拒并说明原因；词典里没有行的工具照常放行；工具的默认参数补齐；补丁写的文件，以及回合结束时的回答和这一轮的提交，记进项目的会话记录；退出码是证据的 shell 命令被包一层、把退出码打印在输出末尾
（`[gemworks exit N]`，调用后读回来——Codex 的结果不带退出码；命令自己的退出状态照样到
Codex；Windows 上不包）。这里的编辑器是 `apply_patch`：内置词典把它绑到 `edit`，补丁
只按路径判断，不扫它的文本。

### Antigravity

```sh
npm install -g @geml/gemworks
gemworks antigravity install
```

第二行把 gemworks 的 hooks 写进 `~/.gemini/config/hooks.json`，把 gemworks 的 MCP server 写进
`~/.gemini/config/mcp_config.json`，两处都指向刚装的这份 `gemworks`；它会打印这两个文件的路径。
Antigravity 的 App、CLI 和 IDE 共用这套 hooks。

装上之后，模型用 MCP 工具记工作项、做法、提议、产物和定下的事；会话开始时 hook 交代这些工具和
流程的步骤，每条提示词旁边带上进行中的工作项、这一步的做法和别的会话新定下的事。工作台是上面那页
GEML 看板（`.geml/board.geml`），每条提示词和每轮结束时重写。和 Codex 一样，没有状态带和看板按钮，
要你定的事在对话里回答；「改成规定」和从纠正里学的纠正账本这里都没有。geml 插件目前没有 Antigravity
版，看这页看板要用 VS Code 一类编辑器（Antigravity IDE 也行）的 GEML 扩展，或者 Chrome 的 GEML Viewer。

### Cursor

```sh
npm install -g @geml/gemworks
gemworks cursor install
```

第二行把 gemworks 的 hooks 写进 `~/.cursor/hooks.json`，把 gemworks 的 MCP server 写进 `~/.cursor/mcp.json`，
两处都指向刚装的这份 `gemworks`；它会打印这两个文件的路径。这两个文件里你自己的 hooks 和 MCP 服务都保留，再跑一次
会替换上一次装的。装完重新加载 Cursor 窗口。

Cursor 拿到的和 Codex 一样：会话开始时交代工作循环的工具和流程的步骤，上面那页 GEML 看板，还有闸门。围起来的用途和
只归人的命令会被拒并说明原因；工具的默认参数会补上；退出码算证据的 shell 命令会包一层，最后打印
`[gemworks exit N]`（Windows 上不包）；agent 改的文件、这一轮的回答和它做的提交进项目的会话记录；一轮改了东西却没报
工作项，会用一条追问消息送回去一次，这条消息不算你说的话。

和 Codex 不同的有两处，都是 Cursor 的 hooks 决定的：

- Cursor 的提示词 hook 不能对模型说话。Codex 放在提示词旁边的内容（进行中的工作项、这一步的做法、别的会话定下的事、
  新的阶段文本）改成随这一轮第一次工具调用的结果送到。一轮没调工具的话，下一次调用时才送到。
- Cursor 的工具叫 `Shell`、`Write`、`Read`、`Grep`、`Delete` 和 `MCP:<工具名>`。闸门按 Claude Code 的名字读：
  `Shell` 当 `Bash`，`Write` 还是 `Write`，其他写文件的工具当 `Edit`。给 Cursor 写词典行也用这些名字；自带的词典
  不用改。

hooks 在 `~/.cursor` 下运行，所以项目是工作区里带 `.geml/` 的那个文件夹，没有就取第一个。MCP 服务和 Antigravity
一样，从 hooks 那里得知当前对话和项目：同时开着两个 Cursor 窗口时，它写给最后跑过 hook 的那个。和 Codex 一样，没有
状态带和看板按钮；「改成规定」和纠正账本这里都没有。看板页用 GEML 扩展看，Cursor 能跑 VS Code 扩展。

### Qwen Code

```sh
npm install -g @geml/gemworks
gemworks qwen install
```

第二行把 gemworks 的 hooks 和 MCP 服务写进 `~/.qwen/settings.json`，都指向刚装的这份 `gemworks`；它会打印这个文件的
路径。你自己的 hooks、MCP 服务和其他设置都保留，再跑一次会替换上一次装的。设置文件里有注释的话不会动它：命令会说明，
hooks 要手工加。装完重新启动 Qwen Code。

Qwen Code 的 hooks 就是 Claude Code 那一套，所以它拿到的和 Codex 一样，提示词旁边的内容也有：会话开始时交代工作循环的
工具和流程的步骤；每条提示词旁边带上进行中的工作项、这一步的做法、别的会话定下的事和新的阶段文本；上面那页 GEML
看板；还有闸门。围起来的用途和只归人的命令会被拒并说明原因；工具的默认参数会补上；退出码算证据的 shell 命令会包一层，
最后打印 `[gemworks exit N]`（Windows 上不包），没包的时候读 shell 工具自己的 `Exit Code:` 一行；agent 写的文件、
这一轮的回答和它做的提交进项目的会话记录；一轮改了东西却没报工作项，会送回去一次，这条提醒不算你说的话。闸门放行的
调用，Qwen Code 照样会请你批准，跟没装 gemworks 时一样。

Qwen Code 的工具叫 `run_shell_command`、`write_file`、`edit`、`notebook_edit`、`read_file`、`grep_search`、`glob`
和 `mcp__<服务>__<工具>`。闸门按 Claude Code 的名字读（`Bash`、`Write`、`Edit`、`NotebookEdit`、`Read`、`Grep`、
`Glob`，MCP 工具按它自己的名字），所以自带的词典不用改。项目是 `QWEN_PROJECT_DIR`，也就是启动 Qwen Code 的那个
文件夹；MCP 服务也在那里启动。和 Codex 一样，没有状态带和看板按钮；「改成规定」和纠正账本这里都没有。

### OpenCode

```sh
npm install -g @geml/gemworks
gemworks opencode install
```

第二行把一个小插件写进 OpenCode 的全局插件文件夹 `~/.config/opencode/plugins/gemworks/`（设了 `$XDG_CONFIG_HOME`
就放在它下面），指向刚装的这份 `gemworks` 和运行它的 Node，并打印写下的文件。再跑一次会替换它们，删掉这个文件夹就
卸掉了 gemworks。MCP 服务由插件自己注册，所以你的 `opencode.json` 不会被改。装完重新启动 OpenCode。这是给 OpenCode 2
（`@opencode/cli`）的；OpenCode 1 的插件是另一套 API。

OpenCode 在自己的进程里跑插件，所以插件在每个 hook 上问 `gemworks opencode`，照它说的做。它拿到的和 Qwen Code 一样：
会话的第一条提示词到来时交代工作循环的工具和流程的步骤（OpenCode 没有会话开始的 hook）；每条提示词带上进行中的工作项、
这一步的做法、别的会话定下的事和新的阶段文本，放在这一轮每次模型请求的系统部分里；上面那页 GEML 看板；还有闸门。
围起来的用途和只归人的命令会被拒并说明原因，OpenCode 把原因当作工具的错误交给模型；工具的默认参数会补上；退出码算证据的
shell 命令会包一层，最后打印 `[gemworks exit N]`（Windows 上不包），没包的时候读 shell 工具自己给的退出码；调用之后
模型该看的内容附在结果后面；agent 写的文件和它做的提交进项目的会话记录；一轮改了东西却没报工作项，会话要空闲时会用一条
合成消息送回去一次。OpenCode 的空闲 hook 不给回答的文本，所以这一轮的回答不进记录。

OpenCode 的工具叫 `shell`、`write`、`edit`、`patch`、`read`、`grep`、`glob`、`webfetch`、`websearch`、`todowrite`、
`subagent` 和 `<服务>.<工具>`。闸门按 Claude Code 的名字读（`Bash`、`Write`、`Edit`——patch 按它的第一个文件——、
`Read`、`Grep`、`Glob`、`WebFetch`、`WebSearch`、`TodoWrite`、`Task`，MCP 工具按它自己的名字），所以自带的词典不用改。
项目是打开 OpenCode 的那个文件夹。和 Codex 一样，没有状态带和看板按钮；「改成规定」和纠正账本这里都没有。

### Devin（原 Windsurf）

```sh
npm install -g @geml/gemworks
gemworks devin install
```

Windsurf 现在叫 Devin Desktop，它和 Devin CLI 共用一套 hooks。第二行把 gemworks 的 hooks 写进
`~/.config/devin/config.json` 的 `hooks` 下，把 MCP 服务写进 `~/.config/devin/mcp_config.json`（Windows 上两个都在
`%APPDATA%\devin\`），都指向刚装的这份 `gemworks`，并打印这两个文件。你自己的 hooks、MCP 服务和其他设置都保留，
再跑一次会替换上一次装的。两个文件里任何一个有注释，两个都不动：命令会说明，hooks 要手工加。装完重新启动 Devin；
`/hooks` 会列出它加载了哪些。

Devin 的 hooks 就是 Claude Code 那一套，所以它拿到的和 Qwen Code 一样：会话开始时交代工作循环的工具和流程的步骤；
每条提示词旁边带上进行中的工作项、这一步的做法、别的会话定下的事和新的阶段文本；上面那页 GEML 看板；还有闸门。
围起来的用途和只归人的命令会被拒并说明原因（hook 以 2 退出，这是 Devin 拦调用的方式）；工具的默认参数会补上；
退出码算证据的 shell 命令会包一层，最后打印 `[gemworks exit N]`（Windows 上不包）——Devin 自己不报退出码，所以没包的
命令退出码未知；agent 写的文件、这一轮的回答和它做的提交进项目的会话记录；一轮改了东西却没报工作项，会送回去一次。

Devin 的工具叫 `exec`、`write`、`edit`、`apply_patch`、`notebook_edit`、`read`、`grep`、`glob`、`webfetch`、
`todo_write`、`run_subagent` 和 `mcp__<服务>__<工具>`。闸门按 Claude Code 的名字读（`Bash`、`Write`、`Edit`——
patch 按它的第一个文件——、`NotebookEdit`、`Read`、`Grep`、`Glob`、`WebFetch`、`TodoWrite`、`Task`，MCP 工具按它自己的
名字），所以自带的词典不用改。项目是 `DEVIN_PROJECT_DIR`。Devin 的文档没说 MCP 服务在哪个文件夹启动，所以服务自己的
文件夹里没有 `.geml/` 时，它就用 hooks 最后看到的那个项目和会话。和 Codex 一样，没有状态带和看板按钮；「改成规定」和
纠正账本这里都没有。

### TRAE

```sh
npm install -g @geml/gemworks
gemworks trae install
```

第二行把 gemworks 的 hooks 写进 `~/.trae/hooks.json` 和 `~/.trae-cn/hooks.json`——国际版和国内版，有哪个写哪个，两个都没有就都写——
指向刚装的这份 `gemworks`，并打印这些文件。你自己的 hooks 都保留，再跑一次会替换上一次装的；文件里有注释的话不会动它。TRAE 的
MCP 服务存在它自己的设置里，所以命令最后还会打印 gemworks 服务的配置：在「设置 → MCP → 手动添加」里加上。装完重新启动 TRAE。

TRAE 的 hooks 就是 Claude Code 那一套，所以它拿到的和 Qwen Code 一样：会话开始时交代工作循环的工具和流程的步骤；每条提示词旁边
带上进行中的工作项、这一步的做法、别的会话定下的事和新的阶段文本；上面那页 GEML 看板；还有闸门。围起来的用途和只归人的命令会被拒
并说明原因；工具的默认参数会补上；退出码算证据的 shell 命令会包一层，最后打印 `[gemworks exit N]`（Windows 上不包）；agent 写的文件、
这一轮的回答和它做的提交进项目的会话记录；一轮改了东西却没报工作项，会送回去一次。闸门放行的调用，如果那个工具设成了要确认，TRAE
照样会请你确认。

TRAE 的工具本来就用 Claude Code 的名字（`Read`、`Write`、`Edit`、`Glob`、`Grep`、`LS`、`WebSearch`、`WebFetch`、`Skill`、
`mcp__<服务>__<工具>`），只有 shell 叫 `RunCommand`，闸门按 `Bash` 读它；自带的词典不用改。项目是含 `.geml/` 的那个工作区根目录，
没有的话就是 TRAE 打开的文件夹。TRAE 的文档没说 MCP 服务在哪个文件夹启动，所以服务自己的文件夹里没有 `.geml/` 时，它用 hooks
最后看到的那个项目和会话。和 Codex 一样，没有状态带和看板按钮；「改成规定」和纠正账本这里都没有。

### Kiro

```sh
npm install -g @geml/gemworks
gemworks kiro install            # Kiro CLI V3：所有工作区
gemworks kiro install .          # Kiro IDE：再加上这个项目
```

命令写 hook 文件 `~/.kiro/hooks/gemworks.json`，Kiro CLI V3 会在每个工作区运行它；再把 MCP 服务写进 `~/.kiro/settings/mcp.json`，
和你别的服务放在一起。Kiro IDE 只读工作区自己的 `.kiro/hooks/`，所以要给出项目目录（上面的 `.`），再写一份
`<项目>/.kiro/hooks/gemworks.json`；这份文件里是本机 `gemworks` 的路径，仓库和别人共用的话别提交它。再跑一次会替换这些文件；
MCP 配置里有注释的话，什么都不动。装完重新启动 Kiro。

Kiro 的 hooks 能做的比 Claude Code 少，所以它拿到的比 Qwen Code 少：hook 成功时打印的内容以纯文本加进 agent 的上下文，hook 失败时
错误会发给 agent，在工具运行前失败就拦下这次调用。所以会话开始时交代工作循环的工具和流程的步骤，每条提示词带上进行中的工作项、
这一步的做法、别的会话定下的事和新的阶段文本；围起来的用途和只归人的命令会被拒并说明原因；agent 写的文件和它做的提交进项目的
会话记录。hook 改不了调用的输入，所以不补默认参数，也不包命令：测试命令的退出码只能看 shell 工具结果里报的。一轮结束时，改了东西
却没报工作项的，会收到一次提醒——Kiro 的文档说 agent 会读到它，没说 agent 会为它再跑一轮。

Kiro 在不同界面里给工具起的名字不一样——`shell`、`execute_bash`、`executeBash`；`write`、`fs_write`、`fsWrite`、`strReplace`；
`read`、`fs_read`、`readFile`；`grep`、`glob`、`web_fetch`、`web_search`、`subagent`，以及 `mcp_<服务>_<工具>`——闸门把每种写法
都按 Claude Code 的名字读，所以自带的词典不用改。项目是 Kiro 运行 hook 的那个文件夹，也就是项目根目录。Kiro 的文档没说 MCP 服务在
哪个文件夹启动，所以服务自己的文件夹里没有 `.geml/` 时，它用 hooks 最后看到的那个项目和会话。和 Codex 一样，没有状态带和看板按钮；
「改成规定」和纠正账本这里都没有。

### DeepSeek Harness

```sh
dsh plugin --profile web add @geml/gemworks
```

先不启动、只验证这一层，再启动：

```sh
dsh --profile web --dump-config   # 应能看到 "# == gemworks" 这一层
dsh --profile web
```

bundle 贡献三行：**适配器**（模块 `dist/hosts/dsh/plugin.js`，按路径命名，dsh 才会
连同这个包的浏览器半边一起找到；在 `agent/created` 时按 agent 挂载）、**GEML MCP server**
（`npx -y @geml/geml mcp --root .`，限定在会话自己的项目目录内，于是模型一次改一个块
而不是重写整个文件），以及 `host-skills/` 下的四个**技能**——`geml`、`geml-code-graph`、
`gemworks-mcp` 与 `split-session`（只用于 Claude Code 的会话，它自己写明了）。
要覆盖哪一行，在你 profile 的 `cordis.patch.yml` 里按 `id` 重写，注意把该行需要的每个键
都写全。

每个会话都有工作循环，有没有流程都一样：会话记进项目共用的记录（提示词、回答、写过的
文件、做的提交），模型拿到工作循环的工具和 `note` 工具，名字是 `gemworks_<名字>`，每一步的
上下文都带上进行中的工作项、当前这一步的做法和别的会话定下的事。**监督器**——固化流程的
闸和动词——只在会话的工作目录里找得到流程时才挂上。这一行不设 `statechart`，于是流程按
`gemworks` 的方式找；要钉死一个文件，就在这一行里设 `statechart: <路径>`。没有流程的项目
不挂监督器，也不出声（`onMissing: skip`）。有好几个流程却没选、名字找不到、或者流程有
error 时，会记日志，这个 agent 不受监督——`onMissing: fail` 则让它启动失败。

这个宿主上 `move` 与 `set` 在每次通过的动作之后重注册，所以 `move` 的枚举恰好是模型
能走的转换、`set` 的参数恰好是它能写的变量；类型不对的值在动词之前就被 dsh 自己的
校验器拒了。闸跑在 `tools/pre-execute` 里：拒绝就带理由 deny，词典里没有行的键照常放行。`pwsh`
是例外：它的命令行是 PowerShell，sh 的扫描器读不了，所以只有两条不用解析的规则对它
生效——只许人做的动词和封路用途的模式，在整段文字里搜索——它的退出码不记到任何
用途名下。

web GUI（`dsh --profile web`）里，**看板**是右侧栏的一个标签页：引导页列出「Gemworks」，
点开画的就是 Claude Code 看板的那些行。在固化流程下的会话有四个页签（工作项、记录、
流程、工具）；没有固化流程的会话有两个（工作项、流程），问题、步骤和提议都在对话里回答。
这里没有会话页：在 Claude Code 上它是人的 prompt 列表与 Claude Code 记录文件上的动作，
dsh 的会话是它自己的，所以这里留着记录页，看会话里发生了什么。按键在宿主上跑：人的转换、勾变量、暂停与继续，以及写进 `.geml/tools.geml` 的学习——
「设为首选」「在这个阶段也允许」与「加一行」输入框——监督器下一次判定就重读到。这个宿主
做不了的（导出、对话框、切换流程）不画按钮。文件链接经 dsh 自己的会话接口打开文件，
没有应用认领的就在文件管理器里显示。流程页的图在这里是同一份数据画成的 SVG：现在能走的转换用强调色画，点一下就走。两半分别是 `src/hosts/dsh/board.ts`（路由在
`/api/gemworks` 下）与 `client.js`（包的 `dsh.client` bundle）；适配器那一行按路径命名，
正是为了浏览器半边（见上）。journal 按会话记在 `journalDir` 下，会话恢复时读回。

### pi agent

```sh
pi install npm:@geml/gemworks
```

同一个 npm 包就是一个 pi package：`pi.extensions` 指向扩展，`pi.skills` 指向
`host-skills/`，同样那四个技能——它们本来就是一个技能一个 `SKILL.md` 文件夹，正是 pi agent
自己的约定。

工作循环不需要流程。在每个项目里，扩展都注册工作循环的工具和 `note` 工具，名字是
`gemworks_<名字>`，把每条提示词和回答记进项目共用的记录，并在每次运行的系统提示词里
带上进行中的工作项、当前这一步的做法和别的会话定下的事。编辑框上方有一到三行：本会话的
工作项走到哪、等你的第一件事和还有几件、这一步的第一条做法。`/gemworks` 以浮层打开看板
（Esc 或 q 关掉）。模型登记的问题在这次运行结束时带着选项问你；改了东西却没报工作项的
运行会被打回一次；你打的每条提示词由本会话自己的模型归类，记进你的纠正账本。

固化流程在**扩展加载时**读一次，因为三个动词必须在第一个会话开始之前注册好，而它们
的 schema 来自流程。它按 `gemworks` 的方式从 pi 启动时所在的目录找；要换别的，用环境
变量说——那个时刻命令行 flag 还没解析：

```sh
GEMWORKS_STATECHART=path/to/workflow.geml pi   # 用这个流程，而不是项目的默认流程
GEMWORKS_JOURNAL_DIR=/var/journals pi      # 默认 <会话目录>/gemworks
```

没有流程时：没有动词也没有闸，不出声；工作循环照上面那样跑。有好几个流程却没选、
名字找不到、或者流程有 error 时：每个会话都会说明，并且不受监督。

pi agent 这边有一件事只读过它发布的类型与随包文档、没有实测，接真模型跑的时候正是要看
它们：fork 之后 `getBranch()` 给的是分支还是整棵树（`hash`/`parent` 是按它
返回的东西算的，出问题由 `gemworks verify` 抓）。

不装 harness、只用 CLI，就是[在一个项目上开始用](advanced.zh.md#在一个项目上开始用)第 1 步装上的
`gemworks` 命令（`npm install -g @geml/gemworks`）：

```sh
gemworks init
gemworks check .geml/workflows/coding.geml
```

git 变量询问 pull request 与 CI 时用的 `gh` 若不是 PATH 上那个，用 `GEMWORKS_GH` 指定。
