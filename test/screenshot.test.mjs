import { test } from "node:test";
import assert from "node:assert/strict";
import { captureFailed, captureHint, capturesFor, offersCapture, pasteKey } from "../dist/hosts/claude-code/screenshot.js";
import { wordsFor } from "../dist/hosts/claude-code/text.js";

test("each system's own region capture, to the clipboard: Windows and macOS built in, Linux whichever tool is installed", () => {
  assert.deepEqual(capturesFor("win32").map((c) => c.argv), [["explorer.exe", "ms-screenclip:"]]);
  assert.deepEqual(capturesFor("darwin").map((c) => c.argv), [["screencapture", "-i", "-c"]]);
  assert.deepEqual(capturesFor("linux").map((c) => c.argv[0]), ["flameshot", "gnome-screenshot", "spectacle"]);
  assert.deepEqual(capturesFor("freebsd"), []);
  assert.deepEqual(capturesFor(undefined), []);
});

test("the button is offered on the desktop app, whose system has a capture", () => {
  assert.equal(offersCapture({ surface: "desktop", platform: "win32" }), true);
  assert.equal(offersCapture({ surface: "terminal", platform: "win32" }), false);
  assert.equal(offersCapture({ surface: "mobile", platform: "darwin" }), false);
  assert.equal(offersCapture({ surface: "vscode", platform: "darwin" }), false);
  assert.equal(offersCapture({ surface: "desktop", platform: undefined }), false, "before the bridge has said which system");
});

test("the words name this system's paste key; macOS mentions the permission it asks for once", () => {
  assert.equal(pasteKey("win32"), "Ctrl+V");
  assert.equal(pasteKey("linux"), "Ctrl+V");
  assert.equal(pasteKey("darwin"), "⌘V");
  assert.equal(captureHint("win32"), "截一块给 Claude 看：框选要截的地方，截好后在输入框按 Ctrl+V");
  assert.equal(captureHint("darwin"), "截一块给 Claude 看：框选要截的地方，截好后在输入框按 ⌘V（第一次会问屏幕录制权限）");
  assert.equal(captureFailed("linux", "spawn spectacle ENOENT"), "没找到截图工具：装 flameshot 或 gnome-screenshot 后再点");
  assert.equal(captureFailed("win32", "spawn explorer.exe EACCES"), "截图没有启动：spawn explorer.exe EACCES");
  assert.equal(captureHint("win32", wordsFor("en")), "Show Claude part of the screen: select it, then press Ctrl+V in the prompt");
});
