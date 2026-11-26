// DeepSeek Harness, the parts around the supervisor (src/hosts/dsh/plugin.ts): a turn into the project's shared
// record as the loop drives it (the person's words, the streamed answer, the files written, the commits made), the
// board's routes on requests they cannot read, and a workflow that does not check out or no longer fits its journal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { agentEvents } from "@deepseek-ai/dsh-agent";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { world } from "../helpers/harness.mjs";
import { flowDoc } from "../helpers/flow.mjs";
import { attach, boardApi, dshParameters, recordSession } from "../../dist/hosts/dsh/plugin.js";
import { readJournal } from "../../dist/core/journal.js";
import { logName, parseLog } from "../../dist/core/session-log.js";
import { recordDecisions, recordPrompt, sessionsDirOf } from "../../dist/store/sessions.js";

const FLOW = readFileSync(new URL("../fixtures/refund.geml", import.meta.url), "utf8");
const TOOLS = readFileSync(new URL("../fixtures/refund-tools.geml", import.meta.url), "utf8");
delete process.env.GEMWORKS_STATECHART;

function putWorkflow(dir, text = FLOW) {
  const file = join(dir, ".geml", "workflows", "refund", "flow.geml");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  writeFileSync(join(dirname(file), "tools.geml"), TOOLS);
  return file;
}

/** A tool of this host's own shape, registered beside the world's: `write` takes a path, `bash` a command. */
function hostTool(w, name, execute = async () => "ok") {
  const parameters = name === "bash" ? { command: { type: "string", description: "the command" } } : { path: { type: "string", description: "the file" }, content: { type: "string", description: "its text" } };
  w.ctx.tools.register(defineTool({ name, description: `The ${name} tool.`, parameters, output: { schema: { type: "string" }, render: (_a, v) => [{ type: "text", text: v }] }, execute }));
}

function captureLog(w) {
  const lines = [];
  w.ctx.logger.exporter({ levels: { default: 3 }, export: (m) => { if (m.name === "gemworks") lines.push(`${m.type}: ${m.args.join(" ")}`); } });
  return lines;
}

/** One request to the board's routes, the way node:http would hand it over: the body as the given chunks. */
function request(api, method, url, chunks = []) {
  return new Promise((resolve) => {
    const req = Object.assign(Readable.from(chunks), { method, url, headers: {} });
    let code = 0;
    let text = "";
    const res = { writeHead: (c) => { code = c; }, end: (t) => { text += t ?? ""; resolve({ code, body: JSON.parse(text) }); } };
    void api(req, res);
  });
}

/** A real agent whose working directory is `dir` (a git repository here), on a context of its own. */
async function agentIn(dir, id) {
  const { Context } = await import("@deepseek-ai/cordis");
  const { mountAgentLoopTestDependencies, mountAgentLoopTestHarness } = await import("@deepseek-ai/dsh-agent-loop-testkit");
  const { SessionId } = await import("@deepseek-ai/dsh-session");
  const { brandString } = await import("@deepseek-ai/dsh-brand");
  const ctx = new Context();
  await mountAgentLoopTestDependencies(ctx);
  const harness = await mountAgentLoopTestHarness(ctx);
  const agent = await harness.create(SessionId(id), {}, { cwd: dir });
  let n = 0;
  const call = (name, args) => ctx.tools.execute({ callId: brandString(`c${++n}`), name, arguments: args, agent, signal: new AbortController().signal });
  return { ctx, agent, dir, call, dispose: () => ctx.root.fiber.dispose() };
}

const logOf = (w) => parseLog(readFileSync(join(sessionsDirOf(w.dir), logName("dsh", String(w.agent.id))), "utf8"));

test("a turn into the record as the loop drives it: the person's words once per turn, the streamed text as its answer, the files the write tool wrote; a turn with nothing to say records nothing", async () => {
  const w = await world();
  try {
    hostTool(w, "write");
    recordSession(w.agent);
    const ev = agentEvents(w.ctx, w.agent);
    const signal = new AbortController().signal;
    const step = (turn, messages) => ev.waterfall("agent/pre-step", { turn, step: 0, messages, signal }, () => Promise.resolve({ kind: "enter", messages: [] }));
    const said = { source: { kind: "user" }, content: [{ type: "text", text: "改个文件" }, { type: "image" }] };
    await step(1, [said, { source: { kind: "assistant" }, content: [{ type: "text", text: "不是人说的" }] }]);
    await step(1, [said]);
    ev.emit("agent/assistant-stream", { frame: { type: "start" } });
    ev.emit("agent/assistant-stream", { frame: { type: "chunk", chunk: { type: "reasoning-delta", text: "想想" } } });
    ev.emit("agent/assistant-stream", { frame: { type: "chunk", chunk: { type: "text-delta", text: "改好了" } } });
    assert.equal((await w.call("write", { path: join(w.dir, "notes", "a.md"), content: "x" })).isError, false);
    assert.equal((await w.call("write", "not an object")).isError, true, "the host turns away arguments that are no object");
    assert.equal((await w.call("write", { path: join(dirname(w.dir), "elsewhere.md") })).isError, false);
    await ev.serial("agent/turn-stopping", { turn: 1, signal });
    await step(2, []);
    await ev.serial("agent/turn-stopping", { turn: 2, signal });
    assert.deepEqual(logOf(w).map((e) => [e.t, e.text ?? e.path ?? e.host]), [["session", "dsh"], ["prompt", "改个文件"], ["file", "notes/a.md"], ["answer", "改好了"]]);
  } finally {
    await w.dispose();
  }
});

