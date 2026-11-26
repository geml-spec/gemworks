// What host-git.ts says of a repository's branches, worktrees, tracked and ignored files and uncommitted version bumps,
// in the cases the other suites do not reach: no default branch, no branch at all, no repository, git missing.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { branchesAhead, branchesFacts, forgetGitFacts, holdsCommit, trackedUnder, uncommittedBump, unkeptOf, worktreesOf } from "../dist/host-git.js";
import { gitRepo } from "./helpers/repo.mjs";

const made = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "gemworks-hgb-")); made.push(d); return d; };
const repo = (branch) => { const d = gitRepo(branch); made.push(d); return d; };
after(() => { for (const d of made) try { rmSync(d, { recursive: true, force: true, maxRetries: 3 }); } catch { /* harmless */ } });

const git = (d, ...a) => {
  const r = spawnSync("git", ["-C", d, ...a], { encoding: "utf8" });
  assert.equal(r.status, 0, `git ${a.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};

test("branchesFacts with no default branch lists every branch with its tip, ahead of nothing and held by no default branch", () => {
  const d = repo("main");
  git(d, "branch", "-m", "main", "trunk");
  git(d, "branch", "side");
  forgetGitFacts();
  const r = branchesFacts(d);
  const tip = git(d, "rev-parse", "HEAD");
  assert.equal(r.ok, true);
  assert.equal("base" in r, false, "no main, no master, no remote: nothing to measure against");
  assert.deepEqual([...r.branches], [["side", { tip, inDefault: false }], ["trunk", { tip, inDefault: false }]]);
});

test("branchesFacts on a repository with no commit yet has no branch; outside any repository git cannot say", () => {
  const d = tmp();
  git(d, "init", "-q", "-b", "main");
  forgetGitFacts();
  assert.deepEqual(branchesFacts(d), { ok: true, branches: new Map() });
  forgetGitFacts();
  assert.deepEqual(branchesFacts(tmp()), { ok: false, branches: new Map() });
});

test("branchesAhead lists the branches with commits their upstream lacks, with the tip's time; none in a repository with no branch; undefined outside one", () => {
  const origin = repo("main");
  const clone = join(tmp(), "clone");
  assert.equal(spawnSync("git", ["clone", "-q", origin, clone], { encoding: "utf8" }).status, 0);
  git(clone, "config", "user.email", "t@t"); git(clone, "config", "user.name", "t");
  git(clone, "commit", "-q", "--allow-empty", "-m", "two");
  git(clone, "branch", "local-only");
  const ahead = branchesAhead(clone);
  assert.equal(ahead.length, 1, "a branch never pushed is not listed");
  assert.equal(ahead[0].branch, "main");
  assert.equal(ahead[0].ahead, 1);
  assert.ok(!Number.isNaN(Date.parse(ahead[0].newestAt)));
  const empty = tmp();
  git(empty, "init", "-q", "-b", "main");
  assert.deepEqual(branchesAhead(empty), []);
  assert.equal(branchesAhead(tmp()), undefined);
});

test("worktreesOf names every working tree, the main one first; none outside a repository", () => {
  const d = repo("feat/x");
  const wt = join(tmp(), "wt");
  git(d, "worktree", "add", "-q", "-b", "w", wt);
  const trees = worktreesOf(d);
  assert.equal(trees.length, 2);
  assert.deepEqual(worktreesOf(tmp()), []);
});

test("holdsCommit: true for a commit the default branch has, false for one it has not, undefined for one git does not know", () => {
  const d = repo("feat/x");
  const base = git(d, "rev-parse", "main");
  git(d, "commit", "-q", "--allow-empty", "-m", "own");
  const own = git(d, "rev-parse", "HEAD");
  assert.equal(holdsCommit(d, "main", base), true);
  assert.equal(holdsCommit(d, "main", own), false);
  assert.equal(holdsCommit(d, "main", "0".repeat(40)), undefined);
});

test("trackedUnder: the tracked files, absolute; none for a directory not there or in no repository; undefined when git is missing", () => {
  const d = repo("feat/x");
  mkdirSync(join(d, "sub"));
  writeFileSync(join(d, "sub", "a.txt"), "1");
  writeFileSync(join(d, "sub", "loose.txt"), "1");
  git(d, "add", "sub/a.txt");
  assert.deepEqual([...trackedUnder(join(d, "sub"))], [join(d, "sub", "a.txt")]);
  assert.deepEqual(trackedUnder(join(d, "missing")), new Set());
  assert.deepEqual(trackedUnder(tmp()), new Set());
  const saved = process.env.PATH;
  process.env.PATH = tmp();
  try { assert.equal(trackedUnder(d), undefined); } finally { process.env.PATH = saved; }
});

test("unkeptOf: the ignored paths, none when nothing is ignored, every one outside a repository, undefined when git is missing", () => {
  const d = repo("feat/x");
  writeFileSync(join(d, ".gitignore"), "*.log\n");
  assert.deepEqual(unkeptOf(d, ["a.log", "b.txt"]), new Set(["a.log"]));
  assert.deepEqual(unkeptOf(d, ["b.txt"]), new Set(), "git says none is ignored");
  assert.deepEqual(unkeptOf(tmp(), ["a.log", "b.txt"]), new Set(["a.log", "b.txt"]));
  const saved = process.env.PATH;
  process.env.PATH = tmp();
  try { assert.equal(unkeptOf(d, ["a.log"]), undefined); } finally { process.env.PATH = saved; }
});

test("uncommittedBump: no bump for a deleted, a new, a moved or a version-less package.json, nor for the same version; a longer version above is one", () => {
  const d = repo("feat/x");
  mkdirSync(join(d, "a")); mkdirSync(join(d, "b")); mkdirSync(join(d, "c"));
  writeFileSync(join(d, "a", "package.json"), JSON.stringify({ version: "1.2" }));
  writeFileSync(join(d, "b", "package.json"), JSON.stringify({ version: "1.0.0" }));
  writeFileSync(join(d, "c", "package.json"), JSON.stringify({ version: "2.0.0" }));
  git(d, "add", "-A"); git(d, "commit", "-q", "-m", "versions");
  rmSync(join(d, "b", "package.json"));
  writeFileSync(join(d, "c", "package.json"), JSON.stringify({ version: "2.0.0", private: true }));
  mkdirSync(join(d, "n")); writeFileSync(join(d, "n", "package.json"), JSON.stringify({ version: "9.0.0" })); git(d, "add", "n/package.json");
  assert.equal(uncommittedBump(d), undefined, "deleted, new (HEAD has none) and the same version: none is a bump");
  writeFileSync(join(d, "c", "package.json"), "not json");
  assert.equal(uncommittedBump(d), undefined, "not JSON: no version");
  writeFileSync(join(d, "c", "package.json"), JSON.stringify({ name: "c" }));
  assert.equal(uncommittedBump(d), undefined, "no version");
  git(d, "mv", "c/package.json", "c/plugin.json");
  assert.equal(uncommittedBump(d), undefined, "moved: HEAD has nothing at its new path");
  writeFileSync(join(d, "a", "package.json"), JSON.stringify({ version: "1.2.1" }));
  assert.deepEqual(uncommittedBump(d), { path: "a/package.json", version: "1.2.1", was: "1.2" }, "1.2.1 is above 1.2");
  writeFileSync(join(d, "a", "package.json"), JSON.stringify({ version: "1.1.9.9" }));
  assert.equal(uncommittedBump(d), undefined, "1.1.9.9 is below 1.2");
  assert.equal(uncommittedBump(tmp()), undefined, "no repository");
});
