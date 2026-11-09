import {
  TOOLS_FILE,
  blockText,
  canonical,
  dependsOf,
  dictionaryPathOf,
  ensureGitignore,
  fileUnitOf,
  guardHolds,
  homeOf,
  installedWorkflows,
  isPaused,
  itemProgress,
  itemState,
  loadStatechart,
  loadWorkspace,
  mergeTools,
  mergedWorkflow,
  migrateLayout,
  openWorkspace,
  outgoing,
  projectDocOf,
  readContextDoc,
  readIn,
  readJournal,
  recordedPath,
  renderDictionary,
  renderJournalMarkdown,
  resolveWorkflow,
  sideFlows,
  sourceLabel,
  varsBySource,
  withItemState,
  workflowAt,
  workflowNameOf,
  writeWorkflow
} from "./gemworks-chunk-LNMCAWME.mjs";
import {
  changesDirectory,
  commandDirs,
  commandOf,
  isDirectoryChange,
  pathWords,
  personOnlyRefusal,
  signalHeads,
  simpleCommands
} from "./gemworks-chunk-UEVNGPQ5.mjs";
import {
  ARTIFACTS_DOC,
  BACKLOG_DOC,
  CONTEXT_DOC,
  EXPORTS_DIR,
  FLOW_FILE,
  GEML_DIR,
  PROJECT_DOC,
  WORKFLOWS_DIR,
  beginGitRequest,
  branchesAhead,
  branchesFacts,
  checkoutOf,
  commitsOf,
  endGitRequest,
  exists,
  ghOncePerBranch,
  globToRegExp,
  holdsCommit,
  journalBaseOf,
  openPullRequests,
  pullRequestsByBranch,
  readText,
  realPath,
  repoFacts,
  uncommittedBump,
  unkeptOf,
  withLock,
  worktreesOf,
  writeAtomic
} from "./gemworks-chunk-SXXU2DVO.mjs";

// src/bridge.ts
import { createHash as createHash2 } from "node:crypto";
import { cpSync, mkdirSync as mkdirSync5, readdirSync as readdirSync4 } from "node:fs";
import { homedir as homedir3, hostname, userInfo } from "node:os";
import { basename as basename6, dirname as dirname5, extname, isAbsolute as isAbsolute3, join as join9, relative as relative4, resolve as resolve4, sep as sep4 } from "node:path";

// src/attribution.ts
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

// src/hosts/claude-code/readers.ts
var PATH_FIELD = { Edit: "file_path", Write: "file_path", NotebookEdit: "notebook_path" };
function writtenPath(tool, input) {
  const field = PATH_FIELD[tool];
  const raw = field === void 0 ? void 0 : input[field];
  return typeof raw === "string" && raw !== "" ? raw : void 0;
}
function normalised(path) {
  const slashed3 = path.split("\\").join("/").replace(/^([a-z]):/, (_, d) => `${d.toUpperCase()}:`);
  const lead = slashed3.match(/^(?:[A-Z]:)?\/*/)?.[0] ?? "";
  const out = [];
  for (const part of slashed3.slice(lead.length).split("/")) {
    if (part === "" || part === ".") continue;
    if (part !== "..") out.push(part);
    else if (out.pop() === void 0) return void 0;
  }
  return `${lead}${out.join("/")}`;
}
var hasId = (attrs, id) => new RegExp(`(?:^|\\s)#${id}(?:\\s|$)`).test(attrs);
function contextOf(doc) {
  const lines = doc.replace(/\r\n?/g, "\n").split("\n");
  let text;
  let stage;
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(/^(={3,})[ \t]*(text|data)[ \t]*\{(.*)\}[ \t]*$/);
    if (!open) continue;
    const fence = open[1];
    let end = i + 1;
    while (end < lines.length && lines[end] !== fence) end++;
    if (end >= lines.length) return void 0;
    const body = lines.slice(i + 1, end).join("\n");
    if (open[2] === "text" && hasId(open[3], "current")) text = body;
    else if (open[2] === "data" && hasId(open[3], "stage")) {
      try {
        const v = JSON.parse(body);
        if (typeof v !== "object" || v === null || Array.isArray(v)) return void 0;
        stage = v;
      } catch {
        return void 0;
      }
    }
    i = end;
  }
  if (text === void 0 || stage === void 0) return void 0;
  const rev = stage["rev"];
  if (typeof rev !== "number" || !Number.isInteger(rev)) return void 0;
  const item = typeof stage["item"] === "string" ? stage["item"] : "";
  const state = typeof stage["state"] === "string" ? stage["state"] : "";
  return { key: `${item}@${rev}`, item, state, rev, text };
}

// src/attribution.ts
var SESSION = { kind: "session" };
var ELSEWHERE = { kind: "elsewhere" };
var UNKNOWN = { kind: "unknown" };
var samePlace = (a, b) => a.kind === b.kind && (a.kind !== "other" || b.kind === "other" && a.root === b.root);
function inside(root, path) {
  const rel = relative(root, path);
  return rel === "" || rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
function nestedCheckout(realRoot, real) {
  for (let d = real; d !== realRoot; d = dirname(d)) {
    if (exists(join(d, ".git"))) return true;
    if (dirname(d) === d) return false;
  }
  return false;
}
function nearestExisting(real) {
  let d = real;
  while (!exists(d) && dirname(d) !== d) d = dirname(d);
  return d;
}
var Places = class {
  constructor(root, find = checkoutOf) {
    this.root = root;
    this.find = find;
    this.realRoot = realPath(root);
  }
  root;
  find;
  realRoot;
  /** The session's own checkout: undefined until asked, null when the root is in none. */
  sessionCheckout;
  seen = /* @__PURE__ */ new Map();
  of(dir) {
    if (dir === void 0) return UNKNOWN;
    const real = realPath(resolve(this.root, dir));
    let place = this.seen.get(real);
    if (place === void 0) {
      place = this.locate(real);
      this.seen.set(real, place);
    }
    return place;
  }
  locate(real) {
    const under = inside(this.realRoot, real);
    if (under && !nestedCheckout(this.realRoot, real)) return SESSION;
    const c = this.find(nearestExisting(real));
    if (c === void 0) return under ? SESSION : ELSEWHERE;
    const s = this.sessionCheckout ??= this.find(this.realRoot) ?? null;
    if (s !== null && c.top === s.top) return SESSION;
    const root = s !== null && c.common === s.common ? join(c.top, relative(s.top, this.realRoot)) : c.top;
    if (root === this.realRoot) return SESSION;
    return exists(root) && !("error" in resolveWorkflow(root)) ? { kind: "other", root } : ELSEWHERE;
  }
};
function callPlace(tool, input, start, places) {
  const written = writtenPath(tool, input);
  if (written !== void 0) return places.of(dirname(resolve(start, written)));
  const command = commandOf(input);
  if (command === void 0) return places.of(start);
  const dirs = commandDirs(command, start);
  if (dirs === null) return changesDirectory(command) ? UNKNOWN : places.of(start);
  const commands = simpleCommands(command) ?? [];
  const ran = dirs.filter((_, i) => !isDirectoryChange(commands[i] ?? ""));
  if (ran.length === 0) return places.of(start);
  const [first, ...rest] = ran.map((d) => places.of(d));
  return first !== void 0 && rest.every((p) => samePlace(p, first)) ? first : UNKNOWN;
}
function joined(a, b) {
  const context = b.context ?? a.context;
  return { entered: [...a.entered, ...b.entered], ...context !== void 0 ? { context } : {} };
}
var Attribution = class {
  constructor(session, open, tools, find) {
    this.session = session;
    this.open = open;
    this.tools = tools;
    this.places = new Places(session.root, find);
  }
  session;
  open;
  tools;
  places;
  opened = /* @__PURE__ */ new Map();
  /** Where the call as a whole acts (callPlace). */
  placeOf(tool, input, start) {
    return callPlace(tool, input, start, this.places);
  }
  /**
   * `before` for a call. In the session's checkout, or where the line does not
   * say, the session's work item judges it as it always has, and `view` is the
   * session's after it, from the same read. In another checkout that
   * checkout's work item judges it and records it there; anywhere else only
   * the person-only refusal holds, recorded nowhere. A work item elsewhere
   * that cannot judge (its journal will not resume) lets the call through.
   */
  before(tool, callId, input, start, waived) {
    const place = this.placeOf(tool, input, start);
    if (place.kind === "session" || place.kind === "unknown") {
      const { refusal: refusal2, recorded, ...view } = this.session.beforeView(tool, callId, input, waived);
      return { ...refusal2 !== void 0 ? { refusal: refusal2 } : {}, recorded, view };
    }
    if (place.kind === "other") {
      const ws = this.current(place, this.written(tool, input, start));
      if (ws === void 0) return { recorded: false };
      try {
        const r = ws.beforeView(tool, callId, input, waived);
        return { ...r.refusal !== void 0 ? { refusal: r.refusal } : {}, recorded: r.recorded };
      } catch {
        return { recorded: false };
      }
    }
    const command = commandOf(input);
    const refusal = command === void 0 ? void 0 : personOnlyRefusal(command);
    return { ...refusal !== void 0 ? { refusal } : {}, recorded: false };
  }
  /**
   * A person's answer about a call (spec §5.3 step 6) goes into the dictionary
   * of the work item that judges the call: the session's, or another
   * checkout's. False when no work item takes it (the call acts elsewhere).
   */
  learn(lessons, tool, input, start) {
    const place = this.placeOf(tool, input, start);
    const ws = place.kind === "session" || place.kind === "unknown" ? this.session : this.current(place, this.written(tool, input, start));
    if (ws === void 0) return false;
    ws.learn(lessons);
    return true;
  }
  /**
   * `after` on every work item the call was attributed to. The work item where
   * the call as a whole acted takes its outcome as evidence, the file
   * variables and the git it ran; each simple command's evidence goes to the
   * work item of the directory it ran in (under a `file:` unit, the file it
   * names). A work item reached elsewhere that fails never fails the
   * session's answer.
   */
  after(call, start) {
    const targets = [];
    const target = (ws) => {
      let t = targets.find((x) => x.ws === ws);
      if (t === void 0) {
        t = { ws, whole: false, commands: [] };
        targets.push(t);
      }
      return t;
    };
    const written = this.written(call.tool, call.input, start);
    const whole = this.current(this.placeOf(call.tool, call.input, start), written);
    if (whole !== void 0) target(whole).whole = true;
    const command = commandOf(call.input);
    if (this.tools.run.includes(call.tool) && command !== void 0 && typeof call.exitCode === "number") {
      const heads = signalHeads(command) ?? [];
      const commands = simpleCommands(command) ?? [];
      (commandDirs(command, start) ?? []).forEach((dir, i) => {
        const head = heads[i];
        const current = dir === void 0 ? void 0 : this.current(this.places.of(dir));
        if (current === void 0 || dir === void 0 || head === void 0 || !current.commandSpeaks(head)) return;
        const ws = this.itemFor(current, commands[i] ?? "", dir);
        if (ws !== void 0) target(ws).commands.push(i);
      });
    }
    let own = { entered: [] };
    let routed;
    for (const t of targets) {
      const wrote = t.ws === this.session ? call.wrotePath : written;
      let change;
      try {
        change = t.ws.after({
          tool: call.tool,
          callId: call.callId,
          isError: call.isError,
          input: call.input,
          ...call.exitCode !== void 0 ? { exitCode: call.exitCode } : {},
          ...t.whole && wrote !== void 0 ? { wrotePath: wrote } : {},
          commands: t.commands,
          commandsOnly: !t.whole
        });
        if (t.whole && call.gitOperation) change = joined(change, t.ws.refresh());
      } catch (e) {
        if (t.ws === this.session) throw e;
        continue;
      }
      if (t.ws === this.session) own = joined(own, change);
      else if (routed === void 0 && change.context !== void 0 && t.ws.item.kind === "item") routed = { item: t.ws.item.id, context: change.context };
    }
    return { ...own, ...routed !== void 0 ? { routed } : {} };
  }
  /** The file a file-writing tool names, absolute. */
  written(tool, input, start) {
    const path = writtenPath(tool, input);
    return path === void 0 ? void 0 : resolve(start, path);
  }
  /**
   * The current work item's workspace of a place a call reached: the
   * session's own, or another checkout's — opened for `lastFile`, a written
   * file, which under a `file:` unit is the work item.
   */
  current(place, lastFile) {
    if (place.kind === "session") return this.session;
    if (place.kind !== "other") return void 0;
    return this.cached(`${place.root}
${lastFile ?? ""}`, () => this.open({ root: place.root, journalBase: journalBaseOf(place.root), ...lastFile !== void 0 ? { lastFile } : {} }));
  }
  /**
   * The work item one simple command's evidence goes to: under a `file:` unit
   * the file it names, relative to the directory it runs in — none when it
   * names more than one, or a glob that may match several — and the current
   * work item when it names none; under a branch unit, the current work item.
   */
  itemFor(current, command, dir) {
    if (current.sc.unit.kind !== "file") return current;
    const files = /* @__PURE__ */ new Set();
    for (const w of pathWords(command)) {
      const file2 = current.itemFileOf(isAbsolute(w.text) ? w.text : join(dir, w.text));
      if (file2 === void 0) continue;
      if (w.glob) return void 0;
      files.add(file2);
    }
    const [file, ...more] = files;
    if (file === void 0) return current;
    if (more.length > 0) return void 0;
    if (current.item.kind === "item" && current.item.id === file.replace(/\.[^./]+$/, "")) return current;
    return this.cached(`${current.root}
${file}
named`, () => this.open({ root: current.root, journalBase: current.journalBase, lastFile: file, writesContext: false }));
  }
  cached(key, make) {
    if (!this.opened.has(key)) {
      let ws;
      try {
        ws = make();
      } catch {
        ws = void 0;
      }
      this.opened.set(key, ws);
    }
    return this.opened.get(key);
  }
};

// src/core/backlog.ts
import { parse, splitLines, unitSpans } from "./vendor/geml/geml.js";
import { escapeCellPipes } from "./vendor/geml/table.js";
function load(source) {
  const tb = parse(source).children.find((b) => b.kind === "block" && b.type === "table" && b.id === "backlog");
  if (!tb?.table) return void 0;
  const cols = tb.table.columns.map((c) => c.trim().toLowerCase());
  const key = cols.includes("file") ? "file" : "branch";
  const at = (name) => cols.indexOf(name);
  const cell = (row, name) => {
    const c = at(name) >= 0 ? row[at(name)] : void 0;
    if (!c) return "";
    const only = c.inlines.length === 1 ? c.inlines[0] : void 0;
    return (only?.type === "code" && only.value !== void 0 ? only.value : c.text).trim();
  };
  const items = tb.table.rows.map((row) => ({ id: cell(row, "id"), title: cell(row, "title"), target: cell(row, key) }));
  const diagnostics = at("id") < 0 || at("title") < 0 ? ["#backlog needs id and title columns"] : [];
  const seen = /* @__PURE__ */ new Set(), repeated = /* @__PURE__ */ new Set();
  for (const { id } of items) if (id !== "") (seen.has(id) ? repeated : seen).add(id);
  for (const id of repeated) diagnostics.push(`#backlog repeats id ${JSON.stringify(id)}`);
  if (at("id") >= 0) items.forEach((item, i) => {
    if (item.id === "") diagnostics.push(`#backlog row ${i + 1} has no id`);
  });
  return { tb, cols, key, items, diagnostics };
}
function readBacklog(source) {
  const l = load(source);
  return l ? { key: l.key, items: l.items, diagnostics: l.diagnostics } : { key: "branch", items: [], diagnostics: ["no table block #backlog"] };
}
var esc = (s) => escapeCellPipes(s.replace(/\r\n|[\r\n]/g, " "));
function bindItem(items, id, target) {
  if (id === "") return { ok: false, reason: "an empty id names no backlog item" };
  if (target === "") return { ok: false, reason: "a work item to bind is needed" };
  const matches = items.filter((i) => i.id === id);
  const found = matches[0];
  if (!found) return { ok: false, reason: `no backlog item ${id}` };
  if (matches.length > 1) return { ok: false, reason: `backlog id ${id} is not unique` };
  if (found.target && found.target !== target) return { ok: false, reason: `${id} is already bound to ${found.target}` };
  return { ok: true, items: items.map((i) => i.id === id ? { ...i, target } : i) };
}
var BLANK = new RegExp("^\\p{White_Space}$", "u");
function withCell(line, ci, value) {
  let a = 0, b = line.length;
  while (a < b && BLANK.test(line[a])) a++;
  while (b > a && BLANK.test(line[b - 1])) b--;
  if (line[a] === "|") a++;
  const end = b > a && line[b - 1] === "|" && line[b - 2] !== "\\" ? b - 1 : b;
  const starts = [a], ends = [];
  for (let i = a; i < end; i++) {
    if (line[i] === "\\" && line[i + 1] === "|") i++;
    else if (line[i] === "|") {
      ends.push(i);
      starts.push(i + 1);
    }
  }
  ends.push(end);
  if (ci >= starts.length) {
    const head = line.slice(0, end);
    return head + (BLANK.test(head.slice(-1)) ? "" : " ") + "| ".repeat(ci - starts.length) + "| " + value + " " + line.slice(end);
  }
  const s = starts[ci], e = ends[ci];
  let ts = s, te = e;
  while (ts < te && BLANK.test(line[ts])) ts++;
  while (te > ts && BLANK.test(line[te - 1])) te--;
  if (te > ts) return line.slice(0, ts) + value + line.slice(te);
  return line.slice(0, s) + (e - s >= 1 ? line[s] : " ") + value + (e - s >= 2 ? line.slice(s + 1, e) : " ") + line.slice(e);
}
function bindInDocument(source, id, target) {
  const before = load(source);
  if (!before) return { ok: false, reason: "no table block #backlog" };
  const bound = bindItem(before.items, id, target);
  if (!bound.ok) return bound;
  const row = before.items.findIndex((i) => i.id === id);
  if (before.items[row].target === target) return { ok: true, text: source };
  const { tb, key } = before;
  const col = before.cols.indexOf(key);
  const unwritable = (why) => ({ ok: false, reason: `#backlog ${why}` });
  if (col < 0) return unwritable(`has no ${key} column`);
  const format = String(tb.attrs["format"] ?? "");
  if (format === "csv" || format === "tsv" || !tb.table?.rowLines) return unwritable("rows are not a pipe table written in this document, so a cell cannot be rewritten");
  if (tb.table.rows[row]?.[col]?.computed) return unwritable(`column ${key} is computed, so it has no bytes to rewrite`);
  const span = unitSpans(source).find((u) => u.kind === "block" && u.id === "backlog")?.span;
  const lines = splitLines(source);
  const at = span === void 0 ? void 0 : span.start + 1 + tb.table.rowLines[row];
  const old = at === void 0 ? void 0 : lines[at];
  if (at === void 0 || old === void 0) return unwritable("row could not be found in the text");
  const eol = /(?:\r\n|\r|\n)$/.exec(old)?.[0] ?? "";
  lines[at] = withCell(old.slice(0, old.length - eol.length), col, esc(target)) + eol;
  const text = lines.join("");
  const after = load(text);
  const same = after !== void 0 && after.key === key && after.items.length === before.items.length && after.diagnostics.join("\n") === before.diagnostics.join("\n") && after.items.every((item, i) => i === row ? item.id === id && item.title === before.items[i].title && item.target === target : JSON.stringify(item) === JSON.stringify(before.items[i]));
  return same ? { ok: true, text } : unwritable(`row ${row + 1}: ${JSON.stringify(target)} cannot be written into its cell and read back as itself`);
}

// src/core/host-tools.ts
var CLAUDE_CODE_TOOLS = Object.freeze({ run: Object.freeze(["Bash"]), write: Object.freeze(["Edit", "Write", "NotebookEdit"]) });
var PI_TOOLS = Object.freeze({ run: Object.freeze(["bash"]), write: Object.freeze(["edit", "write"]) });
var DSH_TOOLS = Object.freeze({ run: Object.freeze(["bash", "pwsh"]), write: Object.freeze(["write", "edit", "str_replace_editor"]) });
var CODEX_TOOLS = Object.freeze({ run: Object.freeze(["Bash"]), write: Object.freeze(["apply_patch"]) });
var NO_TOOLS = Object.freeze({ run: Object.freeze([]), write: Object.freeze([]) });
var HOST_TOOLS = Object.freeze({ claude: CLAUDE_CODE_TOOLS, pi: PI_TOOLS, dsh: DSH_TOOLS, codex: CODEX_TOOLS });

// src/bridge.ts
import { PARSER_VERSION } from "./vendor/geml/geml.js";
import { guardText } from "./vendor/geml/statechart.js";
import { readFileSync as readFileSync5 } from "node:fs";

// src/outline-store.ts
import { join as join2, relative as relative2, sep as sep2 } from "node:path";

// src/core/outline.ts
import { parse as parse2, unitSpans as unitSpans2 } from "./vendor/geml/geml.js";
var ITEMS_TABLE = "items";
var OUTLINE_COLUMNS = ["item", "state", "flow", "stage", "worktree", "commits", "pr", "tip", "since", "last"];
var END_STATES = ["doing", "merged", "closed", "dropped"];
var prText = (p) => `#${p.number} ${p.state}`;
function prOf(text) {
  const m = /^#(\d+)\s+(open|merged|closed)$/.exec(text.trim());
  return m === null ? void 0 : { number: Number(m[1]), state: m[2] };
}
function branchState(prev, b, pr) {
  const committed = (b.ahead ?? 0) > 0 || (prev?.commits ?? 0) > 0;
  if (b.exists) {
    if (pr?.state === "merged") return "merged";
    return (b.ahead ?? 0) === 0 && committed && b.inDefault === true ? "merged" : "doing";
  }
  const merged = pr?.state === "merged" || prev?.state === "merged" || prev?.state === "closed";
  return merged || committed && b.tipInDefault === true ? "closed" : "dropped";
}
function fileState(final, state) {
  return final ? "closed" : state === "parked" ? "dropped" : "doing";
}
function branchRow(prev, item, b, pr) {
  const ahead = b.exists ? b.ahead : void 0;
  const commits2 = ahead !== void 0 && ahead > 0 ? ahead : prev?.commits ?? ahead ?? null;
  const known = pr ?? (prev !== void 0 ? prOf(prev.pr) : void 0);
  return {
    item: item.id,
    state: branchState(prev, b, known),
    flow: item.flow,
    stage: item.stage,
    worktree: b.exists ? b.worktree ?? "" : "",
    commits: commits2,
    pr: known !== void 0 ? prText(known) : "",
    tip: (b.exists ? b.tip : void 0) ?? prev?.tip ?? "",
    since: item.since,
    last: item.last
  };
}
function fileRow(item, final, state) {
  return { item: item.id, state: fileState(final, state), flow: item.flow, stage: item.stage, worktree: "", commits: null, pr: "", tip: "", since: item.since, last: item.last };
}
function readOutline(source) {
  const tb = parse2(source).children.find((b) => b.kind === "block" && b.type === "table" && b.id === ITEMS_TABLE);
  const table = tb?.table;
  if (table === void 0 || !table.header) return [];
  const cols = table.columns.map((c) => c.trim().toLowerCase());
  if (!cols.includes("item") || !cols.includes("state")) return [];
  const cell = (row, name) => {
    const c = row[cols.indexOf(name)];
    if (!c) return "";
    const only = c.inlines.length === 1 ? c.inlines[0] : void 0;
    return (only?.type === "code" ? only.value : c.text).trim();
  };
  return table.rows.flatMap((row) => {
    const item = cell(row, "item");
    const state = cell(row, "state");
    if (item === "" || !END_STATES.includes(state)) return [];
    const n = cell(row, "commits");
    return [{
      item,
      state,
      flow: cell(row, "flow"),
      stage: cell(row, "stage"),
      worktree: cell(row, "worktree"),
      commits: /^\d+$/.test(n) ? Number(n) : null,
      pr: cell(row, "pr"),
      tip: cell(row, "tip"),
      since: cell(row, "since"),
      last: cell(row, "last")
    }];
  });
}
var cellText = (s) => s.includes("|") ? `\`${s}\`` : s;
function renderOutline(rows) {
  const lines = rows.map((r) => [r.item, r.state, r.flow, r.stage, r.worktree, r.commits === null ? "" : String(r.commits), r.pr, r.tip, r.since, r.last].map(cellText));
  const widths = OUTLINE_COLUMNS.map((c, i) => Math.max(c.length, ...lines.map((l) => l[i].length)));
  const fmt = (cells) => `| ${cells.map((c, i) => c.padEnd(widths[i])).join(" | ")} |`;
  return [`=== table {#${ITEMS_TABLE}}`, fmt(OUTLINE_COLUMNS), `|${widths.map((w) => "-".repeat(w + 2)).join("|")}|`, ...lines.map(fmt), "==="].join("\n");
}
function withOutline(source, rows) {
  const table = renderOutline(rows);
  if (source === null) return ["=== meta", 'title = "Gemworks"', "===", "", table, ""].join("\n");
  const src = source.replace(/\r\n?/g, "\n");
  const unit = unitSpans2(src).find((u) => u.kind === "block" && u.id === ITEMS_TABLE);
  if (unit === void 0) return `${src.replace(/\n*$/, "\n\n")}${table}
`;
  const lines = src.split("\n");
  return [...lines.slice(0, unit.span.start), ...table.split("\n"), ...lines.slice(unit.span.end)].join("\n");
}
var byLast = (a, b) => b.last.localeCompare(a.last) || a.item.localeCompare(b.item);

// src/outline-store.ts
var lf = (s) => s.replace(/\r\n?/g, "\n");
var slashed = (p) => p.split(sep2).join("/");
function updateOutline(root, home, entries, prs) {
  const path = join2(home, PROJECT_DOC);
  const from = exists(path) ? path : projectDocOf(root, home);
  const source = from === void 0 ? null : readText(from);
  const before = new Map((source === null ? [] : readOutline(source)).map((r) => [r.item, r]));
  const git = entries.some((e) => e.kind === "branch") ? branchesFacts(root) : void 0;
  const rows = new Map(before);
  for (const e of entries) {
    const prev = before.get(e.id);
    if (e.kind === "file") {
      rows.set(e.id, fileRow(e, e.final, e.state));
      continue;
    }
    if (git?.ok !== true) continue;
    const b = git?.branches.get(e.id);
    const facts = b === void 0 ? { exists: false } : {
      exists: true,
      tip: b.tip,
      ...b.ahead !== void 0 ? { ahead: b.ahead } : {},
      inDefault: b.inDefault,
      ...b.worktree !== void 0 ? { worktree: slashed(relative2(home, b.worktree)) || "." } : {}
    };
    if (!facts.exists && git?.base !== void 0 && prev?.tip && (prev.state === "doing" || prev.state === "merged")) {
      const held = holdsCommit(root, git.base, prev.tip);
      if (held !== void 0) facts.tipInDefault = held;
    }
    rows.set(e.id, branchRow(prev, e, facts, prs?.get(e.id)));
  }
  if (rows.size === 0) return rows;
  const ordered = [...rows.values()].sort(byLast);
  try {
    withLock(path, () => {
      const at = exists(path) ? path : projectDocOf(root, home);
      const now = at === void 0 ? null : readText(at);
      const text = withOutline(now, ordered);
      if (now === null || at !== path || lf(text) !== lf(now)) writeAtomic(path, text);
    });
  } catch {
  }
  return rows;
}

// src/artifacts-store.ts
import { createHash } from "node:crypto";
import { closeSync, copyFileSync, mkdirSync, openSync, readSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname as dirname2, isAbsolute as isAbsolute2, join as join3, relative as relative3, sep as sep3 } from "node:path";
import { historyPathFor } from "./vendor/geml/geml.js";
import { save as saveHistory } from "./vendor/geml/history.js";

// src/core/artifacts.ts
import { parse as parse3, unitSpans as unitSpans3 } from "./vendor/geml/geml.js";

// src/core/artifact-tool.ts
var IMAGE = /\.(png|jpe?g|gif|webp|avif|bmp|svg|ico|tiff?|heic)$/i;
var MADE_FOR_PEOPLE = /\.(md|markdown|mdx|geml|txt|rst|adoc|html?|pdf|docx?|odt|rtf|pptx?|key|odp|xlsx?|ods|csv|tsv|png|jpe?g|gif|webp|avif|bmp|svg|ico|tiff?|heic|mp4|mov|webm|mkv|avi|mp3|wav|m4a|ogg|flac)$/i;
var isImagePath = (path) => IMAGE.test(path);
var isMadeForPeople = (path) => MADE_FOR_PEOPLE.test(path);
function publishedLink(result) {
  const m = /\b(?:Published|Updated)\b[^\n]*?\bat (https:\/\/claude\.ai\/(?:code\/)?artifact\/[A-Za-z0-9-]+)(?:\s*\(Version (\d+))?/.exec(result);
  if (m === null) return void 0;
  return { url: m[1], ...m[2] !== void 0 ? { version: m[2] } : {} };
}

// src/core/artifacts.ts
var ARTIFACTS_TABLE = "artifacts";
var ARTIFACT_COLUMNS = ["item", "kind", "name", "where", "version", "size", "at", "sha256"];
var ARTIFACT_KINDS = ["link", "doc", "file", "image"];
var COPY_LIMIT = 20 * 1024 * 1024;
var DOC = /\.(md|markdown|mdx|geml)$/i;
var UPLOAD_PREFIX = "upload/";
var isDocPath = (path) => DOC.test(path);
var isGemlPath = (path) => /\.geml$/i.test(path);
function copyName(sha256, path) {
  const ext = /(\.[A-Za-z0-9]{1,10})$/.exec(path.split("/").at(-1) ?? "")?.[1] ?? "";
  return `${sha256}${ext.toLowerCase()}`;
}
function readArtifacts(source) {
  const tb = parse3(source).children.find((b) => b.kind === "block" && b.type === "table" && b.id === ARTIFACTS_TABLE);
  const table = tb?.table;
  if (table === void 0 || !table.header) return [];
  const cols = table.columns.map((c) => c.trim().toLowerCase());
  if (!cols.includes("item") || !cols.includes("kind") || !cols.includes("name")) return [];
  const cell = (row, name) => {
    const c = row[cols.indexOf(name)];
    if (!c) return "";
    const only = c.inlines.length === 1 ? c.inlines[0] : void 0;
    return (only?.type === "code" ? only.value : c.text).trim();
  };
  return table.rows.flatMap((row) => {
    const item = cell(row, "item");
    const kind = cell(row, "kind");
    const name = cell(row, "name");
    if (item === "" || name === "" || !ARTIFACT_KINDS.includes(kind)) return [];
    const size = cell(row, "size");
    return [{ item, kind, name, where: cell(row, "where"), version: cell(row, "version"), size: /^\d+$/.test(size) ? Number(size) : null, at: cell(row, "at"), sha256: cell(row, "sha256") }];
  });
}
var cellText2 = (s) => /[|`*_[\]\\<{]/.test(s) || /^https?:/.test(s) ? `\`${s.replace(/`/g, "'")}\`` : s;
function renderArtifacts(rows) {
  const lines = rows.map((r) => [r.item, r.kind, r.name, r.where, r.version, r.size === null ? "" : String(r.size), r.at, r.sha256].map(cellText2));
  const widths = ARTIFACT_COLUMNS.map((c, i) => Math.max(c.length, ...lines.map((l) => l[i].length)));
  const fmt = (cells) => `| ${cells.map((c, i) => c.padEnd(widths[i])).join(" | ")} |`;
  return [`=== table {#${ARTIFACTS_TABLE}}`, fmt(ARTIFACT_COLUMNS), `|${widths.map((w) => "-".repeat(w + 2)).join("|")}|`, ...lines.map(fmt), "==="].join("\n");
}
function withArtifacts(source, rows) {
  const table = renderArtifacts(rows);
  if (source === null) return ["=== meta", 'title = "Gemworks artifacts"', "===", "", table, ""].join("\n");
  const src = source.replace(/\r\n?/g, "\n");
  const unit = unitSpans3(src).find((u) => u.kind === "block" && u.id === ARTIFACTS_TABLE);
  if (unit === void 0) return `${src.replace(/\n*$/, "\n\n")}${table}
`;
  const lines = src.split("\n");
  return [...lines.slice(0, unit.span.start), ...table.split("\n"), ...lines.slice(unit.span.end)].join("\n");
}
function artifactsOfItem(rows, item) {
  const by = /* @__PURE__ */ new Map();
  for (const r of rows) {
    if (r.item !== item) continue;
    const key = `${r.kind}\0${r.name}`;
    const p = by.get(key) ?? { kind: r.kind, name: r.name, versions: [] };
    p.versions.push(r);
    by.set(key, p);
  }
  const last = (p) => p.versions.at(-1)?.at ?? "";
  return [...by.values()].sort((a, b) => last(b).localeCompare(last(a)) || a.name.localeCompare(b.name));
}
function pageTitle(html) {
  const m = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html.slice(0, 8192));
  const t = m?.[1]?.replace(/\s+/g, " ").trim();
  return t === void 0 || t === "" ? void 0 : t;
}

