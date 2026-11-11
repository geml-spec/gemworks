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

### Cursor

```sh
npm install -g @geml/gemworks
gemworks cursor install
```

The second line writes gemworks' hooks into `~/.cursor/hooks.json` and its MCP server into `~/.cursor/mcp.json`,
both pointing at the `gemworks` you just installed, and prints the two paths. Your own hooks and MCP servers in those
files are kept; running it again replaces the earlier install. Reload the Cursor window afterwards.

Cursor gets what Codex gets: the work loop's tools and the flows' steps at the session's start, the GEML board page
above, and the gate. A command a fenced use or a person owns is refused with the reason; a tool's default parameters
are filled in; a shell command whose exit status is evidence is wrapped to print it last (`[gemworks exit N]`, not on
Windows); the files the agent edits, the turn's answer and the commits it made go into the project's session record;
a turn that changed things and reported no work item is sent back once, by a follow-up message the record does not
count as yours.

Two things differ from Codex because of what Cursor's hooks allow:

- Cursor's prompt hook cannot speak to the model. What Codex says beside a prompt (the work items on the way, the
  step's practices, other sessions' decisions, a new stage text) reaches the model with the result of the turn's
  first tool call instead. A turn that calls no tool hears it at the next one.
- Cursor names its tools `Shell`, `Write`, `Read`, `Grep`, `Delete` and `MCP:<tool>`. The gate reads them by Claude
  Code's names: `Shell` as `Bash`, `Write` as `Write`, and the other file-writing tools as `Edit`. Write a dictionary
  row for Cursor with those names; the bundled dictionaries need nothing more.

The hooks run in `~/.cursor`, so the project is the workspace folder holding a `.geml/`, else the first one. The MCP
server learns the conversation and its project from the hooks, as on Antigravity: with two Cursor windows open, it
writes for the one that ran a hook last. As on Codex there is no band and no board button; "Make it a rule" and the
corrections ledger are not here. View the board page with the GEML extension, which Cursor runs as a VS Code
extension.

### Qwen Code

```sh
npm install -g @geml/gemworks
gemworks qwen install
```

The second line writes gemworks' hooks and its MCP server into `~/.qwen/settings.json`, both pointing at the
`gemworks` you just installed, and prints the file's path. Your own hooks, MCP servers and settings are kept; running
it again replaces the earlier install. A settings file with comments in it is left alone: the command says so, and the
hooks go in by hand. Start Qwen Code again afterwards.

Qwen Code's hooks are Claude Code's, so it gets what Codex gets, prompt included: the work loop's tools and the flows'
steps at the session's start; the work items on the way, the step's practices, other sessions' decisions and a new
stage text beside each prompt; the GEML board page above; and the gate. A command a fenced use or a person owns is
refused with the reason; a tool's default parameters are filled in; a shell command whose exit status is evidence is
wrapped to print it last (`[gemworks exit N]`, not on Windows), and the shell tool's own `Exit Code:` line is read when
it is not wrapped; the files the agent writes, the turn's answer and the commits it made go into the project's session
record; a turn that changed things and reported no work item is sent back once, and the reminder is not counted as
your words. Qwen Code still asks you to approve a call the gate lets through, as it would without gemworks.

Qwen Code names its tools `run_shell_command`, `write_file`, `edit`, `notebook_edit`, `read_file`, `grep_search`,
`glob` and `mcp__<server>__<tool>`. The gate reads them by Claude Code's names (`Bash`, `Write`, `Edit`,
`NotebookEdit`, `Read`, `Grep`, `Glob`, and an MCP tool by its own name), so the bundled dictionaries need nothing
more. The project is `QWEN_PROJECT_DIR`, the folder Qwen Code was started in; the MCP server starts there too. As on
Codex there is no band and no board button; "Make it a rule" and the corrections ledger are not here.

### OpenCode

```sh
npm install -g @geml/gemworks
gemworks opencode install
```

