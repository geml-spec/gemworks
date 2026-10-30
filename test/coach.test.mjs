import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { closeEvent, COACH_FLOWS, coachBand, doingNote, goneOnAfterTurn, goneOnNote, holdEvent, itemHistory, manualRows, turnWords, itemProgress, metOf, pressEvent, readCoachFlow, stripText, turnItem, WORK_SHOWN, workContext, workEvents, workItemsOf, workPrompt, workRows } from "../dist/hosts/claude-code/coach.js";
import { parseLog, summarize } from "../dist/core/session-log.js";
import { wordsFor } from "../dist/hosts/claude-code/text.js";

const t = wordsFor("zh");
const flows = COACH_FLOWS.map((name) => readCoachFlow(name, readFileSync(new URL(`../coach/${name}.geml`, import.meta.url), "utf8")));
const flow = (name) => flows.find((f) => f.name === name);
const m = (step, over = {}) => ({ step, at: "2026-10-23T09:00:00Z", turn: 1, ...over });
const item = (over) => ({ id: "a1", flow: "bugfix", title: "导出跳过不留", state: "confirm", needs: "你按一次跳过", goal: "跳过不留文件", status: "open", at: "2026-10-23T10:00:00Z", session: "s1", met: [m("reproduce"), m("fix"), m("verify")], next: "", ...over });

test("the flows the plugin ships: 新设计, 新功能, bugfix, 优化, each its states in order, each a requirement, the way back dashed", () => {
  assert.deepEqual(flows.map((f) => [f.name, f.title]), [["design", "新设计"], ["feature", "新功能"], ["bugfix", "bugfix"], ["optimize", "优化"]]);
  assert.deepEqual(flow("bugfix").states.map((s) => [s.title, s.need, s.final]), [["复现", "版本已确认", false], ["修", "一个猜测一版", false], ["验证", "测试通过", false], ["你确认", "你按过说对", false], ["完成", "", true]]);
  assert.deepEqual(flow("bugfix").edges.filter((e) => e.back).map((e) => [e.from, e.to, e.label]), [["confirm", "reproduce", "你说没好"]]);
  assert.deepEqual(flow("design").states.map((s) => s.title), ["讨论", "出样稿", "你点头", "完成"]);
  assert.equal(readCoachFlow("x", "=== meta\ntitle = \"x\"\n===\n"), undefined, "no diagram: no flow");
  assert.equal(readCoachFlow("x", "=== diagram {#flow format=geml-statechart}\n{ not json\n===\n"), undefined);
});

test("every step says who judges it and what it prevents; a step the person judges may name its buttons' words", () => {
  assert.deepEqual(flow("feature").states.filter((s) => !s.final).map((s) => [s.title, s.need, s.judge, s.prevents]), [
    ["样稿", "你看过说行", "you", "做出来不是你要的，返工最贵"], ["实现", "一个模块一版", "model", "一次改太多，出了错找不到在哪"],
    ["验证", "测试通过", "fact", "说做完了，其实跑不起来"], ["你确认", "你用过说对", "you", "测试过了，但不是你要的样子"],
  ]);
  assert.deepEqual(flow("feature").edges.filter((e) => e.back).map((e) => [e.to, e.label]), [["build", "你说不对"], ["mockup", "方向不对"]]);
  assert.deepEqual(flow("optimize").states.map((s) => [s.id, s.judge]).slice(0, 4), [["baseline", "fact"], ["change", "model"], ["measure", "fact"], ["confirm", "you"]]);
  assert.equal(flow("optimize").states[2].need, "数字比基线好，测试照样通过");
  assert.deepEqual([flow("design").states[2].answers, flow("bugfix").states[3].answers], [["行", "要改"], null]);
});

test("a project's own flow takes who judges a step, what it prevents and its words from the shipped step of the same id; a step of its own is the model's", () => {
  const own = readCoachFlow("bugfix", [
    "=== diagram {#flow format=geml-statechart caption=\"bugfix\"}",
    JSON.stringify({ initial: "reproduce", states: { reproduce: { title: "复现", description: "版本已确认" }, gates: { title: "过三道门", description: "三项都过" }, confirm: { title: "你确认", description: "你按过说对" }, done: { title: "完成", final: true } },
      transitions: [{ from: "reproduce", to: "gates" }, { from: "gates", to: "confirm" }, { from: "confirm", to: "done" }] }),
    "===",
  ].join("\n"), flow("bugfix"));
  assert.deepEqual(own.states.map((s) => [s.id, s.judge, s.prevents !== ""]), [["reproduce", "model", true], ["gates", "model", false], ["confirm", "you", true], ["done", "model", false]]);
});

