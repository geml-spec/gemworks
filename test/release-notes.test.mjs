import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isNewer, releaseNotesOf } from "../dist/hosts/claude-code/release-notes.js";

test("an update is a later version: a build ahead of the published one is told no update", () => {
  assert.equal(isNewer("0.2.2", "0.2.1"), true);
  assert.equal(isNewer("0.10.0", "0.9.9"), true, "by number, not by text");
  assert.equal(isNewer("1.0.0", "0.99.0"), true);
  assert.equal(isNewer("0.2.1", "0.2.2"), false, "the published one is older than this build");
  assert.equal(isNewer("0.2.2", "0.2.2"), false);
  assert.equal(isNewer("0.2.2-beta.1", "0.2.2"), false, "a pre-release tag is not weighed");
});

test("this version's notes are its CHANGELOG section, an entry a line, its first sentence without the scope or the marks", () => {
  const md = [
    "# Changelog",
    "",
    "## [0.2.112] — 2026-11-06",
    "",
    "- **gemworks**: the settings dialog keeps what works on the light flows. The",
    "  three notifications follow a band question, a step you judge and a rule.",
    "",
    "- **gemworks**: `/gemworks trace on|off` switches the diagnosis.",
    "",
    "## [0.2.1] — 2026-10-16",
    "",
    "- **gemflow**: an older entry.",
  ].join("\r\n");
  assert.deepEqual(releaseNotesOf(md, "0.2.112"), [
    "the settings dialog keeps what works on the light flows.",
    "/gemworks trace on|off switches the diagnosis.",
  ]);
  assert.deepEqual(releaseNotesOf(md, "0.2.1"), ["an older entry."]);
  assert.deepEqual(releaseNotesOf(md, "0.2.111"), [], "a version with no section has no notes, and the dialog shows none");
});

test("the plugin ships its CHANGELOG, so an installed copy can say what its version brings", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(pkg.files.includes("CHANGELOG.md"));
});
