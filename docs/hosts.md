# Installing and using it on each host

[← Back to README](../README.md)

## Install

### Claude Code

```text
/plugin marketplace add geml-spec/geml
/plugin marketplace add geml-spec/gemworks
/plugin install gemworks@gemworks
```

Type them at the prompt of a session, one at a time, and pick a scope at the
last. The first adds the marketplace of GEML's own plugin: gemworks depends on
`geml`, and with that marketplace added, installing gemworks installs geml too;
without it gemworks installs but does not load. The gemworks marketplace
installs the published `gemworks` package from npm. From a shell, the same is
`claude plugin marketplace add …` and `claude plugin install gemworks@gemworks`.

What you get:

- **A line above the prompt**, on the terminal and the desktop app:
  `G · ⧗ feat/rate-limit · review · ci-pass ✓ · pr-merged ✓ · → #deploy 需批准  [批准] [打回 build] [待处理 3]`
  — GEML's G mark, the work item, the stage, the variables the next guards
  read, the next step and what it waits for; then the one or two actions the
  moment needs (approve or send back, tick, allow once, resume, retry) and the
  pending count in red, which opens the board's inbox; a Board button ends the
  line whenever there is a workflow. A yellow segment says
  when gh cannot be asked; a work item on another workflow than the default
  names it; a paused item says so. On the default branch it reads
  `⧗ main · not tracked (work items are branches)`; in a project with no
  workflow it says so and names the bundled workflow that fits what the
  directory holds (a geml-media document or `episodes/`: video; a deploy
  configuration such as wrangler, fly, vercel or a Dockerfile: dev; a build
  manifest such as package.json or Cargo.toml: coding; nothing recognisable:
  dev), one button adds it and another opens the settings to pick a different
  one; before the bridge has answered it says it is starting. The words follow
  the language setting or the system's locale: Chinese, English or Japanese.
- **`/gemworks`**: where the work stands; `/gemworks board [tab]` opens the
  board; `/gemworks pause` and `/gemworks resume` hold and release the work
  item; `/gemworks use <workflow>` changes the default workflow; `/gemworks add`
  lists the bundled workflows and `/gemworks add <workflow>` copies one into
  `.geml/workflows/` — the default when the project has none yet, otherwise
  it offers `/gemworks use`.
