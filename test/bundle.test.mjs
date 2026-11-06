import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The CLI the Claude Code plugin starts: dist/gemworks.mjs, the gemworks-*.mjs files it loads, and the parser
// copied into dist/vendor/geml/ (scripts/bundle.mjs).
const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const CODING = fileURLToPath(new URL("../workflows/coding/flow.geml", import.meta.url));
const OWN = readdirSync(DIST).filter((f) => f === "gemworks.mjs" || /^gemworks-.*\.mjs$/.test(f));
const VENDOR = join(DIST, "vendor", "geml");
const FILES = [...OWN.map((f) => join(DIST, f)), ...readdirSync(VENDOR).filter((f) => f.endsWith(".js")).map((f) => join(VENDOR, f))];

test("the bundle runs with no node_modules beside it: its own files and the parser's copy are all it needs", () => {
  const dir = mkdtempSync(join(tmpdir(), "gemworks-bundle-"));
  for (const f of OWN) copyFileSync(join(DIST, f), join(dir, f));
  cpSync(VENDOR, join(dir, "vendor", "geml"), { recursive: true });
  copyFileSync(CODING, join(dir, "flow.geml"));
  const usage = spawnSync(process.execPath, [join(dir, "gemworks.mjs")], { cwd: dir, encoding: "utf8" });
  assert.equal(usage.status, 2, usage.stderr);
  assert.match(usage.stderr, /^usage: gemworks /, "the parser's CLI hand-off fires only when its own geml.js is the script run");
  const check = spawnSync(process.execPath, [join(dir, "gemworks.mjs"), "check", "flow.geml"], { cwd: dir, encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr);
});

test("the bundle's files import only Node's built-ins and each other", () => {
  const IMPORT = /(?:^|[\s;])(?:import|export)\s[^;]*?from\s*["']([^"']+)["']|(?:^|[\s;])import\s*\(?\s*["']([^"']+)["']/gm;
  for (const file of FILES) {
    const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const specs = [...code.matchAll(IMPORT)].map((m) => m[1] ?? m[2]);
    for (const s of specs) {
      if (isBuiltin(s)) continue;
      if (s.includes("${")) continue; // text the parser writes into a page it renders, not an import of its own
      assert.match(s, /^\.\.?\//, `${file}: ${s} is neither a built-in nor a file of the bundle`);
      assert.ok(existsSync(resolve(dirname(file), s)), `${file}: ${s} is missing`);
    }
  }
  const parser = JSON.parse(readFileSync(join(VENDOR, "package.json"), "utf8"));
  const installed = JSON.parse(readFileSync(new URL("../node_modules/@geml/geml/package.json", import.meta.url), "utf8"));
  assert.deepEqual([parser.name, parser.version, parser.type], ["@geml/geml", installed.version, "module"], "the copy is the installed parser's release, as ES modules");
  assert.ok(existsSync(join(VENDOR, "LICENSE")), "the parser's MIT license travels with its copy");
});