// src/artifacts-store.ts
var lf2 = (s) => s.replace(/\r\n?/g, "\n");
var slashed2 = (p) => p.split(sep3).join("/");
function readArtifactRows(home) {
  const path = join3(home, ARTIFACTS_DOC);
  return exists(path) ? readArtifacts(readText(path)) : [];
}
function copyPath(home, where) {
  return where.startsWith("artifacts/") ? join3(home, GEML_DIR, where) : where;
}
function changeRows(home, change) {
  const path = join3(home, ARTIFACTS_DOC);
  return withLock(path, () => {
    const was = exists(path) ? readText(path) : null;
    const before = was === null ? [] : readArtifacts(was);
    const rows = change([...before]);
    const text = withArtifacts(was, rows);
    if (was === null ? rows.length > 0 : lf2(text) !== lf2(was)) writeAtomic(path, text);
    return rows;
  });
}
function hashFile(path) {
  const h = createHash("sha256");
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(1 << 20);
    for (let n = readSync(fd, buf, 0, buf.length, null); n > 0; n = readSync(fd, buf, 0, buf.length, null)) h.update(buf.subarray(0, n));
  } finally {
    closeSync(fd);
  }
  return h.digest("hex");
}
function latest(rows, item, kind, name) {
  return rows.filter((r) => r.item === item && r.kind === kind && r.name === name).at(-1);
}
function versionOf(home, rows, item, abs, name, kind) {
  let st;
  try {
    st = statSync(abs);
  } catch {
    return void 0;
  }
  if (!st.isFile()) return void 0;
  const at = new Date(Math.floor(st.mtimeMs)).toISOString();
  const prev = latest(rows, item, kind, name);
  if (prev !== void 0 && prev.size === st.size && prev.at === at) return void 0;
  const sha256 = hashFile(abs);
  if (prev?.sha256 === sha256) return void 0;
  const version = String(rows.filter((r) => r.item === item && r.kind === kind && r.name === name).length + 1);
  const row = (where2) => ({ item, kind, name, where: where2, version, size: st.size, at, sha256 });
  if (st.size > COPY_LIMIT) return row(slashed2(abs));
  const dir = join3(home, GEML_DIR, "artifacts");
  mkdirSync(dir, { recursive: true });
  if (isGemlPath(name)) {
    const kept = prev !== void 0 && prev.where.startsWith("artifacts/") && isGemlPath(prev.where) ? prev.where : `artifacts/${copyName(sha256, name)}`;
    const copy = join3(home, GEML_DIR, kept);
    try {
      writeAtomic(copy, readText(abs));
      saveHistory({ gemlPath: copy, historyPath: historyPathFor(copy), summary: `version ${version}`, author: "gemworks", at: new Date(Math.floor(st.mtimeMs)) });
      return row(kept);
    } catch {
    }
  }
  const where = `artifacts/${copyName(sha256, name)}`;
  const target = join3(home, GEML_DIR, where);
  if (!exists(target)) copyFileSync(abs, target);
  return row(where);
}
function syncWritten(root, home, item, everything) {
  const written = everything.filter(isMadeForPeople);
  const unkept = written.length === 0 ? /* @__PURE__ */ new Set() : unkeptOf(root, written);
  if (unkept === void 0 || unkept.size === 0) return readArtifactRows(home);
  return changeRows(home, (rows) => {
    for (const path of written.filter((p) => unkept.has(p))) {
      const v = versionOf(home, rows, item, join3(root, path), path, isImagePath(path) ? "image" : "file");
      if (v !== void 0) rows.push(v);
    }
    return rows;
  });
}
function syncDocs(home, item, docs) {
  const wanted = docs.map((d) => ({ item, kind: "doc", name: d.path, where: "git", version: d.sha.slice(0, 8), size: null, at: d.at, sha256: "" }));
  const same = (a, b) => a.length === b.length && a.every((r, i) => JSON.stringify(r) === JSON.stringify(b[i]));
  const now = readArtifactRows(home);
  if (same(now.filter((r) => r.item === item && r.kind === "doc"), wanted)) return now;
  return changeRows(home, (rows) => [...rows.filter((r) => !(r.item === item && r.kind === "doc")), ...wanted]);
}
function recordLink(home, item, link) {
  return changeRows(home, (rows) => {
    const versions = rows.filter((r) => r.item === item && r.kind === "link" && r.where === link.url);
    const prev = versions.at(-1);
    const name = link.name !== void 0 && link.name !== "" ? link.name : prev?.name ?? (link.fallback !== void 0 && link.fallback !== "" ? link.fallback : link.url);
    if (versions.some((r) => r.version === (link.version ?? "") && r.name === name)) return rows;
    rows.push({ item, kind: "link", name, where: link.url, version: link.version ?? "", size: null, at: link.at, sha256: "" });
    return rows;
  });
}
function recordFile(root, home, item, path, kind) {
  const abs = isAbsolute2(path) ? path : join3(root, path);
  const rel = slashed2(relative3(root, abs));
  const name = rel !== "" && !rel.startsWith("../") && !isAbsolute2(rel) ? rel : slashed2(abs);
  let made;
  changeRows(home, (rows) => {
    made = versionOf(home, rows, item, abs, name, kind);
    if (made !== void 0) rows.push(made);
    return rows;
  });
  return made;
}
function recordBytes(home, item, given) {
  const sha256 = createHash("sha256").update(given.bytes).digest("hex");
  let made;
  changeRows(home, (rows) => {
    if (rows.some((r) => r.item === item && r.sha256 === sha256)) return rows;
    const where = `artifacts/${copyName(sha256, given.name)}`;
    const target = join3(home, GEML_DIR, where);
    mkdirSync(dirname2(target), { recursive: true });
    if (!exists(target)) writeFileSync(target, given.bytes);
    const version = String(rows.filter((r) => r.item === item && r.kind === given.kind && r.name === given.name).length + 1);
    made = { item, kind: given.kind, name: given.name, where, version, size: given.bytes.length, at: given.at, sha256 };
    rows.push(made);
    return rows;
  });
  return made;
}
var artifactsDir = (home) => dirname2(join3(home, GEML_DIR, "artifacts", "x"));
function samePath(a, b) {
  const norm2 = (p) => {
    const s = p.split("\\").join("/").replace(/\/+$/, "");
    return process.platform === "win32" ? s.toLowerCase() : s;
  };
  return norm2(a) === norm2(b);
}
function isUnder(path, dir) {
  const norm2 = (p2) => {
    const s = p2.split("\\").join("/").replace(/\/+$/, "");
    return process.platform === "win32" ? s.toLowerCase() : s;
  };
  const d = norm2(dir);
  const p = norm2(path);
  return p === d || p.startsWith(`${d}/`);
}
function forgetFiles(root, home, paths, trash) {
  const names = paths.flatMap((p) => {
    const abs = isAbsolute2(p) ? p : join3(root, p);
    const rel = slashed2(relative3(root, abs));
    return [slashed2(abs), ...rel !== "" && !rel.startsWith("../") && !isAbsolute2(rel) ? [rel] : []];
  });
  let gone = [];
  const kept = changeRows(home, (rows) => {
    gone = rows.filter((r) => r.kind !== "link" && names.some((n) => samePath(n, r.name)));
    return rows.filter((r) => !gone.includes(r));
  });
  for (const r of gone) {
    if (!r.where.startsWith("artifacts/") || kept.some((k) => k.where === r.where)) continue;
    for (const copy of [copyPath(home, r.where), historyPathFor(copyPath(home, r.where))]) {
      if (!exists(copy)) continue;
      mkdirSync(trash, { recursive: true });
      try {
        renameSync(copy, join3(trash, basename(copy)));
      } catch {
        copyFileSync(copy, join3(trash, basename(copy)));
        unlinkSync(copy);
      }
    }
  }
  return gone.length;
}

