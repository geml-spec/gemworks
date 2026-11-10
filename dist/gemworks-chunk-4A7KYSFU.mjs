// src/host-git.ts
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync as existsSync2, mkdirSync as mkdirSync2, mkdtempSync, readFileSync as readFileSync2, rmSync, statSync as statSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { tmpdir } from "node:os";
import { basename as basename2, dirname as dirname2, isAbsolute, join as join2, relative, resolve as resolve2, sep } from "node:path";

// src/host-fs.ts
import { randomBytes } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

// src/core/layout.ts
var GEML_DIR = ".geml";
var WORKFLOWS_DIR = `${GEML_DIR}/workflows`;
var FLOW_FILE = "flow.geml";
var JOURNALS_DIR = `${GEML_DIR}/journals`;
var CONTEXT_DOC = `${GEML_DIR}/context.geml`;
var BACKLOG_DOC = `${GEML_DIR}/backlog.geml`;
var EXPORTS_DIR = `${GEML_DIR}/exports`;
var PROJECT_DOC = `${GEML_DIR}/project.geml`;
var ARTIFACTS_DOC = `${GEML_DIR}/artifacts.geml`;
var ARTIFACTS_DIR = `${GEML_DIR}/artifacts`;
var TOOLS_DOC = `${GEML_DIR}/tools.geml`;
var DEFAULT_CODEMAP_DIR = `${GEML_DIR}/codemap`;

// src/core/unit.ts
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}
var RESERVED_NAME = /^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$/i;
var FORBIDDEN_CHAR = /[\x00-\x1f\x7f<>:"|?*\\]/;
function isSafeItemId(id) {
  if (id === "" || FORBIDDEN_CHAR.test(id)) return false;
  return id.split("/").every((seg) => seg !== "" && seg !== "." && seg !== ".." && !/[. ]$/.test(seg) && !RESERVED_NAME.test(seg.split(".")[0].trimEnd()));
}
var IGNORED_DIRS = /* @__PURE__ */ new Set([".geml", ".git", "node_modules"]);
function hiddenDir(glob, path) {
  const segs = path.split("/");
  const named = glob.split("/")[0] === GEML_DIR && !`${path}/`.startsWith(`${JOURNALS_DIR}/`);
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (!IGNORED_DIRS.has(seg)) continue;
    if (seg === GEML_DIR && i === 0 && named) continue;
    return seg;
  }
  return void 0;
}
var unsafe = (id) => ({ kind: "inactive", reason: `${JSON.stringify(id)} \xB7 not a safe work item id` });
function resolveItem(unit, f) {
  if (unit.kind === "branch") {
    if (!f.branch) return { kind: "inactive", reason: "not a git repository" };
    if (f.branch === "HEAD") return { kind: "inactive", reason: "detached HEAD \xB7 not tracked" };
    if (f.branch === f.defaultBranch) return { kind: "inactive", reason: `${f.branch} \xB7 not tracked (work items are branches)` };
    return isSafeItemId(f.branch) ? { kind: "item", id: f.branch } : unsafe(f.branch);
  }
  const file = f.lastFile?.replace(/\\/g, "/");
  const hidden = file === void 0 ? void 0 : hiddenDir(unit.glob, file);
  if (file && hidden !== void 0) return { kind: "inactive", reason: `${file} \xB7 under ${hidden}, not a work item` };
  if (file && globToRegExp(unit.glob).test(file)) {
    const id = file.replace(/\.[^./]+$/, "");
    return isSafeItemId(id) ? { kind: "item", id } : unsafe(id);
  }
  return { kind: "inactive", reason: `no work item yet: edit a file matching ${unit.glob}` };
}
function journalPathFor(itemId) {
  if (!isSafeItemId(itemId)) throw new Error(`work item id ${JSON.stringify(itemId)} cannot name a journal`);
  return `${JOURNALS_DIR}/${itemId}.geml`;
}

