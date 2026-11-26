import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { REQUIRED_CALLS } from "../../dist/hosts/claude-code/engine.js";

// The hooks module type-checks against the engine's declarations of the
// plugin API, with hooks/tsconfig.json. No package ships them: Claude Code
// writes them itself, into .claude-plugin/types/ when it loads the plugin from
// a folder it writes in, and into its temp folder's
// claude-<user> (or plain claude on Windows)/bundled-skills/<build>/<hash>/plugin-authoring/types/claude-code.d.ts
// each time the plugin-authoring skill loads. The newest of those is checked
// against (a laid folder stays as old as the last load from this checkout);
// CLAUDE_CODE_TYPES names a claude-code.d.ts that wins over both. A machine
// with none fails, saying how to get one: a check that skipped is how type
// errors reached the branch. Only CI, which has no Claude Code, skips it.
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CONFIG = join(ROOT, "hooks", "tsconfig.json");
const LAID = join(ROOT, ".claude-plugin", "types", "claude-code", "index.d.ts");
const GIVEN = process.env["CLAUDE_CODE_TYPES"];
const MISSING = "no plugin API declarations on this machine to check the hooks against: load the plugin-authoring skill once in a Claude Code session (it writes them under its temp folder's bundled-skills/), or set CLAUDE_CODE_TYPES to a claude-code.d.ts";

/** The plugin-authoring skill's copies of the declarations, under Claude Code's temp folders. */
function skillCopies() {
  const list = (dir) => { try { return readdirSync(dir); } catch { return []; } };
  const found = [];
  for (const base of new Set(["/tmp", tmpdir()])) {
    // claude-<user> on Linux and macOS; plain claude where the temp folder is the user's own (Windows).
    for (const own of list(base).filter((n) => n === "claude" || n.startsWith("claude-"))) {
      const skills = join(base, own, "bundled-skills");
      for (const build of list(skills)) for (const hash of list(join(skills, build))) {
        const file = join(skills, build, hash, "plugin-authoring", "types", "claude-code.d.ts");
        if (existsSync(file)) found.push(file);
      }
    }
  }
  return found;
}

/** The declarations to check against, and whether they are the laid folder; null when this machine has none. */
function declarations() {
  if (GIVEN !== undefined && GIVEN !== "") return { file: GIVEN, laid: false };
  const candidates = [...(existsSync(LAID) ? [LAID] : []), ...skillCopies()];
  if (candidates.length === 0) return null;
  const newest = candidates.reduce((a, b) => (statSync(b).mtimeMs > statSync(a).mtimeMs ? b : a));
  return { file: newest, laid: newest === LAID };
}

const found = declarations();
const SKIP = found === null && process.env["CI"] ? `${MISSING} (CI has no Claude Code)` : false;

/**
 * The calls and hook events the declarations name, and those of them marked deprecated: each `'noun.event':` key of the
 * API's maps, deprecated when the doc comment right above it says @deprecated. Fields and element props marked so (a
 * hook input's team_name, a Text's bold) are not keys of that shape and are not read here.
 */
function declaredCalls(text) {
  const named = new Set();
  const deprecated = new Set();
  let doc = null; // the doc comment that ended on the line before, while nothing else has come since
  let open = null; // the lines of a doc comment not yet ended
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (open !== null) {
      open.push(trimmed);
      if (trimmed.includes("*/")) { doc = open.join("\n"); open = null; }
      continue;
    }
    if (trimmed.startsWith("/**")) {
      if (trimmed.includes("*/")) doc = trimmed; else open = [trimmed];
      continue;
    }
    const key = /^'([a-z]\w*(?:\.\w+)+)'\??:/.exec(trimmed);
    if (key !== null) {
      named.add(key[1]);
      if (doc !== null && doc.includes("@deprecated")) deprecated.add(key[1]);
    }
    if (trimmed !== "") doc = null;
  }
  return { named, deprecated };
}

