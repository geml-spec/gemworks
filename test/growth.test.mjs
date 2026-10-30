import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COACH_FLOWS, manualRows, readCoachFlow } from "../dist/hosts/claude-code/coach.js";
import { applyToFlow, expireEvent, expiring, flowText, isRulesFile, newFlow, newProposals, parseProposals, parseRules, proposalsText, ruleAsk, ruleRefusal, rulesText, skippedSteps, stepId } from "../dist/hosts/claude-code/growth.js";
import { wordsFor } from "../dist/hosts/claude-code/text.js";

const t = wordsFor("zh");
const flows = COACH_FLOWS.map((name) => readCoachFlow(name, readFileSync(new URL(`../coach/${name}.geml`, import.meta.url), "utf8")));
const flow = (name) => flows.find((f) => f.name === name);
const m = (step, over = {}) => ({ step, at: "2026-10-26T09:00:00Z", turn: 1, ...over });
const item = (over) => ({ id: "a1", flow: "bugfix", title: "导出跳过不留", state: "verify", needs: "", goal: "", status: "open", at: "2026-10-26T10:00:00Z", session: "s1", met: [m("reproduce"), m("fix")], next: "", ...over });

test("the model's proposals are checked: a step after one the flow has, a new kind of work with its steps; one proposed before is not again", () => {
  const r = newProposals([
    { kind: "add-step", flow: "feature", after: "verify", title: "过三道门", need: "三项都过", judge: "fact", prevents: "带着类型错发出去", why: "bugfix 每次都过" },
    { kind: "new-flow", name: "release", title: "发版", steps: [{ title: "升版本", judge: "model" }, { title: "推送", need: "你点头", judge: "you" }], why: "连着三件归不进" },
    { kind: "add-step", flow: "feature", after: "done", title: "x", why: "" },
    { kind: "add-step", flow: "nowhere", after: "a", title: "x", why: "" },
    { kind: "new-flow", title: "空的", steps: [], why: "" },
    { kind: "rename", why: "" },
  ], flows, [], "2026-10-26T10:00:00Z", (n) => `q${n}`);
  assert.deepEqual(r.added.map((p) => [p.id, p.kind, p.flow, p.after ?? "", p.step?.title ?? p.title, p.status, p.by]), [
    ["q0", "add-step", "feature", "verify", "过三道门", "open", "model"], ["q1", "new-flow", "release", "", "发版", "open", "model"],
  ]);
  assert.deepEqual(r.added[1].steps.map((s) => [s.title, s.judge]), [["升版本", "model"], ["推送", "you"]]);
  assert.deepEqual(r.errors, ["proposal 3: feature has no step \"done\" to add after", "proposal 4: no flow \"nowhere\"", "proposal 5: a new kind of work needs its title and its steps", "proposal 6: kind must be add-step or new-flow"]);
  assert.deepEqual(newProposals([{ kind: "add-step", flow: "feature", after: "verify", title: "过三道门", why: "" }], flows, r.added, "x", () => "z").errors, ["proposal 1: already proposed"]);
  assert.deepEqual(parseProposals(proposalsText(r.added)), r.added, "the file reads back the same");
  assert.match(stepId("过三道门", []), /^s[0-9a-z]+$/);
  assert.equal(stepId("Sync Dev", ["sync-dev"]), "sync-dev-2");
});

