// What the hooks module needs of Claude Code's plugin API, how a failure says the engine lacks a call, and what the band
// says then (src/hosts/claude-code/engine.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_CALLS, engineGapText, engineVersionOf, failureText, goneCallOf, isNeeded } from "../../dist/hosts/claude-code/engine.js";
import { wordsFor } from "../../dist/shell/text.js";

test("the calls the module needs: the bridge, the session record, the settings, its tools, its timers, its redraws", () => {
  assert.deepEqual(REQUIRED_CALLS, ["process.run", "fs.read", "fs.write", "store.get", "store.set", "tool.register", "clock.after", "ui.invalidate"]);
  for (const call of REQUIRED_CALLS) assert.equal(isNeeded(call), true, call);
  for (const call of ["ui.toast", "ui.notify", "model.complete", "http.fetch", "session.version"]) assert.equal(isNeeded(call), false, `${call}: the module does without it`);
});

test("a failure that says an engine call is not there names it, however the engine's JavaScript words it; any other names none", () => {
  // JavaScriptCore, as Claude Code's engine throws it (probed with a call it does not have, 2026-11-26), and V8.
  assert.equal(goneCallOf(new TypeError("$.session.nosuchthing is not a function. (In '$.session.nosuchthing()', '$.session.nosuchthing' is undefined)")), "session.nosuchthing");
  assert.equal(goneCallOf(new TypeError("$.process.run is not a function")), "process.run");
  // A hook's failure as its .catch handler reads it on next.error: plain data with a message.
  assert.equal(goneCallOf({ kind: "throw", message: "TypeError: $.fs.write is not a function", budget: 2000 }), "fs.write");
  for (const other of [new Error("spawn node ENOENT"), new TypeError("x.map is not a function"), { kind: "timeout", budget: 2000 }, "boom", null, undefined]) assert.equal(goneCallOf(other), null);
});

test("what a caught failure says: an error's name and message, a hook failure's message, or the value", () => {
  assert.equal(failureText(new TypeError("gone")), "TypeError: gone");
  assert.equal(failureText({ kind: "throw", message: "it threw", budget: 1 }), "it threw");
  assert.equal(failureText("plain"), "plain");
});

test("the engine's version from session.version(): the full version, or nothing", () => {
  assert.equal(engineVersionOf({ version: "2.1.330", base: "2.1.330", builtAt: "2026-11-20T00:00:00Z" }), "2.1.330");
  assert.equal(engineVersionOf({ version: " 2.1.280-dev.20260920.t101500.sha1a2b3c4 " }), "2.1.280-dev.20260920.t101500.sha1a2b3c4");
  for (const answer of [null, undefined, {}, { version: "" }, { version: 2 }, "2.1.330"]) assert.equal(engineVersionOf(answer), null);
});

test("the band names the engine and what is gone, in the person's language; without a version it still says what is gone", () => {
  assert.equal(engineGapText(wordsFor("zh"), "2.1.340", ["process.run"]), "Claude Code 2.1.340 改了插件接口，gemworks 暂停：缺 process.run");
  assert.equal(engineGapText(wordsFor("en"), "2.1.340", ["process.run"]), "Claude Code 2.1.340 changed the plugin API; gemworks is off: process.run is gone");
  assert.equal(engineGapText(wordsFor("ja"), "2.1.340", ["process.run"]), "Claude Code 2.1.340 がプラグイン API を変更したため gemworks は停止中：process.run がありません");
  assert.equal(engineGapText(wordsFor("zh"), null, ["store.get", "fs.write"]), "Claude Code 改了插件接口，gemworks 暂停：缺 store.get, fs.write");
});