// src/memory-store.ts
import { copyFileSync as copyFileSync2, existsSync, mkdirSync as mkdirSync2, readFileSync, renameSync as renameSync2, statSync as statSync2, unlinkSync as unlinkSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { basename as basename2, join as join4 } from "node:path";
var INDEX = "MEMORY.md";
var LINE = /^- \[([^\]]*)\]\(([^)\s]+)\)\s*(?:—|–|-)\s*(.*)$/;
function memoryDir(projects, project) {
  return join4(projects, project.replace(/[^A-Za-z0-9]/g, "-"), "memory");
}
function typeOf(text) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  return /^\s*type:\s*([A-Za-z]+)/m.exec(front)?.[1] ?? "";
}
function readMemory(dir) {
  const index = join4(dir, INDEX);
  if (!existsSync(index)) return { dir, entries: [] };
  const entries = [];
  for (const line of readFileSync(index, "utf8").split(/\r?\n/)) {
    const m = LINE.exec(line.trim());
    if (m === null) continue;
    const [, title = "", file = "", hook = ""] = m;
    let type = "";
    let at = "";
    try {
      at = statSync2(join4(dir, file)).mtime.toISOString();
      type = typeOf(readFileSync(join4(dir, file), "utf8"));
    } catch {
    }
    entries.push({ file, title, hook, type, at });
  }
  entries.sort((a, b) => a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
  return { dir, entries };
}
function isMemoryFile(file) {
  return file !== INDEX && file.endsWith(".md") && basename2(file) === file && !file.includes("\\") && !file.startsWith(".");
}
function readIndex(dir) {
  const text = readFileSync(join4(dir, INDEX), "utf8");
  return { lines: text.split(/\r?\n/), nl: text.includes("\r\n") ? "\r\n" : "\n" };
}
function keepIndex(dir, trash) {
  mkdirSync2(trash, { recursive: true });
  copyFileSync2(join4(dir, INDEX), join4(trash, INDEX));
}
function setMemoryHook(dir, file, hook, trash) {
  const said = hook.trim();
  if (!isMemoryFile(file) || said === "" || /[\r\n]/.test(said) || !existsSync(join4(dir, INDEX))) return false;
  const { lines, nl } = readIndex(dir);
  const at = lines.findIndex((l) => LINE.exec(l.trim())?.[2] === file);
  if (at < 0) return false;
  const title = LINE.exec(lines[at].trim())?.[1] ?? "";
  keepIndex(dir, trash);
  lines[at] = `- [${title}](${file}) \u2014 ${said}`;
  writeFileSync2(join4(dir, INDEX), lines.join(nl));
  return true;
}
function deleteMemory(dir, file, trash) {
  if (!isMemoryFile(file) || !existsSync(join4(dir, INDEX))) return false;
  const { lines, nl } = readIndex(dir);
  const kept = lines.filter((l) => LINE.exec(l.trim())?.[2] !== file);
  if (kept.length === lines.length) return false;
  keepIndex(dir, trash);
  const path = join4(dir, file);
  if (existsSync(path)) {
    try {
      renameSync2(path, join4(trash, file));
    } catch {
      copyFileSync2(path, join4(trash, file));
      unlinkSync2(path);
    }
  }
  writeFileSync2(join4(dir, INDEX), kept.join(nl));
  return true;
}

// src/practice-store.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync3, readFileSync as readFileSync2, writeFileSync as writeFileSync3 } from "node:fs";
import { dirname as dirname3, join as join5 } from "node:path";
import { homedir } from "node:os";

// src/core/practices.ts
var OPEN = "=== data {#practices format=jsonl}";
var BY = ["model", "memory", "person"];
function isPractice(v) {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const p = v;
  return ["id", "flow", "step", "text", "why", "at"].every((k) => typeof p[k] === "string") && p["text"] !== "" && BY.includes(p["by"]) && (p["ref"] === void 0 || typeof p["ref"] === "string") && (p["from"] === void 0 || typeof p["from"] === "string") && (p["deleted"] === void 0 || typeof p["deleted"] === "boolean") && (p["session"] === void 0 || typeof p["session"] === "string") && (p["turn"] === void 0 || typeof p["turn"] === "number");
}
function parsePractices(text, layer) {
  const lines = text.split(/\r?\n/);
  const open = lines.findIndex((l) => l.trim() === OPEN);
  const memoryMoved = /^memory\s*=\s*"moved"\s*$/m.test(text);
  if (open < 0) return { practices: [], memoryMoved };
  const close = lines.findIndex((l, i) => i > open && l.trim() === "===");
  const practices = [];
  for (const line of lines.slice(open + 1, close < 0 ? void 0 : close)) {
    if (line.trim() === "") continue;
    try {
      const v = JSON.parse(line);
      if (isPractice(v)) practices.push({ ...v, layer });
    } catch {
    }
  }
  return { practices, memoryMoved };
}
function practicesText(file) {
  const meta = `=== meta
title = "\u505A\u6CD5"
${file.memoryMoved ? 'memory = "moved"\n' : ""}===

`;
  const lines = file.practices.map(({ layer: _layer, ...p }) => `${JSON.stringify(p)}
`).join("");
  return `${meta}${OPEN}
${lines}===
`;
}

// src/practice-store.ts
var PRACTICES_FILE = "practices.geml";
function practicePaths(root, home = homedir()) {
  return {
    personal: join5(home, ".gemworks", PRACTICES_FILE),
    project: join5(journalBaseOf(root), ".geml", PRACTICES_FILE),
    team: join5(root, ".gemworks", PRACTICES_FILE)
  };
}
function readLayer(path, layer) {
  if (!existsSync2(path)) return { practices: [], memoryMoved: false };
  try {
    return parsePractices(readFileSync2(path, "utf8"), layer);
  } catch {
    return { practices: [], memoryMoved: false };
  }
}
function writeLayer(path, file) {
  mkdirSync3(dirname3(path), { recursive: true });
  writeFileSync3(path, practicesText(file));
}
function readPractices(root, home) {
  const paths = practicePaths(root, home);
  const team = readLayer(paths.team, "team");
  const project = readLayer(paths.project, "project");
  const personal = readLayer(paths.personal, "personal");
  return { practices: [...team.practices, ...project.practices, ...personal.practices], memoryMoved: project.memoryMoved };
}
function writePractices(root, added, memory, home) {
  const paths = practicePaths(root, home);
  for (const layer of ["personal", "project"]) {
    const mine = added.filter((p) => p.layer === layer);
    if (mine.length === 0 && !(layer === "project" && memory)) continue;
    const file = readLayer(paths[layer], layer);
    writeLayer(paths[layer], { practices: [...file.practices, ...mine], memoryMoved: file.memoryMoved || layer === "project" && memory });
  }
}
function changePractice(root, id, change, home) {
  const paths = practicePaths(root, home);
  const changed = (p) => ({ ...p, ...change.deleted !== void 0 ? { deleted: change.deleted } : {}, ...change.everywhere === true ? { flow: "*", step: "*" } : {} });
  for (const layer of ["personal", "project"]) {
    const file = readLayer(paths[layer], layer);
    const p = file.practices.find((x) => x.id === id);
    if (p === void 0) continue;
    if (change.layer !== void 0 && change.layer !== layer) {
      writeLayer(paths[layer], { ...file, practices: file.practices.filter((x) => x.id !== id) });
      const to = readLayer(paths[change.layer], change.layer);
      writeLayer(paths[change.layer], { ...to, practices: [...to.practices, { ...changed(p), layer: change.layer }] });
      return true;
    }
    writeLayer(paths[layer], { ...file, practices: file.practices.map((x) => x.id === id ? changed(x) : x) });
    return true;
  }
  return false;
}
function sharePractices(root, ids, home) {
  const paths = practicePaths(root, home);
  const moving = [];
  for (const layer of ["personal", "project"]) {
    const file = readLayer(paths[layer], layer);
    const going = file.practices.filter((p) => ids.includes(p.id) && p.deleted !== true);
    if (going.length === 0) continue;
    moving.push(...going);
    writeLayer(paths[layer], { ...file, practices: file.practices.filter((p) => !going.includes(p)) });
  }
  if (moving.length === 0) return 0;
  const team = readLayer(paths.team, "team");
  writeLayer(paths.team, { ...team, practices: [...team.practices, ...moving.map(({ session: _session, turn: _turn, ...p }) => ({ ...p, layer: "team" }))] });
  return moving.length;
}

// src/corrections-store.ts
import { existsSync as existsSync3, readdirSync, readFileSync as readFileSync3, statSync as statSync3 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { basename as basename3, join as join6 } from "node:path";

// src/core/corrections.ts
var KINDS = ["task", "decide", "correct", "status", "nudge", "inform", "interrupt"];
var SUBS = ["verify", "show", "scope", "irreversible", "process", "visual", "domain", "judgment", "misread", "other"];
var WORKS = ["ui", "spec", "writing", "business", "other"];
var FIXED_SUBS = ["verify", "process", "scope", "visual", "show", "irreversible"];
var PERSON_SUBS = ["judgment", "domain", "misread"];
var EMPTY_LEDGER = { prompts: [], themes: [], dismissed: [], linked: "", claim: "" };
var CLAIM_MS = 5 * 6e4;
function claimThemes(l, session, now) {
  const at = l.claim.lastIndexOf("@");
  const holder = at > 0 ? l.claim.slice(0, at) : "";
  const when = at > 0 ? Date.parse(l.claim.slice(at + 1)) : NaN;
  if (holder !== "" && holder !== session && Date.parse(now) - when < CLAIM_MS) return { ledger: l, mine: false };
  return { ledger: { ...l, claim: `${session}@${now}` }, mine: true };
}
var TEXT_KEPT = 300;
var BARE_INTERRUPT = /^\[Request interrupted by user[^\]]*\]$/;
var NOT_TYPED = /^(<scheduled-task|<local-command|<command-name|<command-message|<command-args|<bash-|<task-notification|<agent-message|<cross-session-message|<side-sessions-event|<user-prompt-submit-hook|<artifact-content|Caveat: |This session is being continued|The summarized conversation|\[SYSTEM NOTIFICATION)/;
function typedWords(text) {
  const words = text.replace(/<system-reminder>[\s\S]*?(?:<\/system-reminder>|$)/g, "").trim();
  return words === "" || NOT_TYPED.test(words) ? void 0 : words;
}
var isTyped = (p) => p.kind !== "interrupt" && !BARE_INTERRUPT.test(p.text.trim());
var isCorrection = (p) => p.kind === "correct" && isTyped(p);
var isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var BY2 = ["model", "agent", "import"];
function isPrompt(v) {
  if (!isObj(v)) return false;
  const opt = (k) => v[k] === void 0 || typeof v[k] === "string";
  return ["id", "at", "session", "text"].every((k) => typeof v[k] === "string") && KINDS.includes(v["kind"]) && (v["sub"] === void 0 || SUBS.includes(v["sub"])) && (v["work"] === void 0 || WORKS.includes(v["work"])) && ["project", "flow", "step", "theme"].every(opt) && BY2.includes(v["by"]);
}
var isTheme = (v) => isObj(v) && ["id", "rule", "at"].every((k) => typeof v[k] === "string") && Array.isArray(v["practices"]) && v["practices"].every((x) => typeof x === "string");
var isDismissed = (v) => isObj(v) && typeof v["key"] === "string" && typeof v["n"] === "number" && typeof v["at"] === "string";
function block(lines, name, is) {
  const open = lines.findIndex((l) => l.trim() === `=== data {#${name} format=jsonl}`);
  if (open < 0) return [];
  const close = lines.findIndex((l, i) => i > open && l.trim() === "===");
  const out = [];
  for (const line of lines.slice(open + 1, close < 0 ? void 0 : close)) {
    if (line.trim() === "") continue;
    try {
      const v = JSON.parse(line);
      if (is(v)) out.push(v);
    } catch {
    }
  }
  return out;
}
function parseLedger(text) {
  const lines = text.split(/\r?\n/);
  const meta = (key) => new RegExp(`^${key}\\s*=\\s*"([^"]*)"\\s*$`, "m").exec(text)?.[1] ?? "";
  return { prompts: block(lines, "prompts", isPrompt), themes: block(lines, "themes", isTheme), dismissed: block(lines, "dismissed", isDismissed), linked: meta("linked"), claim: meta("claim") };
}
function ledgerText(l) {
  const data = (name, rows) => `=== data {#${name} format=jsonl}
${rows.map((r) => `${JSON.stringify(r)}
`).join("")}===
`;
  const quoted = (s) => s.replace(/["\r\n]/g, "");
  return `=== meta
title = "\u7EA0\u6B63"
linked = "${quoted(l.linked)}"
claim = "${quoted(l.claim)}"
===

${data("prompts", l.prompts)}
${data("themes", l.themes)}
${data("dismissed", l.dismissed)}`;
}
function promptId(session, at, taken) {
  const base = `${session.slice(0, 8)}@${at.slice(0, 19)}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}#${n}`;
  return id;
}
var norm = (s) => s.replace(/\s+/g, " ").trim().slice(0, 200);
var SAME_PROMPT_MS = 6e5;
var FORKED_MS = 2e3;
function hasPrompt(l, p) {
  const words = norm(p.text);
  const at = Date.parse(p.at);
  return l.prompts.some((x) => {
    if (x.id === p.id) return true;
    if (norm(x.text) !== words) return false;
    const apart = Math.abs(Date.parse(x.at) - at);
    return x.session.slice(0, 8) === p.session.slice(0, 8) ? apart < SAME_PROMPT_MS : apart < FORKED_MS;
  });
}
function addPrompts(l, given) {
  const prompts = [...l.prompts];
  let added = 0;
  for (const p of given) {
    if (hasPrompt({ prompts }, p)) continue;
    prompts.push({ ...p, text: p.text.slice(0, TEXT_KEPT) });
    added++;
  }
  prompts.sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0);
  return { ledger: { ...l, prompts }, added };
}
var LABEL_GUIDE = [
  "You label messages a person typed to their coding agent (often in Chinese). For each message you get its words and the end of the agent's reply before it.",
  "",
  "kind \u2014 one of:",
  "- correct: the person says the agent's work, answer, claim or behaviour is wrong, falls short, missed something, overstepped, or must be done differently (\u8FD8\u662F\u4E0D\u884C / \u8FD8\u662F\u6CA1\u770B\u5230 / \u4E0D\u5BF9 / \u4E0D\u662F\u8FD9\u6837 / \u4F60\u53C8\u2026 / \u522B\u2026 / \u4E0D\u8981\u2026 / \u4E3A\u4EC0\u4E48\u8FD8\u2026, aimed at what the agent did or proposed). A new requirement that implies the last output fell short counts. A brand-new request with no fault implied does not (that is task). A plain question (\u4E3A\u4EC0\u4E48\u2026) is correct only when it challenges something the agent did.",
  "- status: asks where things stand, or whether something is done.",
  "- decide: answers a question the agent asked, or approves or picks among its proposals.",
  "- nudge: tells it to go on or do the next step, unasked.",
  "- inform: shares a fact or update without asking for anything.",
  '- interrupt: the text is "[Request interrupted by user\u2026]" alone.',
  "- task: anything else: new work, questions, discussion, pasted material.",
  "",
  "sub \u2014 only when kind is correct, else null; the single best fit:",
  "- verify: the agent said or implied something was done, fixed, working or visible and it was not, or it never checked the real result (the real device, the running version, real data) before saying so.",
  "- show: the agent explained, described or listed instead of showing the actual thing (real UI, real output, a mockup with real data), or its mockup or demo was not real.",
  "- scope: the agent did more than asked (turned a hint into a section, touched or deleted things not named) or less than asked (skipped part of the request).",
  "- irreversible: a risky, destructive or hard-to-undo action, or one others can see (delete, overwrite, push, publish, break something working), done or proposed without asking.",
  "- process: how the agent works: wasted or repeated runs, too slow, not watching CI, not saying a long run is coming, wrong reply language, forgetting a standing step (version bump, sync, refresh, tests), needless questions, poor reporting.",
  "- visual: visible layout or style defects: alignment, spacing, overflow, icons, colours not as designed.",
  "- domain: the person supplies facts or knowledge the agent lacked or got wrong (the project, its history, the domain, a tool).",
  "- judgment: product, design, writing or strategy judgment and taste: what matters, priorities, naming, wording, what the user should experience, aesthetics.",
  "- misread: the agent misunderstood what the person meant (wrong referent, wrong goal).",
  "- other.",
  "When unsure between judgment and something more specific, prefer the specific one only if the text clearly names that failure.",
  "",
  "work \u2014 what kind of work the message is about, for every message:",
  "- ui: an interface people look at and press: panes, tabs, buttons, dialogs, pages, layout, mockups, icons, colours.",
  "- spec: a format, its spec, parsers and libraries; commands, logic, tests, CI, builds, packaging \u2014 code and format work that is not about how an interface looks.",
  "- writing: prose for people: articles, posts, READMEs and docs as writing, release notes, translations, naming and wording of a text.",
  "- business: the person's own business work outside software tools: data pipelines and warehouses, reports, estimates and plans for that business.",
  "- other: none of these."
].join("\n");
var THEMES_ASKED = 60;
var sameRule = (a, b) => a.replace(/\s+/g, "") === b.replace(/\s+/g, "");
function applyThemes(l, answer2, at, linked, newId) {
  const themes = l.themes.map((t) => ({ ...t, practices: [...t.practices] }));
  let made = 0;
  const idOf = (x) => {
    if (typeof x === "string") return x;
    const kept = themes.find((t) => sameRule(t.rule, x.rule));
    if (kept !== void 0) return kept.id;
    const id = newId(made++);
    themes.push({ id, rule: x.rule, at, practices: [] });
    return id;
  };
  const assigned = new Map(answer2.assign.map((a) => [a.id, a.theme === null ? "" : idOf(a.theme)]));
  for (const k of answer2.links) {
    const t = themes.find((x) => x.id === idOf(k.theme));
    if (t !== void 0) t.practices = k.practices;
  }
  return { ...l, themes, linked, prompts: l.prompts.map((p) => assigned.has(p.id) ? { ...p, theme: assigned.get(p.id) } : p) };
}
function unthemed(l, limit = THEMES_ASKED) {
  const waiting = l.prompts.filter((p) => isCorrection(p) && p.theme === void 0);
  return limit >= waiting.length ? waiting : waiting.slice(waiting.length - limit);
}
var linkKey = (practices) => practices.filter((p) => p.deleted !== true).map((p) => p.id).sort().join(",");
var themesOf = (l, practice) => new Set(l.themes.filter((t) => t.practices.includes(practice)).map((t) => t.id));
var covers = (p, x) => (p.flow === "*" || p.flow === x.flow) && (p.step === "*" || p.step === x.step);
function practiceCounts(l, practices) {
  const out = {};
  for (const p of practices) {
    if (p.deleted === true) continue;
    const mine = themesOf(l, p.id);
    if (mine.size === 0) continue;
    const said = l.prompts.filter((x) => isCorrection(x) && x.theme !== void 0 && mine.has(x.theme));
    out[p.id] = { before: said.filter((x) => x.at < p.at).length, after: said.filter((x) => x.at > p.at && covers(p, x)).length };
  }
  return out;
}
var quotesOf = (xs) => xs.slice(-3).map((x) => ({ at: x.at, text: x.text.replace(/<!--[^>]*-->/g, "").replace(/\s+/g, " ").trim() }));
function ledgerCards(l, practices, now, o = {}) {
  const days = o.days ?? 30, least = o.least ?? 3, shown = o.shown ?? 3;
  const since = new Date(Date.parse(now) - days * 864e5).toISOString();
  const live = practices.filter((p) => p.deleted !== true);
  const corrections = l.prompts.filter((x) => isCorrection(x) && x.theme !== void 0 && x.theme !== "");
  const away = (key, n) => l.dismissed.some((d) => d.key === key && n < d.n + 2);
  const cards = [];
  for (const p of live) {
    const mine = themesOf(l, p.id);
    const after = corrections.filter((x) => mine.has(x.theme) && x.at > p.at && covers(p, x));
    if (after.length < 2 || away(`failing:${p.id}`, after.length)) continue;
    const instead = live.filter((q) => q.id !== p.id && q.at > p.at && [...themesOf(l, q.id)].some((t) => mine.has(t))).sort((a, b) => a.at < b.at ? 1 : -1)[0];
    cards.push({ kind: "failing", key: `failing:${p.id}`, practice: p, n: after.length, quotes: quotesOf(after), ...instead !== void 0 ? { instead } : {} });
  }
  for (const t of l.themes) {
    const said = corrections.filter((x) => x.theme === t.id && x.at >= since);
    if (said.length < least || away(`repeat:${t.id}`, said.length)) continue;
    const stating = live.filter((p) => t.practices.includes(p.id));
    const outside = said.filter((x) => !stating.some((p) => covers(p, x)));
    if (outside.length < Math.min(2, least)) continue;
    const steps = /* @__PURE__ */ new Map();
    for (const x of said) if (x.flow !== void 0 && x.step !== void 0) steps.set(`${x.flow}	${x.step}`, (steps.get(`${x.flow}	${x.step}`) ?? 0) + 1);
    const top = [...steps.entries()].sort((a, b) => b[1] - a[1])[0];
    const where = top !== void 0 && top[1] === said.length ? { flow: top[0].split("	")[0], step: top[0].split("	")[1] } : void 0;
    cards.push({ kind: "repeat", key: `repeat:${t.id}`, theme: t.id, rule: t.rule, n: said.length, quotes: quotesOf(said), ...stating[0] !== void 0 ? { narrow: stating[0] } : {}, ...where !== void 0 ? { where } : {} });
  }
  return cards.sort((a, b) => a.kind === b.kind ? b.n - a.n : a.kind === "failing" ? -1 : 1).slice(0, shown);
}
function dismiss(l, key, n, at) {
  return { ...l, dismissed: [...l.dismissed.filter((d) => d.key !== key), { key, n, at }] };
}
function flowless(l, now, days = 7, least = 10) {
  const since = new Date(Date.parse(now) - days * 864e5).toISOString();
  const said = l.prompts.filter((x) => isCorrection(x) && x.by === "model" && x.at >= since && x.flow === void 0 && x.work !== void 0 && x.work !== "other");
  return WORKS.filter((w) => w !== "other").map((work) => {
    const mine = said.filter((x) => x.work === work);
    return { work, n: mine.length, judgment: mine.filter((x) => x.sub === "judgment").length };
  }).filter((x) => x.n >= least).sort((a, b) => b.n - a.n);
}
function tally(xs) {
  const typed = xs.filter(isTyped);
  const c = typed.filter((x) => x.kind === "correct");
  const by = Object.fromEntries(SUBS.map((s) => [s, c.filter((x) => (x.sub ?? "other") === s).length]));
  return {
    prompts: typed.length,
    corrections: c.length,
    by,
    sessions: new Set(typed.map((x) => x.session)).size,
    fixed: FIXED_SUBS.reduce((a, s) => a + by[s], 0),
    person: PERSON_SUBS.reduce((a, s) => a + by[s], 0)
  };
}
var per100 = (n, of) => of > 0 ? (Math.round(1e3 * n / of) / 10).toFixed(1) : "\u2013";
var localDay = (at, offset) => new Date(Date.parse(at) + offset * 6e4).toISOString().slice(0, 10);
function mondayOf(day) {
  const d = /* @__PURE__ */ new Date(`${day}T00:00:00Z`);
  return new Date(d.getTime() - (d.getUTCDay() + 6) % 7 * 864e5).toISOString().slice(0, 10);
}
var addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
function parsePeriod(s) {
  const m = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(s.trim());
  return m !== null && m[1] <= m[2] ? { from: m[1], to: m[2] } : void 0;
}
function defaultPeriods(today) {
  const monday = mondayOf(today);
  return { trial: { from: monday, to: today }, baseline: { from: addDays(monday, -56), to: addDays(monday, -1) } };
}
function report(l, o) {
  const xs = l.prompts.filter(isTyped).filter((x) => o.since === void 0 || localDay(x.at, o.offset) >= o.since);
  const within = (p) => xs.filter((x) => {
    const d = localDay(x.at, o.offset);
    return d >= p.from && d <= p.to;
  });
  const first = xs[0] !== void 0 ? localDay(xs[0].at, o.offset) : "";
  const last = xs[xs.length - 1] !== void 0 ? localDay(xs[xs.length - 1].at, o.offset) : "";
  const weeks = [];
  if (first !== "") {
    for (let w = mondayOf(first); w <= last; w = addDays(w, 7)) weeks.push({ week: w, ...tally(xs.filter((x) => mondayOf(localDay(x.at, o.offset)) === w)) });
  }
  const b = within(o.baseline), t = within(o.trial);
  return {
    first,
    last,
    all: tally(xs),
    weeks,
    baseline: { ...o.baseline, ...tally(b) },
    trial: { ...o.trial, ...tally(t) },
    ...o.byWork === true ? { byWork: WORKS.map((work) => ({ work, baseline: tally(b.filter((x) => x.work === work)), trial: tally(t.filter((x) => x.work === work)) })) } : {}
  };
}
var SUB_NAMES = {
  verify: "\u8BF4\u597D\u4E86\u4F46\u6CA1\u597D",
  process: "\u505A\u4E8B\u65B9\u5F0F",
  scope: "\u8D8A\u754C\u6216\u6F0F\u505A",
  visual: "\u89C6\u89C9",
  show: "\u8BB2\u89E3\u4EE3\u66FF\u5C55\u793A",
  irreversible: "\u4E0D\u53EF\u9006",
  judgment: "\u5224\u65AD",
  domain: "\u9886\u57DF\u77E5\u8BC6",
  misread: "\u7406\u89E3\u504F\u5DEE",
  other: "\u5176\u4ED6"
};
var WORK_NAMES = { ui: "\u754C\u9762", spec: "\u89E3\u6790\u5668\u4E0E\u89C4\u8303", writing: "\u6587\u6863\u4E0E\u5199\u4F5C", business: "\u4E1A\u52A1", other: "\u5176\u4ED6" };
function reportText(r, cells, unlabelled = 0) {
  const pad = (s, w) => s + " ".repeat(Math.max(0, w - cells(s)));
  const num = (s, w = 8) => " ".repeat(Math.max(0, w - s.length)) + s;
  const NAME = 18;
  const pair = (name, nb, nt) => `${pad(name, NAME)}${num(per100(nb, r.baseline.prompts))}${num(per100(nt, r.trial.prompts))}`;
  const lines = [
    `\u7EA0\u6B63 \xB7 ${r.first} \u81F3 ${r.last} \xB7 ${r.all.sessions} \u4E2A\u4F1A\u8BDD \xB7 ${r.all.prompts} \u53E5 \xB7 \u7EA0\u6B63 ${r.all.corrections} \u53E5${unlabelled > 0 ? ` \xB7 ${unlabelled} \u53E5\u672A\u6807\u6CE8` : ""}`,
    "",
    `${pad("\u6BCF\u767E\u53E5", NAME)}${num("\u57FA\u7EBF")}${num("\u8BD5\u9A8C\u671F")}`,
    `${pad("", NAME)}${num(r.baseline.from.slice(5))}${num(r.trial.from.slice(5))}`,
    `${pad("", NAME)}${num(r.baseline.to.slice(5))}${num(r.trial.to.slice(5))}`,
    `${pad("\u53E5\u6570", NAME)}${num(String(r.baseline.prompts))}${num(String(r.trial.prompts))}`,
    pair("\u7EA0\u6B63", r.baseline.corrections, r.trial.corrections),
    pair("\u56FA\u5B9A\u68C0\u67E5", r.baseline.fixed, r.trial.fixed),
    ...FIXED_SUBS.map((s) => pair(`  ${SUB_NAMES[s]}`, r.baseline.by[s], r.trial.by[s])),
    pair("\u9760\u4EBA\u5224\u65AD\uFF08\u5BF9\u7167\uFF09", r.baseline.person, r.trial.person),
    ...PERSON_SUBS.map((s) => pair(`  ${SUB_NAMES[s]}`, r.baseline.by[s], r.trial.by[s]))
  ];
  if (r.byWork !== void 0) {
    lines.push("", `${pad("\u6309\u5DE5\u4F5C\u7C7B\u578B\uFF1A\u56FA\u5B9A\u68C0\u67E5", NAME)}${num("\u57FA\u7EBF")}${num("\u8BD5\u9A8C\u671F")}${num("\u53E5\u6570")}`);
    for (const w of r.byWork) {
      if (w.baseline.prompts === 0 && w.trial.prompts === 0) continue;
      lines.push(`${pad(`  ${WORK_NAMES[w.work]}`, NAME)}${num(per100(w.baseline.fixed, w.baseline.prompts))}${num(per100(w.trial.fixed, w.trial.prompts))}${num(`${w.baseline.prompts}/${w.trial.prompts}`, 10)}`);
      lines.push(`${pad("    \u9760\u4EBA\u5224\u65AD", NAME)}${num(per100(w.baseline.person, w.baseline.prompts))}${num(per100(w.trial.person, w.trial.prompts))}`);
    }
  }
  lines.push("", `${pad("\u6BCF\u5468", 10)}${num("\u53E5\u6570", 6)}${num("\u7EA0\u6B63")}${num("\u56FA\u5B9A\u68C0\u67E5")}${num("\u9760\u4EBA\u5224\u65AD")}`);
  for (const w of r.weeks) {
    lines.push(w.prompts === 0 ? `${pad(w.week.slice(5), 10)}${num("\u2014", 6)}${num("\u2014")}${num("\u2014")}${num("\u2014")}` : `${pad(w.week.slice(5), 10)}${num(String(w.prompts), 6)}${num(per100(w.corrections, w.prompts))}${num(per100(w.fixed, w.prompts))}${num(per100(w.person, w.prompts))}`);
  }
  return lines.join("\n");
}

// src/corrections-store.ts
var isObj2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var CORRECTIONS_FILE = "corrections.geml";
var correctionsPath = (home = homedir2()) => join6(home, ".gemworks", CORRECTIONS_FILE);
function readLedger(home) {
  const path = correctionsPath(home);
  if (!existsSync3(path)) return EMPTY_LEDGER;
  try {
    return parseLedger(readFileSync3(path, "utf8"));
  } catch {
    return EMPTY_LEDGER;
  }
}
function updateLedger(change, home) {
  const path = correctionsPath(home);
  return withLock(path, () => {
    const next = change(readLedger(home));
    writeAtomic(path, ledgerText(next));
    return next;
  });
}
function labelledRows(given, by) {
  const rows = [];
  const errors = [];
  given.forEach((v, n) => {
    if (!isObj2(v)) {
      errors.push(`line ${n + 1} is not an object`);
      return;
    }
    const s = (k) => typeof v[k] === "string" && v[k] !== "" ? v[k] : void 0;
    const [id, at, session, text] = [s("id"), s("at"), s("session"), s("text")];
    if (id === void 0 || at === void 0 || session === void 0 || text === void 0 || !Number.isFinite(Date.parse(at))) {
      errors.push(`line ${n + 1} needs id, at, session and text`);
      return;
    }
    const kind = v["kind"];
    if (!KINDS.includes(kind)) {
      errors.push(`line ${n + 1}: kind must be one of ${KINDS.join(", ")}`);
      return;
    }
    const sub = v["sub"];
    if (kind === "correct" && !SUBS.includes(sub)) {
      errors.push(`line ${n + 1}: a correction's sub must be one of ${SUBS.join(", ")}`);
      return;
    }
    const work = v["work"];
    if (work !== void 0 && work !== null && !WORKS.includes(work)) {
      errors.push(`line ${n + 1}: work must be one of ${WORKS.join(", ")}`);
      return;
    }
    rows.push({
      id,
      at,
      session,
      text,
      kind,
      by,
      ...kind === "correct" ? { sub } : {},
      ...typeof work === "string" ? { work } : {},
      ...s("project") !== void 0 ? { project: s("project") } : {},
      ...s("flow") !== void 0 ? { flow: s("flow") } : {},
      ...s("step") !== void 0 ? { step: s("step") } : {}
    });
  });
  return { rows, errors };
}
function addLabelled(rows, home) {
  let added = 0;
  updateLedger((l) => {
    const r = addPrompts(l, rows);
    added = r.added;
    return r.ledger;
  }, home);
  return added;
}
var textOf = (content) => {
  if (typeof content === "string") return { text: content, results: false };
  const blocks = Array.isArray(content) ? content.filter((b) => typeof b === "object" && b !== null) : [];
  return { text: blocks.filter((b) => b.type === "text").map((b) => typeof b.text === "string" ? b.text : "").join("\n"), results: blocks.some((b) => b.type === "tool_result") };
};
function typedPrompts(text) {
  const out = [];
  let answer2 = "";
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof o !== "object" || o === null || o.isSidechain === true) continue;
    const at = typeof o.timestamp === "string" ? o.timestamp : "";
    const session = typeof o.sessionId === "string" ? o.sessionId : "";
    const cwd = typeof o.cwd === "string" ? o.cwd : "";
    if (o.type === "assistant") {
      const said = textOf(o.message?.content).text.trim();
      if (said !== "") answer2 = said;
      continue;
    }
    if (o.type === "attachment" && o.attachment?.type === "queued_command" && typeof o.attachment.prompt === "string" && (o.attachment.origin?.kind === void 0 || o.attachment.origin.kind === "human")) {
      const words2 = typedWords(o.attachment.prompt);
      const when = typeof o.attachment.timestamp === "string" ? o.attachment.timestamp : at;
      if (words2 !== void 0 && when !== "") out.push({ at: when, session, cwd, text: words2, before: answer2 });
      continue;
    }
    if (o.type !== "user" || o.isMeta === true || o.isCompactSummary === true) continue;
    if (typeof o.turnOrigin === "string" && o.turnOrigin !== "human") continue;
    if (o.origin?.kind !== void 0 && o.origin.kind !== "human") continue;
    const { text: raw, results } = textOf(o.message?.content);
    if (results) continue;
    const words = typedWords(raw);
    if (words === void 0 || at === "") continue;
    out.push({ at, session, cwd, text: words, before: answer2 });
  }
  return out;
}
function unlabelledPrompts(ledger, transcripts, o = {}) {
  const now = o.now ?? (/* @__PURE__ */ new Date()).toISOString();
  const since = o.since ?? ledger.prompts[ledger.prompts.length - 1]?.at ?? new Date(Date.parse(now) - 30 * 864e5).toISOString();
  const from = Date.parse(since);
  const out = [];
  const taken = new Set(ledger.prompts.map((p) => p.id));
  const list = (dir) => {
    try {
      return readdirSync(dir);
    } catch {
      return [];
    }
  };
  for (const folder of list(transcripts)) {
    const dir = join6(transcripts, folder);
    for (const name of list(dir).filter((n) => n.endsWith(".jsonl"))) {
      const file = join6(dir, name);
      try {
        if (statSync3(file).mtimeMs < from) continue;
      } catch {
        continue;
      }
      let text;
      try {
        text = readFileSync3(file, "utf8");
      } catch {
        continue;
      }
      for (const t of typedPrompts(text).sort((a, b) => a.at < b.at ? -1 : 1)) {
        if (Date.parse(t.at) <= from) continue;
        const session = t.session !== "" ? t.session : basename3(name, ".jsonl");
        const id = promptId(session, t.at, taken);
        const row = { id, at: t.at, session, text: t.text };
        if (hasPrompt(ledger, row) || hasPrompt({ prompts: out }, row)) continue;
        taken.add(id);
        out.push({ ...row, project: t.cwd, before: t.before.slice(-600) });
      }
    }
  }
  return out.sort((a, b) => a.at < b.at ? -1 : 1).slice(0, o.limit ?? Infinity);
}

// src/bridge.ts
import { historyPathFor as historyPathFor2 } from "./vendor/geml/geml.js";

// src/core/turn.ts
function waitsOnPerson(next, sources2) {
  const ticked = (x) => x.judge === "machine" && x.reads.length > 0 && x.reads.every((r) => sources2[r] === "human");
  const on = next.filter((x) => !x.toStart);
  return !on.some((x) => !x.approval && !ticked(x)) && on.some((x) => x.approval ? x.holds : ticked(x));
}

// src/core/session-log.ts
var SESSIONS_DIR = "sessions";
var SESSIONS_GITIGNORE = "*\n";
var isMetStep = (v) => {
  if (typeof v !== "object" || v === null) return false;
  const m = v;
  return typeof m["step"] === "string" && typeof m["at"] === "string" && typeof m["turn"] === "number" && (m["said"] === void 0 || typeof m["said"] === "string") && (m["pressed"] === void 0 || typeof m["pressed"] === "boolean");
};
var safe = (s) => s.replace(/[^A-Za-z0-9._-]+/g, "-");
function logName(host, id) {
  return `${safe(host)}-${safe(id)}.geml`;
}
function legacyLogName(host, id) {
  return `${safe(host)}-${safe(id)}.jsonl`;
}
function isLogName(name, names) {
  if (name.endsWith(".geml")) return true;
  return name.endsWith(".jsonl") && !names.includes(`${name.slice(0, -".jsonl".length)}.geml`);
}
var EVENTS_OPEN = "=== data {#events format=jsonl}";
function isEvent(v) {
  if (typeof v !== "object" || v === null) return false;
  const e = v;
  if (typeof e["at"] !== "string") return false;
  switch (e["t"]) {
    case "session":
      return typeof e["id"] === "string" && typeof e["host"] === "string";
    case "prompt":
    case "answer":
    case "decision":
      return typeof e["turn"] === "number" && typeof e["text"] === "string";
    case "file":
      return typeof e["turn"] === "number" && typeof e["path"] === "string";
    case "commit":
      return typeof e["turn"] === "number" && typeof e["sha"] === "string" && typeof e["subject"] === "string";
    case "item":
      return typeof e["turn"] === "number" && ["id", "flow", "title", "state", "needs", "goal"].every((k) => typeof e[k] === "string") && (e["status"] === "open" || e["status"] === "held" || e["status"] === "done" || e["status"] === "dropped") && (e["met"] === void 0 || Array.isArray(e["met"]) && e["met"].every(isMetStep)) && (e["next"] === void 0 || typeof e["next"] === "string");
    default:
      return false;
  }
}
function parseLog(text) {
  const out = [];
  let lines = text.split(/\r?\n/);
  const open = lines.findIndex((l) => l.trim() === EVENTS_OPEN);
  if (open >= 0) {
    const close = lines.findIndex((l, i) => i > open && l.trim() === "===");
    lines = lines.slice(open + 1, close < 0 ? void 0 : close);
  }
  for (const line of lines) {
    if (line.trim() === "") continue;
    try {
      const v = JSON.parse(line);
      if (isEvent(v)) out.push(v);
    } catch {
    }
  }
  return out;
}
function formatLog(events) {
  return `${EVENTS_OPEN}
${events.map((e) => `${JSON.stringify(e)}
`).join("")}===
`;
}
function appendEvents(text, events) {
  return formatLog([...parseLog(text), ...events]);
}
function nextTurn(events) {
  return events.reduce((n, e) => "turn" in e && e.turn >= n ? e.turn + 1 : n, 1);
}
function currentTurn(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.t === "prompt") return e.turn;
  }
  return 0;
}
function summarize(events) {
  const head = events.find((e) => e.t === "session");
  if (head === void 0) return void 0;
  const s = {
    id: head.id,
    host: head.host,
    ...head.branch !== void 0 ? { branch: head.branch } : {},
    ...head.checkout !== void 0 ? { checkout: head.checkout } : {},
    ...head.backfilled === true ? { backfilled: true } : {},
    ...head.scheduled !== void 0 ? { scheduled: head.scheduled } : {},
    started: head.at,
    last: head.at,
    turns: [],
    decisions: [],
    files: [],
    commits: []
  };
  const turn = (n, at) => {
    let found = s.turns.find((x) => x.turn === n);
    if (found === void 0) {
      found = { turn: n, at, prompt: "", decisions: [] };
      s.turns.push(found);
    }
    return found;
  };
  for (const e of events) {
    if (e.at > s.last) s.last = e.at;
    switch (e.t) {
      case "session":
        break;
      case "prompt": {
        const tn = turn(e.turn, e.at);
        tn.prompt = e.text;
        if (e.uuid !== void 0) tn.uuid = e.uuid;
        if (e.backfilled === true) tn.backfilled = true;
        if (e.kind !== void 0) tn.kind = e.kind;
        break;
      }
      case "answer":
        turn(e.turn, e.at).answer = e.text;
        break;
      case "decision":
        turn(e.turn, e.at).decisions.push(e.text);
        s.decisions.push({ turn: e.turn, at: e.at, text: e.text });
        break;
      case "file":
        if (!s.files.some((f) => f.path === e.path)) s.files.push({ path: e.path, at: e.at, ...e.branch !== void 0 ? { branch: e.branch } : {} });
        break;
      case "commit":
        if (!s.commits.some((c) => c.sha === e.sha)) s.commits.push({ sha: e.sha, subject: e.subject, at: e.at, ...e.branch !== void 0 ? { branch: e.branch } : {} });
        break;
      case "item": {
        s.items = [...(s.items ?? []).filter((x) => x.id !== e.id), e];
        const tn = turn(e.turn, e.at);
        const move = { id: e.id, title: e.title, flow: e.flow, state: e.state, met: (e.met ?? []).filter((m) => m.turn === e.turn), status: e.status, at: e.at };
        tn.moved = [...(tn.moved ?? []).filter((x) => x.id !== e.id), move];
        break;
      }
    }
  }
  s.turns.sort((a, b) => a.turn - b.turn);
  return s;
}
var SAME_PROMPT_MS2 = 3e4;
function withEarlierTurns(events, earlier) {
  const prompts = events.filter((e) => e.t === "prompt");
  const there = (p) => prompts.some((x) => x.text === p.text && Math.abs(Date.parse(x.at) - Date.parse(p.at)) < SAME_PROMPT_MS2);
  const renumbered = /* @__PURE__ */ new Map();
  for (const e of earlier) if (e.t === "prompt" && !there(e)) renumbered.set(e.turn, renumbered.size + 1);
  const k = renumbered.size;
  if (k === 0) return [...events];
  const kept = earlier.flatMap((e) => "turn" in e && renumbered.has(e.turn) ? [{ ...e, turn: renumbered.get(e.turn) }] : []);
  const shifted = events.map((e) => "turn" in e ? { ...e, turn: e.turn + k } : e);
  const head = shifted.findIndex((e) => e.t === "session");
  return head < 0 ? [...kept, ...shifted] : [...shifted.slice(0, head + 1), ...kept, ...shifted.slice(head + 1)];
}
function decisionsSince(sessions, ownId, since, limit = 12) {
  const out = [];
  for (const s of sessions) {
    if (s.id === ownId) continue;
    for (const d of s.decisions) if (since === null || d.at > since) out.push({ text: d.text, at: d.at, session: s.id, host: s.host, ...s.branch !== void 0 ? { branch: s.branch } : {} });
  }
  out.sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0);
  return out.slice(-limit);
}
var NOTE_TOOL = {
  name: "note",
  description: "Record this turn's decisions in the project's shared session record, so the project's other sessions (on other branches, worktrees and tools) know them. A decision is a choice the person made, or you made for them, that changes what comes next; or a finding the other sessions would otherwise discover again. Never status (what was pushed, synced, committed, merged, built, or what a version does), progress or plans: git, the board and the journal hold those. Call it once before the turn ends, each decision a short sentence that stands on its own.",
  inputSchema: {
    type: "object",
    properties: { decisions: { type: "array", items: { type: "string" }, description: "The conclusions and decisions, one short sentence each." } },
    required: ["decisions"],
    additionalProperties: false
  }
};
var SESSIONS_PROMPT = "Gemworks: this project is worked on in several sessions at once, on other branches, worktrees and tools. When a turn reaches a decision the other sessions should know \u2014 a choice the person made that changes what comes next, or a finding they would otherwise discover again \u2014 record it with the gemworks `note` tool before the turn ends, one short sentence each; never status (pushed, synced, committed, what a version does) or plans. Decisions the other sessions recorded arrive beside the person's prompts, marked [gemworks].";
function decisionsContext(decisions, label) {
  return ["[gemworks] \u672C\u9879\u76EE\u5176\u4ED6\u4F1A\u8BDD\u8BB0\u4E0B\u7684\u51B3\u5B9A\uFF1A", ...decisions.map((d) => `- ${d.text}\uFF08${label(d)}\uFF09`)].join("\n");
}