test("a flow changed by a proposal: a step added after another, the way on through it; a step taken out, its ways joined around it; written back as the project's own and read the same", () => {
  const feat = flow("feature");
  const added = applyToFlow(feat, { kind: "add-step", after: "verify", step: { id: "gates", title: "过三道门", need: "三项都过", judge: "fact", prevents: "带着类型错发出去" } });
  assert.deepEqual(added.states.map((s) => s.id), ["mockup", "build", "verify", "gates", "confirm", "done"]);
  assert.deepEqual(added.edges.filter((e) => !e.back).map((e) => `${e.from}>${e.to}`), ["mockup>build", "build>verify", "verify>gates", "gates>confirm", "confirm>done"]);
  const read = readCoachFlow("feature", flowText(added), feat);
  assert.deepEqual(read.states.map((s) => [s.id, s.judge, s.expires === true]), added.states.map((s) => [s.id, s.judge, s.expires === true]));
  assert.deepEqual(read.diff, { added: ["过三道门"], removed: [] });
  assert.deepEqual(read.edges.filter((e) => e.back).map((e) => [e.from, e.to, e.label]), [["confirm", "build", "你说不对"], ["confirm", "mockup", "方向不对"]]);
  const removed = applyToFlow(feat, { kind: "remove-step", remove: "mockup" });
  assert.deepEqual(removed.states.map((s) => s.id), ["build", "verify", "confirm", "done"]);
  assert.deepEqual(removed.edges.filter((e) => e.back).map((e) => [e.from, e.to]), [["confirm", "build"], ["confirm", "build"]], "a way back into the step taken out goes to the step after it");
  const fresh = readCoachFlow("release", flowText(newFlow({ flow: "release", title: "发版", steps: [{ id: "bump", title: "升版本", need: "", judge: "model", prevents: "" }, { id: "push", title: "推送", need: "你点头", judge: "you", prevents: "" }] })));
  assert.deepEqual([fresh.title, fresh.states.map((s) => s.id), fresh.states[1].judge], ["发版", ["bump", "push", "done"], "you"]);
});

test("gemworks proposes taking out a step skipped in most of a flow's recent finished items; one declined is not proposed again", () => {
  const done = (n, met) => item({ id: `d${n}`, status: "done", at: `2026-10-2${n}T00:00:00Z`, met: met.map((s) => m(s)) });
  const items = [done(1, ["fix", "verify", "confirm"]), done(2, ["fix", "verify", "confirm"]), done(3, ["fix", "verify", "confirm"]), done(4, ["reproduce", "fix", "verify", "confirm"]), done(5, ["fix", "verify", "confirm"])];
  assert.deepEqual(skippedSteps(items, flows, []), [{ flow: "bugfix", step: "reproduce", skipped: 4 }]);
  assert.deepEqual(skippedSteps(items.slice(1), flows, []), [], "fewer than five finished: too few to tell");
  assert.deepEqual(skippedSteps(items, flows, [{ id: "k", kind: "remove-step", flow: "bugfix", remove: "reproduce", why: "", at: "x", by: "gemworks", status: "declined" }]), []);
});

test("a rule holds a call matching its key while the step it requires is unmet on this session's work item; the rules files are the person's", () => {
  const rules = [{ id: "r1", flow: "bugfix", requires: "verify", key: "Bash(node scripts/sync-dev.mjs*)", text: "三道门都过才同步", why: "0.2.55", at: "x", layer: "project" }];
  assert.deepEqual(parseRules(rulesText(rules), "project"), rules);
  const held = ruleRefusal(rules, item({}), flows, ["Bash(node scripts/sync-dev.mjs ../dev)"]);
  assert.equal(held.reason, "规定：三道门都过才同步（「导出跳过不留」的「验证」还没满足）");
  assert.equal(ruleRefusal(rules, item({ met: [m("reproduce"), m("fix"), m("verify")] }), flows, ["Bash(node scripts/sync-dev.mjs ../dev)"]), undefined, "the step met: through");
  assert.equal(ruleRefusal(rules, item({}), flows, ["Bash(npm test)"]), undefined, "another call: through");
  assert.equal(ruleRefusal(rules, item({ flow: "feature" }), flows, ["Bash(node scripts/sync-dev.mjs x)"]), undefined, "another flow's item: through");
  assert.equal(ruleRefusal(rules, undefined, flows, ["Bash(node scripts/sync-dev.mjs x)"]), undefined, "no work item on the way: through");
  for (const p of ["C:\\w\\.geml\\rules.geml", "/w/.gemworks/rules.geml"]) assert.equal(isRulesFile(p), true, p);
  assert.equal(isRulesFile("/w/docs/rules.geml"), false);
  assert.match(ruleAsk({ id: "p1", flow: "bugfix", step: "fix", text: "三道门都过才同步" }, "bugfix", "修"), /改成规定（bugfix · 修，id p1）/);
});

