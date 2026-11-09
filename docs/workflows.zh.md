# 自带的固化流程：开发、事项、视频

[← 回到 README](../README.zh.md)

## 开发流程

`/gemworks add dev`（或 `gemworks init --template dev`）写出 `.geml/workflows/dev.geml`：
状态机后面跟着各阶段的提示词，词典行并进 `.geml/tools.geml`。它的工作项是分支
（`flow-unit = "branch"`），所以在默认分支上什么都不记。五个状态：

```
#build ──机器──▶ #review ──机器──▶ #deploy ──批准──▶ #release ──机器──▶ #done
   ▲                 │
   └── review 要求改动 ┘   （模型判）
```

| 状态 | 用途 |
|---|---|
| `#build` | `edit`、`test`、`pr` |
| `#review` | `edit`、`test` |
| `#deploy` | `deploy-staging` |
| `#release` | `deploy-prod` |

不凭模型一句话就推动它的，是证据：

| 变量 | source | 从哪读 |
|---|---|---|
| `tests-pass` | `{ "tool": "test" }` | 绑到 `test` 的一次调用的退出码——词典里的 `Bash(npm test)`、`Bash(cargo test)`……——在声明了 `test` 的状态里 |
| `pr-open`、`pr-merged`、`ci-pass` | `"pr-open"`、`"pr-merged"`、`"ci-success"` | gh：分支最新的 pull request 开着、已合并；`HEAD` 上每个 CI workflow 最近一次运行都成功 |
| `review-ready` | `"human"` | 人的勾选，在看板上或用 `gemworks mark review-ready` |
| `deployed-staging`、`deployed-prod` | `{ "tool": "deploy-staging" }`、`{ "tool": "deploy-prod" }` | 词典绑到该用途的 `wrangler deploy` 的退出码 |

1. **#build。** 写代码和测试。每跑一次 `npm test`，按退出码记下 `tests-pass`；阶段
   告诉模型不用报告。`build→review` 由机器判，通行要求三者满足其一即成立：测试通过且
   PR 已开；PR 已合并（Gemworks 没来得及看到它开着）；或者有人勾选了 `review-ready`——
   给测试只在 CI 里跑的项目。模型勾不了它：模型运行 `gemworks mark review-ready` 会被
   拒，`set` 拒绝写证据。
2. **#review。** 处理 review 意见。CI 的结论与合并状态是 git 的事实，所以 gh 要已
   登录。合并且 CI 通过后，`review→deploy` 把流程带到 `#deploy`。
3. **#deploy。** 部署到 staging。`deploy-staging` 是 `#deploy` 的用途，`deploy-prod` 是
   `#release` 的：在别的地方，这条命令在执行前被拒——词典有行的每种写法的
   `wrangler deploy --env staging`（`-e staging`、`--env=staging`，前面加 `npx`、`pnpm`
   或 `bunx`），以及带任何别的参数或不带参数的 `wrangler deploy`，它部署的是顶层环境，
   按 production 算。模式在整条命令行里找，`bash -c "…"` 里也找；词典里没有行的启动器、
   变量和脚本绕得过它，`--dry-run` 按它写的那个部署算。用别的工具部署，就把这些行
   改掉。
4. **#release。** `deploy→release` 要人，并且先得有一次 staging 部署：它的通行要求读
   `deployed-staging`。看板上点一下，或者在终端里运行 `gemworks advance release`，这就是
   批准。模型 `move` 到 `#release` 会被拒，并提示去看板。production 部署成功写下
   `deployed-prod`，`release→done` 结束这个工作项。

**退回重做。** `review→build` 由模型判（`review 要求改动`）或人走，并在同一个修订里把
`tests-pass` 与 `review-ready` 清回 false：上一轮跑绿的测试和勾过的 ready 都作废。流程
停在 `#build`，直到测试重新跑绿、人重新勾选 `review-ready`，或者 PR 已合并。一次转换
之后的第一条机器判的边从不回到这次转换刚离开的状态，所以单凭 git 的事实仍成立的通行
要求，也不会把流程立刻弹回去。

**过期。** `tool` 证据盖上工作项内容的章——工作副本的 git tree——在别的内容上写下的
值，到下一次操作时回到 false：改代码之前跑绿的测试，改了之后不算数。

`Bash(…)` 键匹配以它开头的命令，按整词算，`*` 匹配任意一段文字；字面部分最长的键优先
（`Bash(wrangler deploy*--env staging)` 赢过 `Bash(wrangler deploy)`）。把 `test` 的行
改成项目的测试命令、部署的行改成项目的部署命令，再让 guide 指向项目自己的约定。

## 事项流程

`/gemworks add matter`（或 `gemworks init --template matter`）写出
`.geml/workflows/matter.geml`。一件事项一个工作项：`.geml/matters/` 下的一个文件
（`flow-unit = "file:.geml/matters/*.geml"`），记一件事的现象、原因、方案和结果——修个
bug、改个界面、写一条文案。它在自己的 meta 里记着现在的阶段（`flow-state-key = "state"`），
状态跟着文件走。

```
#noted ──模型──▶ #deciding ──批准──▶ #doing ──机器──▶ #checking ──批准──▶ #done
   │                │                 ▲                 │
   └── 直接做（人按）────────────────┘◀──── 打回（人按）┘
                              #parked ⇄（人放下、人重新打开）
```

| 状态 | 用途 |
|---|---|
| `#noted`、`#deciding`、`#checking`、`#parked` | `note`：写事项文件本身 |
| `#doing` | `note`、`edit`（改别的文件）、`check` |

