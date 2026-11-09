#!/usr/bin/env node
import "./gemworks-chunk-VZ7UV3PJ.mjs";
import {
  ARTIFACT_TOOL,
  CLAUDE_CODE_TOOLS,
  CODEX_TOOLS,
  HOST_TOOLS,
  LABEL_GUIDE,
  NOTE_TOOL,
  NO_TOOLS,
  SESSIONS_PROMPT,
  addLabelled,
  addWorkflow,
  appendSession,
  artifactsOfItem,
  commits,
  contextOf,
  currentTurn,
  decisionsContext,
  decisionsFor,
  decodeRequest,
  defaultPeriods,
  handleRequest,
  hostLabel,
  labelledRows,
  latestSessionOf,
  localDay,
  newPractices,
  normalised,
  parsePeriod,
  practicesAt,
  readArtifactRows,
  readLedger,
  readPractices,
  readSessions,
  recordAnswer,
  recordDecisions,
  recordFile,
  recordPrompt,
  recordedUnlabelled,
  report,
  reportText,
  runVerb,
  unlabelledPrompts,
  useWorkflow,
  writePractices
} from "./gemworks-chunk-A32X3QBX.mjs";
import {
  FLOW_TOOLS,
  TOOLS_FILE,
  bindingOf,
  canonical,
  decide,
  dictionaryPathOf,
  docReader,
  evidenceKeys,
  fencedRow,
  hasErrors,
  homeOf,
  installedWorkflows,
  isOwnTool,
  keysOf,
  loadStatechart,
  migrateLayout,
  openWorkspace,
  preferred,
  readDictionary,
  readJournal,
  renderJournalMarkdown,
  resolvePromptRef,
  resolveWorkflow,
  verifyJournal
} from "./gemworks-chunk-LNMCAWME.mjs";
import {
  commandOf,
  personOnlyRefusal,
  runsGitOrGh,
  switchesWorkItemOnly
} from "./gemworks-chunk-UEVNGPQ5.mjs";
import {
  CONTEXT_DOC,
  FLOW_FILE,
  GEML_DIR,
  WORKFLOWS_DIR,
  exists,
  ghOncePerBranch,
  globToRegExp,
  journalBaseOf,
  readText,
  realPath
} from "./gemworks-chunk-SXXU2DVO.mjs";