// src/host-fs.ts
function readText(path) {
  return readFileSync(path, "utf8");
}
function realOf(path) {
  try {
    return realpathSync.native(path);
  } catch {
  }
  try {
    return realpathSync(path);
  } catch {
    return void 0;
  }
}
function realPath(path) {
  const missing = [];
  for (let at = resolve(path); ; ) {
    const real = realOf(at);
    if (real !== void 0) return missing.length === 0 ? real : join(real, ...missing);
    const parent = dirname(at);
    if (parent === at) return resolve(path);
    missing.unshift(basename(at));
    at = parent;
  }
}
function appendOrCreate(path, head, block) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, existsSync(path) ? block : head + block, "utf8");
}
function exists(path) {
  return existsSync(path);
}
var sleepMs = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};
var codeOf = (e) => e?.code;
var isBusy = (e) => process.platform === "win32" && ["EPERM", "EACCES", "EBUSY"].includes(codeOf(e) ?? "");
function whileBusy(op) {
  for (let attempt = 0; ; attempt++) {
    try {
      return op();
    } catch (e) {
      if (!isBusy(e) || attempt >= 10) throw e;
      sleepMs(10 * (attempt + 1));
    }
  }
}
function removeFile(path) {
  try {
    whileBusy(() => unlinkSync(path));
  } catch (e) {
    if (codeOf(e) !== "ENOENT") throw e;
  }
}
function createLock(lock, token) {
  const fd = openSync(lock, "wx");
  try {
    writeSync(fd, token);
  } catch (e) {
    closeSync(fd);
    try {
      removeFile(lock);
    } catch {
    }
    throw e;
  }
  closeSync(fd);
}
function breakStale(lock, judgedAt) {
  try {
    if (statSync(lock).mtimeMs !== judgedAt) return false;
    whileBusy(() => unlinkSync(lock));
    return true;
  } catch (e) {
    return codeOf(e) === "ENOENT";
  }
}
function holderOf(lock) {
  try {
    return /^\d+/.exec(readFileSync(lock, "utf8"))?.[0] ?? "unknown";
  } catch {
    return "unknown";
  }
}
function release(lock, token) {
  try {
    if (readFileSync(lock, "utf8") === token) removeFile(lock);
  } catch {
  }
}
function withLock(path, fn, o = {}) {
  const lock = `${path}.lock`;
  const timeoutMs = o.timeoutMs ?? 5e3, staleMs = o.staleMs ?? 3e4;
  const token = `${process.pid} ${randomBytes(6).toString("hex")}`;
  mkdirSync(dirname(path), { recursive: true });
  const start = Date.now();
  for (; ; ) {
    let busy;
    try {
      createLock(lock, token);
      break;
    } catch (e) {
      if (codeOf(e) !== "EEXIST" && !isBusy(e)) throw e;
      busy = e;
    }
    if (codeOf(busy) === "EEXIST") {
      let mtime;
      try {
        mtime = statSync(lock).mtimeMs;
      } catch (e) {
        if (codeOf(e) === "ENOENT") continue;
        mtime = Date.now();
      }
      if (Date.now() - mtime > staleMs && breakStale(lock, mtime)) continue;
      if (Date.now() - start > timeoutMs) {
        const age = Math.max(0, Math.round((Date.now() - mtime) / 1e3));
        throw new Error(`gemworks: ${lock} is held by another process (pid ${holderOf(lock)}, for ${age}s); gave up after ${timeoutMs} ms. If no gemworks process is running, delete ${lock}.`);
      }
    } else if (Date.now() - start > timeoutMs) {
      throw new Error(`gemworks: cannot take ${lock}: ${busy.message}`, { cause: busy });
    }
    sleepMs(25);
  }
  try {
    return fn();
  } finally {
    release(lock, token);
  }
}
function writeAtomic(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    const fd = openSync(tmp, "w");
    try {
      writeFileSync(fd, text, "utf8");
      try {
        fsyncSync(fd);
      } catch (e) {
        if (!["EINVAL", "ENOTSUP"].includes(codeOf(e) ?? "")) throw e;
      }
    } finally {
      closeSync(fd);
    }
    whileBusy(() => renameSync(tmp, path));
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
    }
    throw e;
  }
}
function globExists(root, glob, limit = 5e4) {
  const re = globToRegExp(glob);
  const dirs = glob.split("/").slice(0, -1);
  const wild = dirs.findIndex((seg) => /[*?]/.test(seg));
  const prefix = wild < 0 ? dirs : dirs.slice(0, wild);
  if (prefix.length > 0 && hiddenDir(glob, prefix.join("/")) !== void 0) return false;
  let start = root;
  for (const seg of prefix) {
    let entries;
    try {
      entries = readdirSync(start, { withFileTypes: true });
    } catch {
      return false;
    }
    if (!entries.some((e) => e.name === seg && e.isDirectory())) return false;
    start = join(start, seg);
  }
  let seen = 0, exhausted = false;
  const walk = (dir, rel) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const ent of entries) {
      if (IGNORED_DIRS.has(ent.name)) continue;
      if (++seen > limit) {
        exhausted = true;
        return false;
      }
      const name = rel === "" ? ent.name : `${rel}/${ent.name}`;
      if (ent.isDirectory()) {
        if (name === JOURNALS_DIR) continue;
        if (walk(join(dir, ent.name), name)) return true;
        if (exhausted) return false;
      } else if (re.test(name)) return true;
    }
    return false;
  };
  return walk(start, prefix.join("/")) ? true : exhausted ? void 0 : false;
}

