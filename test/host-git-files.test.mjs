// What host-git.ts reads from .git's files, and where it hands the question to git instead: a .git file that names
// nothing, a git directory kept elsewhere, a worktree whose administrative directory is gone, a directory inside .git, a
// variable that redirects git, a subdirectory, a default branch that is an alias or only the remote's; and what is not
// established when git is missing or does not answer.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkoutOf, commitsOf, forgetGitFacts, journalBaseOf, repoFacts, treeFingerprint } from "../dist/host-git.js";
import { gitRepo } from "./helpers/repo.mjs";

const made = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "gemworks-hgf-")); made.push(d); return d; };
const repo = (branch) => { const d = gitRepo(branch); made.push(d); return d; };
after(() => { for (const d of made) try { rmSync(d, { recursive: true, force: true, maxRetries: 3 }); } catch { /* a scratch directory left behind is harmless */ } });

const git = (d, ...a) => {
  const r = spawnSync("git", ["-C", d, ...a], { encoding: "utf8" });
  assert.equal(r.status, 0, `git ${a.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
const identity = (d) => { git(d, "config", "user.email", "t@t"); git(d, "config", "user.name", "t"); git(d, "config", "commit.gpgsign", "false"); };

/** Set environment variables for `fn` and put them back after, whatever happens; forget what git said before and after. */
function withEnv(vars, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  forgetGitFacts();
  try { return fn(); } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    forgetGitFacts();
  }
}

test("a .git file that names no git directory is no checkout: nothing is said of the branch, the content or the checkout, and the journals stay the project's own", () => {
  const d = tmp();
  writeFileSync(join(d, ".git"), "this is not a gitdir line\n");
  assert.deepEqual(repoFacts(d), {}, "git, asked, says it is no repository either");
  assert.equal(checkoutOf(d), undefined);
  assert.equal(treeFingerprint(d), undefined);
  assert.equal(journalBaseOf(d), d);
});

test("a checkout whose git directory is kept elsewhere (git init --separate-git-dir) is read from its files, and has no main working tree to share its journals with", () => {
  const outer = tmp();
  const work = join(outer, "work");
  const store = join(outer, "store.git");
  assert.equal(spawnSync("git", ["init", "-q", "-b", "main", "--separate-git-dir", store, work], { encoding: "utf8" }).status, 0);
  identity(work);
  git(work, "commit", "-q", "--allow-empty", "-m", "init");
  assert.deepEqual(checkoutOf(work), { top: realpathSync.native(work), common: realpathSync.native(store) }, "the common directory is no .git inside a working tree: no main");
  assert.equal(journalBaseOf(work), work, "nothing to share: the project's own");
  forgetGitFacts();
  assert.deepEqual(repoFacts(work), { branch: "main", defaultBranch: "main", committed: false });
});

test("a worktree whose administrative directory is gone (pruned) says nothing of its branch or its content", () => {
  const d = repo("feat/x");
  const wt = join(tmp(), "wt");
  git(d, "worktree", "add", "-q", "-b", "w", wt);
  rmSync(join(d, ".git", "worktrees"), { recursive: true, force: true });
  forgetGitFacts();
  assert.deepEqual(repoFacts(wt), {}, "its HEAD cannot be read, and git says it is no repository: not established");
  assert.equal(treeFingerprint(wt), undefined);
});

test("a directory inside .git, below its top, is in no working tree", () => {
  const d = repo("feat/x");
  assert.equal(checkoutOf(join(d, ".git", "refs")), undefined);
  assert.equal(checkoutOf(join(d, ".git", "refs", "heads")), undefined);
});

test("a variable that redirects git sends the checkout and the content fingerprint to git, which says what the files say", () => {
  const d = repo("feat/x");
  const wt = join(tmp(), "wt");
  git(d, "worktree", "add", "-q", "-b", "w", wt);
  writeFileSync(join(d, "f.txt"), "1");
  const bare = join(tmp(), "b.git");
  assert.equal(spawnSync("git", ["clone", "-q", "--bare", d, bare], { encoding: "utf8" }).status, 0);
  const other = join(tmp(), "wt2");
  git(bare, "worktree", "add", "-q", other, "main");
  forgetGitFacts();
  const fromFiles = { main: checkoutOf(d), wt: checkoutOf(wt), other: checkoutOf(other), tree: treeFingerprint(d) };
  assert.match(fromFiles.tree, /^tree:[0-9a-f]{40,64}$/);
  withEnv({ GIT_DISCOVERY_ACROSS_FILESYSTEM: "1" }, () => {
    const real = realpathSync.native(d);
    assert.deepEqual(checkoutOf(d), { top: real, common: join(real, ".git"), main: real });
    assert.deepEqual(checkoutOf(d), fromFiles.main);
    assert.deepEqual(checkoutOf(wt), fromFiles.wt, "a worktree: git names the same main working tree");
    assert.deepEqual(checkoutOf(other), { top: realpathSync.native(other), common: realpathSync.native(bare) }, "a bare repository's worktree: no main, as the files say");
    assert.deepEqual(checkoutOf(other), fromFiles.other);
    assert.equal(treeFingerprint(d), fromFiles.tree, "the same content, the same fingerprint, from git's own index path");
  });
});

test("from a subdirectory of a clone, the default branch is the remote's HEAD as git names it, and git counts the branch's own commits", () => {
  const origin = repo("main");
  git(origin, "checkout", "-q", "-b", "trunk");
  const clone = join(tmp(), "clone");
  assert.equal(spawnSync("git", ["clone", "-q", origin, clone], { encoding: "utf8" }).status, 0);
  identity(clone);
  mkdirSync(join(clone, "app"));
  forgetGitFacts();
  assert.deepEqual(repoFacts(join(clone, "app")), { branch: "trunk", defaultBranch: "trunk", committed: false });
  git(clone, "checkout", "-q", "-b", "feat/y");
  git(clone, "commit", "-q", "--allow-empty", "-m", "two");
  forgetGitFacts();
  assert.deepEqual(repoFacts(join(clone, "app")), { branch: "feat/y", defaultBranch: "trunk", committed: true });
});

test("a default branch that is an alias of another (a symbolic ref) is measured by git, not read from its file", () => {
  const d = repo("main");
  git(d, "branch", "-m", "main", "trunk");
  git(d, "symbolic-ref", "refs/heads/main", "refs/heads/trunk");
  git(d, "checkout", "-q", "-b", "feat/z");
  forgetGitFacts();
  assert.deepEqual(repoFacts(d), { branch: "feat/z", defaultBranch: "main", committed: false }, "its file names trunk, not a commit: git says the branch has nothing of its own");
  git(d, "commit", "-q", "--allow-empty", "-m", "z");
  forgetGitFacts();
  assert.deepEqual(repoFacts(d), { branch: "feat/z", defaultBranch: "main", committed: true });
});

test("a default branch that only the remote has: the branch is measured against the remote's, and a branch at its commit has nothing of its own", () => {
  const origin = repo("main");
  git(origin, "checkout", "-q", "-b", "trunk");
  const d = tmp();
  git(d, "init", "-q", "-b", "scratch");
  identity(d);
  git(d, "remote", "add", "origin", origin);
  git(d, "fetch", "-q", "origin");
  git(d, "remote", "set-head", "origin", "trunk");
  git(d, "switch", "-q", "-c", "feat/r", "origin/trunk");
  forgetGitFacts();
  assert.deepEqual(repoFacts(d), { branch: "feat/r", defaultBranch: "trunk", committed: false }, "no local trunk: origin's is the base");
  git(d, "commit", "-q", "--allow-empty", "-m", "r");
  forgetGitFacts();
  assert.deepEqual(repoFacts(d), { branch: "feat/r", defaultBranch: "trunk", committed: true });
});

test("commitsOf with no window lists every commit on HEAD, newest first; a directory that is not there has none", () => {
  const d = repo("feat/x");
  writeFileSync(join(d, "a.txt"), "1");
  git(d, "add", "a.txt");
  git(d, "commit", "-q", "-m", "two");
  assert.deepEqual(commitsOf(d, {}).map((c) => [c.subject, c.files]), [["two", ["a.txt"]], ["init", []]]);
  assert.deepEqual(commitsOf(join(d, "no-such-directory"), {}), []);
});

test("with git missing, the content fingerprint and the commits are not established, though .git's files name the top and the index", () => {
  const d = repo("feat/x");
  writeFileSync(join(d, "f.txt"), "1");
  withEnv({ PATH: tmp() }, () => {
    assert.equal(treeFingerprint(d), undefined);
    assert.deepEqual(commitsOf(d, { since: "2026-01-01T00:00:00Z" }), []);
  });
  assert.match(treeFingerprint(d), /^tree:/, "git back: it says");
});

// A git that never answers: a stand-in that sleeps, the only `git` on PATH, under a deadline of 300 ms. POSIX only:
// Windows starts no script without a shell, and a stand-in there would have to be an .exe.
test("a git that does not answer, asked once more and longer, leaves the branch unsaid: unanswered, never 'no commits'", { skip: process.platform === "win32" }, () => {
  const d = repo("feat/x");
  mkdirSync(join(d, "sub"));
  const bin = tmp();
  writeFileSync(join(bin, "git"), "#!/bin/sh\nexec /bin/sleep 30\n");
  chmodSync(join(bin, "git"), 0o755);
  const hostGit = new URL("../dist/host-git.js", import.meta.url).href;
  const script = `import { repoFacts } from ${JSON.stringify(hostGit)}; process.stdout.write(JSON.stringify(repoFacts(${JSON.stringify(join(d, "sub"))})));`;
  const began = Date.now();
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8", timeout: 60_000, env: { ...process.env, PATH: bin, GEMWORKS_GIT_TIMEOUT_MS: "300" },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { unanswered: true });
  assert.ok(Date.now() - began >= 1200, "asked twice: 300 ms, then three times as long");
});
