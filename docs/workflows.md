# The bundled strict flows: dev, matter, video

[← Back to README](../README.md)

## The dev workflow

`/gemworks add dev` (or `gemworks init --template dev`) writes
`.geml/workflows/dev.geml`, its statechart with each stage's prompt after it,
and adds its rows to `.geml/tools.geml`. Its work item is the branch (`flow-unit = "branch"`), so
nothing is recorded on the default branch. Five states:

```
#build ──machine──▶ #review ──machine──▶ #deploy ──approval──▶ #release ──machine──▶ #done
   ▲                   │
   └── review 要求改动 ─┘   (the model's)
```

| state | uses |
|---|---|
| `#build` | `edit`, `test`, `pr` |
| `#review` | `edit`, `test` |
| `#deploy` | `deploy-staging` |
| `#release` | `deploy-prod` |

What moves it without the model's word is the evidence:

| variable | source | read from |
|---|---|---|
| `tests-pass` | `{ "tool": "test" }` | the exit status of a call bound to `test` — `Bash(npm test)`, `Bash(cargo test)`, … in the dictionary — in a state that declares `test` |
| `pr-open`, `pr-merged`, `ci-pass` | `"pr-open"`, `"pr-merged"`, `"ci-success"` | gh: the branch's newest pull request open, merged; the latest run of every CI workflow on `HEAD` succeeded |
| `review-ready` | `"human"` | a person's tick, on the board or with `gemworks mark review-ready` |
| `deployed-staging`, `deployed-prod` | `{ "tool": "deploy-staging" }`, `{ "tool": "deploy-prod" }` | the exit status of a `wrangler deploy` the dictionary binds to that use |

1. **#build.** Write the code and the tests. Every `npm test` run records
   `tests-pass` from its exit code; the stage tells the model not to report
   it. `build→review` is machine-judged, and its guard holds on any of three:
   the tests pass and a pull request is open; the pull request is merged (it
   was merged before Gemworks saw it open); or a person ticked `review-ready`,
   for a project whose tests run only in CI. The model cannot tick it:
   `gemworks mark review-ready` run by the model is refused, and `set` refuses
   evidence.
2. **#review.** Work through the review. CI's verdict and the merge are git
   facts, so gh has to be logged in. Merged with CI green, `review→deploy`
   takes the workflow to `#deploy`.
3. **#deploy.** Deploy to staging. `deploy-staging` is `#deploy`'s use and
   `deploy-prod` is `#release`'s: anywhere else the command is refused before
   it runs — `wrangler deploy --env staging` in each spelling the dictionary
   has a row for (`-e staging`, `--env=staging`, behind `npx`, `pnpm` or
   `bunx`), and `wrangler deploy` with any other arguments or none, which
   deploys the top-level environment and counts as production. The pattern is
   found anywhere in the line, `bash -c "…"` included; a launcher the
   dictionary has no row for, a variable or a script gets past it, and a
   `--dry-run` counts as the deploy it spells. Deploy with another tool and you
   rewrite the rows.
4. **#release.** `deploy→release` needs a person, and a staging deploy first:
   its guard reads `deployed-staging`. The press on the board, or
   `gemworks advance release` in a terminal, is the approval. The model's `move`
   to `#release` is refused, with a pointer to the board. A clean production
   deploy sets `deployed-prod`, and `release→done` ends the work item.

**Rework.** `review→build` is the model's (`review 要求改动`) or a person's,
and resets `tests-pass` and `review-ready` to false in the same revision: the
last pass's green run and tick stop counting. The workflow stays in `#build`
until the tests pass again, a person ticks `review-ready` again, or the pull
request is merged. The first machine-judged step after a transition never
returns to the state that transition just left, so a guard that still holds on
git's facts alone does not bounce it back at once either.

**Expiry.** `tool` evidence is stamped with the work item's content — the git
tree of the working copy — and a value written on other content returns to
false at the next operation: tests that passed before an edit do not count
after it.

A `Bash(…)` key matches a command that starts with it, whole words, and `*`
any run of text; the key with the longest literal part wins
(`Bash(wrangler deploy*--env staging)` beats `Bash(wrangler deploy)`). Change
the `test` rows to your test command and the deploy rows to your deploy, and
point the guide at your own conventions.

## The matter workflow

`/gemworks add matter` (or `gemworks init --template matter`) writes
`.geml/workflows/matter.geml`. One matter is one work item: a file under
`.geml/matters/` (`flow-unit = "file:.geml/matters/*.geml"`) that records the
symptom, the cause, the options and the result of one thing — a bug fixed, a
screen changed, a line of copy written. It keeps its own state in its meta
(`flow-state-key = "state"`), so the state travels with the file.

```
#noted ──model──▶ #deciding ──approval──▶ #doing ──machine──▶ #checking ──approval──▶ #done
   │                  │                      ▲                    │
   └── 直接做 (a person's) ──────────────────┘◀─── 打回 (a person's)┘
                                   #parked ⇄ (a person parks and reopens)
```

| state | uses |
|---|---|
| `#noted`, `#deciding`, `#checking`, `#parked` | `note`: writing the matter file itself |
| `#doing` | `note`, `edit` (writing any other file), `check` |

