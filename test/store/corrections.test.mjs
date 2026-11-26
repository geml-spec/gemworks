// Where the ledger of corrections is kept, and the prompts not labelled yet read from the host's transcripts and from
// the other hosts' session records (store/corrections.ts). The ledger itself is test/core/corrections.test.mjs's.
import { test, after as afterAll } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EMPTY_LEDGER } from "../../dist/core/corrections.js";
import { correctionsPath, labelledRows, readLedger, recordedUnlabelled, typedPrompts, unlabelledPrompts } from "../../dist/store/corrections.js";

const made = [];
afterAll(() => { for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3 }); });
const scratch = (name) => { const d = mkdtempSync(join(tmpdir(), name)); made.push(d); return d; };
const raw = (o) => JSON.stringify(o);
const labelled = (id, at) => ({ id, at, session: "zz", text: `words ${id}`, kind: "task", by: "model" });

test("a ledger's file that cannot be read is an empty ledger", () => {
  const home = scratch("gw-home-");
  mkdirSync(correctionsPath(home), { recursive: true }); // a directory where the file should be
  assert.deepEqual(readLedger(home), EMPTY_LEDGER);
});

test("labelled prompts given by an agent: each wrong line named by its number; one that is no correction has no sub, and its project, flow and step are kept", () => {
  const ok = { id: "s1@1", at: "2026-10-30T01:00:00Z", session: "s1", text: "好" };
  const r = labelledRows([
    "not an object",
    { ...ok, kind: "shout" },
    { ...ok, kind: "task", work: "garden" },
    { ...ok, kind: "decide", sub: "verify", work: null, project: "/work/p", flow: "feature", step: "mockup" },
    { ...ok, id: "s1@2", kind: "task", work: "ui", project: "" },
  ], "agent");
  assert.deepEqual(r.errors, [
    "line 1 is not an object",
    "line 2: kind must be one of task, decide, correct, status, nudge, inform, interrupt",
    "line 3: work must be one of ui, spec, writing, business, other",
  ]);
  assert.deepEqual(r.rows, [
    { ...ok, kind: "decide", by: "agent", project: "/work/p", flow: "feature", step: "mockup" },
    { ...ok, id: "s1@2", kind: "task", by: "agent", work: "ui" },
  ]);
});

test("the prompts typed in a transcript: another session's message, a tool result, a notice record and one with no time are not; a line queued by the person is, at its record's time; the reply before keeps its words", () => {
  const T = (m) => `2026-10-30T01:${m}:00.000Z`;
  const lines = [
    "not json", "null",
    raw({ type: "user", isSidechain: true, sessionId: "s1", timestamp: T("00"), message: { content: "a subagent's prompt" } }),
    raw({ type: "system", sessionId: "s1", timestamp: T("01"), content: "a notice" }),
    raw({ type: "user", isMeta: true, sessionId: "s1", timestamp: T("02"), message: { content: "meta" } }),
    raw({ type: "user", isCompactSummary: true, sessionId: "s1", timestamp: T("03"), message: { content: "the summary" } }),
    raw({ type: "user", origin: { kind: "peer" }, sessionId: "s1", timestamp: T("04"), message: { content: "转给你一个修复" } }),
    raw({ type: "user", sessionId: "s1", timestamp: T("05"), message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] } }),
    raw({ type: "assistant", sessionId: "s1", timestamp: T("06"), message: null }),
    raw({ type: "assistant", sessionId: "s1", timestamp: T("07"), message: { content: [{ type: "text", text: 5 }, { type: "text", text: "改好了。" }] } }),
    raw({ type: "attachment", sessionId: "s1", timestamp: T("08"), attachment: { type: "queued_command", prompt: "也看看这个", origin: { kind: "human" } } }),
    raw({ type: "attachment", sessionId: "s1", timestamp: T("09"), attachment: { type: "queued_command", prompt: "另一个会话的消息", origin: { kind: "peer" } } }),
    raw({ type: "user", message: { content: "no time, no session" } }),
    raw({ type: "user", timestamp: T("10"), cwd: "/work/p", message: { content: "没有会话号" } }),
  ];
  assert.deepEqual(typedPrompts(lines.join("\r\n")), [
    { at: T("08"), session: "s1", cwd: "", text: "也看看这个", before: "改好了。" },
    { at: T("10"), session: "", cwd: "/work/p", text: "没有会话号", before: "改好了。" },
  ]);
});

/** A transcripts folder: a1.jsonl and b2.jsonl written at the end of October, old.jsonl at its start, a folder named like a transcript, and a stray file. */
function transcripts() {
  const root = scratch("gw-tr-");
  const dir = join(root, "C--proj");
  mkdirSync(dir);
  const user = (session, at, text) => raw({ type: "user", ...(session !== undefined ? { sessionId: session } : {}), timestamp: at, cwd: "/work/proj", message: { content: text } });
  const write = (name, lines, mtime) => {
    writeFileSync(join(dir, name), `${lines.join("\n")}\n`);
    utimesSync(join(dir, name), mtime, mtime);
  };
  const late = new Date("2026-10-31T00:00:00Z");
  // Written out of order: a line queued mid-turn can carry an earlier time than the line before it.
  write("a1.jsonl", [user("a1sess00-x", "2026-10-30T03:00:00Z", "第三句"), user("a1sess00-x", "2026-10-30T01:00:00Z", "第一句"), user("a1sess00-x", "2026-10-20T00:00:00Z", "早一些")], late);
  write("b2.jsonl", [user(undefined, "2026-10-30T02:00:00Z", "第二句")], late);
  write("old.jsonl", [user("old00000-x", "2026-10-30T04:00:00Z", "旧文件里的")], new Date("2026-10-01T00:00:00Z"));
  mkdirSync(join(dir, "folder.jsonl"));
  writeFileSync(join(root, "stray.txt"), "not a folder of transcripts");
  return root;
}