test("a fact that expires is taken back once the work changes after it; one that does not, stays", () => {
  const i = item({ met: [m("reproduce"), m("fix"), m("verify")] });
  assert.deepEqual(expiring(i, flow("bugfix")), ["verify"]);
  const ev = expireEvent(i, ["verify"], "改过，要重跑", "2026-10-26T11:00:00Z", 4);
  assert.deepEqual([ev.met.map((x) => x.step), ev.needs, ev.turn], [["reproduce", "fix"], "改过，要重跑", 4]);
  assert.deepEqual(expiring(item({ flow: "optimize", met: [m("baseline")] }), flow("optimize")), [], "the baseline does not expire");
});

test("the manual shows the proposals on their flow and a new kind of work on top, the rules on the step they require, 改成规定 on a step's practice", () => {
  const proposals = [
    { id: "q0", kind: "add-step", flow: "bugfix", after: "verify", step: { id: "gates", title: "过三道门", need: "三项都过", judge: "fact", prevents: "" }, why: "每次都过", at: "x", by: "model", status: "open" },
    { id: "q1", kind: "new-flow", flow: "release", title: "发版", steps: [{ id: "bump", title: "升版本", need: "", judge: "model", prevents: "" }], why: "", at: "x", by: "model", status: "open" },
    { id: "q2", kind: "add-step", flow: "bugfix", after: "fix", step: { id: "y", title: "答过的", need: "", judge: "model", prevents: "" }, why: "", at: "x", by: "model", status: "declined" },
  ];
  const rules = [{ id: "r1", flow: "bugfix", requires: "verify", key: "Bash(x*)", text: "三道门都过才同步", why: "", at: "x", layer: "project", held: 2 }];
  const practices = [{ id: "p1", flow: "bugfix", step: "fix", text: "先读契约", why: "", at: "x", by: "person", layer: "project" }];
  const rows = manualRows([item({})], flows, practices, t, { focus: null, expanded: ["bugfix"], proposals, rules, skipped: [{ flow: "bugfix", step: "reproduce", skipped: 4 }] });
  const cards = rows.filter((r) => r.kind === "card").map((r) => [r.title, r.actions.map((b) => b.label)]);
  assert.deepEqual(cards, [["新的一类活「发版」：升版本", ["加上", "不用"]], ["在「验证」后面加一步「过三道门」", ["加上", "不用"]], ["「复现」最近 5 件里 4 件跳过了，删掉这一步吗？", ["删掉", "留着"]]]);
  assert.deepEqual(rows.find((r) => r.key === "step-bugfix-verify").rules, ["规定：三道门都过才同步 · 拦过 2 次"]);
  assert.deepEqual(rows.find((r) => r.key === "practice-p1").actions.map((b) => [b.label, b.action]), [["项目", { op: "practice-layer", id: "p1", layer: "personal" }], ["改成规定", { op: "practice-rule", id: "p1" }], ["分享给团队", { op: "practice-share", id: "p1" }]]);
});

test("a flow exported is one GEML file: its route reads back as the flow, its practices and rules ride along, the person's own stay home", async () => {
  const { parsePractices } = await import("../dist/core/practices.js");
  const { exportText, referenceName } = await import("../dist/hosts/claude-code/growth.js");
  const practices = [
    { id: "p1", flow: "bugfix", step: "fix", text: "先读契约", why: "10-22", at: "x", by: "model", layer: "project", session: "s1", turn: 3 },
    { id: "p2", flow: "bugfix", step: "fix", text: "回复用中文", why: "", at: "x", by: "memory", layer: "personal" },
    { id: "p3", flow: "feature", step: "build", text: "别的流程的", why: "", at: "x", by: "model", layer: "project" },
  ];
  const rules = [{ id: "r1", flow: "bugfix", requires: "verify", key: "Bash(x*)", text: "过了才同步", why: "", at: "x", layer: "project", held: 3 }];
  const text = exportText(flow("bugfix"), practices, rules);
  assert.deepEqual(readCoachFlow("bugfix", text).states.map((s) => s.id), flow("bugfix").states.map((s) => s.id));
  assert.deepEqual(parsePractices(text, "team").practices.map((p) => [p.id, p.session]), [["p1", undefined]], "the person's own and other flows' stay out; where it was learned stays home");
  assert.deepEqual(parseRules(text, "team").map((r) => [r.id, r.held]), [["r1", undefined]]);
  assert.equal(referenceName("/x/exports/flow-bugfix.geml", "ref"), "bugfix");
  assert.equal(referenceName("C:\\x\\中文.geml", "ref"), "ref");
});