- **The board**, six tabs, opening on the inbox: 待处理 (everything only a
  person can do — approvals whose guard holds, variables to tick, a model
  stuck on one refused key, a bridge that is down — each with its buttons),
  工作项 (first what the current work item's work made — its `#result`
  section, the files it wrote, its commits — then every work item by where it
  ended up: 在做, 已合并, 已收尾 and 放下, each with its worktree, its commits
  and its pull request; a merged one whose worktree or branch is still there is
  a card to close it, which has the model remove both once its commits are in
  main; then the backlog), 记录 (a "since you left" digest, then
  the journal newest first with filters; an entry expands to its evidence:
  what changed, which call, on which content, whether it still counts), 流程
  (the flow drawn from its model with the runtime laid over it — each rank a
  row of state boxes, the current one in the accent, a badge for the items
  standing in a state; under each rank the ways out of its states, one line
  each, with whether a condition holds, and a way out you may take now is a
  numbered button, its number the hotkey — on every surface, the terminal
  included; then the clocks and the variables a person ticks), 工具 (the
  dictionary, each row with its
  standing in the current state and what you can change in place; a field adds
  a row) and 会话 (your prompts grouped by the stage they were sent in, with
  what each turn did; a selected prompt can be scrolled to in the
  conversation, or handed to the model with the bundled `split-session`
  skill, which moves it and the turns after it — or it alone — into a
  session of its own, the record backed up first; each session's heading
  exports its record as GEML, asking where to put it: Downloads, the
  desktop, the project's `.geml/exports/`, or a folder or file typed in).
  The header carries
  share (where it stands, the journal, the session or the workflow — as text,
  a file under `.geml/exports/` or a PR comment), settings (desktop
  notifications, what the band shows, the default workflow, adding a bundled
  workflow or importing one from a path, the language), upgrade and about.
- **Three tools the model calls**: `status`, `move`, `set`, listed as
  `mcp__gemworks__status`, `mcp__gemworks__move`, `mcp__gemworks__set`. Their
  schemas never change with the state, so the prompt cache holds. A call to one
  is never refused by the gate; the verbs' own rules — the three judges, the
  variables with a source — still hold.
- **A tool the dictionary has no row for runs as usual, unasked.** Whether it is
  safe is the host's permission system's call, from the command's actual
  arguments. The dictionary says which use a tool is, and so where it may run;
  to deny or bind one, write a row on the board or in `.geml/tools.geml`. A tool bound
  to a use whose preferred tool is another (`default` = `yes`) is asked about
  once — this once, or make it the default — and a row's `params` fill in what
  the call left out.
- **The stage's context, handed to the model.** When a call moves the stage,
  the new `#current` rides on that call's result; when the stage moved between
  prompts (a person moved it on the board, session start caught up with git), it
  rides on the next prompt. A subagent's call that moves the stage tells the
  subagent, and the main thread's next prompt carries it too. A tool call in
  another checkout (a subagent's worktree) is judged by that checkout's work
  item, and its stage reaches the subagent working there. After `/clear` the
  next prompt carries the stage again.

Start a repository with `/gemworks add dev` (or
`npx -y gemworks init --template dev`), then set `.geml/tools.geml` to
your test and deploy commands and the stages' texts in
`.geml/workflows/dev.geml` to your conventions —
[The dev workflow](workflows.md#the-dev-workflow) walks through it.

**Node ≥ 22 is required.** The hooks module runs inside Claude Code with no
Node. Everything that touches the project — journals, `.geml/context.geml`, the
dictionary, the backlog — is done by the bundled CLI `dist/gemworks.mjs`,
started per request (`node dist/gemworks.mjs hook`: one JSON request on stdin,
one answer line on stdout). At session start the plugin looks for Node: `node
--version` on the session's PATH first; then where a shell finds it — a login
shell on Unix (`/bin/sh -lc "command -v node"`), `cmd.exe /d /c where node` on
Windows, the one that is not this OS's failing at once; then the places the
installers put it (`%ProgramFiles%\nodejs`, `%LOCALAPPDATA%\Programs\nodejs`,
nvm-windows' `%NVM_SYMLINK%`, Volta, Homebrew, `/usr/local/bin`). The first
candidate whose major version is 22 or more is the one. Each probe gets ten
seconds: a first run of node.exe behind an antivirus is slow. A start that
found no Node is tried again by a later tool call, prompt or `/gemworks` after
ten seconds; one that found Node but got no answer, at most once a minute.

**It fails open.** When Node is missing, the CLI fails or times out (15 s; 45 s
for the board, a refresh, `use` and `add`), or its answer does not parse, the
tool call goes through, nothing is recorded, and the line above the prompt says
what is wrong. Refusals therefore hold only while that bridge is healthy. An
answer that says the request failed (a journal that cannot be read, a lock held
past its timeout) keeps the last policy the plugin had; a bundle that was never
built is named with the build to run.

**What a use means here.** Claude Code cannot take a tool away from the
model, so the stage text says which uses the state declares and which tool each
is bound to (`Tools here:` and then one line per use, `edit: Edit`,
`test: Bash(npm test)`) — the signpost the model reads — and a call to a tool
bound to a use this state does not
declare is refused at call time, before it runs
(`gemworks: Edit is edit, which is used only in #implement; the workflow is in
#explore`), and recorded as `#refused-N`. The refusal names the way out that
every state admits: switching the work item (`git switch`, `git checkout -b`,
`git worktree add`, `cd`). The person-only commands
(`gemworks mark|unmark|advance|pause|resume`) and a fenced use's command pattern are read in
the command line of any tool call that carries one (Bash, Monitor), anywhere
in the line, quoting removed.

**Most calls cost no spawn.** Every answer carries a snapshot of the state and
its policy — the uses, the dictionary's rows, the file globs — and the plugin
asks the CLI before a call only when the call could be refused or recorded,
and after it only when evidence could read it: a command whose
key is bound to a use some variable reads, with an exit status; a tool bound to
such a use; a write to a file a file variable or the work unit names; any run
when the workflow has file variables; a command that runs git or gh anywhere in
its line (a branch switch can change the work item); a Bash result that reports
a git operation; or a call the CLI has just recorded. A call that may act in
another checkout always goes to the CLI, which attributes it.
gh is asked about pull requests and CI at session start, when the board opens
or is refreshed, and after a call whose result reports a git operation (commit,
push, merge, PR) — a `git status` costs no gh round trip.

Developing the plugin from this repository:

```sh
cd integrations/gemworks && npm install && npm run build
cd ../.. && claude --plugin-dir integrations/gemworks
cd integrations/gemworks && npm run test:claude   # claude plugin validate + claude plugin test
```

### Other hosts (MCP)

`gemworks mcp` serves the same three tools over stdio MCP; register it in the
host's MCP configuration as `npx -y gemworks mcp --host <host>`
(`--root <dir>` when the host starts servers outside the project). The skill
`skills/gemworks-mcp/SKILL.md` tells the model to read the stage (`status`, or
`.geml/context.geml` `#current`) at the start of every turn, since such a host
has no channel that delivers it. What such a host does not get:

- No line above the prompt and no board; a person moves the workflow and ticks
  variables with `gemworks advance` and `gemworks mark` in a terminal.
- Gemworks sees none of the host's tool calls, so `tool` evidence is never
  written and nothing is refused — a fenced use and the person-only commands
  included. A guard holds whoever moves the workflow, `gemworks advance`
  included, so a transition whose guard needs `tool` evidence moves there only
  where the guard also accepts a variable a person ticks: the dev workflow's
  `review-ready` takes `#build` to `#review`, but `#release` waits on the
  production deploy's exit code and never reaches `#done` there unless its
  guard gains a `human` variable.
- git and the file variables are read when the model calls `status`; a `move`
  that changes the stage appends the new `#current` to its result.
- A transition marked `approval` is refused to the model, as on Claude Code.

### Codex

Codex gets the three tools over MCP as above, and — once its hooks are
trusted — the gate: the plugin's `.codex-plugin/plugin.json` points at the
same `skills/`, at `codex/mcp.json` (`gemworks mcp --host codex`) and at
`codex/hooks.json`, where SessionStart, UserPromptSubmit, PreToolUse,
PostToolUse and Stop all run `node "${PLUGIN_ROOT}/dist/gemworks.mjs" codex`.
Installed from this repository's Codex marketplace (`.agents/plugins/marketplace.json`,
a local source: run `npm run build` in `integrations/gemworks` first), then
`/plugins` in Codex to install and `/hooks` to review and trust the five
hooks — installing a plugin trusts none of them, and an untrusted hook is
skipped without a word.

With the hooks trusted, Codex gets what Claude Code gets minus the line
above the prompt and the board: the stage text reaches the model at the
start of the session, at the next prompt after it changed, and in the result
of the call that changed it; a command a fenced use or a person owns is
refused with the reason; a tool the dictionary has no row for runs as usual;
a tool's default parameters are filled in; the files a patch writes, and at
the turn's end its answer and the commits it made, go into the project's
session record; and a shell command whose exit status is evidence is
wrapped to print it last
(`[gemworks exit N]`, read back after the call, since Codex's result carries
no status; the command's own status still reaches Codex; not on Windows).
`apply_patch` is the editor here: the bundled dictionaries bind it to `edit`,
and only the paths of a patch are judged, never its text.

### DeepSeek Harness

```sh
dsh plugin --profile web add gemworks
```

Verify the layer without booting, then boot:

```sh
dsh --profile web --dump-config   # shows a "# == gemworks" layer
dsh --profile web
```

The bundle contributes three rows: the **supervisor**
(the adapter module `dist/hosts/dsh/plugin.js`, named by path so dsh also
finds the package's browser half; it attaches per agent and does nothing at
all when no workflow resolves for the session's working directory — that is
`onMissing: skip`), the **GEML MCP server** (`npx -y @geml/geml mcp --root .`,
confined to the session's project directory, so the model edits one block at a
time instead of rewriting files) and the four **skills** under `skills/` —
authoring, code-graph, gemworks, and split-session, which applies to Claude
Code sessions alone and says so. Override any of them by `id` in your profile's
`cordis.patch.yml`, restating every key the row needs.

The supervisor row leaves `statechart` unset, so the workflow is resolved the
way `gemworks` resolves it, from the session's working directory; set
`statechart: <path>` in the row to pin one file instead. A project with no
workflow is left alone quietly. Several workflows with none chosen, a name that
finds nothing, or a workflow with errors is logged and leaves the agent
unsupervised — `onMissing: fail` fails its startup instead.

On this host `move` and `set` are re-registered after every accepted action, so
`move`'s enum is exactly the transitions the model may take and `set`'s
parameters exactly the variables it may write; a value of the wrong type is
refused by dsh's own validator before the verb. The gate runs in
`tools/pre-execute`: a refusal denies with its reason, and a key the dictionary
has no row for runs as usual. `pwsh` is the exception: its command line is PowerShell, which the sh scanners cannot
read, so only the two rules that need no parse apply to it — a person's verb
and a fenced use's pattern, searched anywhere in the text — and its exit status
is credited to no use.

In the web GUI (`dsh --profile web`) the **board** is a tab in the right
sidebar: its guide page lists "Gemworks", and the tab draws the rows the Claude
Code board draws — five of its six tabs (pending, items, journal, flow, tools;
the sessions tab is a person's prompts with row actions over Claude Code's
transcript, and dsh keeps its own sessions). A press runs on the host: a
person's transition, a tick, pause and resume, and the lessons that go into
`.geml/tools.geml` — "set as preferred", "allow in this state too" and the add-a-row
field — which the supervisor reads afresh for its next decision. Buttons for
what this host cannot do (an export, a dialog, switching workflows) are not
drawn. A file link opens the file through dsh's own session API, or shows it
in the file manager when no application claims it. The flow tab's picture
is the same data drawn as SVG here: a transition you may take now is drawn
in the accent, and a click on it moves the work. The two halves are
`src/hosts/dsh/board.ts`, whose routes sit under `/api/gemworks`, and
`client.js`, the package's `dsh.client` bundle; the supervisor row is named by
path for the browser half's sake (above). The journal is still one per
session under `journalDir`, read back when the session resumes.

### pi agent

```sh
pi install npm:gemworks
```

The same tarball is a pi package: its `pi.extensions` points at the supervisor
and its `pi.skills` at the same four skills, which already sit one `SKILL.md`
folder each — pi agent's own convention.

The workflow is read when the extension loads, because the three verbs have to
be registered before the first session starts and their schemas come from it.
It is resolved from the directory pi starts in, the way `gemworks` resolves it,
and the environment is how to say otherwise — flags are not parsed yet at that
point:

```sh
GEMWORKS_STATECHART=path/to/workflow.geml pi   # this workflow, not the project's default
GEMWORKS_JOURNAL_DIR=/var/journals pi      # default: <session dir>/gemworks
```

No workflow: no registrations and no listeners, and `pi` behaves exactly as it
does without this package. Several workflows with none chosen, a name that
finds nothing, or a workflow with errors: each session says so and is not
supervised.

One thing about pi agent is read from its published types and docs rather than
measured, and a run against a live model is where to check it: whether
`getBranch()` after a fork returns the branch or the whole tree (the `hash`/`parent` chain is computed from what it
returns, and `gemworks verify` is what would catch it).

The CLI alone, without a harness, is the `gemworks` command step 2 of
[Start on a repository](advanced.md#start-on-a-repository) installs:

```sh
gemworks init
gemworks check .geml/workflows/coding.geml
```

`GEMWORKS_GH` names the `gh` program the git variables ask about pull requests
and CI, when it is not the one on PATH.
