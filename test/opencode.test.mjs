// The OpenCode adapter: how OpenCode's tools are read (src/hosts/opencode/hook.ts), the install, `gemworks opencode`
// through the bundle in a project with the dev workflow, and the plugin itself, loaded the way OpenCode loads it and
// driven through its hooks with a stand-in for OpenCode's context.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installOpencode, pluginsDir, readRequest } from "../dist/opencode.js";
import { bareTool, callOf, exitCodeOf, writes } from "../dist/hosts/opencode/hook.js";
import { wrapCommand } from "../dist/hosts/codex/hook.js";
import { BUNDLE, fakeGh, gitRepo, hook, withWorkflow } from "./helpers/repo.mjs";

const WS_DEV = fileURLToPath(new URL("./fixtures/ws-dev/", import.meta.url));
// A session's start opens the GEML board: never a window from a test.
process.env.GEMWORKS_OPEN_BOARD = "0";

/** A home of its own for each test: the adapter keeps its state under it. */
const homeEnv = () => { const home = mkdtempSync(join(tmpdir(), "gemworks-opencode-home-")); return { HOME: home, USERPROFILE: home }; };

/** One request of the plugin through the bundle: its answer parsed, null when it said nothing. */
function opencode(root, event, env = {}, session = "s-1") {
  const r = spawnSync(process.execPath, [BUNDLE, "opencode"], { cwd: root, input: JSON.stringify({ session, root, event }), encoding: "utf8", env: { ...process.env, ...env }, timeout: 60_000 });
  assert.equal(r.status, 0, `opencode exit ${r.status}: ${r.stderr}`);
  return r.stdout.trim() === "" ? null : JSON.parse(r.stdout);
}
const project = () => {
  const root = gitRepo();
  withWorkflow(root, WS_DEV, "dev");
  return root;
};

test("OpenCode's tools: shell taken as Bash, write, edit and patch as Write or Edit with their file, the readers by Claude Code's names, an MCP tool bare; a shell result's exit status", () => {
  assert.deepEqual(callOf("shell", { command: "npm test", workdir: "/p" }), { tool: "Bash", input: { command: "npm test", workdir: "/p" } });
  assert.deepEqual(callOf("write", { path: "src/a.ts", content: "x" }), { tool: "Write", input: { path: "src/a.ts", content: "x", file_path: "src/a.ts" } });
  assert.equal(callOf("edit", { path: "a" }).tool, "Edit");
  const patchText = "*** Begin Patch\n*** Update File: src/a.ts\n@@\n-x\n+y\n*** Add File: src/b.ts\n+z\n*** End Patch";
  assert.deepEqual(writes("patch", { patchText }), ["src/a.ts", "src/b.ts"]);
  assert.deepEqual(callOf("patch", { patchText }), { tool: "Edit", input: { patchText, file_path: "src/a.ts" } });
  assert.deepEqual(writes("read", { path: "a" }), []);
  assert.deepEqual(callOf("read", { path: "a" }), { tool: "Read", input: { path: "a", file_path: "a" } });
  assert.equal(callOf("subagent", {}).tool, "Task");
  assert.equal(callOf("fetch.fetch_url", {}).tool, "fetch_url");
  assert.equal(bareTool("gemworks.work"), "work");
  assert.equal(bareTool("shell"), "shell");
  assert.equal(exitCodeOf({ output: { exit: 2, output: "boom", truncated: false }, content: [] }), 2);
  assert.equal(exitCodeOf({ output: { exit: 1, output: "x\n[gemworks exit 0]" } }), 0, "the wrapper's marker first");
  assert.equal(exitCodeOf({ output: { output: "", status: "running", truncated: false } }), null, "a background command");
  assert.equal(exitCodeOf(undefined), null);
});