test("a reference offers back each step it has that the project's flow lacks, after the step before it; a kind of work the project lacks, as a new one; not twice", async () => {
  const { referenceProposals } = await import("../dist/hosts/claude-code/growth.js");
  const ref = applyToFlow(flow("feature"), { kind: "add-step", after: "verify", step: { id: "gates", title: "过三道门", need: "三项都过", judge: "fact", prevents: "带着类型错发出去" } });
  const offered = referenceProposals(ref, "team-x", flows, [], "x", (n) => `f${n}`);
  assert.deepEqual(offered.map((p) => [p.kind, p.flow, p.after, p.step.id, p.by, p.ref]), [["add-step", "feature", "verify", "gates", "reference", "team-x"]]);
  assert.deepEqual(referenceProposals(ref, "team-x", flows, offered, "x", () => "g"), [], "offered once");
  const other = { ...newFlow({ flow: "release", title: "发版", steps: [{ id: "bump", title: "升版本", need: "", judge: "model", prevents: "" }] }) };
  assert.deepEqual(referenceProposals(other, "release", flows, [], "x", (n) => `h${n}`).map((p) => [p.kind, p.flow, p.title]), [["new-flow", "release", "发版"]]);
});

test("practices shared with the team move into the repository's .gemworks/; the bridge does it with no workflow in the project", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { readPractices, sharePractices, writePractices } = await import("../dist/practice-store.js");
  const { gitRepo, hook } = await import("./helpers/repo.mjs");
  const root = gitRepo();
  const home = mkdtempSync(join(tmpdir(), "gw-home-"));
  writePractices(root, [{ id: "a", flow: "bugfix", step: "fix", text: "先读契约", why: "", at: "x", by: "model", layer: "project", session: "s", turn: 1 }], false, home);
  assert.equal(sharePractices(root, ["a", "nobody"], home), 1);
  assert.deepEqual(readPractices(root, home).practices.map((p) => [p.id, p.layer, p.session]), [["a", "team", undefined]]);
  // A home of its own (HOME on POSIX, USERPROFILE on Windows): the machine's personal practices are not this test's.
  const empty = mkdtempSync(join(tmpdir(), "gw-home-"));
  const r = hook(gitRepo(), { op: "practice-share", ids: ["x"] }, { HOME: empty, USERPROFILE: empty });
  assert.deepEqual([r.ok, r.practices.list], [true, []]);
});

test("the manual offers to share and export each flow, to share a step's practice or write one for every time into CLAUDE.md, and a field to import a reference", async () => {
  const { inputAction } = await import("../dist/hosts/claude-code/board.js");
  const practices = [{ id: "p1", flow: "bugfix", step: "fix", text: "先读契约", why: "", at: "x", by: "person", layer: "project" }, { id: "p2", flow: "*", step: "*", text: "回复用中文", why: "", at: "x", by: "person", layer: "personal" }];
  const rows = manualRows([item({})], flows, practices, t, { focus: null, expanded: ["bugfix", "*"] });
  assert.deepEqual(rows.find((r) => r.key === "manual-bugfix").actions.map((b) => [b.label, b.action]), [["分享给团队", { op: "flow-share", flow: "bugfix" }], ["导出", { op: "flow-export", flow: "bugfix" }]]);
  assert.deepEqual(rows.find((r) => r.key === "practice-p1").actions.map((b) => b.label), ["项目", "改成规定", "分享给团队"]);
  assert.deepEqual(rows.find((r) => r.key === "practice-p2").actions.map((b) => [b.label, b.action.op]), [["个人", "practice-layer"], ["写进 CLAUDE.md", "practice-claude-md"]]);
  assert.equal(rows.at(-1).field, "import-reference");
  assert.deepEqual(inputAction("import-reference", "  ../other/.gemworks  "), { op: "reference-import", path: "../other/.gemworks" });
});
