// The Cursor adapter: the pure reading and answering of Cursor's hook events (src/hosts/cursor/hook.ts), the install,
// then `gemworks cursor` through the bundle in a project with the dev workflow, event by event in the order Cursor
// raises them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { activeOf, hooksWith, installCursor, projectOf, projectPath } from "../dist/cursor.js";
import { callOf, denyCall, exitCodeOf, readEvent, rewriteCall } from "../dist/hosts/cursor/hook.js";
import { wrapCommand } from "../dist/hosts/codex/hook.js";
import { BUNDLE, fakeGh, gitRepo, hook, withWorkflow } from "./helpers/repo.mjs";

const WS_DEV = fileURLToPath(new URL("./fixtures/ws-dev/", import.meta.url));
// A session's start opens the GEML board: never a window from a test.
process.env.GEMWORKS_OPEN_BOARD = "0";

/** A home of its own for each test: the adapter keeps its state and the active pointer under it. */
const homeEnv = () => { const home = mkdtempSync(join(tmpdir(), "gemworks-cursor-home-")); return { HOME: home, USERPROFILE: home }; };

/** One Cursor hook event through the bundle: its answer parsed (always JSON, `{}` when there is nothing to say). */
function cursor(root, event, env = {}) {
  const r = spawnSync(process.execPath, [BUNDLE, "cursor"], {
    cwd: root, input: JSON.stringify({ conversation_id: "conv-1", generation_id: "g1", workspace_roots: [root], cursor_version: "2.9", ...event }), encoding: "utf8", env: { ...process.env, ...env }, timeout: 60_000,
  });
  assert.equal(r.status, 0, `cursor exit ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}
const project = () => {
  const root = gitRepo();
  withWorkflow(root, WS_DEV, "dev");
  return root;
};

test("Cursor's events and tools: read from JSON with a hook_event_name, an MCP call's input from its JSON string; Shell taken as Bash, a write as Write or Edit with its file_path", () => {
  assert.equal(readEvent("not json"), undefined);
  assert.equal(readEvent(JSON.stringify({ conversation_id: "c" })), undefined, "no hook_event_name");
  const mcp = readEvent(JSON.stringify({ hook_event_name: "preToolUse", tool_name: "MCP:work", tool_input: "{\"items\":[]}", workspace_roots: ["/p", 3], loop_count: 1 }));
  assert.deepEqual(mcp, { hook_event_name: "preToolUse", tool_name: "MCP:work", tool_input: { items: [] }, workspace_roots: ["/p"], loop_count: 1 });
  assert.deepEqual(callOf("Shell", { command: "npm test", working_directory: "/p" }), { tool: "Bash", input: { command: "npm test", working_directory: "/p" } });
  assert.deepEqual(callOf("Write", { path: "src/a.ts", contents: "x" }), { tool: "Write", input: { path: "src/a.ts", contents: "x", file_path: "src/a.ts" } });
  assert.deepEqual(callOf("Delete", { target_file: "src/b.ts" }).tool, "Edit");
  assert.deepEqual(callOf("MCP:status", {}), { tool: "status", input: {} });
  assert.deepEqual(callOf("Read", { file_path: "a" }), { tool: "Read", input: { file_path: "a" } });
});

test("a shell result's exit status: a number Cursor's JSON names, else the wrapper's marker, else none; the answers to preToolUse are always an object", () => {
  assert.equal(exitCodeOf(JSON.stringify({ exitCode: 2, output: "x" })), 2);
  assert.equal(exitCodeOf({ exit_code: 0 }), 0);
  assert.equal(exitCodeOf(JSON.stringify({ output: "all green\n\n[gemworks exit 0]\n" })), 0);
  assert.equal(exitCodeOf("plain text [gemworks exit 3]"), 3);
  assert.equal(exitCodeOf(JSON.stringify({ output: "a\nb" })), null);
  assert.deepEqual(denyCall("not now"), { permission: "deny", user_message: "gemworks: not now", agent_message: "gemworks: not now" });
  assert.deepEqual(rewriteCall(undefined), {});
  assert.deepEqual(rewriteCall({ command: "x" }), { updated_input: { command: "x" } });
});

test("the project: the workspace root holding a .geml/, else the first, else CURSOR_PROJECT_DIR; a path inside it is project-relative, one outside it none", () => {
  const plain = mkdtempSync(join(tmpdir(), "gemworks-cursor-a-"));
  const geml = mkdtempSync(join(tmpdir(), "gemworks-cursor-b-"));
  mkdirSync(join(geml, ".geml"));
  assert.equal(projectOf([plain, geml], {}, undefined), geml);
  assert.equal(projectOf([plain], {}, undefined), plain);
  assert.equal(projectOf([], { CURSOR_PROJECT_DIR: plain }, undefined), plain);
  assert.equal(projectOf([], {}, undefined), undefined);
  assert.equal(projectPath(geml, join(geml, "src", "a.ts")), "src/a.ts");
  assert.equal(projectPath(geml, "./src/b.ts"), "src/b.ts");
  assert.equal(projectPath(geml, join(plain, "c.ts")), undefined);
});

test("gemworks cursor install: the hooks into ~/.cursor/hooks.json beside the person's own, an earlier install's replaced; the MCP server into ~/.cursor/mcp.json", () => {
  const home = mkdtempSync(join(tmpdir(), "gemworks-cursor-install-"));
  mkdirSync(join(home, ".cursor"));
  writeFileSync(join(home, ".cursor", "hooks.json"), JSON.stringify({ version: 1, hooks: { afterFileEdit: [{ command: "./format.sh" }], stop: [{ command: "node \"/old/place/gemworks.mjs\" cursor" }] } }));
  writeFileSync(join(home, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: { other: { command: "x" } } }));
  const files = installCursor("/opt/gw/dist/gemworks.mjs", home);
  assert.deepEqual(files, [join(home, ".cursor", "hooks.json"), join(home, ".cursor", "mcp.json")]);
  const hooks = JSON.parse(readFileSync(files[0], "utf8"));
  assert.equal(hooks.version, 1);
  const ours = { command: "node \"/opt/gw/dist/gemworks.mjs\" cursor" };
  assert.deepEqual(hooks.hooks.afterFileEdit.map((h) => h.command), ["./format.sh", ours.command], "the person's own hook kept, ours after it");
  assert.deepEqual(hooks.hooks.stop.map((h) => h.command), [ours.command], "the earlier install's taken out");
  assert.deepEqual(Object.keys(hooks.hooks).sort(), ["afterAgentResponse", "afterFileEdit", "beforeSubmitPrompt", "postToolUse", "postToolUseFailure", "preToolUse", "sessionStart", "stop"]);
  // Again: the same file, nothing doubled.
  installCursor("/opt/gw/dist/gemworks.mjs", home);
  assert.deepEqual(JSON.parse(readFileSync(files[0], "utf8")), hooks);
  const mcp = JSON.parse(readFileSync(files[1], "utf8"));
  assert.deepEqual(mcp.mcpServers.other, { command: "x" });
  assert.deepEqual(mcp.mcpServers.gemworks, { command: "node", args: ["/opt/gw/dist/gemworks.mjs", "mcp", "--host", "cursor"] });
  assert.deepEqual(hooksWith({}, "c").version, 1);
});

test("gemworks cursor, in event order: the stage at the start, a refused command, a wrapped test run whose status moves the stage, the new stage reaching the model once", () => {
  const root = project();
  const gh = fakeGh();
  gh.set({ pr: "OPEN" });
  const env = { ...gh.env, ...homeEnv() };
  const start = cursor(root, { hook_event_name: "sessionStart", session_id: "conv-1", is_background_agent: false }, env);
  assert.match(start.additional_context, /^\[gemworks\] stage build · rev 0/m);
  assert.match(start.additional_context, /`note` tool of the gemworks MCP server/);
  assert.deepEqual(activeOf(env.HOME), { conversationId: "conv-1", root, at: activeOf(env.HOME).at }, "the pointer the MCP server reads");
  assert.deepEqual(cursor(root, { hook_event_name: "beforeSubmitPrompt", prompt: "hi" }, env), { continue: true }, "a prompt is never stopped");
  // A person's command, and a use fenced to another state: refused with the reason.
  const person = cursor(root, { hook_event_name: "preToolUse", tool_name: "Shell", tool_use_id: "c1", tool_input: { command: "gemworks mark reviewed", working_directory: root } }, env);
  assert.equal(person.permission, "deny");
  assert.match(person.agent_message, /^gemworks: .*for a person/);
  const fenced = cursor(root, { hook_event_name: "preToolUse", tool_name: "Shell", tool_use_id: "c2", tool_input: { command: "npx wrangler deploy --env production" } }, env);
  assert.match(fenced.user_message, /is deploy-prod, which is used only in #release; the workflow is in #build/);
  assert.equal(hook(root, { op: "status" }, env).shell.status.refusals, 2, "both refusals recorded");
  // A read tool the dictionary allows everywhere, a tool no row takes, and the adapter's own tool: through, with nothing to say.
  assert.deepEqual(cursor(root, { hook_event_name: "preToolUse", tool_name: "Read", tool_use_id: "c3", tool_input: { file_path: "README.md" } }, env), {});
  assert.deepEqual(cursor(root, { hook_event_name: "preToolUse", tool_name: "MCP:fetch", tool_use_id: "c4", tool_input: "{\"url\":\"https://x\"}" }, env), {});
  assert.deepEqual(cursor(root, { hook_event_name: "preToolUse", tool_name: "MCP:status", tool_use_id: "c5", tool_input: {} }, env), {});
  // The test command's status is evidence: the call is rewritten to print it.
  const run = cursor(root, { hook_event_name: "preToolUse", tool_name: "Shell", tool_use_id: "c6", tool_input: { command: "npm test", working_directory: root } }, env);
  const windows = process.platform === "win32";
  if (windows) assert.deepEqual(run, {}, "the wrapper is POSIX shell: on Windows the command runs as it is");
  else assert.deepEqual(run, { updated_input: { command: wrapCommand("npm test"), working_directory: root } });
  // It ran and passed: tests-pass and the open PR take the workflow to review; the model hears of the new stage with the result.
  const ran = cursor(root, { hook_event_name: "postToolUse", tool_name: "Shell", tool_use_id: "c6", tool_input: { command: windows ? "npm test" : wrapCommand("npm test") }, tool_output: JSON.stringify({ output: "> test\nall green\n\n[gemworks exit 0]\n" }), duration: 10 }, env);
  assert.match(ran.additional_context, /^\[gemworks\] stage review · rev \d/m);
  const status = hook(root, { op: "status" }, env);
  assert.equal(status.shell.status.state.id, "review");
  assert.equal(status.shell.status.vars["tests-pass"], true);
  // The next prompt: the stage is read already, so nothing waits; a result with no status says nothing.
  cursor(root, { hook_event_name: "beforeSubmitPrompt", prompt: "next" }, env);
  assert.deepEqual(cursor(root, { hook_event_name: "postToolUse", tool_name: "Shell", tool_use_id: "c7", tool_input: { command: "ls" }, tool_output: JSON.stringify({ output: "a\nb\n" }) }, env), {});
});

test("gemworks cursor answers {} and exits 0 where there is nothing to say: no workflow, no event, no project", () => {
  const bare = gitRepo();
  const env = homeEnv();
  const told = cursor(bare, { hook_event_name: "sessionStart" }, env).additional_context;
  assert.match(told, /gemworks `work` tool/, "no workflow: the start tells only the work loop");
  assert.doesNotMatch(told, /\[gemworks\] stage/);
  assert.deepEqual(cursor(bare, { hook_event_name: "preToolUse", tool_name: "Shell", tool_use_id: "c1", tool_input: { command: "gemworks mark x" } }, env), {}, "no workflow: nothing is refused");
  assert.deepEqual(cursor(bare, { hook_event_name: "beforeSubmitPrompt", prompt: "x", conversation_id: undefined, workspace_roots: [] }, env), { continue: true }, "no conversation: the prompt still goes");
  for (const input of ["not json", ""]) {
    const r = spawnSync(process.execPath, [BUNDLE, "cursor"], { cwd: bare, input, encoding: "utf8", env: { ...process.env, ...env } });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), "{}");
  }
});

test("the project's record and the work loop through Cursor's hooks: what Codex says beside a prompt reaches the model with the turn's first tool result; a file, the answer; a turn that wrote and reported nothing sent back once", async () => {
  const { logName, parseLog } = await import("../dist/core/session-log.js");
  const { recordDecisions, recordPrompt, sessionsDirOf } = await import("../dist/session-store.js");
  const { recordWork } = await import("../dist/loop.js");
  const { WORK_REMINDER } = await import("../dist/core/work.js");
  const root = gitRepo();
  const env = homeEnv();
  const log = () => parseLog(readFileSync(join(sessionsDirOf(root), logName("cursor", "conv-1")), "utf8"));
  const start = cursor(root, { hook_event_name: "sessionStart" }, env).additional_context;
  assert.match(start, /feature 新功能: mockup 样稿 \(you\) → build/, "the flows' steps");
  assert.deepEqual(log().map((e) => [e.t, e.host]), [["session", "cursor"]]);

  recordPrompt(root, "claude-code", "cc1", "另一个会话问的");
  recordDecisions(root, "claude-code", "cc1", ["合并前先跑三平台 CI"]);
  recordWork(root, "cursor", "conv-1", { items: [{ title: "看板", flow: "feature", needs: "你看样稿" }] });
  assert.deepEqual(cursor(root, { hook_event_name: "beforeSubmitPrompt", prompt: "接 Cursor" }, env), { continue: true });
  assert.match(readFileSync(join(root, ".geml", "board.geml"), "utf8"), /看板/, "the board, written at the prompt");
  // The first tool result carries it, whatever the tool; the second has nothing left to say.
  const first = cursor(root, { hook_event_name: "postToolUse", tool_name: "Read", tool_use_id: "r1", tool_input: { file_path: "README.md" }, tool_output: "{}" }, env).additional_context;
  assert.match(first, /- 合并前先跑三平台 CI（Claude · feat\/x，\d\d:\d\d）/);
  assert.match(first, /\[gemworks\] work items on the way: #\S+ «看板» \(feature: at mockup 样稿, needs 你看样稿\)/);
  assert.deepEqual(cursor(root, { hook_event_name: "postToolUse", tool_name: "Grep", tool_use_id: "r2", tool_input: {}, tool_output: "{}" }, env), {});

  // The turn writes a file inside the project and one outside it, and reports no work item of its own.
  cursor(root, { hook_event_name: "postToolUse", tool_name: "Write", tool_use_id: "w1", tool_input: { file_path: join(root, "src", "cursor-made.ts") }, tool_output: "{}" }, env);
  cursor(root, { hook_event_name: "afterFileEdit", file_path: join(root, "src", "cursor-made.ts"), edits: [] }, env);
  cursor(root, { hook_event_name: "afterFileEdit", file_path: join(tmpdir(), "elsewhere.ts"), edits: [] }, env);
  cursor(root, { hook_event_name: "afterAgentResponse", text: "接好了。" }, env);
  assert.deepEqual(cursor(root, { hook_event_name: "stop", status: "completed", loop_count: 0 }, env), { followup_message: WORK_REMINDER }, "sent back once");
  // The follow-up comes back as a prompt: the hook's words, so no prompt of the person's and the same turn; it reports its item and ends.
  cursor(root, { hook_event_name: "beforeSubmitPrompt", prompt: WORK_REMINDER }, env);
  cursor(root, { hook_event_name: "afterAgentResponse", text: "报好了。" }, env);
  assert.deepEqual(cursor(root, { hook_event_name: "stop", status: "completed", loop_count: 1 }, env), {});
  // A turn that only talked is not sent back.
  cursor(root, { hook_event_name: "beforeSubmitPrompt", prompt: "问一句" }, env);
  cursor(root, { hook_event_name: "afterAgentResponse", text: "答了。" }, env);
  assert.deepEqual(cursor(root, { hook_event_name: "stop", status: "completed", loop_count: 0 }, env), {});
  const events = log().filter((e) => e.t !== "item").map((e) => [e.t, e.turn ?? null, e.text ?? e.path ?? e.host]);
  assert.deepEqual(events, [
    ["session", null, "cursor"], ["prompt", 1, "接 Cursor"], ["file", 1, "src/cursor-made.ts"], ["answer", 1, "报好了。"], ["prompt", 2, "问一句"], ["answer", 2, "答了。"],
  ]);
});
