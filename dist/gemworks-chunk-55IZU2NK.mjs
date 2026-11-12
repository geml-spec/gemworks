#!/usr/bin/env node
import {
  CLAUDE_CODE_TOOLS,
  CODEX_TOOLS,
  HOST_TOOLS,
  LABEL_GUIDE,
  LOOP_TOOLS,
  NOTE_TOOL,
  NO_TOOLS,
  SESSIONS_PROMPT,
  WORK_REMINDER,
  addLabelled,
  addWorkflow,
  appendSession,
  boardHasWork,
  callLoopTool,
  coachFlowsAt,
  commits,
  contextOf,
  currentTurn,
  decisionsContext,
  decisionsFor,
  decodeRequest,
  defaultPeriods,
  handleRequest,
  hostLabel,
  isLoopTool,
  labelledRows,
  latestSessionOf,
  localDay,
  loopContext,
  loopPrompt,
  normalised,
  openBoardOnce,
  parsePeriod,
  readLedger,
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
  writeBoard
} from "./gemworks-chunk-TZW2ETUF.mjs";
import "./gemworks-chunk-VAQRKMSH.mjs";
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
} from "./gemworks-chunk-RYILVWZA.mjs";
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
  readText,
  realPath
} from "./gemworks-chunk-4A7KYSFU.mjs";

