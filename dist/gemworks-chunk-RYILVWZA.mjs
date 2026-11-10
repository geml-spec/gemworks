import {
  commandOf,
  personOnlyRefusal,
  runsGitOrGh,
  signalHeads,
  simpleCommands,
  switchesWorkItemOnly,
  withoutDataHereDocs,
  withoutQuoting
} from "./gemworks-chunk-UEVNGPQ5.mjs";
import {
  CONTEXT_DOC,
  FLOW_FILE,
  GEML_DIR,
  JOURNALS_DIR,
  PROJECT_DOC,
  TOOLS_DOC,
  WORKFLOWS_DIR,
  appendOrCreate,
  exists,
  ghFacts,
  globExists,
  globToRegExp,
  hiddenDir,
  isLocalBranch,
  isSafeItemId,
  journalBaseOf,
  journalPathFor,
  readText,
  realPath,
  repoFacts,
  resolveItem,
  trackedUnder,
  treeFingerprint,
  withLock,
  writeAtomic
} from "./gemworks-chunk-4A7KYSFU.mjs";

// src/workspace.ts
import { readdirSync as readdirSync2 } from "node:fs";
import { basename as basename2, dirname as dirname2, isAbsolute as isAbsolute2, join as join2, relative as relative2, resolve as resolve2, sep as sep2 } from "node:path";
import { isMarkdownPath, parse as parse5 } from "./vendor/geml/geml.js";

