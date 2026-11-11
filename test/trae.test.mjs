// The TRAE adapter: how TRAE's tools are read, the install, then `gemworks trae` through the bundle in a project with
// the dev workflow, event by event in the order TRAE raises them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { callOf, hooksWith, installTrae, mcpEntry, projectOf } from "../dist/trae.js";
import { mcpRootOf } from "../dist/hooked.js";
import { wrapCommand } from "../dist/hosts/codex/hook.js";
import { BUNDLE, fakeGh, gitRepo, hook, withWorkflow } from "./helpers/repo.mjs";

const WS_DEV = fileURLToPath(new URL("./fixtures/ws-dev/", import.meta.url));
// A session's start opens the GEML board: never a window from a test.
process.env.GEMWORKS_OPEN_BOARD = "0";

const homeEnv = () => { const home = mkdtempSync(join(tmpdir(), "gemworks-trae-home-")); return { HOME: home, USERPROFILE: home }; };

/** One TRAE hook event through the bundle: its answer parsed, null when it said nothing. */
function trae(root, event, env = {}) {
  const r = spawnSync(process.execPath, [BUNDLE, "trae"], {
    cwd: root, input: JSON.stringify({ session_id: "s-1", cwd: root, workspace_roots: [root], ...event }), encoding: "utf8", env: { ...process.env, TRAE_PROJECT_DIR: root, ...env }, timeout: 60_000,
  });
  assert.equal(r.status, 0, `trae exit ${r.status}: ${r.stderr}`);
  return r.stdout.trim() === "" ? null : JSON.parse(r.stdout);
}
const project = () => {
  const root = gitRepo();
  withWorkflow(root, WS_DEV, "dev");
  return root;
};

test("TRAE's tools: RunCommand taken as Bash, the writers with their file_path, the rest by their own (Claude Code's) names, an MCP tool bare; the project is the workspace root holding a .geml/", () => {
  assert.deepEqual(callOf("RunCommand", { command: "npm test" }), { tool: "Bash", input: { command: "npm test" } });
  assert.deepEqual(callOf("Write", { file_path: "a.ts", content: "x" }), { tool: "Write", input: { file_path: "a.ts", content: "x" } });
  assert.deepEqual(callOf("Edit", { path: "a.ts" }), { tool: "Edit", input: { path: "a.ts", file_path: "a.ts" } });
  assert.equal(callOf("Read", { file_path: "a" }).tool, "Read");
  assert.equal(callOf("LS", {}).tool, "LS");
  assert.equal(callOf("mcp__Git__git_status", {}).tool, "git_status");
  const root = project();
  const other = mkdtempSync(join(tmpdir(), "gemworks-trae-other-"));
  assert.equal(projectOf([other, root], {}, other), root);
  assert.equal(projectOf([], { TRAE_PROJECT_DIR: other }, "/x"), other);
  assert.equal(projectOf([], {}, undefined), undefined);
});

test("gemworks trae install: the hooks into the hooks.json of each TRAE build that is there (both when neither is), beside the person's own, an earlier install's replaced; the MCP entry printed to add by hand; a file that is no plain JSON leaves all alone", () => {
  const home = mkdtempSync(join(tmpdir(), "gemworks-trae-install-"));
  assert.deepEqual(installTrae("/opt/gw/dist/gemworks.mjs", home), [join(home, ".trae", "hooks.json"), join(home, ".trae-cn", "hooks.json")], "neither there: both");
  const cnOnly = mkdtempSync(join(tmpdir(), "gemworks-trae-install-cn-"));
  mkdirSync(join(cnOnly, ".trae-cn"));
  const file = join(cnOnly, ".trae-cn", "hooks.json");
  writeFileSync(file, JSON.stringify({ version: 1, hooks: { PreToolUse: [{ matcher: "RunCommand", hooks: [{ type: "command", command: "python3 ./validate.py" }] }], Stop: [{ hooks: [{ type: "command", command: "node \"/old/gemworks.mjs\" trae" }] }] } }));
  assert.deepEqual(installTrae("/opt/gw/dist/gemworks.mjs", cnOnly), [file], "the China build alone");
  const written = JSON.parse(readFileSync(file, "utf8"));
  const ours = { hooks: [{ type: "command", command: "node \"/opt/gw/dist/gemworks.mjs\" trae", timeout: 30 }] };
  assert.equal(written.version, 1);
  assert.deepEqual(written.hooks.PreToolUse, [{ matcher: "RunCommand", hooks: [{ type: "command", command: "python3 ./validate.py" }] }, ours]);
  assert.deepEqual(written.hooks.Stop, [ours]);
  assert.deepEqual(Object.keys(written.hooks).sort(), ["PostToolUse", "PreToolUse", "SessionStart", "Stop", "UserPromptSubmit"]);
  installTrae("/opt/gw/dist/gemworks.mjs", cnOnly);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), written, "again: nothing doubled");
  assert.equal(Object.keys(hooksWith({}, "c").hooks).length, 5);
  assert.deepEqual(mcpEntry("/b.mjs"), { mcpServers: { gemworks: { command: "node", args: ["/b.mjs", "mcp", "--host", "trae"] } } });
  writeFileSync(file, "{ // mine\n}\n");
  assert.throws(() => installTrae("/opt/gw/dist/gemworks.mjs", cnOnly), /not plain JSON/);
  const r = spawnSync(process.execPath, [BUNDLE, "trae", "install"], { encoding: "utf8", env: { ...process.env, HOME: home, USERPROFILE: home } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Settings → MCP/);
  assert.match(r.stdout, /"--host",\s+"trae"/);
});