test("an older event names only the state it stood in: every step before it is met; at a final state every step is", () => {
  const bug = flow("bugfix");
  assert.deepEqual(metOf({ state: "confirm", at: "2026-10-01T00:00:00Z", turn: 3 }, bug).map((x) => x.step), ["reproduce", "fix", "verify"]);
  assert.deepEqual(metOf({ state: "done", at: "2026-10-01T00:00:00Z", turn: 3 }, bug).map((x) => x.step), ["reproduce", "fix", "verify", "confirm"]);
  assert.deepEqual(metOf({ state: "nowhere", at: "2026-10-01T00:00:00Z", turn: 3 }, bug), []);
  assert.deepEqual(metOf({ state: "confirm", at: "2026-10-01T00:00:00Z", turn: 3 }, undefined), [], "its flow unread: nothing met");
  const log = [{ t: "session", id: "s1", host: "claude-code", at: "2026-10-01T00:00:00Z" }, { t: "item", turn: 3, at: "2026-10-01T00:00:00Z", id: "ozl", flow: "bugfix", title: "旧的", state: "confirm", needs: "", goal: "", status: "open" }];
  const [old] = workItemsOf([summarize(parseLog(log.map((e) => JSON.stringify(e)).join("\n")))], flows);
  assert.deepEqual([itemProgress(old, bug).here, itemProgress(old, bug).whose], ["confirm", "you"]);
});

test("a session's log keeps its work item events; the items as they stand are the newest event of each id, whichever session wrote it", () => {
  const log = (id, lines) => [{ t: "session", id, host: "claude-code", at: "2026-10-23T09:00:00Z" }, ...lines].map((e) => JSON.stringify(e)).join("\n");
  const ev = (at, over) => ({ t: "item", turn: 1, at, id: "a1", flow: "bugfix", title: "导出", state: "fix", needs: "", goal: "", status: "open", ...over });
  const one = summarize(parseLog(log("s1", [ev("2026-10-23T10:00:00Z", {}), ev("2026-10-23T10:05:00Z", { state: "verify" })])));
  assert.deepEqual(one.items.map((e) => e.state), ["verify"], "the newest of an id in one session");
  const two = summarize(parseLog(log("s2", [ev("2026-10-23T10:10:00Z", { state: "confirm" }), ev("2026-10-23T09:30:00Z", { id: "b2", title: "对齐", flow: "optimize", state: "change" })])));
  assert.equal(summarize(parseLog(log("s3", [{ ...ev("2026-10-23T10:00:00Z", {}), status: "maybe" }]))).items, undefined, "an event that is no item is left out");
  const items = workItemsOf([one, two]);
  assert.deepEqual(items.map((i) => [i.id, i.state, i.session]), [["a1", "confirm", "s2"], ["b2", "change", "s2"]], "newest first, across sessions");
});

