# Installing and using it on each host

[← Back to README](../README.md)

## Install

### Claude Code

```text
/plugin marketplace add geml-spec/geml
/plugin install gemworks --marketplace geml-spec/gemworks
```

Type them at the prompt of a session (Claude Code 2.1.275 or later), one at a
time, and pick a scope when asked. The first adds the marketplace of GEML's own
plugin: gemworks depends on `geml`, and with that marketplace added, installing
gemworks installs geml too; without it gemworks installs but does not load. The
second adds the gemworks marketplace, which installs the published `gemworks`
package from npm, and installs it. From a shell, the same is
`claude plugin marketplace add geml-spec/geml`,
`claude plugin marketplace add geml-spec/gemworks` and
`claude plugin install gemworks@gemworks`.

What you get:

- **A line above the prompt**, on the terminal and the desktop app:
  Gemworks's mark, then the one thing that is yours now — a question the reply
  ended with, a step only you can judge, an approval or a variable to tick in a
  strict flow, a model stuck on a refused call, a bridge that is down — with at
  most three options as buttons, the main one first; typing your answer works
  too. When more wait, `还有 N 件` opens the board. With nothing waiting, it
  says what the model is working on (`我在做`) and the step the work item has
  reached; a held item offers 继续. On the right: how many practices it learned
  today and how many proposals wait (each a press to the flow tab), then the
  Board button, with a screenshot button beside it on the desktop app. While
  it first reads the project's earlier sessions, the line shows the count. A
  project with no workflow of its own runs on the light flows, so the line
  never says a flow is missing; before the bridge has answered it says it is
  starting. The words follow the language setting or the system's locale:
  Chinese, English or Japanese.
- **`/gemworks`**: where the work stands; `/gemworks board [tab]` opens the
  board (`sessions`, `items`, `made`, `flow`, `tools`); `/gemworks pause` and
  `/gemworks resume` hold and release the work item; `/gemworks use <workflow>`
  changes the default strict flow; `/gemworks add` lists the bundled strict
  flows and `/gemworks add <workflow>` copies one into `.geml/workflows/` — the
  default when the project has none yet, otherwise it offers `/gemworks use`;
  `/gemworks trace on|off` records presses and renders into `.geml/trace.log`,
  for chasing a board problem. In a project with no strict flow, `/gemworks`
  says it runs on the light flows and names the bundled strict flow that fits
  what the directory holds (a geml-media document or `episodes/`: video; a
  deploy configuration such as wrangler, fly, vercel or a Dockerfile: dev; a
  build manifest such as package.json or Cargo.toml: coding; nothing
  recognisable: dev).
- **The board**, five tabs, opening on Items. **Session**: this session's
  turns, what you asked and what each turn did; a turn can be scrolled to in
  the conversation, and under 整理 the turns you pick are split into a session
  of their own or deleted with the bundled `split-session` skill, the record
  backed up first; then the project's other sessions, the project's Claude Code
  memory and what every session decided. Each session's heading exports its
  record as GEML, asking where to put it: Downloads, the desktop, the project's
  `.geml/exports/`, or a folder or file typed in. **Items**: what waits on you
  on top, each with its buttons (a question, a step only you judge, an approval
  whose guard holds, a variable to tick, a model stuck on a refused call, a
  bridge that is down); then the work items on the way, the step each has
  reached and what it still needs; then a strict flow's work items by where
  they ended up — 在做, 已合并, 已收尾 and 放下, each with its worktree, its
  commits and its pull request; a merged one whose worktree or branch is still
  there is a card to close it — and the backlog. **Artifacts**: everything the
  project's work made, whichever work item made it — files, commits, pages,
  links — listed by version, one press to open. **Flow**: each flow's steps,
  the pitfall each guards against, the practices attached to it and the
  proposals waiting; under 固化流程, the strict flow drawn from its model with
  the runtime laid over it — a way out you may take now is a numbered button,
  its number the hotkey, on every surface, the terminal included — and its
  heading opens a list to add a bundled strict flow or import one from a path.
  **Tools**: the dictionary, each row with its standing in the current state
  and what you can change in place; a field adds a row. The header carries
  share (where it stands, a flow, this session, or a strict flow's journal of
  the work item — as text, a file under `.geml/exports/` or a PR comment),
  settings (the language, answering the band's questions by typing, learning
  from your corrections, desktop notifications), upgrade and about.
- **The tools the model calls**, listed as `mcp__gemworks__<name>`: `work` (the
  work items a turn was about), `note` (the turn's decisions, for the
  project's other sessions), `practice` (what was learned, on the step it
  belongs to), `propose` (a step or a new kind of work, for you to accept on
  the flow tab), `ask` (a question the turn ends with, for the band),
  `artifact` (a link or a generated file gemworks cannot see by itself) and
  `rule` (only after you press 改成规定 on a practice); and, for a strict flow,
  `status`, `move` and `set`. Their schemas never change with the state, so the
  prompt cache holds. A call to `status`, `move` or `set` is never refused by
  the gate; the verbs' own rules — the three judges, the variables with a
  source — still hold.
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

