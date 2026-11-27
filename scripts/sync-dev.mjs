// Copy this checkout into a folder Claude Code loads the plugin from while it is being developed (one named in
// CLAUDE_CODE_PLUGIN_DIRS, watched with CLAUDE_CODE_PLUGIN_DIR_WATCH=1: every session reloads it on the next call).
// Everything but what is not the plugin: dependencies, git, the project's own .geml/, coverage and packs. What the
// folder holds that the checkout no longer does is removed first, so a file deleted here (hooks/hooks.json, 0.3.18,
// left beside hooks/modules.json until the engine refused to load either, 2026-11-27) or a module the build no longer
// makes is not left behind; what the copy leaves out and the engine's .claude-plugin/types/ stay. Build and pass the
// gates first.
//
// Only into a folder that holds this plugin already, or nothing yet: CLAUDE_CODE_PLUGIN_DIRS names other plugins'
// folders too, and a copy into one of them (gemsbang's, the first named, 2026-11-25) overwrote its files and its dist.
// Usage: node scripts/sync-dev.mjs <folder>
import { cpSync, existsSync, lstatSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const LEFT = new Set(["node_modules", ".git", ".geml", "coverage", ".nyc_output", ".pack", "gemworks-pkg"]);

/** Whether the copy leaves a path (relative to the checkout, or to the folder synced into) out. */
const leftOut = (path) => LEFT.has(path.split(sep)[0]) || path.endsWith(".tgz");
/** What the folder synced into keeps whatever the checkout holds: what the copy leaves out, and the engine's types. */
const kept = (path) => leftOut(path) || path === join(".claude-plugin", "types");

/** Remove what `to` holds under `rel` that `from` no longer does, or holds as a folder where `to` has a file or back. */
function prune(from, to, rel = "") {
  for (const entry of readdirSync(join(to, rel), { withFileTypes: true })) {
    const path = rel === "" ? entry.name : join(rel, entry.name);
    if (kept(path)) continue;
    let source;
    try { source = lstatSync(join(from, path)); } catch { source = undefined; }
    if (source === undefined || source.isDirectory() !== entry.isDirectory()) rmSync(join(to, path), { recursive: true, force: true });
    else if (entry.isDirectory()) prune(from, to, path);
  }
}

/** The name a folder's plugin manifest gives; undefined where it has none that reads. */
function pluginIn(dir) {
  try { return JSON.parse(readFileSync(join(dir, ".claude-plugin", "plugin.json"), "utf8")).name; } catch { return undefined; }
}

/** Whether a folder holds nothing yet: not there, empty, or only the types the engine writes into a folder it watches. */
function bare(dir) {
  if (!existsSync(dir)) return true;
  const top = readdirSync(dir);
  return top.length === 0 || (top.length === 1 && top[0] === ".claude-plugin" && readdirSync(join(dir, ".claude-plugin")).every((x) => x === "types"));
}

/** Sync the checkout at `from` into `to`, which must hold the same plugin or nothing yet; otherwise nothing is touched. */
export function syncDev(from, to) {
  const FROM = resolve(from), TO = resolve(to);
  const within = relative(FROM, TO);
  if (within === "" || (!within.startsWith("..") && !isAbsolute(within))) throw new Error(`${TO} is inside this checkout`);
  const name = pluginIn(FROM);
  if (name === undefined) throw new Error(`${FROM} has no .claude-plugin/plugin.json with a name: nothing synced`);
  if (!bare(TO)) {
    const there = pluginIn(TO);
    if (there !== name) throw new Error(`${TO} holds ${there === undefined ? "no plugin" : `the plugin ${there}`}, not ${name}: nothing synced`);
  }
  if (existsSync(TO)) prune(FROM, TO);
  cpSync(FROM, TO, { recursive: true, filter: (src) => !leftOut(relative(FROM, src)) });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const to = process.argv[2];
  if (to === undefined || to === "") throw new Error("usage: node scripts/sync-dev.mjs <folder>");
  syncDev(fileURLToPath(new URL("..", import.meta.url)), to);
  console.log(`synced ${resolve(to)}`);
}
