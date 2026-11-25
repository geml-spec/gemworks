import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { syncDev } from "../scripts/sync-dev.mjs";

/** A folder with a plugin manifest named `name` (none when null) and the files given, by `/`-separated path. */
function folder(name, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "gw-sync-"));
  if (name !== null) files = { ".claude-plugin/plugin.json": JSON.stringify({ name }), ...files };
  for (const [path, text] of Object.entries(files)) {
    const at = join(dir, ...path.split("/"));
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, text);
  }
  return dir;
}
const read = (dir, path) => readFileSync(join(dir, ...path.split("/")), "utf8");
const has = (dir, path) => existsSync(join(dir, ...path.split("/")));
const checkout = () => folder("gemworks", { "dist/a.js": "new", "hooks/register.tsx": "module", "node_modules/x/index.js": "dependency", ".geml/project.geml": "the project's own" });

test("syncs into a folder holding this plugin, a folder not there yet, or one holding only the engine's types", () => {
  const from = checkout();
  // A copy of this plugin: dist replaced whole, the rest copied over, what is not the plugin left out, the types kept.
  const copy = folder("gemworks", { "dist/old.js": "gone", ".claude-plugin/types/claude-code/index.d.ts": "engine" });
  syncDev(from, copy);
  assert.deepEqual([read(copy, "dist/a.js"), has(copy, "dist/old.js"), read(copy, "hooks/register.tsx")], ["new", false, "module"]);
  assert.deepEqual([has(copy, "node_modules"), has(copy, ".geml"), read(copy, ".claude-plugin/types/claude-code/index.d.ts")], [false, false, "engine"]);
  const fresh = join(mkdtempSync(join(tmpdir(), "gw-sync-")), "gemworks");
  syncDev(from, fresh);
  assert.equal(JSON.parse(read(fresh, ".claude-plugin/plugin.json")).name, "gemworks");
  const watched = folder(null, { ".claude-plugin/types/claude-code/index.d.ts": "engine" });
  syncDev(from, watched);
  assert.deepEqual([read(watched, "dist/a.js"), read(watched, ".claude-plugin/types/claude-code/index.d.ts")], ["new", "engine"]);
});

test("refuses a folder holding another plugin, or anything but a plugin, and leaves every file of it as it was", () => {
  const from = checkout();
  // CLAUDE_CODE_PLUGIN_DIRS named gemsbang's folder first: a copy into it overwrote its manifest and its dist.
  const other = folder("gemsbang", { "dist/im.js": "im", "hooks/register.tsx": "gemsbang's" });
  assert.throws(() => syncDev(from, other), /holds the plugin gemsbang, not gemworks: nothing synced/);
  assert.deepEqual([JSON.parse(read(other, ".claude-plugin/plugin.json")).name, read(other, "dist/im.js"), read(other, "hooks/register.tsx"), has(other, "dist/a.js")], ["gemsbang", "im", "gemsbang's", false]);
  const notes = folder(null, { "notes.txt": "mine" });
  assert.throws(() => syncDev(from, notes), /holds no plugin, not gemworks/);
  assert.deepEqual([read(notes, "notes.txt"), has(notes, "dist")], ["mine", false]);
  assert.throws(() => syncDev(from, join(from, "dev")), /inside this checkout/);
  assert.throws(() => syncDev(folder(null), mkdtempSync(join(tmpdir(), "gw-sync-"))), /no \.claude-plugin\/plugin\.json/);
});