test("the plugin's requests: read with a session, a root and an event of a known kind; a prompt always the person's", () => {
  assert.equal(readRequest("not json"), undefined);
  assert.equal(readRequest(JSON.stringify({ session: "s", root: "/p", event: { kind: "nope" } })), undefined);
  assert.equal(readRequest(JSON.stringify({ session: "s", root: "/p", event: { kind: "before" } })), undefined, "a call with no tool");
  assert.deepEqual(readRequest(JSON.stringify({ session: "s", root: "/p", event: { kind: "prompt", words: "hi" } })).event, { kind: "prompt", personal: true, words: "hi" });
  assert.deepEqual(readRequest(JSON.stringify({ session: "s", root: "/p", event: { kind: "after", tool: "shell", callId: "c", failed: true } })).event, { kind: "after", tool: "shell", input: {}, failed: true, response: undefined, callId: "c" });
});

test("gemworks opencode install: the plugin into OpenCode's global plugins folder, under XDG_CONFIG_HOME when it is set, running this Node on the bundle; again, the same files", () => {
  const home = mkdtempSync(join(tmpdir(), "gemworks-opencode-install-"));
  assert.equal(pluginsDir({}, home), join(home, ".config", "opencode", "plugins"));
  assert.equal(pluginsDir({ XDG_CONFIG_HOME: join(home, "xdg") }, home), join(home, "xdg", "opencode", "plugins"));
  const files = installOpencode("/opt/gw/dist/gemworks.mjs", "/usr/bin/node", {}, home);
  const dir = join(home, ".config", "opencode", "plugins", "gemworks");
  assert.deepEqual(files, [join(dir, "index.js"), join(dir, "package.json")]);
  const source = readFileSync(files[0], "utf8");
  assert.match(source, /const NODE = "\/usr\/bin\/node";/);
  assert.match(source, /const BUNDLE = "\/opt\/gw\/dist\/gemworks.mjs";/);
  assert.deepEqual(JSON.parse(readFileSync(files[1], "utf8")).exports, { ".": "./index.js" });
  assert.equal(spawnSync(process.execPath, ["--check", files[0]], { encoding: "utf8" }).status, 0, "the plugin parses");
  installOpencode("/opt/gw/dist/gemworks.mjs", "/usr/bin/node", {}, home);
  assert.equal(readFileSync(files[0], "utf8"), source);
  const r = spawnSync(process.execPath, [BUNDLE, "opencode", "install"], { encoding: "utf8", env: { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: "" } });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(dir, "index.js")));
});

test("gemworks opencode, in event order: the stage at the start, a refused command, a wrapped test run whose status moves the stage, the new stage reaching the model once", () => {
  const root = project();
  const gh = fakeGh();
  gh.set({ pr: "OPEN" });
  const env = { ...gh.env, ...homeEnv() };
  const start = opencode(root, { kind: "start", source: "startup" }, env);
  assert.equal(start.kind, "context");
  assert.match(start.text, /^\[gemworks\] stage build · rev 0/m);
  assert.match(start.text, /`note` tool of the gemworks MCP server/);
  const person = opencode(root, { kind: "before", tool: "shell", callId: "c1", input: { command: "gemworks mark reviewed" } }, env);
  assert.equal(person.kind, "deny");
  assert.match(person.reason, /for a person/);
  assert.equal(opencode(root, { kind: "before", tool: "read", callId: "c2", input: { path: join(root, "README.md") } }, env), null);
  assert.equal(opencode(root, { kind: "before", tool: "gemworks.status", callId: "c3", input: {} }, env), null);
  const run = opencode(root, { kind: "before", tool: "shell", callId: "c4", input: { command: "npm test", timeout: 60000 } }, env);
  const windows = process.platform === "win32";
  if (windows) assert.equal(run, null, "the wrapper is POSIX shell: on Windows the command runs as it is");
  else assert.deepEqual(run, { kind: "allow", input: { command: wrapCommand("npm test"), timeout: 60000 } });
  const command = windows ? "npm test" : wrapCommand("npm test");
  const ran = opencode(root, { kind: "after", tool: "shell", callId: "c4", input: { command }, failed: false, response: { output: { exit: 0, output: "all green", truncated: false }, content: [{ type: "text", text: "all green" }] } }, env);
  assert.equal(ran.kind, "context");
  assert.match(ran.text, /^\[gemworks\] stage review · rev \d/m);
  const status = hook(root, { op: "status" }, env);
  assert.equal(status.shell.status.state.id, "review");
  assert.equal(status.shell.status.vars["tests-pass"], true);
});

