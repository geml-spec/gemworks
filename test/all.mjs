// The node:test gate, run the way geml's test/all.mjs runs its suites: every test file in its own `node --test`
// process, several at a time, slowest first, at a lower CPU priority, and never stopping at the first failure.
//
//   node test/all.mjs                      every test/*.test.mjs
//   node test/all.mjs test/a.test.mjs …    just those
//   GEMWORKS_TEST_LANES=4 node test/all.mjs
//
// Lanes. The files are independent (each makes its own temp directories), and the time goes to starting processes
// — git, gh's stand-in, the bundled CLI — which parallelises even where the machine does not get faster. geml
// measured its lanes: 4 and 6 come out the same, 8 is slower, 11 killed a suite. Six, or one fewer than the cores.
//
// Priority. At full width the suite used to starve the person's own Claude Code sessions on the same machine: the
// plugin's bridge calls there have deadlines of seconds, went unanswered, and the band said so. This process drops to
// below-normal priority first, and every process it starts inherits that (a Windows priority class below normal is
// inherited; a POSIX nice value always is), so an interactive session keeps the CPU it needs and the tests take the rest.
//
// No fail-fast. One early failure used to abort what came after it, and what never ran looked like a collapse
// elsewhere. Every file runs; every failure is printed whole at the end, with its file's name.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { constants, cpus, setPriority, tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

try { setPriority(constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed here: normal priority */ }

// What every file's processes inherit:
//  · Node's compile cache, so the CLI a test starts (dist/cli.js and the bundle, dozens of times a file) reads its
//    modules' compiled code instead of compiling them again on every start;
//  · a gh that is not there, unless the run names one: a test that is about gh sets its own stand-in (fakeGh), and
//    every other one used to start the machine's real gh — over a second each on Windows, and an answer that depends
//    on whether this machine has gh, signed in or not.
process.env.NODE_COMPILE_CACHE ??= join(tmpdir(), "gemworks-test-compile-cache");
process.env.GEMWORKS_GH ??= "gh-definitely-not-installed";

const named = process.argv.slice(2).map((f) => resolve(f));
const files = named.length > 0 ? named : readdirSync(here).filter((f) => f.endsWith(".test.mjs")).sort().map((f) => join(here, f));

// Longest first, measured (each run prints its slowest): with a shared queue the first LANES files take a lane each
// at once, so two long ones never stack in one lane behind each other; the quick ones fill whichever lane frees up.
const SLOWEST = ["attribution", "fastpath-parity", "codex", "bridge", "artifacts", "workspace", "mcp", "dev-workflow", "video-workflow", "cli"];
const rank = (f) => { const i = SLOWEST.indexOf(basename(f).replace(/\.test\.mjs$/, "")); return i < 0 ? Infinity : i; };
const ordered = [...files].sort((a, b) => rank(a) - rank(b));

const LANES = Number(process.env.GEMWORKS_TEST_LANES) || Math.max(1, Math.min(6, cpus().length - 1));

/** A file's own run: its output kept whole, its counts read from node:test's summary. */
function runFile(file) {
  return new Promise((done) => {
    const chunks = [];
    const began = Date.now();
    const p = spawn(process.execPath, ["--test", file], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    try { if (p.pid !== undefined) setPriority(p.pid, constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* inherited already, or not allowed */ }
    p.stdout.on("data", (d) => chunks.push(d));
    p.stderr.on("data", (d) => chunks.push(d));
    p.on("error", (err) => chunks.push(Buffer.from(`${err.message}\n`)));
    p.on("close", (code) => {
      const out = Buffer.concat(chunks).toString();
      const count = (name) => Number(out.match(new RegExp(`^ℹ ${name} (\\d+)`, "m"))?.[1] ?? 0);
      done({ file, code: code ?? 1, ms: Date.now() - began, out, tests: count("tests"), pass: count("pass"), fail: count("fail"), skipped: count("skipped") });
    });
  });
}

const began = Date.now();
const results = [];
const queue = [...ordered];
await Promise.all(Array.from({ length: Math.min(LANES, queue.length) }, async () => {
  for (let f = queue.shift(); f !== undefined; f = queue.shift()) {
    const r = await runFile(f);
    results.push(r);
    const name = relative(root, r.file).split("\\").join("/");
    console.log(`${r.code === 0 ? "✔" : "✖"} ${name}  ${(r.ms / 1000).toFixed(1)}s  ${r.pass}/${r.tests}${r.skipped > 0 ? `, ${r.skipped} skipped` : ""}`);
  }
}));
const wall = ((Date.now() - began) / 1000).toFixed(1);

const failed = results.filter((r) => r.code !== 0);
for (const r of failed) console.log(`\n──── ${relative(root, r.file).split("\\").join("/")} ────\n${r.out}`);

const sum = (k) => results.reduce((n, r) => n + r[k], 0);
const slowest = [...results].sort((a, b) => b.ms - a.ms).slice(0, 6);
console.log(`\nslowest: ${slowest.map((r) => `${basename(r.file).replace(/\.test\.mjs$/, "")} ${(r.ms / 1000).toFixed(1)}s`).join(", ")}`);
console.log(`ℹ tests ${sum("tests")}\nℹ pass ${sum("pass")}\nℹ fail ${sum("fail")}\nℹ skipped ${sum("skipped")}`);
if (failed.length > 0) {
  console.log(`\n${failed.length} of ${results.length} files failed in ${wall}s on ${LANES} lanes: ${failed.map((r) => basename(r.file)).join(", ")}`);
  process.exit(1);
}
console.log(`${results.length} files passed in ${wall}s on ${LANES} lanes`);
