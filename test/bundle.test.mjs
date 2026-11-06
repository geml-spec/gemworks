import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BUNDLE = fileURLToPath(new URL("../dist/gemworks.mjs", import.meta.url));
const CODING = fileURLToPath(new URL("../workflows/coding/flow.geml", import.meta.url));

test("the bundle is one file that runs with no node_modules beside it", () => {
  const dir = mkdtempSync(join(tmpdir(), "gemworks-bundle-"));
  copyFileSync(BUNDLE, join(dir, "gemworks.mjs"));
  copyFileSync(CODING, join(dir, "flow.geml"));
  const usage = spawnSync(process.execPath, [join(dir, "gemworks.mjs")], { cwd: dir, encoding: "utf8" });
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /^usage: gemworks /);
  const check = spawnSync(process.execPath, [join(dir, "gemworks.mjs"), "check", "flow.geml"], { cwd: dir, encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr);
});

test("the bundle, run from the plugin's dist/, says the parser's own version, not gemworks's", () => {
  const parser = JSON.parse(readFileSync(new URL("../node_modules/@geml/geml/package.json", import.meta.url), "utf8")).version;
  const gemworks = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  const dir = mkdtempSync(join(tmpdir(), "gemworks-bundle-"));
  const r = spawnSync(process.execPath, [BUNDLE, "hook"], { cwd: dir, encoding: "utf8", input: `${JSON.stringify({ v: 1, op: "status", root: dir })}\n` });
  const answer = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.deepEqual(answer.shell?.versions, { gemworks, parser }, r.stderr);
});

test("the bundle imports only Node's built-ins and carries no parser CLI hand-off", () => {
  const src = readFileSync(BUNDLE, "utf8");
  const specs = [...src.matchAll(/^import\s[^;]*?from\s*"([^"]+)";?$/gm)].map((m) => m[1]);
  assert.ok(specs.length > 0);
  for (const s of specs) assert.match(s, /^node:/, s);
  assert.doesNotMatch(src, /if \(isCliInvocation\(\)\) \{/);
});
