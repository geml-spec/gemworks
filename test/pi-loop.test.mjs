// The work loop on Pi (src/hosts/pi/loop.ts), with no workflow: the loop's tools as gemworks_<name>, the loop in each
// run's system prompt, the band above the editor and the board /gemworks opens, a registered question asked at the
// run's end, and a run that changed things and reported nothing sent back once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakePi } from "./helpers/pi.mjs";
import gemworks from "../dist/hosts/pi/extension.js";
import { bandLines, boardLines, cells, fit, piLoopData } from "../dist/hosts/pi/loop.js";
import { WORK_REMINDER } from "../dist/core/work.js";
import { gitRepo } from "./helpers/repo.mjs";

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