模型把事项写清原因和方案后推到 `#deciding`；其余每条出路都是人按的按钮。`#doing` 在
检查通过时（`check-pass`，来自用途 `check`）、或人勾上 `accept-now` 时自动进入
`#checking`；回到 `#doing` 时两者一起清掉。词典按路径把写文件的工具分开——
`Edit(.geml/matters/*)` 是 `note`，`Edit` 是 `edit`，字面部分最长的优先——也列了 pi 的
`edit`、`write`，所以在 pi 上同样有封路。

## 视频流程

`/gemworks add video`（或 `gemworks init --template video`）写出
`.geml/workflows/video.geml`：状态机后面跟着各阶段的提示词，词典行并进
`.geml/tools.geml`。它的工作项是一集：`episodes/` 下的每份 geml-media 文档
（`flow-unit = "file:episodes/*.geml"`），当前工作项是写入调用最近一次改动的那一集；
它不需要 git。七个状态：

```
#script ─机器─▶ #assets ─机器─▶ #cut ─机器─▶ #render ─机器─▶ #review ─机器─▶ #publish ─机器─▶ #done
                   ▲             ▲ ▲            │               │
                   │             │ └─ 出片失败 ──┘               │
                   │             └─────────── 要改剪辑 ──────────┤
                   └───────────────── 要重出镜头 ─────────────────┘
```

| 状态 | 用途 |
|---|---|
| `#assets` | `image`、`video`、`voice`、`import`、`log`、`todo-check` |
| `#cut` | `lay`、`stale-check` |
| `#render` | `render` |

不凭模型一句话就推动它的，是证据：

| 变量 | source | 从哪读 |
|---|---|---|
| `script-final`、`approved`、`published` | `"human"` | 人的勾选，在看板上或用 `gemworks mark` |
| `assets-done` | `{ "tool": "todo-check" }` | `geml media todo <本集> --check`，看退出码，在 `#assets` 里 |
| `no-stale` | `{ "tool": "stale-check" }` | `geml check <本集> --severity media-stale-clip=error`，看退出码，在 `#cut` 里 |
| `rendered` | `{ "tool": "render" }` | `geml media build … --out <文件>`，看退出码，在 `#render` 里 |

1. **#script。** 写这一集：分镜提示词（`media-text .prompt`）与台词
   （`media-text .line`）。一集只占一个文件——剧本、本集的素材块与生成日志、时间线都在
   里面——因为引用是有方向的，`geml media todo` 只看得见从这一集出发够得着的东西。
   人勾选 `script-final`（剧本定稿）；模型勾不了。
2. **#assets。** 按 `geml media todo episodes/epNN.geml --root . --json` 列出的待办
   生成，每做好一件用 `geml media import` 与 `geml media log` 登记。出图、出视频、配音
   的工具就是用途 `image`、`video`、`voice`：词典里没有它们的行，第一次调用引出的问题
   你答了才有，一行的 `params`（画幅、音色）补上模型没写的参数。
   `geml media todo episodes/epNN.geml --root . --check` 在没有待办时以 0 退出，
   `assets→cut` 把流程带到 `#cut`。
3. **#cut。** 排时间线（`geml media lay`；`geml media export --to player` 出预览）。
   `geml check episodes/epNN.geml --root . --severity media-stale-clip=error` 在没有
   片段用到过期素材时以 0 退出，接着走 `cut→render`。
4. **#render。** `geml media build … --out` 是用途 `render`，只有 `#render` 声明了它：
   在别的阶段，词典有行的每种写法都在执行前被拒（`geml` 前面加 `npx`、`bunx`、
   `pnpm dlx`、`yarn dlx` 或 `npm exec`；`-o` 代替 `--out`）。出片要写 `--out` 和文件，
   不写 build 不会运行，所以只有这样的出片命令才被绑定。进入 `#render` 要求过期检查
   通过，所以改了提示词却没重新生成，就出不了片。出片成功，流程到 `#review`。
5. **#review。** 人看完成片勾选 `approved`（审片通过），流程到 `#publish`；这一集发出去
   之后勾选 `published`（已发布），这个工作项到 `#done`。

输入框上方那一行显示这一集的待办数：
`⧗ episodes/ep02 · assets · 待办 7 项 · assets-done ✗ · → #cut 自动 · 待 assets-done`。
它在会话开始、打开或刷新看板时，由解析器的 `todo` 在进程内算出——就是
`geml media todo <文件> --root . --json` 列出的那些——只在这一集还停在数它时的阶段时
显示，阶段一变就不再显示。超过 999 项显示 `待办 999+ 项`。数的时候出错或超过十秒，或者
解析器受限的文件宿主读不到这一集（链接到项目之外），就不显示数，而不是显示「无待办」。
没有变量读它。

**返工。** `review→assets`（重出镜头）与 `review→cut`（改剪辑）由模型 `move` 或人在
看板上走。两条都在同一个修订里清掉上一轮的证据：`review→assets` 把 `assets-done`、
`no-stale` 与 `rendered` 清回 false，`review→cut` 清 `no-stale` 与 `rendered`。所以待办
检查、过期检查与出片都要重新过一遍，新片也要等人再勾 `approved`。出片失败也这样回去：
`render→cut` 清掉 `no-stale`。并且每个 `tool` 变量都在这一集的文件变了之后过期：改之前
通过的检查，改了之后不算数。

每条命令都写本集的文件并带 `--root .`：词典读的是命令行，在 `file:` 单位下，一条命令的
证据记到它命令行写到的那一集名下，相对它运行的目录。
`geml media todo --check` 在 `@geml/geml` 尚未发布的改动里；发布之前，用本仓库里的
解析器运行（`node geml-parser/dist/cli.js media todo …`），并给这种写法加一行。
