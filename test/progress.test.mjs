import { test } from "node:test";
import assert from "node:assert/strict";
import { progressOf } from "../dist/core/progress.js";

const feature = [
  { id: "mockup", judge: "you", final: false },
  { id: "build", judge: "model", final: false },
  { id: "verify", judge: "fact", final: false },
  { id: "confirm", judge: "you", final: false },
  { id: "done", judge: "model", final: true },
];
const cells = (p) => p.cells.map((c) => `${c.id}:${c.cell}`);

test("nothing met: it stands at the first step, whose turn by who judges it", () => {
  const p = progressOf(feature, new Set());
  assert.deepEqual([p.here, p.whose], ["mockup", "you"]);
  assert.deepEqual(cells(p), ["mockup:here", "build:ahead", "verify:ahead", "confirm:ahead", "done:ahead"]);
});

test("a step skipped: it stands after the furthest met step; the unmet one before is skipped and holds nothing", () => {
  const p = progressOf(feature, new Set(["build", "verify"]));
  assert.deepEqual([p.here, p.whose], ["confirm", "you"]);
  assert.deepEqual(cells(p), ["mockup:skipped", "build:met", "verify:met", "confirm:here", "done:ahead"]);
});

test("every step met: done, the final step met too; a way back is just fewer steps met", () => {
  const all = progressOf(feature, new Set(["mockup", "build", "verify", "confirm"]));
  assert.deepEqual([all.here, all.whose, all.cells.at(-1).cell], [null, "done", "met"]);
  assert.deepEqual([progressOf(feature, new Set(["mockup"])).here, progressOf(feature, new Set(["mockup"])).whose], ["build", "me"]);
});

test("a fact step is the model's while nothing checks it, and a wait while a check runs", () => {
  const met = new Set(["mockup", "build"]);
  assert.equal(progressOf(feature, met).whose, "me");
  assert.equal(progressOf(feature, met, new Set(["verify"])).whose, "wait");
});
