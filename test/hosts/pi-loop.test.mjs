// The work loop on Pi (src/hosts/pi/loop.ts), with no workflow: the loop's tools as gemworks_<name>, the loop in each
// run's system prompt, the band above the editor and the board /gemworks opens, a registered question asked at the
// run's end, and a run that changed things and reported nothing sent back once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakePi } from "../helpers/pi.mjs";
import gemworks from "../../dist/hosts/pi/extension.js";
import { attachLoop, bandLines, boardLines, cells, fit, piComplete, piLoopData } from "../../dist/hosts/pi/loop.js";
import { WORK_REMINDER } from "../../dist/core/work.js";
import { logName, parseLog } from "../../dist/core/session-log.js";
import { coachFlowsAt, recordPractices, recordProposals, recordWork, workItemsAt } from "../../dist/loop.js";
import { readLedger } from "../../dist/store/corrections.js";
import { readSessions, recordDecisions, recordPrompt, sessionsDirOf } from "../../dist/store/sessions.js";
import { gitRepo } from "../helpers/repo.mjs";

const HOME = mkdtempSync(join(tmpdir(), "gemworks-pi-home-"));
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;

/** The extension loaded in a project with no workflow, its session started. */
async function loadedIn(dir, options = {}) {
  const was = process.cwd();
  process.chdir(dir);
  try {
    const w = fakePi({ dir, ...options });
    gemworks(w.pi);
    await w.start();
    return w;
  } finally {
    process.chdir(was);
  }
}

test("widths: a wide character takes two cells, a cut line ends in an ellipsis within its width", () => {
  assert.equal(cells("ab看板"), 6);
  assert.equal(fit("短的", 10), "短的");
  const cut = fit("一二三四五六七八九十", 9);
  assert.ok(cells(cut) <= 9);
  assert.ok(cut.endsWith("…"));
});

test("an open item whose flow is gone shows the step it was recorded at, not that it is done", () => {
  const item = { id: "a1", flow: "gone", title: "修一个", state: "fix", needs: "", goal: "", status: "open", at: "2026-11-27T00:00:00Z", session: "s-1", met: [], next: "" };
  const d = { flows: [], items: [item], waiting: [], practices: [], decisions: [], asks: [] };
  assert.deepEqual(bandLines(d, "s-1"), ["gemworks · #a1 修一个 · gone · fix  /gemworks 看板"]);
});

test("the band and the board say the same things: the item and its step, what waits on the person and what to say, the step's practice", () => {
  const root = gitRepo();
  const empty = piLoopData(root, "s-1");
  assert.deepEqual(bandLines(empty, "s-1"), ["gemworks · 没有进行中的工作项  /gemworks 看板"]);
  assert.ok(boardLines(empty).includes("  没有要你定的事。"));
});

