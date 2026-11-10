# Project layout and development

[← Back to README](../README.md)

## Project layout

```
.geml/                          in the main checkout: every worktree of the repository reads the same
  workflows/<name>.geml         a workflow: one statechart block, each stage's prompt after it
  tools.geml                    the tool dictionary of all the workflows: which tool is which use, where a tool is allowed or denied
  project.geml                  the project document: meta flow-workflow names the default workflow; #items, every work item and where it ended up
  artifacts.geml                what each work item made: links, documents it changed in git, files git does not keep — where each is, which version
  artifacts/                    copies of the files git does not keep, named by their content's hash
  journals/<item>.geml          one journal per work item: a branch, or one file of a set
  sessions/                     the project's session record, every host's sessions
  coach/<name>.geml             the project's own light flows: a starter flow it changed, a flow it added
  practices.geml                the project's practices, each on the step of a flow it belongs to
  proposals.geml                the steps and kinds of work proposed, waiting for a yes or no
  board.geml                    the GEML board page, for the hosts with no panel of their own
  exports/                      what the board exports
  .gitignore                    gemworks's own files, written by gemworks init: none of them goes into git
.geml/                          in each checkout
  context.geml                  the current stage's text and the variables, written again on each change of stage
  backlog.geml                  the backlog table
```

A project laid out the earlier way — a directory per workflow (`flow.geml`,
`guide.geml`, `tools.geml`), in the checkout — is
still read. A Claude Code session's first status, or `gemworks migrate`, moves
it into the main checkout: each directory becomes one file with its guide's
sections in it, its rows join `.geml/tools.geml`.
What git tracks is copied and left where it is, for you to
`git rm`; the rest goes to `~/.gemworks/trash/`. A journal started under an
earlier `flow.geml` goes on under the file it moved to.

`gemworks init` writes the project document:

```geml
=== meta
title         = "Gemworks"
flow-workflow = "coding"
===
```

Below it gemworks keeps a table, `#items`: every work item the project has had
and where it ended up, read off git each time the board lists them —
`doing` while its branch is there and not merged; `merged` once main holds
its commits or its pull request is merged, the branch or its worktree still
there; `closed` once that is gone; `dropped` for a branch deleted unmerged, or
with no commit at all. A work item that is a file is closed at its flow's
final state and dropped at `parked`. The table remembers what git forgets — a
deleted branch's last tip and how many commits it had — and only it is
rewritten: what you write around it stays.

What a work item made goes into the `#artifacts` table of `artifacts.geml`,
one row a version. Of the files the work item wrote, the ones git does not keep
are looked at once at the end of each turn and once when the board opens: when
the content changed, a copy goes into `artifacts/`; a file over 20 MB is kept
by where it is and its hash. A GEML document keeps one copy, its later versions
in that copy's `.gemlhistory`. A document git keeps is recorded by its path
and the last commit that changed it. A page the Artifact tool published is
recorded as a link on its own; other links and generated pictures the model
records with the `artifact` tool.

The default workflow is the file `GEMWORKS_STATECHART` names (a path relative
to the project root), else the one `flow-workflow` names, else the project's
only workflow. The CLI, the Claude Code plugin, `gemworks mcp`, the DeepSeek
Harness adapter and the pi agent adapter resolve it the same way. Commit the
backlog; gemworks's own files stay out of git.

## Development

```sh
npm install           # @geml/geml from npm, and the hosts' packages the tests run against
npm run build         # tsc + the bundle
npm test              # the build, then every node:test suite (node test/all.mjs)
npm run test:claude   # the build, then claude plugin validate and claude plugin test (needs the claude CLI)
```

`npm run build` runs `tsc` and then bundles the CLI the Claude Code plugin
starts: `dist/gemworks.mjs` and the `dist/gemworks-*.mjs` files it loads, with
`@geml/geml` copied unchanged into `dist/vendor/geml/`, so an installed plugin
needs no dependency install. No file the package ships reaches 256 KiB, the
size at which Anthropic's plugin directory holds a version for a reviewer
(`test/hooks-split.test.mjs`). `hooks/register.tsx` and `hooks/act.tsx` (what a
press does, split from it) run with no Node: they import only Node-free modules
from `dist/hosts/claude-code/` and `dist/core/`, and `test/hooks-purity.test.mjs`
walks that closure. The hooks tests live in
`tests/` (`claude plugin test` does not descend into `node_modules`); the
node:test suite in `test/` covers the rest, including
`test/fastpath-parity.test.mjs`, which holds the plugin's fast path to what the
workspace would refuse, record and ask about, and
`test/checks-conformance.test.mjs`, which replays
`spec/checks.json`.

`src/core/` is a pure library — no `node:fs`, no `process`, no `console`, and
no host package either (tests pin all of it) — so the CLI, the Claude Code
bridge, `gemworks mcp` and both adapters share one implementation:
`statechart.ts` loads a workflow over the parser's statechart module,
`dictionary.ts` holds the keys, the patterns and the decision, `signals.ts`
the evidence by source, `supervisor.ts` the gate and the verbs, `asking.ts` the
preferred-tool question a host puts to a person and what the answer writes. The I/O lives
beside it: `src/host-fs.ts` (files, locks, atomic writes, the walk of a
project), `src/host-git.ts` (git and gh, each an argument vector with a
timeout), `src/dictionary-io.ts` (the dictionary on disk, read afresh and
rewritten under its lock) and `src/workspace.ts`, which runs one locked
operation at a time against a project for the CLI and for any host built on it.

The layout follows from that: `src/core/supervisor.ts` decides, and
`src/hosts/dsh/` and `src/hosts/pi/` only translate. Neither adapter may import
the other's host — they are optional peer dependencies, so an install with one
harness must never resolve the other's packages, and a test enforces it. Each
host also has a parity test (`dsh-parity`, `pi-parity`) that asserts the shapes
this package depends on against the installed packages: when a host moves, the
suite goes red here rather than in someone's session.

The Claude Code shell is split the same way across the bridge. `src/bridge.ts`
is the Node side of `gemworks hook`: it opens the workspace afresh for every
request (git's facts are read when it opens, and another process may have
written the journal or the dictionary since) and answers every request, a
throw included; `src/attribution.ts` says which checkout and work item a call
acts in. `src/hosts/claude-code/` is the Node-free side the hooks module
imports: the request and answer types, the fast path, the readers of Claude
Code's tool results, and the words of the band, the board and `/gemworks` as
pure functions. `src/mcp.ts` serves the same verbs (`src/verbs.ts`) and the
work loop's tools (`src/loop.ts`) over stdio MCP; `src/codex.ts` and
`src/antigravity.ts` are those hosts' hooks, and `src/board-file.ts` writes the
GEML board page they and `gemworks mcp` open.