The model moves a noted matter to `#deciding` once the cause and the options
are in it; every other way out is a person's button. `#doing` moves to
`#checking` on its own when the check passes (`check-pass`, from the use
`check`), or when a person ticks `accept-now`; going back to `#doing` clears
both. The dictionary splits the file tools by path —
`Edit(.geml/matters/*)` is `note`, `Edit` is `edit`, the longest literal wins —
and names pi's `edit` and `write` too, so the fence holds there as well.

## The video workflow

`/gemworks add video` (or `gemworks init --template video`) writes
`.geml/workflows/video.geml`, its statechart with each stage's prompt after it,
and adds its rows to `.geml/tools.geml`. Its work item is an episode, each geml-media document under
`episodes/` (`flow-unit = "file:episodes/*.geml"`), the current one being the
episode a write call touched last; it needs no git. Seven states:

```
#script ─machine─▶ #assets ─machine─▶ #cut ─machine─▶ #render ─machine─▶ #review ─machine─▶ #publish ─machine─▶ #done
                      ▲               ▲ ▲              │                  │
                      │               │ └── 出片失败 ───┘                  │
                      │               └─────────── 要改剪辑 ───────────────┤
                      └───────────────────── 要重出镜头 ────────────────────┘
```

| state | uses |
|---|---|
| `#assets` | `image`, `video`, `voice`, `import`, `log`, `todo-check` |
| `#cut` | `lay`, `stale-check` |
| `#render` | `render` |

What moves it without the model's word is the evidence:

| variable | source | read from |
|---|---|---|
| `script-final`, `approved`, `published` | `"human"` | a person's tick, on the board or with `gemworks mark` |
| `assets-done` | `{ "tool": "todo-check" }` | `geml media todo <episode> --check`, by its exit code, in `#assets` |
| `no-stale` | `{ "tool": "stale-check" }` | `geml check <episode> --severity media-stale-clip=error`, by its exit code, in `#cut` |
| `rendered` | `{ "tool": "render" }` | `geml media build … --out <file>`, by its exit code, in `#render` |

1. **#script.** Write the episode: prompts (`media-text .prompt`) and lines
   (`media-text .line`). An episode is one file — its script, its asset blocks
   and generation log, its timeline — because references point one way and
   `geml media todo` sees only what the episode reaches. A person ticks
   `script-final` (剧本定稿); the model cannot.
2. **#assets.** Generate what `geml media todo episodes/epNN.geml --root . --json`
   lists, and register each result with `geml media import` and
   `geml media log`. The image, video and voice tools are the uses `image`,
   `video` and `voice`: the dictionary has no row for them until you answer
   the question the first call raises, and a row's `params` (an aspect ratio,
   a voice) fill in what the model leaves out.
   `geml media todo episodes/epNN.geml --root . --check` exits 0 once nothing
   is left, and `assets→cut` takes the workflow to `#cut`.
3. **#cut.** Lay the timeline (`geml media lay`; `geml media export --to player`
   for a preview).
   `geml check episodes/epNN.geml --root . --severity media-stale-clip=error`
   exits 0 when no clip uses a stale asset, and `cut→render` follows.
4. **#render.** `geml media build … --out` is the use `render`, which only
   `#render` declares: in any other stage it is refused before it runs, in
   each spelling the dictionary has a row for (`geml` behind `npx`, `bunx`,
   `pnpm dlx`, `yarn dlx` or `npm exec`; `-o` for `--out`). A build needs
   `--out` and a file, and without one it does not run, so only such a build
   is bound. `#render` is entered only after a clean stale check, so a prompt
   edited without generating again keeps the film from being made. A clean
   build takes the workflow to `#review`.
5. **#review.** A person watches the film and ticks `approved` (审片通过),
   which takes the workflow to `#publish`; once the episode is out, `published`
   (已发布) ends the work item at `#done`.

The line above the prompt shows the episode's to-do count:
`⧗ episodes/ep02 · assets · 待办 7 项 · assets-done ✗ · → #cut 自动 · 待 assets-done`.
It is counted when a session starts and when the board opens or refreshes, in
process, by the parser's own `todo` — the items
`geml media todo <file> --root . --json` lists — and shows while the episode
is in the stage it was counted in; when the stage changes, it goes. Past 999 it
reads `待办 999+ 项`. A count that fails or takes longer than ten seconds, or
an episode the parser's confined file host cannot read (a link out of the
project), shows no count rather than `无待办`. No variable reads it.

**Rework.** `review→assets` (a shot made again) and `review→cut` (the cut
changed) are the model's, by `move`, or a person's, on the board. Each clears
the last pass's evidence in the same revision: `review→assets` returns
`assets-done`, `no-stale` and `rendered` to false, `review→cut` `no-stale` and
`rendered`. So the to-do check, the stale check and the render come round
again, and the new film waits for a person's `approved`. A failed render goes
back the same way: `render→cut` clears `no-stale`. And every `tool` variable
expires when the episode file changes: a check that passed before an edit does
not count after it.

Every command names the episode's file and passes `--root .`: the dictionary
reads the command line, and under a `file:` unit a command's evidence goes to
the episode its command names, relative to the directory it runs in.
`geml media todo --check` is in `@geml/geml`'s unreleased changes; until a
release carries it, run the parser from this checkout
(`node geml-parser/dist/cli.js media todo …`) and add a row for that spelling.