// src/core/transcript.ts
function slugOf(path) {
  return path.replace(/[^A-Za-z0-9-]/g, "-");
}
var str = (v) => typeof v === "string" ? v : void 0;
var blocksOf = (content) => Array.isArray(content) ? content.filter((b) => typeof b === "object" && b !== null) : [];
var textOf2 = (content) => typeof content === "string" ? content : blocksOf(content).filter((b) => b.type === "text").map((b) => str(b.text) ?? "").join("\n");
var resultText = (b) => typeof b.content === "string" ? b.content : blocksOf(b.content).filter((x) => x.type === "text").map((x) => str(x.text) ?? "").join("\n");
function promptWords(text) {
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").replace(/<artifact-content-authored-by-others\/>/g, "").trim();
}
function promptKind(o, words) {
  if (o.isSidechain === true || o.isMeta === true || o.isCompactSummary === true) return void 0;
  const origin = o.origin?.kind;
  if (origin === "task-notification") return void 0;
  if (words === "" || /^<(local-command|command-name|task-notification)/.test(words)) return void 0;
  if (/^The summarized conversation/.test(words) || /^<command-message>/.test(words)) return void 0;
  if (/^<scheduled-task\b/.test(words)) return "scheduled";
  if (origin === "peer") return "peer";
  return "person";
}
function queuedMessages(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes("queued_command")) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.type !== "attachment" || o.isSidechain === true || o.attachment?.type !== "queued_command") continue;
    const uuid = str(o.uuid);
    const words = str(o.attachment.prompt);
    const at = str(o.attachment.timestamp) ?? str(o.timestamp);
    if (uuid !== void 0 && words !== void 0 && at !== void 0) out.push({ uuid, text: words, at });
  }
  return out;
}
function readTranscript(text) {
  let id;
  let started;
  let last;
  let cwd;
  let branch;
  const turns = [];
  const pending = /* @__PURE__ */ new Map();
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof o !== "object" || o === null) continue;
    const at = str(o.timestamp);
    if (at !== void 0) {
      started ??= at;
      last = at;
    }
    id ??= str(o.sessionId);
    const current = turns[turns.length - 1];
    if (o.type === "user") {
      if (o.isSidechain === true) continue;
      const content = o.message?.content;
      const results = blocksOf(content).filter((b) => b.type === "tool_result");
      if (results.length > 0) {
        for (const r of results) {
          const call = pending.get(str(r.tool_use_id) ?? "");
          if (call === void 0) continue;
          pending.delete(str(r.tool_use_id) ?? "");
          if (call.tool === "Artifact") {
            const link = publishedLink(resultText(r));
            const title = str(call.input["title"]);
            if (link !== void 0 && !call.turn.links.some((l) => l.url === link.url && l.version === link.version)) call.turn.links.push({ ...link, ...title !== void 0 ? { title } : {} });
          }
        }
        continue;
      }
      const words = promptWords(textOf2(content));
      const kind = promptKind(o, words);
      if (kind === void 0 || at === void 0) continue;
      const uuid = str(o.uuid) ?? `${at}#${turns.length}`;
      const scheduled = kind === "scheduled" ? /<scheduled-task\b[^>]*\bname="([^"]*)"/.exec(words)?.[1] : void 0;
      const uploads = blocksOf(content).filter((b) => b.type === "image" || b.type === "document").flatMap((b) => {
        const source = b.source;
        const data = str(source?.data);
        return source?.type === "base64" && data !== void 0 && data !== "" ? [{ ...str(source.media_type) !== void 0 ? { mediaType: str(source.media_type) } : {}, data }] : [];
      });
      const turn = {
        uuid,
        at,
        text: words,
        kind,
        ...scheduled !== void 0 ? { scheduled } : {},
        ...str(o.gitBranch) !== void 0 ? { branch: str(o.gitBranch) } : {},
        ...str(o.cwd) !== void 0 ? { cwd: str(o.cwd) } : {},
        files: [],
        links: [],
        uploads
      };
      cwd ??= turn.cwd;
      branch ??= turn.branch;
      turns.push(turn);
      continue;
    }
    if (o.type === "assistant" && current !== void 0 && o.isSidechain !== true) {
      const blocks = blocksOf(o.message?.content);
      const words = blocks.filter((b) => b.type === "text").map((b) => str(b.text) ?? "").join("\n").trim();
      if (words !== "") {
        current.answer = words;
        if (at !== void 0) current.answerAt = at;
      }
      for (const b of blocks) {
        if (b.type !== "tool_use") continue;
        const tool = str(b.name) ?? "";
        const input = typeof b.input === "object" && b.input !== null ? b.input : {};
        if (tool === "Write" || tool === "Edit" || tool === "NotebookEdit") {
          const path = str(input["file_path"]) ?? str(input["notebook_path"]);
          if (path !== void 0 && !current.files.includes(path)) current.files.push(path);
        } else if (tool === "Artifact" && str(b.id) !== void 0) {
          pending.set(str(b.id), { turn: current, tool, input });
        }
      }
    }
  }
  if (turns.length === 0 && id === void 0) return void 0;
  const first = turns[0]?.at ?? started;
  if (first === void 0) return void 0;
  return { id: id ?? "", ...cwd !== void 0 ? { cwd } : {}, ...branch !== void 0 ? { branch } : {}, started: first, last: last ?? first, turns };
}
function transcriptEvents(tr, host, o) {
  const out = [];
  const scheduled = tr.turns[0]?.kind === "scheduled" ? tr.turns[0].scheduled ?? "" : void 0;
  if (o.head) out.push({ t: "session", id: tr.id, host, at: tr.started, ...tr.branch !== void 0 ? { branch: tr.branch } : {}, ...tr.cwd !== void 0 ? { checkout: tr.cwd } : {}, backfilled: true, ...scheduled !== void 0 ? { scheduled } : {} });
  let n = o.from ?? 1;
  for (const turn of tr.turns) {
    out.push({ t: "prompt", turn: n, at: turn.at, text: turn.text, uuid: turn.uuid, backfilled: true, ...turn.kind !== "person" ? { kind: turn.kind } : {} });
    if (turn.answer !== void 0) out.push({ t: "answer", turn: n, at: turn.answerAt ?? turn.at, text: turn.answer });
    for (const path of turn.files) out.push({ t: "file", turn: n, at: turn.at, path, ...turn.branch !== void 0 ? { branch: turn.branch } : {} });
    n += 1;
  }
  return out;
}
function newTurns(tr, events) {
  const seen = new Set(events.flatMap((e) => e.t === "prompt" && e.uuid !== void 0 ? [e.uuid] : []));
  return { ...tr, turns: tr.turns.filter((turn) => !seen.has(turn.uuid)) };
}