// src/core/dictionary.ts
var TOOLS_FILE = "tools.geml";
var TOOLS_TABLE = "tools";
var COLUMNS = ["tool", "for", "allow", "deny", "default", "params"];
var NAME = /^[\p{L}\p{N}_-]+$/u;
var EMPTY_DICTIONARY = { rows: [], diagnostics: [] };
var RUN_KEY = /^Bash\((.*)\)$/s;
var normalizedCommand = (command) => withoutQuoting(command).replace(/[ \t]+/g, " ").trim();
var PATH_KEY = /^([^()\s]+)\((.*)\)$/s;
var PATH_FIELDS = ["file_path", "notebook_path", "path"];
function keysOf(tool, input, runTools, writeTools = []) {
  if (writeTools.includes(tool)) {
    const path = PATH_FIELDS.map((f) => input?.[f]).find((v) => typeof v === "string" && v !== "");
    return [path === void 0 ? tool : `${tool}(${path.replace(/\\/g, "/")})`];
  }
  const command = typeof input?.["command"] === "string" ? input["command"] : void 0;
  if (command === void 0 || !runTools.includes(tool)) return [tool];
  const parts = simpleCommands(command);
  return (parts === null || parts.length === 0 ? [command] : parts).map((c) => `Bash(${normalizedCommand(c)})`);
}
function evidenceKeys(command, commands) {
  const all = signalHeads(command);
  if (all === null) return null;
  const heads = commands === void 0 ? all : all.filter((_, i) => commands.includes(i));
  return heads.map((h) => `Bash(${normalizedCommand(h)})`);
}
var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function patternRe(pattern, anchoredStart) {
  const m = RUN_KEY.exec(pattern);
  if (m) {
    const inner = normalizedCommand(m[1]);
    if (inner === "") return new RegExp(anchoredStart ? "^Bash\\(" : "");
    const body = inner.split("*").map(escapeRe).join("[\\s\\S]*");
    return new RegExp(anchoredStart ? `^Bash\\(${body}(?=[\\s)]|$)` : `(?<![^\\s(])${body}(?=[\\s)]|$)`);
  }
  return new RegExp(`^${pattern.split("*").map(escapeRe).join("[\\s\\S]*")}$`);
}
var pathTailRe = (glob) => new RegExp(`(?:^|/)${globToRegExp(glob).source.replace(/^\^/, "")}`);
function keyMatches(pattern, key) {
  if (RUN_KEY.test(pattern) || RUN_KEY.test(key)) return RUN_KEY.test(pattern) === RUN_KEY.test(key) && patternRe(pattern, true).test(key);
  const k = PATH_KEY.exec(key);
  const p = PATH_KEY.exec(pattern);
  if (p) return k !== null && patternRe(p[1], true).test(k[1]) && pathTailRe(p[2]).test(k[2]);
  return patternRe(pattern, true).test(k ? k[1] : key);
}
function literalLength(pattern) {
  const m = RUN_KEY.exec(pattern);
  const s = m ? normalizedCommand(m[1]) : pattern;
  return s.replace(/\*/g, "").length;
}
function bindingOf(dict, key) {
  let best;
  for (const r of dict.rows) {
    if (!keyMatches(r.tool, key)) continue;
    if (best === void 0 || literalLength(r.tool) > literalLength(best.tool)) best = r;
  }
  return best;
}
function preferred(dict, use) {
  return dict.rows.find((r) => r.for === use && r.default) ?? dict.rows.find((r) => r.for === use);
}
function judgeKey(dict, scope, key) {
  const row = bindingOf(dict, key);
  const stateId = scope.state;
  const named = row !== void 0 && PATH_KEY.test(key) && !RUN_KEY.test(key) ? row.tool : key;
  if (row?.for !== void 0) {
    if (scope.uses.includes(row.for)) return { key, kind: "allow", use: row.for };
    if (!scope.fenced(row.for)) return { key, kind: "allow" };
    const where = scope.declaring(row.for);
    return { key, kind: "refuse", reason: `${named} is ${row.for}, which is used only in ${where.length ? where.map((s) => `#${s}`).join(", ") : "no state"}; the workflow is in #${stateId}` };
  }
  if (row !== void 0) {
    if (row.deny.includes(stateId) || row.deny.includes("*")) return { key, kind: "refuse", reason: `you denied ${named} in ${row.deny.includes("*") ? "every state" : `#${stateId}`}` };
    if (row.allow.includes(stateId) || row.allow.includes("*")) return { key, kind: "allow" };
  }
  return { key, kind: "unknown" };
}
function decide(dict, scope, keys) {
  const verdicts = keys.map((k) => judgeKey(dict, scope, k));
  const refused = verdicts.filter((v) => v.kind === "refuse");
  if (refused.length) return { kind: "refuse", reasons: refused.map((v) => v.reason), keys: refused.map((v) => v.key) };
  const unknown = verdicts.filter((v) => v.kind === "unknown").map((v) => v.key);
  return { kind: "allow", uses: [...new Set(verdicts.flatMap((v) => v.kind === "allow" && v.use !== void 0 ? [v.use] : []))], unknown };
}
function fencedRefusal(dict, scope, command) {
  const best = fencedRow(dict, scope, command);
  if (best?.for === void 0) return void 0;
  const where = scope.declaring(best.for);
  return `"${excerpt(command)}" is ${best.for}, which is used only in ${where.length ? where.map((s) => `#${s}`).join(", ") : "no state"}; the workflow is in #${scope.state}`;
}
function fencedRow(dict, scope, whole) {
  const command = withoutDataHereDocs(whole) ?? whole;
  const plain = normalizedCommand(command);
  let best;
  for (const r of dict.rows) {
    if (!RUN_KEY.test(r.tool)) continue;
    const re = patternRe(r.tool, false);
    if (!re.test(command) && !re.test(plain)) continue;
    if (best === void 0 || literalLength(r.tool) > literalLength(best.tool)) best = r;
  }
  return best?.for === void 0 || scope.uses.includes(best.for) || !scope.fenced(best.for) ? void 0 : best;
}
var EXCERPT = 200;
function excerpt(command) {
  if (command.length <= EXCERPT) return command;
  let end = EXCERPT;
  const last = command.charCodeAt(end - 1);
  if (last >= 55296 && last <= 56319) end--;
  return command.slice(0, end) + "\u2026";
}
function usesOf(dict, scope, keys) {
  const out = /* @__PURE__ */ new Set();
  for (const k of keys) {
    const row = bindingOf(dict, k);
    if (row?.for !== void 0 && scope.uses.includes(row.for)) out.add(row.for);
  }
  return [...out];
}
function learn(dict, lesson) {
  if (/[\r\n]/.test(lesson.key)) return dict;
  if (lesson.kind === "forget") {
    const kept = dict.rows.filter((r) => r.tool !== lesson.key).map((r, i) => ({ ...r, allow: [...r.allow], deny: [...r.deny], row: i + 1 }));
    return { rows: kept, diagnostics: dict.diagnostics };
  }
  const rows = dict.rows.map((r) => ({ ...r, allow: [...r.allow], deny: [...r.deny] }));
  let row = rows.find((r) => r.tool === lesson.key);
  if (row === void 0) {
    row = { tool: lesson.key, allow: [], deny: [], default: false, row: rows.length + 1 };
    rows.push(row);
  }
  switch (lesson.kind) {
    case "allow":
      if (!row.allow.includes(lesson.where)) row.allow.push(lesson.where);
      row.deny = row.deny.filter((s) => s !== lesson.where);
      break;
    case "deny":
      if (!row.deny.includes(lesson.where)) row.deny.push(lesson.where);
      row.allow = row.allow.filter((s) => s !== lesson.where);
      break;
    case "use":
      row.for = lesson.use;
      if (!rows.some((r) => r !== row && r.for === lesson.use)) row.default = true;
      break;
    case "default":
      row.for = lesson.use;
      for (const r of rows) if (r.for === lesson.use) r.default = r === row;
      break;
    case "params":
      row.params = lesson.params;
      break;
  }
  return { rows, diagnostics: dict.diagnostics };
}

// src/core/dictionary-file.ts
import { parse, unitSpans } from "./vendor/geml/geml.js";
function readDictionary(source, sc) {
  const doc = parse(source);
  const diagnostics = doc.diagnostics.filter((d) => d.severity === "error").map((d) => ({ severity: "error", code: d.code, message: d.message, line: d.line }));
  const err = (message, line = 1) => diagnostics.push({ severity: "error", code: "flow-tools", message, line });
  const tb = doc.children.find((b) => b.kind === "block" && b.type === "table" && b.id === TOOLS_TABLE);
  if (!tb?.table) {
    err(`no \`table {#${TOOLS_TABLE}}\` block`);
    return { rows: [], diagnostics };
  }
  const { columns, rows, header } = tb.table;
  if (!header) {
    err(`#${TOOLS_TABLE}: the table has no header row`);
    return { rows: [], diagnostics };
  }
  const cols = columns.map((c) => c.trim().toLowerCase());
  const missing = COLUMNS.filter((c) => !cols.includes(c));
  const unknown = cols.filter((c) => c !== "" && !COLUMNS.includes(c));
  if (missing.length) err(`#${TOOLS_TABLE}: missing column(s) ${missing.join(", ")}`);
  if (unknown.length) err(`#${TOOLS_TABLE}: unknown column(s) ${unknown.join(", ")} (the columns are ${COLUMNS.join(", ")})`);
  if (missing.length || unknown.length) return { rows: [], diagnostics };
  const cell = (row, name) => {
    const c = row[cols.indexOf(name)];
    if (!c) return "";
    const only = c.inlines.length === 1 ? c.inlines[0] : void 0;
    return (only?.type === "code" ? only.value : c.text).trim();
  };
  const charts = sc === void 0 ? void 0 : Array.isArray(sc) ? sc : [sc];
  const declared = charts === void 0 ? void 0 : new Set(charts.flatMap((c) => [...c.states.values()].flatMap((s) => s.uses)));
  const states = charts === void 0 ? void 0 : new Set(charts.flatMap((c) => [...c.states.keys()]));
  const out = [];
  const defaults = /* @__PURE__ */ new Map();
  const seen = /* @__PURE__ */ new Map();
  rows.forEach((row, i) => {
    const n = i + 1;
    const tool = cell(row, "tool");
    if (tool === "") {
      err(`#${TOOLS_TABLE} row ${n}: no tool`);
      return;
    }
    const first = seen.get(tool);
    if (first !== void 0) {
      diagnostics.push({ severity: "warning", code: "flow-tools", message: `#${TOOLS_TABLE} row ${n}: ${tool} has a row already (row ${first}); that one counts and this one is left out`, line: 1 });
      return;
    }
    seen.set(tool, n);
    const entry = { tool, allow: [], deny: [], default: false, row: n };
    const use = cell(row, "for");
    if (use !== "") {
      if (!NAME.test(use)) {
        err(`#${TOOLS_TABLE} row ${n}: for = "${use}" is not a name`);
        return;
      }
      entry.for = use;
      if (declared !== void 0 && !declared.has(use)) diagnostics.push({ severity: "warning", code: "flow-source", message: `#${TOOLS_TABLE} row ${n}: the use \`${use}\` is declared by no state, so ${tool} can be used nowhere`, line: 1 });
    }
    for (const col of ["allow", "deny"]) {
      const names = cell(row, col).match(/\S+/g) ?? [];
      for (const s of names) {
        if (s !== "*" && states !== void 0 && !states.has(s)) err(`#${TOOLS_TABLE} row ${n}: ${col} names ${s}, which is not a state of the workflow`);
      }
      entry[col] = names;
    }
    const def = cell(row, "default");
    if (def !== "" && def !== "yes") err(`#${TOOLS_TABLE} row ${n}: default = "${def}" is not yes (or empty)`);
    entry.default = def === "yes";
    if (entry.default) {
      if (entry.for === void 0) err(`#${TOOLS_TABLE} row ${n}: default without a use (for)`);
      else if (defaults.has(entry.for)) err(`#${TOOLS_TABLE} row ${n}: a second default for the use ${entry.for} (row ${defaults.get(entry.for)})`);
      else defaults.set(entry.for, n);
    }
    const params = cell(row, "params");
    if (params !== "") {
      try {
        const v = JSON.parse(params);
        if (typeof v !== "object" || v === null || Array.isArray(v)) err(`#${TOOLS_TABLE} row ${n}: params is not a JSON object`);
        else entry.params = v;
      } catch {
        err(`#${TOOLS_TABLE} row ${n}: params is not JSON`);
      }
    }
    out.push(entry);
  });
  return { rows: out, diagnostics };
}
var cellText = (s) => s.includes("|") ? `\`${s}\`` : s;
function renderToolsTable(rows) {
  const lines = rows.map((r) => [
    cellText(r.tool),
    r.for ?? "",
    r.allow.join(" "),
    r.deny.join(" "),
    r.default ? "yes" : "",
    r.params === void 0 ? "" : `\`${JSON.stringify(r.params)}\``
  ]);
  const widths = COLUMNS.map((c, i) => Math.max(c.length, ...lines.map((l) => l[i].length)));
  const fmt = (cells) => `| ${cells.map((c, i) => c.padEnd(widths[i])).join(" | ")} |`;
  return [
    `=== table {#${TOOLS_TABLE}}`,
    fmt(COLUMNS),
    `|${widths.map((w) => "-".repeat(w + 2)).join("|")}|`,
    ...lines.map(fmt),
    "==="
  ].join("\n");
}
function renderDictionary(rows) {
  return ["=== meta", 'title = "Gemworks tool dictionary"', "===", "", renderToolsTable(rows), ""].join("\n");
}
function withToolsTable(source, rows) {
  if (source === null) return renderDictionary(rows);
  const src = source.replace(/\r\n?/g, "\n");
  const lines = src.split("\n");
  const unit = unitSpans(src).find((u) => u.kind === "block" && u.id === TOOLS_TABLE);
  const table = renderToolsTable(rows).split("\n");
  if (unit === void 0) return `${src.replace(/\n*$/, "\n\n")}${table.join("\n")}
`;
  return [...lines.slice(0, unit.span.start), ...table, ...lines.slice(unit.span.end)].join("\n");
}

// src/project-home.ts
import { cpSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { unitSpans as unitSpans2 } from "./vendor/geml/geml.js";
var slashed = (p) => p.split(sep).join("/");
var lf = (s) => s.replace(/\r\n?/g, "\n");
function inside(dir, path) {
  const rel = relative(dir, path);
  return rel === "" || rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
var homeOf = (root) => journalBaseOf(root);
var GITIGNORE = ["# gemworks's own files: local, never committed", ".gitignore", "artifacts.geml", "artifacts/", "context.geml", "exports/", "journals/", "project.geml", "sessions/", "tools.geml", "workflows/", "*.lock", ""].join("\n");
var EARLIER_GITIGNORES = [
  "journals/\ncontext.geml\n*.lock\n",
  ["# gemworks's own files: local, never committed", ".gitignore", "context.geml", "exports/", "journals/", "project.geml", "sessions/", "tools.geml", "workflows/", "*.lock", ""].join("\n")
];
function ensureGitignore(gemlDir) {
  const path = join(gemlDir, ".gitignore");
  if (exists(path)) {
    if (!EARLIER_GITIGNORES.includes(lf(readText(path)))) return;
    const tracked = trackedUnder(gemlDir);
    if (tracked === void 0 || tracked.has(resolve(path))) return;
  } else mkdirSync(gemlDir, { recursive: true });
  writeAtomic(path, GITIGNORE);
}
function workflowFiles(dir) {
  if (!exists(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter((e) => (e.isFile() || e.isSymbolicLink()) && /\.geml$/i.test(e.name) && !e.name.startsWith(".")).map((e) => ({ name: e.name.replace(/\.geml$/i, ""), path: join(dir, e.name) }));
}
function workflowDirs(dir) {
  if (!exists(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter((e) => (e.isDirectory() || e.isSymbolicLink()) && exists(join(dir, e.name, FLOW_FILE))).map((e) => ({ name: e.name, path: join(dir, e.name, FLOW_FILE) }));
}
function installedWorkflows(root, home = homeOf(root)) {
  const found = /* @__PURE__ */ new Map();
  const earlier = home === root ? [root] : [root, home];
  for (const w of [...workflowFiles(join(home, WORKFLOWS_DIR)), ...earlier.flatMap((b) => workflowDirs(join(b, WORKFLOWS_DIR)))]) {
    if (!found.has(w.name)) found.set(w.name, w);
  }
  return [...found.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}
function projectDocOf(root, home = homeOf(root)) {
  const doc = join(home, PROJECT_DOC);
  return exists(doc) ? doc : void 0;
}
function recordedPath(root, home, path) {
  const abs = resolve(root, path);
  return slashed(relative(inside(home, abs) ? home : root, abs));
}
var EARLIER_FLOW = /^\.geml\/workflows\/([^/]+)\/flow\.geml$/;
function workflowAt(root, home, recorded) {
  if (recorded === "") return void 0;
  const there = resolve(home, recorded);
  if (exists(there)) return there;
  const m = EARLIER_FLOW.exec(recorded.split("\\").join("/"));
  if (m !== null && exists(join(home, WORKFLOWS_DIR, `${m[1]}.geml`))) return join(home, WORKFLOWS_DIR, `${m[1]}.geml`);
  const own = resolve(root, recorded);
  return exists(own) ? own : void 0;
}
function isWorkflowsFile(path) {
  const dir = dirname(path);
  return basename(path).toLowerCase() !== FLOW_FILE && basename(dir) === "workflows" && basename(dirname(dir)) === GEML_DIR;
}
function workflowNameOf(root, path) {
  const abs = resolve(root, path);
  const dir = dirname(abs);
  if (isWorkflowsFile(abs)) return basename(abs).replace(/\.geml$/i, "");
  if (basename(abs).toLowerCase() === FLOW_FILE && basename(dirname(dir)) === "workflows" && basename(dirname(dirname(dir))) === GEML_DIR) return basename(dir);
  return slashed(relative(root, dir)) || ".";
}
function dictionaryPathOf(workflowFile) {
  const dir = dirname(workflowFile);
  return isWorkflowsFile(workflowFile) ? join(dirname(dir), TOOLS_FILE) : join(dir, TOOLS_FILE);
}
var LOCAL_REF = /"\.\/([^"#]+)(#[^"]*)?"/g;
var GUIDE = "guide.geml";
var idsOf = (text) => new Set([...text.matchAll(/\{#([^\s}]+)/g)].map((m) => m[1]));
function withoutMeta(text) {
  const meta = unitSpans2(text).find((u) => u.kind === "block" && u.type === "meta");
  if (meta === void 0) return text;
  const lines = text.split("\n");
  return [...lines.slice(0, meta.span.start), ...lines.slice(meta.span.end)].join("\n").replace(/^\n+/, "");
}
function mergedWorkflow(name, flow, read2) {
  const source = lf(flow);
  const refs = [...source.matchAll(LOCAL_REF)].map((m) => ({ file: m[1], id: m[2] }));
  const guideText = refs.some((r) => r.file === GUIDE) ? read2(GUIDE) : void 0;
  const guide = guideText === void 0 ? void 0 : lf(guideText);
  const flowIds = idsOf(source);
  const takesGuide = guide !== void 0 && refs.every((r) => r.file !== GUIDE || r.id !== void 0 && r.id.length > 1) && ![...idsOf(guide)].some((id) => flowIds.has(id));
  const extra = /* @__PURE__ */ new Map();
  for (const r of refs) {
    if (extra.has(r.file) || r.file === GUIDE && takesGuide) continue;
    const text2 = read2(r.file);
    if (text2 !== void 0) extra.set(r.file, /\.(geml|md)$/i.test(r.file) ? lf(text2) : text2);
  }
  const rewritten = source.replace(LOCAL_REF, (_m, file, id) => file === GUIDE && takesGuide ? `"${id}"` : `"./${name}/${file}${id ?? ""}"`);
  const text = takesGuide ? `${rewritten.replace(/\n*$/, "\n\n")}${withoutMeta(guide).replace(/\n*$/, "\n")}` : rewritten;
  return { text, extra };
}
function mergeTools(home, source, uses) {
  const path = join(home, TOOLS_DOC);
  const incoming = readDictionary(source).rows.filter((r) => uses === void 0 || r.for !== void 0 && uses.has(r.for));
  if (incoming.length === 0) return 0;
  mkdirSync(dirname(path), { recursive: true });
  return withLock(path, () => {
    const text = exists(path) ? readText(path) : null;
    const read2 = text === null ? null : readDictionary(text);
    if (read2 !== null && read2.diagnostics.some((d) => d.severity === "error")) return 0;
    const have = read2?.rows ?? [];
    const keys = new Set(have.map((r) => r.tool));
    const defaults = new Set(have.flatMap((r) => r.default && r.for !== void 0 ? [r.for] : []));
    const added = [];
    for (const r of incoming) {
      if (keys.has(r.tool)) continue;
      keys.add(r.tool);
      const isDefault = r.default && r.for !== void 0 && !defaults.has(r.for);
      if (isDefault) defaults.add(r.for);
      added.push({ ...r, default: isDefault });
    }
    if (added.length > 0) writeAtomic(path, withToolsTable(text, [...have, ...added]));
    return added.length;
  });
}
function writeWorkflow(home, name, merged) {
  const to = join(home, WORKFLOWS_DIR, `${name}.geml`);
  for (const [file, text] of merged.extra) {
    const at = join(home, WORKFLOWS_DIR, name, file);
    mkdirSync(dirname(at), { recursive: true });
    writeAtomic(at, text);
  }
  mkdirSync(dirname(to), { recursive: true });
  writeAtomic(to, merged.text);
  return to;
}
function readIn(dir, file) {
  const path = resolve(dir, file);
  if (!inside(dir, path) || !exists(path)) return void 0;
  try {
    return readText(path);
  } catch {
    return void 0;
  }
}
function toTrash(path, trash, label) {
  const to = join(trash, label);
  mkdirSync(dirname(to), { recursive: true });
  try {
    renameSync(path, to);
  } catch {
    cpSync(path, to, { recursive: true });
    rmSync(path, { recursive: true, force: true });
  }
  return to;
}
function migrateLayout(root, trash, home = homeOf(root)) {
  const out = [];
  const dictionaries = [];
  for (const base of home === root ? [root] : [root, home]) {
    const geml = join(base, GEML_DIR);
    if (!exists(geml)) continue;
    let tracked = null;
    const kept = (path) => {
      if (tracked === null) tracked = trackedUnder(geml);
      if (tracked === void 0) return true;
      const p = resolve(path);
      for (const t of tracked) if (t === p || t.startsWith(`${p}${sep}`)) return true;
      return false;
    };
    const label = (path) => join(basename(base), relative(base, path));
    for (const w of workflowDirs(join(base, WORKFLOWS_DIR))) {
      const from = dirname(w.path);
      const to = join(home, WORKFLOWS_DIR, `${w.name}.geml`);
      if (!exists(to)) writeWorkflow(home, w.name, mergedWorkflow(w.name, readText(w.path), (f) => readIn(from, f)));
      const tools = readIn(from, TOOLS_FILE);
      if (tools !== void 0) dictionaries.push({ text: tools, at: statSync(join(from, TOOLS_FILE)).mtimeMs });
      const keep = kept(from);
      out.push({ from, to, kept: keep, ...keep ? {} : { trashed: toTrash(from, trash, label(from)) } });
    }
    if (exists(join(geml, ".gitignore"))) ensureGitignore(geml);
  }
  for (const d of dictionaries.sort((a, b) => b.at - a.at)) mergeTools(home, d.text);
  if (exists(join(home, GEML_DIR))) ensureGitignore(join(home, GEML_DIR));
  return out;
}

// src/dictionary-io.ts
function readDictionaryFile(workflowFile, sc) {
  const path = dictionaryPathOf(workflowFile);
  if (!exists(path)) return EMPTY_DICTIONARY;
  try {
    return readDictionary(readText(path), sc);
  } catch {
    return EMPTY_DICTIONARY;
  }
}
function learnInFile(workflowFile, lessons, sc) {
  const path = dictionaryPathOf(workflowFile);
  withLock(path, () => {
    const source = exists(path) ? readText(path) : null;
    let dict = source === null ? EMPTY_DICTIONARY : readDictionary(source, sc);
    for (const l of lessons) dict = learn(dict, l);
    writeAtomic(path, withToolsTable(source, dict.rows));
  });
}

// src/core/blocks.ts
import { nameKey, sliceUnit, unitSpans as unitSpans3 } from "./vendor/geml/geml.js";
function blockText(source, blockId, o = {}) {
  const walk = { markdown: o.markdown === true };
  const want = nameKey(blockId);
  const unit = unitSpans3(source, walk).find((u) => u.id !== void 0 && nameKey(u.id) === want);
  if (unit === void 0) return void 0;
  return sliceUnit(source, unit.span, "whole", walk).replace(/\r\n?/g, "\n").replace(/\n+$/, "");
}

// src/core/journal.ts
import { parse as parse3 } from "./vendor/geml/geml.js";

// src/core/snapshot.ts
import { createHash as createHash2 } from "node:crypto";

// src/core/schema.ts
function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isJsonValue(v) {
  if (v === null || typeof v === "string" || typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(isJsonValue);
  if (isRecord(v)) return Object.values(v).every(isJsonValue);
  return false;
}
function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
function scalarText(v) {
  return typeof v === "string" ? JSON.stringify(v) : String(v);
}
function validate(schema, value, path = "$") {
  const out = [];
  if (schema.oneOf) {
    const hits = schema.oneOf.filter((b) => validate(b, value, path).length === 0).length;
    if (hits !== 1) out.push(`${path}: matched ${hits} of ${schema.oneOf.length} oneOf branches`);
    return out;
  }
  if (schema.anyOf) {
    const misses = schema.anyOf.map((b) => validate(b, value, path));
    if (misses.every((m) => m.length > 0)) {
      out.push(`${path}: matched none of ${schema.anyOf.length} anyOf branches: ${misses.map((m, i) => `[${i}] ${m.join("; ")}`).join(" | ")}`);
    }
  }
  if (schema.type !== void 0) {
    if ((schema.type === "number" || schema.type === "integer") && typeof value === "number" && !Number.isFinite(value)) {
      out.push(`${path}: expected ${schema.type}, got non-finite number`);
      return out;
    }
    const ok = schema.type === "integer" ? typeof value === "number" && Number.isInteger(value) : typeOf(value) === schema.type;
    if (!ok) {
      out.push(`${path}: expected ${schema.type}, got ${typeOf(value)}`);
      return out;
    }
  }
  if (schema.const !== void 0 && value !== schema.const) {
    out.push(`${path}: expected const ${scalarText(schema.const)}, got ${isJsonValue(value) && !isRecord(value) && !Array.isArray(value) ? scalarText(value) : typeOf(value)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    const got = isJsonValue(value) && !isRecord(value) && !Array.isArray(value) ? scalarText(value) : typeOf(value);
    out.push(`${path}: expected one of ${schema.enum.map(scalarText).join(", ")}, got ${got}`);
  }
  if (isRecord(value)) {
    for (const name of schema.required ?? []) {
      if (!(name in value)) out.push(`${path}: missing required property ${JSON.stringify(name)}`);
    }
    for (const [name, v] of Object.entries(value)) {
      const sub = schema.properties?.[name];
      if (sub) out.push(...validate(sub, v, `${path}.${name}`));
      else if (schema.additionalProperties === false) out.push(`${path}: unexpected property ${JSON.stringify(name)}`);
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((v, i) => out.push(...validate(schema.items, v, `${path}[${i}]`)));
  }
  return out;
}
function defaultsOf(schema) {
  const out = {};
  for (const [name, sub] of Object.entries(schema.properties ?? {})) {
    if (sub.default !== void 0) out[name] = sub.default;
  }
  return out;
}

// src/core/statechart.ts
import { createHash } from "node:crypto";
import { parse as parse2, unitSpans as unitSpans4 } from "./vendor/geml/geml.js";
import { statechartsOf } from "./vendor/geml/statechart-check.js";
var GIT_FACTS = ["committed", "pr-open", "pr-merged", "ci-success"];
var DEFAULT_CONTEXT_BUDGET = 16384;
function hashText(text) {
  return "sha256:" + createHash("sha256").update(text.replace(/\r\n?/g, "\n"), "utf8").digest("hex");
}
function hasErrors(diagnostics) {
  return diagnostics.some((d) => d.severity === "error");
}
var NAME2 = /^[\p{L}\p{N}_-]+$/u;
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isStringList = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");
function typeOfDefault(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}
var DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
function parseDuration(text) {
  const m = text.match(DURATION);
  if (!m || text === "P" || text.endsWith("T")) return void 0;
  const [d, h, min, s] = [m[1], m[2], m[3], m[4]].map((x) => x === void 0 ? 0 : Number(x));
  const ms = (((d * 24 + h) * 60 + min) * 60 + s) * 1e3;
  return ms > 0 ? ms : void 0;
}
function readSource(v) {
  if (typeof v === "string") {
    if (v === "human") return { kind: "human" };
    if (GIT_FACTS.includes(v)) return { kind: "git", fact: v };
    return `"${v}" is not "human" or a git fact (${GIT_FACTS.join(", ")})`;
  }
  if (isObject(v)) {
    const keys = Object.keys(v);
    if (keys.length === 1 && typeof v["tool"] === "string" && NAME2.test(v["tool"])) return { kind: "tool", use: v["tool"] };
    if (keys.length === 1 && typeof v["file"] === "string" && v["file"].trim() !== "") return { kind: "file", glob: v["file"] };
    if (keys.length === 1 && typeof v["elapsed"] === "string") {
      const ms = parseDuration(v["elapsed"]);
      return ms === void 0 ? `"${v["elapsed"]}" is not an ISO 8601 duration of days, hours, minutes and seconds above zero (PT2H, P1DT12H, PT30M)` : { kind: "elapsed", iso: v["elapsed"], ms };
    }
    return 'an object source is { "tool": "<use>" }, { "file": "<glob>" } or { "elapsed": "<ISO 8601 duration>" }';
  }
  return "a source is a string or an object";
}
function loadStatechart(source, file, opts = {}) {
  const src = source.replace(/\r\n?/g, "\n");
  const doc = parse2(src);
  const diagnostics = doc.diagnostics.map((d) => ({ severity: d.severity, code: d.code, message: d.message, line: d.line }));
  const err = (code, message, line) => diagnostics.push({ severity: "error", code, message, line });
  const warn = (code, message, line) => diagnostics.push({ severity: "warning", code, message, line });
  if (hasErrors(diagnostics)) return { diagnostics };
  const lines = /* @__PURE__ */ new Map();
  for (const u of unitSpans4(src)) if (u.kind === "block" && u.id !== void 0) lines.set(u.id, u.span.start + 1);
  const lineOf = (id) => id === void 0 ? 1 : lines.get(id) ?? 1;
  let unit = { kind: "branch" };
  const meta = doc.children.find((b) => b.kind === "block" && b.type === "meta");
  if (meta?.kind === "block" && meta.data && "flow-unit" in meta.data) {
    const u = String(meta.data["flow-unit"]).trim();
    const m2 = u.match(/^file:(.+)$/);
    if (u === "branch") unit = { kind: "branch" };
    else if (m2 && m2[1].trim().length > 0) unit = { kind: "file", glob: m2[1].trim() };
    else err("flow-unit", `meta flow-unit = "${u}": expected branch or file:<glob>`, 1);
  }
  if (meta?.kind === "block" && meta.data && "flow-state-key" in meta.data) {
    const k = String(meta.data["flow-state-key"]).trim();
    if (unit.kind !== "file") err("flow-unit", `meta flow-state-key = "${k}": only a file unit keeps its state in the item file`, 1);
    else if (!/^[A-Za-z][\w-]*$/.test(k)) err("flow-unit", `meta flow-state-key = "${k}": expected a meta key name`, 1);
    else unit = { ...unit, stateKey: k };
  }
  const charts = statechartsOf(doc, file, (rel) => opts.readDoc?.(rel) ?? null);
  if (charts.length !== 1) {
    err("flow-statechart", charts.length === 0 ? "no `diagram {format=geml-statechart}` block: a workflow is one statechart" : `${charts.length} statechart blocks: a workflow is one`, 1);
    return { diagnostics };
  }
  const { block: block2, result } = charts[0];
  const blockLine = lineOf(block2.id);
  for (const d of result.diagnostics) diagnostics.push({ severity: d.severity, code: d.code, message: d.message, line: blockLine });
  if (result.model === null || hasErrors(diagnostics)) return { diagnostics };
  const m = result.model;
  const states = /* @__PURE__ */ new Map();
  const declaredUses2 = /* @__PURE__ */ new Set();
  for (const s of m.states) {
    const st = { id: s.id, title: s.title, description: s.description ?? "", line: blockLine, skills: [], uses: [], rules: [], final: s.final };
    const a = s.attrs;
    if (a["prompt"] !== void 0) {
      if (typeof a["prompt"] !== "string" || a["prompt"].trim() === "") err("flow-attr", `state ${s.id}: \`prompt\` is not a reference`, blockLine);
      else if (opts.resolveRef) {
        let found;
        try {
          found = opts.resolveRef(a["prompt"]);
        } catch (e) {
          found = e instanceof Error ? e.message : String(e);
        }
        if (found === true) st.prompt = a["prompt"];
        else if (found === false) err("flow-attr", `state ${s.id}: \`prompt\` ${a["prompt"]} does not resolve`, blockLine);
        else err("flow-attr", `state ${s.id}: \`prompt\` ${a["prompt"]} could not be resolved: ${found}`, blockLine);
      } else st.prompt = a["prompt"];
    }
    if (a["skills"] !== void 0) {
      if (!isStringList(a["skills"])) err("flow-attr", `state ${s.id}: \`skills\` is not an array of strings`, blockLine);
      else st.skills = a["skills"];
    }
    if (a["tools"] !== void 0) {
      if (!isStringList(a["tools"]) || a["tools"].some((u) => !NAME2.test(u))) err("flow-attr", `state ${s.id}: \`tools\` is not an array of use names`, blockLine);
      else {
        st.uses = [...new Set(a["tools"])];
        for (const u of st.uses) declaredUses2.add(u);
      }
    }
    if (a["rules"] !== void 0) {
      if (!isStringList(a["rules"]) || a["rules"].some((u) => !NAME2.test(u))) err("flow-attr", `state ${s.id}: \`rules\` is not an array of use names`, blockLine);
      else {
        st.rules = [...new Set(a["rules"])];
        st.uses = [.../* @__PURE__ */ new Set([...st.uses, ...st.rules])];
        for (const u of st.rules) declaredUses2.add(u);
      }
    }
    states.set(s.id, st);
  }
  const vars = /* @__PURE__ */ new Map();
  const properties = {};
  for (const v of m.vars) {
    const entry = { name: v.name, default: v.default, note: "" };
    const a = v.attrs;
    if (a["source"] !== void 0) {
      const s = readSource(a["source"]);
      if (typeof s === "string") err("flow-attr", `variable ${v.name}: \`source\` ${s}`, blockLine);
      else {
        entry.source = s;
        if (v.default !== false) err("flow-attr", `variable ${v.name}: a variable with a \`source\` is evidence; its default must be false`, blockLine);
        if (s.kind === "tool" && !declaredUses2.has(s.use)) warn("flow-source", `variable ${v.name}: its source is the use \`${s.use}\`, which no state declares in \`tools\`, so it can never be set`, blockLine);
      }
    }
    if (a["note"] !== void 0) {
      if (typeof a["note"] !== "string") err("flow-attr", `variable ${v.name}: \`note\` is not a string`, blockLine);
      else entry.note = a["note"];
    }
    vars.set(v.name, entry);
    const p = { type: typeOfDefault(v.default), default: v.default };
    if (entry.note !== "") p.description = entry.note;
    properties[v.name] = p;
  }
  const transitions = [];
  const pairs = /* @__PURE__ */ new Set();
  for (const t of m.transitions) {
    const tr = {
      index: t.index,
      name: t.name,
      line: blockLine,
      from: t.from,
      to: t.to,
      judge: t.guard === void 0 ? "none" : t.guard.kind === "text" ? "model" : "machine",
      reads: t.reads,
      approval: false,
      resets: t.resets,
      note: ""
    };
    if (t.guard !== void 0) tr.guard = t.guard;
    const a = t.attrs;
    if (a["approval"] !== void 0) {
      if (a["approval"] !== true) err("flow-attr", `${t.name}: \`approval\` is not true`, blockLine);
      else tr.approval = true;
    }
    if (a["note"] !== void 0) {
      if (typeof a["note"] !== "string") err("flow-attr", `${t.name}: \`note\` is not a string`, blockLine);
      else tr.note = a["note"];
    }
    if (a["label"] !== void 0) {
      if (typeof a["label"] !== "string" || a["label"].trim() === "") err("flow-attr", `${t.name}: \`label\` is not a non-empty string`, blockLine);
      else tr.label = a["label"].trim();
    }
    const pair = `${t.from}\u2192${t.to}`;
    if (pairs.has(pair)) err("flow-dup-edge", `${t.name}: a second transition between ${t.from} and ${t.to}; the journal names a transition by its pair`, blockLine);
    pairs.add(pair);
    transitions.push(tr);
  }
  const autoFrom = /* @__PURE__ */ new Map();
  for (const t of transitions) if (t.judge === "machine" && !t.approval) autoFrom.set(t.from, [...autoFrom.get(t.from) ?? [], t]);
  for (const [from, ts] of autoFrom) if (ts.length > 1) err("flow-auto-ambiguous", `state ${from} has ${ts.length} machine-judged transitions out (${ts.map((t) => t.name).join(", ")}); at most one may leave a state on its own`, blockLine);
  if (hasErrors(diagnostics)) return { diagnostics };
  const walked = /* @__PURE__ */ new Set();
  for (const start of states.keys()) {
    const path = [];
    const position = /* @__PURE__ */ new Map();
    for (let cur = start; cur !== void 0 && !walked.has(cur); ) {
      position.set(cur, path.length);
      const t = autoFrom.get(cur)?.[0];
      if (!t) break;
      path.push(t);
      const lap = position.get(t.to);
      if (lap !== void 0) {
        const ring = path.slice(lap);
        warn("flow-auto-cycle", `machine-judged transitions form a cycle: ${ring.map((x) => x.from).join(" \u2192 ")} \u2192 ${ring[0].from}; if their guards ever hold together, the supervisor stops at the first state it would enter twice`, blockLine);
        break;
      }
      cur = t.to;
    }
    for (const id of position.keys()) walked.add(id);
  }
  const sc = {
    file,
    hash: hashText(src),
    initial: m.initial,
    states,
    transitions,
    vars,
    varsSchema: { type: "object", properties, additionalProperties: false },
    signalVars: new Set([...vars.values()].filter((v) => v.source !== void 0).map((v) => v.name)),
    rules: new Set([...states.values()].flatMap((st) => st.rules)),
    unit,
    contextBudget: DEFAULT_CONTEXT_BUDGET,
    model: m
  };
  return { statechart: sc, diagnostics };
}
function outgoing(sc, stateId) {
  return sc.transitions.filter((t) => t.from === stateId);
}
function modelVars(sc) {
  return [...sc.vars.values()].filter((v) => v.source === void 0).map((v) => v.name);
}
function varsBySource(sc, kind) {
  return [...sc.vars.values()].filter((v) => v.source?.kind === kind);
}
function sourceLabel(s) {
  switch (s.kind) {
    case "tool":
      return `tool:${s.use}`;
    case "file":
      return `file:${s.glob}`;
    case "git":
      return `git:${s.fact}`;
    case "human":
      return "human";
    case "elapsed":
      return `elapsed:${s.iso}`;
  }
}
function statesDeclaring(sc, use) {
  return [...sc.states.values()].filter((s) => s.uses.includes(use)).map((s) => s.id);
}
function declaredUses(sc) {
  return new Set([...sc.states.values()].flatMap((s) => s.uses));
}

// src/core/snapshot.ts
function compareByCodePoint(a, b) {
  const as = [...a];
  const bs = [...b];
  const len = Math.min(as.length, bs.length);
  for (let i = 0; i < len; i++) {
    const diff = as[i].codePointAt(0) - bs[i].codePointAt(0);
    if (diff !== 0) return diff;
  }
  return as.length - bs.length;
}
function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const keys = Object.keys(value).sort(compareByCodePoint);
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
}
function hashSnapshot(s) {
  const { hash: _hash, ...rest } = s;
  const payload = canonical(rest);
  return "sha256:" + createHash2("sha256").update(payload, "utf8").digest("hex");
}
function seal(s) {
  return { ...s, hash: hashSnapshot(s) };
}
function child(prev, meta, fields) {
  const base = { rev: prev.rev + 1, parent: prev.hash, at: meta.at, ...fields };
  if (meta.call !== void 0) base.call = meta.call;
  if (meta.by !== void 0) base.by = meta.by;
  if (meta.signal !== void 0) base.signal = meta.signal;
  return seal(base);
}
function initialSnapshot(sc, at, state = sc.initial) {
  return seal({ rev: 0, state, vars: defaultsOf(sc.varsSchema), cause: "enter", parent: null, at });
}
function reenterSnapshot(sc, prev, at) {
  return child(prev, { at }, { state: sc.initial, vars: defaultsOf(sc.varsSchema), cause: "enter", from: prev.state });
}
var refuse = (tool, reason, diagnostics = []) => ({ ok: false, refusal: { tool, reason, diagnostics } });
function applyPatch(sc, snap, patch, meta) {
  if (!sc.states.has(snap.state)) return refuse("set", `current state ${snap.state} is not in the statechart`);
  const writable = new Set(modelVars(sc));
  for (const k of Object.keys(patch)) {
    if (!sc.vars.has(k)) return refuse("set", `"${k}" is not a variable of the workflow`);
    if (!writable.has(k)) return refuse("set", `"${k}" is evidence (it has a source); the model cannot write it`);
  }
  const merged = { ...snap.vars, ...patch };
  const diagnostics = validate(sc.varsSchema, merged);
  if (diagnostics.length) return refuse("set", "a value is not of the variable's type", diagnostics);
  return { ok: true, next: child(snap, meta, { state: snap.state, vars: merged, cause: "patch" }) };
}
function applySignal(sc, snap, name, value, meta, tree) {
  if (!sc.states.has(snap.state)) return refuse("signal", `current state ${snap.state} is not in the statechart`);
  const v = sc.vars.get(name);
  if (v?.source === void 0) return refuse("signal", `"${name}" is not a variable with a source`);
  if (snap.vars[name] === value) return null;
  const merged = { ...snap.vars, [name]: value };
  const stamped = tree !== void 0 && v.source.kind === "tool" && value !== v.default;
  return { ok: true, next: child(snap, { ...meta, by: "signal", signal: name }, { state: snap.state, vars: merged, cause: "patch", ...stamped ? { tree } : {} }) };
}
function treeOfValue(history, name) {
  const now = canonical(history[history.length - 1]?.vars[name] ?? null);
  for (let i = history.length - 1; i >= 0; i--) {
    const prev = history[i - 1];
    if (prev === void 0 || canonical(prev.vars[name] ?? null) !== now) return history[i].tree;
  }
  return void 0;
}
function hasExpirable(sc, history) {
  const snap = history[history.length - 1];
  if (!snap) return false;
  return varsBySource(sc, "tool").some((v) => {
    const value = snap.vars[v.name];
    return value !== void 0 && canonical(value) !== canonical(v.default) && treeOfValue(history, v.name) !== void 0;
  });
}
function applyExpiry(sc, history, tree, meta) {
  const snap = history[history.length - 1];
  if (!snap || !sc.states.has(snap.state)) return null;
  const reset = {};
  let first;
  for (const v of varsBySource(sc, "tool")) {
    const value = snap.vars[v.name];
    if (value === void 0 || canonical(value) === canonical(v.default)) continue;
    const written = treeOfValue(history, v.name);
    if (written === void 0 || written === tree) continue;
    reset[v.name] = v.default;
    first ??= v.name;
  }
  if (first === void 0) return null;
  return child(snap, { ...meta, by: "signal", signal: first }, { state: snap.state, vars: { ...snap.vars, ...reset }, cause: "expire" });
}
function guardHolds(sc, t, vars) {
  if (t.judge !== "machine" || t.guard === void 0 || t.guard.kind === "text") return true;
  const schema = t.guard.schema;
  return schema === null || schema === void 0 ? false : validate(schema, vars).length === 0;
}
function applyTransition(sc, snap, to, meta) {
  const t = outgoing(sc, snap.state).find((x) => x.to === to);
  if (!t) return refuse("move", `no transition ${snap.state}\u2192${to}`);
  if (!guardHolds(sc, t, snap.vars)) return refuse("move", `${t.name}: the guard does not hold (${t.reads.map((r) => `${r}=${JSON.stringify(snap.vars[r] ?? null)}`).join(", ")})`);
  const resets = [...t.resets, ...varsBySource(sc, "elapsed").map((v) => v.name)];
  const vars = resets.length > 0 ? { ...snap.vars, ...Object.fromEntries(resets.map((v) => [v, sc.vars.get(v)?.default ?? null])) } : snap.vars;
  return { ok: true, next: child(snap, meta, { state: t.to, vars, cause: "transition", from: snap.state }) };
}
function checkpointRev(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const cause = history[i].cause;
    if (cause !== "patch" && cause !== "expire" && cause !== "pause" && cause !== "resume") return history[i].rev;
  }
  return 0;
}
function isPaused(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const cause = history[i].cause;
    if (cause === "pause") return true;
    if (cause === "resume" || cause === "enter") return false;
  }
  return false;
}
function applyHold(sc, history, hold, meta) {
  const verb = hold ? "pause" : "resume";
  const snap = history[history.length - 1];
  if (!snap) return refuse(verb, "no revision to hold");
  if (!sc.states.has(snap.state)) return refuse(verb, `current state ${snap.state} is not in the statechart`);
  if (isPaused(history) === hold) return refuse(verb, hold ? "the work item is already paused" : "the work item is not paused");
  return { ok: true, next: child(snap, { ...meta, by: "human" }, { state: snap.state, vars: snap.vars, cause: verb }) };
}
function stageEntryRev(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const s = history[i];
    if (s.cause === "enter" || s.cause === "transition") return s.rev;
    if (s.cause === "rollback" && history[i - 1]?.state !== s.state) return s.rev;
  }
  return 0;
}
function applyRollback(sc, history, target, meta) {
  const current = history[history.length - 1];
  if (!current) return refuse("rollback", "no revision to roll back from");
  const rev = target === "checkpoint" ? checkpointRev(history) : target;
  const found = history.find((s) => s.rev === rev);
  if (!found) return refuse("rollback", `revision ${rev} does not exist`);
  if (!sc.states.has(found.state)) return refuse("rollback", `revision ${rev} is in state ${found.state}, which the statechart no longer has`);
  const vars = { ...found.vars, ...Object.fromEntries(varsBySource(sc, "elapsed").map((v) => [v.name, v.default])) };
  return { ok: true, next: child(current, meta, { state: found.state, vars, cause: "rollback", from: current.state, restores: rev }) };
}

// src/core/journal.ts
var CAUSES = /* @__PURE__ */ new Set(["enter", "transition", "patch", "rollback", "expire", "pause", "resume"]);
var BYS = /* @__PURE__ */ new Set(["model", "signal", "human"]);
var block = (id, value) => `=== data {#${id} format=json}
${canonical(value)}
===

`;
function renderJournalHead(meta) {
  return [
    "=== meta",
    'title = "gemworks journal"',
    "===",
    "",
    block("journal", { item: meta.item, workflow: meta.workflow, "workflow-hash": meta.workflowHash, created: meta.created })
  ].join("\n");
}
function renderSnapshotBlock(s) {
  return block(`rev-${s.rev}`, s);
}
function renderRefusedBlock(r) {
  const v = { rev: r.rev, at: r.at, tool: r.tool, reason: r.reason, diagnostics: r.diagnostics };
  if (r.call !== void 0) v["call"] = r.call;
  if (r.key !== void 0) v["key"] = r.key;
  return block(`refused-${r.n}`, v);
}
function renderWroteBlock(w) {
  const v = { rev: w.rev, at: w.at, tool: w.tool, path: w.path };
  if (w.call !== void 0) v["call"] = w.call;
  return block(`wrote-${w.n}`, v);
}
var str = (v) => typeof v === "string" ? v : void 0;
var num = (v) => typeof v === "number" ? v : void 0;
var isObject2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function readJournal(source) {
  const doc = parse3(source);
  const diagnostics = doc.diagnostics.filter((d) => d.severity === "error").map((d) => `line ${d.line}: ${d.message}`);
  const meta = { item: "", workflow: "", workflowHash: "", created: "" };
  const snapshots = [];
  const refusals = [];
  const writes = [];
  for (const b of doc.children) {
    if (b.kind !== "block" || b.type !== "data" || b.id === void 0) continue;
    const id = b.id;
    const blk = b;
    const label = `#${id}`;
    const body = blk.value;
    if (id === "journal") {
      if (!isObject2(body)) {
        diagnostics.push(`${label}: not a JSON object`);
        continue;
      }
      meta.item = str(body["item"]) ?? "";
      meta.workflow = str(body["workflow"]) ?? "";
      meta.workflowHash = str(body["workflow-hash"]) ?? "";
      meta.created = str(body["created"]) ?? "";
      continue;
    }
    const rev = id.match(/^rev-(\d+)$/);
    const refused = id.match(/^refused-([1-9]\d*)$/);
    const wrote = id.match(/^wrote-([1-9]\d*)$/);
    if (!rev && !refused && !wrote) continue;
    if (!isObject2(body)) {
      diagnostics.push(`${label}: not a JSON object`);
      continue;
    }
    if (rev) {
      const n = num(body["rev"]), state = str(body["state"]), cause = str(body["cause"]), hash = str(body["hash"]), at = str(body["at"]);
      if (n === void 0 || n !== Number(rev[1]) || !state || !cause || !CAUSES.has(cause) || !hash || !at || !isObject2(body["vars"])) {
        diagnostics.push(`${label}: missing or malformed fields`);
        continue;
      }
      const s = { rev: n, state, vars: body["vars"], cause, hash, at, parent: str(body["parent"]) ?? null };
      const call = str(body["call"]);
      if (call !== void 0) s.call = call;
      const from = str(body["from"]);
      if (from !== void 0) s.from = from;
      const restores = num(body["restores"]);
      if (restores !== void 0) s.restores = restores;
      const by = str(body["by"]);
      if (by !== void 0) {
        if (BYS.has(by)) s.by = by;
        else diagnostics.push(`${label}: by=${by} is not model, signal or human`);
      }
      const signal = str(body["signal"]);
      if (signal !== void 0) s.signal = signal;
      const tree = str(body["tree"]);
      if (tree !== void 0) s.tree = tree;
      snapshots.push(s);
    } else if (refused) {
      const r = {
        n: Number(refused[1]),
        rev: num(body["rev"]) ?? -1,
        at: str(body["at"]) ?? "",
        tool: str(body["tool"]) ?? "",
        reason: str(body["reason"]) ?? "",
        diagnostics: Array.isArray(body["diagnostics"]) ? body["diagnostics"].map(String) : []
      };
      const call = str(body["call"]);
      if (call !== void 0) r.call = call;
      const key = str(body["key"]);
      if (key !== void 0) r.key = key;
      refusals.push(r);
    } else if (wrote) {
      const path = str(body["path"]), tool = str(body["tool"]), at = str(body["at"]), n = num(body["rev"]);
      if (!path || !tool || at === void 0 || n === void 0) {
        diagnostics.push(`${label}: missing or malformed fields`);
        continue;
      }
      const w = { n: Number(wrote[1]), rev: n, at, tool, path };
      const call = str(body["call"]);
      if (call !== void 0) w.call = call;
      writes.push(w);
    }
  }
  return { meta, snapshots, refusals, writes, diagnostics };
}
function renderJournalMarkdown(journal) {
  const lines = [`# gemworks journal \u2014 ${journal.meta.item}`, "", `workflow: \`${journal.meta.workflow}\` (${journal.meta.workflowHash})`, "", "| rev | at | cause | state | call | changes |", "|---|---|---|---|---|---|"];
  let prev = {};
  for (const s of journal.snapshots) {
    const changes = [];
    for (const k of [.../* @__PURE__ */ new Set([...Object.keys(prev), ...Object.keys(s.vars)])].sort()) {
      const a = prev[k], b = s.vars[k];
      if (canonical(a ?? null) !== canonical(b ?? null) || a === void 0 !== (b === void 0)) {
        changes.push(`${k}: ${a === void 0 ? "\u2205" : canonical(a)} \u2192 ${b === void 0 ? "\u2205" : canonical(b)}`);
      }
    }
    lines.push(`| ${s.rev} | ${s.at} | ${s.cause} | #${s.state} | ${s.call ?? ""} | ${changes.length ? changes.join("; ") : "\u2014"} |`);
    prev = s.vars;
  }
  if (journal.refusals.length) {
    lines.push("", "## Refused", "");
    for (const r of journal.refusals) lines.push(`- rev ${r.rev} \xB7 ${r.tool}${r.call ? ` (${r.call})` : ""}: ${r.reason}${r.diagnostics.length ? " \u2014 " + r.diagnostics.join("; ") : ""}`);
  }
  if (journal.writes.length) {
    lines.push("", "## Written", "");
    for (const w of journal.writes) lines.push(`- rev ${w.rev} \xB7 ${w.tool}${w.call ? ` (${w.call})` : ""}: ${w.path}`);
  }
  return lines.join("\n");
}
function verifyJournal(journal, sc) {
  const errors = [...journal.diagnostics];
  if (journal.snapshots.length === 0) {
    errors.push("the journal holds no revision");
    return errors;
  }
  let prev;
  let held = false;
  for (const s of journal.snapshots) {
    const label = `#rev-${s.rev}`;
    const expectedRev = prev ? prev.rev + 1 : 0;
    if (s.rev !== expectedRev) errors.push(`${label}: rev is not contiguous (expected ${expectedRev})`);
    if (prev && s.parent !== prev.hash) errors.push(`${label}: parent does not equal the previous hash`);
    if (!prev && s.parent !== null) errors.push(`${label}: the first revision has no parent`);
    if (hashSnapshot(s) !== s.hash) errors.push(`${label}: hash does not match its content`);
    if ((s.cause === "transition" || s.cause === "rollback") && s.from === void 0) errors.push(`${label}: cause ${s.cause} needs from`);
    if (s.cause === "rollback" && (s.restores === void 0 || s.restores >= s.rev || !journal.snapshots.some((x) => x.rev === s.restores))) errors.push(`${label}: restores must name an earlier revision`);
    if (s.by === "signal" && s.signal === void 0) errors.push(`${label}: by=signal needs signal`);
    if (s.signal !== void 0 && s.by !== "signal") errors.push(`${label}: signal needs by=signal`);
    if (s.cause === "expire" && s.by !== "signal") errors.push(`${label}: cause expire needs by=signal`);
    if (s.cause === "pause" || s.cause === "resume") {
      if (s.by !== "human") errors.push(`${label}: cause ${s.cause} needs by=human`);
      if (prev && (s.state !== prev.state || canonical(s.vars) !== canonical(prev.vars))) errors.push(`${label}: cause ${s.cause} keeps the state and the variables`);
      if (s.cause === "pause" === held) errors.push(`${label}: ${s.cause} while the work item is ${held ? "already paused" : "not paused"}`);
    }
    held = s.cause === "pause" ? true : s.cause === "resume" || s.cause === "enter" ? false : held;
    if (sc) {
      if (s.signal !== void 0 && !sc.signalVars.has(s.signal)) errors.push(`${label}: signal ${s.signal} is not a variable with a source`);
      if (!sc.states.has(s.state)) errors.push(`${label}: state ${s.state} is not in the statechart`);
      if (s.cause === "transition" && s.from !== void 0 && !outgoing(sc, s.from).some((t) => t.to === s.state)) {
        errors.push(`${label}: no transition ${s.from}\u2192${s.state} in the statechart`);
      }
    }
    prev = s;
  }
  return errors;
}

// src/core/policy.ts
function relevantVars(sc, stateId) {
  const read2 = /* @__PURE__ */ new Set();
  for (const t of outgoing(sc, stateId)) for (const name of t.reads) read2.add(name);
  return [...read2];
}
function policyOf(sc, dict, run) {
  const fences = {};
  for (const use of declaredUses(sc)) fences[use] = statesDeclaring(sc, use);
  const base = {
    unit: sc.unit,
    fences,
    rules: [...sc.rules],
    rows: dict.rows,
    files: varsBySource(sc, "file").map((v) => v.source.glob),
    git: varsBySource(sc, "git").length > 0,
    evidence: [...new Set(varsBySource(sc, "tool").map((v) => v.source.use))]
  };
  if (!run) return { ...base, active: false, state: "", uses: [], relevant: [], written: [] };
  const state = sc.states.get(run.snapshot.state);
  const since = stageEntryRev(run.history);
  const written = run.writeLog.filter((w) => w.rev >= since).map((w) => w.path);
  return { ...base, active: true, state: run.snapshot.state, uses: state?.uses ?? [], relevant: relevantVars(sc, run.snapshot.state), written };
}
function scopeIn(sc, stateId) {
  return { state: stateId, uses: sc.states.get(stateId)?.uses ?? [], declaring: (use) => statesDeclaring(sc, use), fenced: (use) => sc.rules.has(use) };
}

// src/core/signals.ts
function commandKeys(o) {
  return evidenceKeys(o.command, o.commands);
}
function toolSignals(sc, dict, stateId, keys, ok) {
  const uses = new Set(usesOf(dict, scopeIn(sc, stateId), keys));
  return varsBySource(sc, "tool").filter((v) => uses.has(v.source.use)).map((v) => ({ id: v.name, value: ok }));
}
function commandSignals(sc, dict, stateId, o) {
  if (o.exitCode === null) return [];
  const keys = commandKeys(o);
  return keys === null ? [] : toolSignals(sc, dict, stateId, keys, o.exitCode === 0);
}
function fileSignals(sc, exists2) {
  const out = [];
  for (const v of varsBySource(sc, "file")) {
    const value = exists2(v.source.glob);
    if (value !== void 0) out.push({ id: v.name, value });
  }
  return out;
}
function gitSignals(sc, f) {
  const out = [];
  for (const v of varsBySource(sc, "git")) {
    let value;
    switch (v.source.fact) {
      case "committed":
        value = f.committed;
        break;
      case "pr-open":
        value = f.prOpen;
        break;
      case "pr-merged":
        value = f.prMerged;
        break;
      case "ci-success":
        value = f.ci === void 0 ? void 0 : f.ci.length > 0 && f.ci.every((r) => r.success);
        break;
    }
    if (value !== void 0) out.push({ id: v.name, value });
  }
  return out;
}
function readsGit(sc) {
  const facts = varsBySource(sc, "git").map((v) => v.source.fact);
  return { git: facts.length > 0, gh: facts.some((f) => f !== "committed") };
}
function elapsedSignals(sc, history, now) {
  const vars = varsBySource(sc, "elapsed");
  if (vars.length === 0) return [];
  const entered2 = history.find((s) => s.rev === checkpointRev(history))?.at;
  const held = entered2 === void 0 ? NaN : Date.parse(now) - Date.parse(entered2);
  if (!Number.isFinite(held)) return [];
  return vars.map((v) => ({ id: v.name, value: held >= v.source.ms }));
}

// src/core/status.ts
import { guardText } from "./vendor/geml/statechart.js";
var truthy = (v) => v !== void 0 && v !== null && v !== false;
function statusOf(sc, base, run) {
  const sources = {};
  for (const v of sc.vars.values()) if (v.source !== void 0) sources[v.name] = sourceLabel(v.source);
  const head = { ...base, sources };
  if (run === void 0) return { ...head, vars: {}, next: [], refusals: 0, paused: false };
  const snap = run.snapshot;
  const state = sc.states.get(snap.state);
  return {
    ...head,
    ...state ? { state: { id: state.id, title: state.title, rev: snap.rev, uses: state.uses, final: state.final, since: run.history.find((s) => s.rev === checkpointRev(run.history))?.at ?? snap.at } } : {},
    vars: snap.vars,
    next: outgoing(sc, snap.state).map((t) => ({
      name: t.name,
      to: t.to,
      judge: t.judge,
      approval: t.approval,
      ...t.guard !== void 0 ? { guard: guardText(t.guard) } : {},
      reads: t.reads,
      missing: t.judge === "machine" ? t.reads.filter((r) => !truthy(snap.vars[r])) : [],
      holds: guardHolds(sc, t, snap.vars),
      note: t.note,
      label: t.label ?? sc.states.get(t.to)?.title ?? t.to,
      toFinal: sc.states.get(t.to)?.final === true,
      toStart: t.to === sc.initial
    })),
    refusals: run.refusals,
    paused: run.paused
  };
}

// src/core/stagehand.ts
import { parse as parse4, unitSpans as unitSpans5 } from "./vendor/geml/geml.js";
import { guardText as guardText2 } from "./vendor/geml/statechart.js";
var bytes = (s) => new TextEncoder().encode(s).length;
function nextLines(sc, snap) {
  return outgoing(sc, snap.state).map((t) => describeNext(sc, snap, t));
}
function describeNext(sc, snap, t) {
  const note = t.note ? ` \u2014 ${t.note}` : "";
  if (t.approval) {
    const guard = t.guard === void 0 ? "" : ` once ${guardText2(t.guard)}`;
    return `\u2192 ${t.to}: a person approves it${guard} (board, or gemworks advance ${t.to})${note}`;
  }
  if (t.judge === "machine" && t.guard !== void 0) {
    const holds = guardHolds(sc, t, snap.vars);
    const missing = t.reads.filter((r) => snap.vars[r] === false || snap.vars[r] === void 0 || snap.vars[r] === null);
    return `\u2192 ${t.to}: on its own when ${guardText2(t.guard)}${holds ? " (holds now)" : missing.length ? ` \u2014 still missing: ${missing.join(", ")}` : ""}${note}`;
  }
  if (t.judge === "model" && t.guard?.kind === "text") return `\u2192 ${t.to}: your call, with move, when ${t.guard.text}${note}`;
  return `\u2192 ${t.to}: your call, with move${note}`;
}
function toolLines(sc, stateId, dict) {
  const state = sc.states.get(stateId);
  return (state?.uses ?? []).map((use) => {
    const row = dict === void 0 ? void 0 : preferred(dict, use);
    if (row === void 0) return `${use}: no tool bound yet (the first one you use is asked about)`;
    const params = row.params === void 0 ? "" : ` with ${JSON.stringify(row.params)}`;
    return `${use}: ${row.tool}${params}`;
  });
}
function buildStageContext(sc, snap, getPrompt, dict) {
  const state = sc.states.get(snap.state);
  const vars = [...sc.vars.values()].map((v) => `${v.name}=${JSON.stringify(snap.vars[v.name] ?? v.default)}${v.source === void 0 ? " (yours to set)" : ""}`);
  const lines = [
    `[gemworks] stage ${snap.state} \xB7 rev ${snap.rev}`,
    state === void 0 ? "" : `${state.title}${state.description ? ` \u2014 ${state.description}` : ""}`,
    "",
    ...state?.skills.length ? [`Skills: ${state.skills.join(", ")}`] : [],
    ...state?.uses.length ? ["Tools here:", ...toolLines(sc, snap.state, dict).map((l) => `  ${l}`)] : ["Tools here: none declared; what you use is asked about"],
    `Variables: ${vars.length ? vars.join(" \xB7 ") : "none"}`,
    "Next:",
    ...outgoing(sc, snap.state).length ? nextLines(sc, snap).map((l) => `  ${l}`) : ["  nothing \u2014 this is the final stage"]
  ];
  let text = lines.join("\n");
  const included = [];
  const truncated = [];
  const ref = state?.prompt;
  if (ref !== void 0) {
    const note = `

(the prompt ${ref} was left out to stay within ${sc.contextBudget} bytes \u2014 read it with geml get)`;
    const body = getPrompt(ref);
    const piece = `

--- ${ref} ---
${(body ?? "(not found)").replace(/\r\n?/g, "\n")}`;
    if (bytes(text) + bytes(piece) <= sc.contextBudget) {
      text += piece;
      included.push(ref);
    } else {
      text += note;
      truncated.push(ref);
    }
  }
  return { state: snap.state, rev: snap.rev, text, included, truncated };
}
function renderContextDoc(ctx, o) {
  const longest = Math.max(0, ...ctx.text.split("\n").map((l) => l.match(/^=+/)?.[0].length ?? 0));
  const fence = "=".repeat(Math.max(3, longest + 1));
  return [
    "=== meta",
    'title = "Gemworks \u2014 current stage"',
    "===",
    "",
    `${fence} text {#current}`,
    ctx.text,
    fence,
    "",
    "=== data {#stage format=json}",
    JSON.stringify({ item: o.item, state: ctx.state, rev: ctx.rev, at: o.at }),
    "===",
    "",
    ...o.vars === void 0 ? [] : ["=== data {#vars format=json}", JSON.stringify(o.vars, null, 2), "===", ""]
  ].join("\n");
}
function readContextDoc(source) {
  const src = source.replace(/\r\n?/g, "\n");
  const doc = parse4(src);
  const typed = (type, id) => doc.children.find((x) => x.kind === "block" && x.type === type && x.id === id);
  const current = unitSpans5(src).find((u) => u.kind === "block" && u.type === "text" && u.id === "current");
  const stage = typed("data", "stage")?.value;
  if (!current || typeof stage !== "object" || stage === null || Array.isArray(stage)) return void 0;
  const s = stage;
  const v = typed("data", "vars")?.value;
  return {
    state: String(s["state"] ?? ""),
    rev: typeof s["rev"] === "number" ? s["rev"] : -1,
    at: String(s["at"] ?? ""),
    item: String(s["item"] ?? ""),
    text: src.split("\n").slice(current.span.start + 1, current.span.end - 1).join("\n"),
    ...v !== null && typeof v === "object" && !Array.isArray(v) ? { vars: v } : {}
  };
}

// src/core/item-state.ts
import { unitSpans as unitSpans6 } from "./vendor/geml/geml.js";
import { planMetaWrite } from "./vendor/geml/coord.js";
var keyLine = (key) => new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=`);
function read(source) {
  const crlf = source.includes("\r\n");
  const text = source.replace(/\r\n?/g, "\n");
  const unit = unitSpans6(text).find((u) => u.kind === "block" && u.type === "meta");
  return { lines: text.split("\n"), crlf, ...unit !== void 0 ? { meta: unit.span } : {} };
}
var joined = (lines, crlf) => {
  const text = lines.join("\n");
  return crlf ? text.replace(/\n/g, "\r\n") : text;
};
function withItemState(source, key, state) {
  const { lines, crlf, meta } = read(source);
  if (meta === void 0) return joined(["=== meta", `${key} = ${JSON.stringify(state)}`, "===", "", ...lines], crlf);
  const plan = planMetaWrite(key, state, lines.slice(meta.start + 1, meta.end - 1));
  if (!plan.ok) return void 0;
  return joined([...lines.slice(0, meta.start + 1), ...plan.body, ...lines.slice(meta.end - 1)], crlf);
}
function itemState(source, key) {
  const { lines, meta } = read(source);
  if (meta === void 0) return void 0;
  const line = lines.slice(meta.start + 1, meta.end - 1).find((l) => keyLine(key).test(l));
  const value = line?.replace(keyLine(key), "").trim();
  if (value === void 0 || value === "") return void 0;
  try {
    const v = JSON.parse(value);
    return typeof v === "string" ? v : void 0;
  } catch {
    return value;
  }
}
function withoutItemState(source, key) {
  const { lines, crlf, meta } = read(source);
  if (meta === void 0) return source;
  const kept = lines.filter((l, i) => !(i > meta.start && i < meta.end - 1 && keyLine(key).test(l)));
  return kept.length === lines.length ? source : joined(kept, crlf);
}

// src/core/run.ts
var RunState = class {
  sc;
  log;
  refused;
  refLog;
  wroteLog;
  constructor(sc, history, refusals, refusalLog = [], wroteLog = []) {
    this.sc = sc;
    this.log = history;
    this.refused = refusals;
    this.refLog = refusalLog;
    this.wroteLog = wroteLog;
  }
  get writeLog() {
    return this.wroteLog;
  }
  wrote(tool, path, meta) {
    const since = stageEntryRev(this.log);
    if (this.wroteLog.some((w) => w.path === path && w.rev >= since)) return null;
    const n = this.wroteLog.reduce((max, w) => w.n > max ? w.n : max, 0) + 1;
    this.wroteLog.push({ n, rev: this.snapshot.rev, path });
    return renderWroteBlock({ n, rev: this.snapshot.rev, at: meta.at, tool, ...meta.call !== void 0 ? { call: meta.call } : {}, path });
  }
  get snapshot() {
    return this.log[this.log.length - 1];
  }
  get history() {
    return this.log;
  }
  get refusals() {
    return this.refused;
  }
  get refusalLog() {
    return this.refLog;
  }
  get paused() {
    return isPaused(this.log);
  }
  refuse(refusal, meta) {
    this.refused += 1;
    this.refLog.push({ n: this.refused, rev: this.snapshot.rev, ...meta.call !== void 0 ? { call: meta.call } : {}, ...refusal.key !== void 0 ? { key: refusal.key } : {} });
    return renderRefusedBlock({
      n: this.refused,
      rev: this.snapshot.rev,
      at: meta.at,
      tool: refusal.tool,
      ...meta.call !== void 0 ? { call: meta.call } : {},
      reason: refusal.reason,
      diagnostics: refusal.diagnostics,
      ...refusal.key !== void 0 ? { key: refusal.key } : {}
    });
  }
  /** Commit an outcome: extend the chain on success, only number it on refusal. */
  settle(outcome, meta) {
    if (outcome.ok) {
      this.log.push(outcome.next);
      return { ok: true, snapshot: outcome.next, block: renderSnapshotBlock(outcome.next) };
    }
    return { ok: false, refusal: outcome.refusal, block: this.refuse(outcome.refusal, meta) };
  }
  transition(to, meta) {
    return this.settle(applyTransition(this.sc, this.snapshot, to, meta), meta);
  }
  set(patch, meta) {
    return this.settle(applyPatch(this.sc, this.snapshot, patch, meta), meta);
  }
  signal(name, value, meta, tree) {
    const outcome = applySignal(this.sc, this.snapshot, name, value, meta, tree);
    return outcome === null ? null : this.settle(outcome, meta);
  }
  expire(tree, meta) {
    const next = applyExpiry(this.sc, this.log, tree, meta);
    if (next === null) return null;
    this.log.push(next);
    return { snapshot: next, block: renderSnapshotBlock(next) };
  }
  rollback(target, meta) {
    return this.settle(applyRollback(this.sc, this.log, target, meta), meta);
  }
  hold(paused, meta) {
    return this.settle(applyHold(this.sc, this.log, paused, meta), meta);
  }
  reenter(at) {
    const next = reenterSnapshot(this.sc, this.snapshot, at);
    this.log.push(next);
    return { snapshot: next, block: renderSnapshotBlock(next) };
  }
};
function startRun(sc, meta, at, state = sc.initial) {
  const first = initialSnapshot(sc, at, state);
  return {
    run: new RunState(sc, [first], 0),
    head: renderJournalHead(meta),
    block: renderSnapshotBlock(first)
  };
}
function resumeRun(sc, journalSource) {
  const journal = readJournal(journalSource);
  const errors = verifyJournal(journal);
  if (errors.length) return { ok: false, reason: errors.join("; ") };
  const history = [...journal.snapshots].sort((a, b) => a.rev - b.rev);
  const current = history[history.length - 1];
  if (current === void 0) return { ok: false, reason: "the journal holds no revision" };
  if (!sc.states.has(current.state)) return { ok: false, reason: `the statechart no longer has state ${current.state}` };
  const refusals = journal.refusals.reduce((max, r) => r.n > max ? r.n : max, 0);
  const run = new RunState(sc, history, refusals, journal.refusals.map((r) => ({ n: r.n, rev: r.rev, ...r.call !== void 0 ? { call: r.call } : {}, ...r.key !== void 0 ? { key: r.key } : {} })), journal.writes.map((w) => ({ n: w.n, rev: w.rev, path: w.path })));
  return journal.meta.workflowHash === sc.hash ? { ok: true, run } : { ok: true, run, note: `workflow changed: ${journal.meta.workflowHash} \u2192 ${sc.hash}` };
}

// src/core/prompt.ts
import { guardText as guardText3 } from "./vendor/geml/statechart.js";
function edgeTail(t, sep3) {
  const notes = [];
  if (t.judge === "machine" && t.guard !== void 0) notes.push(`when ${guardText3(t.guard)}`);
  if (t.judge === "model" && t.guard?.kind === "text") notes.push(`when ${t.guard.text}`);
  if (t.approval) notes.push("needs a person");
  return notes.length ? ` (${notes.join(sep3)})` : "";
}
function describeTransitions(sc, stateId) {
  const edges = outgoing(sc, stateId);
  if (edges.length === 0) return "(none \u2014 this is the final state)";
  return edges.map((t) => `${t.name}${t.note ? `: ${t.note}` : ""}${edgeTail(t, "; ")}`).join("\n");
}
function renderContext(sc, snap, dict) {
  const state = sc.states.get(snap.state);
  const edges = outgoing(sc, snap.state);
  const transitions = edges.length ? edges.map((t) => `${t.name}${edgeTail(t, ", ")}`).join(" \xB7 ") : "(none \u2014 this is the final state)";
  const tools = state?.uses.length ? toolLines(sc, snap.state, dict).join(" \xB7 ") : "(none declared)";
  const settable = modelVars(sc);
  return `[gemworks] state ${snap.state} \xB7 rev ${snap.rev} \xB7 ${snap.hash.slice(0, 19)}\u2026
vars: ${canonical(snap.vars)}
transitions: ${transitions}
tools here: ${tools} \xB7 settable vars: ${settable.length ? settable.join(" ") : "none"}`;
}

// src/core/tools.ts
var entered = () => ({ type: "array", items: { type: "string" } });
function outputSchema(properties) {
  return { type: "object", additionalProperties: false, properties };
}
function toParamEntry(name, schema) {
  const entry = { type: schema.type ?? "string", description: schema.description ?? `the ${name} variable` };
  if (schema.enum) entry.enum = [...schema.enum];
  if (schema.items) entry.items = schema.items;
  if (schema.type === "object") {
    entry.properties = schema.properties ?? {};
    entry.additionalProperties = schema.additionalProperties ?? false;
  }
  return entry;
}
function statusSpec() {
  return {
    name: "gemworks_status",
    description: "Where the workflow stands: the state, the variables, the ways out and whether their guards hold. Read-only.",
    parameters: {},
    output: { schema: outputSchema({ text: { type: "string" } }) }
  };
}
function moveSpec(sc, snap) {
  const edges = outgoing(sc, snap.state).filter((t) => !t.approval && t.judge !== "machine");
  if (edges.length === 0) return null;
  return {
    name: "gemworks_move",
    description: `Take a transition out of ${snap.state}:
${describeTransitions(sc, snap.state)}`,
    parameters: { to: { type: "string", required: true, description: "The target state.", enum: edges.map((t) => t.to) } },
    output: { schema: outputSchema({ from: { type: "string" }, to: { type: "string" }, state: { type: "string" }, entered: entered(), rev: { type: "integer" }, hash: { type: "string" } }) }
  };
}
function setSpec(sc, snap) {
  const names = modelVars(sc);
  if (names.length === 0) return null;
  const parameters = {};
  for (const name of names) {
    const schema = sc.varsSchema.properties?.[name];
    if (schema) parameters[name] = toParamEntry(name, schema);
  }
  return {
    name: "gemworks_set",
    description: `Record workflow variables in ${snap.state}: ${names.join(", ")}. Variables with a source are evidence and not yours.`,
    parameters,
    output: { schema: outputSchema({ rev: { type: "integer" }, hash: { type: "string" }, state: { type: "string" }, entered: entered(), vars: { type: "object", additionalProperties: true } }) }
  };
}

// src/core/verb-specs.ts
var OWN_TOOL_PREFIX = "mcp__gemworks__";
var NONE = { type: "object", properties: {}, additionalProperties: false };
var FLOW_TOOLS = [
  {
    name: "status",
    description: "Where this project's Gemworks workflow stands: the work item, the current state, every variable, each way out with whether its guard holds, and the current stage's text (.geml/context.geml #current). Read-only.",
    inputSchema: NONE
  },
  {
    name: "move",
    description: "Take a transition out of the current state (status lists them): one whose guard is a sentence you judge, or one with no guard. A machine-judged transition is taken on its own when its guard holds; one that needs a person is theirs \u2014 they approve it on the Gemworks board or with `gemworks advance <state>`.",
    inputSchema: {
      type: "object",
      properties: { to: { type: "string", description: "The target state." } },
      required: ["to"],
      additionalProperties: false
    }
  },
  {
    name: "set",
    description: "Record workflow variables, by name. Variables with a source (test results, PR and CI state, a person's checks) are evidence and not yours to write; a value of the wrong type writes nothing.",
    inputSchema: { type: "object", description: "The variables to record, each under its own name.", additionalProperties: true }
  }
];
var OWN_TOOL_NAMES = new Set(FLOW_TOOLS.flatMap((t) => [t.name, `${OWN_TOOL_PREFIX}${t.name}`, `gemworks_${t.name}`]));
function isOwnTool(name) {
  return OWN_TOOL_NAMES.has(name);
}
function verbOf(name) {
  const bare = name.startsWith(OWN_TOOL_PREFIX) ? name.slice(OWN_TOOL_PREFIX.length) : name.startsWith("gemworks_") ? name.slice("gemworks_".length) : name;
  return FLOW_TOOLS.some((t) => t.name === bare) ? bare : void 0;
}

// src/core/supervisor.ts
var VERBS = ["move", "set"];
var PAUSED_REASON = "the work item is paused; a person resumes it on the Gemworks board or with `gemworks resume`";
var WAY_OUT = "switching the work item is always allowed: git switch <branch>, git switch -c <branch>, git checkout -b <branch>, git worktree add <path>, cd <path>";
function refusalText(reason, diagnostics) {
  return diagnostics.length ? `${reason}
${diagnostics.join("\n")}` : reason;
}
function metaFor(at, callId) {
  return callId === void 0 ? { at } : { at, call: String(callId) };
}
function autoEdge(sc, stateId) {
  return outgoing(sc, stateId).find((t) => t.judge === "machine" && !t.approval);
}
function takeAutoEdges(sc, run, actorFor, append, left) {
  const entered2 = [];
  const seen = /* @__PURE__ */ new Set([run.snapshot.state]);
  for (; ; ) {
    const edge = autoEdge(sc, run.snapshot.state);
    if (!edge || !guardHolds(sc, edge, run.snapshot.vars) || seen.has(edge.to) || edge.to === left) break;
    seen.add(edge.to);
    const adv = run.transition(edge.to, actorFor(edge));
    append(adv.block);
    if (!adv.ok) break;
    entered2.push(edge.to);
    left = void 0;
  }
  return entered2;
}
var Supervisor = class {
  sc;
  run;
  host;
  notice = "";
  constructor(sc, run, host) {
    this.sc = sc;
    this.run = run;
    this.host = host;
  }
  get verbs() {
    return VERBS;
  }
  /** The three verbs of spec §8.5, bare or as a host lists them (`isOwnTool`). */
  owns(toolName) {
    return isOwnTool(toolName);
  }
  get snapshot() {
    return this.run.snapshot;
  }
  /** Whether a person holds the work item (spec §5.5). */
  get paused() {
    return this.run.paused;
  }
  state() {
    return this.sc.states.get(this.run.snapshot.state);
  }
  /** A line appended to every context snapshot — used when the workflow changed. */
  setNotice(text) {
    this.notice = text;
  }
  /** The dictionary's reading of this state (spec §5.3). */
  scope() {
    return scopeIn(this.sc, this.run.snapshot.state);
  }
  /** Why a command line is refused for a fenced use in this state, or undefined — for a host whose command the sh scanners cannot read (pwsh). */
  fencedRefusal(command) {
    return fencedRefusal(this.host.dictionary, this.scope(), command);
  }
  /** The keys of a call on this host. */
  keys(toolName, input) {
    return keysOf(toolName, input, this.host.tools.run, this.host.tools.write);
  }
  /**
   * The gate before a call (spec §5.3). The rules that hold in every state
   * first: a person-only command is refused; a line that only switches the
   * work item is the way out of every state; the supervisor's own tools pass.
   * Then the fenced uses anywhere in a command line, and the dictionary's
   * decision on the call's keys. Deny-only by construction: nothing here
   * grants more than the dictionary does. A refusal is recorded.
   */
  gate(toolName, callId, input, waived = []) {
    if (this.owns(toolName)) return { kind: "allow", uses: [] };
    const scope = this.scope();
    const command = commandOf(input);
    if (command !== void 0) {
      const hard = personOnlyRefusal(command);
      if (hard) return { kind: "refuse", reason: this.refuse(toolName, hard, callId) };
      if (switchesWorkItemOnly(command, this.host.isBranch ? (name) => this.host.isBranch(name) : void 0)) return { kind: "allow", uses: [] };
      const row = fencedRow(this.host.dictionary, scope, command);
      const fenced = row !== void 0 && !waived.includes(row.tool) ? fencedRefusal(this.host.dictionary, scope, command) : void 0;
      if (fenced) return { kind: "refuse", reason: this.refuse(toolName, `${fenced}; ${WAY_OUT}`, callId, row?.tool) };
    }
    const d = decide(this.host.dictionary, scope, this.keys(toolName, input).filter((k) => !waived.includes(k)));
    if (d.kind === "refuse") return { kind: "refuse", reason: this.refuse(toolName, `${d.reasons.join("; ")}; ${WAY_OUT}`, callId, d.keys[0]) };
    return { kind: "allow", uses: d.uses, ...d.unknown.length > 0 ? { unknown: d.unknown } : {} };
  }
  /** The gate as a reason to refuse, or undefined. */
  deny(toolName, callId, input) {
    const g = this.gate(toolName, callId, input);
    return g.kind === "refuse" ? g.reason : void 0;
  }
  /** Record that the work wrote `path`, a project path: once per file per stage entry (Run.wrote). */
  recordWrite(toolName, path, callId) {
    const block2 = this.run.wrote(toolName, path, metaFor(this.host.now(), callId));
    if (block2 !== null) this.host.append(block2);
  }
  /** Turn a call away: record it (with the key the gate judged, when it judged one), and say why. */
  refuse(toolName, reason, callId, key) {
    this.host.append(this.run.refuse({ tool: toolName, reason, diagnostics: [], ...key !== void 0 ? { key } : {} }, metaFor(this.host.now(), callId)));
    return reason;
  }
  /** The verbs for a host that registers tools per state; recomputed from the state, so `move`'s enum cannot drift from the transitions. */
  specs() {
    return { status: statusSpec(), move: moveSpec(this.sc, this.run.snapshot), set: setSpec(this.sc, this.run.snapshot) };
  }
  /** A model verb: the journal append, and the result. */
  invoke(name, args, meta) {
    const by = { ...meta, by: "model" };
    switch (verbOf(name)) {
      case "move":
        return this.doMove(args, by);
      case "set":
        return this.doSet(args, by);
      default:
        return { ok: false, reason: `gemworks does not own the tool ${name}` };
    }
  }
  record(refusal, meta) {
    this.host.append(this.run.refuse(refusal, meta));
  }
  /** `move` takes a transition the model judges or one with no guard; a machine-judged one is taken on its own, one with approval by a person. */
  doMove(args, meta) {
    const to = String(args["to"]);
    const edge = outgoing(this.sc, this.run.snapshot.state).find((t) => t.to === to);
    if (!edge) return { ok: false, reason: `no transition ${this.run.snapshot.state}\u2192${to}` };
    let reason;
    if (this.run.paused) reason = `${edge.name}: ${PAUSED_REASON}`;
    else if (edge.approval) reason = `${edge.name} needs a person: they approve it on the Gemworks board or with \`gemworks advance ${to}\``;
    else if (edge.judge === "machine") reason = `${edge.name} is taken on its own when its guard holds (${edge.reads.join(", ")}); it is not yours to take`;
    if (reason !== void 0) {
      this.record({ tool: "move", reason, diagnostics: [] }, meta);
      return { ok: false, reason };
    }
    const advance = this.run.transition(to, meta);
    this.host.append(advance.block);
    if (!advance.ok) return { ok: false, reason: refusalText(advance.refusal.reason, advance.refusal.diagnostics) };
    const entered2 = this.autoAdvance(() => meta, advance.snapshot.from);
    this.host.changed?.();
    const end = this.run.snapshot;
    return { ok: true, result: { from: advance.snapshot.from ?? "", to, state: end.state, entered: entered2, rev: end.rev, hash: end.hash } };
  }
  doSet(args, meta) {
    const patch = {};
    for (const [key, value] of Object.entries(args)) if (value !== void 0) patch[key] = value;
    const advance = this.run.set(patch, meta);
    this.host.append(advance.block);
    if (!advance.ok) return { ok: false, reason: refusalText(advance.refusal.reason, advance.refusal.diagnostics) };
    const entered2 = this.autoAdvance(() => meta);
    this.host.changed?.();
    const end = this.run.snapshot;
    return { ok: true, result: { rev: end.rev, hash: end.hash, vars: end.vars, state: end.state, entered: entered2 } };
  }
  /** A person's rollback (`gemworks rollback`): the recorded state only, never what a command already did. */
  rollback(target, meta) {
    const advance = this.run.rollback(target, { ...meta, by: "human" });
    this.host.append(advance.block);
    if (!advance.ok) return { ok: false, reason: refusalText(advance.refusal.reason, advance.refusal.diagnostics) };
    const entered2 = this.autoAdvance(() => ({ ...meta, by: "human" }));
    this.host.changed?.();
    const end = this.run.snapshot;
    return { ok: true, rev: end.rev, restores: advance.snapshot.restores ?? advance.snapshot.rev, state: end.state, entered: entered2 };
  }
  /**
   * Evidence expiry, at the start of an operation: the `tool` variables whose
   * content changed since their evidence was written return to their defaults
   * in one revision; then the automatic transitions that hold are taken.
   * Nothing without the operation's content fingerprint.
   */
  expire(meta) {
    if (this.sc.states.get(this.run.snapshot.state)?.final === true) return { expired: false, entered: [] };
    if (!hasExpirable(this.sc, this.run.history)) return { expired: false, entered: [] };
    const tree = this.host.tree;
    const done = tree === void 0 ? null : this.run.expire(tree, meta);
    if (done === null) return { expired: false, entered: [] };
    this.host.append(done.block);
    const signal = done.snapshot.signal;
    const entered2 = this.autoAdvance(() => ({ ...meta, by: "signal", signal }));
    this.host.changed?.();
    return { expired: true, entered: entered2 };
  }
  /** Write each variable's value; then take automatic transitions while one holds. */
  /** The clock's evidence (spec §3.6): the `elapsed` variables as of `meta.at`; nothing in a final state, where the work item is closed. */
  elapse(meta) {
    if (this.sc.states.get(this.run.snapshot.state)?.final === true) return { wrote: [], entered: [] };
    return this.applySignals(elapsedSignals(this.sc, this.run.history, meta.at), meta);
  }
  applySignals(values, meta) {
    const wrote = [];
    for (const v of values) {
      const adv = this.run.signal(v.id, v.value, meta, this.host.tree);
      if (adv === null) continue;
      this.host.append(adv.block);
      if (adv.ok) wrote.push(v.id);
    }
    const entered2 = wrote.length === 0 ? [] : this.autoAdvance((edge) => ({ ...meta, by: "signal", signal: this.openedBy(wrote, edge) }));
    if (wrote.length > 0) this.host.changed?.();
    return { wrote, entered: entered2 };
  }
  /** Which of the variables just written opened `edge`'s guard: the first the guard reads, else the last one written. */
  openedBy(wrote, edge) {
    return wrote.find((name) => edge.reads.includes(name)) ?? wrote[wrote.length - 1];
  }
  /** A call that ran a command line finished: its exit status is `tool` evidence for the uses its commands are bound to. */
  observeCommand(outcome, meta) {
    return this.applySignals(commandSignals(this.sc, this.host.dictionary, this.run.snapshot.state, outcome), meta);
  }
  /** Any other call finished: `ok` is `tool` evidence for the use its key is bound to. */
  observeCall(toolName, input, ok, meta) {
    if (this.owns(toolName)) return { wrote: [], entered: [] };
    const keys = this.keys(toolName, input);
    return this.applySignals(toolSignals(this.sc, this.host.dictionary, this.run.snapshot.state, keys, ok), meta);
  }
  /** The uses a call's keys are bound to, in this state. */
  usesOfCall(toolName, input) {
    return usesOf(this.host.dictionary, this.scope(), this.keys(toolName, input));
  }
  /** A person moved the workflow (board or terminal). Approval is the act itself; a guard written beside it must hold. */
  humanTransition(to, meta) {
    if (!outgoing(this.sc, this.run.snapshot.state).some((t) => t.to === to)) {
      return { ok: false, reason: `no transition ${this.run.snapshot.state}\u2192${to}` };
    }
    if (this.run.paused) return { ok: false, reason: PAUSED_REASON };
    const actor = { ...meta, by: "human" };
    const adv = this.run.transition(to, actor);
    this.host.append(adv.block);
    if (!adv.ok) return { ok: false, reason: refusalText(adv.refusal.reason, adv.refusal.diagnostics) };
    const entered2 = [to, ...this.autoAdvance(() => actor, adv.snapshot.from)];
    this.host.changed?.();
    return { ok: true, entered: entered2 };
  }
  /** A person ticked or cleared a variable whose source is a person. */
  mark(name, checked, meta) {
    const v = this.sc.vars.get(name);
    if (!v) return { ok: false, reason: `no variable "${name}" in the workflow` };
    if (v.source?.kind !== "human") return { ok: false, reason: v.source === void 0 ? `${name} is the model's to set, not a person's to tick` : `${name} reads its value from ${v.source.kind === "tool" ? `the use ${v.source.use}` : v.source.kind}; only a variable whose source is "human" is ticked` };
    return { ok: true, ...this.applySignals([{ id: name, value: checked }], meta) };
  }
  /**
   * A person holds the work item (spec §5.5): evidence goes on being recorded,
   * but no transition is taken, the model's, a person's or the machine's, until
   * they let it go.
   */
  pause(meta) {
    const adv = this.run.hold(true, { ...meta, by: "human" });
    this.host.append(adv.block);
    if (!adv.ok) return { ok: false, reason: refusalText(adv.refusal.reason, adv.refusal.diagnostics) };
    this.host.changed?.();
    return { ok: true };
  }
  /** A person lets the work item go: the machine-judged transition that came to hold meanwhile is taken now, as theirs. */
  resume(meta) {
    const actor = { ...meta, by: "human" };
    const adv = this.run.hold(false, actor);
    this.host.append(adv.block);
    if (!adv.ok) return { ok: false, reason: refusalText(adv.refusal.reason, adv.refusal.diagnostics) };
    const entered2 = this.autoAdvance(() => actor);
    this.host.changed?.();
    return { ok: true, entered: entered2 };
  }
  /** Take the automatic transitions that hold from the current state, appending to the host's journal; `left` is the state a transition just left. Nothing while a person holds the item. */
  autoAdvance(actorFor, left) {
    if (this.run.paused) return [];
    return takeAutoEdges(this.sc, this.run, actorFor, (block2) => this.host.append(block2), left);
  }
  /** The state's own description. */
  instruction() {
    const s = this.state();
    return s === void 0 ? "" : `${s.title}${s.description ? ` \u2014 ${s.description}` : ""}`;
  }
  /** The per-step snapshot, a few hundred bytes; while a person holds the item, a line saying so. */
  context() {
    const text = renderContext(this.sc, this.run.snapshot, this.host.dictionary);
    const held = this.run.paused ? `${text}
[gemworks] paused: ${PAUSED_REASON}` : text;
    return this.notice ? `${held}
${this.notice}` : held;
  }
};
function openRun(o) {
  const meta = { item: o.item, workflow: o.workflowFile, workflowHash: o.sc.hash, created: o.now };
  const fresh = startRun(o.sc, meta, o.now, o.startAt !== void 0 && o.sc.states.has(o.startAt) ? o.startAt : o.sc.initial);
  const entry = { at: o.now };
  if (o.journalText === null) {
    const blocks2 = [fresh.block];
    takeAutoEdges(o.sc, fresh.run, () => entry, (block2) => blocks2.push(block2));
    return { ok: true, run: fresh.run, head: fresh.head, blocks: blocks2, notice: "" };
  }
  const resumed = resumeRun(o.sc, o.journalText);
  if (!resumed.ok) return { ok: false, reason: resumed.reason };
  const blocks = [];
  if (o.source === "clear") {
    blocks.push(resumed.run.reenter(o.now).block);
    takeAutoEdges(o.sc, resumed.run, () => entry, (block2) => blocks.push(block2));
  }
  return {
    ok: true,
    run: resumed.run,
    head: fresh.head,
    blocks,
    notice: resumed.note ? "[gemworks] the workflow changed since this run started; the current state still exists and the run continues." : "",
    ...resumed.note ? { note: resumed.note } : {}
  };
}

// src/workspace.ts
var slashed2 = (p) => p.split(sep2).join("/");
var lf2 = (s) => s.replace(/\r\n?/g, "\n");
function inside2(root, path) {
  const rel = relative2(root, path);
  return rel === "" || rel !== ".." && !rel.startsWith(`..${sep2}`) && !isAbsolute2(rel);
}
function resolvePromptRef(ref, workflowFile, root) {
  const workflowDir = dirname2(workflowFile);
  const hash = ref.indexOf("#");
  const rel = hash < 0 ? ref : ref.slice(0, hash);
  const id = hash < 0 ? void 0 : ref.slice(hash + 1);
  if (id === "" || rel === "" && id === void 0) return { kind: "missing" };
  const local = rel === "" || rel.startsWith("./");
  const file = rel === "" ? workflowFile : local ? join2(workflowDir, rel.slice(2)) : join2(root, rel);
  const real = realPath(file);
  if (!inside2(realPath(root), real) && !(local && inside2(realPath(workflowDir), real))) return { kind: "outside" };
  if (!exists(real)) return { kind: "missing" };
  try {
    const source = lf2(readText(real));
    if (id === void 0) return { kind: "found", text: source };
    const text = blockText(source, id, { markdown: isMarkdownPath(file) });
    return text === void 0 ? { kind: "missing" } : { kind: "found", text };
  } catch {
    return { kind: "missing" };
  }
}
function defaultGetPrompt(ref, workflowFile, root) {
  const found = resolvePromptRef(ref, workflowFile, root);
  return found.kind === "found" ? found.text : void 0;
}
function docReader(workflowDir, root) {
  return (rel) => {
    const real = realPath(resolve2(workflowDir, rel));
    if (!inside2(realPath(root), real) && !inside2(realPath(workflowDir), real)) return null;
    try {
      return exists(real) ? readText(real) : null;
    } catch {
      return null;
    }
  };
}
function metaValue(source, key) {
  const meta = parse5(source).children.find((b) => b.kind === "block" && b.type === "meta");
  return meta && meta.kind === "block" && meta.data ? meta.data[key] : void 0;
}
function resolveWorkflow(root, env = process.env) {
  const named = env["GEMWORKS_STATECHART"];
  if (named) {
    const path = resolve2(root, named);
    if (!exists(path)) return { error: `GEMWORKS_STATECHART names ${named}, which does not exist`, kind: "invalid" };
    return { name: slashed2(relative2(root, dirname2(path))) || ".", path };
  }
  const home = homeOf(root);
  const installed = installedWorkflows(root, home);
  const doc = projectDocOf(root, home);
  if (doc !== void 0) {
    const name = metaValue(readText(doc), "flow-workflow");
    if (typeof name === "string" && name !== "") {
      if (name.includes("/") || !isSafeItemId(name)) return { error: `${PROJECT_DOC} names workflow "${name}", which is not the name of a workflow in ${WORKFLOWS_DIR}`, kind: "invalid" };
      const named2 = installed.find((w) => w.name === name);
      return named2 !== void 0 ? { name, path: named2.path } : { error: `${PROJECT_DOC} names workflow "${name}", but ${WORKFLOWS_DIR} has no ${name}.geml`, kind: "invalid" };
    }
  }
  const names = installed.map((w) => w.name);
  if (installed.length === 1) return installed[0];
  const whole = installed.filter((w) => fileUnitOf(w.path) === void 0);
  if (installed.length > 1 && whole.length === 1) return whole[0];
  return names.length === 0 ? { error: "no workflow here: run `gemworks init`", kind: "none" } : { error: `several workflows (${names.join(", ")}): choose one with \`gemworks use <name>\``, kind: "ambiguous" };
}
function fileUnitOf(path) {
  let unit;
  try {
    unit = metaValue(readText(path), "flow-unit");
  } catch {
    return void 0;
  }
  const m = typeof unit === "string" ? unit.trim().match(/^file:(.+)$/) : null;
  return m ? m[1].trim() : void 0;
}
function sideFlows(root, defaultPath) {
  const def = resolve2(defaultPath);
  return installedWorkflows(root).flatMap(({ name, path }) => {
    if (resolve2(path) === def) return [];
    const glob = fileUnitOf(path);
    return glob === void 0 ? [] : [{ name, path, glob }];
  });
}
function itemProgress(root, journalBase, id, flows, defaultFile = "") {
  if (!isSafeItemId(id)) return void 0;
  const path = join2(journalBase, journalPathFor(id));
  if (!exists(path)) return void 0;
  const journal = readJournal(readText(path));
  const first = journal.snapshots[0];
  const last = journal.snapshots.at(-1);
  if (first === void 0 || last === void 0) return void 0;
  const wf = journal.meta.workflow !== "" ? journal.meta.workflow : defaultFile;
  let flow = flows.get(wf);
  if (flow === void 0) {
    const at = workflowAt(root, journalBase, wf);
    const loaded = at !== void 0 ? loadFlow(root, at) : { error: "no workflow" };
    flow = "error" in loaded ? null : { sc: loaded.sc, title: loaded.title ?? workflowNameOf(root, wf) };
    flows.set(wf, flow);
  }
  let title;
  try {
    if (exists(join2(root, `${id}.geml`))) title = itemState(readText(join2(root, `${id}.geml`)), "title");
  } catch {
    title = void 0;
  }
  const latest = /* @__PURE__ */ new Map();
  for (const w of journal.writes) {
    latest.delete(w.path);
    latest.set(w.path, true);
  }
  return {
    id,
    ...title !== void 0 && title !== "" ? { title } : {},
    ...flow !== null ? { flow: flow.title } : {},
    state: last.state,
    ...flow?.sc.states.get(last.state) !== void 0 ? { stateTitle: flow.sc.states.get(last.state).title } : {},
    final: flow?.sc.states.get(last.state)?.final === true,
    since: first.at,
    at: last.at,
    wrote: [...latest.keys()].reverse()
  };
}
function dependsOf(source) {
  const raw = itemState(source, "depends");
  return raw === void 0 ? [] : raw.split(/[\s,]+/).filter((x) => x !== "");
}
function loadFlow(root, path) {
  const file = slashed2(relative2(root, path));
  const source = readText(path);
  const loaded = loadStatechart(source, file, { readDoc: docReader(dirname2(path), root) });
  if (!loaded.statechart || hasErrors(loaded.diagnostics)) {
    return { error: `${file}: ${loaded.diagnostics.filter((d) => d.severity === "error").map((d) => `${d.code}: ${d.message}`).join("; ")}` };
  }
  const title = metaValue(source, "title");
  return { sc: loaded.statechart, ...typeof title === "string" ? { title } : {} };
}
function loadWorkspace(o) {
  const wf = resolveWorkflow(o.root);
  if ("error" in wf) return { ok: false, reason: wf.error, kind: wf.kind };
  const getPrompt = o.getPrompt ?? defaultGetPrompt;
  if (o.lastFile !== void 0) {
    const rel = slashed2(relative2(o.root, resolve2(o.root, o.lastFile)));
    const side = sideFlows(o.root, wf.path).find((f) => globToRegExp(f.glob).test(rel));
    if (side !== void 0) {
      const own2 = loadFlow(o.root, side.path);
      if ("error" in own2) return { ok: false, reason: own2.error, kind: "invalid" };
      return { ok: true, ws: new Workspace(o, side.name, side.path, own2.sc, getPrompt, own2.title ?? side.name, void 0, wf.name) };
    }
  }
  const def = loadFlow(o.root, wf.path);
  if ("error" in def) return { ok: false, reason: def.error, kind: "invalid" };
  const ws = new Workspace(o, wf.name, wf.path, def.sc, getPrompt, def.title ?? wf.name);
  const under = ws.journalWorkflow();
  if (under === void 0 || ws.item.kind !== "item") return { ok: true, ws };
  const item = ws.item.id;
  const path = workflowAt(o.root, ws.journalBase, under);
  if (path === void 0) {
    return { ok: false, kind: "journal", reason: `${slashed2(journalPathFor(item))} was started under ${under}, which is not there: restore that file, or move the journal aside (rename or delete it) to start ${item} over under ${wf.name}.` };
  }
  const own = loadFlow(o.root, path);
  if ("error" in own) return { ok: false, reason: own.error, kind: "invalid" };
  const name = workflowNameOf(o.root, path);
  const resolved = { item: ws.item, ...ws.itemFile !== void 0 ? { file: ws.itemFile } : {} };
  return { ok: true, ws: new Workspace(o, name, path, own.sc, getPrompt, own.title ?? name, resolved, wf.name) };
}
function openWorkspace(o) {
  const loaded = loadWorkspace(o);
  if (!loaded.ok) return loaded;
  const problem = loaded.ws.ensureStarted();
  return problem === void 0 ? loaded : { ok: false, reason: problem, kind: "journal" };
}
var Unresumable = class extends Error {
  constructor(reason) {
    super(`gemworks: ${reason}`);
    this.reason = reason;
  }
  reason;
};
var Workspace = class {
  constructor(o, workflowName, workflowPath, sc, getPrompt, title, given, defaultName) {
    this.o = o;
    this.workflowName = workflowName;
    this.workflowPath = workflowPath;
    this.sc = sc;
    this.getPrompt = getPrompt;
    this.title = title;
    this.defaultName = defaultName;
    this.now = o.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
    this.workflowDir = dirname2(workflowPath);
    this.workflowFile = recordedPath(o.root, this.journalBase, workflowPath);
    this.realRoot = realPath(o.root);
    const resolved = given ?? this.resolveItem();
    this.item = resolved.item;
    this.itemFile = resolved.file;
  }
  o;
  workflowName;
  workflowPath;
  sc;
  getPrompt;
  title;
  defaultName;
  item;
  /** Under `flow-unit = "file:…"`, the work item's file: project-relative, `/`-separated. Undefined under a branch unit or with no work item. */
  itemFile;
  /** The workflow's directory: its flow file, its prompt documents and its dictionary. */
  workflowDir;
  now;
  /** The project root with its links resolved: every path is judged inside this. */
  realRoot;
  /** git's facts once read; see `repo`. */
  repoFacts;
  /** The branch's content fingerprint, once read. */
  tree;
  /** The workflow file as the journal head names it: relative to the home when it lies there (else to the root), `/`-separated. */
  workflowFile;
  /** See `journalBase`. */
  base;
  /** Whether an operation of this workspace started the work item's journal. */
  startedHere = false;
  /** git's facts, read the first time they are needed: at once for a branch unit, otherwise only when a git variable (or gh) asks; `refresh` reads them again. */
  get repo() {
    return this.repoFacts ??= (this.o.git ?? repoFacts)(this.o.root);
  }
  resolveItem() {
    const unit = this.sc.unit;
    if (unit.kind === "branch") {
      if (this.repo.unanswered === true) return { item: { kind: "inactive", reason: "git did not answer (a busy machine?); nothing is judged until it does" } };
      if (this.repo.noCommits) return { item: { kind: "inactive", reason: "no commits yet" } };
      return { item: resolveItem(unit, this.repo) };
    }
    const given = this.o.lastFile === void 0 ? void 0 : this.projectPath(this.o.lastFile, unit.glob);
    const lastFile = given !== void 0 && globToRegExp(unit.glob).test(given) ? given : this.rememberedFile(unit.glob);
    const item = resolveItem(unit, lastFile === void 0 ? {} : { lastFile });
    return item.kind === "item" && lastFile !== void 0 ? { item, file: lastFile } : { item };
  }
  /**
   * A path as the project names it — relative to the root, `/`-separated — or
   * undefined outside the project or under a directory that keeps it from
   * `glob` (hiddenDir: .git, node_modules, and .geml unless the glob names it). Links
   * are resolved on both sides, so a root reached through a link and a path
   * reported through the real one (or the other way round) agree; the path's
   * own name is kept, so a link to a file is named as itself, as the project
   * walk names it.
   */
  projectPath(path, glob = "") {
    const given = resolve2(this.o.root, path.replace(/\\/g, "/"));
    const real = join2(realPath(dirname2(given)), basename2(given));
    const rel = slashed2(relative2(this.realRoot, real));
    if (rel === "" || rel === ".." || rel.startsWith("../") || isAbsolute2(rel)) return void 0;
    return hiddenDir(glob, rel) === void 0 ? rel : void 0;
  }
  /**
   * The file of this workflow's `file:` unit a path names — relative to the
   * root or absolute, either separator — as the project names it; undefined
   * for any other path, and under a branch unit.
   */
  itemFileOf(path) {
    const unit = this.sc.unit;
    if (unit.kind !== "file") return void 0;
    const rel = this.projectPath(path, unit.glob);
    return rel !== void 0 && globToRegExp(unit.glob).test(rel) ? rel : void 0;
  }
  /** The file of the work item the context document names, while it exists and is a file of the unit. */
  rememberedFile(glob) {
    const id = this.readContext()?.item;
    return id ? this.fileOfItem(id, glob) : void 0;
  }
  /**
   * The file a `file:` unit's work item is — its id is the file's project
   * path without the extension — while the file exists and matches the unit's
   * glob; undefined under a branch unit, or when the file is gone.
   */
  fileOfItem(id, glob = this.sc.unit.kind === "file" ? this.sc.unit.glob : "") {
    if (glob === "" || !isSafeItemId(id)) return void 0;
    const slash = id.lastIndexOf("/");
    const dir = id.slice(0, Math.max(0, slash));
    const base = id.slice(slash + 1);
    const pattern = globToRegExp(glob);
    let entries;
    try {
      entries = readdirSync2(join2(this.o.root, dir), { withFileTypes: true });
    } catch {
      return void 0;
    }
    for (const e of entries) {
      const path = dir ? `${dir}/${e.name}` : e.name;
      if (e.isFile() && e.name.replace(/\.[^./]+$/, "") === base && pattern.test(path) && this.projectPath(path, glob) === path) return path;
    }
    return void 0;
  }
  /** Whether this workspace started the work item's journal: the item is new. */
  get startedJournal() {
    return this.startedHere;
  }
  /** The project root this workspace was opened on, as given. */
  get root() {
    return this.o.root;
  }
  /** The directory whose `.geml/journals/` holds the journals (WorkspaceOptions.journalBase), found the first time it is needed. */
  get journalBase() {
    return this.base ??= this.o.journalBase ?? journalBaseOf(this.o.root);
  }
  /** Where every work item's journal lives. */
  get journalsDir() {
    return join2(this.journalBase, JOURNALS_DIR);
  }
  /** The work item's content fingerprint as it stands now (the one `tool` evidence is stamped with); undefined when none applies. */
  contentTree() {
    return this.fingerprint();
  }
  /** The work item's journal; undefined with no work item. */
  get journalPath() {
    return this.item.kind === "item" ? join2(this.journalBase, journalPathFor(this.item.id)) : void 0;
  }
  /** The workflow's tool dictionary as it stands on disk (spec §5.3), read afresh: another process may have learned since. */
  dictionary() {
    return readDictionaryFile(this.workflowPath, this.sc);
  }
  /** A person answered (spec §5.3 step 6): write the lessons into the dictionary, under its lock. */
  learn(lessons) {
    learnInFile(this.workflowPath, lessons, this.sc);
  }
  /** Whether one simple command, as a key, is bound to a use some `tool` variable reads: its exit status is evidence somewhere in the workflow. */
  commandSpeaks(head) {
    const row = bindingOf(this.dictionary(), `Bash(${normalizedCommand(head)})`);
    return row?.for !== void 0 && varsBySource(this.sc, "tool").some((v) => v.source.use === row.for);
  }
  /** A path for a message: relative to the root when it lies inside, else whole. */
  shown(path) {
    return slashed2(inside2(this.o.root, path) ? relative2(this.o.root, path) : path);
  }
  /** The context document as it stands; undefined when there is none, or it is not a file that can be read. */
  readContext() {
    let text;
    try {
      text = readText(join2(this.o.root, CONTEXT_DOC));
    } catch {
      return void 0;
    }
    return readContextDoc(text);
  }
  inactiveReason() {
    return this.item.kind === "inactive" ? this.item.reason : "no work item";
  }
  /**
   * Start this item's journal (and so its context document) if it has none;
   * otherwise check the journal can be resumed, and bring the context document
   * in line with it. Returns why the journal cannot be resumed, or undefined.
   */
  ensureStarted() {
    try {
      this.act(() => void 0);
    } catch (e) {
      if (e instanceof Unresumable) return e.reason;
      throw e;
    }
    return void 0;
  }
  /**
   * The work item's content as one hash, for the `tool` evidence that expires
   * on a change (none, no fingerprint): the checkout's HEAD and status under a
   * branch unit, the episode file's text under a `file:` unit. Read before an
   * operation takes the journal's lock.
   */
  fingerprint() {
    if (this.item.kind !== "item" || varsBySource(this.sc, "tool").length === 0) return void 0;
    if (this.sc.unit.kind === "branch") return (this.tree ??= { value: (this.o.tree ?? treeFingerprint)(this.o.root) }).value;
    if (this.itemFile === void 0) return void 0;
    const key = this.sc.unit.stateKey;
    try {
      const source = readText(join2(this.o.root, this.itemFile));
      return hashText(key === void 0 ? source : withoutItemState(source, key));
    } catch {
      return "missing";
    }
  }
  /**
   * Read the journal (or start one) and put a Supervisor over it; its appends
   * are collected, not written. A journal that goes on first expires the
   * evidence its work item's content no longer bears (`tree`, Supervisor.expire).
   */
  begin(path, item) {
    const text = exists(path) ? readText(path) : null;
    const startAt = text === null ? this.itemStateOnDisk() : void 0;
    const opened = openRun({ sc: this.sc, item, workflowFile: this.workflowFile, journalText: text, source: "resume", now: this.now(), ...startAt !== void 0 ? { startAt } : {} });
    if (!opened.ok) {
      throw new Unresumable(`${this.shown(path)} cannot be resumed: ${opened.reason.replace(/\.$/, "")}. Move it aside (rename or delete it) to start ${item} over.`);
    }
    const out = text === null ? [opened.head, ...opened.blocks] : [...opened.blocks];
    const fingerprint = () => this.fingerprint();
    const sup = new Supervisor(this.sc, opened.run, {
      append: (b) => out.push(b),
      now: () => this.now(),
      tools: this.o.tools,
      dictionary: this.dictionary(),
      get tree() {
        return fingerprint();
      },
      isBranch: (name) => isLocalBranch(this.o.root, name)
    });
    const begun = { text, sup, out, ...text === null ? {} : { stateBefore: opened.run.snapshot.state }, historyLength: opened.run.history.length };
    if (text !== null) {
      sup.expire(metaFor(this.now()));
      sup.elapse(metaFor(this.now()));
    }
    return begun;
  }
  /** Append what the operation produced, and say what it did to the stage. Called under the journal's lock. */
  finish(path, b) {
    if (b.out.length) appendOrCreate(path, "", b.out.join(""));
    const snapshot = b.sup.snapshot;
    const entered2 = b.sup.run.history.slice(b.historyLength).filter((s) => s.cause === "transition").map((s) => s.state);
    const changed = b.text === null || entered2.length > 0 || snapshot.state !== b.stateBefore;
    return { change: { entered: entered2 }, snapshot, entry: stageEntryRev(b.sup.run.history), changed, fresh: b.text === null };
  }
  /**
   * After the journal's lock is released: bring the context document in line
   * with the journal, and say what the operation did to the stage — with the
   * stage text when it changed the stage. The operation is recorded by now, so
   * a document that cannot be written never fails it: its result goes without
   * the text, and the next operation writes the document.
   */
  staged(f, item) {
    if (f.fresh) this.startedHere = true;
    let text;
    try {
      if (this.o.writesContext === false) text = f.changed ? this.stageText(f.snapshot) : void 0;
      else text = this.reconcile(f, item);
    } catch {
      text = void 0;
    }
    return f.changed && text !== void 0 ? { ...f.change, context: text } : f.change;
  }
  /** The stage text of `snap`, built and not written. */
  stageText(snap) {
    return buildStageContext(this.sc, snap, (ref) => this.getPrompt(ref, this.workflowPath, this.o.root), this.dictionary()).text;
  }
  /**
   * Make the context document speak for this item's current stage unless it
   * already does — it names the item and the state, and was written during
   * this entry of the stage (a revision from the entry to now: evidence or a
   * patch inside the stage leaves the stage text as it is, and only the
   * `#vars` view beside it is rewritten). Returns the stage text it then holds.
   */
  reconcile(f, item) {
    const was = this.readContext();
    const snap = f.snapshot;
    if (was !== void 0 && was.item === item && was.state === snap.state && was.rev >= f.entry && was.rev <= snap.rev) {
      if (was.vars === void 0 || canonical(was.vars) !== canonical(snap.vars)) this.writeVars(was, item, snap.vars);
      return was.text;
    }
    return this.writeContext(snap, item, f.fresh);
  }
  /** Rewrite the document's `#vars` view, its stage block as it was, while the document still speaks for `was`. */
  writeVars(was, item, vars) {
    const path = join2(this.o.root, CONTEXT_DOC);
    withLock(path, () => {
      const now = exists(path) ? readContextDoc(readText(path)) : void 0;
      if (now === void 0 || now.item !== item || now.state !== was.state || now.rev !== was.rev) return;
      writeAtomic(path, renderContextDoc({ state: was.state, rev: was.rev, text: was.text, included: [], truncated: [] }, { at: was.at, item, vars }));
    });
  }
  /**
   * Lock, read the journal, build a Supervisor over it, run `fn`, append what
   * it produced, release; then bring the context document in line. A lazy
   * workspace whose operation recorded nothing in a journal that is not there
   * yet writes nothing at all.
   */
  act(fn) {
    const path = this.journalPath;
    if (path === void 0 || this.item.kind !== "item") return void 0;
    const item = this.item.id;
    const done = withLock(path, () => {
      const b = this.begin(path, item);
      const opening = b.out.length;
      const value = fn(b.sup);
      const idle = this.o.lazy === true && b.text === null && b.out.length === opening;
      return { value, finished: idle ? void 0 : this.finish(path, b) };
    });
    if (done.finished === void 0) return { value: done.value, change: { entered: [] } };
    const change = this.staged(done.finished, item);
    this.keepItemState(done.finished.snapshot.state);
    return { value: done.value, change };
  }
  /** The state the item file says the item stands in, for a workflow that keeps it there (`flow-state-key`); undefined otherwise. */
  itemStateOnDisk() {
    const key = this.sc.unit.kind === "file" ? this.sc.unit.stateKey : void 0;
    if (key === void 0 || this.itemFile === void 0) return void 0;
    try {
      return itemState(readText(join2(this.o.root, this.itemFile)), key);
    } catch {
      return void 0;
    }
  }
  /**
   * Keep a file unit's item file saying where the item stands — the meta key
   * the workflow names (`flow-state-key`) — so the state travels with the file. Written only when it says
   * otherwise; a file that is gone, or a meta that cannot take the value, is
   * left as it is: the operation is recorded, and the next one tries again.
   */
  keepItemState(state) {
    const key = this.sc.unit.kind === "file" ? this.sc.unit.stateKey : void 0;
    if (key === void 0 || this.itemFile === void 0) return;
    const path = join2(this.o.root, this.itemFile);
    try {
      if (!exists(path)) return;
      const source = readText(path);
      if (itemState(source, key) === state) return;
      const next = withItemState(source, key, state);
      if (next !== void 0) writeAtomic(path, next);
    } catch {
    }
  }
  /**
   * Write the context document for `snap` under the document's own lock (it
   * is shared by every work item) and return the stage text it now holds.
   * A document another process wrote for a later revision of the same item
   * stands, and its text is returned; a new journal's document always wins.
   */
  writeContext(snap, item, fresh) {
    const ctx = buildStageContext(this.sc, snap, (ref) => this.getPrompt(ref, this.workflowPath, this.o.root), this.dictionary());
    const doc = renderContextDoc(ctx, { at: this.now(), item, vars: snap.vars });
    const path = join2(this.o.root, CONTEXT_DOC);
    return withLock(path, () => {
      const current = exists(path) ? readText(path) : void 0;
      const was = current === void 0 ? void 0 : readContextDoc(current);
      if (!fresh && was !== void 0 && was.item === item && was.rev > snap.rev) return was.text;
      if (current === void 0 || lf2(current) !== lf2(doc)) {
        if (current === void 0) ensureGitignore(join2(this.o.root, GEML_DIR));
        writeAtomic(path, doc);
      }
      return ctx.text;
    });
  }
  status() {
    return this.view().status;
  }
  /** What a host shell's fast path decides from: see core/policy.ts. */
  policy() {
    return this.view().policy;
  }
  /** The status and the policy together, from one read of the journal: what a host shell keeps after every request. */
  view() {
    return this.viewWith(() => void 0).view;
  }
  /**
   * `before` for a host shell: the gate's answer (spec §5.3) — a refusal,
   * recorded, or nothing — and the status and policy after it, from one read
   * of the journal.
   */
  beforeView(tool, callId, input, waived) {
    const r = this.viewWith((sup) => sup.gate(tool, callId, input, waived));
    const g = r.value;
    if (g === void 0 || g.kind === "allow") return { ...r.view, recorded: false };
    return { ...r.view, refusal: g.reason, recorded: true };
  }
  /** Run `fn` under the journal's lock, then read the status and the policy from the same Supervisor. gh is asked before the lock is taken. */
  viewWith(fn) {
    const gh = this.readsGh() ? this.ghFacts() : void 0;
    const dict = this.dictionary();
    const r = this.act((sup) => {
      const value = fn(sup);
      return { value, view: { status: this.statusFrom(sup, gh), policy: policyOf(this.sc, dict, sup.run) } };
    });
    if (!r) return { value: void 0, view: { status: this.statusFrom(void 0, gh), policy: policyOf(this.sc, dict, void 0) } };
    return r.value;
  }
  /** The status as a Supervisor over this item's journal sees it; no Supervisor, no work item. */
  statusFrom(sup, gh) {
    return statusOf(this.sc, {
      workflow: {
        name: this.workflowName,
        path: this.workflowFile,
        title: this.title,
        ...this.defaultName !== void 0 && this.defaultName !== this.workflowName ? { default: this.defaultName } : {}
      },
      item: this.item,
      ...this.itemTitle() !== void 0 ? { title: this.itemTitle() } : {},
      ...this.dependencies().length > 0 ? { depends: this.dependencies() } : {},
      ...gh === void 0 ? {} : { gh: gh.available ? { available: true } : { available: false, reason: gh.reason } }
    }, sup?.run);
  }
  dependsRead;
  /** The work items this one waits for (its item file's meta `depends`), each with how far it is; read once per request. */
  dependencies() {
    if (this.dependsRead !== void 0) return this.dependsRead;
    let ids = [];
    if (this.item.kind === "item" && this.itemFile !== void 0) {
      try {
        ids = dependsOf(readText(join2(this.o.root, this.itemFile)));
      } catch {
        ids = [];
      }
    }
    const flows = /* @__PURE__ */ new Map([[this.workflowFile, { sc: this.sc, title: this.title }]]);
    this.dependsRead = ids.map((id) => {
      const p = itemProgress(this.o.root, this.journalBase, id, flows, this.workflowFile);
      return p === void 0 ? { id, done: false, wrote: [] } : {
        id,
        ...p.title !== void 0 ? { title: p.title } : {},
        ...p.flow !== void 0 ? { flow: p.flow } : {},
        done: p.final,
        since: p.since,
        at: p.at,
        wrote: p.wrote
      };
    });
    return this.dependsRead;
  }
  /** Why the work item may not move to `to` yet: a work item it waits for is not done. Back to the start is always open. */
  waitingReason(to) {
    if (to === this.sc.initial) return void 0;
    const open = this.dependencies().filter((d) => !d.done);
    if (open.length === 0) return void 0;
    const names = open.map((d) => d.title !== void 0 ? `"${d.title}" (${d.id})` : d.id).join(", ");
    return `${this.item.kind === "item" ? this.item.id : "the work item"} waits for ${names}, which is not done yet: until then it only goes back to #${this.sc.initial}`;
  }
  titleRead;
  /** What the work item is called: its item file's meta `title`, read once per request; a branch has none. */
  itemTitle() {
    if (this.titleRead !== void 0) return this.titleRead.title;
    let title;
    if (this.item.kind === "item" && this.itemFile !== void 0) {
      try {
        title = itemState(readText(join2(this.o.root, this.itemFile)), "title");
      } catch {
        title = void 0;
      }
    }
    this.titleRead = { title };
    return title;
  }
  /** Before a tool call: the reason to refuse it, or undefined. */
  before(tool, callId, input) {
    return this.act((sup) => sup.deny(tool, callId, input))?.value;
  }
  /**
   * After a tool call: the evidence it is for — `tool`, from its exit status
   * or its error; `file`, from a walk of the project; git's facts when it ran
   * git or gh — and what the stage became. git's facts are the ones this
   * workspace read (when it opened, for a branch unit); a workspace that lives
   * across operations calls `refresh` to read them again.
   */
  after(ev) {
    if (this.item.kind !== "item") return { entered: [] };
    const run = this.o.tools.run.includes(ev.tool);
    const write = this.o.tools.write.includes(ev.tool);
    const command = commandOf(ev.input);
    const whole = ev.commandsOnly !== true;
    const touched = whole && (run || write && (ev.wrotePath === void 0 || this.projectPath(ev.wrotePath) !== void 0));
    const files = touched ? this.fileValues() : [];
    const git = whole && run && command !== void 0 && runsGitOrGh(command) ? this.gitValues() : [];
    const written = write && ev.wrotePath !== void 0 ? this.projectPath(ev.wrotePath) : void 0;
    const artifact = written !== void 0 && written !== this.itemFile ? written : void 0;
    const r = this.act((sup) => {
      const meta = metaFor(this.now(), ev.callId);
      const since = stageEntryRev(sup.run.history);
      const refused = ev.callId !== void 0 && sup.run.refusalLog.some((x) => x.call === ev.callId && x.rev >= since);
      if (!refused) {
        if (run && command !== void 0) {
          if (ev.exitCode !== void 0) sup.observeCommand({ command, exitCode: ev.exitCode, ...ev.commands !== void 0 ? { commands: ev.commands } : {} }, meta);
        } else if (whole) sup.observeCall(ev.tool, ev.input, !ev.isError, meta);
        if (artifact !== void 0 && !ev.isError) sup.recordWrite(ev.tool, artifact, ev.callId);
      }
      if (files.length > 0) sup.applySignals(files, meta);
      if (git.length > 0) sup.applySignals(git, meta);
    });
    return r?.change ?? { entered: [] };
  }
  /** Read git's facts again, as they are now, then gh's and the file variables' (session start, board refresh, after a git operation). */
  /** Read git's and the files' facts again and take what they say. `reread: false`, for a workspace that has just opened: git's facts it read then are this moment's. */
  refresh(o = {}) {
    if (this.item.kind !== "item") return { entered: [] };
    if (readsGit(this.sc).git && (this.repoFacts === void 0 || o.reread !== false)) this.repoFacts = (this.o.git ?? repoFacts)(this.o.root);
    const values = [...this.gitValues(), ...this.fileValues()];
    return this.act((sup) => {
      sup.applySignals(values, metaFor(this.now()));
    })?.change ?? { entered: [] };
  }
  /** A model verb (move, set); an accepted one that changed the stage carries the new stage text. A move waits for the work items this one depends on. */
  verb(name, args, callId) {
    const waiting = name === "move" && typeof args["to"] === "string" ? this.waitingReason(args["to"]) : void 0;
    if (waiting !== void 0) return { ok: false, reason: waiting };
    const r = this.act((sup) => sup.invoke(name, args, metaFor(this.now(), callId)));
    if (!r) return { ok: false, reason: this.inactiveReason() };
    return r.value.ok && r.change.context !== void 0 ? { ...r.value, context: r.change.context } : r.value;
  }
  /** A person moves the workflow. */
  advance(to) {
    const waiting = this.waitingReason(to);
    if (waiting !== void 0) return { ok: false, reason: waiting };
    const r = this.act((sup) => sup.humanTransition(to, metaFor(this.now())));
    if (!r) return { ok: false, reason: this.inactiveReason() };
    return { ...r.value, ...r.change.context !== void 0 ? { context: r.change.context } : {} };
  }
  /** A person ticks or clears a variable whose source is a person. */
  mark(name, checked) {
    const r = this.act((sup) => sup.mark(name, checked, metaFor(this.now())));
    if (!r) return { ok: false, reason: this.inactiveReason() };
    const v = r.value;
    return v.ok ? { ok: true, entered: v.entered, ...r.change.context !== void 0 ? { context: r.change.context } : {} } : v;
  }
  /** A person holds the work item (spec §5.5): evidence is still recorded, no transition is taken until they resume it. */
  pause() {
    const r = this.act((sup) => sup.pause(metaFor(this.now())));
    return r ? r.value : { ok: false, reason: this.inactiveReason() };
  }
  /** A person lets the work item go; a machine-judged transition that holds by now is taken, as theirs. */
  resume() {
    const r = this.act((sup) => sup.resume(metaFor(this.now())));
    if (!r) return { ok: false, reason: this.inactiveReason() };
    return { ...r.value, ...r.change.context !== void 0 ? { context: r.change.context } : {} };
  }
  /** A person's rollback: the recorded state only. */
  rollback(target) {
    const r = this.act((sup) => sup.rollback(target, metaFor(this.now())));
    if (!r) return { ok: false, reason: this.inactiveReason() };
    return { ...r.value, ...r.change.context !== void 0 ? { context: r.change.context } : {} };
  }
  /**
   * The current stage text from .geml/context.geml, for this work item: a
   * document that speaks for another item (or none at all) is first rewritten
   * from this item's journal. Undefined with no work item, or when the
   * document cannot be written.
   */
  context() {
    if (this.item.kind !== "item") return void 0;
    const id = this.item.id;
    const doc = this.readContext();
    if (doc?.item === id) return doc.text;
    this.act(() => void 0);
    const now = this.readContext();
    return now?.item === id ? now.text : void 0;
  }
  /**
   * The workflow file this item's journal head names (project-relative), when
   * it is another than this workspace's. Reads the journal's `#journal`
   * block; writes nothing.
   */
  journalWorkflow() {
    const path = this.journalPath;
    if (path === void 0) return void 0;
    let text;
    try {
      text = readText(path);
    } catch {
      return void 0;
    }
    const at = text.indexOf("{#journal");
    const end = at < 0 ? -1 : text.indexOf("\n===", at);
    const under = readJournal(end < 0 ? text : text.slice(0, end + 4)).meta.workflow;
    if (under === "" || under === this.workflowFile) return void 0;
    const file = workflowAt(this.o.root, this.journalBase, under);
    return file !== void 0 && resolve2(file) === resolve2(this.workflowPath) ? void 0 : under;
  }
  /** The file variables' values, from a walk of the project. */
  fileValues() {
    return fileSignals(this.sc, (glob) => globExists(this.o.root, glob));
  }
  /** Whether a variable reads gh: a git fact other than `committed`. */
  readsGh() {
    return readsGit(this.sc).gh;
  }
  /** The git variables' values; gh is asked only when a variable reads it. */
  gitValues() {
    if (!readsGit(this.sc).git) return [];
    const repo = this.repo;
    if (this.sc.unit.kind === "branch" && this.item.kind === "item" && repo.branch !== this.item.id) return [];
    const facts = repo.committed !== void 0 ? { committed: repo.committed } : {};
    if (this.readsGh()) {
      const gh = this.ghFacts();
      if (gh.available) {
        if (gh.prOpen !== void 0) facts.prOpen = gh.prOpen;
        if (gh.prMerged !== void 0) facts.prMerged = gh.prMerged;
        if (gh.ci !== void 0) facts.ci = gh.ci;
      }
    }
    return gitSignals(this.sc, facts);
  }
  /** The CI workflows that finished failing on this branch's head, and the head; undefined when gh is not read, or says nothing failed. */
  ciFailures() {
    if (!this.readsGh() || this.sc.unit.kind !== "branch" || this.item.kind !== "item" || this.repo.branch !== this.item.id) return void 0;
    const gh = this.ghFacts();
    if (!gh.available || gh.head === void 0) return void 0;
    const workflows = (gh.ci ?? []).filter((r) => r.failed === true).map((r) => r.workflow);
    return workflows.length > 0 ? { head: gh.head, workflows } : void 0;
  }
  /** What gh says about this branch; not asked off a branch (no repository, no commits yet, a detached HEAD). */
  ghFacts() {
    const repo = this.repo;
    if (repo.noCommits) return { available: false, reason: "no commits yet" };
    const branch = repo.branch;
    if (branch === void 0) return { available: false, reason: "not a git repository" };
    if (branch === "HEAD") return { available: false, reason: "detached HEAD" };
    return (this.o.gh ?? ghFacts)(this.o.root, branch);
  }
};

export {
  hasErrors,
  loadStatechart,
  outgoing,
  varsBySource,
  sourceLabel,
  TOOLS_FILE,
  keysOf,
  evidenceKeys,
  bindingOf,
  preferred,
  decide,
  fencedRow,
  readDictionary,
  renderDictionary,
  homeOf,
  ensureGitignore,
  installedWorkflows,
  projectDocOf,
  recordedPath,
  workflowAt,
  workflowNameOf,
  dictionaryPathOf,
  mergedWorkflow,
  mergeTools,
  writeWorkflow,
  readIn,
  migrateLayout,
  canonical,
  guardHolds,
  isPaused,
  readJournal,
  renderJournalMarkdown,
  verifyJournal,
  withItemState,
  itemState,
  blockText,
  readContextDoc,
  FLOW_TOOLS,
  isOwnTool,
  resolvePromptRef,
  docReader,
  resolveWorkflow,
  fileUnitOf,
  sideFlows,
  itemProgress,
  dependsOf,
  loadWorkspace,
  openWorkspace,
  Workspace
};