The second line writes a small plugin into OpenCode's global plugins folder, `~/.config/opencode/plugins/gemworks/`
(under `$XDG_CONFIG_HOME` when that is set), pointing at the `gemworks` you just installed and the Node that ran it, and
prints its files. Running it again replaces them; deleting the folder removes gemworks. The plugin registers the
gemworks MCP server itself, so your `opencode.json` is not touched. Start OpenCode again afterwards. This is for
OpenCode 2 (`@opencode/cli`); OpenCode 1's plugins are another API.

OpenCode runs its plugins in its own process, so the plugin asks `gemworks opencode` on each hook and does what it
says. It gets what Qwen Code gets: the work loop's tools and the flows' steps when a session's first prompt comes (OpenCode
has no session-start hook); the work items on the way, the step's practices, other sessions' decisions and a new stage
text with each prompt, in the system part of every model request of that turn; the GEML board page above; and the
gate. A command a fenced use or a person owns is refused with the reason, which OpenCode hands the model as the
tool's error; a tool's default parameters are filled in; a shell command whose exit status is evidence is wrapped to
print it last (`[gemworks exit N]`, not on Windows), and the shell tool's own exit status is read when it is not; what
the model should read after a call is added to its result; the files the agent writes and the commits it made go into
the project's session record; when the session would go idle after a turn that changed things and reported no work
item, a synthetic message sends it back once. OpenCode's idle hook gives no answer text, so the turn's answer is not
in the record.

OpenCode names its tools `shell`, `write`, `edit`, `patch`, `read`, `grep`, `glob`, `webfetch`, `websearch`,
`todowrite`, `subagent` and `<server>.<tool>`. The gate reads them by Claude Code's names (`Bash`, `Write`, `Edit` —
a patch by its first file —, `Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch`, `TodoWrite`, `Task`, and an MCP tool by
its own name), so the bundled dictionaries need nothing more. The project is the folder OpenCode was opened in. As on
Codex there is no band and no board button; "Make it a rule" and the corrections ledger are not here.

### Devin (formerly Windsurf)

```sh
npm install -g @geml/gemworks
gemworks devin install
```