// src/session-store.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync4, readdirSync as readdirSync2, readFileSync as readFileSync4, unlinkSync as unlinkSync3, writeFileSync as writeFileSync4 } from "node:fs";
import { basename as basename4, join as join7, resolve as resolve2 } from "node:path";
function sessionsDirOf(root) {
  return join7(journalBaseOf(root), GEML_DIR, SESSIONS_DIR);
}
function appendSession(root, host, id, make, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const dir = sessionsDirOf(root);
  const path = join7(dir, logName(host, id));
  let text = "";
  try {
    text = readFileSync4(path, "utf8");
  } catch {
    try {
      text = readFileSync4(join7(dir, legacyLogName(host, id)), "utf8");
    } catch {
      text = "";
    }
  }
  const events = parseLog(text);
  const head = [];
  if (!events.some((e) => e.t === "session")) {
    const branch = repoFacts(root).branch;
    head.push({ t: "session", id, host, at: now, ...branch !== void 0 ? { branch } : {}, checkout: root });
    mkdirSync4(dir, { recursive: true });
    const ignore = join7(dir, ".gitignore");
    if (!existsSync4(ignore)) writeFileSync4(ignore, SESSIONS_GITIGNORE, "utf8");
  }
  const added = [...head, ...make([...events, ...head])];
  if (added.length > 0) writeFileSync4(path, appendEvents(text, added), "utf8");
  return [...events, ...added];
}
function readSessions(root) {
  const dir = sessionsDirOf(root);
  let names;
  try {
    const all = readdirSync2(dir);
    names = all.filter((n) => isLogName(n, all));
  } catch {
    return [];
  }
  const out = [];
  for (const n of names) {
    try {
      const s = summarize(parseLog(readFileSync4(join7(dir, n), "utf8")));
      if (s !== void 0) out.push(s);
    } catch {
    }
  }
  return out;
}
function samePath2(a, b) {
  const x = resolve2(a), y = resolve2(b);
  return process.platform === "win32" ? x.toLowerCase() === y.toLowerCase() : x === y;
}
function latestSessionOf(root, host) {
  const byLast2 = (a, b) => a.last < b.last ? 1 : a.last > b.last ? -1 : 0;
  const theirs = readSessions(root).filter((s) => s.host === host).sort(byLast2);
  return (theirs.find((s) => s.checkout !== void 0 && samePath2(s.checkout, root)) ?? theirs[0])?.id;
}
function recordPrompt(root, host, id, text, now = (/* @__PURE__ */ new Date()).toISOString()) {
  appendSession(root, host, id, (events) => [{ t: "prompt", turn: nextTurn(events), at: now, text }], now);
}
function recordDecisions(root, host, id, decisions, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const given = decisions.map((d) => d.trim()).filter((d) => d !== "");
  if (given.length > 0) appendSession(root, host, id, (events) => given.map((text) => ({ t: "decision", turn: currentTurn(events), at: now, text })), now);
  return given.length;
}
function recordFile2(root, host, id, path, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const branch = repoFacts(root).branch;
  appendSession(root, host, id, (events) => events.some((e) => e.t === "file" && e.path === path) ? [] : [{ t: "file", turn: currentTurn(events), at: now, path, ...branch !== void 0 ? { branch } : {} }], now);
}
function recordAnswer(root, host, id, answer2, committed, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const events = appendSession(root, host, id, (so) => answer2.trim() === "" ? [] : [{ t: "answer", turn: currentTurn(so), at: now, text: answer2 }], now);
  if (!committed) return;
  const asked = [...events].reverse().find((e) => e.t === "prompt");
  if (asked === void 0) return;
  const branch = repoFacts(root).branch;
  const commits2 = commitsOf(root, { since: asked.at });
  appendSession(root, host, id, (so) => commits2.filter((c) => !so.some((e) => e.t === "commit" && e.sha === c.sha)).map((c) => ({ t: "commit", turn: currentTurn(so), at: c.at, sha: c.sha, subject: c.subject, ...branch !== void 0 ? { branch } : {} })), now);
}
function decisionsFor(root, id, since, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const from = since ?? new Date(Date.parse(now) - 3 * 24 * 60 * 60 * 1e3).toISOString();
  return decisionsSince(readSessions(root), id, from);
}
var OPEN_MS = 5 * 6e4;
var OPEN_KEPT_MS = 24 * 60 * 6e4;
function markOpen(root, host, id, now = /* @__PURE__ */ new Date()) {
  const logs = sessionsDirOf(root);
  const dir = join7(logs, "open");
  const mine = `${logName(host, id).replace(/\.geml$/, "")}.json`;
  const branch = repoFacts(root).branch;
  try {
    mkdirSync4(dir, { recursive: true });
    if (!existsSync4(join7(logs, ".gitignore"))) writeFileSync4(join7(logs, ".gitignore"), SESSIONS_GITIGNORE, "utf8");
    writeFileSync4(join7(dir, mine), JSON.stringify({ id, host, checkout: root, ...branch !== void 0 ? { branch } : {}, at: now.toISOString() }), "utf8");
  } catch {
  }
  let names;
  try {
    names = readdirSync2(dir).filter((n) => n.endsWith(".json") && n !== mine);
  } catch {
    return [];
  }
  const out = [];
  for (const n of names) {
    let s;
    try {
      s = JSON.parse(readFileSync4(join7(dir, n), "utf8"));
    } catch {
      continue;
    }
    const age = now.getTime() - Date.parse(s.at);
    if (age > OPEN_KEPT_MS) {
      try {
        unlinkSync3(join7(dir, n));
      } catch {
      }
      continue;
    }
    if (age <= OPEN_MS && typeof s.id === "string" && s.id !== id && typeof s.checkout === "string") out.push(s);
  }
  return out.sort((a, b) => a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
}
function branchesElsewhere(open, own) {
  const out = [];
  for (const s of open) {
    if (s.branch === void 0 || s.branch === own || out.some((x) => x.branch === s.branch)) continue;
    out.push({ branch: s.branch, where: basename4(s.checkout) || s.checkout });
  }
  return out;
}
function hostLabel(host) {
  return { "claude-code": "Claude", codex: "Codex", gemini: "Gemini", dsh: "DeepSeek", pi: "pi" }[host] ?? host;
}
function commits(command) {
  return /\bgit\b[^\n|;&]*\bcommit\b/.test(command);
}

// src/bridge.ts
import { statSync as statSync5 } from "node:fs";

// src/media-todo.ts
import { parse as parse4 } from "./vendor/geml/geml.js";
import { profileIoFor } from "./vendor/geml/host-fs.js";
import { todo } from "./vendor/geml/media-verbs.js";

// src/hosts/claude-code/protocol.ts
var PROTOCOL_VERSION = 1;
var TODO_CAP = 999;
var OPS = /* @__PURE__ */ new Set(["status", "refresh", "before", "after", "verb", "learn", "mark", "advance", "pause", "resume", "rollback", "new-item", "bind", "use", "add", "import", "board", "made", "attention", "export", "artifacts", "artifact", "backfill-list", "backfill-one", "turn-ids", "memory", "memory-set", "memory-delete", "practices", "practice-add", "practice-set", "practice-share", "corrections", "corrections-add", "corrections-themes", "corrections-dismiss"]);
var EXPORT_KINDS = /* @__PURE__ */ new Set(["journal", "workflow", "text"]);
var EXPORT_FORMATS = /* @__PURE__ */ new Set(["geml", "md", "json"]);
var VERBS = /* @__PURE__ */ new Set(["status", "move", "set"]);
function isLesson(v) {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const l = v;
  if (typeof l["key"] !== "string" || l["key"] === "") return false;
  switch (l["kind"]) {
    case "allow":
    case "deny":
      return typeof l["where"] === "string" && l["where"] !== "";
    case "use":
    case "default":
      return typeof l["use"] === "string" && l["use"] !== "";
    case "params":
      return typeof l["params"] === "object" && l["params"] !== null && !Array.isArray(l["params"]);
    case "forget":
      return true;
    default:
      return false;
  }
}
function decodeRequest(text) {
  let v;
  try {
    v = JSON.parse(text);
  } catch {
    return { error: "the request is not JSON" };
  }
  if (v === null || typeof v !== "object" || Array.isArray(v)) return { error: "the request is not an object" };
  if (v["v"] !== PROTOCOL_VERSION) return { error: `protocol version ${String(v["v"])}; this CLI speaks ${PROTOCOL_VERSION}` };
  if (typeof v["root"] !== "string" || v["root"] === "") return { error: "root is required" };
  const op = v["op"];
  if (typeof op !== "string" || !OPS.has(op)) return { error: `unknown op ${String(op)}` };
  const str2 = (k) => typeof v[k] === "string";
  const isRecord = (x) => typeof x === "object" && x !== null && !Array.isArray(x);
  const obj = (k) => isRecord(v[k]);
  const cwd = () => v["cwd"] === void 0 || str2("cwd") && v["cwd"] !== "";
  const fields = {
    before: () => str2("tool") && str2("callId") && obj("input") && cwd() && (v["waived"] === void 0 || Array.isArray(v["waived"]) && v["waived"].every((k) => typeof k === "string")),
    after: () => str2("tool") && str2("callId") && obj("input") && typeof v["isError"] === "boolean" && typeof v["gitOperation"] === "boolean" && cwd(),
    verb: () => str2("name") && VERBS.has(v["name"]) && obj("args"),
    learn: () => Array.isArray(v["lessons"]) && v["lessons"].every(isLesson) && str2("tool") && obj("input") && cwd(),
    mark: () => str2("variable") && typeof v["checked"] === "boolean",
    advance: () => str2("to"),
    rollback: () => Number.isInteger(v["rev"]) && v["rev"] >= 0,
    "new-item": () => str2("path") && v["path"] !== "" && str2("title") && str2("text"),
    bind: () => str2("id"),
    use: () => str2("workflow"),
    import: () => str2("path") && v["path"] !== "",
    export: () => EXPORT_KINDS.has(v["kind"]) && EXPORT_FORMATS.has(v["format"]) && (v["name"] === void 0 || str2("name")) && (v["text"] === void 0 || str2("text")) && (v["strip"] === void 0 || typeof v["strip"] === "boolean") && (v["to"] === void 0 || str2("to") && v["to"] !== "") && (v["kind"] !== "text" || str2("text")),
    artifact: () => (v["kind"] === "link" || v["kind"] === "image" || v["kind"] === "file") && str2("where") && (v["name"] === void 0 || str2("name")) && (v["version"] === void 0 || str2("version")) && (v["page"] === void 0 || str2("page")) && (v["data"] === void 0 || str2("data")) && (v["mediaType"] === void 0 || str2("mediaType")),
    artifacts: () => (v["elsewhere"] === void 0 || Array.isArray(v["elsewhere"]) && v["elsewhere"].every((p) => typeof p === "string")) && (v["notMade"] === void 0 || Array.isArray(v["notMade"]) && v["notMade"].every((p) => typeof p === "string")),
    attention: () => v["session"] === void 0 || str2("session") && v["session"] !== "",
    "backfill-list": () => v["transcripts"] === void 0 || str2("transcripts"),
    "backfill-one": () => str2("file") && v["file"] !== "" && (v["own"] === void 0 || typeof v["own"] === "boolean") && (v["transcripts"] === void 0 || str2("transcripts")),
    "turn-ids": () => str2("session") && v["session"] !== "" && (v["transcripts"] === void 0 || str2("transcripts")),
    memory: () => v["transcripts"] === void 0 || str2("transcripts"),
    "memory-set": () => str2("file") && v["file"] !== "" && str2("hook") && (v["transcripts"] === void 0 || str2("transcripts")),
    "memory-delete": () => str2("file") && v["file"] !== "" && (v["transcripts"] === void 0 || str2("transcripts")),
    "practice-add": () => Array.isArray(v["practices"]) && v["practices"].every((x) => typeof x === "object" && x !== null && !Array.isArray(x)) && (v["memory"] === void 0 || typeof v["memory"] === "boolean"),
    "practice-share": () => Array.isArray(v["ids"]) && v["ids"].every((x) => typeof x === "string"),
    "practice-set": () => str2("id") && v["id"] !== "" && (v["deleted"] === void 0 || typeof v["deleted"] === "boolean") && (v["layer"] === void 0 || v["layer"] === "personal" || v["layer"] === "project") && (v["everywhere"] === void 0 || typeof v["everywhere"] === "boolean"),
    corrections: () => (v["toTheme"] === void 0 || typeof v["toTheme"] === "boolean") && (v["session"] === void 0 || str2("session")),
    "corrections-add": () => Array.isArray(v["prompts"]) && v["prompts"].every(isRecord),
    "corrections-themes": () => obj("answer") && Array.isArray(v["answer"]["assign"]) && Array.isArray(v["answer"]["links"]) && str2("linked"),
    "corrections-dismiss": () => str2("key") && v["key"] !== "" && Number.isInteger(v["n"])
  };
  const check = fields[op];
  if (check !== void 0 && !check()) return { error: `op ${op}: missing or mistyped fields` };
  if ((op === "before" || op === "after" || op === "learn") && v["cwd"] === void 0) return { ...v, cwd: v["root"] };
  return v;
}

// src/media-todo.ts
var MEDIA_PROFILE = "geml-media/v1";
var TODO_BUDGET_MS = 1e4;
function declaresMedia(source) {
  const meta = parse4(source).children.find((b) => b.kind === "block" && b.type === "meta");
  const profile = meta && meta.kind === "block" && meta.data ? meta.data["profile"] : void 0;
  return typeof profile === "string" && profile.split(/\s+/).includes(MEDIA_PROFILE);
}
var OverBudget = class extends Error {
};
function mediaTodoCount(root, file, opts = {}) {
  const io = profileIoFor(root);
  const source = io.readDoc(file);
  if (source === null || !declaresMedia(source)) return void 0;
  const deadline = Date.now() + (opts.budgetMs ?? TODO_BUDGET_MS);
  const inBudget = () => {
    if (Date.now() >= deadline) throw new OverBudget();
  };
  const timed = {
    readDoc: (rel) => {
      inBudget();
      return io.readDoc(rel);
    },
    hashFile: (rel) => {
      inBudget();
      return io.hashFile(rel);
    },
    hashText: (text) => io.hashText(text)
  };
  try {
    const n = todo([file], timed).length;
    inBudget();
    return Math.min(n, TODO_CAP + 1);
  } catch {
    return void 0;
  }
}

// src/project.ts
import { readdirSync as readdirSync3, statSync as statSync4 } from "node:fs";
import { basename as basename5, dirname as dirname4, join as join8, resolve as resolve3 } from "node:path";
import { fileURLToPath } from "node:url";
var BUNDLED = fileURLToPath(new URL("../workflows/", import.meta.url));
function bundledWorkflows() {
  return readdirSync3(BUNDLED, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
}
var DEPLOY_FILES = ["wrangler.toml", "wrangler.json", "wrangler.jsonc", "fly.toml", "vercel.json", "netlify.toml", "render.yaml", "app.yaml", "Dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yaml"];
var CODE_FILES = ["package.json", "Cargo.toml", "pyproject.toml", "setup.py", "go.mod", "pom.xml", "build.gradle", "build.gradle.kts", "Gemfile", "mix.exs", "CMakeLists.txt", "Makefile"];
function suggestWorkflow(root) {
  let names;
  try {
    names = readdirSync3(root);
  } catch {
    return { workflow: "dev", by: "default" };
  }
  const has = (n) => names.includes(n);
  const isDir = (p) => {
    try {
      return statSync4(p).isDirectory();
    } catch {
      return false;
    }
  };
  if (has("episodes") && isDir(join8(root, "episodes"))) return { workflow: "video", by: "media", file: "episodes/" };
  for (const n of names) {
    if (!n.endsWith(".geml")) continue;
    let head = "";
    try {
      head = readText(join8(root, n)).slice(0, 2e3);
    } catch {
      continue;
    }
    if (/^profile\s*=\s*"geml-media\/v1"/m.test(head)) return { workflow: "video", by: "media", file: n };
  }
  const deploy = DEPLOY_FILES.find(has);
  if (deploy !== void 0) return { workflow: "dev", by: "deploy", file: deploy };
  const code = CODE_FILES.find(has) ?? names.find((n) => n.endsWith(".sln") || n.endsWith(".csproj"));
  if (code !== void 0) return { workflow: "coding", by: "code", file: code };
  return { workflow: "dev", by: "default" };
}
function projectWorkflows(root) {
  return installedWorkflows(root).map((w) => w.name);
}
function configText(name) {
  return ["=== meta", 'title         = "Gemworks"', `flow-workflow = ${JSON.stringify(name)}`, "===", ""].join("\n");
}
function setDefault(root, home, name) {
  const doc = projectDocOf(root, home);
  const text = doc === void 0 ? void 0 : withItemState(readText(doc), "flow-workflow", name);
  writeAtomic(join8(home, PROJECT_DOC), text ?? configText(name));
}
var usesOf = (sc) => new Set([...sc.states.values()].flatMap((s) => s.uses));
function addWorkflow(root, name, o) {
  const names = bundledWorkflows();
  if (!names.includes(name)) return { ok: false, code: 2, reason: `unknown template "${name}"; expected ${names.join(" or ")}` };
  const home = homeOf(root);
  const target = join8(home, WORKFLOWS_DIR, `${name}.geml`);
  if (installedWorkflows(root, home).some((w) => w.name === name)) return { ok: false, code: 1, reason: `${WORKFLOWS_DIR}/${name}.geml already exists; not overwriting`, target };
  const dir = join8(BUNDLED, name);
  writeWorkflow(home, name, mergedWorkflow(name, readText(join8(dir, FLOW_FILE)), (f) => readIn(dir, f)));
  const tools = readIn(dir, TOOLS_FILE);
  if (tools !== void 0) mergeTools(home, tools);
  if (o.activate) setDefault(root, home, name);
  ensureGitignore(join8(home, GEML_DIR));
  return { ok: true, name, target, activated: o.activate };
}
function importWorkflow(root, path) {
  const given = resolve3(root, path);
  let dir, flow, name;
  if (exists(given) && statSync4(given).isDirectory()) {
    dir = given;
    flow = join8(dir, FLOW_FILE);
    name = basename5(dir);
  } else if (/\.geml$/i.test(given)) {
    flow = given;
    dir = dirname4(given);
    name = basename5(given).toLowerCase() === FLOW_FILE ? basename5(dir) : basename5(given).replace(/\.geml$/i, "");
  } else return { ok: false, reason: `${path} is neither a workflow directory nor a .geml file` };
  if (!exists(flow)) return { ok: false, reason: `${path} has no ${FLOW_FILE}` };
  if (!/^[\p{L}\p{N}._-]+$/u.test(name) || name.startsWith(".")) return { ok: false, reason: `"${name}" cannot name a workflow` };
  const loaded = loadStatechart(readText(flow), flow);
  const errors = loaded.diagnostics.filter((d) => d.severity === "error");
  if (loaded.statechart === void 0 || errors.length > 0) return { ok: false, reason: `${path} does not load: ${errors.map((d) => d.message).join("; ") || "no statechart"}` };
  const home = homeOf(root);
  const installed = installedWorkflows(root, home);
  const target = join8(home, WORKFLOWS_DIR, `${name}.geml`);
  if (installed.some((w) => w.name === name)) return { ok: false, reason: `${WORKFLOWS_DIR}/${name}.geml already exists; not overwriting` };
  const activate = installed.length === 0 && projectDocOf(root, home) === void 0;
  writeWorkflow(home, name, mergedWorkflow(name, readText(flow), (f) => readIn(dir, f)));
  const dict = dictionaryPathOf(flow);
  if (exists(dict)) mergeTools(home, readText(dict), basename5(flow).toLowerCase() === FLOW_FILE ? void 0 : usesOf(loaded.statechart));
  if (activate) setDefault(root, home, name);
  ensureGitignore(join8(home, GEML_DIR));
  return { ok: true, name, target, activated: activate };
}
function useWorkflow(root, name) {
  const have = projectWorkflows(root);
  if (!have.includes(name)) return { ok: false, reason: `no workflow "${name}" in ${WORKFLOWS_DIR} (have: ${have.join(", ") || "none"})` };
  setDefault(root, homeOf(root), name);
  return { ok: true };
}

// src/timeline.ts
var ORDER = { snapshot: 0, refused: 1 };
function changedVars(prev, s) {
  const out = {};
  for (const [k, v] of Object.entries(s.vars)) if (prev === void 0 || canonical(prev.vars[k] ?? null) !== canonical(v)) out[k] = v;
  return Object.keys(out).length > 0 ? out : void 0;
}
function timelineOf(j) {
  const sorted = [...j.snapshots].sort((a, b) => a.rev - b.rev);
  const entries = [
    ...sorted.map((s, i) => {
      const changed = changedVars(sorted[i - 1], s);
      return {
        kind: "snapshot",
        rev: s.rev,
        at: s.at,
        state: s.state,
        cause: s.cause,
        ...s.by ? { by: s.by } : {},
        ...s.signal ? { signal: s.signal } : {},
        ...s.from !== void 0 ? { from: s.from } : {},
        ...s.restores !== void 0 ? { restores: s.restores } : {},
        ...s.call !== void 0 ? { call: s.call } : {},
        ...s.tree !== void 0 ? { tree: s.tree } : {},
        ...changed !== void 0 ? { changed } : {}
      };
    }),
    ...j.refusals.map((r) => ({ kind: "refused", n: r.n, rev: r.rev, at: r.at, tool: r.tool, reason: r.reason, ...r.call !== void 0 ? { call: r.call } : {}, ...r.key !== void 0 ? { key: r.key } : {} }))
  ];
  return entries.sort((a, b) => a.rev - b.rev || ORDER[a.kind] - ORDER[b.kind]);
}

// src/core/picture.ts
import { flowOf, statechartSvg } from "./vendor/geml/statechart-svg.js";
function flowOverlay(p) {
  const ov = {};
  const st = p.status;
  if (st !== null && st.item.kind === "item" && st.state !== void 0) {
    ov.current = st.state.id;
    const holds = Object.fromEntries(st.next.filter((n) => n.reads.length > 0).map((n) => [n.name, n.holds]));
    if (Object.keys(holds).length > 0) ov.holds = holds;
    if (st.paused) ov.paused = true;
    else {
      const pressable = st.next.filter((n) => n.holds).map((n) => n.name);
      if (pressable.length > 0) ov.pressable = pressable;
    }
  }
  const counts = {};
  for (const it of p.items) counts[it.state] = (counts[it.state] ?? 0) + 1;
  if (Object.keys(counts).length > 0) ov.counts = counts;
  for (let i = p.timeline.length - 1; i >= 0; i--) {
    const e = p.timeline[i];
    if (e === void 0 || e.kind !== "snapshot" || e.cause !== "transition" || e.from === void 0) continue;
    const name = `${e.from}\u2192${e.state}`;
    const hit = p.sc.transitions.find((t) => t.name === name || t.name.startsWith(`${name}[`));
    if (hit !== void 0) ov.taken = [hit.name];
    break;
  }
  return ov;
}
function flowPicture(p) {
  const overlay = flowOverlay(p);
  return { flow: flowOf(p.sc.model), overlay, svg: statechartSvg(p.sc.model, { key: "flow", direction: "down", overlay }) };
}

// src/verbs.ts
function statusForModel(s) {
  const lines = [`[gemworks] workflow ${s.workflow.name} (${s.workflow.path})`];
  if (s.item.kind === "inactive") {
    lines.push(`not tracking: ${s.item.reason}`);
    return lines.join("\n");
  }
  lines.push(`work item ${s.item.id} \xB7 state ${s.state?.id ?? "?"} \xB7 rev ${s.state?.rev ?? 0}`);
  const vars = Object.entries(s.vars).map(([k, v]) => `${k}=${JSON.stringify(v)}${s.sources[k] !== void 0 ? ` (${s.sources[k]})` : ""}`);
  lines.push(`variables: ${vars.length ? vars.join(", ") : "none"}`);
  const next = s.next.map((t) => {
    const who = t.approval ? "a person approves it" : t.judge === "machine" ? "on its own" : "by move";
    const guard = t.guard !== void 0 ? `, when ${t.guard}${t.judge === "machine" ? ` (${t.holds ? "holds" : `does not hold: ${t.missing.join(", ")}`})` : ""}` : "";
    return `${t.to} ${who}${guard}`;
  });
  lines.push(`next: ${next.length ? next.join("; ") : "none (final state)"}`);
  if (s.paused) lines.push("paused: a person holds this work item; evidence is recorded, no transition is taken until they resume it (gemworks resume)");
  if (s.gh !== void 0 && !s.gh.available) lines.push(`git evidence unavailable: ${s.gh.reason}`);
  lines.push(`refusals ${s.refusals}`);
  return lines.join("\n");
}
var NO_STAGE_CONTEXT = "[gemworks] no stage context yet";
var APPROVAL_HINT = " \u2014 a person approves it on the Gemworks board (/gemworks board) or with `gemworks advance <state>`";
function runVerb(ws, name, args, callId) {
  switch (name) {
    case "status":
      return { ok: true, text: `${statusForModel(ws.status())}

${ws.context() ?? NO_STAGE_CONTEXT}` };
    default: {
      const r = ws.verb(name, args, callId);
      if (r.ok) return { ok: true, text: JSON.stringify(r.result), ...r.context !== void 0 ? { context: r.context } : {} };
      return { ok: false, text: `refused: ${r.reason}${/needs a person/.test(r.reason) ? APPROVAL_HINT : ""}` };
    }
  }
}

// src/bridge.ts
function ghFor(req) {
  if (req.op === "after" && req.gitOperation) return ghOncePerBranch({ fresh: true });
  if (req.op === "refresh" || req.op === "board") return ghOncePerBranch();
  const seen = req.gh ?? { available: true };
  return () => seen.available ? { available: true } : { available: false, reason: seen.reason };
}
function contextKey(root) {
  let text;
  try {
    text = readText(join9(root, CONTEXT_DOC));
  } catch {
    return null;
  }
  const doc = readContextDoc(text);
  return doc ? `${doc.item}@${doc.rev}` : null;
}
var gemworksVersion = /* @__PURE__ */ (() => {
  let read;
  return () => {
    if (read === void 0) {
      try {
        read = JSON.parse(readFileSync5(new URL("../package.json", import.meta.url), "utf8")).version ?? "";
      } catch {
        read = "";
      }
    }
    return read;
  };
})();
function localeOf() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return void 0;
  }
}
function shellOf(view, root) {
  const locale = localeOf();
  const units = unitsOf(root, view);
  return { status: view.status, policy: view.policy, contextKey: contextKey(root), ...locale !== void 0 ? { locale } : {}, versions: { gemworks: gemworksVersion(), parser: PARSER_VERSION }, ...units.length > 0 ? { units } : {} };
}
function unitsOf(root, view) {
  const wf = resolveWorkflow(root);
  if ("error" in wf) return view.policy.unit.kind === "file" ? [view.policy.unit.glob] : [];
  const own = fileUnitOf(wf.path);
  return [.../* @__PURE__ */ new Set([...own !== void 0 ? [own] : [], ...sideFlows(root, wf.path).map((f) => f.glob), ...view.policy.unit.kind === "file" ? [view.policy.unit.glob] : []])];
}
function problemShell(text, quiet) {
  return { status: null, policy: null, contextKey: null, problem: { text, quiet }, versions: { gemworks: gemworksVersion(), parser: PARSER_VERSION } };
}
function notOpened(opened, root) {
  const shell = problemShell(opened.reason, opened.kind === "none");
  return opened.kind === "none" ? { ...shell, suggest: suggestWorkflow(root) } : shell;
}
function openFor(req) {
  return openWorkspace({
    root: req.root,
    tools: CLAUDE_CODE_TOOLS,
    gh: ghFor(req),
    ...req.lastFile !== void 0 ? { lastFile: req.lastFile } : {}
  });
}
function attributionFor(req, ws) {
  const gh = ghFor(req);
  return new Attribution(ws, (o) => {
    const opened = loadWorkspace({ tools: CLAUDE_CODE_TOOLS, gh, lazy: true, ...o });
    return opened.ok ? opened.ws : void 0;
  }, CLAUDE_CODE_TOOLS);
}
function shellAt(req) {
  const opened = openFor(req);
  return opened.ok ? shellOf(opened.ws.view(), req.root) : notOpened(opened, req.root);
}
function bindHere(ws, root, id) {
  const item = ws.item;
  if (item.kind !== "item") return { ok: false, reason: item.reason };
  const path = join9(root, BACKLOG_DOC);
  if (!exists(path)) return { ok: false, reason: `no ${BACKLOG_DOC}` };
  return withLock(path, () => {
    const source = readText(path);
    const r = bindInDocument(source, id, item.id);
    if (!r.ok) return r;
    if (r.text !== source) writeAtomic(path, r.text);
    return { ok: true };
  });
}
var fileSafe = (s) => s.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "") || "item";
function stripPaths(text, root) {
  let out = text;
  for (const dir of [root, homedir3()]) {
    const mark = dir === root ? "." : "~";
    for (const form of /* @__PURE__ */ new Set([dir, dir.split("\\").join("/"), dir.split("/").join("\\")])) if (form !== "") out = out.split(form).join(mark);
  }
  return out;
}
function exportOf(ws, root, req, now) {
  const stamp = now.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const item = ws.item.kind === "item" ? fileSafe(ws.item.id) : "no-item";
  const given = req.name !== void 0 ? fileSafe(basename6(req.name.split("\\").join("/"))) : void 0;
  const ext = `.${req.format}`;
  const to = req.to === void 0 ? void 0 : resolve4(root, req.to.replace(/^~(?=$|[\\/])/, homedir3()));
  const folder = to === void 0 || req.kind === "workflow" || extname(to) === "" || exists(to) && statSync5(to).isDirectory();
  const file = folder ? void 0 : `${to.slice(0, to.length - extname(to).length)}${ext}`;
  const dir = file !== void 0 ? dirname5(file) : to ?? join9(root, EXPORTS_DIR);
  const free = (path) => {
    const stem = path.slice(0, path.length - extname(path).length);
    let out = path;
    for (let n = 2; exists(out); n++) out = `${stem}-${n}${extname(path)}`;
    return out;
  };
  const named = (fallback) => {
    const name2 = given ?? fallback;
    return name2.endsWith(ext) ? name2 : `${name2}${ext}`;
  };
  const shown = (path) => {
    const rel = relative4(root, path);
    return (rel === "" || rel === ".." || rel.startsWith(`..${sep4}`) || isAbsolute3(rel) ? path : rel).split("\\").join("/");
  };
  const write = (name2, text2) => {
    const out = req.strip === true ? stripPaths(text2, root) : text2;
    const target2 = free(file ?? join9(dir, name2));
    mkdirSync5(dirname5(target2), { recursive: true });
    writeAtomic(target2, out);
    return { ok: true, path: shown(target2), text: out };
  };
  if (req.kind === "text") return write(named(`share-${item}-${stamp}`), req.text ?? "");
  if (req.kind === "journal") {
    const path = ws.journalPath;
    if (path === void 0 || !exists(path)) return { ok: false, reason: ws.item.kind === "item" ? `${ws.item.id} has no journal yet` : ws.item.reason };
    const source = readText(path);
    const text2 = req.format === "geml" ? source : req.format === "md" ? renderJournalMarkdown(readJournal(source)) : JSON.stringify(readJournal(source), null, 2);
    return write(named(`journal-${item}-${stamp}`), text2);
  }
  const name = given ?? `workflow-${fileSafe(ws.workflowName)}-${stamp}`;
  const target = join9(dir, name);
  mkdirSync5(dir, { recursive: true });
  const noHistory = (src) => !/[\\/]\.gemlhistory([\\/]|$)/.test(src);
  const text = readText(ws.workflowPath);
  if (basename6(ws.workflowPath).toLowerCase() === FLOW_FILE) {
    cpSync(ws.workflowDir, target, { recursive: true, filter: noHistory });
    return { ok: true, path: shown(target), text };
  }
  writeAtomic(join9(target, FLOW_FILE), text);
  const kept = join9(ws.workflowDir, ws.workflowName);
  if (exists(kept)) cpSync(kept, join9(target, ws.workflowName), { recursive: true, filter: noHistory });
  const uses = new Set([...ws.sc.states.values()].flatMap((st) => st.uses));
  writeAtomic(join9(target, TOOLS_FILE), renderDictionary(ws.dictionary().rows.filter((r) => r.for === void 0 || uses.has(r.for))));
  return { ok: true, path: shown(target), text };
}
function listItems(ws, root, workflowFile, prs) {
  const dir = ws.journalsDir;
  if (!exists(dir)) return [];
  const wf = resolveWorkflow(root);
  const home = ws.journalBase;
  const defaultFile = "error" in wf ? void 0 : recordedPath(root, home, wf.path);
  const fileOf = (recorded) => recorded === "" ? void 0 : workflowAt(root, home, recorded);
  const same = (recorded, file) => {
    const at = fileOf(recorded);
    return file !== void 0 && at !== void 0 && resolve4(at) === resolve4(file);
  };
  const out = [];
  const entries = [];
  const flows = /* @__PURE__ */ new Map([[workflowFile, { sc: ws.sc, title: ws.title }]]);
  for (const e of readdirSync4(dir, { withFileTypes: true, recursive: true })) {
    if (!e.isFile() || !e.name.endsWith(".geml")) continue;
    const full = join9(e.parentPath, e.name);
    const journal = readJournal(readText(full));
    const last = journal.snapshots.at(-1);
    if (!last) continue;
    const under = journal.meta.workflow;
    const workflow = under !== "" && under !== defaultFile && !same(under, "error" in wf ? void 0 : wf.path) ? workflowNameOf(root, fileOf(under) ?? under) : void 0;
    const id = relative4(dir, full).split("\\").join("/").replace(/\.geml$/, "");
    const recorded = (under === "" ? defaultFile : under) ?? "";
    const own = same(recorded, ws.workflowPath) ? workflowFile : recorded;
    const ownFile = own === workflowFile ? void 0 : fileOf(own);
    const glob = own === workflowFile ? ws.sc.unit.kind === "file" ? ws.sc.unit.glob : "" : ownFile !== void 0 ? fileUnitOf(ownFile) ?? "" : "";
    const file = ws.fileOfItem(id, glob);
    const paused = isPaused(journal.snapshots);
    let title;
    let gist;
    let about;
    let by;
    let depends = [];
    if (file !== void 0) {
      try {
        const source = readText(join9(root, file));
        title = itemState(source, "title");
        gist = gistOf(source);
        about = itemState(source, "about");
        by = itemState(source, "by");
        depends = dependsOf(source);
      } catch {
        title = void 0;
      }
    }
    const progress = itemProgress(root, ws.journalBase, id, flows, defaultFile ?? "");
    const flow = own === workflowFile ? { sc: ws.sc } : flows.get(own) ?? null;
    const sc = flow?.sc;
    const ways = sc !== void 0 && !paused && sc.states.get(last.state)?.final !== true ? outgoing(sc, last.state).map((t) => ({ t, approval: t.approval, holds: guardHolds(sc, t, last.vars), judge: t.judge, reads: t.reads, toStart: t.to === sc.initial })) : [];
    const asks = sc !== void 0 && waitsOnPerson(ways, sources(sc)) ? ways.filter((w) => w.approval && w.holds).map(({ t }) => ({
      to: t.to,
      label: t.label ?? sc.states.get(t.to)?.title ?? t.to,
      note: t.note,
      final: sc.states.get(t.to)?.final === true
    })) : [];
    entries.push({
      id,
      kind: glob !== "" ? "file" : "branch",
      state: last.state,
      final: progress?.final === true || sc?.states.get(last.state)?.final === true,
      flow: own === workflowFile ? ws.workflowName : ownFile !== void 0 ? workflowNameOf(root, ownFile) : "",
      stage: last.state,
      since: (progress?.since ?? journal.meta.created).slice(0, 10),
      last: last.at.slice(0, 10)
    });
    out.push({
      id,
      state: last.state,
      rev: last.rev,
      at: last.at,
      paused,
      ...workflow !== void 0 ? { workflow } : {},
      ...file !== void 0 ? { file } : {},
      ...title !== void 0 && title !== "" ? { title } : {},
      ...gist !== void 0 ? { gist } : {},
      ...about ? { about } : {},
      ...by ? { by } : {},
      ...asks.length > 0 ? { asks } : {},
      ...progress?.flow !== void 0 ? { flow: progress.flow } : {},
      ...progress?.stateTitle !== void 0 ? { stateTitle: progress.stateTitle } : {},
      ...progress !== void 0 ? { since: progress.since, wrote: progress.wrote.slice(0, 12) } : {},
      ...progress?.final === true ? { final: true } : {},
      ...depends.length > 0 ? { dependsOn: depends } : {}
    });
  }
  const outline = updateOutline(root, home, entries, prs);
  for (const i of out) {
    const row = outline.get(i.id);
    if (row === void 0) continue;
    const pr = prOf(row.pr);
    Object.assign(i, { end: row.state }, row.worktree !== "" ? { worktree: row.worktree } : {}, row.commits !== null ? { commits: row.commits } : {}, pr !== void 0 ? { pr } : {});
  }
  const byId = new Map(out.map((i) => [i.id, i]));
  for (const i of out) {
    const ids = i.dependsOn;
    delete i.dependsOn;
    if (ids === void 0) continue;
    i.depends = ids.map((id) => {
      const other = byId.get(id);
      return { id, ...other?.title !== void 0 ? { title: other.title } : {}, done: other?.final === true, ...other !== void 0 ? { at: other.at } : {} };
    });
    if (i.depends.some((d) => !d.done)) delete i.asks;
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
function gistOf(source) {
  const text = source.replace(/\r\n?/g, "\n");
  const body = blockText(text, "result") ?? text.replace(/^=== meta\n[\s\S]*?\n===\n/, "");
  const line = body.split("\n").map((l) => l.trim()).find((l) => l !== "" && !/^(#|%%|===)/.test(l));
  return line?.replace(/^[-*+]\s+/, "");
}
function newItem(root, path, title, text, units) {
  const rel = relative4(root, resolve4(root, path)).split("\\").join("/");
  if (rel.startsWith("../") || rel === "" || !units.some((glob) => globToRegExp(glob).test(rel))) return { ok: false, reason: `${path} is no work item's file of any flow here` };
  const full = join9(root, rel);
  if (exists(full)) return { ok: false, reason: `${rel} is there already` };
  mkdirSync5(dirname5(full), { recursive: true });
  writeAtomic(full, `=== meta
title = ${JSON.stringify(title)}
by = "gemworks"
===

${text.replace(/\s+$/, "")}
`);
  return { ok: true };
}
function sources(sc) {
  const out = {};
  for (const v of sc.vars.values()) if (v.source !== void 0) out[v.name] = sourceLabel(v.source);
  return out;
}
var COMMITS_SHOWN = 20;
var COMMITS_READ = 2e3;
function writtenOf(journal) {
  const latest2 = /* @__PURE__ */ new Map();
  for (const w of journal.writes) {
    latest2.delete(w.path);
    latest2.set(w.path, w);
  }
  return [...latest2.values()].reverse().map((w) => ({ path: w.path, rev: w.rev, at: w.at, tool: w.tool }));
}
function madeAllOf(root) {
  const home = journalBaseOf(root);
  let rows;
  try {
    rows = readArtifactRows(home);
  } catch {
    return { entries: [] };
  }
  const by = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const key = `${r.item}\0${r.kind}\0${r.name}`;
    const was = by.get(key);
    const copy = r.where.startsWith("artifacts/") ? copyPath(home, r.where) : was?.copy;
    by.set(key, { row: r, versions: (was?.versions ?? 0) + 1, ...copy !== void 0 ? { copy } : {} });
  }
  const entries = [...by.values()].map(({ row: r, versions, copy }) => {
    const given = r.name.startsWith(UPLOAD_PREFIX);
    const own = resolve4(root, r.name);
    const open = r.kind === "link" ? r.where : !given && exists(own) ? own : copy ?? own;
    return { item: r.item, kind: r.kind, name: given ? r.name.slice(UPLOAD_PREFIX.length) : r.name, open, versions, version: r.version, at: r.at, ...given ? { given: true } : {} };
  });
  return { entries: entries.sort((a, b) => b.at.localeCompare(a.at)) };
}
function madeOf(home, root, item, written, ours) {
  try {
    syncWritten(root, home, item, written);
    const docs = /* @__PURE__ */ new Map();
    for (const c of ours) {
      for (const f of c.files) {
        if (!isDocPath(f)) continue;
        const d = docs.get(f);
        if (d !== void 0) d.commits += 1;
        else docs.set(f, { path: f, open: join9(root, f), commits: 1, at: c.at, sha: c.sha });
      }
    }
    const rows = syncDocs(home, item, [...docs.values()].map((d) => ({ path: d.path, sha: d.sha, at: d.at })));
    const entry = (p) => {
      const newest = p.versions[p.versions.length - 1];
      const own = p.kind === "link" ? newest.where : resolve4(root, p.name);
      const copied = (where) => where.startsWith("artifacts/");
      const versions = [...p.versions].reverse().map((v, i) => ({
        version: v.version,
        at: v.at,
        size: v.size,
        ...copied(v.where) && (i === 0 || !isGemlPath(v.where)) ? { copy: copyPath(home, v.where) } : {}
      }));
      const history = p.kind !== "link" && copied(newest.where) && isGemlPath(newest.where) ? historyPathFor2(copyPath(home, newest.where)) : void 0;
      const given = p.name.startsWith(UPLOAD_PREFIX);
      const open = p.kind === "link" || !given && exists(own) ? own : versions[0]?.copy ?? own;
      return {
        kind: p.kind === "image" ? "image" : p.kind === "link" ? "link" : "file",
        name: given ? p.name.slice(UPLOAD_PREFIX.length) : p.name,
        open,
        versions,
        ...history !== void 0 && exists(history) ? { history } : {},
        ...given ? { given: true } : {}
      };
    };
    const made = artifactsOfItem(rows, item).filter((p) => p.kind !== "doc").map(entry);
    if (made.length === 0 && docs.size === 0 && ours.length === 0) return void 0;
    return {
      links: made.filter((p) => p.kind === "link"),
      files: made.filter((p) => p.kind === "file"),
      images: made.filter((p) => p.kind === "image"),
      docs: [...docs.values()].map(({ path, open, commits: commits2, at }) => ({ path, open, commits: commits2, at })),
      code: { commits: ours.length, files: new Set(ours.flatMap((c) => c.files)).size },
      folder: artifactsDir(home)
    };
  } catch {
    return void 0;
  }
}
function artifactsOf(ws, root, journal) {
  if (ws.item.kind !== "item") return void 0;
  const written = writtenOf(journal);
  const latest2 = new Set(written.map((w) => w.path));
  const file = ws.itemFile;
  const last = journal.snapshots.at(-1);
  const since = journal.snapshots[0]?.at ?? journal.meta.created;
  const until = last !== void 0 && ws.sc.states.get(last.state)?.final === true ? last.at : void 0;
  const found = ws.sc.unit.kind === "branch" ? commitsOf(root, { ownBranch: true }, COMMITS_READ) : [
    ...commitsOf(root, { since, ...until !== void 0 ? { until } : {} }, COMMITS_READ),
    ...file !== void 0 ? commitsOf(root, { since, paths: [file] }, COMMITS_SHOWN) : []
  ];
  const touched = /* @__PURE__ */ new Set([...latest2, ...file !== void 0 ? [file] : []]);
  const seen = /* @__PURE__ */ new Set();
  const all = found.filter((c) => {
    if (seen.has(c.sha)) return false;
    seen.add(c.sha);
    return true;
  }).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).map((c) => ({ ...c, ours: ws.sc.unit.kind === "branch" || c.files.some((f) => touched.has(f)) }));
  const commits2 = all.slice(0, COMMITS_SHOWN);
  const made = madeOf(ws.journalBase, root, ws.item.id, [...latest2].filter((p) => p !== file), all.filter((c) => c.ours));
  const source = file !== void 0 && exists(join9(root, file)) ? readText(join9(root, file)) : void 0;
  const section = source !== void 0 ? blockText(source, "result") : void 0;
  const result = section?.replace(/^#[^\n]*\n*/, "").trim();
  return {
    item: ws.item.id,
    ...file !== void 0 ? { file } : {},
    ...result !== void 0 && result !== "" ? { result } : {},
    written,
    commits: commits2,
    ...made !== void 0 ? { made } : {}
  };
}
function artifactsAt(ws, root, item) {
  if (ws !== void 0 && ws.item.kind === "item") return { home: ws.journalBase, item: ws.item.id };
  return item !== void 0 && item !== "" ? { home: ws?.journalBase ?? journalBaseOf(root), item } : void 0;
}
function syncArtifacts(ws, root, req) {
  const at = artifactsAt(ws, root, req.item);
  if (at === void 0) return;
  const { home, item } = at;
  const elsewhere = req.elsewhere ?? [];
  const notMade = req.notMade ?? [];
  if (ws !== void 0 && ws.item.kind === "item") {
    const file = ws.itemFile;
    if (ws.journalPath !== void 0 && exists(ws.journalPath)) {
      try {
        syncWritten(root, home, item, writtenOf(readJournal(readText(ws.journalPath))).map((w) => w.path).filter((p) => p !== file));
      } catch {
      }
    }
  } else if ((req.written ?? []).length > 0) {
    try {
      syncWritten(root, home, item, req.written ?? []);
    } catch {
    }
  }
  if (notMade.length > 0) {
    try {
      forgetFiles(root, home, notMade, join9(homedir3(), ".gemworks", "trash", `${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}-artifacts`));
    } catch {
    }
  }
  const claudeHome = process.env["CLAUDE_CONFIG_DIR"] ?? join9(homedir3(), ".claude");
  for (const path of elsewhere.filter(isMadeForPeople).filter((p) => !isUnder(p, claudeHome) && !notMade.some((n) => isUnder(p, n)))) {
    try {
      recordFile(root, home, item, path, isImagePath(path) ? "image" : "file");
    } catch {
    }
  }
}
var EXT_OF = { "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp", "image/svg+xml": ".svg", "application/pdf": ".pdf", "text/plain": ".txt", "text/csv": ".csv", "text/markdown": ".md" };
function titleOf(text) {
  const page = pageTitle(text);
  if (page !== void 0) return page;
  try {
    const v = JSON.parse(text);
    return typeof v.title === "string" && v.title.trim() !== "" ? v.title.trim() : void 0;
  } catch {
    return void 0;
  }
}
function recordArtifact(ws, root, req) {
  const at = artifactsAt(ws, root, req.item);
  if (at === void 0) return { ok: false, reason: "there is no current work item to record it under" };
  const { home, item } = at;
  const where = req.where.trim();
  if (where === "") return { ok: false, reason: "where is empty: give the link's address or the file's path" };
  if (req.kind === "link") {
    if (!/^https?:\/\//i.test(where)) return { ok: false, reason: "a link's where is its http(s) address" };
    let name = req.name?.trim() ?? "";
    if (name === "" && req.page !== void 0) {
      try {
        name = titleOf(readText(resolve4(root, req.page))) ?? "";
      } catch {
      }
    }
    const fallback = req.page !== void 0 ? basename6(req.page).replace(/\.[^.]*$/, "") : void 0;
    recordLink(home, item, { name, ...fallback !== void 0 ? { fallback } : {}, url: where, ...req.version !== void 0 && req.version !== "" ? { version: req.version } : {}, at: (/* @__PURE__ */ new Date()).toISOString() });
    return { ok: true, text: `Recorded the link under ${item}'s artifacts.` };
  }
  if (req.data !== void 0) {
    const bytes = Buffer.from(req.data, "base64");
    if (bytes.length === 0) return { ok: false, reason: "data is empty" };
    const own = req.name?.trim().split(/[\\/]/).at(-1) ?? "";
    const name = `${UPLOAD_PREFIX}${own !== "" ? own : `upload-${createHash2("sha256").update(bytes).digest("hex").slice(0, 8)}${EXT_OF[req.mediaType ?? ""] ?? ""}`}`;
    const given = recordBytes(home, item, { name, bytes, kind: req.kind, at: (/* @__PURE__ */ new Date()).toISOString() });
    return { ok: true, text: given !== void 0 ? `Recorded ${name} under ${item}'s artifacts.` : "Nothing new to record: these bytes are recorded already." };
  }
  const row = recordFile(root, home, item, where, req.kind);
  return row !== void 0 ? { ok: true, text: `Recorded ${row.name} (version ${row.version}) under ${item}'s artifacts.` } : { ok: true, text: "Nothing new to record: no file there, or this version is recorded already." };
}
var transcriptsRoot = (req) => req.transcripts ?? join9(homedir3(), ".claude", "projects");
var TRANSCRIPT_HOST = "claude-code";
var LIVE_LOG_MS = 10 * 6e4;
function transcriptFiles(root, under) {
  const dirs = new Set([root, journalBaseOf(root), ...worktreesOf(root)].map((d) => slugOf(resolve4(d))));
  const out = [];
  for (const slug of dirs) {
    const dir = join9(under, slug);
    let names;
    try {
      names = readdirSync4(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith(".jsonl")) continue;
      try {
        const st = statSync5(join9(dir, name));
        if (st.isFile()) out.push({ file: join9(dir, name), id: name.slice(0, -".jsonl".length), size: st.size, mtimeMs: st.mtimeMs });
      } catch {
      }
    }
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}
function ownTranscript(tr) {
  return { ...tr, turns: tr.turns.map(({ uploads: _u, ...t }) => ({ ...t, uploads: [] })) };
}
function backfillOne(ws, root, req) {
  let tr;
  try {
    tr = readTranscript(readText(req.file));
  } catch (e) {
    return { ok: false, reason: `cannot read ${basename6(req.file)}: ${e.message}` };
  }
  if (tr === void 0) return { ok: false, reason: `${basename6(req.file)} holds no session` };
  if (tr.id === "") tr = { ...tr, id: basename6(req.file, ".jsonl") };
  const home = ws.journalBase;
  const dir = join9(home, GEML_DIR, SESSIONS_DIR);
  mkdirSync5(dir, { recursive: true });
  if (!exists(join9(dir, ".gitignore"))) writeAtomic(join9(dir, ".gitignore"), SESSIONS_GITIGNORE);
  const path = join9(dir, logName(TRANSCRIPT_HOST, tr.id));
  const was = exists(path) ? parseLog(readText(path)) : [];
  const head = was.find((e) => e.t === "session");
  if (req.own !== true && head !== void 0 && head.backfilled !== true) {
    let mtimeMs = 0;
    try {
      mtimeMs = statSync5(path).mtimeMs;
    } catch {
    }
    if (Date.now() - mtimeMs < LIVE_LOG_MS) return { ok: true, backfill: { id: tr.id, turns: 0, files: 0, links: 0, skipped: true } };
  }
  const fresh = newTurns(tr, was);
  let files = 0;
  let links = 0;
  if (ws.sc.unit.kind === "branch") {
    for (const turn of fresh.turns) {
      const item = turn.branch;
      if (item === void 0 || item === "") continue;
      for (const l of turn.links) {
        try {
          recordLink(home, item, { ...l.title !== void 0 ? { name: l.title } : {}, url: l.url, ...l.version !== void 0 ? { version: l.version } : {}, at: turn.answerAt ?? turn.at });
          links += 1;
        } catch {
        }
      }
      const checkout = turn.cwd !== void 0 && exists(turn.cwd) ? turn.cwd : root;
      const made = turn.files.filter((p) => isMadeForPeople(p) && exists(p));
      const unkept = made.length > 0 ? unkeptOf(checkout, made.map((p) => relative4(checkout, p).replace(/\\/g, "/"))) : void 0;
      for (const p of made) {
        if (unkept === void 0 || !unkept.has(relative4(checkout, p).replace(/\\/g, "/"))) continue;
        try {
          if (recordFile(checkout, home, item, p, isImagePath(p) ? "image" : "file") !== void 0) files += 1;
        } catch {
        }
      }
      for (const u of turn.uploads) {
        try {
          const bytes = Buffer.from(u.data, "base64");
          if (bytes.length === 0) continue;
          const kind = u.mediaType?.startsWith("image/") === true ? "image" : "file";
          const name = `${UPLOAD_PREFIX}upload-${createHash2("sha256").update(bytes).digest("hex").slice(0, 8)}${EXT_OF[u.mediaType ?? ""] ?? ""}`;
          if (recordBytes(home, item, { name, bytes, kind, at: turn.at }) !== void 0) files += 1;
        } catch {
        }
      }
    }
  }
  if (req.own === true) return { ok: true, backfill: { id: tr.id, turns: fresh.turns.length, files, links, transcript: ownTranscript(fresh) } };
  if (fresh.turns.length > 0) {
    const events = head === void 0 ? [...was, ...transcriptEvents(fresh, TRANSCRIPT_HOST, { head: true })] : head.backfilled === true ? [...was, ...transcriptEvents(fresh, TRANSCRIPT_HOST, { head: false, from: nextTurn(was) })] : withEarlierTurns(was, transcriptEvents(fresh, TRANSCRIPT_HOST, { head: false }));
    writeAtomic(path, formatLog(events));
  }
  return { ok: true, backfill: { id: tr.id, turns: fresh.turns.length, files, links } };
}
function boardOf(ws, root, view) {
  const sc = ws.sc;
  const tree = ws.contentTree();
  const backlogPath = join9(root, BACKLOG_DOC);
  const backlog = exists(backlogPath) ? readBacklog(readText(backlogPath)) : null;
  const guards = new Map(view.status.next.map((t) => [t.name, t.guard]));
  const items = listItems(ws, root, view.status.workflow.path);
  const journal = ws.journalPath !== void 0 && exists(ws.journalPath) ? readJournal(readText(ws.journalPath)) : void 0;
  const timeline = journal !== void 0 ? timelineOf(journal) : [];
  const artifacts = journal !== void 0 ? artifactsOf(ws, root, journal) : void 0;
  const ci = ws.ciFailures();
  return {
    unit: sc.unit.kind,
    states: [...sc.states.values()].map((s) => ({ id: s.id, title: s.title, description: s.description, initial: s.id === sc.initial, final: s.final, uses: s.uses })),
    transitions: sc.transitions.map((t) => {
      const guard = guards.get(t.name) ?? (t.guard !== void 0 ? guardText(t.guard) : void 0);
      return { name: t.name, from: t.from, to: t.to, judge: t.judge, approval: t.approval, ...guard !== void 0 ? { guard } : {}, note: t.note };
    }),
    fences: Object.entries(view.policy.fences).map(([use, states]) => ({ use, states })),
    tools: view.policy.rows,
    backlog: backlog ? { key: backlog.key, items: backlog.items } : null,
    items,
    timeline,
    clocks: varsBySource(sc, "elapsed").map((v) => ({ name: v.name, iso: v.source.iso, ms: v.source.ms })),
    ...tree !== void 0 ? { tree } : {},
    picture: flowPicture({ sc, status: view.status, items, timeline }),
    ...artifacts !== void 0 ? { artifacts } : {},
    ...ci !== void 0 ? { ci: { head: ci.head, failed: ci.workflows } } : {}
  };
}
function todoOf(ws, root, view) {
  const file = ws.itemFile;
  const state = view.status.state?.id;
  if (ws.item.kind !== "item" || file === void 0 || state === void 0) return null;
  const count = mediaTodoCount(root, file);
  return count === void 0 ? null : { item: ws.item.id, state, count };
}
function hostOf(root) {
  let user;
  try {
    user = userInfo().username;
  } catch {
  }
  const branch = repoFacts(root).branch;
  return { name: hostname(), platform: process.platform, ...user !== void 0 && user !== "" ? { user } : {}, ...branch !== void 0 ? { branch } : {} };
}
function handoffOf(delivered, ws, view, context) {
  const own = context !== void 0 ? { context } : {};
  const s = view.status;
  if (delivered === void 0 || s.item.kind !== "item") return own;
  if (delivered.slice(0, Math.max(0, delivered.lastIndexOf("@"))) === s.item.id) return own;
  const text = context ?? ws.context();
  if (text === void 0) return own;
  const state = `#${s.state?.id ?? "?"}`;
  if (ws.startedJournal) return { handoff: `[gemworks] now on ${s.item.id} \xB7 ${state} (new work item)`, context: text };
  const vars = view.policy.relevant.map((name) => {
    const v = s.vars[name];
    return typeof v === "boolean" ? ` \xB7 ${name} ${v ? "\u2713" : "\u2717"}` : ` \xB7 ${name}=${JSON.stringify(v ?? null)}`;
  }).join("");
  return { handoff: `[gemworks] back on ${s.item.id} \xB7 ${state} \xB7 rev ${s.state?.rev ?? 0}${vars}`, context: text };
}
function moveEarlierLayout(root) {
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "");
  try {
    migrateLayout(root, join9(homedir3(), ".gemworks", "trash", `${stamp}-layout`));
  } catch {
  }
}
async function handleRequest(req) {
  return answerRequest(req);
}
function answerRequest(req) {
  beginGitRequest();
  try {
    return answer(req);
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).replace(/^gemworks: /, "");
    return { v: 1, ok: false, error: `gemworks: ${message}` };
  } finally {
    endGitRequest();
  }
}
function correctionsView(ledger, practices, now, toTheme) {
  const live = practices.filter((p) => p.deleted !== true);
  const since = new Date(Date.parse(now) - 7 * 864e5).toISOString();
  const offset = -(/* @__PURE__ */ new Date()).getTimezoneOffset();
  const day = (at) => localDay(at, offset).slice(5);
  return {
    cards: ledgerCards(ledger, live, now).map((c) => ({
      ...c,
      quotes: c.quotes.map((q) => ({ ...q, day: day(q.at) })),
      ...c.kind === "failing" && c.instead !== void 0 ? { insteadDay: day(c.instead.at) } : {}
    })),
    counts: practiceCounts(ledger, live),
    flowless: flowless(ledger, now).map((f) => ({
      ...f,
      quotes: ledger.prompts.filter((x) => isCorrection(x) && x.at >= since && x.flow === void 0 && x.work === f.work).slice(-12).map((x) => ({ at: x.at, text: x.text.replace(/\s+/g, " ").trim() }))
    })),
    unthemed: unthemed(ledger, Infinity).length,
    stale: ledger.linked !== linkKey(live),
    ...toTheme ? { toTheme: { corrections: unthemed(ledger), themes: ledger.themes, practices: live } } : {}
  };
}
function practicesOf(root) {
  try {
    const r = readPractices(root);
    return { list: r.practices, memoryMoved: r.memoryMoved };
  } catch {
    return { list: [], memoryMoved: false };
  }
}
function answer(req) {
  const root = req.root;
  if (req.op === "use") {
    const r = useWorkflow(root, req.workflow);
    return r.ok ? { v: 1, ok: true, shell: shellAt(req) } : { v: 1, ok: false, error: r.reason, shell: shellAt(req) };
  }
  if (req.op === "add") {
    const workflows = bundledWorkflows();
    const installed = projectWorkflows(root);
    if (req.workflow === void 0) return { v: 1, ok: true, shell: shellAt(req), workflows, installed };
    const activate = installed.length === 0 && projectDocOf(root) === void 0;
    const r = addWorkflow(root, req.workflow, { activate });
    if (!r.ok) return { v: 1, ok: false, error: r.reason, shell: shellAt(req) };
    return { v: 1, ok: true, shell: shellAt(req), workflows, installed: projectWorkflows(root), added: { name: r.name, activated: r.activated } };
  }
  if (req.op === "import") {
    const r = importWorkflow(root, req.path);
    if (!r.ok) return { v: 1, ok: false, error: r.reason, shell: shellAt(req) };
    return { v: 1, ok: true, shell: shellAt(req), workflows: bundledWorkflows(), installed: projectWorkflows(root), added: { name: r.name, activated: r.activated } };
  }
  if (req.op === "status" && req.migrate === true) moveEarlierLayout(root);
  if (req.op === "made") return { v: 1, ok: true, shell: shellAt(req), made: madeAllOf(root) };
  if (req.op === "memory" || req.op === "memory-set" || req.op === "memory-delete") {
    const dir = memoryDir(transcriptsRoot(req), journalBaseOf(root));
    const trash = join9(homedir3(), ".gemworks", "trash", `${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}-memory`);
    if (req.op === "memory-set" && !setMemoryHook(dir, req.file, req.hook, trash)) return { v: 1, ok: false, error: `no memory ${req.file} to change`, shell: shellAt(req) };
    if (req.op === "memory-delete" && !deleteMemory(dir, req.file, trash)) return { v: 1, ok: false, error: `no memory ${req.file} to delete`, shell: shellAt(req) };
    return { v: 1, ok: true, shell: shellAt(req), memory: readMemory(dir) };
  }
  if (req.op === "practices" || req.op === "practice-add" || req.op === "practice-set" || req.op === "practice-share") {
    if (req.op === "practice-add") writePractices(root, req.practices, req.memory === true);
    if (req.op === "practice-share") sharePractices(root, req.ids);
    if (req.op === "practice-set" && !changePractice(root, req.id, { ...req.deleted !== void 0 ? { deleted: req.deleted } : {}, ...req.layer !== void 0 ? { layer: req.layer } : {}, ...req.everywhere === true ? { everywhere: true } : {} })) {
      return { v: 1, ok: false, error: `no practice ${req.id} to change`, shell: shellAt(req) };
    }
    const { practices, memoryMoved } = readPractices(root);
    return { v: 1, ok: true, shell: shellAt(req), practices: { list: practices, memoryMoved } };
  }
  if (req.op === "corrections" || req.op === "corrections-add" || req.op === "corrections-themes" || req.op === "corrections-dismiss") {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let mine = false;
    const asking = req.op === "corrections" && req.toTheme === true && req.session !== void 0;
    const ledger = req.op === "corrections" && !asking ? readLedger() : updateLedger((l) => {
      if (req.op === "corrections") {
        const c = claimThemes(l, req.session ?? "", now);
        mine = c.mine;
        return c.ledger;
      }
      if (req.op === "corrections-add") return addPrompts(l, req.prompts.map((p) => ({ ...p, by: "model" }))).ledger;
      if (req.op === "corrections-themes") return applyThemes(l, req.answer, now, req.linked, (n) => `t${Date.parse(now).toString(36)}${n}`);
      return dismiss(l, req.key, req.n, now);
    });
    return { v: 1, ok: true, shell: shellAt(req), corrections: correctionsView(ledger, practicesOf(root).list, now, mine) };
  }
  const opened = openFor(req);
  if (!opened.ok) {
    const shell = notOpened(opened, req.root);
    const asks = req.op === "verb" || req.op === "mark" || req.op === "advance" || req.op === "bind" || req.op === "learn" || req.op === "pause" || req.op === "resume" || req.op === "rollback" || req.op === "export";
    const record = req.op === "status" ? { sessions: join9(journalBaseOf(root), GEML_DIR, SESSIONS_DIR), practices: practicesOf(root) } : req.op === "attention" ? { host: hostOf(root) } : {};
    if (req.op === "artifacts") syncArtifacts(void 0, root, req);
    if (req.op === "artifact") {
      const r = recordArtifact(void 0, root, req);
      return r.ok ? { v: 1, ok: true, shell, text: r.text } : { v: 1, ok: false, error: r.reason, shell };
    }
    return asks ? { v: 1, ok: false, error: opened.reason, shell } : { v: 1, ok: true, shell, ...record };
  }
  const ws = opened.ws;
  const ok = (view, extra = {}, context) => ({ v: 1, ok: true, shell: shellOf(view, root), ...extra, ...context !== void 0 ? { context } : {} });
  const failed = (reason) => ({ v: 1, ok: false, error: reason, shell: shellOf(ws.view(), root) });
  switch (req.op) {
    case "status":
      return ok(ws.view(), { sessions: join9(journalBaseOf(root), GEML_DIR, SESSIONS_DIR), practices: practicesOf(root) });
    case "refresh": {
      const change = ws.refresh({ reread: false });
      const view = ws.view();
      return ok(view, { entered: change.entered, todo: todoOf(ws, root, view) }, change.context);
    }
    case "before": {
      const { view, refusal, recorded } = attributionFor(req, ws).before(req.tool, req.callId, req.input, resolve4(root, req.cwd), req.waived);
      return ok(view ?? ws.view(), { ...refusal !== void 0 ? { refusal } : {}, recorded });
    }
    case "after": {
      const start = resolve4(root, req.cwd);
      const r = attributionFor(req, ws).after({
        tool: req.tool,
        callId: req.callId,
        isError: req.isError,
        input: req.input,
        gitOperation: req.gitOperation,
        ...req.exitCode !== void 0 ? { exitCode: req.exitCode } : {},
        ...req.wrotePath !== void 0 ? { wrotePath: req.wrotePath } : {}
      }, start);
      const view = ws.view();
      const h = handoffOf(req.delivered, ws, view, r.context);
      return ok(view, { entered: r.entered, ...r.routed !== void 0 ? { routed: r.routed } : {}, ...h.handoff !== void 0 ? { handoff: h.handoff } : {} }, h.context);
    }
    case "verb": {
      const a = runVerb(ws, req.name, req.args, req.callId);
      const view = ws.view();
      const h = handoffOf(req.delivered, ws, view, a.context);
      return ok(view, { text: a.text, ...h.handoff !== void 0 ? { handoff: h.handoff } : {} }, h.context);
    }
    case "learn": {
      const took = attributionFor(req, ws).learn(req.lessons, req.tool, req.input, resolve4(root, req.cwd));
      return took ? ok(ws.view()) : failed("the call acts in no work item's project; nothing to learn it for");
    }
    case "mark": {
      const r = ws.mark(req.variable, req.checked);
      return r.ok ? ok(ws.view(), { entered: r.entered }, r.context) : failed(r.reason);
    }
    case "advance": {
      const r = ws.advance(req.to);
      return r.ok ? ok(ws.view(), { entered: r.entered }, r.context) : failed(r.reason);
    }
    case "pause": {
      const r = ws.pause();
      return r.ok ? ok(ws.view()) : failed(r.reason);
    }
    case "resume": {
      const r = ws.resume();
      return r.ok ? ok(ws.view(), { entered: r.entered }, r.context) : failed(r.reason);
    }
    case "rollback": {
      const r = ws.rollback(req.rev);
      return r.ok ? ok(ws.view(), { entered: r.entered }, r.context) : failed(r.reason);
    }
    case "new-item": {
      const r = newItem(root, req.path, req.title, req.text, unitsOf(root, ws.view()));
      return r.ok ? ok(ws.view()) : failed(r.reason);
    }
    case "export": {
      const r = exportOf(ws, root, req, (/* @__PURE__ */ new Date()).toISOString());
      return r.ok ? ok(ws.view(), { exported: { path: r.path, text: r.text } }) : failed(r.reason);
    }
    case "bind": {
      const r = bindHere(ws, root, req.id);
      return r.ok ? ok(ws.view()) : failed(r.reason);
    }
    // The repository as the band reads it: what is not pushed, which pull requests are green or failing.
    case "attention": {
      const view = ws.view();
      const prs = pullRequestsByBranch(root);
      if (prs.size > 0) listItems(ws, root, view.status.workflow.path, prs);
      const ahead = branchesAhead(root);
      const open = openPullRequests(root);
      const unread = [...ahead === void 0 ? ["ahead"] : [], ...open === void 0 ? ["prs"] : []];
      const bump = uncommittedBump(root);
      const host = hostOf(root);
      const elsewhere = req.session !== void 0 ? branchesElsewhere(markOpen(root, TRANSCRIPT_HOST, req.session), host.branch) : [];
      return ok(view, { attention: { ahead: ahead ?? [], prs: open ?? [], ...unread.length > 0 ? { unread } : {}, ...bump !== void 0 ? { bump: { version: bump.version, path: bump.path } } : {}, ...elsewhere.length > 0 ? { elsewhere } : {} }, host, sessions: join9(journalBaseOf(root), GEML_DIR, SESSIONS_DIR) });
    }
    case "artifacts": {
      syncArtifacts(ws, root, req);
      return ok(ws.view());
    }
    case "artifact": {
      const r = recordArtifact(ws, root, req);
      return r.ok ? ok(ws.view(), { text: r.text }) : failed(r.reason);
    }
    case "backfill-list":
      return ok(ws.view(), { backfill: { sessions: transcriptFiles(root, transcriptsRoot(req)).map(({ file, id, size }) => ({ file, id, size })) } });
    case "backfill-one": {
      const r = backfillOne(ws, root, req);
      return r.ok ? ok(ws.view(), { backfill: r.backfill }) : failed(r.reason);
    }
    case "turn-ids": {
      const file = transcriptFiles(root, transcriptsRoot(req)).find((f) => f.id === req.session);
      if (file === void 0) return failed(`no transcript of session ${req.session}`);
      let text;
      try {
        text = readText(file.file);
      } catch (e) {
        return failed(`cannot read ${basename6(file.file)}: ${e.message}`);
      }
      const last = text.split(/\r?\n/).reverse().find((l) => l.trim() !== "") ?? "";
      try {
        JSON.parse(last);
      } catch {
        return failed(`the transcript of session ${req.session} is being written`);
      }
      return ok(ws.view(), { backfill: { uuids: (readTranscript(text)?.turns ?? []).map((t) => t.uuid), messages: queuedMessages(text) } });
    }
    case "board": {
      const change = ws.refresh({ reread: false });
      const view = ws.view();
      return ok(view, { entered: change.entered, board: boardOf(ws, root, view), todo: todoOf(ws, root, view) }, change.context);
    }
  }
}

export {
  CLAUDE_CODE_TOOLS,
  CODEX_TOOLS,
  NO_TOOLS,
  HOST_TOOLS,
  addWorkflow,
  useWorkflow,
  normalised,
  contextOf,
  LABEL_GUIDE,
  localDay,
  parsePeriod,
  defaultPeriods,
  report,
  reportText,
  readLedger,
  labelledRows,
  addLabelled,
  unlabelledPrompts,
  NOTE_TOOL,
  SESSIONS_PROMPT,
  decisionsContext,
  appendSession,
  latestSessionOf,
  recordPrompt,
  recordDecisions,
  recordFile2 as recordFile,
  recordAnswer,
  decisionsFor,
  hostLabel,
  commits,
  decodeRequest,
  runVerb,
  stripPaths,
  handleRequest,
  answerRequest
};