// src/cli.ts
import { readFileSync as readFileSync6 } from "node:fs";
import { homedir as homedir9 } from "node:os";
import { basename, dirname as dirname2, join as join12, relative, resolve as resolve9, sep } from "node:path";

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
  const spawn = options.spawn ?? spawnSync;
  const env = options.env ?? process.env;
  const note = options.note ?? ((line) => process.stderr.write(line + "\n"));
  const launcher = launcherFor(env);
  const dsh = [launcher.command, ...launcher.prefix].join(" ");
  const percent = warnAboutPercent(options.task, launcher.shell);
  if (percent) note(`gemworks: ${percent}`);
  const add = spawn(
    launcher.command,
    [...launcher.prefix, "plugin", "--profile", options.profile, "add", "@geml/gemworks"],
    { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", shell: launcher.shell, env }
  );
  if (add.error !== void 0 || add.status !== 0) {
    note(`gemworks: could not add the bundle to profile "${options.profile}" with ${dsh}`);
    if (add.stderr) note(String(add.stderr).trimEnd());
    note(`gemworks: run these two by hand instead:`);
    note(`  ${dsh} plugin --profile ${options.profile} add @geml/gemworks`);
    note(`  ${dsh} --profile ${options.profile} "<your task>"`);
    return 1;
  }
  const ran = spawn(
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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join as join2, resolve } from "node:path";

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
function readEvent(text3) {
  let v;
  try {
    v = JSON.parse(text3);
  } catch {
    return void 0;
  }
  if (!isObject(v) || typeof v["hook_event_name"] !== "string") return void 0;
  const str = (k) => typeof v[k] === "string" ? v[k] : void 0;
  return {
    hook_event_name: v["hook_event_name"],
    ...str("session_id") !== void 0 ? { session_id: str("session_id") } : {},
    ...str("cwd") !== void 0 ? { cwd: str("cwd") } : {},
    ...str("tool_name") !== void 0 ? { tool_name: str("tool_name") } : {},
    ...str("tool_use_id") !== void 0 ? { tool_use_id: str("tool_use_id") } : {},
    ...isObject(v["tool_input"]) ? { tool_input: v["tool_input"] } : {},
    ..."tool_response" in v ? { tool_response: v["tool_response"] } : {},
    ...str("prompt") !== void 0 ? { prompt: str("prompt") } : {},
    ...str("last_assistant_message") !== void 0 ? { last_assistant_message: str("last_assistant_message") } : {},
    ...str("source") !== void 0 ? { source: str("source") } : {},
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
function allowCall(updatedInput, context2) {
  if (updatedInput === void 0 && context2 === void 0) return void 0;
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      ...updatedInput !== void 0 ? { permissionDecision: "allow", updatedInput } : {},
      ...context2 !== void 0 ? { additionalContext: context2 } : {}
    }
  };
}
var contextFor = (event, text3) => ({ hookSpecificOutput: { hookEventName: event, additionalContext: text3 } });

// src/codex.ts
var NOTHING = { stdout: "", code: 0 };
function stateFileFor(env, session) {
  const dir = env["PLUGIN_DATA"] !== void 0 && env["PLUGIN_DATA"] !== "" ? env["PLUGIN_DATA"] : join2(tmpdir(), "gemworks-codex");
  return join2(dir, `${session.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
}
function readState(file) {
  try {
    const v = JSON.parse(readFileSync(file, "utf8"));
    return { delivered: typeof v.delivered === "string" ? v.delivered : null, decisionsSeen: typeof v.decisionsSeen === "string" ? v.decisionsSeen : null, committed: v.committed === true, ...v.acted === true ? { acted: true } : {} };
  } catch {
    return { delivered: null, decisionsSeen: null, committed: false };
  }
}
function writeState(file, state) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(state), "utf8");
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
async function runCodex(text3, env, platform = process.platform) {
  const ev = readEvent(text3);
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
    const doc = join2(root, CONTEXT_DOC);
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
      let context2;
      const decision = beforeDecision(policy, call);
      if (decision.kind === "prefer") context2 = `[gemworks] ${decision.use}'s preferred tool is ${decision.preferred}; this call uses ${decision.key}.`;
      else if (decision.kind === "consult") {
        const before = await ask({ op: "before", tool, callId: ev.tool_use_id ?? "codex", input: call.input, cwd: root, ...decision.waived !== void 0 ? { waived: decision.waived } : {} });
        if (before.ok && before.refusal !== void 0) return out(denyCall(before.refusal));
      }
      let updated;
      const fill = paramsToFill(policy, call);
      if (fill !== void 0) updated = { ...input, ...fill };
      const command = CODEX_TOOLS.run.includes(tool) ? commandOf(input) : void 0;
      if (command !== void 0 && policy.active && platform !== "win32" && !isWrapped(command) && speaksEvidence(policy, command)) updated = { ...updated ?? input, command: wrapCommand(command) };
      return out(allowCall(updated, context2));
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
import { mkdirSync as mkdirSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { homedir } from "node:os";
import { join as join3, resolve as resolve2 } from "node:path";
var ANTIGRAVITY_HOST = "antigravity";
function stateDir(home = homedir()) {
  return join3(home, ".gemworks", "antigravity");
}
function readJson(file, fallback) {
  try {
    return { ...fallback, ...JSON.parse(readFileSync2(file, "utf8")) };
  } catch {
    return fallback;
  }
}
function writeJson(file, value) {
  mkdirSync2(resolve2(file, ".."), { recursive: true });
  writeFileSync2(file, JSON.stringify(value), "utf8");
}
function activeOf(home = homedir()) {
  const a = readJson(join3(stateDir(home), "active.json"), {});
  return typeof a.conversationId === "string" && typeof a.root === "string" ? { conversationId: a.conversationId, root: a.root, at: a.at ?? "" } : void 0;
}
function stepsOf(path) {
  if (path === void 0) return [];
  let text3;
  try {
    text3 = readFileSync2(path, "utf8");
  } catch {
    return [];
  }
  const out2 = [];
  for (const line of text3.split(/\r?\n/)) {
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
function runAntigravity(event, text3, home = homedir(), now = (/* @__PURE__ */ new Date()).toISOString()) {
  let ev;
  try {
    const v = JSON.parse(text3);
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
  const file = join3(stateDir(home), `${cid.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
  const state = readJson(file, { lastPromptStep: -1, decisionsSeen: null, committed: false });
  const save = () => writeJson(file, state);
  const out2 = (o) => ({ stdout: `${JSON.stringify(o)}
` });
  writeJson(join3(stateDir(home), "active.json"), { conversationId: cid, root, at: now });
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
      const target = WRITES[name] !== void 0 && typeof args[WRITES[name]] === "string" ? projectPath2(root, args[WRITES[name]]) : void 0;
      if (target !== void 0 && !failed) recordFile(root, ANTIGRAVITY_HOST, cid, target, now);
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
  const dir = join3(home, ".gemini", "config");
  const hooksFile = join3(dir, "hooks.json");
  const mcpFile = join3(dir, "mcp_config.json");
  const hooks = readJson(hooksFile, {});
  delete hooks["gemworks-probe"];
  const path = bundle.split("\\").join("/");
  hooks["gemworks"] = hooksFor(`node ${/\s/.test(path) ? `"${path}"` : path}`);
  mkdirSync2(dir, { recursive: true });
  writeFileSync2(hooksFile, `${JSON.stringify(hooks, null, 2)}
`, "utf8");
  const mcp = readJson(mcpFile, {});
  mcp.mcpServers = { ...mcp.mcpServers ?? {}, gemworks: { command: "node", args: [bundle, "mcp", "--host", ANTIGRAVITY_HOST] } };
  writeFileSync2(mcpFile, `${JSON.stringify(mcp, null, 2)}
`, "utf8");
  return [hooksFile, mcpFile];
}

// src/cursor.ts
import { existsSync, mkdirSync as mkdirSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { join as join4, resolve as resolve3 } from "node:path";

// src/hosts/cursor/hook.ts
var isObject2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function inputOf(v) {
  if (isObject2(v)) return v;
  if (typeof v !== "string") return void 0;
  try {
    const p = JSON.parse(v);
    return isObject2(p) ? p : void 0;
  } catch {
    return void 0;
  }
}
function readEvent2(text3) {
  let v;
  try {
    v = JSON.parse(text3);
  } catch {
    return void 0;
  }
  if (!isObject2(v) || typeof v["hook_event_name"] !== "string") return void 0;
  const str = (k) => typeof v[k] === "string" ? v[k] : void 0;
  const roots = Array.isArray(v["workspace_roots"]) ? v["workspace_roots"].filter((r) => typeof r === "string") : void 0;
  const input = inputOf(v["tool_input"]);
  const out2 = { hook_event_name: v["hook_event_name"] };
  for (const k of ["conversation_id", "session_id", "tool_name", "tool_use_id", "error_message", "prompt", "file_path", "text", "status", "cwd"]) {
    const s = str(k);
    if (s !== void 0) out2[k] = s;
  }
  if (roots !== void 0) out2.workspace_roots = roots;
  if (input !== void 0) out2.tool_input = input;
  if ("tool_output" in v) out2.tool_output = v["tool_output"];
  if (typeof v["loop_count"] === "number") out2.loop_count = v["loop_count"];
  return out2;
}
var SHELL = "Shell";
var WRITERS = /* @__PURE__ */ new Set(["Write", "Edit", "StrReplace", "MultiEdit", "Delete", "ApplyPatch"]);
var writesFiles = (tool) => WRITERS.has(tool);
var bareTool = (tool) => tool.startsWith("MCP:") ? tool.slice(4) : tool;
function pathOf(input) {
  for (const k of ["file_path", "path", "target_file", "filePath", "target_notebook"]) if (typeof input[k] === "string" && input[k] !== "") return input[k];
  return void 0;
}
function callOf2(tool, input) {
  if (tool === SHELL) return { tool: "Bash", input: { ...input } };
  if (writesFiles(tool)) {
    const path = pathOf(input);
    return { tool: tool === "Write" ? "Write" : "Edit", input: { ...input, ...path !== void 0 ? { file_path: path } : {} } };
  }
  return { tool: bareTool(tool), input: { ...input } };
}
function exitCodeOf(output) {
  let v = output;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
    }
  }
  if (isObject2(v)) {
    for (const k of ["exitCode", "exit_code", "returnCode"]) if (typeof v[k] === "number") return v[k];
  }
  return exitCodeIn(v);
}
var denyCall2 = (reason) => ({ permission: "deny", user_message: `gemworks: ${reason}`, agent_message: `gemworks: ${reason}` });
var rewriteCall = (updated) => updated === void 0 ? {} : { updated_input: updated };

// src/cursor.ts
var CURSOR_HOST = "cursor";
function stateDir2(home = homedir2()) {
  return join4(home, ".gemworks", "cursor");
}
var FRESH = { delivered: null, decisionsSeen: null, pending: [], answer: "", committed: false, acted: false };
function readJson2(file, fallback) {
  try {
    return { ...fallback, ...JSON.parse(readFileSync3(file, "utf8")) };
  } catch {
    return { ...fallback };
  }
}
function writeJson2(file, value) {
  mkdirSync3(resolve3(file, ".."), { recursive: true });
  writeFileSync3(file, JSON.stringify(value), "utf8");
}
function activeOf2(home = homedir2()) {
  const a = readJson2(join4(stateDir2(home), "active.json"), {});
  return typeof a.conversationId === "string" && typeof a.root === "string" ? { conversationId: a.conversationId, root: a.root, at: a.at ?? "" } : void 0;
}
function projectOf(roots, env, cwd) {
  const withGeml = roots.find((r) => existsSync(join4(r, ".geml")));
  const pick = withGeml ?? roots[0] ?? (env["CURSOR_PROJECT_DIR"] !== void 0 && env["CURSOR_PROJECT_DIR"] !== "" ? env["CURSOR_PROJECT_DIR"] : void 0) ?? cwd;
  return pick === void 0 ? void 0 : resolve3(pick);
}
function speaksEvidence2(policy, command) {
  const keys = evidenceKeys(command);
  if (keys === null) return false;
  const dict = { rows: policy.rows, diagnostics: [] };
  const evidence = new Set(policy.evidence);
  return keys.some((k) => {
    const row = bindingOf(dict, k);
    return row?.for !== void 0 && evidence.has(row.for);
  });
}
function projectPath3(root, path) {
  if (path === void 0) return void 0;
  const p = normalised(path);
  const base = normalised(root)?.replace(/\/+$/, "");
  if (p === void 0 || base === void 0) return void 0;
  const lower = (s) => process.platform === "win32" ? s.toLowerCase() : s;
  if (lower(p).startsWith(`${lower(base)}/`)) return p.slice(base.length + 1);
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) return void 0;
  return p === "" ? void 0 : p.replace(/^\.\//, "");
}
var say = (o) => ({ stdout: `${JSON.stringify(o)}
` });
var NOTHING2 = say({});
async function runCursor(text3, env, o = {}) {
  const ev = readEvent2(text3);
  if (ev === void 0) return NOTHING2;
  const home = o.home ?? homedir2();
  const platform = o.platform ?? process.platform;
  const sid = ev.conversation_id ?? ev.session_id;
  const root = projectOf(ev.workspace_roots ?? [], env, ev.cwd);
  if (sid === void 0 || root === void 0) return ev.hook_event_name === "beforeSubmitPrompt" ? say({ continue: true }) : NOTHING2;
  const now = o.now ?? (/* @__PURE__ */ new Date()).toISOString();
  const file = join4(stateDir2(home), `${sid.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
  const state = readJson2(file, FRESH);
  const record = (f) => {
    try {
      f();
    } catch {
    }
  };
  const save = () => record(() => writeJson2(file, state));
  record(() => writeJson2(join4(stateDir2(home), "active.json"), { conversationId: sid, root, at: now }));
  const ask = (op) => handleRequest({ v: 1, root, ...op });
  const stage = (status, always = false) => {
    const doc = join4(root, CONTEXT_DOC);
    if (!exists(doc)) return void 0;
    const seen = contextOf(readText(doc));
    if (seen === void 0 || !always && seen.key === state.delivered) return void 0;
    const item = status?.item;
    if (item === void 0 || item.kind !== "item" || item.id !== seen.item) return void 0;
    state.delivered = seen.key;
    return seen.text;
  };
  switch (ev.hook_event_name) {
    case "sessionStart": {
      record(() => {
        appendSession(root, CURSOR_HOST, sid, () => [], now);
      });
      let told = [];
      try {
        told = [SESSIONS_PROMPT.replace("gemworks `note` tool", "`note` tool of the gemworks MCP server"), ...loopPrompt(coachFlowsAt(root))];
      } catch {
      }
      record(() => {
        if (boardHasWork(root)) openBoardOnce(root, sid);
      });
      let text4;
      const res = await ask({ op: "status" });
      if (res.ok && res.shell.status !== null) {
        const fresh = await ask({ op: "refresh" });
        text4 = stage((fresh.ok ? fresh.shell.status : null) ?? res.shell.status, true);
      }
      Object.assign(state, { pending: [], answer: "", acted: false });
      save();
      const said = [text4, ...told].filter((x) => x !== void 0 && x !== "").join("\n\n");
      return said === "" ? NOTHING2 : say({ additional_context: said });
    }
    case "beforeSubmitPrompt": {
      const pending = [];
      record(() => {
        if (ev.prompt !== void 0 && ev.prompt.trim() !== "" && ev.prompt.trim() !== WORK_REMINDER.trim()) recordPrompt(root, CURSOR_HOST, sid, ev.prompt, now);
        const fresh = decisionsFor(root, sid, state.decisionsSeen, now);
        state.decisionsSeen = now;
        if (fresh.length > 0) pending.push(decisionsContext(fresh, (d) => `${hostLabel(d.host)}${d.branch !== void 0 ? ` \xB7 ${d.branch}` : ""}\uFF0C${new Date(d.at).toTimeString().slice(0, 5)}`));
      });
      Object.assign(state, { acted: false, answer: "" });
      record(() => {
        writeBoard(root);
      });
      let loop = [];
      try {
        loop = loopContext(root, sid);
      } catch {
      }
      const res = await ask({ op: "status" });
      const text4 = res.ok && res.shell.status !== null ? stage(res.shell.status) : void 0;
      state.pending = [text4, ...pending, ...loop].filter((x) => x !== void 0 && x !== "");
      save();
      return say({ continue: true });
    }
    case "preToolUse": {
      const tool = ev.tool_name;
      if (tool === void 0 || isOwnTool(bareTool(tool))) return NOTHING2;
      const input = ev.tool_input ?? {};
      const call = callOf2(tool, input);
      const res = await ask({ op: "status" });
      if (!res.ok || res.shell.policy === null) return NOTHING2;
      const { policy } = res.shell;
      const decision = beforeDecision(policy, call);
      if (decision.kind === "prefer") {
        state.pending.push(`[gemworks] ${decision.use}'s preferred tool is ${decision.preferred}; this call uses ${decision.key}.`);
        save();
      } else if (decision.kind === "consult") {
        const before = await ask({ op: "before", tool: call.tool, callId: ev.tool_use_id ?? "cursor", input: call.input, cwd: root, ...decision.waived !== void 0 ? { waived: decision.waived } : {} });
        if (before.ok && before.refusal !== void 0) return say(denyCall2(before.refusal));
      }
      let updated;
      const fill = paramsToFill(policy, call);
      if (fill !== void 0) updated = { ...input, ...fill };
      const command = tool === SHELL ? commandOf(input) : void 0;
      if (command !== void 0 && policy.active && platform !== "win32" && !isWrapped(command) && speaksEvidence2(policy, command)) updated = { ...updated ?? input, command: wrapCommand(command) };
      return say(rewriteCall(updated));
    }
    case "postToolUse":
    case "postToolUseFailure": {
      const tool = ev.tool_name;
      if (tool === void 0) return NOTHING2;
      const failed = ev.hook_event_name === "postToolUseFailure";
      const said = state.pending;
      state.pending = [];
      const reply = (extra) => {
        save();
        const all = [...said, ...extra !== void 0 ? [extra] : []];
        return all.length === 0 ? NOTHING2 : say({ additional_context: all.join("\n\n") });
      };
      if (isOwnTool(bareTool(tool))) return reply();
      const given = ev.tool_input ?? {};
      const raw = tool === SHELL ? commandOf(given) : void 0;
      const input = raw !== void 0 && isWrapped(raw) ? { ...given, command: unwrapCommand(raw) } : given;
      const call = callOf2(tool, input);
      if (tool === SHELL && raw !== void 0 && commits(unwrapCommand(raw)) && !failed) state.committed = true;
      if (tool === SHELL || writesFiles(tool)) state.acted = true;
      const res = await ask({ op: "status" });
      if (!res.ok || res.shell.policy === null) return reply();
      const exitCode = tool === SHELL && !failed ? exitCodeOf(ev.tool_output) : void 0;
      const wrotePath = writesFiles(tool) && !failed ? projectPath3(root, pathOf(input)) : void 0;
      const isError = failed || typeof exitCode === "number" && exitCode !== 0;
      const outcome = { isError, gitOperation: false, consulted: false, ...typeof exitCode === "number" ? { exitCode } : {}, ...wrotePath !== void 0 ? { wrotePath } : {} };
      if (!afterNeeded(res.shell.policy, call, outcome)) return reply();
      const after = await ask({
        op: "after",
        tool: call.tool,
        callId: ev.tool_use_id ?? "cursor",
        input: call.input,
        isError,
        gitOperation: false,
        cwd: root,
        ...typeof exitCode === "number" ? { exitCode } : {},
        ...wrotePath !== void 0 ? { wrotePath } : {},
        ...state.delivered !== null ? { delivered: state.delivered } : {}
      });
      if (!after.ok || after.context === void 0) return reply();
      if (after.shell.contextKey !== null) state.delivered = after.shell.contextKey;
      return reply(after.handoff !== void 0 ? `${after.handoff}
${after.context}` : after.context);
    }
    case "afterFileEdit": {
      const path = projectPath3(root, ev.file_path);
      if (path !== void 0) record(() => {
        recordFile(root, CURSOR_HOST, sid, path, now);
      });
      state.acted = true;
      save();
      return NOTHING2;
    }
    case "afterAgentResponse": {
      if (ev.text !== void 0 && ev.text.trim() !== "") {
        state.answer = ev.text;
        save();
      }
      return NOTHING2;
    }
    // The turn's end. One that changed things and reported no work item goes back once to report it (the record
    // unread counts as reported: the reminder never comes from Gemworks' own failure). Else its answer and the commits
    // a command in it made go into the record, and the board is written again.
    case "stop": {
      if (state.acted && ev.status === "completed" && (ev.loop_count ?? 0) === 0) {
        state.acted = false;
        let reported = true;
        record(() => {
          const events = appendSession(root, CURSOR_HOST, sid, () => [], now);
          const turn = currentTurn(events);
          reported = events.some((e) => e.t === "item" && e.turn === turn) || coachFlowsAt(root).length === 0;
        });
        if (!reported) {
          save();
          return say({ followup_message: WORK_REMINDER });
        }
      }
      record(() => {
        writeBoard(root);
      });
      record(() => {
        recordAnswer(root, CURSOR_HOST, sid, state.answer, state.committed, now);
      });
      Object.assign(state, { committed: false, acted: false, answer: "" });
      save();
      return NOTHING2;
    }
    default:
      return NOTHING2;
  }
}
var EVENTS = { sessionStart: 60, beforeSubmitPrompt: 30, preToolUse: 30, postToolUse: 60, postToolUseFailure: 30, afterFileEdit: 20, afterAgentResponse: 20, stop: 30 };
var isOurs = (entry) => typeof entry === "object" && entry !== null && typeof entry.command === "string" && /gemworks(\.mjs)?"?\s+cursor$/.test(entry.command);
function hooksWith(file, command) {
  const hooks = typeof file["hooks"] === "object" && file["hooks"] !== null && !Array.isArray(file["hooks"]) ? { ...file["hooks"] } : {};
  for (const [event, timeout] of Object.entries(EVENTS)) {
    const kept = Array.isArray(hooks[event]) ? hooks[event].filter((e) => !isOurs(e)) : [];
    hooks[event] = [...kept, { command, timeout }];
  }
  return { ...file, version: typeof file["version"] === "number" ? file["version"] : 1, hooks };
}
function readSettings(file) {
  if (!existsSync(file)) return {};
  const text3 = readFileSync3(file, "utf8");
  if (text3.trim() === "") return {};
  let v;
  try {
    v = JSON.parse(text3);
  } catch {
    throw new Error(`${file} is not plain JSON (comments?): add the hooks and the MCP server by hand, or remove what keeps it from parsing`);
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error(`${file} is not a JSON object`);
  return v;
}
function installCursor(bundle, home = homedir2()) {
  const dir = join4(home, ".cursor");
  const hooksFile = join4(dir, "hooks.json");
  const mcpFile = join4(dir, "mcp.json");
  mkdirSync3(dir, { recursive: true });
  const path = bundle.split("\\").join("/");
  const hooks = readSettings(hooksFile);
  const mcp = readSettings(mcpFile);
  writeFileSync3(hooksFile, `${JSON.stringify(hooksWith(hooks, `node "${path}" cursor`), null, 2)}
`, "utf8");
  mcp.mcpServers = { ...mcp.mcpServers ?? {}, gemworks: { command: "node", args: [bundle, "mcp", "--host", CURSOR_HOST] } };
  writeFileSync3(mcpFile, `${JSON.stringify(mcp, null, 2)}
`, "utf8");
  return [hooksFile, mcpFile];
}

// src/qwen.ts
import { mkdirSync as mkdirSync5, writeFileSync as writeFileSync5 } from "node:fs";
import { homedir as homedir4 } from "node:os";
import { join as join6, resolve as resolve4 } from "node:path";

// src/hooked.ts
import { createHash } from "node:crypto";
import { existsSync as existsSync2, mkdirSync as mkdirSync4, readFileSync as readFileSync4, writeFileSync as writeFileSync4 } from "node:fs";
import { homedir as homedir3 } from "node:os";
import { join as join5 } from "node:path";
var FRESH2 = { delivered: null, decisionsSeen: null, turn: null, committed: false, acted: false, reminded: false };
function readState2(file) {
  try {
    return { ...FRESH2, ...JSON.parse(readFileSync4(file, "utf8")) };
  } catch {
    return { ...FRESH2 };
  }
}
function speaksEvidence3(policy, command) {
  const keys = evidenceKeys(command);
  if (keys === null) return false;
  const dict = { rows: policy.rows, diagnostics: [] };
  const evidence = new Set(policy.evidence);
  return keys.some((k) => {
    const row = bindingOf(dict, k);
    return row?.for !== void 0 && evidence.has(row.for);
  });
}
var hostStateDir = (host, home = homedir3()) => join5(home, ".gemworks", host);
function activeOf3(host, home = homedir3()) {
  try {
    const a = JSON.parse(readFileSync4(join5(hostStateDir(host, home), "active.json"), "utf8"));
    return typeof a.session === "string" && typeof a.root === "string" ? { session: a.session, root: a.root, at: a.at ?? "" } : void 0;
  } catch {
    return void 0;
  }
}
function mcpRootOf(host, root, home = homedir3()) {
  return existsSync2(join5(root, ".geml")) ? void 0 : activeOf3(host, home);
}
async function runHooked(host, tools, sid, root, ev, o = {}) {
  const home = o.home ?? homedir3();
  const platform = o.platform ?? process.platform;
  const now = o.now ?? (/* @__PURE__ */ new Date()).toISOString();
  const dir = hostStateDir(host, home);
  const file = join5(dir, `${sid.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
  const state = readState2(file);
  try {
    mkdirSync4(dir, { recursive: true });
    writeFileSync4(join5(dir, "active.json"), JSON.stringify({ session: sid, root, at: now }), "utf8");
  } catch {
  }
  const record = (f) => {
    try {
      f();
    } catch {
    }
  };
  const save = () => record(() => {
    mkdirSync4(dir, { recursive: true });
    writeFileSync4(file, JSON.stringify(state), "utf8");
  });
  const ask = (op) => handleRequest({ v: 1, root, ...op });
  const isShell2 = (tool) => tools.isShell !== void 0 ? tools.isShell(tool) : tool === tools.shell;
  const own = (tool) => isOwnTool(tool) || isOwnTool(tools.bareTool(tool));
  const idOf = (given, call) => given ?? `${host}-${createHash("sha1").update(JSON.stringify(call)).digest("hex").slice(0, 12)}`;
  const stage = (status, always = false) => {
    const doc = join5(root, CONTEXT_DOC);
    if (!exists(doc)) return void 0;
    const seen = contextOf(readText(doc));
    if (seen === void 0 || !always && seen.key === state.delivered) return void 0;
    const item = status?.item;
    if (item === void 0 || item.kind !== "item" || item.id !== seen.item) return void 0;
    state.delivered = seen.key;
    return seen.text;
  };
  switch (ev.kind) {
    case "start": {
      record(() => {
        appendSession(root, host, sid, () => [], now);
      });
      let told = [];
      try {
        told = [SESSIONS_PROMPT.replace("gemworks `note` tool", "`note` tool of the gemworks MCP server"), ...loopPrompt(coachFlowsAt(root))];
      } catch {
      }
      if (ev.source === void 0 || ev.source === "startup") record(() => {
        if (boardHasWork(root)) openBoardOnce(root, sid);
      });
      let text3;
      const res = await ask({ op: "status" });
      if (res.ok && res.shell.status !== null) {
        const fresh = await ask({ op: "refresh" });
        text3 = stage((fresh.ok ? fresh.shell.status : null) ?? res.shell.status, true);
      }
      save();
      const said = [text3, ...told].filter((x) => x !== void 0 && x !== "").join("\n\n");
      return said === "" ? void 0 : { kind: "context", text: said };
    }
    case "prompt": {
      const words = ev.words;
      const reminder = words !== void 0 && words.trim() === WORK_REMINDER.trim();
      const newTurn = !reminder && (ev.personal || ev.turn === void 0 || ev.turn !== state.turn);
      if (!newTurn) return void 0;
      state.turn = ev.turn ?? null;
      let shared;
      record(() => {
        if (words !== void 0 && words.trim() !== "") recordPrompt(root, host, sid, words, now);
        const fresh = decisionsFor(root, sid, state.decisionsSeen, now);
        state.decisionsSeen = now;
        if (fresh.length > 0) shared = decisionsContext(fresh, (d) => `${hostLabel(d.host)}${d.branch !== void 0 ? ` \xB7 ${d.branch}` : ""}\uFF0C${new Date(d.at).toTimeString().slice(0, 5)}`);
      });
      state.acted = false;
      state.reminded = false;
      record(() => {
        writeBoard(root);
      });
      let loop = [];
      try {
        loop = loopContext(root, sid);
      } catch {
      }
      const res = await ask({ op: "status" });
      const text3 = res.ok && res.shell.status !== null ? stage(res.shell.status) : void 0;
      save();
      const said = [text3, shared, ...loop].filter((x) => x !== void 0 && x !== "");
      return said.length === 0 ? void 0 : { kind: "context", text: said.join("\n\n") };
    }
    case "before": {
      const { tool, input } = ev;
      if (own(tool)) return void 0;
      const call = tools.callOf(tool, input);
      const res = await ask({ op: "status" });
      if (!res.ok || res.shell.policy === null) return void 0;
      const { policy } = res.shell;
      let context2;
      const decision = beforeDecision(policy, call);
      if (decision.kind === "prefer") context2 = `[gemworks] ${decision.use}'s preferred tool is ${decision.preferred}; this call uses ${decision.key}.`;
      else if (decision.kind === "consult") {
        const before = await ask({ op: "before", tool: call.tool, callId: idOf(ev.callId, call), input: call.input, cwd: root, ...decision.waived !== void 0 ? { waived: decision.waived } : {} });
        if (before.ok && before.refusal !== void 0) return { kind: "deny", reason: before.refusal };
      }
      let updated;
      const fill = paramsToFill(policy, call);
      if (fill !== void 0) updated = { ...input, ...fill };
      const command = isShell2(tool) ? commandOf(input) : void 0;
      if (command !== void 0 && policy.active && platform !== "win32" && !isWrapped(command) && speaksEvidence3(policy, command)) updated = { ...updated ?? input, command: wrapCommand(command) };
      if (updated === void 0 && context2 === void 0) return void 0;
      return { kind: "allow", ...updated !== void 0 ? { input: updated } : {}, ...context2 !== void 0 ? { context: context2 } : {} };
    }
    case "after": {
      const { tool, failed } = ev;
      if (own(tool)) return void 0;
      const raw = isShell2(tool) ? commandOf(ev.input) : void 0;
      const input = raw !== void 0 && isWrapped(raw) ? { ...ev.input, command: unwrapCommand(raw) } : ev.input;
      const call = tools.callOf(tool, input);
      const written = failed ? [] : tools.writes(tool, input).map((p) => projectPath3(root, p)).filter((p) => p !== void 0);
      for (const p of written) record(() => {
        recordFile(root, host, sid, p, now);
      });
      const wrote = written[0];
      if (isShell2(tool) && raw !== void 0 && !failed && commits(unwrapCommand(raw))) state.committed = true;
      if (isShell2(tool) || tools.writes(tool, input).length > 0) state.acted = true;
      save();
      const res = await ask({ op: "status" });
      if (!res.ok || res.shell.policy === null) return void 0;
      const exitCode = isShell2(tool) && !failed ? tools.exitCodeOf(ev.response) : void 0;
      const isError = failed || typeof exitCode === "number" && exitCode !== 0;
      const outcome = { isError, gitOperation: false, consulted: false, ...typeof exitCode === "number" ? { exitCode } : {}, ...wrote !== void 0 ? { wrotePath: wrote } : {} };
      if (!afterNeeded(res.shell.policy, call, outcome)) return void 0;
      const after = await ask({
        op: "after",
        tool: call.tool,
        callId: idOf(ev.callId, call),
        input: call.input,
        isError,
        gitOperation: false,
        cwd: root,
        ...typeof exitCode === "number" ? { exitCode } : {},
        ...wrote !== void 0 ? { wrotePath: wrote } : {},
        ...state.delivered !== null ? { delivered: state.delivered } : {}
      });
      if (!after.ok || after.context === void 0) return void 0;
      if (after.shell.contextKey !== null) {
        state.delivered = after.shell.contextKey;
        save();
      }
      return { kind: "context", text: after.handoff !== void 0 ? `${after.handoff}
${after.context}` : after.context };
    }
    // The turn's end. One that changed things and reported no work item goes back once to report it (the record
    // unread counts as reported: the reminder never comes from Gemworks' own failure). Else its answer and the commits
    // a command in it made go into the record, and the board is written again.
    case "stop": {
      if (state.acted && !ev.retry && !state.reminded) {
        state.acted = false;
        let reported = true;
        record(() => {
          const events = appendSession(root, host, sid, () => [], now);
          const turn = currentTurn(events);
          reported = events.some((e) => e.t === "item" && e.turn === turn) || coachFlowsAt(root).length === 0;
        });
        if (!reported) {
          state.reminded = true;
          save();
          return { kind: "continue", reason: WORK_REMINDER };
        }
      }
      record(() => {
        writeBoard(root);
      });
      record(() => {
        recordAnswer(root, host, sid, ev.answer ?? "", state.committed, now);
      });
      Object.assign(state, { committed: false, acted: false });
      save();
      return void 0;
    }
  }
}

// src/hosts/qwen/hook.ts
var isObject3 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function readEvent3(text3) {
  let v;
  try {
    v = JSON.parse(text3);
  } catch {
    return void 0;
  }
  if (!isObject3(v) || typeof v["hook_event_name"] !== "string") return void 0;
  const out2 = { hook_event_name: v["hook_event_name"] };
  for (const k of ["session_id", "cwd", "prompt_id", "tool_name", "tool_use_id", "error", "prompt", "submitted_prompt", "source", "last_assistant_message"]) {
    if (typeof v[k] === "string") out2[k] = v[k];
  }
  if (isObject3(v["tool_input"])) out2.tool_input = v["tool_input"];
  if ("tool_response" in v) out2.tool_response = v["tool_response"];
  if (typeof v["stop_hook_active"] === "boolean") out2.stop_hook_active = v["stop_hook_active"];
  return out2;
}
var SHELL2 = "run_shell_command";
var WRITERS2 = { write_file: "Write", edit: "Edit", replace: "Edit", notebook_edit: "NotebookEdit" };
var writesFiles2 = (tool) => Object.hasOwn(WRITERS2, tool);
var READERS = { read_file: "Read", read_many_files: "Read", grep_search: "Grep", glob: "Glob", list_directory: "LS", web_fetch: "WebFetch", web_search: "WebSearch", todo_write: "TodoWrite", task: "Task" };
var bareTool2 = (tool) => {
  const m = tool.match(/^mcp__.+?__(.+)$/);
  return m !== null ? m[1] : tool;
};
function pathOf2(input) {
  for (const k of ["file_path", "absolute_path", "notebook_path", "path"]) if (typeof input[k] === "string" && input[k] !== "") return input[k];
  return void 0;
}
function callOf3(tool, input) {
  if (tool === SHELL2) return { tool: "Bash", input: { ...input } };
  if (writesFiles2(tool)) {
    const path = pathOf2(input);
    return { tool: WRITERS2[tool], input: { ...input, ...path !== void 0 ? { file_path: path } : {} } };
  }
  return { tool: READERS[tool] ?? bareTool2(tool), input: { ...input } };
}
function exitCodeOf2(response) {
  const marked = exitCodeIn(response);
  if (marked !== null) return marked;
  let last = null;
  const visit = (v) => {
    if (typeof v === "string") {
      for (const m of v.matchAll(/^Exit Code: (\d+)\s*$/gm)) last = Number(m[1]);
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (isObject3(v)) {
      for (const k of ["exitCode", "exit_code"]) if (typeof v[k] === "number") last = v[k];
      if (last === null) Object.values(v).forEach(visit);
    }
  };
  visit(response);
  return last;
}
var denyCall3 = (reason) => ({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `gemworks: ${reason}` } });
function allowCall2(updatedInput, context2) {
  if (updatedInput === void 0 && context2 === void 0) return void 0;
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "gemworks",
      ...updatedInput !== void 0 ? { updatedInput } : {},
      ...context2 !== void 0 ? { additionalContext: context2 } : {}
    }
  };
}
var contextFor2 = (event, text3) => ({ hookSpecificOutput: { hookEventName: event, additionalContext: text3 } });

// src/qwen.ts
var QWEN_HOST = "qwen";
function projectOf2(env, cwd) {
  const dir = env["QWEN_PROJECT_DIR"] !== void 0 && env["QWEN_PROJECT_DIR"] !== "" ? env["QWEN_PROJECT_DIR"] : cwd;
  return dir === void 0 ? void 0 : resolve4(dir);
}
var TOOLS = {
  shell: SHELL2,
  callOf: callOf3,
  writes: (tool, input) => {
    const p = writesFiles2(tool) ? pathOf2(input) : void 0;
    return p === void 0 ? [] : [p];
  },
  exitCodeOf: exitCodeOf2,
  bareTool: bareTool2
};
var NOTHING3 = { stdout: "" };
var say2 = (o) => o === void 0 ? NOTHING3 : { stdout: `${JSON.stringify(o)}
` };
async function runQwen(text3, env, o = {}) {
  const ev = readEvent3(text3);
  if (ev === void 0) return NOTHING3;
  const sid = ev.session_id;
  const root = projectOf2(env, ev.cwd);
  if (sid === void 0 || root === void 0) return NOTHING3;
  let event;
  switch (ev.hook_event_name) {
    case "SessionStart":
      event = { kind: "start", ...ev.source !== void 0 ? { source: ev.source } : {} };
      break;
    // UserPromptSubmit also runs on some of Qwen Code's own sends inside a turn: a new turn is one whose `prompt_id` is
    // new or that carries the person's `submitted_prompt`.
    case "UserPromptSubmit": {
      const words = ev.submitted_prompt ?? ev.prompt;
      event = { kind: "prompt", personal: ev.submitted_prompt !== void 0, ...words !== void 0 ? { words } : {}, ...ev.prompt_id !== void 0 ? { turn: ev.prompt_id } : {} };
      break;
    }
    case "PreToolUse":
      if (ev.tool_name === void 0) return NOTHING3;
      event = { kind: "before", tool: ev.tool_name, input: ev.tool_input ?? {}, ...ev.tool_use_id !== void 0 ? { callId: ev.tool_use_id } : {} };
      break;
    case "PostToolUse":
    case "PostToolUseFailure":
      if (ev.tool_name === void 0) return NOTHING3;
      event = { kind: "after", tool: ev.tool_name, input: ev.tool_input ?? {}, failed: ev.hook_event_name === "PostToolUseFailure", response: ev.tool_response, ...ev.tool_use_id !== void 0 ? { callId: ev.tool_use_id } : {} };
      break;
    case "Stop":
      event = { kind: "stop", retry: ev.stop_hook_active === true, ...ev.last_assistant_message !== void 0 ? { answer: ev.last_assistant_message } : {} };
      break;
    default:
      return NOTHING3;
  }
  const answer2 = await runHooked(QWEN_HOST, TOOLS, sid, root, event, o);
  if (answer2 === void 0) return NOTHING3;
  switch (answer2.kind) {
    case "context":
      if (ev.hook_event_name === "PreToolUse" || ev.hook_event_name === "Stop") return NOTHING3;
      return say2(contextFor2(ev.hook_event_name, answer2.text));
    case "deny":
      return say2(denyCall3(answer2.reason));
    case "allow":
      return say2(allowCall2(answer2.input, answer2.context));
    case "continue":
      return say2({ decision: "block", reason: answer2.reason });
  }
}
var EVENTS2 = { SessionStart: 60, UserPromptSubmit: 30, PreToolUse: 30, PostToolUse: 60, PostToolUseFailure: 30, Stop: 30 };
var isOurs2 = (hook) => typeof hook === "object" && hook !== null && typeof hook.command === "string" && /gemworks(\.mjs)?"?\s+qwen$/.test(hook.command);
function hooksWith2(settings, command) {
  const given = settings["hooks"];
  const hooks = typeof given === "object" && given !== null && !Array.isArray(given) ? { ...given } : {};
  for (const [event, timeout] of Object.entries(EVENTS2)) {
    const groups = Array.isArray(hooks[event]) ? hooks[event] : [];
    const kept = groups.flatMap((g) => {
      if (typeof g !== "object" || g === null || !Array.isArray(g.hooks)) return [g];
      const left = g.hooks.filter((h) => !isOurs2(h));
      return left.length === 0 ? [] : [{ ...g, hooks: left }];
    });
    hooks[event] = [...kept, { hooks: [{ type: "command", command, name: "gemworks", timeout }] }];
  }
  return { ...settings, hooks };
}
function installQwen(bundle, home = homedir4()) {
  const dir = join6(home, ".qwen");
  const file = join6(dir, "settings.json");
  const settings = readSettings(file);
  const path = bundle.split("\\").join("/");
  const next = hooksWith2(settings, `node "${path}" qwen`);
  const servers = typeof settings["mcpServers"] === "object" && settings["mcpServers"] !== null ? settings["mcpServers"] : {};
  next["mcpServers"] = { ...servers, gemworks: { command: "node", args: [bundle, "mcp", "--host", QWEN_HOST] } };
  mkdirSync5(dir, { recursive: true });
  writeFileSync5(file, `${JSON.stringify(next, null, 2)}
`, "utf8");
  return [file];
}

// src/opencode.ts
import { mkdirSync as mkdirSync6, writeFileSync as writeFileSync6 } from "node:fs";
import { homedir as homedir5 } from "node:os";
import { join as join7, resolve as resolve5 } from "node:path";

// src/hosts/opencode/hook.ts
var SHELL3 = "shell";
var WRITERS3 = { write: "Write", edit: "Edit", patch: "Edit" };
var READERS2 = { read: "Read", grep: "Grep", glob: "Glob", webfetch: "WebFetch", websearch: "WebSearch", todowrite: "TodoWrite", subagent: "Task" };
var isObject4 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var bareTool3 = (tool) => {
  const m = tool.match(/^[^.]+\.(.+)$/);
  return m !== null ? m[1] : tool;
};
function writes(tool, input) {
  if (tool === "patch") return typeof input["patchText"] === "string" ? patchPaths(input["patchText"]) : [];
  if (!Object.hasOwn(WRITERS3, tool)) return [];
  return typeof input["path"] === "string" && input["path"] !== "" ? [input["path"]] : [];
}
function callOf4(tool, input) {
  if (tool === SHELL3) return { tool: "Bash", input: { ...input } };
  const file = Object.hasOwn(WRITERS3, tool) ? writes(tool, input)[0] : typeof input["path"] === "string" && input["path"] !== "" ? input["path"] : void 0;
  const named = WRITERS3[tool] ?? READERS2[tool];
  return { tool: named ?? bareTool3(tool), input: { ...input, ...named !== void 0 && file !== void 0 ? { file_path: file } : {} } };
}
function exitCodeOf3(response) {
  const marked = exitCodeIn(response);
  if (marked !== null) return marked;
  if (!isObject4(response)) return null;
  const output = response["output"];
  return isObject4(output) && typeof output["exit"] === "number" ? output["exit"] : null;
}

// src/opencode.ts
var OPENCODE_HOST = "opencode";
var TOOLS2 = { shell: SHELL3, callOf: callOf4, writes, exitCodeOf: exitCodeOf3, bareTool: bareTool3 };
var isObject5 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function readRequest(text3) {
  let v;
  try {
    v = JSON.parse(text3);
  } catch {
    return void 0;
  }
  if (!isObject5(v) || typeof v["session"] !== "string" || typeof v["root"] !== "string" || !isObject5(v["event"])) return void 0;
  const e = v["event"];
  const str = (k) => typeof e[k] === "string" ? { [k]: e[k] } : {};
  const input = isObject5(e["input"]) ? e["input"] : {};
  let event;
  switch (e["kind"]) {
    case "start":
      event = { kind: "start", ...str("source") };
      break;
    case "prompt":
      event = { kind: "prompt", personal: true, ...str("words") };
      break;
    case "before":
      if (typeof e["tool"] !== "string") return void 0;
      event = { kind: "before", tool: e["tool"], input, ...str("callId") };
      break;
    case "after":
      if (typeof e["tool"] !== "string") return void 0;
      event = { kind: "after", tool: e["tool"], input, failed: e["failed"] === true, response: e["response"], ...str("callId") };
      break;
    case "stop":
      event = { kind: "stop", retry: false, ...typeof e["answer"] === "string" ? { answer: e["answer"] } : {} };
      break;
    default:
      return void 0;
  }
  return { session: v["session"], root: resolve5(v["root"]), event };
}
async function runOpencode(text3, o = {}) {
  const req = readRequest(text3);
  if (req === void 0) return { stdout: "" };
  const answer2 = await runHooked(OPENCODE_HOST, TOOLS2, req.session, req.root, req.event, o);
  return { stdout: answer2 === void 0 ? "" : `${JSON.stringify(answer2)}
` };
}
function pluginsDir(env = process.env, home = homedir5()) {
  const config = env["XDG_CONFIG_HOME"] !== void 0 && env["XDG_CONFIG_HOME"] !== "" ? env["XDG_CONFIG_HOME"] : join7(home, ".config");
  return join7(config, "opencode", "plugins");
}
function pluginSource(node, bundle) {
  return `// Gemworks for OpenCode, written by \`gemworks opencode install\`: each hook asks \`gemworks opencode\` (one event on
// stdin, the answer on stdout) and does what it says. Install again to update it; delete this folder to remove it.
import { spawn } from "node:child_process";

const NODE = ${JSON.stringify(node)};
const BUNDLE = ${JSON.stringify(bundle)};
const WAIT = 30000;

/** The answer to one event; undefined when there is none or anything failed. */
function ask(root, session, event) {
  return new Promise((done) => {
    let out = "";
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; done(v); } };
    let child;
    try { child = spawn(NODE, [BUNDLE, "opencode"], { cwd: root, stdio: ["pipe", "pipe", "ignore"], windowsHide: true }); } catch { finish(undefined); return; }
    const timer = setTimeout(() => { try { child.kill(); } catch {} finish(undefined); }, WAIT);
    child.stdout.on("data", (d) => { out += d; });
    child.on("error", () => { clearTimeout(timer); finish(undefined); });
    child.on("close", () => { clearTimeout(timer); try { finish(out.trim() === "" ? undefined : JSON.parse(out)); } catch { finish(undefined); } });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify({ session, root, event }));
  });
}

export default {
  id: "gemworks",
  async setup(ctx) {
    const root = ctx.location.directory;
    /** Per session: what the model reads on every request (\`standing\`, from the session's start) and this turn (\`turn\`). */
    const sessions = new Map();
    const of = (id) => { let s = sessions.get(id); if (s === undefined) { s = { started: false, standing: "", turn: "" }; sessions.set(id, s); } return s; };
    /** Per call: a note \`before\` had for the model, given back with the result. */
    const notes = new Map();
    const text = (a) => (a !== undefined && a !== null && typeof a.text === "string" ? a.text : "");

    try {
      await ctx.mcp.transform((editor) => {
        editor.set("gemworks", { type: "local", command: [NODE, BUNDLE, "mcp", "--host", "opencode"], cwd: root });
      });
    } catch {}

    await ctx.session.hook("prompt", async (event) => {
      try {
        const s = of(event.sessionID);
        if (!s.started) {
          s.started = true;
          s.standing = text(await ask(root, event.sessionID, { kind: "start", source: "startup" }));
        }
        s.turn = text(await ask(root, event.sessionID, { kind: "prompt", words: event.prompt?.text ?? "" }));
      } catch {}
    });

    await ctx.session.hook("context", (event) => {
      try {
        const s = sessions.get(event.sessionID);
        if (s === undefined) return;
        for (const t of [s.standing, s.turn]) if (t !== "") event.system.push({ type: "text", text: t });
      } catch {}
    });

    await ctx.tool.hook("execute.before", async (event) => {
      let answer;
      try { answer = await ask(root, event.sessionID, { kind: "before", tool: event.tool, callId: event.id, input: event.input ?? {} }); } catch { return; }
      if (answer === undefined || answer === null) return;
      // The one rejection on purpose: OpenCode hands the model the reason as the tool's error.
      if (answer.kind === "deny") throw new Error("gemworks: " + answer.reason);
      if (answer.kind === "allow") {
        if (answer.input !== undefined) event.input = answer.input;
        if (typeof answer.context === "string") notes.set(event.id, answer.context);
      }
    });

    await ctx.tool.hook("execute.after", async (event) => {
      try {
        const note = notes.get(event.id);
        notes.delete(event.id);
        const failed = event.status !== "completed";
        const answer = await ask(root, event.sessionID, { kind: "after", tool: event.tool, callId: event.id, input: event.input ?? {}, failed, ...(failed ? {} : { response: event.result }) });
        const said = [note, text(answer)].filter((t) => typeof t === "string" && t !== "").join("\\n");
        if (said === "") return;
        if (!failed && Array.isArray(event.result.content)) event.result = { ...event.result, content: [...event.result.content, { type: "text", text: said }] };
        else { const s = of(event.sessionID); s.turn = s.turn === "" ? said : s.turn + "\\n\\n" + said; }
      } catch {}
    });

    await ctx.session.hook("experimental.idle", async (event) => {
      try {
        const answer = await ask(root, event.sessionID, { kind: "stop" });
        if (answer !== undefined && answer !== null && answer.kind === "continue") await ctx.session.synthetic({ sessionID: event.sessionID, text: answer.reason });
      } catch {}
    });
  },
};
`;
}
function installOpencode(bundle, node = process.execPath, env = process.env, home = homedir5()) {
  const dir = join7(pluginsDir(env, home), "gemworks");
  mkdirSync6(dir, { recursive: true });
  const pkg = join7(dir, "package.json");
  const index = join7(dir, "index.js");
  writeFileSync6(pkg, `${JSON.stringify({ name: "gemworks-opencode", private: true, type: "module", exports: { ".": "./index.js" } }, null, 2)}
`, "utf8");
  writeFileSync6(index, pluginSource(node, bundle), "utf8");
  return [index, pkg];
}

// src/devin.ts
import { mkdirSync as mkdirSync7, writeFileSync as writeFileSync7 } from "node:fs";
import { homedir as homedir6 } from "node:os";
import { join as join8, resolve as resolve6 } from "node:path";

// src/hosts/devin/hook.ts
var SHELL4 = "exec";
var WRITERS4 = { write: "Write", edit: "Edit", apply_patch: "Edit", notebook_edit: "NotebookEdit" };
var READERS3 = { read: "Read", notebook_read: "Read", grep: "Grep", glob: "Glob", webfetch: "WebFetch", todo_write: "TodoWrite", run_subagent: "Task" };
var isObject6 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function pathOf3(input) {
  for (const k of ["file_path", "path", "absolute_path", "notebook_path", "target_file"]) if (typeof input[k] === "string" && input[k] !== "") return input[k];
  return void 0;
}
function writes2(tool, input) {
  if (!Object.hasOwn(WRITERS4, tool)) return [];
  if (tool === "apply_patch") {
    const paths = Object.values(input).flatMap((v) => typeof v === "string" ? patchPaths(v) : []);
    if (paths.length > 0) return paths;
  }
  const p = pathOf3(input);
  return p === void 0 ? [] : [p];
}
function callOf5(tool, input) {
  if (tool === SHELL4) return { tool: "Bash", input: { ...input } };
  if (Object.hasOwn(WRITERS4, tool)) {
    const file = writes2(tool, input)[0];
    return { tool: WRITERS4[tool], input: { ...input, ...file !== void 0 ? { file_path: file } : {} } };
  }
  return { tool: READERS3[tool] ?? bareTool2(tool), input: { ...input } };
}
var exitCodeOf4 = (response) => exitCodeIn(response);
var failedIn = (response) => isObject6(response) && response["success"] === false;

// src/devin.ts
var DEVIN_HOST = "devin";
var TOOLS3 = { shell: SHELL4, callOf: callOf5, writes: writes2, exitCodeOf: exitCodeOf4, bareTool: bareTool2 };
function projectOf3(env, cwd, here = process.cwd()) {
  const dir = env["DEVIN_PROJECT_DIR"] !== void 0 && env["DEVIN_PROJECT_DIR"] !== "" ? env["DEVIN_PROJECT_DIR"] : cwd ?? here;
  return resolve6(dir);
}
var mcpRootOf2 = (root, home = homedir6()) => mcpRootOf(DEVIN_HOST, root, home);
var NOTHING4 = { stdout: "", stderr: "", code: 0 };
var say3 = (o) => ({ stdout: `${JSON.stringify(o)}
`, stderr: "", code: 0 });
var context = (event, text3) => say3({ hookSpecificOutput: { hookEventName: event, additionalContext: text3 } });
async function runDevin(text3, env, o = {}) {
  const ev = readEvent3(text3);
  if (ev === void 0) return NOTHING4;
  const sid = ev.session_id;
  if (sid === void 0) return NOTHING4;
  const root = projectOf3(env, ev.cwd, o.here);
  let event;
  switch (ev.hook_event_name) {
    case "SessionStart":
      event = { kind: "start", ...ev.source !== void 0 ? { source: ev.source } : {} };
      break;
    case "UserPromptSubmit":
      event = { kind: "prompt", personal: false, ...ev.prompt !== void 0 ? { words: ev.prompt } : {}, ...ev.prompt_id !== void 0 ? { turn: ev.prompt_id } : {} };
      break;
    case "PreToolUse":
      if (ev.tool_name === void 0) return NOTHING4;
      event = { kind: "before", tool: ev.tool_name, input: ev.tool_input ?? {} };
      break;
    case "PostToolUse": {
      if (ev.tool_name === void 0) return NOTHING4;
      const failed = failedIn(ev.tool_response) && !(ev.tool_name === SHELL4 && exitCodeOf4(ev.tool_response) !== null);
      event = { kind: "after", tool: ev.tool_name, input: ev.tool_input ?? {}, failed, response: ev.tool_response };
      break;
    }
    case "Stop":
      event = { kind: "stop", retry: ev.stop_hook_active === true, ...ev.last_assistant_message !== void 0 ? { answer: ev.last_assistant_message } : {} };
      break;
    default:
      return NOTHING4;
  }
  const answer2 = await runHooked(DEVIN_HOST, TOOLS3, sid, root, event, o);
  if (answer2 === void 0) return NOTHING4;
  switch (answer2.kind) {
    case "context":
      return ev.hook_event_name === "Stop" || ev.hook_event_name === "PreToolUse" ? NOTHING4 : context(ev.hook_event_name, answer2.text);
    case "deny":
      return { stdout: "", stderr: `gemworks: ${answer2.reason}
`, code: 2 };
    case "allow":
      return answer2.input === void 0 ? NOTHING4 : say3({ hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput: answer2.input } });
    case "continue":
      return say3({ decision: "block", reason: answer2.reason });
  }
}
var EVENTS3 = { SessionStart: 60, UserPromptSubmit: 30, PreToolUse: 30, PostToolUse: 60, Stop: 30 };
var isOurs3 = (hook) => typeof hook === "object" && hook !== null && typeof hook.command === "string" && /gemworks(\.mjs)?"?\s+devin$/.test(hook.command);
function hooksWith3(config, command) {
  const given = config["hooks"];
  const hooks = typeof given === "object" && given !== null && !Array.isArray(given) ? { ...given } : {};
  for (const [event, timeout] of Object.entries(EVENTS3)) {
    const groups = Array.isArray(hooks[event]) ? hooks[event] : [];
    const kept = groups.flatMap((g) => {
      if (typeof g !== "object" || g === null || !Array.isArray(g.hooks)) return [g];
      const left = g.hooks.filter((h) => !isOurs3(h));
      return left.length === 0 ? [] : [{ ...g, hooks: left }];
    });
    hooks[event] = [...kept, { hooks: [{ type: "command", command, timeout }] }];
  }
  return { ...config, hooks };
}
function configDir(home = homedir6(), env = process.env, platform = process.platform) {
  if (platform === "win32" && env["APPDATA"] !== void 0 && env["APPDATA"] !== "") return join8(env["APPDATA"], "devin");
  return join8(home, ".config", "devin");
}
function installDevin(bundle, home = homedir6(), env = process.env, platform = process.platform) {
  const dir = configDir(home, env, platform);
  const configFile = join8(dir, "config.json");
  const mcpFile = join8(dir, "mcp_config.json");
  const config = readSettings(configFile);
  const mcp = readSettings(mcpFile);
  const path = bundle.split("\\").join("/");
  const servers = typeof mcp["mcpServers"] === "object" && mcp["mcpServers"] !== null ? mcp["mcpServers"] : {};
  mkdirSync7(dir, { recursive: true });
  writeFileSync7(configFile, `${JSON.stringify(hooksWith3(config, `node "${path}" devin`), null, 2)}
`, "utf8");
  writeFileSync7(mcpFile, `${JSON.stringify({ ...mcp, mcpServers: { ...servers, gemworks: { command: "node", args: [bundle, "mcp", "--host", DEVIN_HOST] } } }, null, 2)}
`, "utf8");
  return [configFile, mcpFile];
}

// src/trae.ts
import { existsSync as existsSync3, mkdirSync as mkdirSync8, writeFileSync as writeFileSync8 } from "node:fs";
import { homedir as homedir7 } from "node:os";
import { join as join9, resolve as resolve7 } from "node:path";
var TRAE_HOST = "trae";
var SHELL5 = "RunCommand";
var WRITERS5 = /* @__PURE__ */ new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
function callOf6(tool, input) {
  if (tool === SHELL5) return { tool: "Bash", input: { ...input } };
  if (WRITERS5.has(tool)) {
    const path = pathOf2(input);
    return { tool, input: { ...input, ...path !== void 0 ? { file_path: path } : {} } };
  }
  return { tool: bareTool2(tool), input: { ...input } };
}
var TOOLS4 = {
  shell: SHELL5,
  callOf: callOf6,
  writes: (tool, input) => {
    const p = WRITERS5.has(tool) ? pathOf2(input) : void 0;
    return p === void 0 ? [] : [p];
  },
  exitCodeOf: exitCodeOf2,
  bareTool: bareTool2
};
function projectOf4(roots, env, cwd) {
  const withGeml = roots.find((r) => existsSync3(join9(r, ".geml")));
  const dir = withGeml ?? (env["TRAE_PROJECT_DIR"] !== void 0 && env["TRAE_PROJECT_DIR"] !== "" ? env["TRAE_PROJECT_DIR"] : cwd);
  return dir === void 0 ? void 0 : resolve7(dir);
}
var NOTHING5 = { stdout: "" };
var say4 = (o) => ({ stdout: `${JSON.stringify(o)}
` });
async function runTrae(text3, env, o = {}) {
  const ev = readEvent3(text3);
  if (ev === void 0) return NOTHING5;
  const sid = ev.session_id;
  let roots = [];
  try {
    const v = JSON.parse(text3);
    if (Array.isArray(v.workspace_roots)) roots = v.workspace_roots.filter((r) => typeof r === "string");
  } catch {
  }
  const root = projectOf4(roots, env, ev.cwd);
  if (sid === void 0 || root === void 0) return NOTHING5;
  let event;
  switch (ev.hook_event_name) {
    case "SessionStart":
      event = { kind: "start", ...ev.source !== void 0 ? { source: ev.source } : {} };
      break;
    // TRAE runs it when the person sends a message: each one is a turn.
    case "UserPromptSubmit":
      event = { kind: "prompt", personal: true, ...ev.prompt !== void 0 ? { words: ev.prompt } : {} };
      break;
    case "PreToolUse":
      if (ev.tool_name === void 0) return NOTHING5;
      event = { kind: "before", tool: ev.tool_name, input: ev.tool_input ?? {}, ...ev.tool_use_id !== void 0 ? { callId: ev.tool_use_id } : {} };
      break;
    case "PostToolUse":
      if (ev.tool_name === void 0) return NOTHING5;
      event = { kind: "after", tool: ev.tool_name, input: ev.tool_input ?? {}, failed: false, response: ev.tool_response, ...ev.tool_use_id !== void 0 ? { callId: ev.tool_use_id } : {} };
      break;
    case "Stop":
      event = { kind: "stop", retry: ev.stop_hook_active === true, ...ev.last_assistant_message !== void 0 ? { answer: ev.last_assistant_message } : {} };
      break;
    default:
      return NOTHING5;
  }
  const answer2 = await runHooked(TRAE_HOST, TOOLS4, sid, root, event, o);
  if (answer2 === void 0) return NOTHING5;
  switch (answer2.kind) {
    case "context":
      if (ev.hook_event_name === "Stop") return NOTHING5;
      if (ev.hook_event_name === "PreToolUse") return say4({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: answer2.text } });
      return say4(contextFor2(ev.hook_event_name, answer2.text));
    case "deny":
      return say4(denyCall3(answer2.reason));
    case "allow":
      return say4({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "gemworks", ...answer2.input !== void 0 ? { updatedInput: answer2.input } : {}, ...answer2.context !== void 0 ? { additionalContext: answer2.context } : {} } });
    case "continue":
      return say4({ decision: "block", reason: answer2.reason });
  }
}
var EVENTS4 = { SessionStart: 60, UserPromptSubmit: 30, PreToolUse: 30, PostToolUse: 60, Stop: 30 };
var isOurs4 = (hook) => typeof hook === "object" && hook !== null && typeof hook.command === "string" && /gemworks(\.mjs)?"?\s+trae$/.test(hook.command);
function hooksWith4(file, command) {
  const given = file["hooks"];
  const hooks = typeof given === "object" && given !== null && !Array.isArray(given) ? { ...given } : {};
  for (const [event, timeout] of Object.entries(EVENTS4)) {
    const groups = Array.isArray(hooks[event]) ? hooks[event] : [];
    const kept = groups.flatMap((g) => {
      if (typeof g !== "object" || g === null || !Array.isArray(g.hooks)) return [g];
      const left = g.hooks.filter((h) => !isOurs4(h));
      return left.length === 0 ? [] : [{ ...g, hooks: left }];
    });
    hooks[event] = [...kept, { hooks: [{ type: "command", command, timeout }] }];
  }
  return { version: 1, ...file, hooks };
}
var mcpEntry = (bundle) => ({ mcpServers: { gemworks: { command: "node", args: [bundle, "mcp", "--host", TRAE_HOST] } } });
function installTrae(bundle, home = homedir7()) {
  const dirs = [join9(home, ".trae"), join9(home, ".trae-cn")];
  const present = dirs.filter((d) => existsSync3(d));
  const files = (present.length > 0 ? present : dirs).map((d) => join9(d, "hooks.json"));
  const read = files.map((f) => readSettings(f));
  const path = bundle.split("\\").join("/");
  files.forEach((f, i) => {
    mkdirSync8(resolve7(f, ".."), { recursive: true });
    writeFileSync8(f, `${JSON.stringify(hooksWith4(read[i], `node "${path}" trae`), null, 2)}
`, "utf8");
  });
  return files;
}

// src/kiro.ts
import { mkdirSync as mkdirSync9, writeFileSync as writeFileSync9 } from "node:fs";
import { homedir as homedir8 } from "node:os";
import { join as join10, resolve as resolve8 } from "node:path";

// src/hosts/kiro/hook.ts
var fold = (tool) => tool.toLowerCase().replace(/[_-]/g, "");
var SHELLS = /* @__PURE__ */ new Set(["shell", "executebash", "executecmd", "executepwsh", "bash"]);
var WRITERS6 = { write: "Write", fswrite: "Write", fsappend: "Edit", strreplace: "Edit", edit: "Edit" };
var READERS4 = {
  read: "Read",
  fsread: "Read",
  readfile: "Read",
  readmultiplefiles: "Read",
  grep: "Grep",
  grepsearch: "Grep",
  glob: "Glob",
  filesearch: "Glob",
  listdirectory: "LS",
  webfetch: "WebFetch",
  websearch: "WebSearch",
  subagent: "Task",
  usesubagent: "Task",
  todo: "TodoWrite"
};
var isShell = (tool) => SHELLS.has(fold(tool));
function bareTool4(tool) {
  if (tool.startsWith("mcp_gemworks_")) return tool.slice("mcp_gemworks_".length);
  const m = tool.match(/^mcp_[^_]+_(.+)$/);
  return m !== null ? m[1] : tool;
}
function pathOf4(input) {
  for (const k of ["path", "file_path", "filePath", "targetFile", "target_file", "absolute_path"]) if (typeof input[k] === "string" && input[k] !== "") return input[k];
  return void 0;
}
function writes3(tool, input) {
  if (!Object.hasOwn(WRITERS6, fold(tool))) return [];
  const p = pathOf4(input);
  return p === void 0 ? [] : [p];
}
function callOf7(tool, input) {
  if (isShell(tool)) return { tool: "Bash", input: { ...input } };
  const f = fold(tool);
  if (Object.hasOwn(WRITERS6, f)) {
    const p = pathOf4(input);
    return { tool: WRITERS6[f], input: { ...input, ...p !== void 0 ? { file_path: p } : {} } };
  }
  return { tool: READERS4[f] ?? bareTool4(tool), input: { ...input } };
}
var isObject7 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function exitCodeOf5(response) {
  const marked = exitCodeIn(response);
  if (marked !== null) return marked;
  let found = null;
  const visit = (v) => {
    if (found !== null) return;
    if (typeof v === "string") {
      const m = v.match(/^(?:Exit Code|exit status|exit_status):\s*(\d+)\s*$/im);
      if (m !== null) found = Number(m[1]);
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (isObject7(v)) {
      for (const k of ["exit_status", "exitStatus", "exit_code", "exitCode"]) {
        const n = v[k];
        if (typeof n === "number") {
          found = n;
          return;
        }
        if (typeof n === "string" && /^\d+$/.test(n)) {
          found = Number(n);
          return;
        }
      }
      Object.values(v).forEach(visit);
    }
  };
  visit(response);
  return found;
}

// src/kiro.ts
var KIRO_HOST = "kiro";
var TOOLS5 = { shell: "shell", isShell, callOf: callOf7, writes: writes3, exitCodeOf: exitCodeOf5, bareTool: bareTool4 };
var isObject8 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var NOTHING6 = { stdout: "", stderr: "", code: 0 };
var text = (t) => ({ stdout: `${t}
`, stderr: "", code: 0 });
async function runKiro(input, env, o = {}) {
  let v;
  try {
    v = JSON.parse(input);
  } catch {
    return NOTHING6;
  }
  if (!isObject8(v) || typeof v["hook_event_name"] !== "string") return NOTHING6;
  const str = (k) => typeof v[k] === "string" ? v[k] : void 0;
  const sid = str("session_id");
  if (sid === void 0) return NOTHING6;
  const root = resolve8(str("cwd") ?? o.here ?? process.cwd());
  const tool = str("tool_name");
  const toolInput = isObject8(v["tool_input"]) ? v["tool_input"] : {};
  let event;
  switch (v["hook_event_name"]) {
    case "SessionStart":
    case "AgentSpawn":
    case "agentSpawn":
      event = { kind: "start" };
      break;
    case "UserPromptSubmit":
    case "userPromptSubmit": {
      const words = str("prompt") ?? (env["USER_PROMPT"] !== void 0 && env["USER_PROMPT"] !== "" ? env["USER_PROMPT"] : void 0);
      event = { kind: "prompt", personal: true, ...words !== void 0 ? { words } : {} };
      break;
    }
    case "PreToolUse":
    case "preToolUse":
      if (tool === void 0) return NOTHING6;
      event = { kind: "before", tool, input: toolInput };
      break;
    case "PostToolUse":
    case "postToolUse":
      if (tool === void 0) return NOTHING6;
      event = { kind: "after", tool, input: toolInput, failed: false, response: v["tool_response"] };
      break;
    case "Stop":
    case "stop":
      event = { kind: "stop", retry: false, ...str("assistant_response") !== void 0 ? { answer: str("assistant_response") } : {} };
      break;
    default:
      return NOTHING6;
  }
  const answer2 = await runHooked(KIRO_HOST, TOOLS5, sid, root, event, o);
  if (answer2 === void 0) return NOTHING6;
  switch (answer2.kind) {
    case "context":
      return text(answer2.text);
    case "deny":
      return { stdout: "", stderr: `gemworks: ${answer2.reason}
`, code: 2 };
    // Kiro cannot take a changed input: only the note reaches the agent.
    case "allow":
      return answer2.context === void 0 ? NOTHING6 : text(answer2.context);
    case "continue":
      return text(answer2.reason);
  }
}
var TRIGGERS = { SessionStart: 60, UserPromptSubmit: 30, PreToolUse: 30, PostToolUse: 60, Stop: 30 };
function hookFile(command) {
  return {
    version: "v1",
    hooks: Object.entries(TRIGGERS).map(([trigger, timeout]) => ({
      name: `gemworks ${trigger}`,
      description: "Gemworks: the workflow's gate, context and work loop",
      trigger,
      action: { type: "command", command },
      timeout
    }))
  };
}
function installKiro(bundle, project, home = homedir8()) {
  const mcpFile = join10(home, ".kiro", "settings", "mcp.json");
  const mcp = readSettings(mcpFile);
  const path = bundle.split("\\").join("/");
  const hooks = `${JSON.stringify(hookFile(`node "${path}" kiro`), null, 2)}
`;
  const files = [join10(home, ".kiro", "hooks", "gemworks.json"), ...project !== void 0 ? [join10(resolve8(project), ".kiro", "hooks", "gemworks.json")] : []];
  for (const f of files) {
    mkdirSync9(resolve8(f, ".."), { recursive: true });
    writeFileSync9(f, hooks, "utf8");
  }
  const servers = isObject8(mcp["mcpServers"]) ? mcp["mcpServers"] : {};
  mkdirSync9(resolve8(mcpFile, ".."), { recursive: true });
  writeFileSync9(mcpFile, `${JSON.stringify({ ...mcp, mcpServers: { ...servers, gemworks: { command: "node", args: [bundle, "mcp", "--host", KIRO_HOST] } } }, null, 2)}
`, "utf8");
  return [...files, mcpFile];
}

// src/mcp.ts
import { existsSync as existsSync4, readFileSync as readFileSync5 } from "node:fs";
import { isAbsolute as isAbsolute2, join as join11 } from "node:path";
import { createInterface } from "node:readline";
function packageVersion() {
  try {
    return JSON.parse(readFileSync5(new URL("../package.json", import.meta.url), "utf8")).version;
  } catch {
    return "unknown";
  }
}
var PROTOCOLS = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"];
var HOOKED = /* @__PURE__ */ new Set(["codex", ANTIGRAVITY_HOST, CURSOR_HOST, QWEN_HOST, OPENCODE_HOST, DEVIN_HOST, TRAE_HOST, KIRO_HOST]);
var result = (id, value) => ({ jsonrpc: "2.0", id, result: value });
var failure = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
var text2 = (id, body, isError) => result(id, { content: [{ type: "text", text: body }], ...isError ? { isError: true } : {} });
var NO_ENFORCEMENT_NOTE = "(this host shows Gemworks no tool calls: nothing is refused here, and a variable whose source is a tool is never written \u2014 tell the person what you ran, so they can tick a variable the guard accepts)";
var withNote = (stage) => `${stage}

${NO_ENFORCEMENT_NOTE}`;
function codexTurnOf(params) {
  const meta = params?.["_meta"];
  const turn = meta?.["x-codex-turn-metadata"];
  if (turn === null || typeof turn !== "object" || Array.isArray(turn)) return {};
  const t = turn;
  const spaces = t["workspaces"] !== null && typeof t["workspaces"] === "object" && !Array.isArray(t["workspaces"]) ? Object.keys(t["workspaces"]).filter(isAbsolute2) : [];
  const root = spaces.find((p) => existsSync4(join11(p, ".geml"))) ?? spaces[0];
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
  const hooked = o.host === DEVIN_HOST ? mcpRootOf2(o.root) : o.host === TRAE_HOST || o.host === KIRO_HOST ? mcpRootOf(o.host, o.root) : void 0;
  const active = o.host === ANTIGRAVITY_HOST ? activeOf() : o.host === CURSOR_HOST ? activeOf2() : hooked !== void 0 ? { conversationId: hooked.session, root: hooked.root } : void 0;
  const codex = codexTurnOf(m?.params);
  const root = active?.root ?? codex.root ?? o.root;
  const sessionOf = () => active?.conversationId ?? codex.session ?? latestSessionOf(root, o.host) ?? `mcp-${process.pid}`;
  const state = o.state ?? { decisionsSeen: null };
  const withNews = (body, isError) => {
    if (HOOKED.has(o.host)) return text2(id, body, isError);
    let news = "";
    try {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const fresh = decisionsFor(root, sessionOf(), state.decisionsSeen, now);
      state.decisionsSeen = now;
      if (fresh.length > 0) news = decisionsContext(fresh, (d) => `${hostLabel(d.host)}${d.branch !== void 0 ? ` \xB7 ${d.branch}` : ""}\uFF0C${new Date(d.at).toTimeString().slice(0, 5)}`);
    } catch {
    }
    return text2(id, news !== "" ? `${body}

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
      return text2(id, `gemworks: ${e instanceof Error ? e.message : String(e)}`, true);
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

${loop}`, false) : text2(id, `gemworks: ${opened.reason}`, true);
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
    return text2(id, message.startsWith("gemworks:") ? message : `gemworks: ${message}`, true);
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
function cellWidth(text3) {
  let width = 0;
  for (const ch of text3) {
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
  "  cursor [install]                        Cursor's hook (one event on stdin, its answer on stdout, exit 0 always), or put its hooks and MCP server in place",
  "  qwen [install]                          Qwen Code's hook (one event on stdin, its answer on stdout, exit 0 always), or put its hooks and MCP server in place",
  "  opencode [install]                      what OpenCode's Gemworks plugin asks (one event on stdin, the answer on stdout, exit 0 always), or put the plugin in place",
  "  devin [install]                         Devin's hook, Devin Desktop (formerly Windsurf) and the CLI (one event on stdin, its answer on stdout), or put its hooks and MCP server in place",
  "  trae [install]                          TRAE's hook (one event on stdin, its answer on stdout, exit 0 always), or put its hooks in place and print its MCP server's entry",
  "  kiro [install [dir]]                    Kiro's hook, IDE and CLI V3 (one event on stdin, its answer on stdout), or put its hooks (and dir's) and MCP server in place",
  "  mcp [--host h] [--root dir]             the model's tools over stdio MCP (host default: mcp)",
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
function projectOf5(flowPath) {
  const workflowDir = dirname2(flowPath);
  if (basename(flowPath).toLowerCase() !== FLOW_FILE && basename(workflowDir) === "workflows" && basename(dirname2(workflowDir)) === GEML_DIR) {
    const home = dirname2(dirname2(workflowDir));
    return realPath(homeOf(process.cwd())) === realPath(home) ? process.cwd() : home;
  }
  const above = resolve9(workflowDir, "..", "..", "..");
  return resolve9(above, WORKFLOWS_DIR, basename(workflowDir)) === workflowDir ? above : process.cwd();
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
  let text3 = "";
  for await (const chunk of process.stdin) text3 += chunk;
  const req = decodeRequest(text3);
  const res = "error" in req ? { v: 1, ok: false, error: req.error } : await handleRequest(req);
  process.stdout.write(`${JSON.stringify(res)}
`);
  return 0;
}
async function runCodexHook() {
  process.stdin.setEncoding("utf8");
  let text3 = "";
  for await (const chunk of process.stdin) text3 += chunk;
  try {
    const r = await runCodex(text3, process.env);
    process.stdout.write(r.stdout);
    return r.code;
  } catch (e) {
    process.stderr.write(`gemworks codex: ${e instanceof Error ? e.message : String(e)}
`);
    return 0;
  }
}
function installed(host, install) {
  try {
    for (const f of install()) process.stdout.write(`${f}
`);
    return 0;
  } catch (e) {
    process.stderr.write(`gemworks ${host} install: ${e instanceof Error ? e.message : String(e)}
`);
    return 1;
  }
}
async function runQwenHook(arg) {
  if (arg === "install") return installed("qwen", () => installQwen(resolve9(process.argv[1] ?? "gemworks.mjs")));
  try {
    process.stdin.setEncoding("utf8");
    let text3 = "";
    for await (const chunk of process.stdin) text3 += chunk;
    process.stdout.write((await runQwen(text3, process.env)).stdout);
  } catch (e) {
    process.stderr.write(`gemworks qwen: ${e instanceof Error ? e.message : String(e)}
`);
  }
  return 0;
}
async function runOpencodeHook(arg) {
  if (arg === "install") return installed("opencode", () => installOpencode(resolve9(process.argv[1] ?? "gemworks.mjs")));
  try {
    process.stdin.setEncoding("utf8");
    let text3 = "";
    for await (const chunk of process.stdin) text3 += chunk;
    process.stdout.write((await runOpencode(text3)).stdout);
  } catch (e) {
    process.stderr.write(`gemworks opencode: ${e instanceof Error ? e.message : String(e)}
`);
  }
  return 0;
}
async function runKiroHook(arg, dir) {
  if (arg === "install") return installed("kiro", () => installKiro(resolve9(process.argv[1] ?? "gemworks.mjs"), dir));
  try {
    process.stdin.setEncoding("utf8");
    let text3 = "";
    for await (const chunk of process.stdin) text3 += chunk;
    const run2 = await runKiro(text3, process.env);
    process.stdout.write(run2.stdout);
    process.stderr.write(run2.stderr);
    return run2.code;
  } catch (e) {
    process.stderr.write(`gemworks kiro: ${e instanceof Error ? e.message : String(e)}
`);
    return 0;
  }
}
async function runTraeHook(arg) {
  if (arg === "install") {
    const bundle = resolve9(process.argv[1] ?? "gemworks.mjs");
    const code = installed("trae", () => installTrae(bundle));
    if (code === 0) process.stdout.write(`
TRAE keeps its MCP servers in its own settings: add this under Settings \u2192 MCP \u2192 Add manually:
${JSON.stringify(mcpEntry(bundle), null, 2)}
`);
    return code;
  }
  try {
    process.stdin.setEncoding("utf8");
    let text3 = "";
    for await (const chunk of process.stdin) text3 += chunk;
    process.stdout.write((await runTrae(text3, process.env)).stdout);
  } catch (e) {
    process.stderr.write(`gemworks trae: ${e instanceof Error ? e.message : String(e)}
`);
  }
  return 0;
}
async function runDevinHook(arg) {
  if (arg === "install") return installed("devin", () => installDevin(resolve9(process.argv[1] ?? "gemworks.mjs")));
  try {
    process.stdin.setEncoding("utf8");
    let text3 = "";
    for await (const chunk of process.stdin) text3 += chunk;
    const run2 = await runDevin(text3, process.env);
    process.stdout.write(run2.stdout);
    process.stderr.write(run2.stderr);
    return run2.code;
  } catch (e) {
    process.stderr.write(`gemworks devin: ${e instanceof Error ? e.message : String(e)}
`);
    return 0;
  }
}
async function runCursorHook(arg) {
  if (arg === "install") return installed("cursor", () => installCursor(resolve9(process.argv[1] ?? "gemworks.mjs")));
  try {
    process.stdin.setEncoding("utf8");
    let text3 = "";
    for await (const chunk of process.stdin) text3 += chunk;
    process.stdout.write((await runCursor(text3, process.env)).stdout);
  } catch (e) {
    process.stderr.write(`gemworks cursor: ${e instanceof Error ? e.message : String(e)}
`);
    process.stdout.write("{}\n");
  }
  return 0;
}
async function runAntigravityHook(event) {
  if (event === "install") {
    for (const f of installAntigravity(resolve9(process.argv[1] ?? "gemworks.mjs"))) process.stdout.write(`${f}
`);
    return 0;
  }
  process.stdin.setEncoding("utf8");
  let text3 = "";
  for await (const chunk of process.stdin) text3 += chunk;
  try {
    process.stdout.write(runAntigravity(event ?? "", text3).stdout);
  } catch (e) {
    process.stderr.write(`gemworks antigravity: ${e instanceof Error ? e.message : String(e)}
`);
  }
  return 0;
}
function corrections(args) {
  const [sub, ...rest] = args;
  const transcripts = process.env["CLAUDE_CONFIG_DIR"] !== void 0 ? join12(process.env["CLAUDE_CONFIG_DIR"], "projects") : join12(homedir9(), ".claude", "projects");
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
    const text3 = files[0] !== void 0 ? readOrFail(files[0]) : readFileSync6(0, "utf8");
    const lines = text3.split(/\r?\n/).filter((l) => l.trim() !== "");
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
      const path = resolve9(file);
      const root = projectOf5(path);
      const r = loadStatechart(readOrFail(path), file, { resolveRef: promptResolver(path, root), readDoc: docReader(dirname2(path), root) });
      const ds = [...r.diagnostics];
      const dict = dictionaryPathOf(path);
      if (r.statechart !== void 0 && exists(dict)) {
        const own = dict === join12(dirname2(path), TOOLS_FILE);
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
      const journal = readJournal(readOrFail(resolve9(file)));
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
        const path = resolve9(scPath);
        const r = loadStatechart(readOrFail(path), scPath, { readDoc: docReader(dirname2(path), projectOf5(path)) });
        if (!r.statechart) {
          printDiagnostics(r.diagnostics);
          return 1;
        }
        sc = r.statechart;
      }
      const errors = verifyJournal(readJournal(readOrFail(resolve9(file))), sc);
      for (const e of errors) console.error(e);
      console.error(errors.length ? `${errors.length} error(s)` : "ok: chain verified");
      return errors.length ? 1 : 0;
    }
    case "export": {
      const file = rest[0];
      if (!file || file.startsWith("--")) fail(USAGE, 2);
      if (flag(rest, "--to") !== "md") fail("export: only --to md is supported", 2);
      console.log(renderJournalMarkdown(readJournal(readOrFail(resolve9(file)))));
      return 0;
    }
    case "init": {
      const template = flag(rest, "--template") ?? "coding";
      const pos = positionals("init", rest, ["--no-activate"], ["--template"]);
      if (pos.length > 1) fail(USAGE, 2);
      let r;
      try {
        r = addWorkflow(resolve9(pos[0] ?? "."), template, { activate: !has(rest, "--no-activate") });
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
      const target = arg === "checkpoint" ? "checkpoint" : Number(arg);
      if (target !== "checkpoint" && (!Number.isInteger(target) || target < 0)) fail("gemworks rollback: expected a revision number or checkpoint", 2);
      return withWorkspace((ws) => {
        const r = ws.rollback(target);
        if (!r.ok) return fail(`gemworks: ${r.reason}`, 1);
        console.log(`rev ${r.rev} restores rev ${r.restores} \xB7 state #${r.state}${r.entered.length ? ` \xB7 entered ${chain(r.entered)}` : ""}`);
        return 0;
      });
    }
    case "migrate": {
      if (positionals("migrate", rest, [], []).length > 0) fail(USAGE, 2);
      const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "");
      const moved = migrateLayout(process.cwd(), join12(homedir9(), ".gemworks", "trash", `${stamp}-layout`));
      if (moved.length === 0) {
        console.log("nothing to move: no workflow directory here");
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
else if (argv[0] === "cursor") void runCursorHook(argv[1]).then((code) => {
  process.exitCode = code;
});
else if (argv[0] === "qwen") void runQwenHook(argv[1]).then((code) => {
  process.exitCode = code;
});
else if (argv[0] === "kiro") void runKiroHook(argv[1], argv[2]).then((code) => {
  process.exitCode = code;
});
else if (argv[0] === "trae") void runTraeHook(argv[1]).then((code) => {
  process.exitCode = code;
});
else if (argv[0] === "devin") void runDevinHook(argv[1]).then((code) => {
  process.exitCode = code;
});
else if (argv[0] === "opencode") void runOpencodeHook(argv[1]).then((code) => {
  process.exitCode = code;
});
else if (argv[0] === "mcp") {
  const rest = argv.slice(1);
  if (positionals("mcp", rest, [], ["--host", "--root"]).length > 0) fail(USAGE, 2);
  void serveMcp({ root: resolve9(flag(rest, "--root") ?? "."), host: flag(rest, "--host") ?? "mcp" });
} else process.exit(main(argv));
