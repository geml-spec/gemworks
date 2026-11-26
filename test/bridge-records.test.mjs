// What the bridge records for a work item and reads from the host's transcripts: the artifact and artifacts ops,
// backfill-list, backfill-one and turn-ids, with a workflow and without.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gitRepo, hook, withWorkflow } from "./helpers/repo.mjs";
import { slugOf } from "../dist/core/transcript.js";
import { parseLog, summarize } from "../dist/core/session-log.js";
import { readArtifactRows } from "../dist/store/artifacts.js";

const WS_DEV = fileURLToPath(new URL("./fixtures/ws-dev/", import.meta.url));

/** A project on `branch` ignoring out/ (with the dev workflow unless `workflow: false`), and a transcripts folder with its slug. */
function project({ branch = "feat/x", workflow = true } = {}) {
  const root = gitRepo(branch);
  writeFileSync(join(root, ".gitignore"), "out/\n.geml/\n");
  mkdirSync(join(root, "out"), { recursive: true });
  if (workflow) withWorkflow(root, WS_DEV, "dev");
  const transcripts = mkdtempSync(join(tmpdir(), "gemworks-transcripts-"));
  const slug = join(transcripts, slugOf(resolve(root)));
  mkdirSync(slug, { recursive: true });
  return { root, transcripts, slug };
}
/** A home folder of its own: what the bridge keeps under ~ (its trash) goes there, not into the machine's. */
const ownHome = () => {
  const home = mkdtempSync(join(tmpdir(), "gemworks-home-"));
  return { home, env: { HOME: home, USERPROFILE: home } };
};

const rec = (root, o) => JSON.stringify({ sessionId: "s-1", cwd: root, gitBranch: "feat/x", isSidechain: false, ...o });
const user = (root, uuid, at, content, over = {}) => rec(root, { type: "user", uuid, timestamp: at, message: { content }, ...over });
const assistant = (root, at, content, over = {}) => rec(root, { type: "assistant", timestamp: at, message: { content }, ...over });
const result = (root, at, id, text) => rec(root, { type: "user", timestamp: at, message: { content: [{ type: "tool_result", tool_use_id: id, content: text }] } });

test("artifact: a link named by its published page's <title>, or by the page file's name when it has none to read", () => {
  const { root } = project();
  mkdirSync(join(root, "site"));
  writeFileSync(join(root, "site", "index.html"), "<html><head><title>Launch page</title></head></html>");
  writeFileSync(join(root, "site", "notes.txt"), "no title in here");
  assert.equal(hook(root, { op: "artifact", kind: "link", where: "https://example.com/launch", page: "site/index.html" }).text, "Recorded the link under feat/x's artifacts.");
  hook(root, { op: "artifact", kind: "link", where: "https://example.com/notes", page: "site/notes.txt" });
  assert.deepEqual(readArtifactRows(root).map((r) => [r.kind, r.name, r.where]), [["link", "Launch page", "https://example.com/launch"], ["link", "notes", "https://example.com/notes"]]);
});