test("the work tool's items: steps met by id or title, where it stands follows from them; an update by id keeps what it does not say; every step met finishes it", () => {
  const on = [item({})];
  const r = workEvents({ items: [
    { title: "新的", flow: "feature", met: ["实现"], needs: "一个模块", goal: "能用", next: "跑测试" },
    { id: "#a1", title: "", flow: "bugfix", met: ["reproduce", "fix", "verify", "confirm"], said: "好了" },
    { title: "x", flow: "release", met: [] },
    { title: "x", flow: "bugfix", met: ["nowhere"] },
    { id: "zz", title: "x", flow: "bugfix", met: [] },
    { title: " ", flow: "bugfix", met: [] },
    { id: "a1", title: "", flow: "bugfix", met: ["reproduce", "fix", "verify", "confirm"] },
  ] }, flows, on, "2026-10-23T11:00:00Z", 4, (n) => `new${n}`);
  assert.deepEqual(r.events.map((e) => [e.id, e.flow, e.title, e.state, e.needs, e.goal, e.status, e.turn, e.next]), [
    ["new0", "feature", "新的", "verify", "一个模块", "能用", "open", 4, "跑测试"],
    ["a1", "bugfix", "导出跳过不留", "done", "你按一次跳过", "跳过不留文件", "done", 4, undefined],
  ]);
  assert.deepEqual(r.events[0].met, [{ step: "build", at: "2026-10-23T11:00:00Z", turn: 4 }], "the mockup skipped: not met");
  assert.deepEqual(r.events[1].met.map((x) => [x.step, x.turn, x.said]), [["reproduce", 1, undefined], ["fix", 1, undefined], ["verify", 1, undefined], ["confirm", 4, "好了"]], "a step kept keeps when it was met; the person's step keeps their words");
  assert.deepEqual(r.errors, [
    "item 3: flow must be one of design, feature, bugfix, optimize",
    "item 4: bugfix has no step \"nowhere\" (reproduce, fix, verify, confirm, done)",
    "item 5: no work item #zz is on the way",
    "item 6 has no title",
    "item 7: 你确认 is the person's to meet: put what they said in `said`, or leave it for their press",
  ]);
  const kept = workEvents({ items: [{ id: "a1", title: "", flow: "bugfix", needs: "再看一眼" }] }, flows, on, "2026-10-23T12:00:00Z", 5, () => "x").events[0];
  assert.deepEqual([kept.met.map((x) => x.step), kept.state, kept.needs], [["reproduce", "fix", "verify"], "confirm", "再看一眼"], "met left out: kept");
  const back = workEvents({ items: [{ id: "a1", title: "", flow: "bugfix", met: ["reproduce"] }] }, flows, on, "2026-10-23T12:00:00Z", 5, () => "x").events[0];
  assert.equal(back.state, "fix", "a way back is fewer steps met");
});

test("a press on a step the person judges: yes meets it; no goes the step's first way back, every step from there unmet; holding keeps the steps", () => {
  const bug = flow("bugfix");
  const yes = pressEvent(item({}), bug, "confirm", true, "2026-10-23T12:00:00Z", 7);
  assert.deepEqual([yes.status, yes.state, yes.met.at(-1)], ["done", "done", { step: "confirm", at: "2026-10-23T12:00:00Z", turn: 7, pressed: true }]);
  const no = pressEvent(item({}), bug, "confirm", false, "2026-10-23T12:00:00Z", 7);
  assert.deepEqual([no.status, no.state, no.met], ["open", "reproduce", []], "你说没好: back to 复现");
  const feat = pressEvent(item({ flow: "feature", met: [m("mockup"), m("build"), m("verify")] }), flow("feature"), "confirm", false, "x", 7);
  assert.deepEqual([feat.state, feat.met.map((x) => x.step)], ["build", ["mockup"]], "its first way back: 你说不对, to 实现");
  const held = holdEvent(item({}), true, "x", 7);
  assert.deepEqual([held.status, held.met.length, holdEvent(item({ status: "held" }), false, "x", 7).status], ["held", 3, "open"]);
});

test("what the model is told: the flows once, with their steps and who judges each; beside each prompt the items on the way, by id, with the steps met", () => {
  assert.match(workPrompt(flows), /`work` tool/);
  assert.match(workPrompt(flows), /bugfix bugfix: reproduce 复现 \(model\) → fix 修 \(model\) → verify 验证 \(fact\) → confirm 你确认 \(you\);/);
  assert.match(workPrompt(flows), /only with their own words in `said`/);
  assert.deepEqual(workContext([item({}), item({ id: "b2", status: "done" })], flows), ["[gemworks] work items on the way: #a1 «导出跳过不留» (bugfix: met reproduce, fix, verify; at confirm 你确认, needs 你按一次跳过)"]);
  assert.deepEqual(workContext([], flows), []);
});