test("a command that commits: the commits made since the prompt go into the record as the turn closes, with the branch", async () => {
  const { gitRepo } = await import("../helpers/repo.mjs");
  const repo = gitRepo();
  const w = await agentIn(repo, "commit-1");
  const agent = w.agent;
  try {
    hostTool(w, "bash");
    recordSession(agent);
    const ev = agentEvents(w.ctx, agent);
    const signal = new AbortController().signal;
    await ev.waterfall("agent/pre-step", { turn: 1, step: 0, messages: [{ source: { kind: "user" }, content: [{ type: "text", text: "提交" }] }], signal }, () => Promise.resolve({ kind: "enter", messages: [] }));
    const date = "2099-01-01T00:00:00Z";
    const made = spawnSync("git", ["-C", repo, "commit", "-q", "--allow-empty", "-m", "add the board"], { encoding: "utf8", env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
    assert.equal(made.status, 0, made.stderr);
    const r = await w.call("bash", { command: "git commit -m 'add the board'" });
    assert.equal(r.isError, false);
    await ev.serial("agent/turn-stopping", { turn: 1, signal });
    const events = parseLog(readFileSync(join(sessionsDirOf(repo), logName("dsh", "commit-1")), "utf8"));
    // git dates to the second: the repository's first commit, made the same second as the prompt, may come along too.
    const commit = events.find((e) => e.t === "commit" && e.subject === "add the board");
    assert.deepEqual([commit?.subject, commit?.branch], ["add the board", "feat/x"]);
    assert.equal(events.some((e) => e.t === "answer"), false, "nothing was said: no answer");
  } finally {
    await w.dispose();
  }
});

test("gemworks_note with no decision and a loop tool that records nothing fail with why; the other sessions' decisions name their branch", async () => {
  const { gitRepo } = await import("../helpers/repo.mjs");
  const repo = gitRepo();
  const w = await agentIn(repo, "note-1");
  const { agent, call } = w;
  try {
    recordSession(agent);
    assert.equal((await call("gemworks_note", { decisions: [] })).isError, true);
    const refused = await call("gemworks_work", { items: [{ title: "x", flow: "nope" }] });
    assert.equal(refused.isError, true);
    assert.match(JSON.stringify(refused.content), /Nothing recorded: item 1: flow must be one of design/);
    recordPrompt(repo, "codex", "cx1", "问一句");
    recordDecisions(repo, "codex", "cx1", ["合并前先跑三平台 CI"]);
    const assembly = await w.ctx.systemPrompt.assemble({ scope: agent });
    assert.match(assembly.contexts.find((c) => c.name === "gemworks:shared-decisions").text, /- 合并前先跑三平台 CI（Codex · feat\/x，\d\d:\d\d）/);
  } finally {
    await w.dispose();
  }
});

test("a record that cannot be written is missed, never the agent's: its tools are still there", async () => {
  const w = await world();
  try {
    writeFileSync(join(w.dir, ".geml"), "not a directory");
    assert.doesNotThrow(() => recordSession(w.agent));
    for (const name of ["gemworks_note", "gemworks_work"]) assert.ok(w.visible().includes(name), name);
  } finally {
    await w.dispose();
  }
});

test("the host's parameters for a schema with no properties, no items or no object at all: what is there and nothing more", () => {
  assert.deepEqual(dshParameters({ type: "string" }), {});
  assert.deepEqual(dshParameters({ type: "object" }), {});
  assert.deepEqual(dshParameters({ type: "object", required: ["mode"], properties: { tags: { type: "array", description: "标签" }, opts: { type: "object" }, mode: { type: "string", enum: ["a", "b"] } } }),
    { tags: { type: "array", description: "标签" }, opts: { type: "object", properties: {}, additionalProperties: false }, mode: { type: "string", enum: ["a", "b"], required: true } });
});

test("the board's routes on what they cannot read: a body that is no object, a session none supervises, a body over a mebibyte, no path, a path that is no URL", async () => {
  const api = boardApi(new Map());
  assert.deepEqual(await request(api, "POST", "/api/gemworks/act", ['"just words"']), { code: 404, body: { ok: false, error: "no supervision for session " } });
  assert.deepEqual(await request(api, "POST", "/api/gemworks/act", [JSON.stringify({ session: "nobody", action: { op: "pause" } })]), { code: 404, body: { ok: false, error: "no supervision for session nobody" } });
  const big = await request(api, "POST", "/api/gemworks/act", [Buffer.alloc(700_000, 0x20), Buffer.alloc(700_000, 0x20)]);
  assert.deepEqual(big, { code: 400, body: { ok: false, error: "the body is not JSON: the request body is over 1 MiB" } });
  assert.deepEqual(await request(api, "GET", undefined), { code: 404, body: { ok: false, error: "no such route" } });
  const bad = await request(api, "GET", "//[");
  assert.equal(bad.code, 500);
  assert.equal(bad.body.ok, false);
});

test("a paused run refuses the model's move with the reason; after dispose a press puts no verb back; a journal gone from disk still draws the board", async () => {
  const w = await world();
  try {
    putWorkflow(w.dir);
    const a = attach(w.ctx, w.agent, "startup", { journalDir: join(w.dir, "journals") });
    const id = String(w.agent.id);
    const api = boardApi(new Map([[id, a]]));
    assert.equal((await request(api, "POST", "/api/gemworks/act", [JSON.stringify({ session: id, action: { op: "pause" } })])).code, 200);
    const move = await w.call("gemworks_move", { to: "review" });
    assert.equal(move.isError, true);
    assert.match(JSON.stringify(move.content), /the work item is paused/);
    a.dispose();
    assert.equal((await request(api, "POST", "/api/gemworks/act", [JSON.stringify({ session: id, action: { op: "resume" } })])).code, 200);
    assert.deepEqual(w.visible().filter((n) => /^gemworks_(move|set|status)$/.test(n)), [], "a disposed supervision registers nothing again");
    rmSync(a.journalPath);
    const board = await request(api, "GET", `/api/gemworks/board?session=${encodeURIComponent(id)}`);
    assert.equal(board.code, 200);
    assert.equal(board.body.ok, true);
  } finally {
    await w.dispose();
  }
});

test("a workflow that does not check out: its errors are logged and the agent left alone; with onMissing fail its startup fails", async () => {
  const w = await world();
  try {
    const file = putWorkflow(w.dir, flowDoc({ initial: "a", states: { a: { description: "A" } }, transitions: [{ from: "a", to: "nowhere" }] }));
    const lines = captureLog(w);
    assert.equal(attach(w.ctx, w.agent, "startup", { journalDir: join(w.dir, "journals") }), null);
    assert.ok(lines.some((l) => l.startsWith(`error: ${file}:`)), lines.join("\n"));
    assert.throws(() => attach(w.ctx, w.agent, "startup", { journalDir: join(w.dir, "journals"), onMissing: "fail" }), /gemworks: .*flow\.geml does not check out/);
  } finally {
    await w.dispose();
  }
});

test("a workflow changed under a run is a warning and the run goes on; one that no longer has the run's state leaves the agent alone, saying why", async () => {
  const w = await world();
  try {
    const file = putWorkflow(w.dir);
    const config = { journalDir: join(w.dir, "journals"), onMissing: "skip" };
    const a = attach(w.ctx, w.agent, "startup", config);
    await w.call("gemworks_set", { order: "A-17", amount: 120 });
    await w.call("gemworks_move", { to: "review" });
    a.dispose();
    writeFileSync(file, FLOW.replace("Do not judge yet.", "Do not judge yet, and ask once."));
    const lines = captureLog(w);
    const again = attach(w.ctx, w.agent, "resume", config);
    assert.equal(again.run.snapshot.state, "review");
    assert.ok(lines.some((l) => l.startsWith(`warn: ${a.journalPath}: workflow changed: `)), lines.join("\n"));
    again.dispose();
    writeFileSync(file, flowDoc({ initial: "intake", states: { intake: { description: "Intake." }, done: { description: "Done.", final: true } }, transitions: [{ from: "intake", to: "done", note: "x" }] }));
    assert.equal(attach(w.ctx, w.agent, "resume", config), null);
    assert.ok(lines.includes(`error: ${a.journalPath}: the statechart no longer has state review; leaving this agent unsupervised`), lines.join("\n"));
    assert.equal(readJournal(readFileSync(a.journalPath, "utf8")).snapshots.at(-1).state, "review", "the journal is left as it was");
  } finally {
    await w.dispose();
  }
});
