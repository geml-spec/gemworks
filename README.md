# Gemworks

**A workbench right beside your agent chat.**

It works on the project with you: it keeps your artifacts in order, sums up what you've learned,
remembers what you've decided, and lets your workflow grow on its own. Right inside the Claude Code you already use.

English | [中文](README.zh.md)

<!-- Screenshot to come: the band and the board, at docs/images/band-and-board.png, then ![The band and the board](docs/images/band-and-board.png) -->

## What you see once it's installed

- **One line above the prompt**: what you're working on, which step it has reached, what is waiting
  for you to decide, and what the model will do next. When a decision is yours, the options are buttons;
  you can also just type your answer.
- **A board** with five tabs:
  - **Session**: every session in this project, what was asked in each turn and what was done.
  - **Items**: where each piece of work stands and what it still needs.
  - **Artifacts**: the files, commits, pages and links you made, listed by version, one click to open.
  - **Flow**: the steps of each flow, the pitfall each step guards against, and the practices attached to it.
  - **Tools**: which tool may be used at which step (advanced; you can leave it alone).
- **How much it has learned, and how many proposals wait**: when it learns something from your
  corrections, this line tells you.

## Three scenes

**Several sessions open at once.** Before: every new session needs the progress explained again,
and what you decided in A, B doesn't know. With it: what you decide is shared by every session and
comes along with each prompt; the board shows at a glance where each piece of work stands.

**One project over several weeks.** Before: a mistake you corrected comes back, and CLAUDE.md keeps
growing. With it: one correction becomes a practice, attached to the step it belongs to and brought up
only when work reaches that step; when the same kind of correction keeps coming, it proposes adding a step to the flow.

**Writing, making content, doing research.** Before: drafts in several versions, images and links scattered
everywhere. With it: everything each piece of work produces goes into the Artifacts tab, listed by version,
so the latest is easy to find.

## Install

You need Node 22 or later (check with `node --version`).

In Claude Code's prompt (Claude Code 2.1.275 or later), enter these one line at a time:

```text
/plugin marketplace add geml-spec/geml
/plugin install gemworks --marketplace geml-spec/gemworks
```

The first line adds GEML's plugin marketplace: gemworks uses the geml plugin from it, which comes along
when you install. The second adds gemworks' marketplace and installs it; choose a scope when asked.

After installing, read the last line of the install summary: `Plugin is now active.` means you can use it
right away. If a reload is needed, Claude Code runs `/reload-plugins` for you; if it warns that the reload
would invalidate the prompt cache, type `/reload-plugins --force` yourself.

On its first start it reads this project's earlier sessions in the background, and the band shows
"Getting to know this project's earlier sessions (3/120) — kept only on this machine, in .geml/".
Once it's done, the board shows your earlier sessions and artifacts.

## How flows grow

It comes with ten starter flows: **design**, **feature**, **bugfix**, **optimize**, **incident**, **review**,
**research**, **refactor**, **docs** and **analysis**. Each step says which pitfall it guards against.
The first step of **feature**, for instance, is "Mockup: you've seen it and said yes", against "building
something that isn't what you wanted, the costliest thing to redo".

As you work, the flows grow, and shrink too:

1. You correct the model once, or a turn costs you something: a redo, a failed test, you saying it isn't fixed.
2. It records a **practice**, attached to that step, and brings it up the next time work reaches it.
3. When the same kind of correction keeps coming, it **proposes** a new step for the flow; when several
   pieces of work fit no flow, a new kind of work; when a step was skipped in 4 of a flow's last 5, taking
   it out. Nothing changes unless you agree.
4. When a practice must be kept, press "Make it a rule": until that step is met, the calls it covers are refused.

Practices sit in three layers: your **personal** ones follow you into every project, the **project**'s stay
with this project, and "Share with the team" writes one into the repository's `.gemworks/`, so your teammates
get it once you commit it. Another project's `.gemworks/`, or a flow file exported from one, can be imported
as a reference; its steps are proposed to you on the Flow tab.