test("the work items tab: items by whose turn it is, each its steps as cells; the person's step its two buttons, the model's next step 好，做吧 and 暂缓处理", () => {
  const rows = workRows([
    item({}),
    item({ id: "f2", flow: "feature", title: "回合结束补报", met: [m("build"), m("verify")], needs: "" }),
    item({ id: "d3", flow: "design", title: "流程手册", met: [m("discuss")], needs: "", next: "出工作项页样稿" }),
    item({ id: "e4", flow: "design", title: "别处的", met: [m("discuss")], next: "出样稿", session: "s2" }),
    item({ id: "h5", status: "held" }),
    item({ id: "b6", status: "dropped" }),
  ], flows, t, { own: "s1" });
  assert.deepEqual(rows.filter((r) => r.kind === "section").map((r) => [r.text, r.count, r.fold?.label]), [["等你", 2, undefined], ["我来", 2, undefined], ["已暂缓", 1, "展开"]]);
  const a1 = rows.find((r) => r.key === "work-a1");
  assert.deepEqual(a1.cells.map((c) => `${c.title}:${c.cell}`), ["复现:met", "修:met", "验证:met", "你确认:here", "完成:ahead"]);
  assert.deepEqual([a1.detail, a1.actions.map((b) => [b.label, b.action])], ["还差：你按一次跳过", [
    ["好了", { op: "work-meet", id: "a1", step: "confirm", yes: true, label: "好了" }], ["没好", { op: "work-meet", id: "a1", step: "confirm", yes: false, label: "没好" }],
  ]]);
  assert.deepEqual(rows.find((r) => r.key === "work-f2").cells.map((c) => c.cell), ["skipped", "met", "met", "here", "ahead"]);
  assert.equal(rows.find((r) => r.key === "work-f2").detail, "还差：你用过说对", "no needs: the step's own requirement");
  const d3 = rows.find((r) => r.key === "work-d3");
  assert.deepEqual([d3.detail, d3.actions.map((b) => [b.label, b.action.op])], ["接下来我去：出工作项页样稿", [["好，做吧", "work-go-on"], ["标为完成", "work-close"], ["暂缓处理", "work-hold"]]]);
  const e4 = rows.find((r) => r.key === "work-e4");
  assert.deepEqual([e4.detail, e4.actions.map((b) => b.label)], ["接下来我去：出样稿 · 在别的会话里", ["转到本会话", "标为完成", "暂缓处理"]], "another session's next step: no 好，做吧 here, but it can be taken over");
  assert.equal(rows.find((r) => r.key === "work-h5"), undefined, "the held group folded");
  const opened = workRows([item({ id: "h5", status: "held" })], flows, t, { open: ["held"] });
  assert.deepEqual(opened.at(-1).actions.map((b) => [b.label, b.action]), [["取消暂缓", { op: "work-hold", id: "h5", held: false }]]);
  assert.equal(stripText(a1.cells), "✓复现 ✓修 ✓验证 ▸你确认 ·完成");
});

test("the work items tab: an item whose flow cannot be read still shows, with no cells; many items list the first few of a group until its heading's press", () => {
  const lost = workRows([item({ flow: "gone" })], flows, t);
  assert.deepEqual(lost.filter((r) => r.kind === "work").map((r) => [r.title, r.tag, r.cells, r.actions.map((b) => b.label)]), [["导出跳过不留", "gone", [], ["标为完成", "暂缓处理"]]]);
  const many = Array.from({ length: 60 }, (_, n) => item({ id: `i${n}` }));
  const folded = workRows(many, flows, t);
  assert.equal(folded.filter((r) => r.kind === "work").length, WORK_SHOWN);
  assert.deepEqual([folded[0].count, folded[0].fold.label, folded[0].fold.action], [60, "展开", { op: "work-fold", group: "you", open: true }]);
  assert.equal(workRows(many, flows, t, { open: ["you"] }).filter((r) => r.kind === "work").length, 60);
});

test("the flow tab's manual: each flow with items on the way, the focused first; its steps with who judges and what each prevents, the focused item's step marked, the ways back", () => {
  const items = [item({}), item({ id: "b2", title: "工具页对齐", at: "2026-10-23T09:00:00Z" }), item({ id: "c3", flow: "design", title: "流程改成教练", met: [m("discuss")], at: "2026-10-23T11:00:00Z" })];
  const rows = manualRows(items, flows, [], t, { focus: { flow: "bugfix", id: "b2" }, expanded: null });
  assert.equal(rows[0].text, "谁判：事实＝插件查得到 · 你＝要你点头 · 模型＝我判断");
  assert.equal(rows[1].text, "从「工具页对齐」过来 · 卡在「你确认」");
  assert.deepEqual(rows.filter((r) => r.kind === "section").map((r) => [r.text, r.note]), [["bugfix", "2 件在走"], ["新设计", "1 件在走"], ["现在没有事项在走", undefined]]);
  const bug = rows.filter((r) => r.kind === "step" && r.key.startsWith("step-bugfix-"));
  assert.deepEqual(bug.map((r) => [r.title, r.need, r.judge, r.here]), [["复现", "版本已确认", "模型", false], ["修", "一个猜测一版", "模型", false], ["验证", "测试通过", "事实", false], ["你确认", "你按过说对", "你", true], ["完成", "", "", false]]);
  assert.equal(bug[0].prevents, "防：修的不是真正出问题的那个版本或现象");
  assert.ok(rows.some((r) => r.kind === "text" && r.text === "↩ 你说没好，回到复现"));
  assert.deepEqual(rows.filter((r) => (r.key ?? "").startsWith("manual-idle-")).map((r) => [r.title, r.action]), [["新功能", { op: "manual-open", flow: "feature", open: true }], ["优化", { op: "manual-open", flow: "optimize", open: true }]]);
  assert.deepEqual(manualRows([], flows, [], t, { focus: null, expanded: null }).filter((r) => r.kind === "section").map((r) => r.text), ["现在没有事项在走"], "nothing on the way: every flow a press");
  assert.equal(manualRows([], flows, [], t, { focus: null, expanded: ["optimize"] }).filter((r) => r.kind === "step").length, 5, "a flow opened shows whole");
});