To add a strict flow, start with `/gemworks add dev` (or
`npx -y @geml/gemworks init --template dev`), then set `.geml/tools.geml` to
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
bound to a rule (a use the workflow fences, under a state's `rules`) this state
does not declare is refused at call time, before it runs
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
npm install && npm run build
claude --plugin-dir .
npm run test:claude   # the build, claude plugin validate + claude plugin test
```

### Other hosts (MCP)

`gemworks mcp` serves the model's tools over stdio MCP: the work loop's `work`,
`practice`, `propose`, `answer` (carry out your answer to a proposal), `ask`
and `artifact`, the `note` tool, and a strict flow's `status`, `move` and
`set`. Register it in the host's MCP configuration as
`npx -y @geml/gemworks mcp --host <host>` (`--root <dir>` when the host starts
servers outside the project). The skill `skills/gemworks-mcp/SKILL.md` tells
the model to call `status` at the start of every turn — the stage, the work
items on the way and the step's practices — since such a host has no channel
that delivers them. What such a host does not get:

- No line above the prompt and no board panel: the board is the GEML page
  below, which has no buttons, so a person moves a strict flow and ticks its
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

**The GEML board page.** A host with no panel of its own gets
`.geml/board.geml` in the project's main checkout: what waits for you, the work
items, the artifacts, the flows and what other sessions decided. It is written
again whenever the model records something through these tools (on Codex and
Antigravity also at each prompt and each turn's end), and opened once per
session, when the session starts with a work item on the way or at its first
record; `GEMWORKS_OPEN_BOARD=0` writes it without opening it. Its language is
`GEMWORKS_LANG` (`zh`, `en` or `ja`) when set, else the locale. Open it in a
VS Code–style editor with the GEML extension for a side preview that refreshes
whenever the file changes, or in Chrome's GEML Viewer, which you refresh by
hand. The page has no buttons: answer what waits for you in the chat.

### Codex

Codex gets the MCP tools above and the GEML board page, and — once its hooks
are trusted — the work loop beside each prompt and the gate: the plugin's
`.codex-plugin/plugin.json` points at `host-skills/`, at `codex/mcp.json`
(`node ./dist/gemworks.mjs mcp --host codex`) and at `codex/hooks.json`, where
SessionStart, UserPromptSubmit, PreToolUse, PostToolUse and Stop all run
`node "${PLUGIN_ROOT}/dist/gemworks.mjs" codex`. Installed from this
repository's Codex marketplace (`.agents/plugins/marketplace.json`, a local
source, the repository itself: run `npm install` and `npm run build` in it
first), then `/plugins` in Codex to install and `/hooks` to review and trust
the five hooks — installing a plugin trusts none of them, and an untrusted hook
is skipped without a word.

With the hooks trusted, Codex gets what Claude Code gets minus the line above
the prompt and the board panel: the session's start tells the model the work
loop's tools and the flows' steps and opens the board page when a work item is
on the way; each prompt carries the work items on the way, the current step's
practices and the other sessions' decisions not read yet; a turn that changed
things and reported no work item is sent back once at its end; the stage text
reaches the model at the start of the session, at the next prompt after it
changed, and in the result of the call that changed it; a command a fenced use
or a person owns is
refused with the reason; a tool the dictionary has no row for runs as usual;
a tool's default parameters are filled in; the files a patch writes, and at
the turn's end its answer and the commits it made, go into the project's
session record; and a shell command whose exit status is evidence is
wrapped to print it last
(`[gemworks exit N]`, read back after the call, since Codex's result carries
no status; the command's own status still reaches Codex; not on Windows).
`apply_patch` is the editor here: the bundled dictionaries bind it to `edit`,
and only the paths of a patch are judged, never its text.

### Antigravity

```sh
npm install -g @geml/gemworks
gemworks antigravity install
```

The second line writes gemworks' hooks into `~/.gemini/config/hooks.json` and its MCP server into
`~/.gemini/config/mcp_config.json`, both pointing at the `gemworks` you just installed, and prints the two
paths. Antigravity's app, CLI and IDE share these hooks.

Once installed, the model records work items, practices, proposals, artifacts and decisions through the MCP
tools; the session's start tells it those tools and the flows' steps, and each prompt carries the work items on
the way, the current step's practices and what other sessions decided since. The workbench is the GEML board
page above (`.geml/board.geml`), written again at each prompt and each turn's end. As on Codex there is no band
and no board button: answer what waits for you in the chat; "Make it a rule" and the corrections ledger are not
here. The geml plugin has no Antigravity version yet, so view the page with the GEML extension in a VS Code–style
editor (Antigravity IDE included) or with Chrome's GEML Viewer.

### DeepSeek Harness

```sh
dsh plugin --profile web add @geml/gemworks
```

Verify the layer without booting, then boot:

```sh
dsh --profile web --dump-config   # shows a "# == gemworks" layer
dsh --profile web
```

The bundle contributes three rows: the **adapter** (the module
`dist/hosts/dsh/plugin.js`, named by path so dsh also finds the package's
browser half; it attaches per agent at `agent/created`), the **GEML MCP
server** (`npx -y @geml/geml mcp --root .`, confined to the session's project
directory, so the model edits one block at a time instead of rewriting files)
and the four **skills** under `host-skills/` — `geml`, `geml-code-graph`,
`gemworks-mcp`, and `split-session`, which applies to Claude Code sessions
alone and says so. Override any of them by `id` in your profile's
`cordis.patch.yml`, restating every key the row needs.

Every session gets the work loop, workflow or none: the session goes into the
project's shared record (its prompts, its answers, the files it wrote, the
commits it made), the model gets the loop's tools and the `note` tool as
`gemworks_<name>`, and each step's context carries the work items on the way,
the current step's practices and the other sessions' decisions. The
**supervisor** — the gate and the verbs of a strict flow — attaches only when a
workflow resolves for the session's working directory. The row leaves
`statechart` unset, so the workflow is resolved the way `gemworks` resolves it;
set `statechart: <path>` in the row to pin one file instead. A project with no
workflow gets no supervisor, quietly (`onMissing: skip`). Several workflows
with none chosen, a name that finds nothing, or a workflow with errors is
logged and leaves the agent unsupervised — `onMissing: fail` fails its startup
instead.

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
Code board draws. A session under a strict flow gets four tabs (items,
journal, flow, tools); one without gets two (items, flow), where a question, a
step or a proposal is answered in the conversation. There is no sessions tab:
on Claude Code it is a person's prompts with row actions over Claude Code's
transcript, and dsh keeps its own sessions, so the journal tab stays here to
show what happened. A press runs on the host: a
person's transition, a tick, pause and resume, and the lessons that go into
`.geml/tools.geml` — "set as preferred", "allow in this state too" and the add-a-row
field — which the supervisor reads afresh for its next decision. Buttons for
what this host cannot do (an export, a dialog, switching workflows) are not
drawn. A file link opens the file through dsh's own session API, or shows it
in the file manager when no application claims it. The flow tab's picture
is the same data drawn as SVG here: a transition you may take now is drawn
in the accent, and a click on it moves the work. The two halves are
`src/hosts/dsh/board.ts`, whose routes sit under `/api/gemworks`, and
`client.js`, the package's `dsh.client` bundle; the adapter row is named by
path for the browser half's sake (above). The journal is one per session under
`journalDir`, read back when the session resumes.

### pi agent

```sh
pi install npm:@geml/gemworks
```

The same npm package is a pi package: its `pi.extensions` points at the
extension and its `pi.skills` at `host-skills/`, the same four skills, which
already sit one `SKILL.md` folder each — pi agent's own convention.

The work loop needs no workflow. In every project the extension registers the
loop's tools and the `note` tool as `gemworks_<name>`, records each prompt and
answer in the project's shared record, and puts the work items on the way, the
current step's practices and the other sessions' decisions in the system
prompt of each run. A band of a line or three sits above the editor: this
session's work item and where it stands, the first thing that waits on you and
how many more, the step's first practice. `/gemworks` opens the board as an
overlay (Esc or q closes it). A question the model registered is asked at the
run's end with its answers to pick; a run that changed things and reported no
work item is sent back once; and each prompt you type is labelled into your
corrections ledger by the session's own model.

A strict flow is read when the extension loads, because the three verbs have to
be registered before the first session starts and their schemas come from it.
It is resolved from the directory pi starts in, the way `gemworks` resolves it,
and the environment is how to say otherwise — flags are not parsed yet at that
point:

```sh
GEMWORKS_STATECHART=path/to/workflow.geml pi   # this workflow, not the project's default
GEMWORKS_JOURNAL_DIR=/var/journals pi      # default: <session dir>/gemworks
```

No workflow: no verbs and no gate, quietly; the work loop runs as above.
Several workflows with none chosen, a name that finds nothing, or a workflow
with errors: each session says so and is not supervised.

One thing about pi agent is read from its published types and docs rather than
measured, and a run against a live model is where to check it: whether
`getBranch()` after a fork returns the branch or the whole tree (the `hash`/`parent` chain is computed from what it
returns, and `gemworks verify` is what would catch it).

The CLI alone, without a harness, is the `gemworks` command step 1 of
[Start on a repository](advanced.md#start-on-a-repository) installs
(`npm install -g @geml/gemworks`):

```sh
gemworks init
gemworks check .geml/workflows/coding.geml
```

`GEMWORKS_GH` names the `gh` program the git variables ask about pull requests
and CI, when it is not the one on PATH.