Windsurf is now Devin Desktop, and it shares its hooks with the Devin CLI. The second line writes gemworks' hooks under
`hooks` in `~/.config/devin/config.json` and its MCP server into `~/.config/devin/mcp_config.json` (both in
`%APPDATA%\devin\` on Windows), pointing at the `gemworks` you just installed, and prints the two files. Your own
hooks, servers and settings are kept; running it again replaces the earlier install. If either file has comments in
it, neither is touched: the command says so, and the hooks go in by hand. Start Devin again afterwards; `/hooks` lists
what it loaded.

Devin's hooks are Claude Code's, so it gets what Qwen Code gets: the work loop's tools and the flows' steps at the
session's start; the work items on the way, the step's practices, other sessions' decisions and a new stage text beside
each prompt; the GEML board page above; and the gate. A command a fenced use or a person owns is refused with the reason
(the hook exits 2, as Devin blocks a call); a tool's default parameters are filled in; a shell command whose exit status
is evidence is wrapped to print it last (`[gemworks exit N]`, not on Windows) — Devin reports no exit status of its own,
so an unwrapped command's is unknown; the files the agent writes, the turn's answer and the commits it made go into the
project's session record; a turn that changed things and reported no work item is sent back once.

Devin names its tools `exec`, `write`, `edit`, `apply_patch`, `notebook_edit`, `read`, `grep`, `glob`, `webfetch`,
`todo_write`, `run_subagent` and `mcp__<server>__<tool>`. The gate reads them by Claude Code's names (`Bash`, `Write`,
`Edit` — a patch by its first file —, `NotebookEdit`, `Read`, `Grep`, `Glob`, `WebFetch`, `TodoWrite`, `Task`, and an
MCP tool by its own name), so the bundled dictionaries need nothing more. The project is `DEVIN_PROJECT_DIR`. Devin's
docs do not say where an MCP server starts, so when the server's own folder has no `.geml/` it works in the project
and session the hooks last saw. As on Codex there is no band and no board button; "Make it a rule" and the
corrections ledger are not here.

### TRAE

```sh
npm install -g @geml/gemworks
gemworks trae install
```

The second line writes gemworks' hooks into `~/.trae/hooks.json` and `~/.trae-cn/hooks.json` — the international and
the China build: the ones that are there, both when neither is — pointing at the `gemworks` you just installed, and
prints the files. Your own hooks are kept; running it again replaces the earlier install; a file with comments in it is
left alone. TRAE keeps its MCP servers in its own settings, so the command also prints the gemworks server's entry: add
it under Settings → MCP → Add manually. Start TRAE again afterwards.

TRAE's hooks are Claude Code's, so it gets what Qwen Code gets: the work loop's tools and the flows' steps at the
session's start; the work items on the way, the step's practices, other sessions' decisions and a new stage text beside
each prompt; the GEML board page above; and the gate. A command a fenced use or a person owns is refused with the
reason; a tool's default parameters are filled in; a shell command whose exit status is evidence is wrapped to print it
last (`[gemworks exit N]`, not on Windows); the files the agent writes, the turn's answer and the commits it made go
into the project's session record; a turn that changed things and reported no work item is sent back once. TRAE still
asks you to confirm a call the gate lets through when that tool is set to ask.

TRAE names its tools by Claude Code's names already (`Read`, `Write`, `Edit`, `Glob`, `Grep`, `LS`, `WebSearch`,
`WebFetch`, `Skill`, `mcp__<server>__<tool>`), but for the shell, `RunCommand`, which the gate reads as `Bash`; the
bundled dictionaries need nothing more. The project is the workspace root holding a `.geml/`, else the folder TRAE
opened. TRAE's docs do not say where an MCP server starts, so when the server's own folder has no `.geml/` it works in
the project and session the hooks last saw. As on Codex there is no band and no board button; "Make it a rule" and the
corrections ledger are not here.

### Kiro

```sh
npm install -g @geml/gemworks
gemworks kiro install            # Kiro CLI V3: every workspace
gemworks kiro install .          # the Kiro IDE: this project too
```

The command writes the hook file `~/.kiro/hooks/gemworks.json`, which Kiro CLI V3 runs in every workspace, and the MCP
server into `~/.kiro/settings/mcp.json` beside your other servers. The Kiro IDE reads only a workspace's own
`.kiro/hooks/`, so name the project (`.` above) to write `<project>/.kiro/hooks/gemworks.json` as well; it holds this
machine's path to `gemworks`, so keep it out of git if others share the repository. Running it again replaces the
files; an MCP config with comments in it leaves everything alone. Start Kiro again afterwards.

Kiro's hooks do less than Claude Code's, so it gets less than Qwen Code: what a hook prints on success is added to the
agent's context as plain text, and a hook that fails has its error sent to the agent, blocking the call before a tool
runs. So the work loop's tools and the flows' steps come at the session's start, and the work items on the way, the
step's practices, other sessions' decisions and a new stage text with each prompt; a command a fenced use or a person
owns is refused with the reason; the files the agent writes and the commits it made go into the project's session
record. A hook cannot change a call's input, so no default parameter is filled and no command is wrapped: a test
command's exit status is the one the shell tool's result reports. At the turn's end a turn that changed things and
reported no work item gets the reminder once — Kiro's docs say the agent reads it, not that it takes another turn for
it.

Kiro names its tools differently in its surfaces — `shell`, `execute_bash`, `executeBash`; `write`, `fs_write`,
`fsWrite`, `strReplace`; `read`, `fs_read`, `readFile`; `grep`, `glob`, `web_fetch`, `web_search`, `subagent`, and
`mcp_<server>_<tool>` — and the gate reads every spelling by Claude Code's name, so the bundled dictionaries need
nothing more. The project is the folder Kiro runs the hook in, the project root. Kiro's docs do not say where an MCP
server starts, so when the server's own folder has no `.geml/` it works in the project and session the hooks last
saw. As on Codex there is no band and no board button; "Make it a rule" and the corrections ledger are not here.

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