test("the manual's practices: listed on the flow opened, each on its step, its tag and presses; the rest counted on their flow's heading; those for every flow at the end", () => {
  const pr = (over) => ({ id: "p1", flow: "bugfix", step: "fix", text: "同一现象再现，先回头读引擎契约", why: "10-22 页签连死四次", at: "2026-10-25T00:00:00Z", by: "model", layer: "project", ...over });
  const practices = [pr({}), pr({ id: "p2", step: "*", text: "修之前先复现", by: "memory", layer: "personal" }), pr({ id: "p3", flow: "design", step: "mockup", text: "用真实内容", by: "person" }),
    pr({ id: "p4", flow: "*", step: "*", text: "回复用中文", layer: "personal", by: "memory" }), pr({ id: "p5", deleted: true }), pr({ id: "p6", layer: "team", step: "verify", text: "过四道门", ref: "CLAUDE.md#build-and-check" })];
  const items = [item({}), item({ id: "c3", flow: "design", met: [m("discuss")], at: "2026-10-23T11:00:00Z" })];
  const rows = manualRows(items, flows, practices, t, { focus: null, expanded: null, now: "2026-10-26T00:00:00Z" });
  const heads = rows.filter((r) => r.kind === "section").map((r) => [r.text, r.fold?.label]);
  assert.deepEqual(heads, [["新设计", "收起做法"], ["bugfix", "做法 3 条"], ["现在没有事项在走", undefined], ["所有时候的做法", "展开"]], "the flow moved last listed; the other counted");
  assert.deepEqual(rows.filter((r) => r.kind === "practice").map((r) => r.text), ["用真实内容"]);
  const bug = manualRows(items, flows, practices, t, { focus: null, expanded: ["bugfix", "*"], now: "2026-10-26T00:00:00Z" });
  const listed = bug.filter((r) => r.kind === "practice");
  assert.deepEqual(listed.map((r) => [r.text, r.tag, r.actions.map((b) => b.label)]), [
    ["修之前先复现", "从记忆搬来", ["个人", "×", "分享给团队"]], ["同一现象再现，先回头读引擎契约", "新学到", ["项目", "×", "改成规定", "分享给团队"]], ["过四道门", "团队", []], ["回复用中文", "从记忆搬来", ["个人", "×", "写进 CLAUDE.md"]],
  ]);
  assert.equal(listed[2].why, "10-22 页签连死四次 · CLAUDE.md#build-and-check");
  assert.deepEqual(listed[0].actions[0].action, { op: "practice-layer", id: "p2", layer: "project" });
  assert.deepEqual(listed[1].actions[1].action, { op: "practice-delete", id: "p1" });
  const own = readCoachFlow("bugfix", readFileSync(new URL("../coach/bugfix.geml", import.meta.url), "utf8").replace('"fix":', '"gates": { "title": "过三道门", "description": "三项都过" }, "fix":').replace(/"reproduce": \{[^}]*\},/, ""), flow("bugfix"));
  assert.deepEqual(own.diff, { added: ["过三道门"], removed: ["复现"] });
  const changed = manualRows([item({})], flows.map((f) => (f.name === "bugfix" ? own : f)), [], t, { focus: null, expanded: null });
  assert.equal(changed.find((r) => r.key === "manual-bugfix").note, "1 件在走 · 本项目改过：比参考多「过三道门」，比参考少「复现」");
});

