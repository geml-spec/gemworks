# The command line

[← Back to README](../README.md)

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
  mcp [--host h] [--root dir]             the three model tools over stdio MCP (host default: mcp)
```

- `check` runs `geml check`, then the statechart's checks (`statechart-*`: no
  initial state, a transition to a state that is not there, a final state with
  a way out, a guard that reads a variable `vars` does not declare, …), then the workflow's (`flow-*`: a
  `prompt` that does not resolve, a `source` of no known form, two transitions
  between the same two states, two machine-judged transitions out of one
  state, a cycle of them, …), and reads the dictionary against it — the
  project's `.geml/tools.geml` against all its workflows (`flow-tools`: a
  state none of them has, two defaults for one use, …). A `prompt` is
  resolved against the project — the one whose `.geml/workflows/` holds the
  workflow, or the checkout the shell stands in when that is one of its — and
  never outside it.
- `snapshot`, `verify` and `export` read a journal. `verify` recomputes the
  whole chain: contiguous revisions, every `parent` equal to the previous hash,
  every hash recomputed from its content, and — given the workflow — every
  recorded transition matching a declared one. Deleting a **trailing** run of
  blocks is the one edit the chain cannot detect.
- `init` writes a bundled workflow as one file,
  `<dir>/.geml/workflows/<template>.geml` (`coding` unless `--template` says
  `dev`, `matter` or `video`), adds its rows to `.geml/tools.geml`,
  makes it the default unless `--no-activate`, and writes `.geml/.gitignore`
  when there is none. A workflow the project has is never overwritten.
- `use` names another workflow of `.geml/workflows/` in `.geml/project.geml`
  (see [Switching workflows](#switching-workflows)).
- `migrate` moves the earlier layout into the main checkout (see
  [Project layout](development.md#project-layout)) and says what moved where.
- `status` opens the project — starting the work item's journal and
  `.geml/context.geml` when there are none — and prints the work item, the
  stage, every variable with where it reads from, and each transition out with
  who takes it and whether its guard holds. `--json` prints the whole status.
- `mark` and `unmark` are a person ticking and clearing a variable whose
  `source` is `"human"`; a machine-judged transition whose guard then holds is
  taken (`marked review-ready · entered #review`). `advance` is a person taking
  a transition out of the current state: its guard must hold, one marked
  `approval` needs no further yes (the command is the approval), and the
  journal records `by=human`. `rollback` restores an earlier revision's state
  and variables as a person's act. The model cannot run any of these: a command
  line that runs `gemworks mark|unmark|advance|pause|resume` — directly, through `npx`,
  `npm exec` or `node dist/cli.js`, inside `bash -c`, `pwsh -c`, `sudo sh -c`,
  `eval` or a substitution — is refused before it runs, in every state, and
  the refusal is in the journal.
- `hook` is the Claude Code plugin's bridge: the hooks module sends it one
  JSON request on stdin and reads one answer line from stdout.
- `mcp` serves the three tools `status`, `move` and `set` over stdio MCP, for
  hosts with no Gemworks shell of their own (`--host` names whose tool names the
  dictionary's `Bash(…)` keys apply to; `mcp` by default, which runs no
  commands). On such a host no tool call is seen: `tool` evidence is never
  written and nothing is refused. `status` reads git and the file variables
  afresh before it answers and carries the stage's text; a `move` that changes
  the stage appends the new text to its result.
- `run` is the one verb that reaches outside this package: it finds `dsh` on
  PATH (falling back to `npx -y @deepseek-ai/dsh`), adds the bundle to the
  profile — `headless` unless you name another — and hands the task over,
  passing dsh's exit code back. If the add fails it prints dsh's own words and
  the two commands to run by hand, and never starts the task under a profile
  that is not carrying the supervisor.

On a feature branch of a repository:

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
$ gemworks advance plan            # a person may take a transition the model judges
entered #plan
```

and later, in `#verify` with no green run recorded:

```
$ gemworks advance review
gemworks: verify→review: the guard does not hold (tests-pass=false)
$ gemworks mark tests-pass
gemworks: tests-pass reads its value from the use test; only a variable whose source is "human" is ticked
```

### Work items and journals

The CLI keeps one journal per work item. Under the coding workflow
(`flow-unit = "branch"`, the default) the work item is the branch you are on,
and its journal is `.geml/journals/<branch>.geml` — `feat/rate-limit` writes
`.geml/journals/feat/rate-limit.geml`. Switch branches and the next command
works on the other branch's journal. The default branch, a detached `HEAD`, a
branch with no commit yet and a directory that is not a git repository have no
work item: `gemworks status` says so
(`main · not tracked (work items are branches)`) and records nothing. A workflow with `flow-unit = "file:<glob>"`
keeps one journal per matching file; its work item is the file a host's write
call touched last, so the CLI alone has none. With `flow-state-key` the file
also says where its item stands, under that meta key: written back when an
operation leaves it saying otherwise, and read where the journal is gone, so
the item starts in that state on a machine its journal never reached. The Claude Code plugin and
`gemworks mcp` work on these same journals.

The host adapters keep theirs per session: DeepSeek Harness writes
`<journalDir>/<session>.geml`, pi agent `<session dir>/gemworks/<session>.geml`,
each with `"item": "session:<id>"` in its `#journal` block. The two kinds never
meet: `gemworks mark` and `gemworks advance` act on the work item's journal,
never on a session's.

### Switching workflows

`gemworks use <name>` changes the default: the workflow a **new** work item
starts under. A work item with a journal keeps the workflow its journal was
started under, so `use` warns about nothing, and the band, the board and
`gemworks status` name an item's workflow when it is not the default:

```
$ gemworks use dev
default workflow: dev (a work item with a journal keeps its own)
$ gemworks status
feat/rate-limit · #explore · workflow coding (default dev)
```

A journal whose workflow file is gone does not open, and says so: restore the
file, or move the journal aside — rename it, or delete it — and the next
operation starts the work item over under the default. A renamed journal is
still a journal: `gemworks verify` checks it against the workflow it was made
under.

```sh
mv .geml/journals/feat/rate-limit.geml .geml/journals/feat/rate-limit.coding.geml
gemworks status
gemworks verify .geml/journals/feat/rate-limit.coding.geml --workflow .geml/workflows/coding.geml
```

### When something fails

- Exit codes: `0` done; `1` the operation failed, with one line on stderr that
  starts `gemworks:` and never a stack trace; `2` a usage error — an unknown
  verb, a missing argument, an option the verb does not have (`status --jsno`).
- No workflow: ``no workflow here: run `gemworks init` ``. Several and none
  chosen: ``choose one with `gemworks use <name>` ``. A name in
  `.geml/project.geml` or a `GEMWORKS_STATECHART` that finds no file says so.
  A workflow with errors prints them: `<file>: <code>: <message>`.
- No work item: `status` prints why and exits 0; `mark`, `unmark`, `advance`
  and `rollback` exit 1 with the same reason.
- A refused move prints the reason and exits 1; when the transition exists, the
  refusal is also in the journal. `mark` refuses a variable whose source is not
  a person, and one the model writes.
- A journal that will not resume (it fails verification, or its state is gone)
  names itself and the way out: move it aside.
- A journal another process holds is waited for 5 seconds, then the command
  fails naming the lock and its holder; delete the lock file if no gemworks
  process is running.
- `.geml/context.geml` that cannot be written never fails a command: the
  journal is written, and the next command writes the context document.