test("artifact: an empty where and empty data are refused; an upload with no name is named by its bytes' hash", () => {
  const { root } = project();
  const blank = hook(root, { op: "artifact", kind: "link", where: "   " });
  assert.deepEqual([blank.ok, blank.error], [false, "where is empty: give the link's address or the file's path"]);
  const empty = hook(root, { op: "artifact", kind: "file", where: "x", data: "" });
  assert.deepEqual([empty.ok, empty.error], [false, "data is empty"]);
  const up = hook(root, { op: "artifact", kind: "file", where: "pasted", data: Buffer.from("pasted words").toString("base64") });
  assert.match(up.text, /^Recorded upload\/upload-[0-9a-f]{8} under feat\/x's artifacts\.$/, "no name, no media type: the hash alone, no extension");
});

test("artifact: a file is recorded by its project path, a version each time its content changes, nothing when it has not", () => {
  const { root } = project();
  writeFileSync(join(root, "out", "report.md"), "# report\n");
  assert.equal(hook(root, { op: "artifact", kind: "file", where: "out/report.md" }).text, "Recorded out/report.md (version 1) under feat/x's artifacts.");
  assert.equal(hook(root, { op: "artifact", kind: "file", where: "out/report.md" }).text, "Nothing new to record: no file there, or this version is recorded already.");
  assert.equal(hook(root, { op: "artifact", kind: "file", where: "out/missing.md" }).text, "Nothing new to record: no file there, or this version is recorded already.");
});

test("artifact on a branch that is no work item goes under the item the turn names, in the project's table", () => {
  const { root } = project({ branch: "main" });
  assert.equal(hook(root, { op: "status" }).shell.status.item.kind, "inactive");
  assert.equal(hook(root, { op: "artifact", kind: "link", where: "https://example.com/plan", name: "Plan", item: "chore/plan" }).text, "Recorded the link under chore/plan's artifacts.");
  assert.deepEqual(readArtifactRows(root).map((r) => [r.item, r.name]), [["chore/plan", "Plan"]]);
  assert.equal(hook(root, { op: "artifact", kind: "link", where: "https://example.com/plan" }).ok, false, "no item named: nothing to record it under");
});

test("artifacts with no workflow: a draft that went to git commit as its message is taken out again, its copy moved to the trash", () => {
  const { root } = project({ workflow: false });
  const { home, env } = ownHome();
  writeFileSync(join(root, "out", "msg.md"), "feat: a commit message\n");
  assert.equal(hook(root, { op: "artifact", kind: "file", where: "out/msg.md", item: "feat/x" }).ok, true);
  assert.equal(readArtifactRows(root).length, 1);
  const r = hook(root, { op: "artifacts", item: "feat/x", notMade: [join(root, "out", "msg.md")] }, env);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(readArtifactRows(root), [], "not for the person after all");
  const trash = join(home, ".gemworks", "trash");
  const [stamp] = readdirSync(trash);
  assert.match(stamp, /-artifacts$/, "the copy went to the trash, under one stamp");
  const [copy] = readdirSync(join(trash, stamp));
  assert.match(readFileSync(join(trash, stamp, copy), "utf8"), /a commit message/);
});

test("backfill-list with no transcripts folder named reads the home's, and a project it has none for lists none", () => {
  const { root } = project();
  const { env } = ownHome();
  const r = hook(root, { op: "backfill-list" }, env);
  assert.deepEqual([r.ok, r.backfill.sessions], [true, []]);
});

test("backfill-one with no workflow: a file that holds no session is an error answer with the shell", () => {
  const { root, slug, transcripts } = project({ workflow: false });
  writeFileSync(join(slug, "odd.jsonl"), JSON.stringify({ type: "summary", summary: "nothing here" }) + "\n");
  const r = hook(root, { op: "backfill-one", file: join(slug, "odd.jsonl"), transcripts });
  assert.deepEqual([r.ok, r.error, r.shell.status], [false, "odd.jsonl holds no session", null]);
});

test("backfill-one: a transcript naming no session is named by its file; a later read adds the turns written since after the ones it has", () => {
  const { root, slug, transcripts } = project();
  const file = join(slug, "named-by-file.jsonl");
  const first = [user(root, "u1", "2026-10-20T01:00:01Z", "第一问", { sessionId: undefined }), assistant(root, "2026-10-20T01:00:05Z", [{ type: "text", text: "一答" }], { sessionId: undefined })];
  writeFileSync(file, first.join("\n") + "\n");
  assert.deepEqual(hook(root, { op: "backfill-one", file, transcripts }).backfill, { id: "named-by-file", turns: 1, files: 0, links: 0 });
  writeFileSync(file, [...first, user(root, "u2", "2026-10-20T02:00:01Z", "第二问", { sessionId: undefined }), assistant(root, "2026-10-20T02:00:05Z", [{ type: "text", text: "二答" }], { sessionId: undefined })].join("\n") + "\n");
  assert.deepEqual(hook(root, { op: "backfill-one", file, transcripts }).backfill, { id: "named-by-file", turns: 1, files: 0, links: 0 });
  const s = summarize(parseLog(readFileSync(join(root, ".geml", "sessions", "claude-code-named-by-file.geml"), "utf8")));
  assert.deepEqual(s.turns.map((t) => [t.turn, t.prompt, t.answer, t.backfilled]), [[1, "第一问", "一答", true], [2, "第二问", "二答", true]]);
});

test("backfill-one under a branch workflow: what each turn made goes under its branch — a page with no title or version, a picture, an upload; a file git keeps and a turn on no branch are not artifacts", () => {
  const { root, slug, transcripts } = project();
  spawnSync("git", ["-C", root, "add", ".gitignore"]);
  writeFileSync(join(root, "README.md"), "# kept by git\n");
  spawnSync("git", ["-C", root, "add", "README.md"]);
  spawnSync("git", ["-C", root, "commit", "-qm", "docs"]);
  writeFileSync(join(root, "out", "pic.png"), "not really a png");
  writeFileSync(join(root, "out", "lost.md"), "# written on no branch\n");
  const png = Buffer.from("png bytes").toString("base64");
  const gone = join(root, "no-such-dir");
  writeFileSync(join(slug, "s-1.jsonl"), [
    user(root, "u1", "2026-10-20T01:00:01Z", [{ type: "text", text: "画一张图" }, { type: "image", source: { type: "base64", media_type: "image/png", data: png } }], { cwd: gone }),
    assistant(root, "2026-10-20T01:00:05Z", [{ type: "tool_use", id: "w1", name: "Write", input: { file_path: join(root, "out", "pic.png") } }, { type: "tool_use", id: "w2", name: "Write", input: { file_path: join(root, "README.md") } }]),
    result(root, "2026-10-20T01:00:06Z", "w1", "ok"),
    result(root, "2026-10-20T01:00:06Z", "w2", "ok"),
    assistant(root, "2026-10-20T01:00:09Z", [{ type: "tool_use", id: "a1", name: "Artifact", input: {} }]),
    result(root, "2026-10-20T01:00:10Z", "a1", "Published it at https://claude.ai/artifact/Bx7q"),
    user(root, "u2", "2026-10-20T01:05:00Z", "再写一份", { gitBranch: "" }),
    assistant(root, "2026-10-20T01:05:02Z", [{ type: "tool_use", id: "w3", name: "Write", input: { file_path: join(root, "out", "lost.md") } }]),
  ].join("\n") + "\n");
  const r = hook(root, { op: "backfill-one", file: join(slug, "s-1.jsonl"), transcripts });
  assert.deepEqual(r.backfill, { id: "s-1", turns: 2, files: 2, links: 1 });
  const rows = readArtifactRows(root);
  assert.deepEqual(rows.map((x) => [x.item, x.kind, x.name.replace(/[0-9a-f]{8}/, "<hash>"), x.version]), [
    ["feat/x", "link", "https://claude.ai/artifact/Bx7q", ""],
    ["feat/x", "image", "out/pic.png", "1"],
    ["feat/x", "image", "upload/upload-<hash>.png", "1"],
  ], "the page goes by its address with no version; the picture its turn wrote and the one the person gave are images; README.md is git's, lost.md was on no branch");
  assert.equal(rows[0].at, "2026-10-20T01:00:01Z", "a turn with no answer: the page is dated by its prompt");
});

test("turn-ids: an empty transcript is still being written; one that holds no session has no prompt rows", () => {
  const { root, slug, transcripts } = project();
  writeFileSync(join(slug, "s-7.jsonl"), "");
  const empty = hook(root, { op: "turn-ids", session: "s-7", transcripts });
  assert.deepEqual([empty.ok, empty.error], [false, "the transcript of session s-7 is being written"]);
  writeFileSync(join(slug, "s-6.jsonl"), JSON.stringify({ type: "summary", summary: "x" }) + "\n");
  assert.deepEqual(hook(root, { op: "turn-ids", session: "s-6", transcripts }).backfill, { uuids: [], messages: [] });
});