// src/host-git.ts
var TIMEOUT_MS = 1e4;
function run(cmd, args, cwd, trim = true, timeout = TIMEOUT_MS) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    timeout,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    // Never wait for a person: a prompt would hold the hook until the timeout.
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GH_PROMPT_DISABLED: "1", GH_NO_UPDATE_NOTIFIER: "1" }
  });
  const error = r.error?.code;
  return {
    ok: r.status === 0 && !r.error,
    out: trim ? (r.stdout ?? "").trim() : r.stdout ?? "",
    err: (r.stderr ?? "").trim(),
    // ENOENT is also what a working directory that is not there looks like.
    missing: error === "ENOENT" && existsSync2(cwd),
    status: r.status,
    ...r.error ? { error: error ?? r.error.message } : {}
  };
}
function runIn(cmd, args, cwd, env) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    timeout: TIMEOUT_MS,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...env }
  });
  return { ok: r.status === 0 && !r.error, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim(), missing: false };
}
var MEMO_MS = 5e3;
var memo = /* @__PURE__ */ new Map();
function forgetGitFacts() {
  memo.clear();
  asked.clear();
}
var inRequest = false;
var asked = /* @__PURE__ */ new Map();
function beginGitRequest() {
  asked.clear();
  inRequest = true;
}
function endGitRequest() {
  asked.clear();
  inRequest = false;
}
function once(key, read) {
  if (!inRequest) return read();
  if (asked.has(key)) return asked.get(key);
  const value = read();
  asked.set(key, value);
  return value;
}
function gitDirsOf(root) {
  const dot = join2(root, ".git");
  try {
    if (statSync2(dot).isDirectory()) return { git: dot, common: dot };
    const named = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync2(dot, "utf8"));
    if (named === null) return void 0;
    const git = resolve2(root, named[1]);
    let common = git;
    try {
      common = resolve2(git, readFileSync2(join2(git, "commondir"), "utf8").trim());
    } catch {
    }
    return { git, common };
  } catch {
    return void 0;
  }
}
var GIT_ENV = ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_CEILING_DIRECTORIES", "GIT_DISCOVERY_ACROSS_FILESYSTEM"];
function filesAreAll(common) {
  return !GIT_ENV.some((k) => (process.env[k] ?? "") !== "") && !existsSync2(join2(common, "reftable"));
}
function shaInFiles(common, ref) {
  try {
    const loose = readFileSync2(join2(common, ...ref.split("/")), "utf8").trim();
    return /^[0-9a-f]{40,64}$/.test(loose) ? loose : void 0;
  } catch {
  }
  try {
    for (const line of readFileSync2(join2(common, "packed-refs"), "utf8").split(/\r?\n/)) {
      const m = /^([0-9a-f]{40,64}) (.+)$/.exec(line);
      if (m !== null && m[2] === ref) return m[1];
    }
  } catch {
  }
  return void 0;
}
function refInFiles(common, ref) {
  try {
    if (statSync2(join2(common, ...ref.split("/"))).isFile()) return true;
  } catch {
  }
  try {
    return readFileSync2(join2(common, "packed-refs"), "utf8").split(/\r?\n/).some((l) => l.endsWith(` ${ref}`));
  } catch {
    return false;
  }
}
function headShaInFiles(dirs) {
  let head;
  try {
    head = readFileSync2(join2(dirs.git, "HEAD"), "utf8").trim();
  } catch {
    return void 0;
  }
  const named = /^ref:\s*(refs\/heads\/.+)$/.exec(head);
  if (named !== null) return shaInFiles(dirs.common, named[1]);
  return /^[0-9a-f]{40,64}$/.test(head) ? head : void 0;
}
function topInFiles(dir) {
  if (!existsSync2(dir)) return void 0;
  const from = resolve2(dir);
  for (let d = from; ; d = dirname2(d)) {
    if (existsSync2(join2(d, ".git"))) {
      const dirs = gitDirsOf(d);
      if (dirs === void 0 || !filesAreAll(dirs.common)) return void 0;
      const inGit = relative(dirs.git, from);
      return inGit === "" || !inGit.startsWith("..") && !isAbsolute(inGit) ? void 0 : d;
    }
    if (dirname2(d) === d) return void 0;
  }
}
function headFromFiles(root) {
  const dirs = gitDirsOf(root);
  if (dirs === void 0) return void 0;
  let head;
  try {
    head = readFileSync2(join2(dirs.git, "HEAD"), "utf8").trim();
  } catch {
    return void 0;
  }
  const named = /^ref:\s*refs\/heads\/(.+)$/.exec(head);
  if (named !== null) return refInFiles(dirs.common, `refs/heads/${named[1]}`) ? { branch: named[1] } : void 0;
  return /^[0-9a-f]{40,64}$/.test(head) ? "detached" : void 0;
}
function remembered(key, read) {
  const now = Date.now();
  const hit = memo.get(key);
  if (hit !== void 0 && now - hit.at < MEMO_MS) return hit.value;
  const value = read();
  memo.set(key, { at: now, value });
  return value;
}
function baseRefOf(root) {
  return remembered(`base\0${root}`, () => {
    const name = defaultBranchOf(root);
    return name === void 0 ? void 0 : [`refs/heads/${name}`, `refs/remotes/origin/${name}`].find((ref) => refExists(root, ref));
  });
}
function defaultBranchOf(root) {
  return remembered(`default\0${root}`, () => readDefaultBranch(root));
}
function readDefaultBranch(root) {
  const dirs = gitDirsOf(root);
  if (dirs !== void 0) {
    try {
      const named = /^ref:\s*refs\/remotes\/origin\/(.+)$/.exec(readFileSync2(join2(dirs.common, "refs", "remotes", "origin", "HEAD"), "utf8").trim());
      if (named !== null) return named[1];
    } catch {
    }
  }
  if (dirs === void 0 || !filesAreAll(dirs.common)) {
    const origin = run("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], root);
    if (origin.ok && origin.out !== "") return origin.out.replace(/^origin\//, "");
  }
  for (const name of ["main", "master"]) {
    if (refExists(root, `refs/heads/${name}`)) return name;
  }
  return void 0;
}
function refExists(root, ref) {
  const dirs = gitDirsOf(root);
  if (dirs !== void 0 && refInFiles(dirs.common, ref)) return true;
  if (dirs !== void 0 && filesAreAll(dirs.common)) return false;
  return run("git", ["rev-parse", "--verify", "--quiet", ref], root).ok;
}
function commitsAhead(root, defaultBranch) {
  const dirs = gitDirsOf(root);
  const files = dirs !== void 0 && filesAreAll(dirs.common) ? dirs : void 0;
  const head = files !== void 0 ? headShaInFiles(files) : void 0;
  for (const base of [`refs/heads/${defaultBranch}`, `refs/remotes/origin/${defaultBranch}`]) {
    if (files !== void 0) {
      const at = shaInFiles(files.common, base);
      if (at === void 0 && !refInFiles(files.common, base)) continue;
      if (at !== void 0 && at === head) return 0;
    }
    const r = run("git", ["rev-list", "--count", `${base}..HEAD`], root);
    if (r.ok && /^\d+$/.test(r.out)) return Number(r.out);
  }
  return void 0;
}
function repoFacts(root) {
  return once(`repo\0${root}`, () => readRepoFacts(root));
}
function readRepoFacts(root) {
  const fromFiles = headFromFiles(root);
  let head = fromFiles === void 0 ? run("git", ["rev-parse", "--abbrev-ref", "HEAD"], root) : { ok: true, out: fromFiles === "detached" ? "HEAD" : fromFiles.branch, err: "", missing: false };
  if (!head.ok && head.error === "ETIMEDOUT") head = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], root, true, 3 * TIMEOUT_MS);
  if (!head.ok && head.error === "ETIMEDOUT") return { unanswered: true };
  if (!head.ok || head.out === "") {
    const unborn = run("git", ["symbolic-ref", "--short", "-q", "HEAD"], root);
    return unborn.ok && unborn.out !== "" ? { branch: unborn.out, noCommits: true } : {};
  }
  const facts = { branch: head.out };
  const defaultBranch = defaultBranchOf(root);
  if (defaultBranch === void 0) return facts;
  facts.defaultBranch = defaultBranch;
  if (facts.branch === defaultBranch) facts.committed = false;
  else if (facts.branch !== "HEAD") {
    const ahead = commitsAhead(root, defaultBranch);
    if (ahead !== void 0) facts.committed = ahead > 0;
  }
  return facts;
}
function treeFingerprint(root) {
  const top = remembered(`top\0${root}`, () => {
    const found = topInFiles(root);
    return found !== void 0 ? { ok: true, out: found, err: "", missing: false } : run("git", ["rev-parse", "--show-toplevel"], root);
  });
  if (!top.ok || top.out === "") return void 0;
  const index = remembered(`index\0${top.out}`, () => {
    const dirs = gitDirsOf(top.out);
    return dirs !== void 0 && filesAreAll(dirs.common) ? { ok: true, out: join2(dirs.git, "index"), err: "", missing: false } : run("git", ["rev-parse", "--path-format=absolute", "--git-path", "index"], top.out);
  });
  if (!index.ok || index.out === "") return void 0;
  const dir = mkdtempSync(join2(tmpdir(), "gemworks-tree-"));
  try {
    const copy = join2(dir, "index");
    if (existsSync2(index.out)) copyFileSync(index.out, copy);
    const env = { GIT_INDEX_FILE: copy };
    const exclude = [":(exclude,glob)**/.geml/**", ":(exclude,glob)**/node_modules/**"];
    if (!runIn("git", ["add", "-A", "--", ".", ...exclude], top.out, env).ok) return void 0;
    const tree = runIn("git", ["write-tree"], top.out, env);
    return tree.ok && tree.out !== "" ? `tree:${tree.out}` : void 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
var gitDate = (iso) => {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return void 0;
  const d = new Date(ms).toISOString();
  return `${d.slice(0, 10)} ${d.slice(11, 19)} +0000`;
};
function commitsOf(root, w, limit = 20) {
  const args = ["-c", "core.quotePath=false", "log", `--max-count=${limit}`, "--relative", "--name-only", "--format=%x1e%H%x1f%cI%x1f%s"];
  if (w.ownBranch === true) {
    const base = baseRefOf(root);
    if (base === void 0) return [];
    args.push(`${base}..HEAD`);
  } else {
    const since = w.since !== void 0 ? gitDate(w.since) : void 0;
    const until = w.until !== void 0 ? gitDate(w.until) : void 0;
    if (since !== void 0) args.push(`--since=${since}`);
    if (until !== void 0) args.push(`--until=${until}`);
    args.push("HEAD");
  }
  if (w.paths !== void 0 && w.paths.length > 0) args.push("--full-diff", "--", ...w.paths);
  const r = run("git", args, root, false);
  if (!r.ok) return [];
  const out = [];
  for (const chunk of r.out.split("").slice(1)) {
    const [head = "", ...rest] = chunk.split(/\r?\n/);
    const [sha, at, subject] = head.split("");
    if (sha === void 0 || at === void 0 || subject === void 0) continue;
    out.push({ sha, at, subject, files: rest.filter((line) => line !== "") });
  }
  return out;
}
function isLocalBranch(root, name) {
  return run("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${name}`], root).ok;
}
function checkoutOf(dir) {
  const found = topInFiles(dir);
  const dirs = found !== void 0 ? gitDirsOf(found) : void 0;
  if (found !== void 0 && dirs !== void 0) {
    const top2 = realPath(found);
    const common2 = realPath(dirs.common);
    return basename2(common2) === ".git" ? { top: top2, common: common2, main: dirname2(common2) } : { top: top2, common: common2 };
  }
  const r = run("git", ["-C", dir, "rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir"], dir);
  if (!r.ok) return void 0;
  const lines = r.out.split(/\r?\n/).filter((l) => l !== "");
  const [topLine, commonLine] = lines.slice(-2);
  if (lines.length < 2 || topLine === void 0 || commonLine === void 0) return void 0;
  const top = realPath(resolve2(dir, topLine));
  const common = realPath(resolve2(dir, commonLine));
  return basename2(common) === ".git" ? { top, common, main: dirname2(common) } : { top, common };
}
function journalBaseOf(root) {
  const real = realPath(root);
  for (let d = real; ; ) {
    let gitDir;
    try {
      gitDir = statSync2(join2(d, ".git")).isDirectory();
    } catch {
      gitDir = void 0;
    }
    if (gitDir === true) return root;
    if (gitDir === false) return sharedBase(linkedCheckout(d) ?? checkoutOf(real), real, root);
    const up = dirname2(d);
    if (up === d) return root;
    d = up;
  }
}
function trackedUnder(dir) {
  if (!existsSync2(dir)) return /* @__PURE__ */ new Set();
  const r = run("git", ["-C", dir, "ls-files", "-z"], dir, false);
  if (!r.ok) return /not a git repository/i.test(r.err) ? /* @__PURE__ */ new Set() : void 0;
  return new Set(r.out.split("\0").filter((p) => p !== "").map((p) => resolve2(dir, p)));
}
function unkeptOf(root, paths) {
  const out = /* @__PURE__ */ new Set();
  for (let i = 0; i < paths.length; i += 200) {
    const chunk = paths.slice(i, i + 200);
    const r = run("git", ["-c", "core.quotePath=false", "check-ignore", "--", ...chunk], root, false);
    if (r.status === 1) continue;
    if (r.status !== 0) {
      if (/not a git repository/i.test(r.err)) return new Set(paths);
      return void 0;
    }
    for (const p of r.out.split(/\r?\n/)) if (p !== "") out.add(p.replace(/\\/g, "/"));
  }
  return out;
}
function linkedCheckout(top) {
  try {
    const m = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync2(join2(top, ".git"), "utf8"));
    if (m === null) return void 0;
    const gitDir = resolve2(top, m[1]);
    const commonDir = join2(gitDir, "commondir");
    if (!existsSync2(commonDir)) return void 0;
    const common = realPath(resolve2(gitDir, readFileSync2(commonDir, "utf8").trim()));
    const out = { top: realPath(top), common };
    return basename2(common) === ".git" ? { ...out, main: dirname2(common) } : out;
  } catch {
    return void 0;
  }
}
function sharedBase(c, real, root) {
  if (c?.main === void 0) return root;
  const rel = relative(c.top, real);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return root;
  const base = rel === "" ? c.main : join2(c.main, rel);
  return base === real ? root : base;
}
var unavailable = (reason) => ({ available: false, reason });
function notRun(r) {
  if (r.missing) return "gh is not installed";
  if (r.error === "ETIMEDOUT") return `gh did not answer within ${TIMEOUT_MS / 1e3} s`;
  if (r.error) return `gh could not be run (${r.error})`;
  return void 0;
}
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return void 0;
  }
}
function firstLine(r) {
  const line = (r.err || r.out).split(/\r?\n/, 1)[0].trim();
  return line === "" ? "" : `: ${line.length > 200 ? `${line.slice(0, 200)}...` : line}`;
}
function newestPr(list) {
  if (!Array.isArray(list)) return null;
  let newest;
  for (const pr of list) {
    if (pr === null || typeof pr !== "object" || typeof pr.state !== "string" || typeof pr.number !== "number") return null;
    if (newest === void 0 || pr.number > newest.number) newest = { state: pr.state, number: pr.number };
  }
  return newest;
}
var PASSING = /* @__PURE__ */ new Set(["success", "skipped", "neutral"]);
var FAILING = /* @__PURE__ */ new Set(["failure", "cancelled", "timed_out", "action_required", "startup_failure"]);
function ghFacts(root, branch, o = {}) {
  const gh = (args) => ghRun(root, args, o);
  const pr = gh(["pr", "list", "--head", branch, "--state", "all", "--json", "state,number"]);
  const failed = notRun(pr);
  if (failed) return unavailable(failed);
  if (!pr.ok) return unavailable(`gh could not be queried (not logged in, or no GitHub remote)${firstLine(pr)}`);
  const newest = newestPr(parseJson(pr.out));
  if (newest === null) return unavailable("gh returned output that is not a JSON list of pull requests for `pr list`");
  const facts = { available: true, prOpen: newest?.state === "OPEN", prMerged: newest?.state === "MERGED" };
  const head = run("git", ["rev-parse", "HEAD"], root);
  if (head.ok && head.out !== "") {
    const runs = gh(["run", "list", "--branch", branch, "--limit", "20", "--json", "workflowName,conclusion,headSha,createdAt"]);
    const list = runs.ok ? parseJson(runs.out) : void 0;
    if (Array.isArray(list)) {
      const newestOf = /* @__PURE__ */ new Map();
      for (const r of list) {
        if (r === null || typeof r !== "object" || r.headSha !== head.out) continue;
        const workflow = String(r.workflowName ?? "");
        const at = typeof r.createdAt === "string" ? r.createdAt : "";
        const seen = newestOf.get(workflow);
        if (seen === void 0 || at > seen.at) newestOf.set(workflow, { at, success: PASSING.has(String(r.conclusion)), failed: FAILING.has(String(r.conclusion)) });
      }
      facts.ci = [...newestOf].map(([workflow, v]) => ({ workflow, success: v.success, ...v.failed ? { failed: true } : {} }));
      facts.head = head.out;
    }
  }
  return facts;
}
function branchesAhead(root) {
  const r = run("git", ["for-each-ref", "refs/heads", "--format=%(refname:short)%09%(upstream:track)%09%(committerdate:iso-strict)"], root);
  if (!r.ok) return void 0;
  const out = [];
  for (const line of r.out.split(/\r?\n/)) {
    const [branch, track, at] = line.split("	");
    const m = /ahead (\d+)/.exec(track ?? "");
    if (branch !== void 0 && branch !== "" && m) out.push({ branch, ahead: Number(m[1]), ...at !== void 0 && at !== "" ? { newestAt: at } : {} });
  }
  return out;
}
function versionIn(text) {
  try {
    const v = JSON.parse(text).version;
    return typeof v === "string" && v !== "" ? v : void 0;
  } catch {
    return void 0;
  }
}
function above(a, b) {
  const na = a.split(".").map((x) => Number.parseInt(x, 10));
  const nb = b.split(".").map((x) => Number.parseInt(x, 10));
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const x = na[i] ?? 0;
    const y = nb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}