test("the band's line: what the last turn moved that waits on the person, with its two words and 暂缓处理; else this session's last item, what comes next and 好，做吧", () => {
  const items = [item({ id: "x9", session: "other", title: "别处的" }), item({})];
  const line = coachBand(items, flows, "s1", t);
  assert.deepEqual([line.verb, line.title, line.note, line.actions.map((b) => [b.label, b.action.op])], ["等你 · bugfix", "导出跳过不留", "你按一次跳过", [["好了", "work-meet"], ["没好", "work-meet"], ["暂缓处理", "work-hold"]]]);
  assert.deepEqual(line.more, { count: 1, detail: "别处的" }, "the others waiting on the person, any session");
  assert.equal(line.detail, "✓复现 ✓修 ✓验证 ▸你确认 ·完成 · 最后：跳过不留文件", "hovered: its cells and what it ends as");
  assert.equal(coachBand(items, flows, "nobody", t), undefined);
  assert.equal(coachBand([item({ needs: "" })], flows, "s1", t).note, "你按过说对", "no needs: the step's own requirement");
  const next = coachBand([item({ met: [m("reproduce")], next: "改一处" })], flows, "s1", t);
  assert.deepEqual([next.verb, next.note, next.actions.map((b) => [b.label, b.action])], ["bugfix", "接下来我去：改一处", [["好，做吧", { op: "work-go-on", id: "a1", next: "改一处", at: "2026-10-23T10:00:00Z" }], ["暂缓处理", { op: "work-hold", id: "a1", held: true }]]]);
  const two = coachBand([item({ at: "2026-10-23T12:00:00Z" }), item({ id: "a2", title: "工具页对齐", at: "2026-10-23T12:01:00Z" })], flows, "s1", t, "2026-10-23T11:59:00Z");
  assert.deepEqual([two.verb, two.title, two.actions.map((b) => b.label)], ["等你", "这一轮 2 件等你：导出跳过不留 · 工具页对齐", ["逐个定"]]);
});

test("好，做吧 pressed gives way to 排队中 behind a running turn, then 进行中 until its own turn ends, on the band and on the row; once the item is reported again it is offered again", () => {
  const doing = item({ met: [m("reproduce")], next: "改一处" });
  const pressedBusy = [{ id: "a1", next: "改一处", at: doing.at, wait: 1, ends: 0 }];
  const queued = coachBand([doing], flows, "s1", t, undefined, pressedBusy);
  assert.deepEqual([queued.note, queued.actions], ["排队中 改一处", []], "no button to press a second time");
  const row = (gone) => workRows([doing], flows, t, { own: "s1", gone }).find((r) => r.key === "work-a1");
  assert.deepEqual([row(pressedBusy).detail, row(pressedBusy).actions.map((b) => b.label)], ["排队中 改一处", ["标为完成", "暂缓处理"]]);
  // The running turn ends: its own turn is under way.
  const under = goneOnAfterTurn(pressedBusy);
  assert.deepEqual(under, [{ id: "a1", next: "改一处", at: doing.at, wait: 1, ends: 1 }]);
  assert.deepEqual([coachBand([doing], flows, "s1", t, undefined, under).note, row(under).detail], ["进行中 改一处", "进行中 改一处"]);
  // Its own turn ends: the press is spent, and a next step still standing is offered again.
  assert.deepEqual(goneOnAfterTurn(under), []);
  assert.deepEqual(coachBand([doing], flows, "s1", t, undefined, goneOnAfterTurn(under)).actions.map((b) => b.label), ["好，做吧", "暂缓处理"]);
  // Pressed while idle: under way at once, spent at the end of the turn it opened.
  const idle = [{ id: "a1", next: "改一处", at: doing.at, wait: 0, ends: 0 }];
  assert.equal(coachBand([doing], flows, "s1", t, undefined, idle).note, "进行中 改一处");
  assert.deepEqual(goneOnAfterTurn(idle), []);
  // The item reported again (its record changed), or another next step: the press says nothing about it.
  assert.equal(goneOnNote(item({ ...doing, at: "2026-10-23T11:00:00Z" }), pressedBusy, t), undefined);
  assert.equal(goneOnNote(item({ ...doing, next: "再改一处" }), pressedBusy, t), undefined);
});