test("on a session with no workflow: the tools record, the run's system prompt carries the loop, the band follows, the board opens", async () => {
  const dir = gitRepo();
  const w = await loadedIn(dir, { hasUI: false });
  assert.deepEqual(w.widget("gemworks"), undefined, "no UI: no band");
  const r = await w.callTool("gemworks_work", { items: [{ title: "看板", flow: "feature", needs: "你看样稿" }] });
  assert.equal(r.isError, false, r.text);
  const system = await w.prompt("接着做");
  assert.match(system, /^BASE\n\n# gemworks: work items\n\n/);
  assert.match(system, /`gemworks_work` tool/);
  assert.match(system, /\[gemworks\] work items on the way: #\S+ «看板» \(feature: at mockup 样稿, needs 你看样稿\)/);
  assert.doesNotMatch(system, /gemworks `\w+` tool/, "every tool named as Pi names it");
  const data = piLoopData(dir, "s-1");
  const band = bandLines(data, "s-1");
  assert.match(band[0], /^gemworks · #\S+ 看板 · 新功能 · 样稿  \/gemworks 看板$/);
  assert.match(band[1], /^等你：样稿：你看过说行　在对话里说「行」或「要改」/);
  const board = boardLines(data);
  assert.ok(board.some((l) => /^ {4}新功能：\[样稿\] → 实现 → 验证 → 你确认$/.test(l)));
  // No UI: the board is said in a notice.
  await w.commands.get("gemworks").handler("", w.ctx);
  assert.match(w.notices().at(-1).message, /^Gemworks 看板/);
});

test("a run that wrote a file and reported nothing is sent back once; a registered question is asked at the run's end, the pick sent as the person's words", async () => {
  const dir = gitRepo();
  const asked = [];
  const w = await loadedIn(dir, { select: async (title, options) => { asked.push([title, options]); return options[0]; } });
  assert.match(w.widget("gemworks")[0], /^gemworks · 没有进行中的工作项/, "the band from the session's start");
  await w.prompt("改个文件");
  await w.emit("tool_result", { type: "tool_result", toolCallId: "c1", toolName: "write", input: { path: "a.txt" }, content: [], isError: false });
  await w.end([{ role: "assistant", content: [{ type: "text", text: "改好了。" }] }]);
  assert.deepEqual(w.messages().map((m) => [m.content, m.options?.triggerTurn]), [[WORK_REMINDER, true]]);
  await w.end([]);
  assert.equal(w.messages().length, 1, "once a run");
  // The next run reports its item and registers a question: asked at its end, with its answers to pick.
  await w.prompt("再来");
  await w.callTool("gemworks_work", { items: [{ title: "看板", flow: "feature" }] });
  await w.callTool("gemworks_ask", { question: "用哪个？", options: ["网页", "GEML 页面"], recommended: "GEML 页面" });
  await w.emit("tool_result", { type: "tool_result", toolCallId: "c2", toolName: "edit", input: { path: "a.txt" }, content: [], isError: false });
  await w.end([]);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(w.messages().length, 1, "it reported its item: not sent back");
  assert.deepEqual(asked, [["用哪个？", ["GEML 页面", "网页"]]]);
  assert.deepEqual(w.userMessages(), ["用哪个？：GEML 页面"]);
});

/** The loop alone, attached to a stand-in Pi in `dir`; the session started unless `start` is false. */
async function loopIn(dir, { start = true, ...options } = {}) {
  const w = fakePi({ dir, ...options });
  attachLoop(w.pi, dir);
  if (start) await w.start();
  return w;
}

/** What `f` answers once it answers something, polled: the ledger is written behind the run. */
async function until(f, ms = 5000) {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 20))) {
    const v = f();
    if (v !== undefined) return v;
  }
  return f();
}