/** The engine calls (`$.noun.event(`) and hook events (`on('noun.event'`) the hooks module's files spell, each with the files that do. */
function moduleCalls() {
  const used = new Map();
  const add = (call, file) => used.set(call, [...new Set([...(used.get(call) ?? []), file])]);
  const dir = join(ROOT, "hooks");
  for (const file of readdirSync(dir).filter((n) => n.endsWith(".tsx")).sort()) {
    const text = readFileSync(join(dir, file), "utf8");
    for (const m of text.matchAll(/\$\.([a-z]\w*)\.(\w+)\(/g)) add(`${m[1]}.${m[2]}`, file);
    for (const m of text.matchAll(/\bon\(\s*['"]([a-z]\w*(?:\.\w+)+)['"]/g)) add(m[1], file);
  }
  return used;
}

/** Deprecated calls the module keeps on purpose, each with why. An entry the module no longer spells is taken out. */
const KEPT = new Map([
  ["session.surface", "outward.tsx asks it only when session.surfaces() throws: the fallback for an engine from before surfaces()"],
]);

test("a key is deprecated by the doc comment right above it, on one line or several, with either line ending", () => {
  const text = [
    "  type Args = {",
    "      /**",
    "       * The argument of `$.session.surface()`.",
    "       *",
    "       * @deprecated with `$.session.surface()`; hook `session.surfaces`",
    "       */",
    "      'session.surface': NoArgs;",
    "      /** The argument of `$.session.surfaces()`. */",
    "      'session.surfaces': NoArgs;",
    "      /** @deprecated use `fs.read` */",
    "      'fs.slurp'?: NoArgs;",
    "      /** @deprecated said of the field below, not of the key after it */",
    "      worktreePath?: string;",
    "      'process.run': ProcessRunArgs;",
    "      'classic.Stop': NoArgs;",
    "  };",
  ];
  for (const eol of ["\n", "\r\n"]) {
    const { named, deprecated } = declaredCalls(text.join(eol));
    assert.deepEqual([...named].sort(), ["classic.Stop", "fs.slurp", "process.run", "session.surface", "session.surfaces"]);
    assert.deepEqual([...deprecated].sort(), ["fs.slurp", "session.surface"]);
  }
});

test("the hooks module calls nothing the plugin API marks deprecated, but for the fallbacks it keeps on purpose", { skip: SKIP }, (t) => {
  assert.ok(found !== null, MISSING);
  assert.ok(existsSync(found.file), `CLAUDE_CODE_TYPES names ${found.file}, which does not exist`);
  t.diagnostic(`checked against ${found.file}`);
  const { named, deprecated } = declaredCalls(readFileSync(found.file, "utf8"));
  // The reading found the API's maps: they name every call the module cannot do without.
  for (const call of REQUIRED_CALLS) assert.ok(named.has(call), `${found.file} does not declare ${call}: the module needs it, or this test no longer reads the declarations`);
  t.diagnostic(`deprecated there: ${[...deprecated].sort().join(", ") || "none"}`);
  const used = moduleCalls();
  const offending = [...used].filter(([call]) => deprecated.has(call) && !KEPT.has(call)).map(([call, files]) => `${call} (${files.join(", ")})`);
  assert.deepEqual(offending, [], `the hooks module calls what ${found.file} marks deprecated: move it to the call that replaces it`);
  for (const call of KEPT.keys()) assert.ok(used.has(call), `KEPT lists ${call}, which the hooks module no longer calls: take it out`);
});

test("the hooks module type-checks against the plugin API", { skip: SKIP }, (t) => {
  assert.ok(found !== null, MISSING);
  assert.ok(existsSync(found.file), `CLAUDE_CODE_TYPES names ${found.file}, which does not exist`);
  t.diagnostic(`checked against ${found.file}`);
  let project = CONFIG;
  if (!found.laid) {
    // The hooks' own options, with the declarations named instead of the laid folder.
    const dir = mkdtempSync(join(tmpdir(), "gemworks-hooks-types-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    project = join(dir, "tsconfig.json");
    writeFileSync(project, JSON.stringify({ extends: CONFIG, include: [], files: [found.file, join(ROOT, "hooks", "register.tsx"), join(ROOT, "hooks", "state.d.ts")] }));
  }
  const r = spawnSync(process.execPath, [join(ROOT, "node_modules", "typescript", "bin", "tsc"), "-p", project], { encoding: "utf8" });
  assert.equal(r.status, 0, `checked against ${found.file}\n${r.stdout}${r.stderr}`);
});
