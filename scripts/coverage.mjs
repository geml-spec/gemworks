// The coverage gate: the whole node:test suite (test/all.mjs) under c8, counted against src/ through source maps, and
// failing below LINES percent of src/'s lines or BRANCHES percent of its branches.
//
//   npm run coverage
//
// dist/ is built with source maps first, so a line run in a compiled module or in the bundle counts as its line in
// src/. It is built again without them at the end, whatever happened: package.json's files[] takes dist/ whole, so a
// map left there would ship. Node's compile cache stays off for the run: code read from the cache is not counted.
// hooks/*.tsx is not counted here: it runs in `claude plugin test .`, which has no coverage of its own.
//
// The report is coverage/coverage-summary.json, beside the text summary printed at the end.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The floors. Lines stand above 99%, branches at 87.4%: each floor keeps its count from slipping, with room for what one
// platform reaches and another does not (CI counts on Linux; branches for Windows go untaken there, and the reverse).
const LINES = 95;
const BRANCHES = 85;

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const bin = (pkg, file) => join(root, "node_modules", pkg, file);

/** Runs a Node script from the checkout's root with extra environment; its exit status. */
function node(args, env = {}) {
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
  return r.status ?? 1;
}

/** Every source map under dist/; none before the first build (a fresh checkout, as CI's). */
function maps(dir = dist) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? maps(join(dir, e.name)) : e.name.endsWith(".map") ? [join(dir, e.name)] : []);
}

/** dist/ as `npm run build` makes it: without maps, or with them for the coverage run. */
function build(withMaps) {
  for (const f of maps()) rmSync(f);
  const tsc = node([bin("typescript", "bin/tsc"), ...(withMaps ? ["--sourceMap"] : [])]);
  return tsc !== 0 ? tsc : node([join(root, "scripts", "bundle.mjs")], withMaps ? { GEMWORKS_SOURCEMAP: "1" } : {});
}

let status = build(true);
try {
  if (status === 0) {
    status = node([
      bin("c8", "bin/c8.js"),
      "--include", "src/**", "--exclude-after-remap",
      "--reporter", "text-summary", "--reporter", "json-summary",
      "--report-dir", "coverage", "--temp-directory", join("coverage", "tmp"),
      "--check-coverage", "--lines", String(LINES), "--branches", String(BRANCHES),
      process.execPath, join("test", "all.mjs"),
    ], { NODE_DISABLE_COMPILE_CACHE: "1", GEMWORKS_COVERAGE: "1" });
  }
} finally {
  const rebuilt = build(false);
  if (status === 0) status = rebuilt;
}
process.exit(status);
