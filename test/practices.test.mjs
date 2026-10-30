import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isNew, newPractices, parsePractices, practicesAt, practicesText } from "../dist/core/practices.js";
import { changePractice, practicePaths, readPractices, writePractices } from "../dist/practice-store.js";
import { memoryMoveContext, practiceContext } from "../dist/hosts/claude-code/practice.js";
import { COACH_FLOWS, readCoachFlow } from "../dist/hosts/claude-code/coach.js";
import { gitRepo, hook } from "./helpers/repo.mjs";

const flows = COACH_FLOWS.map((name) => readCoachFlow(name, readFileSync(new URL(`../coach/${name}.geml`, import.meta.url), "utf8")));
const steps = flows.map((f) => ({ name: f.name, steps: f.states.map((s) => s.id) }));
const p = (over) => ({ id: "p1", flow: "bugfix", step: "fix", text: "同一现象再现，先回头读引擎契约", why: "10-22 页签连死四次", at: "2026-10-22T10:00:00Z", by: "model", layer: "project", ...over });

test("a layer's file is GEML: written and read back the same, each practice given its layer; the memory moved is in its meta", () => {
  const file = { practices: [p({}), p({ id: "p2", flow: "*", step: "*", text: "只删他点名的", deleted: true })], memoryMoved: true };
  const text = practicesText(file);
  assert.match(text, /^=== meta\ntitle = "做法"\nmemory = "moved"\n===/);
  assert.deepEqual(parsePractices(text, "project"), file);
  assert.deepEqual(parsePractices(text, "personal").practices.map((x) => x.layer), ["personal", "personal"]);
  assert.deepEqual(parsePractices("", "team"), { practices: [], memoryMoved: false });
  assert.deepEqual(parsePractices(text.replace('"by":"model"', '"by":"nobody"'), "project").practices.map((x) => x.id), ["p2"], "a line that is no practice is left out");
});

test("the practices of a step: its own first, then the flow's for every step, then the ones for any time, each newest first, not taken out, at most three", () => {
  const list = [p({ id: "a", at: "2026-10-20T00:00:00Z" }), p({ id: "b", step: "*", at: "2026-10-21T00:00:00Z" }), p({ id: "c", flow: "*", step: "*", at: "2026-10-22T00:00:00Z" }),
    p({ id: "d", at: "2026-10-23T00:00:00Z", deleted: true }), p({ id: "e", step: "verify" }), p({ id: "f", flow: "feature" }), p({ id: "g", at: "2026-10-19T00:00:00Z" })];
  assert.deepEqual(practicesAt(list, "bugfix", "fix").map((x) => x.id), ["a", "g", "b"]);
  assert.deepEqual(practicesAt(list, "bugfix", "fix", 10).map((x) => x.id), ["a", "g", "b", "c"]);
  // Many newer ones for any time, as the move from memory leaves them: the step's own still come first.
  const many = [...list, ...[1, 2, 3, 4].map((n) => p({ id: `any${n}`, flow: "*", step: "*", text: `随时 ${n}`, at: `2026-10-2${4 + n}T00:00:00Z` }))];
  assert.deepEqual(practicesAt(many, "bugfix", "fix").map((x) => x.id), ["a", "g", "b"]);
  assert.deepEqual(practicesAt(many, "bugfix", "verify").map((x) => x.id), ["e", "b", "any4"]);
});

test("practices given are checked: a text, a flow and a step the flows have; one kept, or one the person took out, is not added again", () => {
  const kept = [p({}), p({ id: "gone", text: "长命令先说一声", step: "verify", deleted: true })];
  const r = newPractices([
    { flow: "bugfix", step: "reproduce", text: "先证实跑的是哪一版", why: "10-21", layer: "project" },
    { flow: "*", step: "*", text: "回复用中文", layer: "personal", from: "memory:reply-in-chinese.md" },
    { flow: "bugfix", step: "fix", text: "同一现象再现，先回头读引擎契约" },
    { flow: "bugfix", step: "verify", text: "长命令 先说一声" },
    { flow: "release", step: "a", text: "x" },
    { flow: "bugfix", step: "nowhere", text: "x" },
    { flow: "*", step: "fix", text: "x" },
    { flow: "bugfix", step: "fix", text: "" },
  ], kept, "2026-10-26T10:00:00Z", "model", (n) => `n${n}`, steps);
  assert.deepEqual(r.added.map((x) => [x.id, x.flow, x.step, x.layer, x.from]), [["n0", "bugfix", "reproduce", "project", undefined], ["n1", "*", "*", "personal", "memory:reply-in-chinese.md"]]);
  assert.deepEqual(r.errors, [
    "practice 3: already kept", "practice 4: the person took it out; not again", "practice 5: flow must be * or one of design, feature, bugfix, optimize",
    "practice 6: bugfix has no step \"nowhere\" (reproduce, fix, verify, confirm, done)", "practice 7: a step needs its flow", "practice 8 has no text",
  ]);
  assert.equal(isNew(p({}), "2026-10-26T00:00:00Z"), true);
  assert.equal(isNew(p({ by: "memory" }), "2026-10-26T00:00:00Z"), false);
  assert.equal(isNew(p({ at: "2026-10-01T00:00:00Z" }), "2026-10-26T00:00:00Z"), false);
});

