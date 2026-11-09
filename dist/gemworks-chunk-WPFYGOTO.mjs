#!/usr/bin/env node
import "./gemworks-chunk-WJ7B4OQ6.mjs";
import {
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
  commits,
  contextOf,
  decisionsContext,
  decisionsFor,
  decodeRequest,
  defaultPeriods,
  handleRequest,
  hostLabel,
  labelledRows,
  latestSessionOf,
  localDay,
  normalised,
  parsePeriod,
  readLedger,
  recordAnswer,
  recordDecisions,
  recordFile,
  recordPrompt,
  report,
  reportText,
  runVerb,
  unlabelledPrompts,
  useWorkflow
} from "./gemworks-chunk-P6S4V45Y.mjs";
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
  readText,
  realPath
} from "./gemworks-chunk-SXXU2DVO.mjs";

// src/cli.ts
import { readFileSync as readFileSync4 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { basename, dirname as dirname2, join as join5, relative, resolve as resolve3, sep } from "node:path";

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
function readEvent(text2) {
  let v;
  try {
    v = JSON.parse(text2);
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
    ...str("last_assistant_message") !== void 0 ? { last_assistant_message: str("last_assistant_message") } : {}
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

// src/codex.ts
var NOTHING = { stdout: "", code: 0 };
function stateFileFor(env, session) {
  const dir = env["PLUGIN_DATA"] !== void 0 && env["PLUGIN_DATA"] !== "" ? env["PLUGIN_DATA"] : join2(tmpdir(), "gemworks-codex");
  return join2(dir, `${session.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
}
function readState(file) {
  try {
    const v = JSON.parse(readFileSync(file, "utf8"));
    return { delivered: typeof v.delivered === "string" ? v.delivered : null, decisionsSeen: typeof v.decisionsSeen === "string" ? v.decisionsSeen : null, committed: v.committed === true };
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
      const res = await ask({ op: "status" });
      if (!res.ok || res.shell.status === null) return NOTHING;
      const fresh = await ask({ op: "refresh" });
      return out(deliver("SessionStart", (fresh.ok ? fresh.shell.status : null) ?? res.shell.status, true));
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
      const res = await ask({ op: "status" });
      const stage = res.ok && res.shell.status !== null ? deliver("UserPromptSubmit", res.shell.status) : void 0;
      if (shared === void 0) return out(stage);
      const before = stage?.hookSpecificOutput.additionalContext;
      return out(contextFor("UserPromptSubmit", before !== void 0 ? `${before}

${shared}` : shared));
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
    // The turn's end: its answer, and the commits a command in it made, into the record. Nothing is said back.
    case "Stop": {
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
  let text2;
  try {
    text2 = readFileSync2(path, "utf8");
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
  const file = join3(stateDir(home), `${cid.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
  const state = readJson(file, { lastPromptStep: -1, decisionsSeen: null, committed: false });
  const save = () => writeJson(file, state);
  const out2 = (o) => ({ stdout: `${JSON.stringify(o)}
` });
  writeJson(join3(stateDir(home), "active.json"), { conversationId: cid, root, at: now });
  switch (event) {
    case "SessionStart": {
      appendSession(root, ANTIGRAVITY_HOST, cid, () => [], now);
      return out2({ injectSteps: [{ systemMessage: { systemMessage: SESSIONS_PROMPT.replace("gemworks `note` tool", "`note` tool of the gemworks MCP server") } }] });
    }
    case "PreInvocation": {
      const asked = promptsAfter(stepsOf(transcript), state.lastPromptStep);
      if (asked.length === 0) return { stdout: "" };
      for (const p of asked) recordPrompt(root, ANTIGRAVITY_HOST, cid, p.text, now);
      state.lastPromptStep = asked[asked.length - 1].step;
      const fresh = decisionsFor(root, cid, state.decisionsSeen, now);
      state.decisionsSeen = now;
      save();
      if (fresh.length === 0) return { stdout: "" };
      return out2({ injectSteps: [{ ephemeralMessage: decisionsContext(fresh, (d) => `${hostLabel(d.host)}${d.branch !== void 0 ? ` \xB7 ${d.branch}` : ""}\uFF0C${new Date(d.at).toTimeString().slice(0, 5)}`) }] });
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

// src/mcp.ts
import { existsSync, readFileSync as readFileSync3 } from "node:fs";
import { isAbsolute as isAbsolute2, join as join4 } from "node:path";
import { createInterface } from "node:readline";
function packageVersion() {
  try {
    return JSON.parse(readFileSync3(new URL("../package.json", import.meta.url), "utf8")).version;
  } catch {
    return "unknown";
  }
}
var PROTOCOLS = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"];
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
  const spaces = t["workspaces"] !== null && typeof t["workspaces"] === "object" && !Array.isArray(t["workspaces"]) ? Object.keys(t["workspaces"]).filter(isAbsolute2) : [];
  const root = spaces.find((p) => existsSync(join4(p, ".geml"))) ?? spaces[0];
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
    return result(id, { protocolVersion: version, capabilities: { tools: {} }, serverInfo: { name: "gemworks", version: packageVersion() } });
  }
  if (method === "ping") return result(id, {});
  if (method === "tools/list") return result(id, { tools: [...FLOW_TOOLS.map(({ name: name2, description, inputSchema }) => ({ name: name2, description, inputSchema })), { name: NOTE_TOOL.name, description: NOTE_TOOL.description, inputSchema: NOTE_TOOL.inputSchema }] });
  if (method !== "tools/call") return failure(id, -32601, `method not found: ${method}`);
  const name = m?.params?.["name"];
  const active = o.host === ANTIGRAVITY_HOST ? activeOf() : void 0;
  const codex = codexTurnOf(m?.params);
  const root = active?.root ?? codex.root ?? o.root;
  if (name === NOTE_TOOL.name) {
    const given = m?.params?.["arguments"]?.decisions;
    const decisions = Array.isArray(given) ? given.filter((d) => typeof d === "string") : [];
    try {
      const session = active?.conversationId ?? codex.session ?? latestSessionOf(root, o.host) ?? `mcp-${process.pid}`;
      const n = recordDecisions(root, o.host, session, decisions);
      return text(id, n === 0 ? "Nothing recorded: decisions is a list of short sentences." : `Recorded ${n} decision${n === 1 ? "" : "s"}; the project's other sessions will see ${n === 1 ? "it" : "them"}.`, n === 0);
    } catch (e) {
      return text(id, `gemworks: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  }
  const spec = FLOW_TOOLS.find((t) => t.name === name);
  if (spec === void 0) return failure(id, -32602, `unknown tool: ${String(name)}`);
  const raw = m?.params?.["arguments"];
  const args = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  try {
    const opened = openWorkspace({ root, tools: Object.hasOwn(HOST_TOOLS, o.host) ? HOST_TOOLS[o.host] : NO_TOOLS, gh: ghOncePerBranch() });
    if (!opened.ok) return text(id, `gemworks: ${opened.reason}`, true);
    if (spec.name === "status") opened.ws.refresh({ reread: false });
    const a = runVerb(opened.ws, spec.name, args);
    return text(id, spec.name === "status" ? withNote(a.text) : a.context !== void 0 ? `${a.text}

${withNote(a.context)}` : a.text, !a.ok);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return text(id, message.startsWith("gemworks:") ? message : `gemworks: ${message}`, true);
  }
}
function serveMcp(o) {
  const rl = createInterface({ input: process.stdin });
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
      const reply = await answer(msg, o);
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
  const workflowDir = dirname2(flowPath);
  if (basename(flowPath).toLowerCase() !== FLOW_FILE && basename(workflowDir) === "workflows" && basename(dirname2(workflowDir)) === GEML_DIR) {
    const home = dirname2(dirname2(workflowDir));
    return realPath(homeOf(process.cwd())) === realPath(home) ? process.cwd() : home;
  }
  const above = resolve3(workflowDir, "..", "..", "..");
  return resolve3(above, WORKFLOWS_DIR, basename(workflowDir)) === workflowDir ? above : process.cwd();
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
  const transcripts = process.env["CLAUDE_CONFIG_DIR"] !== void 0 ? join5(process.env["CLAUDE_CONFIG_DIR"], "projects") : join5(homedir2(), ".claude", "projects");
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
    for (const p of unlabelledPrompts(readLedger(), transcripts, { limit, ...since2 !== void 0 ? { since: since2 } : {} })) console.log(JSON.stringify(p));
    return 0;
  }
  if (sub === "label") {
    const files = positionals("corrections label", rest, ["--import"], []);
    if (files.length > 1) fail(USAGE, 2);
    const text2 = files[0] !== void 0 ? readOrFail(files[0]) : readFileSync4(0, "utf8");
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
      const r = loadStatechart(readOrFail(path), file, { resolveRef: promptResolver(path, root), readDoc: docReader(dirname2(path), root) });
      const ds = [...r.diagnostics];
      const dict = dictionaryPathOf(path);
      if (r.statechart !== void 0 && exists(dict)) {
        const own = dict === join5(dirname2(path), TOOLS_FILE);
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
        const r = loadStatechart(readOrFail(path), scPath, { readDoc: docReader(dirname2(path), projectOf(path)) });
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
      const moved = migrateLayout(process.cwd(), join5(homedir2(), ".gemworks", "trash", `${stamp}-layout`));
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