test("the plugin, loaded as OpenCode loads it: the MCP server registered; the start and the turn in every model request's system part; a refused call rejected; a turn that wrote and reported nothing sent back once by a synthetic message", async () => {
  const { WORK_REMINDER } = await import("../dist/core/work.js");
  const { logName, parseLog } = await import("../dist/core/session-log.js");
  const { sessionsDirOf } = await import("../dist/session-store.js");
  const root = project();
  const env = homeEnv();
  // The plugin's own `gemworks opencode` runs inherit this process's environment: its home is the test's.
  Object.assign(process.env, env);
  const [index] = installOpencode(BUNDLE, process.execPath, {}, env.HOME);
  const plugin = (await import(pathToFileURL(index).href)).default;
  assert.equal(plugin.id, "gemworks");
  const hooks = {};
  const servers = {};
  const synthetic = [];
  const register = (domain) => async (name, callback) => { hooks[`${domain}.${name}`] = callback; return { dispose: async () => {} }; };
  await plugin.setup({
    location: { directory: root },
    mcp: { transform: async (f) => { f({ set: (name, config) => { servers[name] = config; } }); return { dispose: async () => {} }; } },
    session: { hook: register("session"), synthetic: async (input) => { synthetic.push(input); } },
    tool: { hook: register("tool") },
  });
  assert.deepEqual(servers.gemworks, { type: "local", command: [process.execPath, BUNDLE, "mcp", "--host", "opencode"], cwd: root });
  assert.deepEqual(Object.keys(hooks).sort(), ["session.context", "session.experimental.idle", "session.prompt", "tool.execute.after", "tool.execute.before"]);

  // A session OpenCode has not prompted yet: nothing added.
  const none = { sessionID: "ses_1", system: [] };
  await hooks["session.context"](none);
  assert.deepEqual(none.system, []);
  await hooks["session.prompt"]({ sessionID: "ses_1", messageID: "m1", prompt: { text: "接 OpenCode" }, delivery: "steer" });
  const request = { sessionID: "ses_1", system: [{ type: "text", text: "OpenCode's own" }] };
  await hooks["session.context"](request);
  assert.equal(request.system[0].text, "OpenCode's own");
  assert.match(request.system.slice(1).map((p) => p.text).join("\n"), /\[gemworks\] stage build · rev 0/);
  assert.ok(request.system.slice(1).every((p) => p.type === "text"));

  // Refused: the hook rejects, which OpenCode hands the model as the tool's error.
  await assert.rejects(hooks["tool.execute.before"]({ tool: "shell", sessionID: "ses_1", id: "c1", input: { command: "gemworks mark reviewed" } }), /^Error: gemworks: .*for a person/);
  // Through: a read, unchanged.
  const read = { tool: "read", sessionID: "ses_1", id: "c2", input: { path: "README.md" } };
  await hooks["tool.execute.before"](read);
  assert.deepEqual(read.input, { path: "README.md" });

  // A write, and the turn reports nothing: the idle session is sent back once, by a synthetic message.
  await hooks["tool.execute.after"]({ tool: "write", sessionID: "ses_1", id: "w1", input: { path: join(root, "src", "oc-made.ts") }, status: "completed", result: { content: [{ type: "text", text: "Wrote it." }] } });
  await hooks["session.experimental.idle"]({ sessionID: "ses_1", background: [] });
  assert.deepEqual(synthetic, [{ sessionID: "ses_1", text: WORK_REMINDER }]);
  await hooks["session.experimental.idle"]({ sessionID: "ses_1", background: [] });
  assert.equal(synthetic.length, 1, "once a turn");
  const log = parseLog(readFileSync(join(sessionsDirOf(root), logName("opencode", "ses_1")), "utf8"));
  assert.deepEqual(log.filter((e) => e.t !== "item").map((e) => [e.t, e.text ?? e.path ?? e.host]), [["session", "opencode"], ["prompt", "接 OpenCode"], ["file", "src/oc-made.ts"]], "OpenCode's idle hook gives no answer to record");
});