test("the item the person's own turn took up says 我在做 and offers no 好，做吧 on the band or its row, until the turn ends or reports it again", () => {
  const on = item({ met: [m("reproduce")], next: "改一处" });
  const other = item({ id: "a2", title: "工具页对齐", met: [m("reproduce")], next: "对齐中间列", at: "2026-10-23T09:30:00Z" });
  // The turn's item is this session's last on the way, the one whose practices go beside its prompt.
  assert.equal(turnItem([on, other], "s1"), on);
  assert.equal(turnItem([on, other], "s2"), undefined);
  assert.equal(turnItem([item({ status: "done" }), other], "s1"), other);
  const doing = { id: "a1", next: "改一处", at: on.at };
  const band = coachBand([on, other], flows, "s1", t, undefined, [], doing);
  assert.deepEqual([band.note, band.actions], ["我在做：改一处", []], "no button while it is being done");
  const rows = workRows([on, other], flows, t, { own: "s1", doing });
  const row = (id) => rows.find((r) => r.key === `work-${id}`);
  assert.deepEqual([row("a1").detail, row("a1").actions.map((b) => b.label)], ["我在做：改一处", ["标为完成", "暂缓处理"]]);
  assert.deepEqual([row("a2").detail, row("a2").actions.map((b) => b.label)], ["接下来我去：对齐中间列", ["好，做吧", "标为完成", "暂缓处理"]], "the other item keeps its button");
  // Reported again during the turn: what it says next is for after this turn, and is offered.
  const again = item({ ...on, next: "跑测试", at: "2026-10-23T10:05:00Z" });
  assert.equal(doingNote(again, doing, t), undefined);
  assert.deepEqual(coachBand([again], flows, "s1", t, undefined, [], doing).actions.map((b) => b.label), ["好，做吧", "暂缓处理"]);
  // No turn of the person's running: the button as before; a press under way says so first.
  assert.deepEqual(coachBand([on], flows, "s1", t, undefined, [], null).actions.map((b) => b.label), ["好，做吧", "暂缓处理"]);
  assert.equal(coachBand([on], flows, "s1", t, undefined, [{ id: "a1", next: "改一处", at: on.at, wait: 0, ends: 0 }], doing).note, "进行中 改一处");
});

test("the work items tab: a question about no item on the way stands in 等你定 at the top, one about an item under it; a press says question：answer, the band's own words", () => {
  const asks = [{ question: "装 geml 插件吗？", options: ["装", "先不装"], recommended: "装" }, { question: "logo 用哪版？", options: ["原版", "现在的"], item: "a1" }];
  const rows = workRows([item({})], flows, t, { asks });
  assert.deepEqual(rows.map((r) => r.kind), ["section", "card", "section", "work", "card"]);
  assert.deepEqual([rows[0].text, rows[0].count], ["等你定", 1]);
  assert.deepEqual([rows[1].title, rows[1].verb, rows[1].icon], ["装 geml 插件吗？", "定", "ask"]);
  assert.deepEqual(rows[1].actions[0], { key: "ask-0-0", label: "装", primary: true, action: { op: "say", text: "装 geml 插件吗？：装", decisions: ["装 geml 插件吗？：装"] } });
  assert.equal(rows[4].title, "logo 用哪版？", "under the item it is about");
  assert.deepEqual(workRows([item({ status: "done" })], flows, t, { asks: [asks[1]] }).map((r) => r.kind), ["section", "card"], "an item no longer on the way: its question in 等你定");
  assert.deepEqual(workRows([], flows, t, {}), [], "nothing waiting, nothing on the way: no rows");
});

