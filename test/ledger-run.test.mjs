// The person's ledger on a host whose model Gemworks borrows (src/ledger-run.ts), and the prompts other hosts recorded
// waiting to be labelled (corrections-store.ts recordedUnlabelled): Pi labels each typed prompt with its own model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { labelPrompt } from "../dist/ledger-run.js";
import { readLedger, recordedUnlabelled } from "../dist/corrections-store.js";
import { readSessions, recordAnswer, recordPrompt } from "../dist/session-store.js";
import { fakePi } from "./helpers/pi.mjs";
import gemworks from "../dist/hosts/pi/extension.js";
import { gitRepo } from "./helpers/repo.mjs";

// The ledger is the person's, under the home directory: a test's own.
const HOME = mkdtempSync(join(tmpdir(), "gemworks-ledger-home-"));
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;

/** A model that answers each request with the next reply, and keeps what it was asked. */
function model(...replies) {
  const asked = [];
  const complete = async (system, prompt) => { asked.push({ system, prompt }); return replies.shift(); };
  return { complete, asked };
}

test("a typed prompt labelled by the borrowed model into the ledger; a correction then asked for its theme; a reply that holds no label keeps nothing", async () => {
  const root = gitRepo();
  const m = model('[{"n": 1, "kind": "correct", "sub": "verify", "work": "ui"}]', "not json");
  assert.equal(await labelPrompt(root, { text: "按钮点了没反应，你自己点一遍", before: "做好了。", at: "2026-11-09T08:00:00.000Z", session: "s1", flow: "feature", step: "verify" }, m.complete), true);
  const row = readLedger().prompts.find((p) => p.session === "s1");
  assert.deepEqual([row.kind, row.sub, row.work, row.flow, row.step, row.by], ["correct", "verify", "ui", "feature", "verify", "model"]);
  assert.match(m.asked[0].prompt, /按钮点了没反应/);
  assert.equal(m.asked.length, 2, "a correction: its theme asked next");
  const none = model("我不知道");
  assert.equal(await labelPrompt(root, { text: "再来", before: "", at: "2026-11-09T08:10:00.000Z", session: "s2" }, none.complete), false);
  assert.equal(readLedger().prompts.some((p) => p.session === "s2"), false);
});

test("pending: the prompts other hosts recorded, the answer before each as its context, none of Claude Code's and none labelled", () => {
  const root = gitRepo();
  recordPrompt(root, "codex", "cx1", "做个看板", "2026-11-09T08:00:00.000Z");
  recordAnswer(root, "codex", "cx1", "做好了。", false, "2026-11-09T08:01:00.000Z");
  recordPrompt(root, "codex", "cx1", "按钮没反应", "2026-11-09T08:02:00.000Z");
  recordPrompt(root, "claude-code", "cc1", "不该列出", "2026-11-09T08:03:00.000Z");
  const pending = recordedUnlabelled({ prompts: [], themes: [], dismissed: [], linked: "", claim: "" }, readSessions(root), { since: "2026-11-01T00:00:00.000Z" });
  assert.deepEqual(pending.map((p) => [p.session, p.text, p.before]), [["cx1", "做个看板", ""], ["cx1", "按钮没反应", "做好了。"]]);
  const labelled = { prompts: [{ ...pending[0], kind: "task", by: "model" }], themes: [], dismissed: [], linked: "", claim: "" };
  assert.deepEqual(recordedUnlabelled(labelled, readSessions(root), { since: "2026-11-01T00:00:00.000Z" }).map((p) => p.text), ["按钮没反应"], "a labelled one is not pending");
});

test("Pi labels a typed prompt with the session's own model, behind the run; GEMWORKS_LEARN=0 asks no model", async () => {
  const dir = gitRepo();
  const was = process.cwd();
  process.chdir(dir);
  let w;
  try { w = fakePi({ dir }); gemworks(w.pi); await w.start(); } finally { process.chdir(was); }
  const asked = [];
  w.ctx.model = { id: "m" };
  w.ctx.modelRegistry = { complete: async (_model, context) => { asked.push(context); return { content: [{ type: "text", text: '[{"n": 1, "kind": "task", "sub": null, "work": "other"}]' }] }; } };
  await w.prompt("做个看板");
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(asked.length, 1);
  assert.match(asked[0].messages[0].content, /做个看板/);
  assert.ok(readLedger().prompts.some((p) => p.text === "做个看板" && p.kind === "task"));
  process.env.GEMWORKS_LEARN = "0";
  try { await w.prompt("别学这句"); await new Promise((r) => setTimeout(r, 100)); } finally { delete process.env.GEMWORKS_LEARN; }
  assert.equal(asked.length, 1, "learning off: no model asked");
});