test("the layers on disk: the person's in their home, the project's beside its sessions, the team's in the repository; taken out stays, moved changes file", () => {
  const root = gitRepo();
  const home = mkdtempSync(join(tmpdir(), "gw-home-"));
  const paths = practicePaths(root, home);
  assert.deepEqual([paths.personal, paths.project, paths.team], [join(home, ".gemworks", "practices.geml"), join(root, ".geml", "practices.geml"), join(root, ".gemworks", "practices.geml")]);
  assert.deepEqual(readPractices(root, home), { practices: [], memoryMoved: false });
  writePractices(root, [p({ id: "a" }), p({ id: "b", layer: "personal", flow: "*", step: "*", text: "回复用中文" })], true, home);
  assert.deepEqual(readPractices(root, home).practices.map((x) => [x.id, x.layer]), [["a", "project"], ["b", "personal"]]);
  assert.equal(readPractices(root, home).memoryMoved, true);
  assert.equal(changePractice(root, "a", { deleted: true }, home), true);
  assert.equal(readPractices(root, home).practices.find((x) => x.id === "a").deleted, true);
  assert.equal(changePractice(root, "b", { layer: "project" }, home), true);
  assert.deepEqual(readPractices(root, home).practices.map((x) => [x.id, x.layer]), [["a", "project"], ["b", "project"]]);
  assert.equal(changePractice(root, "nobody", { deleted: true }, home), false);
});

test("the bridge answers the practices with no workflow in the project, and writes what the hooks module checked", () => {
  const root = gitRepo();
  const r = hook(root, { op: "practices" });
  assert.deepEqual([r.ok, r.practices.memoryMoved], [true, false]);
  const added = hook(root, { op: "practice-add", practices: [p({ id: "z", layer: "project" })], memory: true });
  assert.deepEqual([added.ok, added.practices.list.filter((x) => x.layer === "project").map((x) => x.id), added.practices.memoryMoved], [true, ["z"], true]);
  assert.equal(hook(root, { op: "practice-set", id: "z", deleted: true }).practices.list.find((x) => x.id === "z").deleted, true);
  assert.equal(hook(root, { op: "practice-set", id: "nope", deleted: true }).ok, false);
});

test("beside a prompt: the practices of the step this session's work item stands at; on first start, the ask to move the memory notes", () => {
  const item = { id: "a1", flow: "bugfix", title: "导出跳过不留", state: "fix", needs: "", goal: "", status: "open", at: "x", session: "s1", met: [{ step: "reproduce", at: "x", turn: 1 }], next: "" };
  assert.deepEqual(practiceContext([item], flows, [p({}), p({ id: "r", text: "改动先升小版本", ref: "CLAUDE.md#versions" })], "s1"), [
    "[gemworks] at bugfix fix 修 for «导出跳过不留», the practices: (1) 同一现象再现，先回头读引擎契约 (2) 改动先升小版本 [CLAUDE.md#versions]",
  ]);
  assert.deepEqual(practiceContext([item], flows, [p({})], "other"), [], "another session's item: nothing");
  assert.deepEqual(practiceContext([item], flows, [], "s1"), []);
  const ask = memoryMoveContext("/m", [{ file: "a.md", title: "回复中文", hook: "每条回复用中文" }]);
  assert.match(ask[0], /First start: this project's memory in \/m holds 1 notes/);
  assert.match(ask[0], /a\.md \(回复中文: 每条回复用中文\)/);
  assert.deepEqual(memoryMoveContext("/m", []), []);
});