// src/cli.ts
import { readFileSync as readFileSync6 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { basename as basename2, dirname as dirname4, join as join7, relative, resolve as resolve3, sep } from "node:path";

// src/hosts/dsh/launch.ts
import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
function resolveOnPath(name, env = process.env) {
  const paths = (env["PATH"] ?? env["Path"] ?? "").split(delimiter).filter((p) => p.length > 0);
  const exts = process.platform === "win32" ? (env["PATHEXT"] ?? ".COM;.EXE;.BAT;.CMD").split(";").filter((e) => e.length > 0) : [""];
  for (const dir of paths) {
    for (const ext of exts) {
      const candidate = join(dir, name + ext);
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
      }
    }
  }
  return void 0;
}
function launcherFor(env = process.env) {
  const found = resolveOnPath("dsh", env);
  if (found !== void 0) {
    const shim = /\.(cmd|bat)$/i.test(found);
    return { command: found, prefix: [], shell: shim, how: "PATH" };
  }
  const npx = resolveOnPath("npx", env) ?? "npx";
  return {
    command: npx,
    prefix: ["-y", "@deepseek-ai/dsh"],
    shell: /\.(cmd|bat)$/i.test(npx),
    how: "npx"
  };
}
function warnAboutPercent(task, shell) {
  if (!shell || !task.includes("%")) return void 0;
  return "the task contains `%`, which the Windows shell may expand before dsh sees it; check the text dsh receives, or run the two commands below by hand";
}
function run(options) {
  const spawn2 = options.spawn ?? spawnSync;
  const env = options.env ?? process.env;
  const note = options.note ?? ((line) => process.stderr.write(line + "\n"));
  const launcher = launcherFor(env);
  const dsh = [launcher.command, ...launcher.prefix].join(" ");
  const percent = warnAboutPercent(options.task, launcher.shell);
  if (percent) note(`gemworks: ${percent}`);
  const add = spawn2(
    launcher.command,
    [...launcher.prefix, "plugin", "--profile", options.profile, "add", "gemworks"],
    { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", shell: launcher.shell, env }
  );
  if (add.error !== void 0 || add.status !== 0) {
    note(`gemworks: could not add the bundle to profile "${options.profile}" with ${dsh}`);
    if (add.stderr) note(String(add.stderr).trimEnd());
    note(`gemworks: run these two by hand instead:`);
    note(`  ${dsh} plugin --profile ${options.profile} add gemworks`);
    note(`  ${dsh} --profile ${options.profile} "<your task>"`);
    return 1;
  }
  const ran = spawn2(
    launcher.command,
    [...launcher.prefix, "--profile", options.profile, options.task],
    { stdio: "inherit", shell: launcher.shell, env }
  );
  if (ran.error !== void 0) {
    note(`gemworks: ${dsh} could not be started: ${ran.error.message}`);
    return 1;
  }
  return ran.status ?? 1;
}

// src/codex.ts
import { mkdirSync as mkdirSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "node:fs";
import { tmpdir as tmpdir2 } from "node:os";
import { dirname as dirname3, join as join4, resolve } from "node:path";

// src/hosts/claude-code/fastpath.ts
var PASS = { kind: "pass" };
var CONSULT = { kind: "consult" };
var isRun = (call) => CLAUDE_CODE_TOOLS.run.includes(call.tool);
var dictOf = (p) => ({ rows: p.rows, diagnostics: [] });
var scopeOf = (p) => ({ state: p.state, uses: p.uses, declaring: (use) => p.fences[use] ?? [], fenced: (use) => (p.rules ?? []).includes(use) });
function matchesUnit(p, path, units = []) {
  if (path === void 0) return false;
  if (p !== null && p.unit.kind === "file" && globToRegExp(p.unit.glob).test(path)) return true;
  return units.some((glob) => globToRegExp(glob).test(path));
}
function beforeDecision(p, call, elsewhere = false, passes = []) {
  if (p === null || isOwnTool(call.tool)) return PASS;
  if (elsewhere) return CONSULT;
  if (!p.active) return PASS;
  const dict = dictOf(p);
  const scope = scopeOf(p);
  const command = commandOf(call.input);
  if (command !== void 0) {
    if (personOnlyRefusal(command) !== void 0) return CONSULT;
    if (switchesWorkItemOnly(command)) return PASS;
    if (switchesWorkItemOnly(command, () => true)) return CONSULT;
    const fenced = fencedRow(dict, scope, command);
    if (fenced !== void 0) return passes.includes(fenced.tool) ? { kind: "consult", waived: [fenced.tool] } : CONSULT;
  }
  const keys = keysOf(call.tool, call.input, CLAUDE_CODE_TOOLS.run, CLAUDE_CODE_TOOLS.write);
  const d = decide(dict, scope, keys);
  if (d.kind === "refuse") {
    const waived = d.keys.filter((k) => passes.includes(k));
    return waived.length === d.keys.length ? { kind: "consult", waived } : CONSULT;
  }
  for (const key of keys) {
    const row = bindingOf(dict, key);
    if (row?.for === void 0) continue;
    const pref = preferred(dict, row.for);
    if (pref !== void 0 && pref.tool !== row.tool && !(FILE_WRITERS.has(toolOf(row.tool)) && FILE_WRITERS.has(toolOf(pref.tool)))) {
      return { kind: "prefer", key: row.tool, use: row.for, preferred: pref.tool };
    }
  }
  return PASS;
}
var FILE_WRITERS = new Set(Object.values(HOST_TOOLS).flatMap((h) => h.write));
var toolOf = (pattern) => /^[^()\s]+/.exec(pattern)?.[0] ?? pattern;
function afterNeeded(p, call, o, elsewhere = false) {
  if (p === null || isOwnTool(call.tool)) return false;
  if (elsewhere) return true;
  if (matchesUnit(p, o.wrotePath)) return true;
  const run2 = isRun(call);
  const command = run2 ? commandOf(call.input) : void 0;
  if (o.gitOperation || command !== void 0 && runsGitOrGh(command)) return true;
  const dict = dictOf(p);
  const evidence = new Set(p.evidence);
  const speaks = (key) => {
    const row = bindingOf(dict, key);
    return row?.for !== void 0 && evidence.has(row.for);
  };
  const keys = command !== void 0 && typeof o.exitCode === "number" ? evidenceKeys(command) ?? [] : [];
  const signalled = keys.some(speaks);
  if (signalled && p.unit.kind === "file") return true;
  if (!p.active) return false;
  if (o.consulted) return true;
  if (!o.isError && o.wrotePath !== void 0 && !(p.written ?? []).includes(o.wrotePath)) return true;
  if (run2 && p.files.length > 0) return true;
  if (signalled) return true;
  if (!run2 && keysOf(call.tool, call.input, CLAUDE_CODE_TOOLS.run, CLAUDE_CODE_TOOLS.write).some(speaks)) return true;
  const path = o.wrotePath;
  return path !== void 0 && p.files.some((f) => globToRegExp(f).test(path));
}
function paramsToFill(p, call) {
  if (p === null || !p.active || isOwnTool(call.tool) || isRun(call)) return void 0;
  const row = bindingOf(dictOf(p), call.tool);
  if (row?.params === void 0) return void 0;
  const missing = {};
  for (const [k, v] of Object.entries(row.params)) if (call.input[k] === void 0) missing[k] = v;
  return Object.keys(missing).length > 0 ? missing : void 0;
}

// src/hosts/codex/hook.ts
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function readEvent(text2) {
  let v;
  try {
    v = JSON.parse(text2);
  } catch {
    return void 0;
  }
  if (!isObject(v) || typeof v["hook_event_name"] !== "string") return void 0;
  const str3 = (k) => typeof v[k] === "string" ? v[k] : void 0;
  return {
    hook_event_name: v["hook_event_name"],
    ...str3("session_id") !== void 0 ? { session_id: str3("session_id") } : {},
    ...str3("cwd") !== void 0 ? { cwd: str3("cwd") } : {},
    ...str3("tool_name") !== void 0 ? { tool_name: str3("tool_name") } : {},
    ...str3("tool_use_id") !== void 0 ? { tool_use_id: str3("tool_use_id") } : {},
    ...isObject(v["tool_input"]) ? { tool_input: v["tool_input"] } : {},
    ..."tool_response" in v ? { tool_response: v["tool_response"] } : {},
    ...str3("prompt") !== void 0 ? { prompt: str3("prompt") } : {},
    ...str3("last_assistant_message") !== void 0 ? { last_assistant_message: str3("last_assistant_message") } : {},
    ...str3("source") !== void 0 ? { source: str3("source") } : {},
    ...typeof v["stop_hook_active"] === "boolean" ? { stop_hook_active: v["stop_hook_active"] } : {}
  };
}
var STATUS = "__gemworks_status";
function wrapCommand(command) {
  return `( ${command} ); ${STATUS}=$?; printf '\\n[gemworks exit %s]\\n' "$${STATUS}"; exit $${STATUS}`;
}
var isWrapped = (command) => command.includes(`[gemworks exit %s]`) && command.includes(STATUS);
var WRAPPED = new RegExp(`^\\( ([\\s\\S]*) \\); ${STATUS}=\\$\\?; printf '\\\\n\\[gemworks exit %s\\]\\\\n' "\\$${STATUS}"; exit \\$${STATUS}$`);
function unwrapCommand(command) {
  const m = command.match(WRAPPED);
  return m !== null ? m[1] : command;
}
function exitCodeIn(response) {
  let last = null;
  const visit = (v) => {
    if (typeof v === "string") {
      for (const m of v.matchAll(/\[gemworks exit (\d+)\]/g)) last = Number(m[1]);
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (isObject(v)) Object.values(v).forEach(visit);
  };
  visit(response);
  return last;
}
function patchPaths(patch) {
  const out2 = [];
  for (const m of patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+?)\s*$/gm)) out2.push(m[1]);
  return out2;
}
function callOf(tool, input) {
  if (CODEX_TOOLS.write.includes(tool)) {
    const patch = typeof input["command"] === "string" ? input["command"] : "";
    return { tool, input: { files: patchPaths(patch) } };
  }
  return { tool, input };
}
var denyCall = (reason) => ({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `gemworks: ${reason}` } });
function allowCall(updatedInput, context) {
  if (updatedInput === void 0 && context === void 0) return void 0;
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      ...updatedInput !== void 0 ? { permissionDecision: "allow", updatedInput } : {},
      ...context !== void 0 ? { additionalContext: context } : {}
    }
  };
}
var contextFor = (event, text2) => ({ hookSpecificOutput: { hookEventName: event, additionalContext: text2 } });

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
var COACH_FLOWS = ["design", "feature", "bugfix", "optimize"];
var isObject2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var str = (v) => typeof v === "string" ? v : "";
var JUDGES = ["fact", "you", "model"];
var pair = (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "string" && v[0] !== "" && v[1] !== "" ? [v[0], v[1]] : null;
function readCoachFlow(name, text2, reference) {
  const lines = text2.split(/\r?\n/);
  const open = lines.findIndex((l) => /^===\s*diagram\b/.test(l.trim()) && l.includes("format=geml-statechart"));
  if (open < 0) return void 0;
  const close = lines.findIndex((l, i) => i > open && l.trim() === "===");
  let v;
  try {
    v = JSON.parse(lines.slice(open + 1, close < 0 ? void 0 : close).join("\n"));
  } catch {
    return void 0;
  }
  if (!isObject2(v) || !isObject2(v["states"])) return void 0;
  const states = Object.entries(v["states"]).flatMap(([id, s]) => {
    if (!isObject2(s)) return [];
    const ref = reference?.states.find((r) => r.id === id);
    const judge = JUDGES.find((j) => j === s["judge"]) ?? ref?.judge ?? "model";
    const expires = s["expires"] === true || s["expires"] === void 0 && ref?.expires === true;
    return [{ id, title: str(s["title"]) || id, need: str(s["description"]), final: s["final"] === true, judge, prevents: str(s["prevents"]) || ref?.prevents || "", answers: pair(s["answers"]) ?? ref?.answers ?? null, ...expires ? { expires: true } : {} }];
  });
  if (states.length === 0) return void 0;
  const at = (id) => states.findIndex((s) => s.id === id);
  const edges = (Array.isArray(v["transitions"]) ? v["transitions"] : []).flatMap((x) => {
    if (!isObject2(x) || at(str(x["from"])) < 0 || at(str(x["to"])) < 0) return [];
    const from = str(x["from"]);
    const to = str(x["to"]);
    return [{ from, to, label: str(x["label"]) || str(x["guard"]), back: at(to) !== at(from) + 1 }];
  });
  const title = text2.match(/^title\s*=\s*"([^"]*)"/m)?.[1] ?? lines[open]?.match(/caption="([^"]*)"/)?.[1] ?? name;
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
function itemProgress(item, flow, running) {
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
            flow: { type: "string", description: "The flow it belongs to, by its name: design \u65B0\u8BBE\u8BA1, feature \u65B0\u529F\u80FD, bugfix, optimize \u4F18\u5316, or one the project added (the flows are listed once)." },
            met: { type: "array", items: { type: "string" }, description: "Every step whose leave requirement is met now, by the id or title the flow lists; a way back is the same list with the later steps left out. Leave it out on an update to keep what was met." },
            said: { type: "string", description: "The person's own words, this turn, that meet a step they judge (marked you), e.g. \u300C\u597D\u4E86\u300D. Needed when met newly names such a step; without their words leave the step for their press." },
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
  return `Gemworks: before a turn ends, report the work items it was about with the gemworks \`work\` tool: the flow each belongs to, every step whose leave requirement is met now (\`met\`), what it still needs, what you will do next, what it should be at the end; update one on the way by its id. A step marked (you) is the person's to judge: name it in \`met\` only with their own words in \`said\`, else leave it for their press. The flows: ${listed}.`;
}
function workContext(items, flows, limit = 8) {
  const open = items.filter((i) => i.status === "open").slice(0, limit);
  if (open.length === 0) return [];
  const where = (i) => {
    const flow = flows.find((f) => f.name === i.flow);
    const here = flow !== void 0 ? itemProgress(i, flow).here ?? i.state : i.state;
    const met = i.met.length > 0 ? `met ${i.met.map((m) => m.step).join(", ")}; ` : "";
    return `${met}at ${here} ${flow?.states.find((s) => s.id === here)?.title ?? ""}`.trimEnd();
  };
  return [`[gemworks] work items on the way: ${open.map((i) => `#${i.id} \xAB${i.title}\xBB (${i.flow}: ${where(i)}${i.needs !== "" ? `, needs ${i.needs}` : ""})`).join("; ")}`];
}
function workEvents(args, flows, items, at, turn, newId) {
  const given = Array.isArray(args["items"]) ? args["items"] : [];
  const events = [];
  const errors = [];
  given.forEach((x, n) => {
    if (!isObject2(x)) {
      errors.push(`item ${n + 1} is not an object`);
      return;
    }
    const flow = flows.find((f) => f.name === str(x["flow"]));
    if (flow === void 0) {
      errors.push(`item ${n + 1}: flow must be one of ${flows.map((f) => f.name).join(", ")}`);
      return;
    }
    const stepNamed = (name) => flow.states.find((s) => s.id === name) ?? flow.states.find((s) => s.title === name);
    const ids = flow.states.map((s) => s.id).join(", ");
    const id = str(x["id"]).replace(/^#/, "");
    const was = id !== "" ? items.find((i) => i.id === id) : void 0;
    if (id !== "" && was === void 0) {
      errors.push(`item ${n + 1}: no work item #${id} is on the way`);
      return;
    }
    let named2;
    if (Array.isArray(x["met"])) {
      const unknown = x["met"].find((m) => stepNamed(str(m)) === void 0);
      if (unknown !== void 0) {
        errors.push(`item ${n + 1}: ${flow.name} has no step "${str(unknown)}" (${ids})`);
        return;
      }
      const steps = x["met"].map((m) => stepNamed(str(m)));
      named2 = steps.some((s) => s.final) ? flow.states.filter((s) => !s.final) : steps;
    } else if (str(x["state"]) !== "") {
      const state = stepNamed(str(x["state"]));
      if (state === void 0) {
        errors.push(`item ${n + 1}: ${flow.name} has no state "${str(x["state"])}" (${ids})`);
        return;
      }
      const upTo = flow.states.indexOf(state);
      named2 = flow.states.filter((s, i) => !s.final && (state.final || i < upTo));
    }
    const title = str(x["title"]).trim() || was?.title || "";
    if (title === "") {
      errors.push(`item ${n + 1} has no title`);
      return;
    }
    const before = was?.met ?? [];
    const metIds = [...new Set(named2 !== void 0 ? named2.map((s) => s.id) : before.map((m) => m.step))];
    const said = str(x["said"]).trim();
    const theirs = metIds.map((s) => stepNamed(s)).filter((s) => s.judge === "you" && !before.some((m) => m.step === s.id));
    if (theirs.length > 0 && said === "") {
      errors.push(`item ${n + 1}: ${theirs.map((s) => s.title).join("\u3001")} is the person's to meet: put what they said in \`said\`, or leave it for their press`);
      return;
    }
    const met = metIds.map((s) => before.find((m) => m.step === s) ?? { step: s, at, turn, ...theirs.some((t) => t.id === s) ? { said } : {} });
    const p = itemProgress({ met }, flow);
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
function turnItem(items, session) {
  return items.find((x) => x.status === "open" && x.session === session);
}

// src/board-file.ts
import { spawn, spawnSync as spawnSync2 } from "node:child_process";
import { existsSync, mkdirSync as mkdirSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname as dirname2, isAbsolute as isAbsolute2, join as join3 } from "node:path";

// src/core/board-page.ts
var SHOWN = { items: 12, artifacts: 5, decisions: 5 };
function literal(text2) {
  return text2.replace(/\s*\r?\n\s*/g, " ").replace(/[\\*`~$[\]|{}%!#<>_]/g, (c) => `\\${c}`);
}
var target = (href) => href.replace(/[ ()]/g, (c) => encodeURIComponent(c));
var label = (text2) => text2.replace(/"/g, "'").replace(/[\r\n]+/g, " ");
var JUDGE_WORDS = { fact: "\u4E8B\u5B9E", you: "\u4F60\u5224", model: "\u6A21\u578B\u5224" };
var named = (i) => `\\#${i.id} ${literal(i.title)}`;
function stepsLine(i, flow) {
  const p = itemProgress(i, flow);
  return flow.states.filter((s) => !s.final).map((s) => {
    const cell = p.cells.find((c) => c.id === s.id)?.cell;
    return cell === "here" ? `**${literal(s.title)}**` : cell === "met" ? `${literal(s.title)} \u2713` : literal(s.title);
  }).join(" \u2192 ");
}
var sayOne = (answers) => answers.map((a) => `\u300C${literal(a)}\u300D`).join("\u6216");
function waitingOf(flows, items, asks, proposals) {
  const out2 = [];
  for (const q of asks) {
    const item = q.item !== void 0 ? items.find((x) => x.id === q.item) : void 0;
    out2.push({ ...item !== void 0 ? { item } : { label: "\u63D0\u95EE" }, ask: q.question, say: q.options });
  }
  for (const item of items) {
    const flow = flows.find((f) => f.name === item.flow);
    if (flow === void 0 || item.status !== "open") continue;
    const p = itemProgress(item, flow);
    const step = flow.states.find((s) => s.id === p.here);
    if (p.whose !== "you" || step === void 0) continue;
    out2.push({ item, ask: `${step.title}\uFF1A${step.need}`, say: step.answers ?? ["\u597D\u4E86", "\u6CA1\u597D"] });
  }
  for (const p of proposals.filter((x) => x.status === "open")) {
    const what = p.kind === "new-flow" ? `\u65B0\u7684\u4E00\u7C7B\u6D3B\u300C${p.title ?? p.flow}\u300D\uFF1A${(p.steps ?? []).map((s) => s.title).join(" \u2192 ")}` : p.kind === "add-step" ? `${p.flow} \u52A0\u4E00\u6B65\u300C${p.step?.title ?? ""}\u300D` : `${p.flow} \u53BB\u6389\u300C${p.remove ?? ""}\u300D`;
    const name = p.title ?? p.step?.title ?? p.remove ?? p.flow;
    out2.push({ label: `\u63D0\u8BAE ${p.id}`, ask: `${what}${p.why !== "" ? `\uFF08${p.why}\uFF09` : ""}`, say: [`\u52A0\u4E0A${name}`, `\u4E0D\u7528${name}`] });
  }
  return out2;
}
function waitingRows(i, open) {
  return waitingOf(i.flows, open, i.asks, i.proposals).map((w) => `| ${w.item !== void 0 ? `\\#${w.item.id} ${literal(w.item.title)}` : literal(w.label ?? "")} | ${literal(w.ask)} | ${sayOne(w.say)} |`);
}
function table(head, rows, id, none) {
  if (rows.length === 0) return [none];
  const cells = head.split("|").filter((c) => c.trim() !== "").length;
  return [`=== table {#${id}}`, head, `|${"---|".repeat(cells)}`, ...rows, "==="];
}
function flowPicture(flow, on) {
  const here = /* @__PURE__ */ new Map();
  for (const item of on) {
    const at = itemProgress(item, flow).here;
    if (at !== null) here.set(at, [...here.get(at) ?? [], item]);
  }
  const node = (s, n) => s.final ? `s${n}(["${label(s.title)}"])` : `s${n}["${label(s.title)} \xB7 ${JUDGE_WORDS[s.judge]}"]${here.has(s.id) ? ":::here" : ""}`;
  const steps = [...flow.states.filter((s) => !s.final), ...flow.states.filter((s) => s.final)];
  const caption = [...here.entries()].map(([step, items]) => `${items.map((x) => `#${x.id}`).join("\u3001")} \u5728${flow.states.find((s) => s.id === step)?.title ?? step}`).join("\uFF1B");
  return [
    `=== diagram {#flow-${flow.name} format=mermaid caption="${label(`${flow.title}\uFF1A${caption}`)}"}`,
    "graph LR",
    `  ${steps.map(node).join(" --> ")}`,
    "  classDef here stroke-width:3px",
    "==="
  ];
}
function boardPage(i) {
  const open = i.items.filter((x) => x.status === "open" || x.status === "held").slice(0, SHOWN.items);
  const out2 = [
    "=== meta",
    `title = "${label(`Gemworks \u770B\u677F \xB7 ${i.project}`)}"`,
    `updated = "${label(i.updated)}"`,
    "===",
    "",
    "=== note",
    "Gemworks \u6BCF\u56DE\u5408\u6539\u5199\u8FD9\u4E00\u9875\u3002VS Code \u7CFB\u7F16\u8F91\u5668\u91CC\u6253\u5F00\u9884\u89C8\u4F1A\u81EA\u52A8\u5237\u65B0\uFF1B\u6D4F\u89C8\u5668\u91CC\u6309 F5 \u5237\u65B0\u3002\u4E0B\u9762\u8981\u4F60\u5B9A\u7684\u4E8B\uFF0C\u90FD\u5728\u5BF9\u8BDD\u91CC\u56DE\u7B54\u3002",
    "===",
    "",
    "# \u7B49\u4F60 {#waiting}",
    "",
    ...table("| \u4E8B\u9879 | \u8981\u4F60\u5B9A | \u5728\u5BF9\u8BDD\u91CC\u8BF4 |", waitingRows(i, open), "asks", "\u6CA1\u6709\u8981\u4F60\u5B9A\u7684\u4E8B\u3002"),
    "",
    "# \u5DE5\u4F5C\u9879 {#items}",
    ""
  ];
  const itemRows = open.flatMap((item) => {
    const flow = i.flows.find((f) => f.name === item.flow);
    if (flow === void 0) return [];
    const where = `${stepsLine(item, flow)}${item.status === "held" ? "\uFF08\u6682\u7F13\uFF09" : ""}`;
    return [`| ${named(item)} | ${literal(flow.title)} | ${where} | ${literal(item.needs)} | ${literal(item.next)} |`];
  });
  out2.push(...table("| \u5DE5\u4F5C\u9879 | \u6D41\u7A0B | \u5728\u54EA\u4E00\u6B65 | \u8FD8\u8981\u4EC0\u4E48 | \u63A5\u4E0B\u6765 |", itemRows, "work", "\u6CA1\u6709\u8FDB\u884C\u4E2D\u7684\u5DE5\u4F5C\u9879\u3002"));
  const practiced = open.flatMap((item) => {
    const flow = i.flows.find((f) => f.name === item.flow);
    const here = flow !== void 0 && item.status === "open" ? itemProgress(item, flow).here : null;
    const at = flow !== void 0 && here !== null ? practicesAt(i.practices, flow.name, here) : [];
    if (flow === void 0 || here === null || at.length === 0) return [];
    return ["", `${named(item)} \u5728\u300C${literal(flow.states.find((s) => s.id === here)?.title ?? here)}\u300D\uFF1A`, "", ...at.map((p, n) => `${n + 1}. ${literal(p.text)}`)];
  });
  if (practiced.length > 0) out2.push("", "## \u8FD9\u4E00\u6B65\u7684\u505A\u6CD5 {#practices}", ...practiced);
  out2.push("", "# \u4EA7\u7269 {#made}", "");
  const made = open.flatMap((item) => artifactsOfItem(i.artifacts, item.id).slice(0, SHOWN.artifacts).map((a) => {
    const last = a.versions.at(-1);
    const bare = a.name.replace(/`/g, "");
    const name = literal(a.kind === "link" ? bare : bare.split(/[\\/]/).at(-1) ?? bare);
    const href = i.linkOf(last);
    return `| ${named(item)} | ${href !== void 0 ? `[${name}](${target(href)})` : name} | ${literal(last.version)} | ${i.clock(last.at)} |`;
  }));
  out2.push(...table("| \u5DE5\u4F5C\u9879 | \u4EA7\u7269 | \u7248\u672C | \u65F6\u95F4 |", made, "artifacts", "\u8FD8\u6CA1\u6709\u4EA7\u7269\u3002"));
  out2.push("", "# \u6D41\u7A0B {#flow}", "");
  const pictured = i.flows.flatMap((flow) => {
    const on = open.filter((x) => x.flow === flow.name && x.status === "open");
    return on.length > 0 ? [...flowPicture(flow, on), ""] : [];
  });
  out2.push(...pictured.length > 0 ? pictured.slice(0, -1) : ["\u6CA1\u6709\u5DE5\u4F5C\u9879\u5728\u6D41\u7A0B\u4E0A\u3002"]);
  const decided = i.decisions.slice(-SHOWN.decisions).reverse();
  out2.push("", "# \u522B\u7684\u4F1A\u8BDD\u7684\u51B3\u5B9A {#decisions}", "");
  out2.push(...decided.length > 0 ? decided.map((d) => `- ${literal(d.text)}\uFF08${literal(i.hostName(d.host))}\uFF0C${i.clock(d.at)}\uFF09`) : ["\u8FD8\u6CA1\u6709\u3002"]);
  return `${out2.join("\n")}
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
function progIdOf(out2) {
  return /ProgId\s+REG_SZ\s+(\S+)/.exec(out2)?.[1];
}
function browserCommandArgv(progId) {
  return ["reg", "query", `HKCR\\${progId}\\shell\\open\\command`, "/ve"];
}
function browserExeOf(out2) {
  const line = /REG_(?:EXPAND_)?SZ\s+(.+)$/m.exec(out2)?.[1]?.trim();
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
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join as join2 } from "node:path";
import { fileURLToPath } from "node:url";

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
function parseLines(text2, block, is) {
  const lines = text2.split(/\r?\n/);
  const open = lines.findIndex((l) => l.trim() === `=== data {#${block} format=jsonl}`);
  if (open < 0) return [];
  const close = lines.findIndex((l, i) => i > open && l.trim() === "===");
  const out2 = [];
  for (const line of lines.slice(open + 1, close < 0 ? void 0 : close)) {
    if (line.trim() === "") continue;
    try {
      const v = JSON.parse(line);
      if (is(v)) out2.push(v);
    } catch {
    }
  }
  return out2;
}
var linesText = (title, block, records) => `=== meta
title = "${title}"
===

=== data {#${block} format=jsonl}
${records.map((r) => `${JSON.stringify(r)}
`).join("")}===
`;
var isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var str2 = (v) => typeof v === "string" ? v : "";
var JUDGES2 = ["fact", "you", "model"];
var isStep = (v) => isObj(v) && ["id", "title", "need", "prevents"].every((k) => typeof v[k] === "string") && JUDGES2.includes(v["judge"]);
var isProposal = (v) => isObj(v) && ["id", "flow", "why", "at"].every((k) => typeof v[k] === "string") && ["add-step", "remove-step", "new-flow"].includes(v["kind"]) && ["model", "gemworks", "reference"].includes(v["by"]) && ["open", "accepted", "declined"].includes(v["status"]) && (v["step"] === void 0 || isStep(v["step"])) && (v["steps"] === void 0 || Array.isArray(v["steps"]) && v["steps"].every(isStep));
var parseProposals = (text2) => parseLines(text2, "proposals", isProposal);
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
    const title = str2(x["title"]).trim();
    if (title === "") return void 0;
    const judge = JUDGES2.includes(x["judge"]) ? x["judge"] : "model";
    const step = { id: stepId(title, taken), title, need: str2(x["need"]).trim(), judge, prevents: str2(x["prevents"]).trim() };
    taken.push(step.id);
    return step;
  };
  given.forEach((v, n) => {
    if (!isObj(v)) {
      errors.push(`proposal ${n + 1} is not an object`);
      return;
    }
    const why = str2(v["why"]).trim();
    if (v["kind"] === "add-step") {
      const flow = flows.find((f) => f.name === str2(v["flow"]));
      if (flow === void 0) {
        errors.push(`proposal ${n + 1}: no flow "${str2(v["flow"])}"`);
        return;
      }
      const after = str2(v["after"]);
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
      const title = str2(v["title"]).trim();
      const raw = Array.isArray(v["steps"]) ? v["steps"] : [];
      const taken = ["done"];
      const steps = raw.flatMap((x) => isObj(x) ? [stepOf(x, taken)] : []).filter((s) => s !== void 0);
      if (title === "" || steps.length === 0) {
        errors.push(`proposal ${n + 1}: a new kind of work needs its title and its steps`);
        return;
      }
      const name = stepId(str2(v["name"]) || title, flows.map((f) => f.name));
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
    const out2 = flow.edges.filter((e) => e.from === gone && !e.back).map((e) => e.to);
    const kept = flow.edges.filter((e) => e.from !== gone && e.to !== gone);
    const joined = into.flatMap((a) => out2.map((b) => ({ from: a, to: b, label: "", back: false })));
    const backs = flow.edges.filter((e) => e.back && e.to === gone).map((e) => ({ ...e, to: out2[0] ?? e.to })).filter((e) => e.to !== gone);
    return { ...flow, states: flow.states.filter((s) => s.id !== gone), edges: [...kept, ...joined, ...backs] };
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
  const here = itemProgress(i, flow).here;
  if (here === null) return [];
  const at = practicesAt(practices, flow.name, here);
  if (at.length === 0) return [];
  const step = flow.states.find((s) => s.id === here)?.title ?? here;
  return [`[gemworks] at ${flow.name} ${here} ${step} for \xAB${i.title}\xBB, the practices: ${at.map((p, n) => `(${n + 1}) ${p.text}${p.ref !== void 0 ? ` [${p.ref}]` : ""}`).join(" ")}`];
}

// src/loop.ts
var SHIPPED_COACH = fileURLToPath(new URL("../coach/", import.meta.url));
var LOOP_TOOLS = [WORK_TOOL, PRACTICE_TOOL, PROPOSE_TOOL_ON_BOARD, ANSWER_TOOL, ASK_TOOL_ON_BOARD, ARTIFACT_TOOL];
var isLoopTool = (name) => LOOP_TOOLS.some((t) => t.name === name);
var gemlHome = (root) => join2(journalBaseOf(root), GEML_DIR);
var readAt = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return void 0;
  }
};
var stampOf = (at) => Date.parse(at).toString(36).slice(-6);
function coachFlowsAt(root, shipped = SHIPPED_COACH) {
  const own = join2(gemlHome(root), "coach");
  const flows = [];
  for (const name of COACH_FLOWS) {
    const shippedText = readAt(join2(shipped, `${name}.geml`));
    const reference = shippedText !== void 0 ? readCoachFlow(name, shippedText) : void 0;
    const ownText = readAt(join2(own, `${name}.geml`));
    const teamText = ownText === void 0 ? readAt(join2(root, ".gemworks", "flows", `${name}.geml`)) : void 0;
    const flow = (ownText !== void 0 ? readCoachFlow(name, ownText, reference) : teamText !== void 0 ? readCoachFlow(name, teamText, reference) : void 0) ?? reference;
    if (flow !== void 0) flows.push(flow);
  }
  let added = [];
  try {
    added = readdirSync(own).filter((n) => n.endsWith(".geml") && !COACH_FLOWS.includes(n.slice(0, -".geml".length))).sort();
  } catch {
  }
  for (const file of added) {
    const text2 = readAt(join2(own, file));
    const flow = text2 !== void 0 ? readCoachFlow(file.slice(0, -".geml".length), text2) : void 0;
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
  const text2 = readAt(join2(gemlHome(root), "proposals.geml"));
  return text2 !== void 0 ? parseProposals(text2) : [];
}
function saveProposals(root, list) {
  const path = join2(gemlHome(root), "proposals.geml");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, proposalsText(list), "utf8");
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
    const path = join2(gemlHome(root), "coach", `${flow.name}.geml`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, flowText(p.kind === "new-flow" ? flow : applyToFlow(flow, p)), "utf8");
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

// src/board-file.ts
var BOARD_FILE = "board.geml";
var boardPath = (root) => join3(gemlHome(root), BOARD_FILE);
var pad = (n) => String(n).padStart(2, "0");
var clock = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
var day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
function linkOf(row, home) {
  if (row.kind === "link") return /^https?:\/\//i.test(row.where) ? row.where : void 0;
  if (row.where === "git") return fileUrl(join3(home, row.name.replace(/`/g, "")));
  if (row.where.startsWith("artifacts/")) return fileUrl(join3(home, GEML_DIR, row.where));
  return isAbsolute2(row.where) ? fileUrl(row.where) : void 0;
}
function boardText(root, now = /* @__PURE__ */ new Date()) {
  const home = journalBaseOf(root);
  const flows = coachFlowsAt(root);
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
    project: basename(home),
    updated: day(now),
    flows,
    items: workItemsAt(root, flows),
    asks,
    proposals: proposalsAt(root),
    practices,
    artifacts,
    decisions: decisionsFor(root, "", null, now.toISOString()),
    linkOf: (row) => linkOf(row, home),
    clock,
    hostName: hostLabel
  });
}
function writeBoard(root, now = /* @__PURE__ */ new Date()) {
  try {
    const path = boardPath(root);
    const text2 = boardText(root, now);
    let was = "";
    try {
      was = readFileSync2(path, "utf8");
    } catch {
    }
    const body = (s) => s.replace(/^updated = .*$/m, "");
    if (body(was) !== body(text2)) {
      mkdirSync2(dirname2(path), { recursive: true });
      writeFileSync2(path, text2, "utf8");
    }
    return path;
  } catch {
    return void 0;
  }
}
function windowsBrowser() {
  try {
    const id = progIdOf(spawnSync2(BROWSER_PROGID_ARGV[0], BROWSER_PROGID_ARGV.slice(1), { encoding: "utf8", timeout: 3e3, windowsHide: true }).stdout ?? "");
    if (id === void 0) return void 0;
    const argv2 = browserCommandArgv(id);
    return browserExeOf(spawnSync2(argv2[0], argv2.slice(1), { encoding: "utf8", timeout: 3e3, windowsHide: true }).stdout ?? "");
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
  const mark = join3(tmpdir(), "gemworks-board", `${session.replace(/[^A-Za-z0-9._-]/g, "_")}.opened`);
  if (existsSync(mark)) {
    writeBoard(root);
    return void 0;
  }
  try {
    mkdirSync2(dirname2(mark), { recursive: true });
    writeFileSync2(mark, (/* @__PURE__ */ new Date()).toISOString(), "utf8");
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

// src/codex.ts
var NOTHING = { stdout: "", code: 0 };
function stateFileFor(env, session) {
  const dir = env["PLUGIN_DATA"] !== void 0 && env["PLUGIN_DATA"] !== "" ? env["PLUGIN_DATA"] : join4(tmpdir2(), "gemworks-codex");
  return join4(dir, `${session.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
}
function readState(file) {
  try {
    const v = JSON.parse(readFileSync3(file, "utf8"));
    return { delivered: typeof v.delivered === "string" ? v.delivered : null, decisionsSeen: typeof v.decisionsSeen === "string" ? v.decisionsSeen : null, committed: v.committed === true, ...v.acted === true ? { acted: true } : {} };
  } catch {
    return { delivered: null, decisionsSeen: null, committed: false };
  }
}
function writeState(file, state) {
  mkdirSync3(dirname3(file), { recursive: true });
  writeFileSync3(file, JSON.stringify(state), "utf8");
}
function speaksEvidence(policy, command) {
  const keys = evidenceKeys(command);
  if (keys === null) return false;
  const dict = { rows: policy.rows, diagnostics: [] };
  const evidence = new Set(policy.evidence);
  return keys.some((k) => {
    const row = bindingOf(dict, k);
    return row?.for !== void 0 && evidence.has(row.for);
  });
}
function projectPath(root, path) {
  if (path === void 0) return void 0;
  const p = normalised(path);
  const base = normalised(root)?.replace(/\/+$/, "");
  if (p === void 0 || base === void 0) return void 0;
  if (p.startsWith(`${base}/`)) return p.slice(base.length + 1);
  if (p.startsWith("/") || /^[A-Z]:/.test(p)) return void 0;
  return p === "" ? void 0 : p;
}
var out = (o) => o === void 0 ? NOTHING : { stdout: `${JSON.stringify(o)}
`, code: 0 };
async function runCodex(text2, env, platform = process.platform) {
  const ev = readEvent(text2);
  if (ev === void 0) return NOTHING;
  const root = resolve(ev.cwd ?? process.cwd());
  const file = stateFileFor(env, ev.session_id ?? "codex");
  const state = readState(file);
  const ask = (op) => handleRequest({ v: 1, root, ...op });
  const sid = ev.session_id ?? "codex";
  const record = (f) => {
    try {
      f();
    } catch {
    }
  };
  const deliver = (event, status, always = false) => {
    const doc = join4(root, CONTEXT_DOC);
    if (!exists(doc)) return void 0;
    const seen = contextOf(readText(doc));
    if (seen === void 0 || !always && seen.key === state.delivered) return void 0;
    const item = status?.item;
    if (item === void 0 || item.kind !== "item" || item.id !== seen.item) return void 0;
    state.delivered = seen.key;
    writeState(file, state);
    return contextFor(event, seen.text);
  };
  switch (ev.hook_event_name) {
    case "SessionStart": {
      record(() => {
        appendSession(root, "codex", sid, () => []);
      });
      let told = "";
      try {
        told = [SESSIONS_PROMPT, ...loopPrompt(coachFlowsAt(root))].join("\n\n");
      } catch {
      }
      if (ev.source === void 0 || ev.source === "startup") {
        try {
          if (boardHasWork(root)) openBoardOnce(root, sid);
        } catch {
        }
      }
      const res = await ask({ op: "status" });
      let stage;
      if (res.ok && res.shell.status !== null) {
        const fresh = await ask({ op: "refresh" });
        stage = deliver("SessionStart", (fresh.ok ? fresh.shell.status : null) ?? res.shell.status, true)?.hookSpecificOutput.additionalContext;
      }
      const said = [stage, told].filter((x) => x !== void 0 && x !== "").join("\n\n");
      return said === "" ? NOTHING : out(contextFor("SessionStart", said));
    }
    case "UserPromptSubmit": {
      let shared;
      record(() => {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        if (ev.prompt !== void 0 && ev.prompt.trim() !== "") recordPrompt(root, "codex", sid, ev.prompt, now);
        const fresh = decisionsFor(root, sid, state.decisionsSeen, now);
        state.decisionsSeen = now;
        writeState(file, state);
        if (fresh.length > 0) shared = decisionsContext(fresh, (d) => `${hostLabel(d.host)}${d.branch !== void 0 ? ` \xB7 ${d.branch}` : ""}\uFF0C${new Date(d.at).toTimeString().slice(0, 5)}`);
      });
      if (state.acted === true) {
        state.acted = false;
        record(() => writeState(file, state));
      }
      record(() => {
        writeBoard(root);
      });
      let loop = [];
      try {
        loop = loopContext(root, sid);
      } catch {
      }
      const res = await ask({ op: "status" });
      const stage = res.ok && res.shell.status !== null ? deliver("UserPromptSubmit", res.shell.status) : void 0;
      const said = [stage?.hookSpecificOutput.additionalContext, shared, ...loop].filter((x) => x !== void 0 && x !== "");
      return said.length === 0 ? NOTHING : out(contextFor("UserPromptSubmit", said.join("\n\n")));
    }
    case "PreToolUse": {
      const tool = ev.tool_name;
      if (tool === void 0 || isOwnTool(tool)) return NOTHING;
      const input = ev.tool_input ?? {};
      const call = callOf(tool, input);
      const res = await ask({ op: "status" });
      if (!res.ok || res.shell.policy === null) return NOTHING;
      const { policy, status } = res.shell;
      const dictionary = status !== null ? dictionaryPathOf(status.workflow.path).split("\\").join("/") : TOOLS_FILE;
      let context;
      const decision = beforeDecision(policy, call);
      if (decision.kind === "prefer") context = `[gemworks] ${decision.use}'s preferred tool is ${decision.preferred}; this call uses ${decision.key}.`;
      else if (decision.kind === "consult") {
        const before = await ask({ op: "before", tool, callId: ev.tool_use_id ?? "codex", input: call.input, cwd: root, ...decision.waived !== void 0 ? { waived: decision.waived } : {} });
        if (before.ok && before.refusal !== void 0) return out(denyCall(before.refusal));
      }
      let updated;
      const fill = paramsToFill(policy, call);
      if (fill !== void 0) updated = { ...input, ...fill };
      const command = CODEX_TOOLS.run.includes(tool) ? commandOf(input) : void 0;
      if (command !== void 0 && policy.active && platform !== "win32" && !isWrapped(command) && speaksEvidence(policy, command)) updated = { ...updated ?? input, command: wrapCommand(command) };
      return out(allowCall(updated, context));
    }
    case "PostToolUse": {
      const tool = ev.tool_name;
      if (tool === void 0 || isOwnTool(tool)) return NOTHING;
      const given = ev.tool_input ?? {};
      const raw = CODEX_TOOLS.run.includes(tool) ? commandOf(given) : void 0;
      const input = raw !== void 0 && isWrapped(raw) ? { ...given, command: unwrapCommand(raw) } : given;
      const call = callOf(tool, input);
      record(() => {
        if (CODEX_TOOLS.write.includes(tool)) for (const p of patchPaths(typeof input["command"] === "string" ? input["command"] : "")) {
          const path = projectPath(root, p);
          if (path !== void 0) recordFile(root, "codex", sid, path);
        }
        const command = CODEX_TOOLS.run.includes(tool) ? commandOf(input) : void 0;
        if (command !== void 0 && commits(command) && !state.committed) {
          state.committed = true;
          writeState(file, state);
        }
        if ((CODEX_TOOLS.write.includes(tool) || CODEX_TOOLS.run.includes(tool)) && state.acted !== true) {
          state.acted = true;
          writeState(file, state);
        }
      });
      const res = await ask({ op: "status" });
      if (!res.ok || res.shell.policy === null) return NOTHING;
      const exitCode = CODEX_TOOLS.run.includes(tool) ? exitCodeIn(ev.tool_response) : void 0;
      const wrotePath = CODEX_TOOLS.write.includes(tool) ? projectPath(root, patchPaths(typeof input["command"] === "string" ? input["command"] : "")[0]) : void 0;
      const isError = typeof exitCode === "number" && exitCode !== 0;
      if (!afterNeeded(res.shell.policy, call, { isError, gitOperation: false, consulted: false, ...exitCode !== void 0 ? { exitCode } : {}, ...wrotePath !== void 0 ? { wrotePath } : {} })) return NOTHING;
      const after = await ask({
        op: "after",
        tool,
        callId: ev.tool_use_id ?? "codex",
        input: call.input,
        isError,
        gitOperation: false,
        cwd: root,
        ...exitCode !== void 0 ? { exitCode } : {},
        ...wrotePath !== void 0 ? { wrotePath } : {},
        ...state.delivered !== null ? { delivered: state.delivered } : {}
      });
      if (!after.ok || after.context === void 0) return NOTHING;
      if (after.shell.contextKey !== null) {
        state.delivered = after.shell.contextKey;
        writeState(file, state);
      }
      return out(contextFor("PostToolUse", after.handoff !== void 0 ? `${after.handoff}
${after.context}` : after.context));
    }
    // The turn's end. One that changed things and reported no work item goes back once to report it (the record
    // unread counts as reported: the reminder never comes from Gemworks' own failure). Else its answer and the commits
    // a command in it made go into the record, and the board is written again; nothing is said back.
    case "Stop": {
      if (state.acted === true && ev.stop_hook_active !== true) {
        state.acted = false;
        let reported = true;
        record(() => {
          writeState(file, state);
          const events = appendSession(root, "codex", sid, () => []);
          const turn = currentTurn(events);
          reported = events.some((e) => e.t === "item" && e.turn === turn) || coachFlowsAt(root).length === 0;
        });
        if (!reported) return { stdout: `${JSON.stringify({ decision: "block", reason: WORK_REMINDER })}
`, code: 0 };
      }
      record(() => {
        writeBoard(root);
      });
      record(() => {
        recordAnswer(root, "codex", sid, ev.last_assistant_message ?? "", state.committed);
        if (state.committed) {
          state.committed = false;
          writeState(file, state);
        }
      });
      return NOTHING;
    }
    default:
      return NOTHING;
  }
}

// src/antigravity.ts
import { mkdirSync as mkdirSync4, readFileSync as readFileSync4, writeFileSync as writeFileSync4 } from "node:fs";
import { homedir } from "node:os";
import { join as join5, resolve as resolve2 } from "node:path";
var ANTIGRAVITY_HOST = "antigravity";
function stateDir(home = homedir()) {
  return join5(home, ".gemworks", "antigravity");
}
function readJson(file, fallback) {
  try {
    return { ...fallback, ...JSON.parse(readFileSync4(file, "utf8")) };
  } catch {
    return fallback;
  }
}
function writeJson(file, value) {
  mkdirSync4(resolve2(file, ".."), { recursive: true });
  writeFileSync4(file, JSON.stringify(value), "utf8");
}
function activeOf(home = homedir()) {
  const a = readJson(join5(stateDir(home), "active.json"), {});
  return typeof a.conversationId === "string" && typeof a.root === "string" ? { conversationId: a.conversationId, root: a.root, at: a.at ?? "" } : void 0;
}
function stepsOf(path) {
  if (path === void 0) return [];
  let text2;
  try {
    text2 = readFileSync4(path, "utf8");
  } catch {
    return [];
  }
  const out2 = [];
  for (const line of text2.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    try {
      out2.push(JSON.parse(line));
    } catch {
    }
  }
  return out2;
}
function requestOf(content) {
  const m = /<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/.exec(content);
  return (m?.[1] ?? content).trim();
}
function promptsAfter(steps, after) {
  return steps.filter((s) => s.type === "USER_INPUT" && (s.source === void 0 || s.source === "USER_EXPLICIT") && typeof s.step_index === "number" && s.step_index > after && typeof s.content === "string").map((s) => ({ step: s.step_index, text: requestOf(s.content) })).filter((p) => p.text !== "");
}
function answerOf(steps) {
  let lastInput = -1;
  steps.forEach((s, i) => {
    if (s.type === "USER_INPUT") lastInput = i;
  });
  for (let i = steps.length - 1; i > lastInput; i--) {
    const s = steps[i];
    if (s.type === "PLANNER_RESPONSE" && typeof s.content === "string" && s.content.trim() !== "") return s.content;
  }
  return "";
}
var WRITES = { write_to_file: "TargetFile", replace_file_content: "TargetFile", multi_replace_file_content: "TargetFile" };
function projectPath2(root, path) {
  const p = normalised(path);
  const base = normalised(root)?.replace(/\/+$/, "");
  if (p === void 0 || base === void 0) return void 0;
  const lower = (s) => process.platform === "win32" ? s.toLowerCase() : s;
  return lower(p).startsWith(`${lower(base)}/`) ? p.slice(base.length + 1) : void 0;
}
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function runAntigravity(event, text2, home = homedir(), now = (/* @__PURE__ */ new Date()).toISOString()) {
  let ev;
  try {
    const v = JSON.parse(text2);
    if (!isRecord(v)) return { stdout: "" };
    ev = v;
  } catch {
    return { stdout: "" };
  }
  const cid = typeof ev["conversationId"] === "string" ? ev["conversationId"] : void 0;
  const paths = Array.isArray(ev["workspacePaths"]) ? ev["workspacePaths"].filter((p) => typeof p === "string") : [];
  if (cid === void 0 || paths[0] === void 0) return { stdout: "" };
  const root = resolve2(paths[0]);
  const transcript = typeof ev["transcriptPath"] === "string" ? ev["transcriptPath"] : void 0;
  const file = join5(stateDir(home), `${cid.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
  const state = readJson(file, { lastPromptStep: -1, decisionsSeen: null, committed: false });
  const save = () => writeJson(file, state);
  const out2 = (o) => ({ stdout: `${JSON.stringify(o)}
` });
  writeJson(join5(stateDir(home), "active.json"), { conversationId: cid, root, at: now });
  switch (event) {
    case "SessionStart": {
      appendSession(root, ANTIGRAVITY_HOST, cid, () => [], now);
      let loop = [];
      try {
        loop = loopPrompt(coachFlowsAt(root));
      } catch {
      }
      try {
        if (boardHasWork(root)) openBoardOnce(root, cid);
      } catch {
      }
      const told = [SESSIONS_PROMPT.replace("gemworks `note` tool", "`note` tool of the gemworks MCP server"), ...loop].join("\n\n");
      return out2({ injectSteps: [{ systemMessage: { systemMessage: told } }] });
    }
    case "PreInvocation": {
      const asked = promptsAfter(stepsOf(transcript), state.lastPromptStep);
      if (asked.length === 0) return { stdout: "" };
      for (const p of asked) recordPrompt(root, ANTIGRAVITY_HOST, cid, p.text, now);
      state.lastPromptStep = asked[asked.length - 1].step;
      const fresh = decisionsFor(root, cid, state.decisionsSeen, now);
      state.decisionsSeen = now;
      save();
      try {
        writeBoard(root);
      } catch {
      }
      let loop = [];
      try {
        loop = loopContext(root, cid);
      } catch {
      }
      const said = [...fresh.length > 0 ? [decisionsContext(fresh, (d) => `${hostLabel(d.host)}${d.branch !== void 0 ? ` \xB7 ${d.branch}` : ""}\uFF0C${new Date(d.at).toTimeString().slice(0, 5)}`)] : [], ...loop];
      if (said.length === 0) return { stdout: "" };
      return out2({ injectSteps: [{ ephemeralMessage: said.join("\n\n") }] });
    }
    case "PostToolUse": {
      const call = isRecord(ev["toolCall"]) ? ev["toolCall"] : {};
      const name = typeof call["name"] === "string" ? call["name"] : "";
      const args = isRecord(call["args"]) ? call["args"] : {};
      const failed = typeof ev["error"] === "string" && ev["error"] !== "";
      const target2 = WRITES[name] !== void 0 && typeof args[WRITES[name]] === "string" ? projectPath2(root, args[WRITES[name]]) : void 0;
      if (target2 !== void 0 && !failed) recordFile(root, ANTIGRAVITY_HOST, cid, target2, now);
      if (name === "run_command" && typeof args["CommandLine"] === "string" && commits(args["CommandLine"]) && !state.committed) {
        state.committed = true;
        save();
      }
      return out2({});
    }
    case "Stop": {
      if (ev["fullyIdle"] === false) return { stdout: "" };
      recordAnswer(root, ANTIGRAVITY_HOST, cid, answerOf(stepsOf(transcript)), state.committed, now);
      if (state.committed) {
        state.committed = false;
        save();
      }
      try {
        writeBoard(root);
      } catch {
      }
      return { stdout: "" };
    }
    default:
      return { stdout: "" };
  }
}
function hooksFor(command) {
  const run2 = (event) => ({ type: "command", command: `${command} antigravity ${event}`, timeout: 20 });
  return {
    SessionStart: [run2("SessionStart")],
    PreInvocation: [run2("PreInvocation")],
    PostToolUse: [{ matcher: ".*", hooks: [run2("PostToolUse")] }],
    Stop: [run2("Stop")]
  };
}
function installAntigravity(bundle, home = homedir()) {
  const dir = join5(home, ".gemini", "config");
  const hooksFile = join5(dir, "hooks.json");
  const mcpFile = join5(dir, "mcp_config.json");
  const hooks = readJson(hooksFile, {});
  delete hooks["gemworks-probe"];
  const path = bundle.split("\\").join("/");
  hooks["gemworks"] = hooksFor(`node ${/\s/.test(path) ? `"${path}"` : path}`);
  mkdirSync4(dir, { recursive: true });
  writeFileSync4(hooksFile, `${JSON.stringify(hooks, null, 2)}
`, "utf8");
  const mcp = readJson(mcpFile, {});
  mcp.mcpServers = { ...mcp.mcpServers ?? {}, gemworks: { command: "node", args: [bundle, "mcp", "--host", ANTIGRAVITY_HOST] } };
  writeFileSync4(mcpFile, `${JSON.stringify(mcp, null, 2)}
`, "utf8");
  return [hooksFile, mcpFile];
}

// src/mcp.ts
import { existsSync as existsSync2, readFileSync as readFileSync5 } from "node:fs";
import { isAbsolute as isAbsolute3, join as join6 } from "node:path";
import { createInterface } from "node:readline";
function packageVersion() {
  try {
    return JSON.parse(readFileSync5(new URL("../package.json", import.meta.url), "utf8")).version;
  } catch {
    return "unknown";
  }
}
var PROTOCOLS = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"];
var HOOKED = /* @__PURE__ */ new Set(["codex", ANTIGRAVITY_HOST]);
var result = (id, value) => ({ jsonrpc: "2.0", id, result: value });
var failure = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
var text = (id, body, isError) => result(id, { content: [{ type: "text", text: body }], ...isError ? { isError: true } : {} });
var NO_ENFORCEMENT_NOTE = "(this host shows Gemworks no tool calls: nothing is refused here, and a variable whose source is a tool is never written \u2014 tell the person what you ran, so they can tick a variable the guard accepts)";
var withNote = (stage) => `${stage}

${NO_ENFORCEMENT_NOTE}`;
function codexTurnOf(params) {
  const meta = params?.["_meta"];
  const turn = meta?.["x-codex-turn-metadata"];
  if (turn === null || typeof turn !== "object" || Array.isArray(turn)) return {};
  const t = turn;
  const spaces = t["workspaces"] !== null && typeof t["workspaces"] === "object" && !Array.isArray(t["workspaces"]) ? Object.keys(t["workspaces"]).filter(isAbsolute3) : [];
  const root = spaces.find((p) => existsSync2(join6(p, ".geml"))) ?? spaces[0];
  const session = typeof t["session_id"] === "string" && t["session_id"] !== "" ? t["session_id"] : void 0;
  return { ...root !== void 0 ? { root } : {}, ...session !== void 0 ? { session } : {} };
}
async function answer(msg, o) {
  const m = msg;
  const id = m?.id ?? null;
  const method = m?.method;
  if (typeof method !== "string") return failure(id, -32600, "invalid request: `method` is required");
  if (method.startsWith("notifications/")) return void 0;
  if (method === "initialize") {
    const asked = m?.params?.["protocolVersion"];
    const version = typeof asked === "string" && PROTOCOLS.includes(asked) ? asked : PROTOCOLS[PROTOCOLS.length - 1];
    let instructions = SESSIONS_PROMPT;
    try {
      instructions = [SESSIONS_PROMPT, ...loopPrompt(coachFlowsAt(o.root))].join("\n\n");
    } catch {
    }
    if (!HOOKED.has(o.host) && boardHasWork(o.root)) openBoardOnce(o.root, latestSessionOf(o.root, o.host) ?? `mcp-${process.pid}`);
    return result(id, { protocolVersion: version, capabilities: { tools: {} }, serverInfo: { name: "gemworks", version: packageVersion() }, instructions });
  }
  if (method === "ping") return result(id, {});
  if (method === "tools/list") return result(id, { tools: [...FLOW_TOOLS.map(({ name: name2, description, inputSchema }) => ({ name: name2, description, inputSchema })), { name: NOTE_TOOL.name, description: NOTE_TOOL.description, inputSchema: NOTE_TOOL.inputSchema }, ...LOOP_TOOLS.map(({ name: name2, description, inputSchema }) => ({ name: name2, description, inputSchema }))] });
  if (method !== "tools/call") return failure(id, -32601, `method not found: ${method}`);
  const name = m?.params?.["name"];
  const active = o.host === ANTIGRAVITY_HOST ? activeOf() : void 0;
  const codex = codexTurnOf(m?.params);
  const root = active?.root ?? codex.root ?? o.root;
  const sessionOf = () => active?.conversationId ?? codex.session ?? latestSessionOf(root, o.host) ?? `mcp-${process.pid}`;
  const state = o.state ?? { decisionsSeen: null };
  const withNews = (body, isError) => {
    if (HOOKED.has(o.host)) return text(id, body, isError);
    let news = "";
    try {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const fresh = decisionsFor(root, sessionOf(), state.decisionsSeen, now);
      state.decisionsSeen = now;
      if (fresh.length > 0) news = decisionsContext(fresh, (d) => `${hostLabel(d.host)}${d.branch !== void 0 ? ` \xB7 ${d.branch}` : ""}\uFF0C${new Date(d.at).toTimeString().slice(0, 5)}`);
    } catch {
    }
    return text(id, news !== "" ? `${body}

${news}` : body, isError);
  };
  const loopLines = () => {
    try {
      return loopContext(root, sessionOf()).join("\n");
    } catch {
      return "";
    }
  };
  if (name === NOTE_TOOL.name) {
    const given = m?.params?.["arguments"]?.decisions;
    const decisions = Array.isArray(given) ? given.filter((d) => typeof d === "string") : [];
    try {
      const n = recordDecisions(root, o.host, sessionOf(), decisions);
      if (n > 0) openBoardOnce(root, sessionOf());
      return withNews(n === 0 ? "Nothing recorded: decisions is a list of short sentences." : `Recorded ${n} decision${n === 1 ? "" : "s"}; the project's other sessions will see ${n === 1 ? "it" : "them"}.`, n === 0);
    } catch (e) {
      return text(id, `gemworks: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  }
  if (typeof name === "string" && isLoopTool(name)) {
    const given = m?.params?.["arguments"];
    const args2 = given !== null && typeof given === "object" && !Array.isArray(given) ? given : {};
    const r = await callLoopTool(root, o.host, sessionOf(), name, args2);
    if (r?.ok === true) openBoardOnce(root, sessionOf());
    return r === void 0 ? failure(id, -32602, `unknown tool: ${name}`) : withNews(r.text, !r.ok);
  }
  const spec = FLOW_TOOLS.find((t) => t.name === name);
  if (spec === void 0) return failure(id, -32602, `unknown tool: ${String(name)}`);
  const raw = m?.params?.["arguments"];
  const args = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  try {
    const opened = openWorkspace({ root, tools: Object.hasOwn(HOST_TOOLS, o.host) ? HOST_TOOLS[o.host] : NO_TOOLS, gh: ghOncePerBranch() });
    if (!opened.ok) {
      const loop = spec.name === "status" ? loopLines() : "";
      return loop !== "" ? withNews(`gemworks: ${opened.reason}

${loop}`, false) : text(id, `gemworks: ${opened.reason}`, true);
    }
    if (spec.name === "status") opened.ws.refresh({ reread: false });
    const a = runVerb(opened.ws, spec.name, args);
    if (spec.name === "status") {
      const loop = loopLines();
      return withNews(withNote(loop !== "" ? `${a.text}

${loop}` : a.text), !a.ok);
    }
    return withNews(a.context !== void 0 ? `${a.text}

${withNote(a.context)}` : a.text, !a.ok);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return text(id, message.startsWith("gemworks:") ? message : `gemworks: ${message}`, true);
  }
}
function serveMcp(o) {
  const rl = createInterface({ input: process.stdin });
  const served = { ...o, state: o.state ?? { decisionsSeen: null } };
  let chain2 = Promise.resolve();
  rl.on("line", (line) => {
    chain2 = chain2.then(async () => {
      const t = line.trim();
      if (t === "") return;
      let msg;
      try {
        msg = JSON.parse(t);
      } catch {
        process.stdout.write(`${JSON.stringify(failure(null, -32700, "parse error"))}
`);
        return;
      }
      const reply = await answer(msg, served);
      if (reply !== void 0) process.stdout.write(`${JSON.stringify(reply)}
`);
    });
  });
  return new Promise((resolveDone) => {
    rl.on("close", () => {
      void chain2.then(() => resolveDone());
    });
  });
}

// src/hosts/claude-code/band.ts
var WIDE = [
  [4352, 4447],
  [11904, 12350],
  [12353, 13311],
  [13312, 19903],
  [19968, 40959],
  [40960, 42191],
  [44032, 55203],
  [63744, 64255],
  [65072, 65103],
  [65280, 65376],
  [65504, 65510],
  [127744, 128591],
  [129280, 129535],
  [131072, 262141]
];
function cellWidth(text2) {
  let width = 0;
  for (const ch of text2) {
    const c = ch.codePointAt(0);
    if (c === 8205 || c >= 768 && c <= 879 || c >= 65024 && c <= 65039) continue;
    width += WIDE.some(([a, b]) => c >= a && c <= b) ? 2 : 1;
  }
  return width;
}

// src/cli.ts
var USAGE = [
  "usage: gemworks <check|snapshot|verify|export|init|use|migrate|status|mark|unmark|advance|pause|resume|rollback|run|hook|mcp> ...",
  "  check <workflow.geml>                   static checks of the workflow and its tool dictionary (exit 1 on errors)",
  "  snapshot <journal.geml> [--json]        the last revision",
  "  verify <journal.geml> [--workflow f]    hash chain and consistency",
  "  export <journal.geml> --to md           revision table with per-step diffs",
  "  init [dir] [--template coding|dev|matter|video] [--no-activate]  write a bundled workflow into .geml/workflows/",
  "  use <workflow>                          make a workflow the default for new work items",
  "  migrate                                 move the earlier layout (a workflow directory in the checkout) into the project's home",
  "  status [--json]                         the work item, the stage, its variables and next steps",
  "  mark <variable> | unmark <variable>     a person ticks or clears a variable whose source is a person",
  "  advance <state>                         a person moves the workflow",
  "  pause | resume                          a person holds the work item (evidence is recorded, nothing moves) or lets it go",
  "  rollback [<rev>|checkpoint]             a person restores an earlier revision's state and variables",
  "  run [--profile name] <task>             add the bundle to a dsh profile and run the task there",
  "  hook                                    the Claude Code bridge: one JSON request on stdin, one answer on stdout",
  "  codex                                   the Codex hook: one event on stdin, its answer on stdout (exit 0 always)",
  "  antigravity <Event> | install           the Antigravity editor's hook (one event on stdin), or put its hooks and MCP server in place",
  "  mcp [--host h] [--root dir]             the three model tools over stdio MCP (host default: mcp)",
  "  corrections [--baseline a..b] [--trial a..b] [--since day] [--by work] [--json]",
  "                                          how often you corrected the agent, per 100 prompts, by kind and by week",
  "  corrections guide | pending [--limit n] | label [file] [--import]",
  "                                          the labelling guide; your prompts not labelled yet (JSONL); labels written back"
].join("\n");
function flag(args, name) {
  const i = args.indexOf(name);
  if (i < 0) return void 0;
  const value = args[i + 1];
  if (value === void 0 || value.startsWith("--")) fail(`${name} needs a value`, 2);
  return value;
}
var has = (args, name) => args.includes(name);
function printDiagnostics(ds) {
  for (const d of ds) console.error(`${d.severity}: ${d.code}: ${d.message} (line ${d.line})`);
  const errs = ds.filter((d) => d.severity === "error").length;
  const warns = ds.filter((d) => d.severity === "warning").length;
  const infos = ds.length - errs - warns;
  if (errs || warns) console.error(`${errs} error(s), ${warns} warning(s)${infos ? `, ${infos} info` : ""}`);
  else console.error(infos ? `ok: no errors or warnings (${infos} info)` : "ok: no diagnostics");
}
function fail(msg, code) {
  console.error(msg);
  process.exit(code);
}
function readOrFail(path) {
  try {
    return readText(path);
  } catch (e) {
    const err = e;
    return fail(`gemworks: cannot read ${path}${err.code ? ` (${err.code})` : ""}`, 1);
  }
}
function positionals(verb, args, flags, valued) {
  const out2 = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (valued.includes(a)) {
      i++;
      continue;
    }
    if (flags.includes(a)) continue;
    if (a.startsWith("--")) fail(`gemworks ${verb}: unknown option ${a}`, 2);
    out2.push(a);
  }
  return out2;
}
var slashed = (p) => p.split(sep).join("/");
var shown = (p) => slashed(relative(process.cwd(), p) || ".");
function projectOf(flowPath) {
  const workflowDir = dirname4(flowPath);
  if (basename2(flowPath).toLowerCase() !== FLOW_FILE && basename2(workflowDir) === "workflows" && basename2(dirname4(workflowDir)) === GEML_DIR) {
    const home = dirname4(dirname4(workflowDir));
    return realPath(homeOf(process.cwd())) === realPath(home) ? process.cwd() : home;
  }
  const above = resolve3(workflowDir, "..", "..", "..");
  return resolve3(above, WORKFLOWS_DIR, basename2(workflowDir)) === workflowDir ? above : process.cwd();
}
function promptResolver(flowPath, root) {
  return (ref) => {
    const found = resolvePromptRef(ref, flowPath, root);
    if (found.kind === "outside") throw new Error("the path lies outside the project");
    return found.kind === "found";
  };
}
function withWorkspace(fn) {
  try {
    const opened = openWorkspace({ root: process.cwd(), tools: NO_TOOLS });
    if (!opened.ok) return fail(`gemworks: ${opened.reason}`, 1);
    return fn(opened.ws);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return fail(message.startsWith("gemworks:") ? message : `gemworks: ${message}`, 1);
  }
}
var chain = (states) => states.map((s) => `#${s}`).join(" \u2192 ");
async function runHook() {
  process.stdin.setEncoding("utf8");
  let text2 = "";
  for await (const chunk of process.stdin) text2 += chunk;
  const req = decodeRequest(text2);
  const res = "error" in req ? { v: 1, ok: false, error: req.error } : await handleRequest(req);
  process.stdout.write(`${JSON.stringify(res)}
`);
  return 0;
}
async function runCodexHook() {
  process.stdin.setEncoding("utf8");
  let text2 = "";
  for await (const chunk of process.stdin) text2 += chunk;
  try {
    const r = await runCodex(text2, process.env);
    process.stdout.write(r.stdout);
    return r.code;
  } catch (e) {
    process.stderr.write(`gemworks codex: ${e instanceof Error ? e.message : String(e)}
`);
    return 0;
  }
}
async function runAntigravityHook(event) {
  if (event === "install") {
    for (const f of installAntigravity(resolve3(process.argv[1] ?? "gemworks.mjs"))) process.stdout.write(`${f}
`);
    return 0;
  }
  process.stdin.setEncoding("utf8");
  let text2 = "";
  for await (const chunk of process.stdin) text2 += chunk;
  try {
    process.stdout.write(runAntigravity(event ?? "", text2).stdout);
  } catch (e) {
    process.stderr.write(`gemworks antigravity: ${e instanceof Error ? e.message : String(e)}
`);
  }
  return 0;
}
function corrections(args) {
  const [sub, ...rest] = args;
  const transcripts = process.env["CLAUDE_CONFIG_DIR"] !== void 0 ? join7(process.env["CLAUDE_CONFIG_DIR"], "projects") : join7(homedir2(), ".claude", "projects");
  if (sub === "guide") {
    console.log(LABEL_GUIDE);
    console.log('\nFor each line of `gemworks corrections pending`, keep its fields and add "kind", "sub" (null unless kind is correct) and "work"; give the lines to `gemworks corrections label`.');
    return 0;
  }
  if (sub === "pending") {
    if (positionals("corrections pending", rest, [], ["--limit", "--since"]).length > 0) fail(USAGE, 2);
    const limit = Number(flag(rest, "--limit") ?? "200");
    if (!Number.isInteger(limit) || limit <= 0) fail("--limit needs a whole number", 2);
    const since2 = flag(rest, "--since");
    const ledger2 = readLedger();
    const window = { limit, ...since2 !== void 0 ? { since: since2 } : {} };
    const all2 = [...unlabelledPrompts(ledger2, transcripts, window), ...recordedUnlabelled(ledger2, readSessions(process.cwd()), window)].sort((a, b) => a.at < b.at ? -1 : 1).slice(0, limit);
    for (const p of all2) console.log(JSON.stringify(p));
    return 0;
  }
  if (sub === "label") {
    const files = positionals("corrections label", rest, ["--import"], []);
    if (files.length > 1) fail(USAGE, 2);
    const text2 = files[0] !== void 0 ? readOrFail(files[0]) : readFileSync6(0, "utf8");
    const lines = text2.split(/\r?\n/).filter((l) => l.trim() !== "");
    const parsed = [];
    for (const [n, l] of lines.entries()) {
      try {
        parsed.push(JSON.parse(l));
      } catch {
        fail(`line ${n + 1} is not JSON`, 1);
      }
    }
    const r2 = labelledRows(parsed, has(rest, "--import") ? "import" : "agent");
    for (const e of r2.errors) console.error(e);
    const added = addLabelled(r2.rows);
    console.log(`${added} labelled, ${r2.rows.length - added} already in the ledger${r2.errors.length > 0 ? `, ${r2.errors.length} not taken` : ""}`);
    return r2.errors.length > 0 ? 1 : 0;
  }
  const all = sub === void 0 || sub.startsWith("--") ? args : fail(USAGE, 2);
  if (positionals("corrections", all, ["--json"], ["--baseline", "--trial", "--since", "--by"]).length > 0) fail(USAGE, 2);
  const by = flag(all, "--by");
  if (by !== void 0 && by !== "work") fail("--by takes work", 2);
  const offset = -(/* @__PURE__ */ new Date()).getTimezoneOffset();
  const periods = defaultPeriods(localDay((/* @__PURE__ */ new Date()).toISOString(), offset));
  const period = (name) => {
    const s = flag(all, name);
    if (s === void 0) return void 0;
    return parsePeriod(s) ?? fail(`${name} takes two dates, first..last: 2026-08-30..2026-10-25`, 2);
  };
  const since = flag(all, "--since");
  const ledger = readLedger();
  const r = report(ledger, { baseline: period("--baseline") ?? periods.baseline, trial: period("--trial") ?? periods.trial, offset, byWork: by === "work", ...since !== void 0 ? { since } : {} });
  const waiting = unlabelledPrompts(ledger, transcripts).length;
  if (has(all, "--json")) console.log(JSON.stringify({ ...r, unlabelled: waiting }, null, 2));
  else if (r.all.prompts === 0) console.log(`no labelled prompts yet${waiting > 0 ? ` \xB7 ${waiting} waiting: gemworks corrections pending` : ""}`);
  else console.log(reportText(r, cellWidth, waiting));
  return 0;
}
function main(argv2) {
  const [verb, ...rest] = argv2;
  if (!verb) fail(USAGE, 2);
  switch (verb) {
    case "check": {
      const pos = positionals("check", rest, [], []);
      const file = pos[0];
      if (file === void 0 || pos.length !== 1) fail(USAGE, 2);
      const path = resolve3(file);
      const root = projectOf(path);
      const r = loadStatechart(readOrFail(path), file, { resolveRef: promptResolver(path, root), readDoc: docReader(dirname4(path), root) });
      const ds = [...r.diagnostics];
      const dict = dictionaryPathOf(path);
      if (r.statechart !== void 0 && exists(dict)) {
        const own = dict === join7(dirname4(path), TOOLS_FILE);
        const others = own ? [] : installedWorkflows(root).filter((w) => realPath(w.path) !== realPath(path)).flatMap((w) => {
          try {
            return [loadStatechart(readText(w.path), w.path).statechart].filter((c) => c !== void 0);
          } catch {
            return [];
          }
        });
        for (const d of readDictionary(readOrFail(dict), [r.statechart, ...others]).diagnostics) ds.push({ ...d, message: `${TOOLS_FILE}: ${d.message}` });
      }
      printDiagnostics(ds);
      return hasErrors(ds) ? 1 : 0;
    }
    case "snapshot": {
      const file = rest[0];
      if (!file || file.startsWith("--")) fail(USAGE, 2);
      const journal = readJournal(readOrFail(resolve3(file)));
      const last = journal.snapshots[journal.snapshots.length - 1];
      if (!last) fail(`${file}: no revision`, 1);
      if (has(rest, "--json")) {
        console.log(JSON.stringify(last));
        return 0;
      }
      const from = last.from !== void 0 ? ` \xB7 from #${last.from}` : "";
      const restores = last.restores !== void 0 ? ` \xB7 restores ${last.restores}` : "";
      console.log(`rev ${last.rev} \xB7 state #${last.state} \xB7 cause ${last.cause}${from}${restores}
vars: ${canonical(last.vars)}
hash: ${last.hash}
at: ${last.at}`);
      return 0;
    }
    case "verify": {
      const file = rest[0];
      if (!file || file.startsWith("--")) fail(USAGE, 2);
      const scPath = flag(rest, "--workflow");
      let sc;
      if (scPath) {
        const path = resolve3(scPath);
        const r = loadStatechart(readOrFail(path), scPath, { readDoc: docReader(dirname4(path), projectOf(path)) });
        if (!r.statechart) {
          printDiagnostics(r.diagnostics);
          return 1;
        }
        sc = r.statechart;
      }
      const errors = verifyJournal(readJournal(readOrFail(resolve3(file))), sc);
      for (const e of errors) console.error(e);
      console.error(errors.length ? `${errors.length} error(s)` : "ok: chain verified");
      return errors.length ? 1 : 0;
    }
    case "export": {
      const file = rest[0];
      if (!file || file.startsWith("--")) fail(USAGE, 2);
      if (flag(rest, "--to") !== "md") fail("export: only --to md is supported", 2);
      console.log(renderJournalMarkdown(readJournal(readOrFail(resolve3(file)))));
      return 0;
    }
    case "init": {
      const template = flag(rest, "--template") ?? "coding";
      const pos = positionals("init", rest, ["--no-activate"], ["--template"]);
      if (pos.length > 1) fail(USAGE, 2);
      let r;
      try {
        r = addWorkflow(resolve3(pos[0] ?? "."), template, { activate: !has(rest, "--no-activate") });
      } catch (e) {
        return fail(String(e), 1);
      }
      if (!r.ok) return fail(r.code === 1 ? `${shown(r.target)} already exists; not overwriting` : r.reason, r.code);
      console.log(`wrote ${shown(r.target)}${r.activated ? " (active)" : ""}`);
      return 0;
    }
    case "use": {
      const pos = positionals("use", rest, [], []);
      if (pos.length !== 1) fail(USAGE, 2);
      const name = pos[0];
      const r = useWorkflow(process.cwd(), name);
      if (!r.ok) return fail(`gemworks: ${r.reason}`, 1);
      console.log(`default workflow: ${name} (a work item with a journal keeps its own)`);
      return 0;
    }
    case "status": {
      if (positionals("status", rest, ["--json"], []).length > 0) fail(USAGE, 2);
      return withWorkspace((ws) => {
        const s = ws.status();
        if (has(rest, "--json")) {
          console.log(JSON.stringify(s));
          return 0;
        }
        if (s.item.kind !== "item") {
          console.log(s.item.reason);
          return 0;
        }
        const under = s.workflow.default !== void 0 ? ` \xB7 workflow ${s.workflow.name} (default ${s.workflow.default})` : "";
        console.log(`${s.item.id} \xB7 ${s.state ? `#${s.state.id}` : "(no stage)"}${under}${s.paused ? " \xB7 paused" : ""}`);
        for (const [name, value] of Object.entries(s.vars)) {
          const source = s.sources[name];
          console.log(`  ${name} = ${JSON.stringify(value)}${source !== void 0 ? `  (${source})` : ""}`);
        }
        for (const n of s.next) {
          const how = n.approval ? "a person approves" : n.judge === "machine" ? "on its own" : "by move";
          const guard = n.guard !== void 0 ? `  when ${n.guard}${n.judge === "machine" ? n.holds ? " (holds)" : ` (missing ${n.missing.join(", ")})` : ""}` : "";
          console.log(`  \u2192 #${n.to}  ${how}${guard}`);
        }
        if (s.gh !== void 0 && !s.gh.available) console.log(`  git evidence unavailable: ${s.gh.reason}`);
        return 0;
      });
    }
    case "mark":
    case "unmark": {
      const pos = positionals(verb, rest, [], []);
      if (pos.length !== 1) fail(USAGE, 2);
      const name = pos[0];
      return withWorkspace((ws) => {
        const r = ws.mark(name, verb === "mark");
        if (!r.ok) return fail(`gemworks: ${r.reason}`, 1);
        console.log(`${verb}ed ${name}${r.entered.length ? ` \xB7 entered ${chain(r.entered)}` : ""}`);
        return 0;
      });
    }
    case "advance": {
      const pos = positionals("advance", rest, [], []);
      if (pos.length !== 1) fail(USAGE, 2);
      const to = pos[0];
      return withWorkspace((ws) => {
        const r = ws.advance(to);
        if (!r.ok) return fail(`gemworks: ${r.reason}`, 1);
        console.log(`entered ${chain(r.entered)}`);
        return 0;
      });
    }
    case "pause":
    case "resume": {
      if (positionals(verb, rest, [], []).length !== 0) fail(USAGE, 2);
      return withWorkspace((ws) => {
        if (verb === "pause") {
          const r2 = ws.pause();
          if (!r2.ok) return fail(`gemworks: ${r2.reason}`, 1);
          console.log("paused");
          return 0;
        }
        const r = ws.resume();
        if (!r.ok) return fail(`gemworks: ${r.reason}`, 1);
        console.log(`resumed${r.entered.length ? ` \xB7 entered ${chain(r.entered)}` : ""}`);
        return 0;
      });
    }
    case "rollback": {
      const pos = positionals("rollback", rest, [], []);
      if (pos.length > 1) fail(USAGE, 2);
      const arg = pos[0] ?? "checkpoint";
      const target2 = arg === "checkpoint" ? "checkpoint" : Number(arg);
      if (target2 !== "checkpoint" && (!Number.isInteger(target2) || target2 < 0)) fail("gemworks rollback: expected a revision number or checkpoint", 2);
      return withWorkspace((ws) => {
        const r = ws.rollback(target2);
        if (!r.ok) return fail(`gemworks: ${r.reason}`, 1);
        console.log(`rev ${r.rev} restores rev ${r.restores} \xB7 state #${r.state}${r.entered.length ? ` \xB7 entered ${chain(r.entered)}` : ""}`);
        return 0;
      });
    }
    case "migrate": {
      if (positionals("migrate", rest, [], []).length > 0) fail(USAGE, 2);
      const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "");
      const moved = migrateLayout(process.cwd(), join7(homedir2(), ".gemworks", "trash", `${stamp}-layout`));
      if (moved.length === 0) {
        console.log("nothing to move: no workflow directory or .geml/gemflow.geml here");
        return 0;
      }
      for (const m of moved) console.log(`${shown(m.from)} \u2192 ${shown(m.to)}${m.kept ? " (git tracks it: left where it is; remove it with git rm)" : ` (moved to ${m.trashed})`}`);
      return 0;
    }
    case "corrections":
      return corrections(rest);
    case "run": {
      const profile = has(rest, "--profile") ? flag(rest, "--profile") : "headless";
      const skip = /* @__PURE__ */ new Set();
      const at = rest.indexOf("--profile");
      if (at >= 0) {
        skip.add(at);
        skip.add(at + 1);
      }
      const task = rest.filter((_, i) => !skip.has(i)).join(" ").trim();
      if (task.length === 0) fail(USAGE, 2);
      let workflow;
      try {
        workflow = resolveWorkflow(process.cwd());
      } catch (e) {
        workflow = { error: e instanceof Error ? e.message : String(e), kind: "invalid" };
      }
      if ("error" in workflow) console.error(`gemworks: ${workflow.error} \u2014 the agent will run unsupervised`);
      return run({ profile, task });
    }
    default:
      fail(USAGE, 2);
  }
}
var argv = process.argv.slice(2);
if (argv[0] === "hook") void runHook().then((code) => {
  process.exitCode = code;
});
else if (argv[0] === "codex") void runCodexHook().then((code) => {
  process.exitCode = code;
});
else if (argv[0] === "antigravity") void runAntigravityHook(argv[1]).then((code) => {
  process.exitCode = code;
});
else if (argv[0] === "mcp") {
  const rest = argv.slice(1);
  if (positionals("mcp", rest, [], ["--host", "--root"]).length > 0) fail(USAGE, 2);
  void serveMcp({ root: resolve3(flag(rest, "--root") ?? "."), host: flag(rest, "--host") ?? "mcp" });
} else process.exit(main(argv));
