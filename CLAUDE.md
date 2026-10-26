# Gemworks — notes for Claude

Gemworks runs coding agents through GEML workflows: a Claude Code plugin (a band above the prompt, a board),
DeepSeek Harness and Pi adapters, an MCP server for other hosts, and a CLI (`gemworks`, short `gwx`). It depends on
the published `@geml/geml` parser and nothing else at runtime.

## Layout

- `src/core/` — host-agnostic: statecharts, the tool dictionary, policy, journals, session logs, work items.
- `src/hosts/claude-code/` — the Claude Code plugin's pure parts (band, board, coach, text); `hooks/register.tsx` is
  the plugin module itself and imports them from `dist/`.
- `src/hosts/dsh/`, `src/hosts/pi/`, `codex/` — the other hosts' adapters.
- `src/bridge.ts` — the Node side the plugin asks through the CLI (git, gh, files).
- `workflows/`, `coach/` — bundled flows; `skills/` is what Claude Code loads, `host-skills/` what the hosts that read
  one folder load (the geml plugin's two skills are copies there).
- `test/*.test.mjs` — node:test suites over `dist/`; `tests/*.test.ts` — `claude plugin test` suites for the module.

## Build and check

Run each gate as its own command and report it; all four take 4–6 minutes on Windows.

```sh
npm run build                                     # tsc + bundle
claude plugin validate .
claude plugin test .
node --test --test-concurrency=2 test/*.test.mjs  # includes the hooks type check
```

A gate that finds nothing to check (no type declarations, no prerequisite) has failed, not passed.

## Versions

Until 1.0, every change to the plugin bumps the patch version: the board shows it, and that is how anyone can tell
which build they run. `node scripts/bump.mjs <version>` changes all five places (package.json, the lockfile twice, both
plugin manifests); the smoke test fails when they disagree. Release notes and the CHANGELOG are prose for people:
they are not written as a side effect of a bump.

## Trying a build

`node scripts/sync-dev.mjs <folder>` copies the checkout into a folder named in `CLAUDE_CODE_PLUGIN_DIRS` (with
`CLAUDE_CODE_PLUGIN_DIR_WATCH=1` every session reloads it). Sync only after all gates pass. A fix is not done until
the running version is the synced one: check the board's version or the session's last reload before saying so.

## Rules that bite

- Cross-platform: every test must hold on Linux and macOS as well as Windows — path separators, CRLF, `cmd.exe`
  quoting, shims with a POSIX twin, case-sensitive file systems. CI runs all three.
- The plugin never stops the person on its own failure: anything it cannot decide in two seconds lets the call
  through.
- A rendering hook is pure (it reads state, never writes it); desktop panes fail past about 1,100 elements.
- Read the engine's own declarations before fixing behaviour that depends on it.
- `.geml/` in this checkout is the project's own working data and never goes into git.
- Commit messages are in English; nothing goes to npm or GitHub without the maintainer's say-so.
