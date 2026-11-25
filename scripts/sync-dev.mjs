// Copy this checkout into a folder Claude Code loads the plugin from while it is being developed (one named in
// CLAUDE_CODE_PLUGIN_DIRS, watched with CLAUDE_CODE_PLUGIN_DIR_WATCH=1: every session reloads it on the next call).
// Everything but what is not the plugin: dependencies, git, the project's own .geml/, coverage and packs. dist/ is
// replaced whole, so a module the build no longer makes is not left behind; the engine's .claude-plugin/types/ stays.
// Build and pass the gates first.
//
// Only into a folder that holds this plugin already, or nothing yet: CLAUDE_CODE_PLUGIN_DIRS names other plugins'
// folders too, and a copy into one of them (gemsbang's, the first named, 2026-11-25) overwrote its files and its dist.
// Usage: node scripts/sync-dev.mjs <folder>
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const LEFT = new Set(["node_modules", ".git", ".geml", "coverage", ".nyc_output", ".pack", "gemworks-pkg"]);

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
  if (existsSync(resolve(TO, "dist"))) rmSync(resolve(TO, "dist"), { recursive: true });
  cpSync(FROM, TO, { recursive: true, filter: (src) => !LEFT.has(relative(FROM, src).split(sep)[0]) && !src.endsWith(".tgz") });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const to = process.argv[2];
  if (to === undefined || to === "") throw new Error("usage: node scripts/sync-dev.mjs <folder>");
  syncDev(fileURLToPath(new URL("..", import.meta.url)), to);
  console.log(`synced ${resolve(to)}`);
}