function uncommittedBump(root) {
  const r = run("git", ["-c", "core.quotePath=false", "status", "--porcelain", "--untracked-files=no"], root, false);
  if (!r.ok) return void 0;
  for (const line of r.out.split(/\r?\n/)) {
    if (line.length < 4) continue;
    const named = line.slice(3);
    const path = named.includes(" -> ") ? named.slice(named.lastIndexOf(" -> ") + 4) : named;
    if (!/(^|\/)(package\.json|plugin\.json)$/.test(path)) continue;
    let now;
    try {
      now = versionIn(readFileSync2(join2(root, path), "utf8"));
    } catch {
      continue;
    }
    const h = run("git", ["show", `HEAD:${path}`], root, false);
    const was = h.ok ? versionIn(h.out) : void 0;
    if (now !== void 0 && was !== void 0 && above(now, was)) return { path, version: now, was };
  }
  return void 0;
}
var ROLLUP_FAILED = /* @__PURE__ */ new Set(["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE", "ERROR"]);
var ROLLUP_PASSED = /* @__PURE__ */ new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
function openPullRequests(root, o = {}) {
  const r = ghRun(root, ["pr", "list", "--state", "open", "--author", "@me", "--limit", "30", "--json", "number,headRefName,statusCheckRollup"], o);
  if (!r.ok) return void 0;
  const list = parseJson(r.out);
  if (!Array.isArray(list)) return void 0;
  const out = [];
  for (const pr of list) {
    if (pr === null || typeof pr !== "object" || typeof pr.number !== "number" || typeof pr.headRefName !== "string") continue;
    const checks = Array.isArray(pr.statusCheckRollup) ? pr.statusCheckRollup : [];
    const read = checks.filter((c) => c !== null && typeof c === "object").map((c) => {
      const conclusion = String(c["conclusion"] ?? c["state"] ?? "").toUpperCase();
      const done = c["status"] === void 0 || String(c["status"]).toUpperCase() === "COMPLETED";
      return { name: String(c["name"] ?? c["context"] ?? "check"), passed: done && ROLLUP_PASSED.has(conclusion), failed: done && ROLLUP_FAILED.has(conclusion) };
    });
    out.push({ number: pr.number, branch: pr.headRefName, green: read.length > 0 && read.every((c) => c.passed), failing: [...new Set(read.filter((c) => c.failed).map((c) => c.name))] });
  }
  return out;
}
function branchesFacts(root) {
  const branches = /* @__PURE__ */ new Map();
  const base = baseRefOf(root);
  let refs = base === void 0 ? void 0 : run("git", ["for-each-ref", "refs/heads", `--format=%(refname:short)%09%(objectname)%09%(ahead-behind:${base})`], root);
  const counted = refs?.ok === true;
  if (!counted) refs = run("git", ["for-each-ref", "refs/heads", "--format=%(refname:short)%09%(objectname)"], root);
  if (refs === void 0 || !refs.ok) return { ok: false, branches };
  const merged = counted ? void 0 : new Set(base === void 0 ? [] : run("git", ["branch", "--merged", base, "--format=%(refname:short)"], root).out.split(/\r?\n/).filter((b) => b !== ""));
  for (const line of refs.out.split(/\r?\n/)) {
    const [branch, tip, aheadBehind] = line.split("	");
    if (branch === void 0 || branch === "" || tip === void 0) continue;
    let ahead = counted ? Number((aheadBehind ?? "").split(" ")[0]) : void 0;
    if (!counted && base !== void 0) {
      const c = run("git", ["rev-list", "--count", `${base}..refs/heads/${branch}`], root);
      ahead = c.ok ? Number(c.out) : void 0;
    }
    const known = ahead !== void 0 && Number.isFinite(ahead);
    branches.set(branch, { tip, ...known ? { ahead } : {}, inDefault: merged !== void 0 ? merged.has(branch) : known && ahead === 0 });
  }
  const wt = run("git", ["worktree", "list", "--porcelain"], root);
  let at;
  let seen = 0;
  for (const line of wt.ok ? wt.out.split(/\r?\n/) : []) {
    if (line.startsWith("worktree ")) at = seen++ === 0 ? void 0 : line.slice("worktree ".length);
    const m = /^branch refs\/heads\/(.+)$/.exec(line);
    const b = m === null ? void 0 : branches.get(m[1]);
    if (b !== void 0 && at !== void 0) b.worktree = at;
  }
  return { ok: true, ...base !== void 0 ? { base } : {}, branches };
}
function worktreesOf(root) {
  const wt = run("git", ["worktree", "list", "--porcelain"], root);
  if (!wt.ok) return [];
  return wt.out.split(/\r?\n/).filter((l) => l.startsWith("worktree ")).map((l) => l.slice("worktree ".length));
}
function holdsCommit(root, base, sha) {
  const r = run("git", ["merge-base", "--is-ancestor", sha, base], root);
  if (r.ok) return true;
  return r.error === void 0 && r.err === "" ? false : void 0;
}
function pullRequestsByBranch(root, o = {}) {
  const r = ghRun(root, ["pr", "list", "--state", "all", "--limit", "100", "--json", "number,state,headRefName"], o);
  const out = /* @__PURE__ */ new Map();
  const list = r.ok ? parseJson(r.out) : void 0;
  if (!Array.isArray(list)) return out;
  for (const pr of list) {
    if (pr === null || typeof pr !== "object" || typeof pr.number !== "number" || typeof pr.headRefName !== "string") continue;
    const state = String(pr.state ?? "").toLowerCase();
    if (state !== "open" && state !== "merged" && state !== "closed") continue;
    const had = out.get(pr.headRefName);
    if (had === void 0 || had.number < pr.number) out.set(pr.headRefName, { number: pr.number, state });
  }
  return out;
}
var GH_KEEP_MS = 6e4;
function ghRun(root, args, o = {}) {
  const named = o.gh || process.env["GEMWORKS_GH"];
  const bin = named || "gh";
  const ask = () => /\.[cm]?js$/i.test(bin) ? run(process.execPath, [bin, ...args], root) : run(bin, args, root);
  if (named) return ask();
  const key = `${root}\0${args.join("\0")}`;
  const path = join2(tmpdir(), "gemworks", "gh-answers.json");
  let kept = {};
  try {
    kept = JSON.parse(readFileSync2(path, "utf8"));
  } catch {
    kept = {};
  }
  const now = Date.now();
  const hit = kept[key];
  if (o.fresh !== true && hit !== void 0 && now - hit.at < GH_KEEP_MS && typeof hit.out === "string") return { ok: true, out: hit.out, err: "", missing: false, status: 0 };
  const r = ask();
  if (r.ok) {
    for (const [k, v] of Object.entries(kept)) if (now - v.at >= GH_KEEP_MS) delete kept[k];
    kept[key] = { at: now, out: r.out };
    try {
      mkdirSync2(dirname2(path), { recursive: true });
      writeFileSync2(path, JSON.stringify(kept));
    } catch {
    }
  }
  return r;
}
function ghOncePerBranch(o = {}) {
  const asked2 = /* @__PURE__ */ new Map();
  return (root, branch) => {
    const hit = asked2.get(branch);
    if (hit) return hit;
    const facts = ghFacts(root, branch, o.fresh === true ? { fresh: true } : {});
    asked2.set(branch, facts);
    return facts;
  };
}

export {
  GEML_DIR,
  WORKFLOWS_DIR,
  FLOW_FILE,
  JOURNALS_DIR,
  CONTEXT_DOC,
  BACKLOG_DOC,
  EXPORTS_DIR,
  PROJECT_DOC,
  ARTIFACTS_DOC,
  TOOLS_DOC,
  globToRegExp,
  isSafeItemId,
  hiddenDir,
  resolveItem,
  journalPathFor,
  readText,
  realPath,
  appendOrCreate,
  exists,
  withLock,
  writeAtomic,
  globExists,
  forgetGitFacts,
  beginGitRequest,
  endGitRequest,
  repoFacts,
  treeFingerprint,
  commitsOf,
  isLocalBranch,
  checkoutOf,
  journalBaseOf,
  trackedUnder,
  unkeptOf,
  ghFacts,
  branchesAhead,
  uncommittedBump,
  openPullRequests,
  branchesFacts,
  worktreesOf,
  holdsCommit,
  pullRequestsByBranch,
  ghOncePerBranch
};