test("prompts not labelled yet, oldest first across transcripts: one said before the time asked about, and a transcript not written since, are not read; a record with no session takes its file's name", () => {
  const root = transcripts();
  const since = "2026-10-29T00:00:00Z";
  const pending = unlabelledPrompts(EMPTY_LEDGER, root, { since });
  assert.deepEqual(pending.map((p) => [p.text, p.session, p.project]), [["第一句", "a1sess00-x", "/work/proj"], ["第二句", "b2", "/work/proj"], ["第三句", "a1sess00-x", "/work/proj"]]);
  assert.deepEqual(pending.map((p) => p.id), ["a1sess00@2026-10-30T01:00:00", "b2@2026-10-30T02:00:00", "a1sess00@2026-10-30T03:00:00"]);
  assert.deepEqual(unlabelledPrompts(EMPTY_LEDGER, root, { since, limit: 2 }).map((p) => p.text), ["第一句", "第二句"], "at most the limit, the oldest");
  assert.deepEqual(unlabelledPrompts(EMPTY_LEDGER, join(root, "none"), { since }), [], "no transcripts folder: nothing");
});

test("with no time given, prompts are read since the ledger's newest, or the thirty days before now", () => {
  const root = transcripts();
  const ledger = { ...EMPTY_LEDGER, prompts: [labelled("x@1", "2026-10-30T01:30:00Z")] };
  assert.deepEqual(unlabelledPrompts(ledger, root).map((p) => p.text), ["第二句", "第三句"]);
  assert.deepEqual(unlabelledPrompts(EMPTY_LEDGER, root, { now: "2026-11-15T00:00:00Z" }).map((p) => p.text), ["早一些", "第一句", "第二句", "第三句"], "the old file was last written before the thirty days");
});

test("the prompts other hosts recorded, oldest first: Claude Code's own and a session read back from a transcript are not, nor one before the time asked about; the answer before each is kept", () => {
  const session = (id, turns, over = {}) => ({ id, host: "codex", started: "2026-10-20T00:00:00Z", last: "2026-10-30T06:00:00Z", turns, decisions: [], files: [], commits: [], ...over });
  const turn = (n, at, prompt, answer) => ({ turn: n, at, prompt, decisions: [], ...(answer !== undefined ? { answer } : {}) });
  const sessions = [
    session("cx-2222", [turn(1, "2026-10-30T05:00:00Z", "第二个会话里说的"), turn(2, "2026-10-20T00:00:00Z", "很早说的")]),
    session("cx-1111", [turn(1, "2026-10-30T04:00:00Z", "先说的", "好的，改了。"), turn(2, "2026-10-30T04:30:00Z", "<system-reminder>linked</system-reminder>\n后说的")], { checkout: "/work/p" }),
    session("cc-0000", [turn(1, "2026-10-30T04:10:00Z", "Claude Code 的")], { host: "claude-code" }),
    session("bf-0000", [turn(1, "2026-10-30T04:20:00Z", "补录的")], { backfilled: true }),
  ];
  const pending = recordedUnlabelled(EMPTY_LEDGER, sessions, { since: "2026-10-29T00:00:00Z" });
  assert.deepEqual(pending, [
    { id: "cx-1111@2026-10-30T04:00:00", at: "2026-10-30T04:00:00Z", session: "cx-1111", text: "先说的", project: "/work/p", before: "" },
    { id: "cx-1111@2026-10-30T04:30:00", at: "2026-10-30T04:30:00Z", session: "cx-1111", text: "后说的", project: "/work/p", before: "好的，改了。" },
    { id: "cx-2222@2026-10-30T05:00:00", at: "2026-10-30T05:00:00Z", session: "cx-2222", text: "第二个会话里说的", project: "", before: "" },
  ]);
  const ledger = { ...EMPTY_LEDGER, prompts: [labelled("x@1", "2026-10-30T04:15:00Z")] };
  assert.deepEqual(recordedUnlabelled(ledger, sessions).map((p) => p.text), ["后说的", "第二个会话里说的"], "since the ledger's newest");
  assert.deepEqual(recordedUnlabelled(EMPTY_LEDGER, sessions, { now: "2026-11-15T00:00:00Z" }).map((p) => p.text), ["很早说的", "先说的", "后说的", "第二个会话里说的"], "the thirty days before now");
  assert.deepEqual(recordedUnlabelled(EMPTY_LEDGER, sessions, { now: "2026-11-15T00:00:00Z", limit: 1 }).map((p) => p.text), ["很早说的"]);
});
