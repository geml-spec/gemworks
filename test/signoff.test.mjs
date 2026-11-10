// A work item's sign-off sheet (src/core/signoff-page.ts, src/signoff.ts): for each step of its flow, who judged it, on
// what grounds and when — the person's words or the button they pressed, the model's report, a fact step's evidence and
// the run the session saw for it — then what the work made and how it went; written into .geml/signoffs/<id>.geml, and
// among the item's artifacts once it is done.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "@geml/geml";
import { signoffPage } from "../dist/core/signoff-page.js";
import { pressEvent, seenIn, workEvents } from "../dist/core/work.js";
import { readArtifactRows } from "../dist/artifacts-store.js";
import { flowsIn } from "../dist/hosts/claude-code/coach.js";
import { wordsFor } from "../dist/hosts/claude-code/text.js";
import { coachFlowsAt, recordWork, workItemsAt } from "../dist/loop.js";
import { appendSession } from "../dist/session-store.js";
import { signoffPath, writeSignoffs } from "../dist/signoff.js";
import { gitRepo } from "./helpers/repo.mjs";

const HOME = mkdtempSync(join(tmpdir(), "gemworks-signoff-home-"));
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
// The sheets the work tool writes by itself follow the environment's language: Chinese here, whatever the runner's is.
process.env.GEMWORKS_LANG = "zh";

const AT = "2026-11-09T08:00:00.000Z";
const errorsOf = (text) => (parse(text).diagnostics ?? []).filter((d) => d.severity === "error");
const clock = (iso) => iso.slice(5, 16).replace("T", " ");
const day = (iso) => iso.slice(0, 16).replace("T", " ");
const flowsOf = (root) => coachFlowsAt(root);

test("a fact step met with its evidence keeps it and the run the session saw; a press keeps its button's words", () => {
  const root = gitRepo();
  const flows = flowsOf(root);
  const runs = [
    { command: "npm test", exit: 1, at: "2026-11-09T07:50:00.000Z" },
    { command: "npm test", exit: 0, at: "2026-11-09T07:58:00.000Z" },
    { command: "git status", exit: 0, at: AT },
  ];
  const r = workEvents({ items: [{ title: "导出", flow: "feature", met: ["mockup", "build", "verify"], said: "行", evidence: "`npm test` exit 0" }] }, flows, [], AT, 3, (n) => `i${n}`, runs);
  assert.deepEqual(r.errors, []);
  const met = r.events[0].met;
  const verify = met.find((m) => m.step === "verify");
  assert.deepEqual([verify.evidence, verify.seen], ["`npm test` exit 0", runs[1]], "the newest run the evidence names");
  assert.equal(met.find((m) => m.step === "build").evidence, undefined, "a step the model judges keeps no evidence");
  assert.equal(met.find((m) => m.step === "mockup").said, "行");
  assert.equal(seenIn("ran `cargo test` once", runs), undefined, "a command this session never ran is not seen");
  const bare = workEvents({ items: [{ title: "导出", flow: "feature", met: ["mockup", "build", "verify"], said: "行" }] }, flows, [], AT, 3, (n) => `i${n}`, runs);
  assert.equal(bare.events[0].met.find((m) => m.step === "verify").evidence, undefined, "no evidence given: none kept");
  const item = { id: "i0", flow: "feature", title: "导出", state: "confirm", needs: "", goal: "", status: "open", at: AT, session: "s", met, next: "" };
  const pressed = pressEvent(item, flows.find((f) => f.name === "feature"), "confirm", true, AT, 4, "好了");
  assert.deepEqual(pressed.met.find((m) => m.step === "confirm"), { step: "confirm", at: AT, turn: 4, pressed: true, said: "好了" });
  assert.equal(pressed.status, "done");
});