test("a work item's history across sessions, and what a turn did in words: the steps it met and how, a way back, being put aside, the decisions, the practices learned", () => {
  const log = (id, lines) => summarize(parseLog([{ t: "session", id, host: "claude-code", at: "2026-10-26T09:00:00Z" }, ...lines].map((e) => JSON.stringify(e)).join("\n")));
  const ev = (turn, at, over) => ({ t: "item", turn, at, id: "d1", flow: "design", title: "流程手册", state: "discuss", needs: "", goal: "", status: "open", met: [], ...over });
  const one = log("s1", [
    { t: "prompt", turn: 1, at: "2026-10-26T09:04:00Z", text: "对得上" },
    ev(1, "2026-10-26T09:05:00Z", { state: "mockup", met: [{ step: "discuss", at: "2026-10-26T09:05:00Z", turn: 1, said: "对得上" }] }),
    { t: "decision", turn: 1, at: "2026-10-26T09:05:00Z", text: "进度放在工作项上" },
  ]);
  const two = log("s2", [
    { t: "prompt", turn: 3, at: "2026-10-26T10:00:00Z", text: "要改" },
    ev(3, "2026-10-26T10:01:00Z", { state: "mockup", met: [{ step: "discuss", at: "2026-10-26T09:05:00Z", turn: 1, said: "对得上" }] }),
    { t: "prompt", turn: 4, at: "2026-10-26T11:00:00Z", text: "先放一放" },
    ev(4, "2026-10-26T11:01:00Z", { state: "mockup", status: "held", met: [{ step: "discuss", at: "2026-10-26T09:05:00Z", turn: 1, said: "对得上" }] }),
  ]);
  assert.deepEqual(itemHistory("d1", [one, two], flows, t).map((h) => h.text), ["✓讨论 · 你说「对得上」", "定：进度放在工作项上", "到「出样稿」", "已暂缓"]);
  const learned = [{ id: "p", flow: "design", step: "mockup", text: "用真实内容", why: "", at: "x", by: "model", layer: "project", session: "s1", turn: 1 }];
  assert.deepEqual(turnWords(one.turns[0], flows, learned, t), ["→ 流程手册 ✓讨论 · 你说「对得上」", "定：进度放在工作项上", "新学到：用真实内容"]);
  const rows = workRows([item({ id: "d1", flow: "design", title: "流程手册", met: [m("discuss")], goal: "一套流程" })], flows, t, { unfolded: "d1", sessions: [one, two] });
  const after = rows.slice(rows.findIndex((r) => r.key === "work-d1") + 1);
  assert.deepEqual(after.filter((r) => r.kind === "text").map((r) => r.text.replace(/^\d\d:\d\d {2}/, "")), ["✓讨论 · 你说「对得上」", "定：进度放在工作项上", "到「出样稿」", "已暂缓", "最后：一套流程"]);
  assert.deepEqual(after.find((r) => r.kind === "buttons").items.map((b) => [b.label, b.action.op]), [["看这件的提示词", "session-item"], ["看流程", "coach-go"], ["放下", "work-close"]]);
  assert.deepEqual(rows.find((r) => r.key === "work-d1").open.action, { op: "work-unfold", id: null }, "unfolded: its press folds it");
});

test("an item of a session that ended is the person's to move: taken over it is this session's and offers 好，做吧; closed it leaves the tab", () => {
  const other = item({ id: "x9", flow: "design", title: "别处的", met: [m("discuss")], next: "出样稿", session: "s2" });
  const silent = [{ id: "s2", last: "2026-10-28T00:00:00Z" }];
  const row = (rows) => rows.find((r) => r.key === "work-x9");
  assert.equal(row(workRows([other], flows, t, { own: "s1", sessions: silent, now: "2026-10-30T08:00:00Z" })).detail, "接下来我去：出样稿 · 在别的会话里（已结束）");
  assert.equal(row(workRows([other], flows, t, { own: "s1", sessions: silent, now: "2026-10-28T08:00:00Z" })).detail, "接下来我去：出样稿 · 在别的会话里", "silent less than a day: not said to be over");
  const taken = row(workRows([other], flows, t, { own: "s1" })).actions[0];
  assert.deepEqual([taken.label, taken.primary, taken.action], ["转到本会话", true, { op: "work-take", id: "x9" }]);
  // The press is one event in this session's log: the newest event names the session an item is on.
  const log = (id, events) => ({ id, host: "claude-code", started: "x", last: "x", turns: [], decisions: [], files: [], commits: [], items: events });
  const was = workItemsOf([log("s2", [{ ...holdEvent(other, false, "2026-10-26T00:00:00Z", 1), id: "x9" }])], flows)[0];
  const mine = workItemsOf([log("s2", [holdEvent(was, false, "2026-10-26T00:00:00Z", 1)]), log("s1", [closeEvent(was, "open", "2026-10-30T08:00:00Z", 2)])], flows)[0];
  assert.deepEqual([mine.session, mine.status, mine.next], ["s1", "open", "出样稿"]);
  assert.deepEqual(row(workRows([mine], flows, t, { own: "s1" })).actions.map((b) => b.label), ["好，做吧", "标为完成", "暂缓处理"]);
  for (const status of ["done", "dropped"]) {
    const closed = workItemsOf([log("s2", [holdEvent(was, false, "2026-10-26T00:00:00Z", 1)]), log("s1", [closeEvent(was, status, "2026-10-30T08:00:00Z", 2)])], flows)[0];
    assert.deepEqual([closed.status, closed.next], [status, ""]);
    assert.equal(row(workRows([closed], flows, t, { own: "s1" })), undefined, `${status}: off the tab`);
  }
});