test("gemworks trae, in event order: the stage at the start, a refused command, a wrapped test run whose status moves the stage; the MCP server's project the hooks' when its own folder has none", () => {
  const root = project();
  const gh = fakeGh();
  gh.set({ pr: "OPEN" });
  const env = { ...gh.env, ...homeEnv() };
  const start = trae(root, { hook_event_name: "SessionStart", source: "startup" }, env);
  assert.match(start.hookSpecificOutput.additionalContext, /^\[gemworks\] stage build · rev 0/m);
  const refused = trae(root, { hook_event_name: "PreToolUse", tool_use_id: "c1", tool_name: "RunCommand", llm_tool_name: "RunCommand", tool_input: { command: "gemworks mark reviewed" } }, env);
  assert.equal(refused.hookSpecificOutput.permissionDecision, "deny");
  assert.match(refused.hookSpecificOutput.permissionDecisionReason, /^gemworks: .*for a person/);
  assert.equal(trae(root, { hook_event_name: "PreToolUse", tool_use_id: "c2", tool_name: "Read", tool_input: { file_path: join(root, "README.md") } }, env), null);
  assert.equal(trae(root, { hook_event_name: "PreToolUse", tool_use_id: "c3", tool_name: "mcp__gemworks__status", tool_input: {} }, env), null);
  const run = trae(root, { hook_event_name: "PreToolUse", tool_use_id: "c4", tool_name: "RunCommand", tool_input: { command: "npm test", cwd: root } }, env);
  const windows = process.platform === "win32";
  if (windows) assert.equal(run, null);
  else assert.deepEqual(run.hookSpecificOutput, { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "gemworks", updatedInput: { command: wrapCommand("npm test"), cwd: root } });
  const command = windows ? "npm test" : wrapCommand("npm test");
  const ran = trae(root, { hook_event_name: "PostToolUse", tool_use_id: "c4", tool_name: "RunCommand", tool_input: { command }, tool_response: { output: windows ? "all green\nExit Code: 0" : "all green\n[gemworks exit 0]" } }, env);
  assert.match(ran.hookSpecificOutput.additionalContext, /^\[gemworks\] stage review · rev \d/m);
  assert.equal(hook(root, { op: "status" }, env).shell.status.state.id, "review");
  const outside = mkdtempSync(join(tmpdir(), "gemworks-trae-mcp-"));
  assert.equal(mcpRootOf("trae", outside, env.HOME).session, "s-1");
  assert.equal(mcpRootOf("trae", root, env.HOME), undefined);
});

test("the record and the work loop through TRAE's hooks: each prompt a turn; a written file; a turn that wrote and reported nothing sent back once, and not again on the retry", async () => {
  const { logName, parseLog } = await import("../dist/core/session-log.js");
  const { sessionsDirOf } = await import("../dist/session-store.js");
  const { WORK_REMINDER } = await import("../dist/core/work.js");
  const root = gitRepo();
  const env = homeEnv();
  const log = () => parseLog(readFileSync(join(sessionsDirOf(root), logName("trae", "s-1")), "utf8"));
  trae(root, { hook_event_name: "SessionStart", source: "startup" }, env);
  trae(root, { hook_event_name: "UserPromptSubmit", prompt: "接 TRAE" }, env);
  trae(root, { hook_event_name: "PostToolUse", tool_use_id: "w1", tool_name: "Write", tool_input: { file_path: join(root, "src", "trae-made.ts") }, tool_response: {} }, env);
  assert.deepEqual(trae(root, { hook_event_name: "Stop", stop_hook_active: false, loop_count: 0, last_assistant_message: "接好了。" }, env), { decision: "block", reason: WORK_REMINDER });
  assert.equal(trae(root, { hook_event_name: "Stop", stop_hook_active: true, loop_count: 1, last_assistant_message: "报好了。" }, env), null);
  assert.deepEqual(log().filter((e) => e.t !== "item").map((e) => [e.t, e.text ?? e.path ?? e.host]), [["session", "trae"], ["prompt", "接 TRAE"], ["file", "src/trae-made.ts"], ["answer", "报好了。"]]);
});