test("the sheet: each step, who judged it, on what grounds and when; what the work made; the way it went — and it parses", () => {
  const root = gitRepo();
  const flows = flowsOf(root);
  const met = [
    { step: "mockup", at: "2026-11-09T08:00:00.000Z", turn: 1, said: "行" },
    { step: "build", at: "2026-11-09T09:00:00.000Z", turn: 2 },
    { step: "verify", at: "2026-11-09T09:10:00.000Z", turn: 3, evidence: "`npm test` exit 0", seen: { command: "npm test", exit: 0, at: "2026-11-09T09:09:00.000Z" } },
    { step: "confirm", at: "2026-11-09T10:00:00.000Z", turn: 4, pressed: true, said: "好了" },
  ];
  const item = { id: "a1", flow: "feature", title: "导出 | *粗*", state: "done", needs: "截图待补", goal: "跳过不留文件", status: "done", at: AT, session: "s", met, next: "" };
  const commits = [{ sha: "abc1234def5678", subject: "feat: export", at: "2026-11-09T08:30:00.000Z" }];
  const artifacts = [
    { item: "a1", kind: "link", name: "样式页", where: "https://example.com/p", version: "2", size: null, at: "2026-11-09T08:40:00.000Z", sha256: "" },
    { item: "a1", kind: "file", name: "验收单.geml", where: "artifacts/x-验收单.geml", version: "1", size: 1, at: "2026-11-09T10:00:00.000Z", sha256: "h" },
  ];
  const zh = wordsFor("zh");
  const page = signoffPage({ item, flow: flowsIn(flows, zh).find((f) => f.name === "feature"), opened: AT, commits, artifacts, clock, day, t: zh, self: "验收单.geml" });
  assert.deepEqual(errorsOf(page), [], "the page parses with no error, whatever the title holds");
  for (const line of [
    'status = "已完成"', 'closed = "2026-11-09 10:00"', "已完成：4 步都过了。还记着：截图待补", "目标：跳过不留文件",
    "| 样稿 | 你判 | 你的原话：「行」 | 11-09 08:00 |",
    "| 实现 | 模型判 | 模型在第 2 轮报告做完 | 11-09 09:00 |",
    "| 验证 | 事实 | 模型给的凭据：\\`npm test\\` exit 0；本会话看到 `npm test` 退出码 0（11-09 09:09） | 11-09 09:10 |",
    "| 你确认 | 你判 | 你按了「好了」 | 11-09 10:00 |",
    "| abc1234 feat: export | 提交 | 11-09 08:30 |", "| 样式页 (2) | 链接 | 11-09 08:40 |",
    "- 11-09 08:00 开始，按「新功能」流程走", "- 11-09 10:00 已完成",
  ]) assert.ok(page.includes(line), line);
  assert.ok(!page.includes("验收单.geml"), "the sheet leaves itself out of its own list");
  const open = signoffPage({ item: { ...item, status: "open", state: "verify", needs: "", met: met.slice(0, 2) }, flow: flowsIn(flows, zh).find((f) => f.name === "feature"), opened: AT, commits: [], artifacts: [], clock, day, t: zh });
  assert.ok(open.includes("进行中：停在「验证」。") && open.includes("| 验证 | 事实 | 还没过 |  |") && !open.includes("closed ="), "an item on the way: where it stands, no close");
  const unseen = signoffPage({ item: { ...item, met: [...met.slice(0, 2), { step: "verify", at: AT, turn: 3, evidence: "CI run 42" }, met[3]] }, flow: flowsIn(flows, zh).find((f) => f.name === "feature"), opened: AT, commits: [], artifacts: [], clock, day, t: zh });
  assert.ok(unseen.includes("模型给的凭据：CI run 42；本会话没看到这条命令"));
  const reported = signoffPage({ item: { ...item, met: [...met.slice(0, 2), { step: "verify", at: AT, turn: 3 }, met[3]] }, flow: flowsIn(flows, zh).find((f) => f.name === "feature"), opened: AT, commits: [], artifacts: [], clock, day, t: zh });
  assert.ok(reported.includes("只有模型的报告（第 3 轮）"), "a fact step with nothing but the model's word says so");
  const en = wordsFor("en");
  const english = signoffPage({ item, flow: flowsIn(flows, en).find((f) => f.name === "feature"), opened: AT, commits, artifacts, clock, day, t: en, self: "验收单.geml" });
  assert.deepEqual(errorsOf(english), []);
  assert.ok(english.includes("Sign-off · #a1") && english.includes("| Verify | Fact | The model's evidence:") && english.includes("You pressed “好了”"));
  assert.ok(!/[一-鿿]/.test(english.replace(/导出|粗|截图待补|跳过不留文件|样式页|行|好了/g, "")), "no Chinese of the sheet's own in English");
});

test("the work tool writes the item's sheet; a commit of its turns is on it; done, it goes among the item's artifacts once", () => {
  const root = gitRepo();
  const first = recordWork(root, "codex", "cx1", { items: [{ title: "导出跳过", flow: "feature", met: ["mockup"], said: "行", needs: "实现" }] }, AT);
  assert.equal(first.ok, true, first.text);
  const [item] = workItemsAt(root, flowsOf(root));
  const path = signoffPath(root, item.id);
  assert.ok(existsSync(path), "written with the item's first report");
  assert.ok(readFileSync(path, "utf8").includes("进行中：停在「实现」。"));
  assert.equal(readArtifactRows(root).some((r) => r.item === item.id), false, "on the way: not among its artifacts yet");
  appendSession(root, "codex", "cx1", (so) => [{ t: "commit", turn: so.filter((e) => e.t === "item").at(-1).turn, at: "2026-11-09T08:05:00.000Z", sha: "abc1234def5678", subject: "feat: skip" }], AT);
  const done = recordWork(root, "codex", "cx1", { items: [{ id: item.id, title: "导出跳过", flow: "feature", met: ["mockup", "build", "verify", "confirm"], said: "对", evidence: "`npm test` exit 0" }] }, "2026-11-09T09:00:00.000Z");
  assert.equal(done.ok, true, done.text);
  const sheet = readFileSync(path, "utf8");
  assert.ok(sheet.includes('status = "已完成"') && sheet.includes("| abc1234 feat: skip | 提交 |"), "finished, with the commit of its turns");
  assert.ok(sheet.includes("模型给的凭据：\\`npm test\\` exit 0；本会话没看到这条命令"), "a host that reports no runs: the evidence, unseen");
  const kept = () => readArtifactRows(root).filter((r) => r.item === item.id && r.name === "验收单.geml");
  assert.equal(kept().length, 1, "done: the sheet among the item's artifacts");
  writeSignoffs(root, [item.id], "zh");
  assert.equal(kept().length, 1, "nothing new to say: no second version");
  assert.equal(readFileSync(join(root, ".geml", "signoffs", `${item.id}.geml`), "utf8"), sheet);
});