## Where your data stays

- The record, the practices and the artifacts live in the `.geml/` folder of the project's main checkout,
  on your own machine.
- To learn from your corrections, a small model reads each of your prompts. It runs on your own
  Claude Code account, with no third party in between. This is on by default; to turn it off, switch off
  "Propose practices and flow steps from your corrections" in the board's settings, and your prompts are no longer read.
- Every tool call you make passes through it, but whenever it fails itself, it lets the call through:
  it never holds you up.

## Other hosts

You don't need Claude Code to use it. What each host gets differs:

| | Workbench | Progress, artifacts, practices | Progress and practices in every turn | A small model learns from corrections |
|---|---|---|---|---|
| Claude Code | One line above the prompt + the board | Yes | Yes | Yes |
| Pi | One line above the editor; `/gemworks` opens the board | Yes | Yes | Yes (your current model) |
| DeepSeek Harness | The web side panel | Yes | Yes | Not yet; the model records practices itself |
| Codex | A GEML board page | Yes | Yes | No; the model records practices itself |
| Antigravity | A GEML board page | Yes | Yes | No; the model records practices itself |
| Cursor | A GEML board page | Yes | Yes, with the turn's first tool result | No; the model records practices itself |
| Qwen Code | A GEML board page | Yes | Yes | No; the model records practices itself |
| Other MCP hosts | A GEML board page | Yes | Only when the model calls its tools | No; the model records practices itself |

"Make it a rule", proposals to take a step out, and importing a reference are only on Claude Code for now.

**A GEML board page**: every turn rewrites `.geml/board.geml` in your project, with what waits for you,
the work items, the artifacts, the flows, and what other sessions decided. Open it in a VS Code–style editor
(Cursor and Antigravity IDE work too) with the GEML extension for a side preview that refreshes whenever the
file changes, or in Chrome's GEML Viewer, which you refresh by hand. The page has no buttons: answer what
waits for you in the chat.

How to install on each host: [docs/hosts.md](docs/hosts.md).

## When no step may be skipped: strict flows

The starter flows remind; they don't stop anything, except at the steps you've made a rule.
Some work has to go in order: no claiming it's done without a real test run, no release without your
approval. For that, add a **strict flow**: the model can only move forward stage by stage, and a tool that
doesn't belong to the current stage is refused, with the reason given to the model.

Four come bundled; pick one:

| Flow | Stages | What it holds |
|---|---|---|
| `coding` | Explore → Plan → Implement → Verify → Review | No editing files before there is a plan; no claiming it's done without a real test result; you approve the end |
| `dev` | Build → Review → Deploy → Release | Release needs your approval |
| `matter` | Noted → Deciding → Doing → Checking | Starting and accepting both need your nod |
| `video` | Script → Assets → Cut → Render → Review → Publish | Each stage finishes before the next |

**To add one**: type `/gemworks add coding` in the prompt (or the name of the one you want).
It copies that flow into the project's `.geml/workflows/`. If the project has no strict flow yet,
it becomes the default, and new work items follow it.

**To decide which tools it limits**: which tool counts as "editing files" and which as "running tests"
is written in `.geml/tools.geml`. The bundled one is already filled in for Claude Code's tools: `Edit` and
`Write` count as editing files, `Bash(npm test)` as running tests. To change it, open the board's Tools tab
and edit it there. A tool that isn't listed is never refused.

To change the stages or their order, or to write your own: [docs/advanced.md](docs/advanced.md);
the other three are described in [docs/workflows.md](docs/workflows.md).

## Command line · development · license

- **Command line**: `gemworks` (short: `gwx`) shows the state, moves stages and exports the record from a terminal; see [docs/cli.md](docs/cli.md).
- **Development**: the project layout and how to build and test it; see [docs/development.md](docs/development.md).
- **License**: AGPL-3.0-only. Using it asks nothing of you; if you change the code and distribute it,
  or let others use your changed version over a network, publish your changed source under the AGPL.
