import {
  langOf,
  wordsFor
} from "./gemworks-chunk-VAQRKMSH.mjs";
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
} from "./gemworks-chunk-RYILVWZA.mjs";
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
} from "./gemworks-chunk-4A7KYSFU.mjs";

// src/bridge.ts
import { createHash as createHash2 } from "node:crypto";
import { cpSync, mkdirSync as mkdirSync8, readdirSync as readdirSync5 } from "node:fs";
import { homedir as homedir3, hostname, userInfo } from "node:os";
import { basename as basename7, dirname as dirname8, extname, isAbsolute as isAbsolute4, join as join12, relative as relative4, resolve as resolve4, sep as sep4 } from "node:path";

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
    const target2 = (ws) => {
      let t = targets.find((x) => x.ws === ws);
      if (t === void 0) {
        t = { ws, whole: false, commands: [] };
        targets.push(t);
      }
      return t;
    };
    const written = this.written(call.tool, call.input, start);
    const whole = this.current(this.placeOf(call.tool, call.input, start), written);
    if (whole !== void 0) target2(whole).whole = true;
    const command = commandOf(call.input);
    if (this.tools.run.includes(call.tool) && command !== void 0 && typeof call.exitCode === "number") {
      const heads = signalHeads(command) ?? [];
      const commands = simpleCommands(command) ?? [];
      (commandDirs(command, start) ?? []).forEach((dir, i) => {
        const head = heads[i];
        const current = dir === void 0 ? void 0 : this.current(this.places.of(dir));
        if (current === void 0 || dir === void 0 || head === void 0 || !current.commandSpeaks(head)) return;
        const ws = this.itemFor(current, commands[i] ?? "", dir);
        if (ws !== void 0) target2(ws).commands.push(i);
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
function bindItem(items, id, target2) {
  if (id === "") return { ok: false, reason: "an empty id names no backlog item" };
  if (target2 === "") return { ok: false, reason: "a work item to bind is needed" };
  const matches = items.filter((i) => i.id === id);
  const found = matches[0];
  if (!found) return { ok: false, reason: `no backlog item ${id}` };
  if (matches.length > 1) return { ok: false, reason: `backlog id ${id} is not unique` };
  if (found.target && found.target !== target2) return { ok: false, reason: `${id} is already bound to ${found.target}` };
  return { ok: true, items: items.map((i) => i.id === id ? { ...i, target: target2 } : i) };
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
function bindInDocument(source, id, target2) {
  const before = load(source);
  if (!before) return { ok: false, reason: "no table block #backlog" };
  const bound = bindItem(before.items, id, target2);
  if (!bound.ok) return bound;
  const row = before.items.findIndex((i) => i.id === id);
  if (before.items[row].target === target2) return { ok: true, text: source };
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
  lines[at] = withCell(old.slice(0, old.length - eol.length), col, esc(target2)) + eol;
  const text = lines.join("");
  const after = load(text);
  const same2 = after !== void 0 && after.key === key && after.items.length === before.items.length && after.diagnostics.join("\n") === before.diagnostics.join("\n") && after.items.every((item, i) => i === row ? item.id === id && item.title === before.items[i].title && item.target === target2 : JSON.stringify(item) === JSON.stringify(before.items[i]));
  return same2 ? { ok: true, text } : unwritable(`row ${row + 1}: ${JSON.stringify(target2)} cannot be written into its cell and read back as itself`);
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
import { readFileSync as readFileSync8 } from "node:fs";

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
  const table2 = tb?.table;
  if (table2 === void 0 || !table2.header) return [];
  const cols = table2.columns.map((c) => c.trim().toLowerCase());
  if (!cols.includes("item") || !cols.includes("state")) return [];
  const cell = (row, name) => {
    const c = row[cols.indexOf(name)];
    if (!c) return "";
    const only = c.inlines.length === 1 ? c.inlines[0] : void 0;
    return (only?.type === "code" ? only.value : c.text).trim();
  };
  return table2.rows.flatMap((row) => {
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
  const table2 = renderOutline(rows);
  if (source === null) return ["=== meta", 'title = "Gemworks"', "===", "", table2, ""].join("\n");
  const src = source.replace(/\r\n?/g, "\n");
  const unit = unitSpans2(src).find((u) => u.kind === "block" && u.id === ITEMS_TABLE);
  if (unit === void 0) return `${src.replace(/\n*$/, "\n\n")}${table2}
`;
  const lines = src.split("\n");
  return [...lines.slice(0, unit.span.start), ...table2.split("\n"), ...lines.slice(unit.span.end)].join("\n");
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
var ARTIFACT_TOOL = {
  name: "artifact",
  description: "Record something this work item made that gemworks cannot see by itself, so the board lists it under the work item's artifacts: a link (an online document, a published page, a design) or a generated picture or file. Files written with the write tools, commits, and pages published with the Artifact tool are recorded already; do not record those.",
  inputSchema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["link", "image", "file"], description: "link: an address; image or file: a file on this machine." },
      name: { type: "string", description: "What it is, in a few words (a link's title)." },
      where: { type: "string", description: "The link's address, or the file's path." },
      version: { type: "string", description: "The version its publisher gave it, when it gave one." }
    },
    required: ["kind", "where"],
    additionalProperties: false
  }
};

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
  const table2 = tb?.table;
  if (table2 === void 0 || !table2.header) return [];
  const cols = table2.columns.map((c) => c.trim().toLowerCase());
  if (!cols.includes("item") || !cols.includes("kind") || !cols.includes("name")) return [];
  const cell = (row, name) => {
    const c = row[cols.indexOf(name)];
    if (!c) return "";
    const only = c.inlines.length === 1 ? c.inlines[0] : void 0;
    return (only?.type === "code" ? only.value : c.text).trim();
  };
  return table2.rows.flatMap((row) => {
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
  const table2 = renderArtifacts(rows);
  if (source === null) return ["=== meta", 'title = "Gemworks artifacts"', "===", "", table2, ""].join("\n");
  const src = source.replace(/\r\n?/g, "\n");
  const unit = unitSpans3(src).find((u) => u.kind === "block" && u.id === ARTIFACTS_TABLE);
  if (unit === void 0) return `${src.replace(/\n*$/, "\n\n")}${table2}
`;
  const lines = src.split("\n");
  return [...lines.slice(0, unit.span.start), ...table2.split("\n"), ...lines.slice(unit.span.end)].join("\n");
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
  const target2 = join3(home, GEML_DIR, where);
  if (!exists(target2)) copyFileSync(abs, target2);
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
  const same2 = (a, b) => a.length === b.length && a.every((r, i) => JSON.stringify(r) === JSON.stringify(b[i]));
  const now = readArtifactRows(home);
  if (same2(now.filter((r) => r.item === item && r.kind === "doc"), wanted)) return now;
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
    const target2 = join3(home, GEML_DIR, where);
    mkdirSync(dirname2(target2), { recursive: true });
    if (!exists(target2)) writeFileSync(target2, given.bytes);
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
function practicesAt(list, flow, step, limit = 3) {
  const rank = (p) => p.flow === flow && p.step === step ? 0 : p.flow === flow ? 1 : 2;
  return list.filter((p) => p.deleted !== true && (p.flow === flow || p.flow === "*") && (p.step === step || p.step === "*")).sort((a, b) => rank(a) - rank(b) || (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit);
}
var same = (a, b) => a.replace(/\s+/g, "") === b.replace(/\s+/g, "");
function newPractices(given, kept, at, by, newId, flows, where) {
  const added = [];
  const errors = [];
  given.forEach((v, n) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      errors.push(`practice ${n + 1} is not an object`);
      return;
    }
    const x = v;
    const s = (k) => typeof x[k] === "string" ? x[k].trim() : "";
    const flow = s("flow") || "*";
    const step = s("step") || "*";
    const text = s("text");
    if (text === "") {
      errors.push(`practice ${n + 1} has no text`);
      return;
    }
    const f = flows.find((g) => g.name === flow);
    if (flow !== "*" && f === void 0) {
      errors.push(`practice ${n + 1}: flow must be * or one of ${flows.map((g) => g.name).join(", ")}`);
      return;
    }
    if (step !== "*" && f !== void 0 && !f.steps.includes(step)) {
      errors.push(`practice ${n + 1}: ${flow} has no step "${step}" (${f.steps.join(", ")})`);
      return;
    }
    if (step !== "*" && flow === "*") {
      errors.push(`practice ${n + 1}: a step needs its flow`);
      return;
    }
    const layer = x["layer"] === "personal" ? "personal" : "project";
    const was = [...kept, ...added].find((p) => p.flow === flow && p.step === step && same(p.text, text));
    if (was !== void 0) {
      errors.push(was.deleted === true ? `practice ${n + 1}: the person took it out; not again` : `practice ${n + 1}: already kept`);
      return;
    }
    added.push({ id: newId(n), flow, step, text, why: s("why"), at, by, layer, ...s("ref") !== "" ? { ref: s("ref") } : {}, ...s("from") !== "" ? { from: s("from") } : {}, ...where !== void 0 ? { session: where.session, turn: where.turn } : {} });
  });
  return { added, errors };
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
  return ["id", "at", "session", "text"].every((k) => typeof v[k] === "string") && KINDS.includes(v["kind"]) && (v["sub"] === void 0 || SUBS.includes(v["sub"])) && (v["work"] === void 0 || WORKS.includes(v["work"])) && ["project", "flow", "step", "theme"].every(opt) && (v["checked"] === void 0 || typeof v["checked"] === "boolean") && (v["checks"] === void 0 || typeof v["checks"] === "object" && v["checks"] !== null && !Array.isArray(v["checks"]) && Object.values(v["checks"]).every((x) => typeof x === "boolean")) && BY2.includes(v["by"]);
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
  const quoted2 = (s) => s.replace(/["\r\n]/g, "");
  return `=== meta
title = "\u7EA0\u6B63"
linked = "${quoted2(l.linked)}"
claim = "${quoted2(l.claim)}"
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
    out[p.id] = { before: said.filter((x) => x.at < p.at).length, after: said.filter((x) => x.at > p.at && covers(p, x) && x.checks?.[p.id] === true).length };
  }
  return out;
}
var CHECKS_ASKED = 30;
function unchecked(l, practices, limit = CHECKS_ASKED) {
  const corrections = l.prompts.filter((x) => isCorrection(x) && x.theme !== void 0 && x.theme !== "");
  const waiting = [];
  for (const p of practices) {
    if (p.deleted === true) continue;
    const mine = themesOf(l, p.id);
    const after = corrections.filter((x) => mine.has(x.theme) && x.at > p.at && covers(p, x));
    if (after.length < 2) continue;
    for (const x of after) if (x.checks?.[p.id] === void 0) waiting.push({ x, p });
  }
  const sorted = waiting.sort((a, b) => a.x.at < b.x.at ? -1 : a.x.at > b.x.at ? 1 : 0);
  return sorted.slice(Math.max(0, sorted.length - limit)).map(({ x, p }) => ({ id: x.id, practice: p.id, text: x.text, rule: p.text }));
}
function applyChecks(l, verdicts) {
  const given = /* @__PURE__ */ new Map();
  for (const v of verdicts) given.set(v.id, { ...given.get(v.id) ?? {}, [v.practice]: v.holds });
  return { ...l, prompts: l.prompts.map((p) => {
    const g = given.get(p.id);
    return g === void 0 ? p : { ...p, checks: { ...p.checks ?? {}, ...g } };
  }) };
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
    const after = corrections.filter((x) => mine.has(x.theme) && x.at > p.at && covers(p, x) && x.checks?.[p.id] === true);
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
function mondayOf(day3) {
  const d = /* @__PURE__ */ new Date(`${day3}T00:00:00Z`);
  return new Date(d.getTime() - (d.getUTCDay() + 6) % 7 * 864e5).toISOString().slice(0, 10);
}
var addDays = (day3, n) => new Date(Date.parse(`${day3}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
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
  const pad3 = (s, w) => s + " ".repeat(Math.max(0, w - cells(s)));
  const num = (s, w = 8) => " ".repeat(Math.max(0, w - s.length)) + s;
  const NAME = 18;
  const pair2 = (name, nb, nt) => `${pad3(name, NAME)}${num(per100(nb, r.baseline.prompts))}${num(per100(nt, r.trial.prompts))}`;
  const lines = [
    `\u7EA0\u6B63 \xB7 ${r.first} \u81F3 ${r.last} \xB7 ${r.all.sessions} \u4E2A\u4F1A\u8BDD \xB7 ${r.all.prompts} \u53E5 \xB7 \u7EA0\u6B63 ${r.all.corrections} \u53E5${unlabelled > 0 ? ` \xB7 ${unlabelled} \u53E5\u672A\u6807\u6CE8` : ""}`,
    "",
    `${pad3("\u6BCF\u767E\u53E5", NAME)}${num("\u57FA\u7EBF")}${num("\u8BD5\u9A8C\u671F")}`,
    `${pad3("", NAME)}${num(r.baseline.from.slice(5))}${num(r.trial.from.slice(5))}`,
    `${pad3("", NAME)}${num(r.baseline.to.slice(5))}${num(r.trial.to.slice(5))}`,
    `${pad3("\u53E5\u6570", NAME)}${num(String(r.baseline.prompts))}${num(String(r.trial.prompts))}`,
    pair2("\u7EA0\u6B63", r.baseline.corrections, r.trial.corrections),
    pair2("\u56FA\u5B9A\u68C0\u67E5", r.baseline.fixed, r.trial.fixed),
    ...FIXED_SUBS.map((s) => pair2(`  ${SUB_NAMES[s]}`, r.baseline.by[s], r.trial.by[s])),
    pair2("\u9760\u4EBA\u5224\u65AD\uFF08\u5BF9\u7167\uFF09", r.baseline.person, r.trial.person),
    ...PERSON_SUBS.map((s) => pair2(`  ${SUB_NAMES[s]}`, r.baseline.by[s], r.trial.by[s]))
  ];
  if (r.byWork !== void 0) {
    lines.push("", `${pad3("\u6309\u5DE5\u4F5C\u7C7B\u578B\uFF1A\u56FA\u5B9A\u68C0\u67E5", NAME)}${num("\u57FA\u7EBF")}${num("\u8BD5\u9A8C\u671F")}${num("\u53E5\u6570")}`);
    for (const w of r.byWork) {
      if (w.baseline.prompts === 0 && w.trial.prompts === 0) continue;
      lines.push(`${pad3(`  ${WORK_NAMES[w.work]}`, NAME)}${num(per100(w.baseline.fixed, w.baseline.prompts))}${num(per100(w.trial.fixed, w.trial.prompts))}${num(`${w.baseline.prompts}/${w.trial.prompts}`, 10)}`);
      lines.push(`${pad3("    \u9760\u4EBA\u5224\u65AD", NAME)}${num(per100(w.baseline.person, w.baseline.prompts))}${num(per100(w.trial.person, w.trial.prompts))}`);
    }
  }
  lines.push("", `${pad3("\u6BCF\u5468", 10)}${num("\u53E5\u6570", 6)}${num("\u7EA0\u6B63")}${num("\u56FA\u5B9A\u68C0\u67E5")}${num("\u9760\u4EBA\u5224\u65AD")}`);
  for (const w of r.weeks) {
    lines.push(w.prompts === 0 ? `${pad3(w.week.slice(5), 10)}${num("\u2014", 6)}${num("\u2014")}${num("\u2014")}${num("\u2014")}` : `${pad3(w.week.slice(5), 10)}${num(String(w.prompts), 6)}${num(per100(w.corrections, w.prompts))}${num(per100(w.fixed, w.prompts))}${num(per100(w.person, w.prompts))}`);
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
function recordedUnlabelled(ledger, sessions, o = {}) {
  const now = o.now ?? (/* @__PURE__ */ new Date()).toISOString();
  const since = o.since ?? ledger.prompts[ledger.prompts.length - 1]?.at ?? new Date(Date.parse(now) - 30 * 864e5).toISOString();
  const taken = new Set(ledger.prompts.map((p) => p.id));
  const out = [];
  for (const s of sessions) {
    if (s.host === "claude-code" || s.backfilled === true) continue;
    s.turns.forEach((t, i) => {
      const text = typedWords(t.prompt);
      if (text === void 0 || t.backfilled === true || t.kind !== void 0 || t.at <= since) return;
      const row = { id: promptId(s.id, t.at, taken), at: t.at, session: s.id, text };
      if (hasPrompt(ledger, row) || hasPrompt({ prompts: out }, row)) return;
      taken.add(row.id);
      out.push({ ...row, project: s.checkout ?? "", before: (s.turns[i - 1]?.answer ?? "").slice(-600) });
    });
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
var isSeenRun = (v) => {
  if (typeof v !== "object" || v === null) return false;
  const r = v;
  return typeof r["command"] === "string" && typeof r["exit"] === "number" && typeof r["at"] === "string";
};
var isMetStep = (v) => {
  if (typeof v !== "object" || v === null) return false;
  const m = v;
  const text = (k) => m[k] === void 0 || typeof m[k] === "string";
  return typeof m["step"] === "string" && typeof m["at"] === "string" && typeof m["turn"] === "number" && text("said") && (m["pressed"] === void 0 || typeof m["pressed"] === "boolean") && text("evidence") && (m["seen"] === void 0 || isSeenRun(m["seen"]));
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
    case "ask":
      return typeof e["turn"] === "number" && typeof e["question"] === "string" && Array.isArray(e["options"]) && e["options"].every((o) => typeof o === "string") && (e["recommended"] === void 0 || typeof e["recommended"] === "string") && (e["item"] === void 0 || typeof e["item"] === "string");
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
        delete s.asks;
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
      case "ask":
        s.asks = [...(s.asks ?? []).filter((q) => q.question !== e.question), e];
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
function decisionsContext(decisions, label2) {
  return ["[gemworks] \u672C\u9879\u76EE\u5176\u4ED6\u4F1A\u8BDD\u8BB0\u4E0B\u7684\u51B3\u5B9A\uFF1A", ...decisions.map((d) => `- ${d.text}\uFF08${label2(d)}\uFF09`)].join("\n");
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
function readSessionLogs(root) {
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
      out.push(parseLog(readFileSync4(join7(dir, n), "utf8")));
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
  return { "claude-code": "Claude", codex: "Codex", cursor: "Cursor", qwen: "Qwen", gemini: "Gemini", dsh: "DeepSeek", pi: "pi" }[host] ?? host;
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
var OPS = /* @__PURE__ */ new Set(["status", "refresh", "before", "after", "verb", "learn", "mark", "advance", "pause", "resume", "rollback", "new-item", "bind", "use", "add", "import", "board", "made", "attention", "export", "artifacts", "artifact", "backfill-list", "backfill-one", "signoff", "turn-ids", "memory", "memory-set", "memory-delete", "practices", "practice-add", "practice-set", "practice-share", "corrections", "corrections-add", "corrections-themes", "corrections-dismiss", "corrections-check"]);
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
  const str4 = (k) => typeof v[k] === "string";
  const isRecord = (x) => typeof x === "object" && x !== null && !Array.isArray(x);
  const obj = (k) => isRecord(v[k]);
  const cwd = () => v["cwd"] === void 0 || str4("cwd") && v["cwd"] !== "";
  const fields = {
    before: () => str4("tool") && str4("callId") && obj("input") && cwd() && (v["waived"] === void 0 || Array.isArray(v["waived"]) && v["waived"].every((k) => typeof k === "string")),
    after: () => str4("tool") && str4("callId") && obj("input") && typeof v["isError"] === "boolean" && typeof v["gitOperation"] === "boolean" && cwd(),
    verb: () => str4("name") && VERBS.has(v["name"]) && obj("args"),
    learn: () => Array.isArray(v["lessons"]) && v["lessons"].every(isLesson) && str4("tool") && obj("input") && cwd(),
    mark: () => str4("variable") && typeof v["checked"] === "boolean",
    advance: () => str4("to"),
    rollback: () => Number.isInteger(v["rev"]) && v["rev"] >= 0,
    "new-item": () => str4("path") && v["path"] !== "" && str4("title") && str4("text"),
    bind: () => str4("id"),
    use: () => str4("workflow"),
    import: () => str4("path") && v["path"] !== "",
    export: () => EXPORT_KINDS.has(v["kind"]) && EXPORT_FORMATS.has(v["format"]) && (v["name"] === void 0 || str4("name")) && (v["text"] === void 0 || str4("text")) && (v["strip"] === void 0 || typeof v["strip"] === "boolean") && (v["to"] === void 0 || str4("to") && v["to"] !== "") && (v["kind"] !== "text" || str4("text")),
    artifact: () => (v["kind"] === "link" || v["kind"] === "image" || v["kind"] === "file") && str4("where") && (v["name"] === void 0 || str4("name")) && (v["version"] === void 0 || str4("version")) && (v["page"] === void 0 || str4("page")) && (v["data"] === void 0 || str4("data")) && (v["mediaType"] === void 0 || str4("mediaType")),
    artifacts: () => (v["elsewhere"] === void 0 || Array.isArray(v["elsewhere"]) && v["elsewhere"].every((p) => typeof p === "string")) && (v["notMade"] === void 0 || Array.isArray(v["notMade"]) && v["notMade"].every((p) => typeof p === "string")),
    attention: () => v["session"] === void 0 || str4("session") && v["session"] !== "",
    "backfill-list": () => v["transcripts"] === void 0 || str4("transcripts"),
    "backfill-one": () => str4("file") && v["file"] !== "" && (v["own"] === void 0 || typeof v["own"] === "boolean") && (v["transcripts"] === void 0 || str4("transcripts")),
    signoff: () => Array.isArray(v["ids"]) && v["ids"].every((x) => typeof x === "string") && (v["lang"] === void 0 || v["lang"] === "zh" || v["lang"] === "en" || v["lang"] === "ja"),
    "turn-ids": () => str4("session") && v["session"] !== "" && (v["transcripts"] === void 0 || str4("transcripts")),
    memory: () => v["transcripts"] === void 0 || str4("transcripts"),
    "memory-set": () => str4("file") && v["file"] !== "" && str4("hook") && (v["transcripts"] === void 0 || str4("transcripts")),
    "memory-delete": () => str4("file") && v["file"] !== "" && (v["transcripts"] === void 0 || str4("transcripts")),
    "practice-add": () => Array.isArray(v["practices"]) && v["practices"].every((x) => typeof x === "object" && x !== null && !Array.isArray(x)) && (v["memory"] === void 0 || typeof v["memory"] === "boolean"),
    "practice-share": () => Array.isArray(v["ids"]) && v["ids"].every((x) => typeof x === "string"),
    "practice-set": () => str4("id") && v["id"] !== "" && (v["deleted"] === void 0 || typeof v["deleted"] === "boolean") && (v["layer"] === void 0 || v["layer"] === "personal" || v["layer"] === "project") && (v["everywhere"] === void 0 || typeof v["everywhere"] === "boolean"),
    corrections: () => (v["toTheme"] === void 0 || typeof v["toTheme"] === "boolean") && (v["session"] === void 0 || str4("session")),
    "corrections-add": () => Array.isArray(v["prompts"]) && v["prompts"].every(isRecord),
    "corrections-themes": () => obj("answer") && Array.isArray(v["answer"]["assign"]) && Array.isArray(v["answer"]["links"]) && str4("linked"),
    "corrections-dismiss": () => str4("key") && v["key"] !== "" && Number.isInteger(v["n"]),
    "corrections-check": () => Array.isArray(v["verdicts"]) && v["verdicts"].every((x) => isRecord(x) && typeof x["id"] === "string" && typeof x["practice"] === "string" && typeof x["holds"] === "boolean")
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
  const target2 = join8(home, WORKFLOWS_DIR, `${name}.geml`);
  if (installedWorkflows(root, home).some((w) => w.name === name)) return { ok: false, code: 1, reason: `${WORKFLOWS_DIR}/${name}.geml already exists; not overwriting`, target: target2 };
  const dir = join8(BUNDLED, name);
  writeWorkflow(home, name, mergedWorkflow(name, readText(join8(dir, FLOW_FILE)), (f) => readIn(dir, f)));
  const tools = readIn(dir, TOOLS_FILE);
  if (tools !== void 0) mergeTools(home, tools);
  if (o.activate) setDefault(root, home, name);
  ensureGitignore(join8(home, GEML_DIR));
  return { ok: true, name, target: target2, activated: o.activate };
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
  const target2 = join8(home, WORKFLOWS_DIR, `${name}.geml`);
  if (installed.some((w) => w.name === name)) return { ok: false, reason: `${WORKFLOWS_DIR}/${name}.geml already exists; not overwriting` };
  const activate = installed.length === 0 && projectDocOf(root, home) === void 0;
  writeWorkflow(home, name, mergedWorkflow(name, readText(flow), (f) => readIn(dir, f)));
  const dict = dictionaryPathOf(flow);
  if (exists(dict)) mergeTools(home, readText(dict), basename5(flow).toLowerCase() === FLOW_FILE ? void 0 : usesOf(loaded.statechart));
  if (activate) setDefault(root, home, name);
  ensureGitignore(join8(home, GEML_DIR));
  return { ok: true, name, target: target2, activated: activate };
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

// src/signoff.ts
import { mkdirSync as mkdirSync7, readFileSync as readFileSync7, writeFileSync as writeFileSync7 } from "node:fs";
import { dirname as dirname7, join as join11 } from "node:path";

// src/board-file.ts
import { spawn, spawnSync } from "node:child_process";
import { existsSync as existsSync5, mkdirSync as mkdirSync6, readFileSync as readFileSync6, writeFileSync as writeFileSync6 } from "node:fs";
import { tmpdir } from "node:os";
import { basename as basename6, dirname as dirname6, isAbsolute as isAbsolute3, join as join10 } from "node:path";

// src/core/progress.ts
function progressOf(steps, met, running = /* @__PURE__ */ new Set()) {
  const work = steps.filter((s) => !s.final);
  let furthest = -1;
  work.forEach((s, i) => {
    if (met.has(s.id)) furthest = i;
  });
  const at = work.findIndex((s, i) => i > furthest && !met.has(s.id));
  const here = at < 0 ? null : work[at];
  const cells = steps.map((s) => {
    if (s.final) return { id: s.id, cell: here === null ? "met" : "ahead" };
    const i = work.indexOf(s);
    const cell = met.has(s.id) ? "met" : i === at ? "here" : i < furthest ? "skipped" : "ahead";
    return { id: s.id, cell };
  });
  if (here === null) return { cells, here: null, whose: "done" };
  const whose = here.judge === "you" ? "you" : here.judge === "fact" && running.has(here.id) ? "wait" : "me";
  return { cells, here: here.id, whose };
}

// src/core/work.ts
var COACH_FLOWS = ["design", "feature", "bugfix", "optimize", "incident", "review", "research", "refactor", "docs", "analysis"];
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var str2 = (v) => typeof v === "string" ? v : "";
var JUDGES = ["fact", "you", "model"];
var pair = (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "string" && v[0] !== "" && v[1] !== "" ? [v[0], v[1]] : null;
function readCoachFlow(name, text, reference) {
  const lines = text.split(/\r?\n/);
  const open = lines.findIndex((l) => /^===\s*diagram\b/.test(l.trim()) && l.includes("format=geml-statechart"));
  if (open < 0) return void 0;
  const close = lines.findIndex((l, i) => i > open && l.trim() === "===");
  let v;
  try {
    v = JSON.parse(lines.slice(open + 1, close < 0 ? void 0 : close).join("\n"));
  } catch {
    return void 0;
  }
  if (!isObject(v) || !isObject(v["states"])) return void 0;
  const states = Object.entries(v["states"]).flatMap(([id, s]) => {
    if (!isObject(s)) return [];
    const ref = reference?.states.find((r) => r.id === id);
    const judge = JUDGES.find((j) => j === s["judge"]) ?? ref?.judge ?? "model";
    const expires = s["expires"] === true || s["expires"] === void 0 && ref?.expires === true;
    return [{ id, title: str2(s["title"]) || id, need: str2(s["description"]), final: s["final"] === true, judge, prevents: str2(s["prevents"]) || ref?.prevents || "", answers: pair(s["answers"]) ?? ref?.answers ?? null, ...expires ? { expires: true } : {} }];
  });
  if (states.length === 0) return void 0;
  const at = (id) => states.findIndex((s) => s.id === id);
  const edges = (Array.isArray(v["transitions"]) ? v["transitions"] : []).flatMap((x) => {
    if (!isObject(x) || at(str2(x["from"])) < 0 || at(str2(x["to"])) < 0) return [];
    const from = str2(x["from"]);
    const to = str2(x["to"]);
    return [{ from, to, label: str2(x["label"]) || str2(x["guard"]), back: at(to) !== at(from) + 1 }];
  });
  const title = text.match(/^title\s*=\s*"([^"]*)"/m)?.[1] ?? lines[open]?.match(/caption="([^"]*)"/)?.[1] ?? name;
  const diff = reference !== void 0 ? { added: states.filter((s) => !s.final && !reference.states.some((r) => r.id === s.id)).map((s) => s.title), removed: reference.states.filter((r) => !r.final && !states.some((s) => s.id === r.id)).map((r) => r.title) } : void 0;
  return { name, title, states, edges, ...diff !== void 0 ? { diff } : {} };
}
function metOf(e, flow) {
  if (e.met !== void 0) return e.met;
  if (flow === void 0) return [];
  const at = flow.states.findIndex((s) => s.id === e.state);
  if (at < 0) return [];
  const done = flow.states[at].final;
  return flow.states.filter((s, i) => !s.final && (done || i < at)).map((s) => ({ step: s.id, at: e.at, turn: e.turn }));
}
function itemProgress2(item, flow, running) {
  return progressOf(flow.states, new Set(item.met.map((m) => m.step)), running);
}
var finalOf = (flow) => (flow.states.find((s) => s.final) ?? flow.states.at(-1)).id;
function workItemsOf(sessions, flows = []) {
  const by = /* @__PURE__ */ new Map();
  for (const s of sessions) {
    for (const e of s.items ?? []) {
      const was = by.get(e.id);
      if (was !== void 0 && was.at >= e.at) continue;
      const met = metOf(e, flows.find((f) => f.name === e.flow));
      by.set(e.id, { id: e.id, flow: e.flow, title: e.title, state: e.state, needs: e.needs, goal: e.goal, status: e.status, at: e.at, session: s.id, met, next: e.next ?? "" });
    }
  }
  return [...by.values()].sort((a, b) => a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
}
var WORK_TOOL = {
  name: "work",
  description: "Report, before the turn ends, the work items this turn was about, so the board shows the person where each stands: each a thing the person wants done (a new design, a new feature, a bugfix, an optimization), the flow that fits it, every step whose leave requirement is met now (where it stands follows from them, so steps may be skipped), what it still needs, what you will do next, and what it should be at the end. Update an item on the way by its id (listed beside the person's prompt); report a new one without an id. One turn may be about several items; a turn about none reports nothing.",
  inputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "An item already on the way, by its id; leave it out for a new one." },
            title: { type: "string", description: "What the item is, in a few words of the person's language." },
            flow: { type: "string", description: "The flow it belongs to, by its name: design \u65B0\u8BBE\u8BA1, feature \u65B0\u529F\u80FD, bugfix, optimize \u4F18\u5316, incident \u7EBF\u4E0A\u4E8B\u6545, review \u4EE3\u7801\u5BA1\u67E5, research \u8C03\u7814\u9009\u578B, refactor \u91CD\u6784, docs \u6587\u6863, analysis \u6570\u636E\u5206\u6790, or one the project added (the flows are listed once)." },
            met: { type: "array", items: { type: "string" }, description: "Every step whose leave requirement is met now, by the id or title the flow lists; a way back is the same list with the later steps left out. Leave it out on an update to keep what was met." },
            said: { type: "string", description: "The person's own words, this turn, that meet a step they judge (marked you), e.g. \u300C\u597D\u4E86\u300D. Needed when met newly names such a step; without their words leave the step for their press." },
            evidence: { type: "string", description: "What proves a step marked (fact) that met newly names: the check as it ran \u2014 the command in backticks and its result (`npm test` exit 0), the CI run, the numbers measured. It goes on the item's sign-off sheet beside the run gemworks saw." },
            next: { type: "string", description: "What you will do next for it: one short sentence in the person's language, as it would follow \u300C\u63A5\u4E0B\u6765\u6211\u53BB\u300D." },
            needs: { type: "string", description: "What it still needs to leave the step it stands at: one short phrase, in the person's language." },
            goal: { type: "string", description: "What it should be at the end: one short sentence, in the person's language." },
            status: { type: "string", enum: ["open", "done", "dropped"], description: "done once the person said it is; dropped when given up. Default open." }
          },
          required: ["title", "flow"],
          additionalProperties: false
        }
      }
    },
    required: ["items"],
    additionalProperties: false
  }
};
var WORK_REMINDER = "Gemworks: this turn changed things but reported no work item. Before ending, call the gemworks `work` tool with the work items this turn was about (update one on the way by its id, report a new one without), then end the turn.";
function workPrompt(flows) {
  const listed = flows.map((f) => `${f.name} ${f.title}: ${f.states.filter((s) => !s.final).map((s) => `${s.id} ${s.title} (${s.judge})`).join(" \u2192 ")}`).join("; ");
  return `Gemworks: before a turn ends, report the work items it was about with the gemworks \`work\` tool: the flow each belongs to, every step whose leave requirement is met now (\`met\`), what it still needs, what you will do next, what it should be at the end; update one on the way by its id. A step marked (you) is the person's to judge: name it in \`met\` only with their own words in \`said\`, else leave it for their press. A step marked (fact) is met with what proves it in \`evidence\`: the command as it ran and its result. The flows: ${listed}.`;
}
function workContext(items, flows, limit = 8) {
  const open = items.filter((i) => i.status === "open").slice(0, limit);
  if (open.length === 0) return [];
  const where = (i) => {
    const flow = flows.find((f) => f.name === i.flow);
    const here = flow !== void 0 ? itemProgress2(i, flow).here ?? i.state : i.state;
    const met = i.met.length > 0 ? `met ${i.met.map((m) => m.step).join(", ")}; ` : "";
    return `${met}at ${here} ${flow?.states.find((s) => s.id === here)?.title ?? ""}`.trimEnd();
  };
  return [`[gemworks] work items on the way: ${open.map((i) => `#${i.id} \xAB${i.title}\xBB (${i.flow}: ${where(i)}${i.needs !== "" ? `, needs ${i.needs}` : ""})`).join("; ")}`];
}
function workEvents(args, flows, items, at, turn, newId, runs = []) {
  const given = Array.isArray(args["items"]) ? args["items"] : [];
  const events = [];
  const errors = [];
  given.forEach((x, n) => {
    if (!isObject(x)) {
      errors.push(`item ${n + 1} is not an object`);
      return;
    }
    const flow = flows.find((f) => f.name === str2(x["flow"]));
    if (flow === void 0) {
      errors.push(`item ${n + 1}: flow must be one of ${flows.map((f) => f.name).join(", ")}`);
      return;
    }
    const stepNamed = (name) => flow.states.find((s) => s.id === name) ?? flow.states.find((s) => s.title === name);
    const ids = flow.states.map((s) => s.id).join(", ");
    const id = str2(x["id"]).replace(/^#/, "");
    const was = id !== "" ? items.find((i) => i.id === id) : void 0;
    if (id !== "" && was === void 0) {
      errors.push(`item ${n + 1}: no work item #${id} is on the way`);
      return;
    }
    let named2;
    if (Array.isArray(x["met"])) {
      const unknown = x["met"].find((m) => stepNamed(str2(m)) === void 0);
      if (unknown !== void 0) {
        errors.push(`item ${n + 1}: ${flow.name} has no step "${str2(unknown)}" (${ids})`);
        return;
      }
      const steps = x["met"].map((m) => stepNamed(str2(m)));
      named2 = steps.some((s) => s.final) ? flow.states.filter((s) => !s.final) : steps;
    } else if (str2(x["state"]) !== "") {
      const state = stepNamed(str2(x["state"]));
      if (state === void 0) {
        errors.push(`item ${n + 1}: ${flow.name} has no state "${str2(x["state"])}" (${ids})`);
        return;
      }
      const upTo = flow.states.indexOf(state);
      named2 = flow.states.filter((s, i) => !s.final && (state.final || i < upTo));
    }
    const title = str2(x["title"]).trim() || was?.title || "";
    if (title === "") {
      errors.push(`item ${n + 1} has no title`);
      return;
    }
    const before = was?.met ?? [];
    const metIds = [...new Set(named2 !== void 0 ? named2.map((s) => s.id) : before.map((m) => m.step))];
    const said = str2(x["said"]).trim();
    const theirs = metIds.map((s) => stepNamed(s)).filter((s) => s.judge === "you" && !before.some((m) => m.step === s.id));
    if (theirs.length > 0 && said === "") {
      errors.push(`item ${n + 1}: ${theirs.map((s) => s.title).join("\u3001")} is the person's to meet: put what they said in \`said\`, or leave it for their press`);
      return;
    }
    const evidence = str2(x["evidence"]).trim();
    const facts = metIds.filter((s) => stepNamed(s).judge === "fact" && !before.some((m) => m.step === s));
    const seen = evidence !== "" ? seenIn(evidence, runs) : void 0;
    const met = metIds.map((s) => before.find((m) => m.step === s) ?? {
      step: s,
      at,
      turn,
      ...theirs.some((t) => t.id === s) ? { said } : {},
      ...facts.includes(s) && evidence !== "" ? { evidence, ...seen !== void 0 ? { seen } : {} } : {}
    });
    const p = itemProgress2({ met }, flow);
    const status = p.whose === "done" ? "done" : x["status"] === "done" || x["status"] === "dropped" ? x["status"] : was?.status === "held" ? "held" : "open";
    const next = typeof x["next"] === "string" ? x["next"].trim() : was?.next ?? "";
    events.push({
      t: "item",
      turn,
      at,
      id: was?.id ?? newId(n),
      flow: flow.name,
      title,
      state: p.here ?? finalOf(flow),
      needs: typeof x["needs"] === "string" ? x["needs"].trim() : was?.needs ?? "",
      goal: typeof x["goal"] === "string" ? x["goal"].trim() : was?.goal ?? "",
      status,
      met,
      ...next !== "" ? { next } : {}
    });
  });
  return { events, errors };
}
function seenIn(evidence, runs) {
  const quoted2 = [...evidence.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter((q) => q !== "");
  const named2 = (r) => {
    const command = r.command.trim();
    return command !== "" && (evidence.includes(command) || quoted2.some((q) => command.includes(q)));
  };
  return [...runs].reverse().find(named2);
}
function turnItem(items, session) {
  return items.find((x) => x.status === "open" && x.session === session);
}

// src/core/board-page.ts
var SAY_ZH = (key, ...args) => key.replace(/\{(\d+)\}/g, (hole, n) => args[Number(n)] !== void 0 ? String(args[Number(n)]) : hole);
var SHOWN = { items: 12, artifacts: 5, decisions: 5 };
function literal(text) {
  return text.replace(/\s*\r?\n\s*/g, " ").replace(/[\\*`~$[\]|{}%!#<>_]/g, (c) => `\\${c}`);
}
var target = (href) => href.replace(/[ ()]/g, (c) => encodeURIComponent(c));
var label = (text) => text.replace(/"/g, "'").replace(/[\r\n]+/g, " ");
var JUDGE_WORDS = { fact: "\u4E8B\u5B9E", you: "\u4F60\u5224", model: "\u6A21\u578B\u5224" };
var named = (i) => `\\#${i.id} ${literal(i.title)}`;
function stepsLine(i, flow) {
  const p = itemProgress2(i, flow);
  return flow.states.filter((s) => !s.final).map((s) => {
    const cell = p.cells.find((c) => c.id === s.id)?.cell;
    return cell === "here" ? `**${literal(s.title)}**` : cell === "met" ? `${literal(s.title)} \u2713` : literal(s.title);
  }).join(" \u2192 ");
}
var sayOne = (answers, t) => answers.map((a) => t("\u300C{0}\u300D", literal(a))).join(t("\u6216"));
function waitingOf(flows, items, asks, proposals, t = SAY_ZH) {
  const out = [];
  for (const q of asks) {
    const item = q.item !== void 0 ? items.find((x) => x.id === q.item) : void 0;
    out.push({ ...item !== void 0 ? { item } : { label: t("\u63D0\u95EE") }, ask: q.question, say: q.options });
  }
  for (const item of items) {
    const flow = flows.find((f) => f.name === item.flow);
    if (flow === void 0 || item.status !== "open") continue;
    const p = itemProgress2(item, flow);
    const step = flow.states.find((s) => s.id === p.here);
    if (p.whose !== "you" || step === void 0) continue;
    out.push({ item, ask: t("{0}\uFF1A{1}", step.title, step.need), say: step.answers ?? [t("\u597D\u4E86"), t("\u6CA1\u597D")] });
  }
  for (const p of proposals.filter((x) => x.status === "open")) {
    const what = p.kind === "new-flow" ? t("\u65B0\u7684\u4E00\u7C7B\u6D3B\u300C{0}\u300D\uFF1A{1}", p.title ?? p.flow, (p.steps ?? []).map((s) => s.title).join(" \u2192 ")) : p.kind === "add-step" ? t("{0} \u52A0\u4E00\u6B65\u300C{1}\u300D", p.flow, p.step?.title ?? "") : t("{0} \u53BB\u6389\u300C{1}\u300D", p.flow, p.remove ?? "");
    const name = p.title ?? p.step?.title ?? p.remove ?? p.flow;
    out.push({ label: t("\u63D0\u8BAE {0}", p.id), ask: `${what}${p.why !== "" ? t("\uFF08{0}\uFF09", p.why) : ""}`, say: [t("\u52A0\u4E0A{0}", name), t("\u4E0D\u7528{0}", name)] });
  }
  return out;
}
function waitingRows(i, open, t) {
  return waitingOf(i.flows, open, i.asks, i.proposals, t).map((w) => `| ${w.item !== void 0 ? `\\#${w.item.id} ${literal(w.item.title)}` : literal(w.label ?? "")} | ${literal(w.ask)} | ${sayOne(w.say, t)} |`);
}
function table(head, rows, id, none) {
  if (rows.length === 0) return [none];
  const cells = head.split("|").filter((c) => c.trim() !== "").length;
  return [`=== table {#${id}}`, head, `|${"---|".repeat(cells)}`, ...rows, "==="];
}
function flowPicture2(flow, on, t) {
  const here = /* @__PURE__ */ new Map();
  for (const item of on) {
    const at = itemProgress2(item, flow).here;
    if (at !== null) here.set(at, [...here.get(at) ?? [], item]);
  }
  const node = (s, n) => s.final ? `s${n}(["${label(s.title)}"])` : `s${n}["${label(s.title)} \xB7 ${t(JUDGE_WORDS[s.judge])}"]${here.has(s.id) ? ":::here" : ""}`;
  const steps = [...flow.states.filter((s) => !s.final), ...flow.states.filter((s) => s.final)];
  const caption = [...here.entries()].map(([step, items]) => t("{0} \u5728{1}", items.map((x) => `#${x.id}`).join(t("\u3001")), flow.states.find((s) => s.id === step)?.title ?? step)).join(t("\uFF1B"));
  return [
    `=== diagram {#flow-${flow.name} format=mermaid caption="${label(t("{0}\uFF1A{1}", flow.title, caption))}"}`,
    "graph LR",
    `  ${steps.map(node).join(" --> ")}`,
    "  classDef here stroke-width:3px",
    "==="
  ];
}
function boardPage(i) {
  const t = i.t ?? SAY_ZH;
  const open = i.items.filter((x) => x.status === "open" || x.status === "held").slice(0, SHOWN.items);
  const out = [
    "=== meta",
    `title = "${label(t("Gemworks \u770B\u677F \xB7 {0}", i.project))}"`,
    `updated = "${label(i.updated)}"`,
    "===",
    "",
    "=== note",
    t("Gemworks \u6BCF\u56DE\u5408\u6539\u5199\u8FD9\u4E00\u9875\u3002VS Code \u7CFB\u7F16\u8F91\u5668\u91CC\u6253\u5F00\u9884\u89C8\u4F1A\u81EA\u52A8\u5237\u65B0\uFF1B\u6D4F\u89C8\u5668\u91CC\u6309 F5 \u5237\u65B0\u3002\u4E0B\u9762\u8981\u4F60\u5B9A\u7684\u4E8B\uFF0C\u90FD\u5728\u5BF9\u8BDD\u91CC\u56DE\u7B54\u3002"),
    "===",
    "",
    `# ${t("\u7B49\u4F60")} {#waiting}`,
    "",
    ...table(`| ${t("\u4E8B\u9879")} | ${t("\u8981\u4F60\u5B9A")} | ${t("\u5728\u5BF9\u8BDD\u91CC\u8BF4")} |`, waitingRows(i, open, t), "asks", t("\u6CA1\u6709\u8981\u4F60\u5B9A\u7684\u4E8B\u3002")),
    "",
    `# ${t("\u5DE5\u4F5C\u9879")} {#items}`,
    ""
  ];
  const itemRows = open.flatMap((item) => {
    const flow = i.flows.find((f) => f.name === item.flow);
    if (flow === void 0) return [];
    const where = `${stepsLine(item, flow)}${item.status === "held" ? t("\uFF08\u6682\u7F13\uFF09") : ""}`;
    return [`| ${named(item)} | ${literal(flow.title)} | ${where} | ${literal(item.needs)} | ${literal(item.next)} |`];
  });
  out.push(...table(`| ${t("\u5DE5\u4F5C\u9879")} | ${t("\u6D41\u7A0B")} | ${t("\u5728\u54EA\u4E00\u6B65")} | ${t("\u8FD8\u8981\u4EC0\u4E48")} | ${t("\u63A5\u4E0B\u6765")} |`, itemRows, "work", t("\u6CA1\u6709\u8FDB\u884C\u4E2D\u7684\u5DE5\u4F5C\u9879\u3002")));
  const practiced = open.flatMap((item) => {
    const flow = i.flows.find((f) => f.name === item.flow);
    const here = flow !== void 0 && item.status === "open" ? itemProgress2(item, flow).here : null;
    const at = flow !== void 0 && here !== null ? practicesAt(i.practices, flow.name, here) : [];
    if (flow === void 0 || here === null || at.length === 0) return [];
    return ["", t("{0} \u5728\u300C{1}\u300D\uFF1A", named(item), literal(flow.states.find((s) => s.id === here)?.title ?? here)), "", ...at.map((p, n) => `${n + 1}. ${literal(p.text)}`)];
  });
  if (practiced.length > 0) out.push("", `## ${t("\u8FD9\u4E00\u6B65\u7684\u505A\u6CD5")} {#practices}`, ...practiced);
  out.push("", `# ${t("\u4EA7\u7269")} {#made}`, "");
  const made = open.flatMap((item) => artifactsOfItem(i.artifacts, item.id).slice(0, SHOWN.artifacts).map((a) => {
    const last = a.versions.at(-1);
    const bare = a.name.replace(/`/g, "");
    const name = literal(a.kind === "link" ? bare : bare.split(/[\\/]/).at(-1) ?? bare);
    const href = i.linkOf(last);
    return `| ${named(item)} | ${href !== void 0 ? `[${name}](${target(href)})` : name} | ${literal(last.version)} | ${i.clock(last.at)} |`;
  }));
  out.push(...table(`| ${t("\u5DE5\u4F5C\u9879")} | ${t("\u4EA7\u7269")} | ${t("\u7248\u672C")} | ${t("\u65F6\u95F4")} |`, made, "artifacts", t("\u8FD8\u6CA1\u6709\u4EA7\u7269\u3002")));
  out.push("", `# ${t("\u6D41\u7A0B")} {#flow}`, "");
  const pictured = i.flows.flatMap((flow) => {
    const on = open.filter((x) => x.flow === flow.name && x.status === "open");
    return on.length > 0 ? [...flowPicture2(flow, on, t), ""] : [];
  });
  out.push(...pictured.length > 0 ? pictured.slice(0, -1) : [t("\u6CA1\u6709\u5DE5\u4F5C\u9879\u5728\u6D41\u7A0B\u4E0A\u3002")]);
  const decided = i.decisions.slice(-SHOWN.decisions).reverse();
  out.push("", `# ${t("\u522B\u7684\u4F1A\u8BDD\u7684\u51B3\u5B9A")} {#decisions}`, "");
  out.push(...decided.length > 0 ? decided.map((d) => `- ${t("{0}\uFF08{1}\uFF0C{2}\uFF09", literal(d.text), literal(i.hostName(d.host)), i.clock(d.at))}`) : [t("\u8FD8\u6CA1\u6709\u3002")]);
  return `${out.join("\n")}
`;
}

// src/hosts/claude-code/open-file.ts
var OPEN_PATH_VAR = "GEMWORKS_OPEN_PATH";
var POWERSHELL = ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command"];
var WIN_OPEN = `Start-Process -FilePath $env:${OPEN_PATH_VAR} -WindowStyle Normal`;
var WIN_REVEAL = `Start-Process -FilePath explorer.exe -ArgumentList ('/select,' + [char]34 + $env:${OPEN_PATH_VAR} + [char]34) -WindowStyle Normal`;
var START_VAR = "GEMWORKS_START";
var CMD_START = ["cmd.exe", "/d", "/c", "start", `%${START_VAR}%`];
function winStart(...args) {
  return { argv: CMD_START, env: { [START_VAR]: ['""', ...args.map((a) => `"${a}"`)].join(" ") } };
}
var IN_BROWSER = /* @__PURE__ */ new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif", "html", "htm", "pdf", "txt", "json", "geml"]);
function opensInBrowser(path) {
  const ext = /\.([A-Za-z0-9]+)$/.exec(baseName(path))?.[1];
  return ext !== void 0 && IN_BROWSER.has(ext.toLowerCase());
}
function fileUrl(path) {
  const p = path.split("\\").join("/");
  const segments = p.split("/").map((s, i) => i === 0 && /^[A-Za-z]:$/.test(s) ? s : encodeURIComponent(s)).join("/");
  return p.startsWith("/") ? `file://${segments}` : `file:///${segments}`;
}
var BROWSER_PROGID_ARGV = ["reg", "query", "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice", "/v", "ProgId"];
function progIdOf(out) {
  return /ProgId\s+REG_SZ\s+(\S+)/.exec(out)?.[1];
}
function browserCommandArgv(progId) {
  return ["reg", "query", `HKCR\\${progId}\\shell\\open\\command`, "/ve"];
}
function browserExeOf(out) {
  const line = /REG_(?:EXPAND_)?SZ\s+(.+)$/m.exec(out)?.[1]?.trim();
  if (line === void 0 || line === "") return void 0;
  const exe = line.startsWith('"') ? line.slice(1, line.indexOf('"', 1)) : line.split(/\s+/)[0] ?? "";
  return /\.exe$/i.test(exe) ? exe : void 0;
}
function folderOf(path) {
  const p = path.split("\\").join("/").replace(/\/+$/, "");
  const cut = p.lastIndexOf("/");
  return cut <= 0 ? "/" : p.slice(0, cut);
}
function openersFor(platform, path, reveal = false, browser) {
  const os = platform ?? (/^[A-Za-z]:[\\/]/.test(path) || path.startsWith("\\\\") ? "win32" : void 0);
  if (os === "win32") {
    const win = path.split("/").join("\\");
    const shell = { argv: [...POWERSHELL, reveal ? WIN_REVEAL : WIN_OPEN], env: { [OPEN_PATH_VAR]: win } };
    if (reveal) return [shell];
    const inBrowser = browser !== void 0 && opensInBrowser(path) ? [winStart(browser, fileUrl(path))] : [];
    return [...inBrowser, winStart(win), shell];
  }
  const mac = { argv: reveal ? ["open", "-R", path] : ["open", path] };
  if (os === "darwin") return [mac];
  const xdg = { argv: ["xdg-open", reveal ? folderOf(path) : path] };
  return os === void 0 ? [xdg, mac] : [xdg];
}
function baseName(path) {
  const p = path.split("\\").join("/").replace(/\/+$/, "");
  return p.slice(p.lastIndexOf("/") + 1) || p;
}

// src/loop.ts
import { mkdirSync as mkdirSync5, readdirSync as readdirSync4, readFileSync as readFileSync5, writeFileSync as writeFileSync5 } from "node:fs";
import { dirname as dirname5, join as join9 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/core/ask-tool.ts
var MOST_OPTIONS = 4;
var ASK_TOOL = {
  name: "ask",
  description: "Register a question this turn ends with, for the person to answer from the status band: the question in full, its real answers (two to four, short, in the reply's language), and the one you recommend. Call it once per question, before the turn ends, whenever the reply asks the person to decide something; several questions are asked one by one. Do not register a question you answered yourself or one that needs no answer.",
  inputSchema: {
    type: "object",
    properties: {
      question: { type: "string", description: "The question, whole, as the person should read it." },
      options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: MOST_OPTIONS, description: "The answers the person can give, each a few words." },
      recommended: { type: "string", description: "The answer you recommend: one of options." },
      item: { type: "string", description: "The work item on the way this question is about, by its id; leave it out when it is about none. The question then stands under that item on the board until answered." }
    },
    required: ["question", "options"],
    additionalProperties: false
  }
};
function askedOf(input) {
  const question = typeof input["question"] === "string" ? input["question"].trim() : "";
  if (question === "") return { error: "question is empty" };
  const given = Array.isArray(input["options"]) ? input["options"].filter((o) => typeof o === "string").map((o) => o.trim()).filter((o) => o !== "") : [];
  const options = [...new Set(given)];
  if (options.length < 2 || options.length > MOST_OPTIONS) return { error: `options are two to ${MOST_OPTIONS} answers` };
  const recommended = typeof input["recommended"] === "string" ? input["recommended"].trim() : "";
  if (recommended !== "" && !options.includes(recommended)) return { error: "recommended is one of options" };
  const ordered = recommended === "" ? options : [recommended, ...options.filter((o) => o !== recommended)];
  const item = typeof input["item"] === "string" ? input["item"].trim().replace(/^#/, "") : "";
  return { question, options: ordered, ...recommended !== "" ? { recommended } : {}, ...item !== "" ? { item } : {} };
}
var ASK_TOOL_ON_BOARD = {
  ...ASK_TOOL,
  description: "Register a question this turn ends with, so the Gemworks board lists it with its answers until the person's next prompt: the question in full, its real answers (two to four, short, in the reply's language), and the one you recommend. Ask it in your reply as well: the person answers in the conversation. Call it once per question, before the turn ends; do not register a question you answered yourself or one that needs no answer."
};
var ASK_PROMPT_ON_BOARD = "Gemworks: when a turn ends asking the person to decide something, ask it in your reply and register each question with the gemworks `ask` tool before the turn ends: the question in full, its real answers (two to four, short, in the reply's language) and the one you recommend. The Gemworks board lists a registered question with its answers until the person's next prompt; they answer in the conversation.";

// src/core/growth.ts
function parseLines(text, block2, is) {
  const lines = text.split(/\r?\n/);
  const open = lines.findIndex((l) => l.trim() === `=== data {#${block2} format=jsonl}`);
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
var linesText = (title, block2, records) => `=== meta
title = "${title}"
===

=== data {#${block2} format=jsonl}
${records.map((r) => `${JSON.stringify(r)}
`).join("")}===
`;
var isObj3 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var str3 = (v) => typeof v === "string" ? v : "";
var JUDGES2 = ["fact", "you", "model"];
var isStep = (v) => isObj3(v) && ["id", "title", "need", "prevents"].every((k) => typeof v[k] === "string") && JUDGES2.includes(v["judge"]);
var isProposal = (v) => isObj3(v) && ["id", "flow", "why", "at"].every((k) => typeof v[k] === "string") && ["add-step", "remove-step", "new-flow"].includes(v["kind"]) && ["model", "gemworks", "reference"].includes(v["by"]) && ["open", "accepted", "declined"].includes(v["status"]) && (v["step"] === void 0 || isStep(v["step"])) && (v["steps"] === void 0 || Array.isArray(v["steps"]) && v["steps"].every(isStep));
var parseProposals = (text) => parseLines(text, "proposals", isProposal);
var proposalsText = (list) => linesText("\u63D0\u8BAE", "proposals", list);
function stepId(title, taken) {
  const ascii = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let base = ascii;
  if (base === "") {
    let h = 0;
    for (const ch of title) h = h * 31 + (ch.codePointAt(0) ?? 0) >>> 0;
    base = `s${h.toString(36).slice(0, 5)}`;
  }
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}
function newProposals(given, flows, kept, at, newId) {
  const added = [];
  const errors = [];
  const stepOf = (x, taken) => {
    const title = str3(x["title"]).trim();
    if (title === "") return void 0;
    const judge = JUDGES2.includes(x["judge"]) ? x["judge"] : "model";
    const step = { id: stepId(title, taken), title, need: str3(x["need"]).trim(), judge, prevents: str3(x["prevents"]).trim() };
    taken.push(step.id);
    return step;
  };
  given.forEach((v, n) => {
    if (!isObj3(v)) {
      errors.push(`proposal ${n + 1} is not an object`);
      return;
    }
    const why = str3(v["why"]).trim();
    if (v["kind"] === "add-step") {
      const flow = flows.find((f) => f.name === str3(v["flow"]));
      if (flow === void 0) {
        errors.push(`proposal ${n + 1}: no flow "${str3(v["flow"])}"`);
        return;
      }
      const after = str3(v["after"]);
      if (!flow.states.some((s) => s.id === after && !s.final)) {
        errors.push(`proposal ${n + 1}: ${flow.name} has no step "${after}" to add after`);
        return;
      }
      const step = stepOf(v, flow.states.map((s) => s.id));
      if (step === void 0) {
        errors.push(`proposal ${n + 1} names no step title`);
        return;
      }
      if ([...kept, ...added].some((p) => p.kind === "add-step" && p.flow === flow.name && p.step?.title === step.title)) {
        errors.push(`proposal ${n + 1}: already proposed`);
        return;
      }
      added.push({ id: newId(n), kind: "add-step", flow: flow.name, after, step, why, at, by: "model", status: "open" });
    } else if (v["kind"] === "new-flow") {
      const title = str3(v["title"]).trim();
      const raw = Array.isArray(v["steps"]) ? v["steps"] : [];
      const taken = ["done"];
      const steps = raw.flatMap((x) => isObj3(x) ? [stepOf(x, taken)] : []).filter((s) => s !== void 0);
      if (title === "" || steps.length === 0) {
        errors.push(`proposal ${n + 1}: a new kind of work needs its title and its steps`);
        return;
      }
      const name = stepId(str3(v["name"]) || title, flows.map((f) => f.name));
      if ([...kept, ...added].some((p) => p.kind === "new-flow" && p.title === title)) {
        errors.push(`proposal ${n + 1}: already proposed`);
        return;
      }
      added.push({ id: newId(n), kind: "new-flow", flow: name, title, steps, why, at, by: "model", status: "open" });
    } else errors.push(`proposal ${n + 1}: kind must be add-step or new-flow`);
  });
  return { added, errors };
}
var toState = (s) => ({ id: s.id, title: s.title, need: s.need, final: false, judge: s.judge, prevents: s.prevents, answers: null });
function applyToFlow(flow, p) {
  if (p.kind === "add-step" && p.after !== void 0 && p.step !== void 0) {
    const at = flow.states.findIndex((s) => s.id === p.after);
    const step = toState(p.step);
    const states = [...flow.states.slice(0, at + 1), step, ...flow.states.slice(at + 1)];
    const next = flow.states[at + 1]?.id;
    const edges = flow.edges.flatMap((e) => e.from === p.after && e.to === next && !e.back ? [{ ...e, to: step.id }, { from: step.id, to: next, label: "", back: false }] : [e]);
    return { ...flow, states, edges };
  }
  if (p.kind === "remove-step" && p.remove !== void 0) {
    const gone = p.remove;
    const into = flow.edges.filter((e) => e.to === gone && !e.back).map((e) => e.from);
    const out = flow.edges.filter((e) => e.from === gone && !e.back).map((e) => e.to);
    const kept = flow.edges.filter((e) => e.from !== gone && e.to !== gone);
    const joined2 = into.flatMap((a) => out.map((b) => ({ from: a, to: b, label: "", back: false })));
    const backs = flow.edges.filter((e) => e.back && e.to === gone).map((e) => ({ ...e, to: out[0] ?? e.to })).filter((e) => e.to !== gone);
    return { ...flow, states: flow.states.filter((s) => s.id !== gone), edges: [...kept, ...joined2, ...backs] };
  }
  return flow;
}
function newFlow(p) {
  const steps = (p.steps ?? []).map(toState);
  const states = [...steps, { id: "done", title: "\u5B8C\u6210", need: "", final: true, judge: "model", prevents: "", answers: null }];
  const edges = states.slice(1).map((s, i) => ({ from: states[i].id, to: s.id, label: "", back: false }));
  return { name: p.flow, title: p.title ?? p.flow, states, edges };
}
function flowText(flow) {
  const states = Object.fromEntries(flow.states.map((s) => [s.id, s.final ? { title: s.title, final: true } : { title: s.title, description: s.need, judge: s.judge, ...s.prevents !== "" ? { prevents: s.prevents } : {}, ...s.answers !== null ? { answers: s.answers } : {}, ...s.expires === true ? { expires: true } : {} }]));
  const transitions = flow.edges.map((e) => ({ from: e.from, to: e.to, ...e.label !== "" ? { guard: e.label } : {} }));
  const initial = flow.states.find((s) => !s.final)?.id ?? flow.states[0]?.id ?? "done";
  const json = JSON.stringify({ initial, states, transitions }, null, 2);
  return `=== meta
title   = "${flow.title}"
profile = "geml-statechart/v1"
===

=== diagram {#flow format=geml-statechart caption="${flow.title}"}
${json}
===
`;
}
var PROPOSE_TOOL = {
  name: "propose",
  description: "Propose a change to how the project's work goes, for the person to accept or decline on the flow tab: a step to add to a flow, when the same thing keeps being done at the same place in that kind of work and it prevents a pitfall; or a new kind of work, when several work items in a row fit none of the flows. Nothing changes until the person accepts.",
  inputSchema: {
    type: "object",
    properties: {
      proposals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["add-step", "new-flow"] },
            flow: { type: "string", description: "add-step: the flow, by its name." },
            after: { type: "string", description: "add-step: the step it comes after, by id." },
            title: { type: "string", description: "add-step: the new step's title; new-flow: the kind of work's title." },
            need: { type: "string", description: "add-step: what it needs to be left, a few words." },
            judge: { type: "string", enum: ["fact", "you", "model"], description: "add-step: who judges that requirement." },
            prevents: { type: "string", description: "add-step: the pitfall it prevents." },
            name: { type: "string", description: "new-flow: a short ascii name for it." },
            steps: { type: "array", items: { type: "object", properties: { title: { type: "string" }, need: { type: "string" }, judge: { type: "string", enum: ["fact", "you", "model"] }, prevents: { type: "string" } }, required: ["title"], additionalProperties: false }, description: "new-flow: its steps in order, as the work items that fit none actually went." },
            why: { type: "string", description: "What you saw: the work items or the incidents behind it." }
          },
          required: ["kind", "why"],
          additionalProperties: false
        }
      }
    },
    required: ["proposals"],
    additionalProperties: false
  }
};
var PROPOSE_TOOL_ON_BOARD = {
  ...PROPOSE_TOOL,
  description: PROPOSE_TOOL.description.replace("for the person to accept or decline on the flow tab", "for the person to accept or decline in the conversation (the Gemworks board lists it)")
};
var ANSWER_TOOL = {
  name: "answer",
  description: "Carry out the person's answer to a proposal the Gemworks board lists (a step to add or take out, a new kind of work): yes adds it to the project's flows, no declines it so it is not proposed again. Only with the person's own words, this turn, in said; never on your own judgement.",
  inputSchema: {
    type: "object",
    properties: {
      proposal: { type: "string", description: "The proposal, by its id as the board lists it." },
      yes: { type: "boolean", description: "true to accept it, false to decline it." },
      said: { type: "string", description: "The person's own words, this turn, that answer it, e.g. \u300C\u52A0\u4E0A\u5199\u89C4\u8303\u300D." }
    },
    required: ["proposal", "yes", "said"],
    additionalProperties: false
  }
};
var GROWTH_PROMPT_ON_BOARD = "Gemworks: the flows grow from what happens here. When the same thing keeps being done at the same place in a kind of work, or several work items in a row fit none of the flows, propose it with the gemworks `propose` tool. The person answers a proposal in the conversation: when they say to add it or not, carry it out with the gemworks `answer` tool, their words in `said`.";

// src/core/practice-tool.ts
var PRACTICE_TOOL = {
  name: "practice",
  description: "Record what this project has learned about doing its work, each on the step of a flow it belongs to, so it reminds whoever comes to that step next. Record one when a turn paid a price \u2014 a way back, a failed test or CI, the person saying it is not fixed, the person correcting you, a rule blocking a call \u2014 as what would have avoided it; or when the person tells you how they want something done. A practice reminds; it never blocks.",
  inputSchema: {
    type: "object",
    properties: {
      practices: {
        type: "array",
        items: {
          type: "object",
          properties: {
            flow: { type: "string", description: "The flow it belongs to, by its name; * for every flow." },
            step: { type: "string", description: "The step's id in that flow; * for every step (with flow *, any time)." },
            text: { type: "string", description: "What to do, one short sentence in the person's language." },
            why: { type: "string", description: "The incident it came from: when, and what it cost, in a few words." },
            layer: { type: "string", enum: ["personal", "project"], description: "personal for how this person wants work done in every project; project for this repository's own." },
            ref: { type: "string", description: "Where a file read every turn already keeps its text, as file#heading (CLAUDE.md#build-and-check); the text then stays there." },
            from: { type: "string", description: "Its source when it is moved, as memory:<file>." }
          },
          required: ["text", "layer"],
          additionalProperties: false
        }
      },
      memory: { type: "boolean", description: "true on the calls that move the project's memory in (asked once, on first start)." }
    },
    required: ["practices"],
    additionalProperties: false
  }
};
var PRACTICE_PROMPT = "Gemworks: when a turn paid a price (a way back, a failed test or CI, the person saying it is not fixed, the person correcting you, a rule blocking a call), record what would have avoided it with the gemworks `practice` tool, on the step it happened at; also when the person tells you how they want something done. Practices only remind. Beside a prompt you are shown the practices of the step your work item stands at: follow them.";
function practiceContext(items, flows, practices, session) {
  const i = turnItem(items, session);
  const flow = flows.find((f) => f.name === i?.flow);
  if (i === void 0 || flow === void 0) return [];
  const here = itemProgress2(i, flow).here;
  if (here === null) return [];
  const at = practicesAt(practices, flow.name, here);
  if (at.length === 0) return [];
  const step = flow.states.find((s) => s.id === here)?.title ?? here;
  return [`[gemworks] at ${flow.name} ${here} ${step} for \xAB${i.title}\xBB, the practices: ${at.map((p, n) => `(${n + 1}) ${p.text}${p.ref !== void 0 ? ` [${p.ref}]` : ""}`).join(" ")}`];
}

// src/loop.ts
var SHIPPED_COACH = fileURLToPath2(new URL("../coach/", import.meta.url));
var LOOP_TOOLS = [WORK_TOOL, PRACTICE_TOOL, PROPOSE_TOOL_ON_BOARD, ANSWER_TOOL, ASK_TOOL_ON_BOARD, ARTIFACT_TOOL];
var isLoopTool = (name) => LOOP_TOOLS.some((t) => t.name === name);
var gemlHome = (root) => join9(journalBaseOf(root), GEML_DIR);
var readAt = (path) => {
  try {
    return readFileSync5(path, "utf8");
  } catch {
    return void 0;
  }
};
var stampOf = (at) => Date.parse(at).toString(36).slice(-6);
function coachFlowsAt(root, shipped = SHIPPED_COACH) {
  const own = join9(gemlHome(root), "coach");
  const flows = [];
  for (const name of COACH_FLOWS) {
    const shippedText = readAt(join9(shipped, `${name}.geml`));
    const reference = shippedText !== void 0 ? readCoachFlow(name, shippedText) : void 0;
    const ownText = readAt(join9(own, `${name}.geml`));
    const teamText = ownText === void 0 ? readAt(join9(root, ".gemworks", "flows", `${name}.geml`)) : void 0;
    const flow = (ownText !== void 0 ? readCoachFlow(name, ownText, reference) : teamText !== void 0 ? readCoachFlow(name, teamText, reference) : void 0) ?? reference;
    if (flow !== void 0) flows.push(flow);
  }
  let added = [];
  try {
    added = readdirSync4(own).filter((n) => n.endsWith(".geml") && !COACH_FLOWS.includes(n.slice(0, -".geml".length))).sort();
  } catch {
  }
  for (const file of added) {
    const text = readAt(join9(own, file));
    const flow = text !== void 0 ? readCoachFlow(file.slice(0, -".geml".length), text) : void 0;
    if (flow !== void 0) flows.push(flow);
  }
  return flows;
}
function workItemsAt(root, flows) {
  return workItemsOf(readSessions(root), flows);
}
function recordWork(root, host, session, args, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const flows = coachFlowsAt(root);
  if (flows.length === 0) return { ok: false, text: "Nothing recorded: this project has no flows to report work items on." };
  const items = workItemsAt(root, flows);
  const stamp = stampOf(now);
  let errors = [];
  let made = [];
  appendSession(root, host, session, (so) => {
    const r = workEvents(args, flows, items, now, currentTurn(so), (n) => `${stamp}${n}`);
    errors = r.errors;
    made = r.events;
    return r.events;
  }, now);
  if (made.length === 0) return { ok: false, text: `Nothing recorded: ${errors.join("; ") || "items is a list of work items"}.` };
  try {
    writeSignoffs(root, made.flatMap((e) => e.t === "item" ? [e.id] : []));
  } catch {
  }
  const said = made.map((e) => e.t === "item" ? `#${e.id} \xAB${e.title}\xBB (${e.flow}: ${e.state}${e.status !== "open" ? `, ${e.status}` : ""})` : "").join("; ");
  return { ok: true, text: `Recorded ${said}.${errors.length > 0 ? ` Left out: ${errors.join("; ")}.` : ""}` };
}
function recordPractices(root, host, session, args, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const given = Array.isArray(args["practices"]) ? args["practices"] : [];
  const memory = args["memory"] === true;
  const flows = coachFlowsAt(root);
  const kept = readPractices(root).practices;
  const stamp = stampOf(now);
  const turn = currentTurn(appendSession(root, host, session, () => [], now));
  const r = newPractices(given, kept, now, memory ? "memory" : "model", (n) => `p${stamp}${n}`, flows.map((f) => ({ name: f.name, steps: f.states.map((s) => s.id) })), { session, turn });
  if (r.added.length === 0 && !memory) return { ok: false, text: `Nothing recorded: ${r.errors.join("; ") || "practices is a list"}.` };
  writePractices(root, r.added, memory);
  return { ok: true, text: `Recorded ${r.added.length} practice${r.added.length === 1 ? "" : "s"}; they remind at their steps.${r.errors.length > 0 ? ` Left out: ${r.errors.join("; ")}.` : ""}` };
}
function proposalsAt(root) {
  const text = readAt(join9(gemlHome(root), "proposals.geml"));
  return text !== void 0 ? parseProposals(text) : [];
}
function saveProposals(root, list) {
  const path = join9(gemlHome(root), "proposals.geml");
  mkdirSync5(dirname5(path), { recursive: true });
  writeFileSync5(path, proposalsText(list), "utf8");
}
function recordProposals(root, args, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const given = Array.isArray(args["proposals"]) ? args["proposals"] : [];
  const kept = proposalsAt(root);
  const stamp = stampOf(now);
  const r = newProposals(given, coachFlowsAt(root), kept, now, (n) => `q${stamp}${n}`);
  if (r.added.length === 0) return { ok: false, text: `Nothing recorded: ${r.errors.join("; ") || "proposals is a list"}.` };
  saveProposals(root, [...kept, ...r.added]);
  return { ok: true, text: `Proposed ${r.added.length} (${r.added.map((p) => p.id).join(", ")}); the person answers in the conversation.${r.errors.length > 0 ? ` Left out: ${r.errors.join("; ")}.` : ""}` };
}
function answerProposal(root, args) {
  const id = typeof args["proposal"] === "string" ? args["proposal"].trim().replace(/^#/, "") : "";
  const said = typeof args["said"] === "string" ? args["said"].trim() : "";
  if (typeof args["yes"] !== "boolean") return { ok: false, text: "Nothing done: yes is true or false." };
  if (said === "") return { ok: false, text: "Nothing done: a proposal is answered only with the person's own words in said." };
  const list = proposalsAt(root);
  const p = list.find((x) => x.id === id);
  if (p === void 0 || p.status !== "open") return { ok: false, text: `Nothing done: no open proposal ${id} (open: ${list.filter((x) => x.status === "open").map((x) => x.id).join(", ") || "none"}).` };
  const yes = args["yes"];
  if (yes) {
    const flow = p.kind === "new-flow" ? newFlow(p) : coachFlowsAt(root).find((f) => f.name === p.flow);
    if (flow === void 0) return { ok: false, text: `Nothing done: there is no flow ${p.flow} to change.` };
    const path = join9(gemlHome(root), "coach", `${flow.name}.geml`);
    mkdirSync5(dirname5(path), { recursive: true });
    writeFileSync5(path, flowText(p.kind === "new-flow" ? flow : applyToFlow(flow, p)), "utf8");
  }
  saveProposals(root, list.map((x) => x.id === p.id ? { ...x, status: yes ? "accepted" : "declined" } : x));
  return { ok: true, text: yes ? `Accepted ${p.id}: ${p.kind === "new-flow" ? `the flow ${p.flow} is added` : `the flow ${p.flow} is changed`}.` : `Declined ${p.id}; it is not proposed again.` };
}
function recordAsk(root, host, session, args, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const asked = askedOf(args);
  if ("error" in asked) return { ok: false, text: `Not registered: ${asked.error}.` };
  appendSession(root, host, session, (so) => [{
    t: "ask",
    turn: currentTurn(so),
    at: now,
    question: asked.question,
    options: asked.options,
    ...asked.recommended !== void 0 ? { recommended: asked.recommended } : {},
    ...asked.item !== void 0 ? { item: asked.item } : {}
  }], now);
  return { ok: true, text: "Registered: the Gemworks board lists it until the person's next prompt; ask it in your reply too." };
}
async function recordArtifact(root, session, args) {
  const kind = args["kind"];
  const where = typeof args["where"] === "string" ? args["where"].trim() : "";
  if (kind !== "link" && kind !== "image" && kind !== "file" || where === "") return { ok: false, text: "Nothing recorded: kind is link, image or file, and where is the address or the path." };
  const status = await handleRequest({ v: 1, root, op: "status" }).catch(() => void 0);
  let on;
  if (status !== void 0 && status.ok && status.shell.status?.item.kind === "item") on = {};
  else {
    const item = turnItem(workItemsAt(root, coachFlowsAt(root)), session);
    if (item !== void 0) on = { item: item.id };
  }
  if (on === void 0) return { ok: false, text: "Nothing recorded: no work item is on the way in this session; report the one this is for with the work tool first." };
  const name = typeof args["name"] === "string" ? args["name"] : void 0;
  const version = typeof args["version"] === "string" ? args["version"] : void 0;
  const res = await handleRequest({ v: 1, root, op: "artifact", ...on, kind, where, ...name !== void 0 ? { name } : {}, ...version !== void 0 ? { version } : {} }).catch((e) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  if (!res.ok) return { ok: false, text: `Nothing recorded: ${res.error.replace(/^gemworks: /, "")}` };
  return { ok: true, text: res.text ?? "Recorded." };
}
async function callLoopTool(root, host, session, name, args, now = (/* @__PURE__ */ new Date()).toISOString()) {
  try {
    switch (name) {
      case WORK_TOOL.name:
        return recordWork(root, host, session, args, now);
      case PRACTICE_TOOL.name:
        return recordPractices(root, host, session, args, now);
      case PROPOSE_TOOL_ON_BOARD.name:
        return recordProposals(root, args, now);
      case ANSWER_TOOL.name:
        return answerProposal(root, args);
      case ASK_TOOL_ON_BOARD.name:
        return recordAsk(root, host, session, args, now);
      case ARTIFACT_TOOL.name:
        return await recordArtifact(root, session, args);
      default:
        return void 0;
    }
  } catch (e) {
    return { ok: false, text: `gemworks: ${e instanceof Error ? e.message : String(e)}` };
  }
}
function loopPrompt(flows) {
  return flows.length === 0 ? [ASK_PROMPT_ON_BOARD] : [ASK_PROMPT_ON_BOARD, workPrompt(flows), PRACTICE_PROMPT, GROWTH_PROMPT_ON_BOARD];
}
function loopContext(root, session, flows = coachFlowsAt(root)) {
  if (flows.length === 0) return [];
  const items = workItemsAt(root, flows);
  let practices = [];
  try {
    practices = readPractices(root).practices;
  } catch {
  }
  return [...workContext(items, flows), ...practiceContext(items, flows, practices, session)];
}

// src/hosts/claude-code/coach.ts
function flowsIn(flows, t) {
  const say = (s) => s === "" ? "" : t(s);
  return flows.map((f) => ({
    ...f,
    title: say(f.title),
    states: f.states.map((s) => ({ ...s, title: say(s.title), need: say(s.need), prevents: say(s.prevents), answers: s.answers === null ? null : [say(s.answers[0]), say(s.answers[1])] }))
  }));
}

// src/board-file.ts
var BOARD_FILE = "board.geml";
function boardLang(env = process.env) {
  let system;
  try {
    system = Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
  }
  return langOf(env["GEMWORKS_LANG"], env["LC_ALL"] || env["LC_MESSAGES"] || env["LANG"] || system);
}
var boardPath = (root) => join10(gemlHome(root), BOARD_FILE);
var pad = (n) => String(n).padStart(2, "0");
var clock = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
var day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
function linkOf(row, home) {
  if (row.kind === "link") return /^https?:\/\//i.test(row.where) ? row.where : void 0;
  if (row.where === "git") return fileUrl(join10(home, row.name.replace(/`/g, "")));
  if (row.where.startsWith("artifacts/")) return fileUrl(join10(home, GEML_DIR, row.where));
  return isAbsolute3(row.where) ? fileUrl(row.where) : void 0;
}
function boardText(root, now = /* @__PURE__ */ new Date(), lang = boardLang()) {
  const home = journalBaseOf(root);
  const flows = coachFlowsAt(root);
  const t = wordsFor(lang);
  const sessions = readSessions(root).sort((a, b) => a.last < b.last ? 1 : a.last > b.last ? -1 : 0);
  const asks = sessions.flatMap((s) => (s.asks ?? []).map((q) => ({ question: q.question, options: q.options, ...q.item !== void 0 ? { item: q.item } : {} })));
  let practices = [];
  try {
    practices = readPractices(root).practices;
  } catch {
  }
  let artifacts = [];
  try {
    artifacts = readArtifactRows(home);
  } catch {
  }
  return boardPage({
    project: basename6(home),
    updated: day(now),
    flows: flowsIn(flows, t),
    items: workItemsAt(root, flows),
    asks,
    proposals: proposalsAt(root),
    practices,
    artifacts,
    decisions: decisionsFor(root, "", null, now.toISOString()),
    linkOf: (row) => linkOf(row, home),
    clock,
    hostName: hostLabel,
    t
  });
}
function writeBoard(root, now = /* @__PURE__ */ new Date(), lang = boardLang()) {
  try {
    const path = boardPath(root);
    const text = boardText(root, now, lang);
    let was = "";
    try {
      was = readFileSync6(path, "utf8");
    } catch {
    }
    const body = (s) => s.replace(/^updated = .*$/m, "");
    if (body(was) !== body(text)) {
      mkdirSync6(dirname6(path), { recursive: true });
      writeFileSync6(path, text, "utf8");
    }
    return path;
  } catch {
    return void 0;
  }
}
function windowsBrowser() {
  try {
    const id = progIdOf(spawnSync(BROWSER_PROGID_ARGV[0], BROWSER_PROGID_ARGV.slice(1), { encoding: "utf8", timeout: 3e3, windowsHide: true }).stdout ?? "");
    if (id === void 0) return void 0;
    const argv = browserCommandArgv(id);
    return browserExeOf(spawnSync(argv[0], argv.slice(1), { encoding: "utf8", timeout: 3e3, windowsHide: true }).stdout ?? "");
  } catch {
    return void 0;
  }
}
function boardHasWork(root) {
  try {
    return workItemsAt(root, coachFlowsAt(root)).some((i) => i.status === "open");
  } catch {
    return false;
  }
}
function openBoardOnce(root, session, platform = process.platform) {
  if (process.env["GEMWORKS_OPEN_BOARD"] === "0") {
    writeBoard(root);
    return void 0;
  }
  const mark = join10(tmpdir(), "gemworks-board", `${session.replace(/[^A-Za-z0-9._-]/g, "_")}.opened`);
  if (existsSync5(mark)) {
    writeBoard(root);
    return void 0;
  }
  try {
    mkdirSync6(dirname6(mark), { recursive: true });
    writeFileSync6(mark, (/* @__PURE__ */ new Date()).toISOString(), "utf8");
  } catch {
  }
  return openBoard(root, platform);
}
function openBoard(root, platform = process.platform) {
  const path = writeBoard(root);
  if (path === void 0) return void 0;
  try {
    const [first] = openersFor(platform, path, false, platform === "win32" ? windowsBrowser() : void 0);
    if (first === void 0) return void 0;
    const child = spawn(first.argv[0], first.argv.slice(1), { detached: true, stdio: "ignore", windowsHide: true, env: { ...process.env, ...first.env ?? {} } });
    child.on("error", () => {
    });
    child.unref();
    return path;
  } catch {
    return void 0;
  }
}

// src/core/signoff-page.ts
var JUDGE_WORDS2 = { fact: "\u4E8B\u5B9E", you: "\u4F60\u5224", model: "\u6A21\u578B\u5224" };
var quoted = (text) => text.replace(/"/g, "'").replace(/[\r\n]+/g, " ");
function grounds(m, judge, t, clock3) {
  if (judge === "you") {
    if (m.pressed === true) return m.said !== void 0 && m.said !== "" ? t("\u4F60\u6309\u4E86\u300C{0}\u300D", literal(m.said)) : t("\u4F60\u6309\u4E86\u786E\u8BA4");
    if (m.said !== void 0 && m.said !== "") return t("\u4F60\u7684\u539F\u8BDD\uFF1A\u300C{0}\u300D", literal(m.said));
    return t("\u8BB0\u4E3A\u5DF2\u8FC7");
  }
  if (judge === "fact") {
    if (m.evidence === void 0 || m.evidence === "") return t("\u53EA\u6709\u6A21\u578B\u7684\u62A5\u544A\uFF08\u7B2C {0} \u8F6E\uFF09", m.turn);
    const seen = m.seen !== void 0 ? t("\u672C\u4F1A\u8BDD\u770B\u5230 {0} \u9000\u51FA\u7801 {1}\uFF08{2}\uFF09", `\`${m.seen.command.replace(/`/g, "'")}\``, m.seen.exit, clock3(m.seen.at)) : t("\u672C\u4F1A\u8BDD\u6CA1\u770B\u5230\u8FD9\u6761\u547D\u4EE4");
    return `${t("\u6A21\u578B\u7ED9\u7684\u51ED\u636E\uFF1A{0}", literal(m.evidence))}${t("\uFF1B")}${seen}`;
  }
  return t("\u6A21\u578B\u5728\u7B2C {0} \u8F6E\u62A5\u544A\u505A\u5B8C", m.turn);
}
function signoffPage(i) {
  const t = i.t ?? SAY_ZH;
  const { item, flow } = i;
  const p = itemProgress2(item, flow);
  const steps = flow.states.filter((s) => !s.final);
  const done = item.status === "done" || p.whose === "done";
  const last = [...item.met].sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0).at(-1);
  const here = steps.find((s) => s.id === p.here);
  const status = done ? t("\u5DF2\u5B8C\u6210") : item.status === "dropped" ? t("\u5DF2\u653E\u4E0B") : item.status === "held" ? t("\u6682\u7F13") : t("\u8FDB\u884C\u4E2D");
  const out = [
    "=== meta",
    `title  = "${quoted(t("\u9A8C\u6536\u5355 \xB7 #{0} {1}", item.id, item.title))}"`,
    `item   = "${quoted(item.id)}"`,
    `flow   = "${quoted(flow.title)}"`,
    `status = "${quoted(status)}"`,
    `opened = "${quoted(i.day(i.opened))}"`,
    ...done && last !== void 0 ? [`closed = "${quoted(i.day(last.at))}"`] : [],
    "===",
    "",
    `# ${t("\u7ED3\u8BBA")} {#verdict}`,
    ""
  ];
  const verdict = done ? t("\u5DF2\u5B8C\u6210\uFF1A{0} \u6B65\u90FD\u8FC7\u4E86\u3002", steps.filter((s) => item.met.some((m) => m.step === s.id)).length) : item.status === "dropped" ? t("\u5DF2\u653E\u4E0B\u3002") : t("{0}\uFF1A\u505C\u5728\u300C{1}\u300D\u3002", status, literal(here?.title ?? item.state));
  out.push(`${verdict}${item.needs !== "" ? t("\u8FD8\u8BB0\u7740\uFF1A{0}", literal(item.needs)) : ""}`);
  if (item.goal !== "") out.push("", t("\u76EE\u6807\uFF1A{0}", literal(item.goal)));
  out.push(
    "",
    `# ${t("\u6BCF\u4E00\u6B65\u600E\u4E48\u8FC7\u7684")} {#steps}`,
    "",
    "=== table {#steps-table}",
    `| ${t("\u6B65\u9AA4")} | ${t("\u8C01\u5224")} | ${t("\u51ED\u4EC0\u4E48")} | ${t("\u65F6\u95F4")} |`,
    "|---|---|---|---|"
  );
  for (const s of steps) {
    const m = item.met.find((x) => x.step === s.id);
    const cell = p.cells.find((c) => c.id === s.id)?.cell;
    const why = m !== void 0 ? grounds(m, s.judge, t, i.clock) : cell === "skipped" ? t("\u8DF3\u8FC7\u4E86") : t("\u8FD8\u6CA1\u8FC7");
    out.push(`| ${literal(s.title)} | ${t(JUDGE_WORDS2[s.judge])} | ${why} | ${m !== void 0 ? i.clock(m.at) : ""} |`);
  }
  out.push("===", "", `# ${t("\u4EA7\u7269")} {#made}`, "");
  const made = [
    ...i.commits.map((c) => ({ at: c.at, row: `| ${literal(`${c.sha.slice(0, 7)} ${c.subject}`)} | ${t("\u63D0\u4EA4")} | ${i.clock(c.at)} |` })),
    ...artifactsOfItem(i.artifacts, item.id).filter((a) => a.name !== i.self).map((a) => {
      const v = a.versions.at(-1);
      const kind = { link: "\u94FE\u63A5", doc: "\u6587\u6863", file: "\u6587\u4EF6", image: "\u56FE\u7247" }[a.kind];
      const name = a.kind === "link" ? a.name : a.name.replace(/`/g, "").split(/[\\/]/).at(-1) ?? a.name;
      return { at: v.at, row: `| ${literal(name)}${v.version !== "" ? ` (${literal(v.version)})` : ""} | ${t(kind)} | ${i.clock(v.at)} |` };
    })
  ].sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0);
  out.push(...made.length > 0 ? ["=== table {#made-table}", `| ${t("\u4EA7\u7269")} | ${t("\u79CD\u7C7B")} | ${t("\u65F6\u95F4")} |`, "|---|---|---|", ...made.map((x) => x.row), "==="] : [t("\u8FD8\u6CA1\u6709\u4EA7\u7269\u3002")]);
  out.push("", `# ${t("\u7ECF\u8FC7")} {#history}`, "", `- ${i.clock(i.opened)} ${t("\u5F00\u59CB\uFF0C\u6309\u300C{0}\u300D\u6D41\u7A0B\u8D70", literal(flow.title))}`);
  for (const m of [...item.met].sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0)) {
    const s = steps.find((x) => x.id === m.step);
    if (s !== void 0) out.push(`- ${i.clock(m.at)} ${t("\u8FC7\u4E86\u300C{0}\u300D", literal(s.title))}`);
  }
  if (done && last !== void 0) out.push(`- ${i.clock(last.at)} ${t("\u5DF2\u5B8C\u6210")}`);
  return `${out.join("\n")}
`;
}

// src/signoff.ts
var SIGNOFF_DIR = "signoffs";
var signoffPath = (root, id) => join11(gemlHome(root), SIGNOFF_DIR, `${id.replace(/[^A-Za-z0-9._-]+/g, "-")}.geml`);
var pad2 = (n) => String(n).padStart(2, "0");
var local = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? void 0 : d;
};
var clock2 = (iso) => {
  const d = local(iso);
  return d === void 0 ? "" : `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
var day2 = (iso) => {
  const d = local(iso);
  return d === void 0 ? "" : `${d.getFullYear()}-${clock2(iso)}`;
};
function trailOf(logs, id) {
  let opened;
  const commits2 = [];
  for (const events of logs) {
    const turns = events.flatMap((e) => e.t === "item" && e.id === id ? [e.turn] : []);
    for (const e of events) if (e.t === "item" && e.id === id && (opened === void 0 || e.at < opened)) opened = e.at;
    if (turns.length === 0) continue;
    const from = Math.min(...turns), to = Math.max(...turns);
    for (const e of events) {
      if (e.t === "commit" && e.turn >= from && e.turn <= to && !commits2.some((c) => c.sha === e.sha)) commits2.push({ sha: e.sha, subject: e.subject, at: e.at });
    }
  }
  return { opened, commits: commits2 };
}
function writeSignoffs(root, ids, lang = boardLang()) {
  const written = [];
  if (ids.length === 0) return written;
  let flows, items, logs, rows;
  try {
    flows = coachFlowsAt(root);
    items = workItemsAt(root, flows);
    logs = readSessionLogs(root);
    rows = readArtifactRows(journalBaseOf(root));
  } catch {
    return written;
  }
  const t = wordsFor(lang);
  const shown = flowsIn(flows, t);
  const self = `${t("\u9A8C\u6536\u5355")}.geml`;
  for (const id of new Set(ids)) {
    try {
      const item = items.find((x) => x.id === id);
      const flow = item !== void 0 ? shown.find((f) => f.name === item.flow) : void 0;
      if (item === void 0 || flow === void 0) continue;
      const trail = trailOf(logs, id);
      const text = signoffPage({ item, flow, opened: trail.opened ?? item.at, commits: trail.commits, artifacts: rows, clock: clock2, day: day2, t, self });
      const path = signoffPath(root, id);
      let was = "";
      try {
        was = readFileSync7(path, "utf8");
      } catch {
      }
      if (was !== text) {
        mkdirSync7(dirname7(path), { recursive: true });
        writeFileSync7(path, text, "utf8");
      }
      written.push(path);
      if (item.status === "done") recordBytes(journalBaseOf(root), id, { name: self, bytes: Buffer.from(text, "utf8"), kind: "file", at: (/* @__PURE__ */ new Date()).toISOString() });
    } catch {
    }
  }
  return written;
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
    text = readText(join12(root, CONTEXT_DOC));
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
        read = JSON.parse(readFileSync8(new URL("../package.json", import.meta.url), "utf8")).version ?? "";
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
  const path = join12(root, BACKLOG_DOC);
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
  const given = req.name !== void 0 ? fileSafe(basename7(req.name.split("\\").join("/"))) : void 0;
  const ext = `.${req.format}`;
  const to = req.to === void 0 ? void 0 : resolve4(root, req.to.replace(/^~(?=$|[\\/])/, homedir3()));
  const folder = to === void 0 || req.kind === "workflow" || extname(to) === "" || exists(to) && statSync5(to).isDirectory();
  const file = folder ? void 0 : `${to.slice(0, to.length - extname(to).length)}${ext}`;
  const dir = file !== void 0 ? dirname8(file) : to ?? join12(root, EXPORTS_DIR);
  const free = (path) => {
    const stem = path.slice(0, path.length - extname(path).length);
    let out = path;
    for (let n = 2; exists(out); n++) out = `${stem}-${n}${extname(path)}`;
    return out;
  };
  const named2 = (fallback) => {
    const name2 = given ?? fallback;
    return name2.endsWith(ext) ? name2 : `${name2}${ext}`;
  };
  const shown = (path) => {
    const rel = relative4(root, path);
    return (rel === "" || rel === ".." || rel.startsWith(`..${sep4}`) || isAbsolute4(rel) ? path : rel).split("\\").join("/");
  };
  const write = (name2, text2) => {
    const out = req.strip === true ? stripPaths(text2, root) : text2;
    const target3 = free(file ?? join12(dir, name2));
    mkdirSync8(dirname8(target3), { recursive: true });
    writeAtomic(target3, out);
    return { ok: true, path: shown(target3), text: out };
  };
  if (req.kind === "text") return write(named2(`share-${item}-${stamp}`), req.text ?? "");
  if (req.kind === "journal") {
    const path = ws.journalPath;
    if (path === void 0 || !exists(path)) return { ok: false, reason: ws.item.kind === "item" ? `${ws.item.id} has no journal yet` : ws.item.reason };
    const source = readText(path);
    const text2 = req.format === "geml" ? source : req.format === "md" ? renderJournalMarkdown(readJournal(source)) : JSON.stringify(readJournal(source), null, 2);
    return write(named2(`journal-${item}-${stamp}`), text2);
  }
  const name = given ?? `workflow-${fileSafe(ws.workflowName)}-${stamp}`;
  const target2 = join12(dir, name);
  mkdirSync8(dir, { recursive: true });
  const noHistory = (src) => !/[\\/]\.gemlhistory([\\/]|$)/.test(src);
  const text = readText(ws.workflowPath);
  if (basename7(ws.workflowPath).toLowerCase() === FLOW_FILE) {
    cpSync(ws.workflowDir, target2, { recursive: true, filter: noHistory });
    return { ok: true, path: shown(target2), text };
  }
  writeAtomic(join12(target2, FLOW_FILE), text);
  const kept = join12(ws.workflowDir, ws.workflowName);
  if (exists(kept)) cpSync(kept, join12(target2, ws.workflowName), { recursive: true, filter: noHistory });
  const uses = new Set([...ws.sc.states.values()].flatMap((st) => st.uses));
  writeAtomic(join12(target2, TOOLS_FILE), renderDictionary(ws.dictionary().rows.filter((r) => r.for === void 0 || uses.has(r.for))));
  return { ok: true, path: shown(target2), text };
}
function listItems(ws, root, workflowFile, prs) {
  const dir = ws.journalsDir;
  if (!exists(dir)) return [];
  const wf = resolveWorkflow(root);
  const home = ws.journalBase;
  const defaultFile = "error" in wf ? void 0 : recordedPath(root, home, wf.path);
  const fileOf = (recorded) => recorded === "" ? void 0 : workflowAt(root, home, recorded);
  const same2 = (recorded, file) => {
    const at = fileOf(recorded);
    return file !== void 0 && at !== void 0 && resolve4(at) === resolve4(file);
  };
  const out = [];
  const entries = [];
  const flows = /* @__PURE__ */ new Map([[workflowFile, { sc: ws.sc, title: ws.title }]]);
  for (const e of readdirSync5(dir, { withFileTypes: true, recursive: true })) {
    if (!e.isFile() || !e.name.endsWith(".geml")) continue;
    const full = join12(e.parentPath, e.name);
    const journal = readJournal(readText(full));
    const last = journal.snapshots.at(-1);
    if (!last) continue;
    const under = journal.meta.workflow;
    const workflow = under !== "" && under !== defaultFile && !same2(under, "error" in wf ? void 0 : wf.path) ? workflowNameOf(root, fileOf(under) ?? under) : void 0;
    const id = relative4(dir, full).split("\\").join("/").replace(/\.geml$/, "");
    const recorded = (under === "" ? defaultFile : under) ?? "";
    const own = same2(recorded, ws.workflowPath) ? workflowFile : recorded;
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
        const source = readText(join12(root, file));
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
  const full = join12(root, rel);
  if (exists(full)) return { ok: false, reason: `${rel} is there already` };
  mkdirSync8(dirname8(full), { recursive: true });
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
        else docs.set(f, { path: f, open: join12(root, f), commits: 1, at: c.at, sha: c.sha });
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
  const source = file !== void 0 && exists(join12(root, file)) ? readText(join12(root, file)) : void 0;
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
      forgetFiles(root, home, notMade, join12(homedir3(), ".gemworks", "trash", `${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}-artifacts`));
    } catch {
    }
  }
  const claudeHome = process.env["CLAUDE_CONFIG_DIR"] ?? join12(homedir3(), ".claude");
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
function recordArtifact2(ws, root, req) {
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
    const fallback = req.page !== void 0 ? basename7(req.page).replace(/\.[^.]*$/, "") : void 0;
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
var transcriptsRoot = (req) => req.transcripts ?? join12(homedir3(), ".claude", "projects");
var TRANSCRIPT_HOST = "claude-code";
var LIVE_LOG_MS = 10 * 6e4;
function transcriptFiles(root, under) {
  const dirs = new Set([root, journalBaseOf(root), ...worktreesOf(root)].map((d) => slugOf(resolve4(d))));
  const out = [];
  for (const slug of dirs) {
    const dir = join12(under, slug);
    let names;
    try {
      names = readdirSync5(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith(".jsonl")) continue;
      try {
        const st = statSync5(join12(dir, name));
        if (st.isFile()) out.push({ file: join12(dir, name), id: name.slice(0, -".jsonl".length), size: st.size, mtimeMs: st.mtimeMs });
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
    return { ok: false, reason: `cannot read ${basename7(req.file)}: ${e.message}` };
  }
  if (tr === void 0) return { ok: false, reason: `${basename7(req.file)} holds no session` };
  if (tr.id === "") tr = { ...tr, id: basename7(req.file, ".jsonl") };
  const home = ws.journalBase;
  const dir = join12(home, GEML_DIR, SESSIONS_DIR);
  mkdirSync8(dir, { recursive: true });
  if (!exists(join12(dir, ".gitignore"))) writeAtomic(join12(dir, ".gitignore"), SESSIONS_GITIGNORE);
  const path = join12(dir, logName(TRANSCRIPT_HOST, tr.id));
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
  const backlogPath = join12(root, BACKLOG_DOC);
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
    migrateLayout(root, join12(homedir3(), ".gemworks", "trash", `${stamp}-layout`));
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
  const day3 = (at) => localDay(at, offset).slice(5);
  return {
    cards: ledgerCards(ledger, live, now).map((c) => ({
      ...c,
      quotes: c.quotes.map((q) => ({ ...q, day: day3(q.at) })),
      ...c.kind === "failing" && c.instead !== void 0 ? { insteadDay: day3(c.instead.at) } : {}
    })),
    counts: practiceCounts(ledger, live),
    flowless: flowless(ledger, now).map((f) => ({
      ...f,
      quotes: ledger.prompts.filter((x) => isCorrection(x) && x.at >= since && x.flow === void 0 && x.work === f.work).slice(-12).map((x) => ({ at: x.at, text: x.text.replace(/\s+/g, " ").trim() }))
    })),
    unthemed: unthemed(ledger, Infinity).length,
    stale: ledger.linked !== linkKey(live),
    unchecked: unchecked(ledger, live, Infinity).length,
    ...toTheme ? { toTheme: { corrections: unthemed(ledger), themes: ledger.themes, practices: live }, toCheck: unchecked(ledger, live) } : {}
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
    const trash = join12(homedir3(), ".gemworks", "trash", `${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}-memory`);
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
  if (req.op === "corrections" || req.op === "corrections-add" || req.op === "corrections-themes" || req.op === "corrections-dismiss" || req.op === "corrections-check") {
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
      if (req.op === "corrections-check") return applyChecks(l, req.verdicts);
      return dismiss(l, req.key, req.n, now);
    });
    return { v: 1, ok: true, shell: shellAt(req), corrections: correctionsView(ledger, practicesOf(root).list, now, mine) };
  }
  const opened = openFor(req);
  if (!opened.ok) {
    const shell = notOpened(opened, req.root);
    const asks = req.op === "verb" || req.op === "mark" || req.op === "advance" || req.op === "bind" || req.op === "learn" || req.op === "pause" || req.op === "resume" || req.op === "rollback" || req.op === "export";
    const record = req.op === "status" ? { sessions: join12(journalBaseOf(root), GEML_DIR, SESSIONS_DIR), practices: practicesOf(root) } : req.op === "attention" ? { host: hostOf(root) } : {};
    if (req.op === "artifacts") syncArtifacts(void 0, root, req);
    if (req.op === "artifact") {
      const r = recordArtifact2(void 0, root, req);
      return r.ok ? { v: 1, ok: true, shell, text: r.text } : { v: 1, ok: false, error: r.reason, shell };
    }
    return asks ? { v: 1, ok: false, error: opened.reason, shell } : { v: 1, ok: true, shell, ...record };
  }
  const ws = opened.ws;
  const ok = (view, extra = {}, context) => ({ v: 1, ok: true, shell: shellOf(view, root), ...extra, ...context !== void 0 ? { context } : {} });
  const failed = (reason) => ({ v: 1, ok: false, error: reason, shell: shellOf(ws.view(), root) });
  switch (req.op) {
    case "status":
      return ok(ws.view(), { sessions: join12(journalBaseOf(root), GEML_DIR, SESSIONS_DIR), practices: practicesOf(root) });
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
      return ok(view, { attention: { ahead: ahead ?? [], prs: open ?? [], ...unread.length > 0 ? { unread } : {}, ...bump !== void 0 ? { bump: { version: bump.version, path: bump.path } } : {}, ...elsewhere.length > 0 ? { elsewhere } : {} }, host, sessions: join12(journalBaseOf(root), GEML_DIR, SESSIONS_DIR) });
    }
    case "artifacts": {
      syncArtifacts(ws, root, req);
      return ok(ws.view());
    }
    case "artifact": {
      const r = recordArtifact2(ws, root, req);
      return r.ok ? ok(ws.view(), { text: r.text }) : failed(r.reason);
    }
    case "backfill-list":
      return ok(ws.view(), { backfill: { sessions: transcriptFiles(root, transcriptsRoot(req)).map(({ file, id, size }) => ({ file, id, size })) } });
    case "backfill-one": {
      const r = backfillOne(ws, root, req);
      return r.ok ? ok(ws.view(), { backfill: r.backfill }) : failed(r.reason);
    }
    case "signoff": {
      const lang = req.lang === "zh" || req.lang === "en" || req.lang === "ja" ? req.lang : void 0;
      writeSignoffs(root, req.ids, ...lang !== void 0 ? [lang] : []);
      return ok(ws.view());
    }
    case "turn-ids": {
      const file = transcriptFiles(root, transcriptsRoot(req)).find((f) => f.id === req.session);
      if (file === void 0) return failed(`no transcript of session ${req.session}`);
      let text;
      try {
        text = readText(file.file);
      } catch (e) {
        return failed(`cannot read ${basename7(file.file)}: ${e.message}`);
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
  recordedUnlabelled,
  currentTurn,
  NOTE_TOOL,
  SESSIONS_PROMPT,
  decisionsContext,
  appendSession,
  readSessions,
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
  WORK_REMINDER,
  LOOP_TOOLS,
  isLoopTool,
  coachFlowsAt,
  callLoopTool,
  loopPrompt,
  loopContext,
  writeBoard,
  boardHasWork,
  openBoardOnce,
  stripPaths,
  handleRequest,
  answerRequest
};
