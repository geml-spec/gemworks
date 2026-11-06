import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COACH_FLOWS, readCoachFlow } from "../dist/hosts/claude-code/coach.js";
import { waitingNotices } from "../dist/hosts/claude-code/notices.js";
import { wordsFor } from "../dist/hosts/claude-code/text.js";

const t = wordsFor("zh");
const flows = COACH_FLOWS.map((name) => readCoachFlow(name, readFileSync(new URL(`../coach/${name}.geml`, import.meta.url), "utf8")));
const m = (step) => ({ step, at: "2026-11-06T09:00:00Z", turn: 1 });
const item = (over) => ({ id: "a1", flow: "bugfix", title: "回退后状态带消失", state: "confirm", needs: "", goal: "", status: "open", at: "2026-11-06T10:00:00Z", session: "s1", met: [m("reproduce"), m("fix"), m("verify")], next: "", ...over });
const ask = (question) => ({ question, options: ["是", "否"] });

test("a turn's end tells of a question the band asks and of this session's item at the person's step, each once", () => {
  const first = waitingNotices([ask("推到 main 吗？")], [item()], flows, "s1", [], t);
  assert.equal(first.ask, "等你定：推到 main 吗？");
  assert.equal(first.confirm, "等你确认：回退后状态带消失 · 你确认");
  const again = waitingNotices([ask("推到 main 吗？")], [item()], flows, "s1", first.keys, t);
  assert.deepEqual([again.ask, again.confirm], [undefined, undefined], "said once: the next turn's end stays quiet while nothing new waits");
  assert.deepEqual(again.keys, first.keys);
});

test("several new questions are one notice; an item still at the model's step, another session's, or closed says nothing", () => {
  const w = waitingNotices([ask("一"), ask("二"), ask("三")], [item({ met: [m("reproduce")] }), item({ id: "b", session: "s2" }), item({ id: "c", status: "done" })], flows, "s1", [], t);
  assert.equal(w.ask, "等你定：一（另有 2 个问题）");
  assert.equal(w.confirm, undefined);
});

test("a question settled and asked again later is told again: the keys are what stands now, not all ever said", () => {
  const w1 = waitingNotices([ask("一")], [], flows, "s1", [], t);
  const w2 = waitingNotices([], [], flows, "s1", w1.keys, t);
  assert.deepEqual(w2.keys, []);
  assert.equal(waitingNotices([ask("一")], [], flows, "s1", w2.keys, t).ask, "等你定：一");
});