test("the band and the board from the record: met steps ticked, what comes next, the step's practice, a held item marked and a dropped one left out, a proposal waiting, the other sessions' decisions", () => {
  const root = gitRepo();
  const AT = "2026-11-09T08:00:00.000Z";
  recordWork(root, "pi", "s-1", { items: [{ title: "看板", flow: "feature", met: ["mockup"], said: "好了", next: "写实现" }] }, AT);
  recordWork(root, "pi", "s-2", { items: [{ title: "旧事", flow: "bugfix", status: "dropped" }] }, "2026-11-09T08:01:00.000Z");
  recordWork(root, "pi", "s-3", { items: [{ title: "放着", flow: "bugfix" }] }, "2026-11-09T08:02:00.000Z");
  recordPractices(root, "pi", "s-1", { practices: [{ flow: "feature", step: "build", text: "先写测试再实现", layer: "project" }] }, AT);
  recordProposals(root, { proposals: [{ kind: "add-step", flow: "feature", after: "mockup", title: "评审样稿", why: "样稿改了三遍" }] }, AT);
  recordPrompt(root, "codex", "cx1", "问一句");
  recordDecisions(root, "codex", "cx1", ["合并前先跑三平台 CI"]);
  const data = piLoopData(root, "s-1");
  const d = { ...data, items: data.items.map((i) => (i.title === "放着" ? { ...i, status: "held" } : i)) };
  const band = bandLines(d, "s-1");
  assert.match(band[0], /^gemworks · #\S+ 看板 · 新功能 · 实现/);
  assert.equal(band.at(-1), "这一步：先写测试再实现");
  const board = boardLines(d);
  assert.ok(board.some((l) => /^ {2}提议 q\S+：feature 加一步「评审样稿」/.test(l)), "a proposal waits under its label");
  assert.ok(board.includes("    新功能：样稿 ✓ → [实现] → 验证 → 你确认"));
  assert.ok(board.includes("    接下来：写实现"));
  assert.ok(board.includes("    做法 1：先写测试再实现"));
  assert.ok(board.some((l) => /^ {2}#\S+ 放着（暂缓）$/.test(l)));
  assert.ok(!board.some((l) => l.includes("旧事")), "a dropped item is not on the way");
  const held = board.findIndex((l) => l.includes("放着（暂缓）"));
  const heldLines = board.slice(held + 1, board.findIndex((l, i) => i > held && /^ {2}#/.test(l)));
  assert.ok(heldLines.length > 0 && !heldLines.some((l) => l.startsWith("    做法")), "a held item shows no practices");
  assert.deepEqual(board.slice(board.indexOf("别的会话的决定")), ["别的会话的决定", board.at(-1)]);
  assert.match(board.at(-1), /^ {2}模型记：合并前先跑三平台 CI（Codex，\d\d:\d\d）$/);
});

test("the borrowed model: its text blocks joined, a reply with no words is no answer", async () => {
  const replies = [{ content: [{ type: "thinking", thinking: "…" }, { type: "text", text: " 好的 " }] }, { content: [{ type: "thinking", thinking: "…" }] }];
  const complete = piComplete({ model: { id: "m" }, modelRegistry: { complete: async () => replies.shift() } });
  assert.equal(await complete("sys", "prompt", 50), "好的");
  assert.equal(await complete("sys", "prompt", 50), undefined);
});

test("before the session starts: a run's prompt is left as it is and its end records nothing; a tool and the board answer for the host's session id", async () => {
  const dir = gitRepo();
  const w = await loopIn(dir, { start: false, hasUI: false });
  assert.equal(await w.prompt("早了"), "BASE");
  await w.end([{ role: "assistant", content: "答了" }]);
  assert.deepEqual(readSessions(dir), [], "nothing in the record");
  const r = await w.callTool("gemworks_work", { items: [{ title: "看板", flow: "feature" }] });
  assert.equal(r.isError, false, r.text);
  assert.equal(workItemsAt(dir, coachFlowsAt(dir))[0].session, "s-1");
  await w.commands.get("gemworks").handler("", w.ctx);
  assert.match(w.notices().at(-1).message, /#\S+ 看板/);
});

test("a run's answer is its last assistant message with words, from a string or its text blocks; with no UI a registered question is not asked", async () => {
  const dir = gitRepo();
  const asked = [];
  const w = await loopIn(dir, { hasUI: false, select: async (title) => { asked.push(title); return undefined; } });
  await w.prompt("一");
  await w.end([{ role: "assistant", content: "答一" }, { role: "user", content: "插一句" }]);
  await w.prompt("二");
  await w.end([{ role: "assistant", content: [{ type: "thinking", thinking: "想" }, { type: "text", text: "答二" }] }, { role: "assistant", content: { type: "text" } }]);
  await w.prompt("三");
  await w.callTool("gemworks_ask", { question: "用哪个？", options: ["网页", "GEML 页面"] });
  await w.end([{ role: "assistant", content: "   " }]);
  const answers = parseLog(readFileSync(join(sessionsDirOf(dir), logName("pi", "s-1")), "utf8")).filter((e) => e.t === "answer").map((e) => e.text);
  assert.deepEqual(answers, ["答一", "答二"]);
  assert.deepEqual(asked, []);
});

test("a typed prompt is labelled by the session's own model, with the step this session's work item stands at once there is one", async () => {
  delete process.env.GEMWORKS_LEARN;
  const dir = gitRepo();
  const w = await loopIn(dir, { hasUI: false });
  w.ctx.model = { id: "m" };
  w.ctx.modelRegistry = { complete: async () => ({ content: [{ type: "text", text: '[{"n": 1, "kind": "task", "sub": null, "work": "ui"}]' }] }) };
  await w.callTool("gemworks_work", { items: [{ title: "看板", flow: "feature" }] });
  await w.prompt("看板再加个页签");
  const row = await until(() => readLedger().prompts.find((p) => p.text === "看板再加个页签"));
  assert.ok(row !== undefined, "labelled behind the run");
  assert.deepEqual([row.session, row.kind, row.flow, row.step], ["s-1", "task", "feature", "mockup"]);
});

test("a band the host cannot draw stops nothing: the session is recorded and each run still carries the loop", async () => {
  const dir = gitRepo();
  const w = fakePi({ dir });
  w.ctx.ui.setWidget = () => { throw new Error("no widget here"); };
  attachLoop(w.pi, dir);
  await w.start();
  assert.match(await w.prompt("接着做"), /# gemworks: work items/);
  assert.ok(readSessions(dir).some((s) => s.id === "s-1"));
});

test("each run's system prompt carries the other sessions' recent decisions, with their host and branch", async () => {
  const dir = gitRepo();
  recordPrompt(dir, "codex", "cx1", "问一句");
  recordDecisions(dir, "codex", "cx1", ["合并前先跑三平台 CI"]);
  const w = await loopIn(dir, { hasUI: false });
  assert.match(await w.prompt("接着做"), /- 合并前先跑三平台 CI（Codex · feat\/x，\d\d:\d\d）/);
});

test("on Pi the note tool records the turn's decisions and fails a call with none; a loop tool that records nothing fails with why", async () => {
  const dir = gitRepo();
  const w = await loopIn(dir, { hasUI: false });
  const noted = await w.callTool("gemworks_note", { decisions: ["每会话一个文件"] });
  assert.equal(noted.isError, false, noted.text);
  assert.deepEqual(readSessions(dir).find((s) => s.id === "s-1").decisions.map((x) => x.text), ["每会话一个文件"]);
  assert.equal((await w.callTool("gemworks_note", { decisions: [] })).isError, true);
  const refused = await w.callTool("gemworks_work", { items: [{ title: "x", flow: "nope" }] });
  assert.equal(refused.isError, true);
  assert.match(refused.text, /Nothing recorded: item 1: flow must be one of design/);
});

test("/gemworks: a UI that is not the terminal's gets the board as a notice; in the terminal it opens as an overlay that Esc, q or Enter closes", async () => {
  const dir = gitRepo();
  const w = await loopIn(dir);
  w.ctx.mode = "rpc";
  await w.commands.get("gemworks").handler("", w.ctx);
  assert.match(w.notices().at(-1).message, /^Gemworks 看板/);
  w.ctx.mode = "tui";
  const opened = [];
  w.ctx.ui.custom = async (factory, options) => {
    const closes = [];
    let lines = [];
    for (const key of ["x", "\u001b", "q", "\r"]) {
      let closed = false;
      const view = factory(undefined, undefined, undefined, () => { closed = true; });
      lines = view.render(20);
      view.invalidate();
      view.handleInput(key);
      closes.push(closed);
    }
    opened.push({ options, lines, closes });
  };
  await w.commands.get("gemworks").handler("", w.ctx);
  assert.equal(opened.length, 1);
  assert.deepEqual(opened[0].options, { overlay: true });
  assert.ok(opened[0].lines[0].startsWith("Gemworks"));
  assert.ok(opened[0].lines.every((l) => cells(l) <= 18), "cut to the overlay's width");
  assert.deepEqual(opened[0].closes, [false, true, true, true]);
});
