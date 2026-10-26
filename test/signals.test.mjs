// Evidence (spec §5.2): a finished call bound to a use writes its variable;
// file and git facts write theirs; and the command-line scanners the
// supervisor refuses and reads with.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadStatechart } from "../dist/core/statechart.js";
import { commandKeys, commandSignals, fileSignals, gitSignals, personOnlyReason, personOnlyRefusal, readsGit, runsGitOrGh, simpleCommands, toolSignals } from "../dist/core/signals.js";
import { isSearchOnlyCommand } from "../dist/core/command-line.js";
import { dict, flowDoc } from "./helpers/flow.mjs";

const SC = loadStatechart(flowDoc({
  initial: "build",
  states: { build: { tools: ["test", "image"] }, release: { tools: ["deploy"] } },
  vars: {
    t: { default: false, source: { tool: "test" } },
    d: { default: false, source: { tool: "deploy" } },
    i: { default: false, source: { tool: "image" } },
    r: { default: false, source: { file: "out/*.mp4" } },
    p: { default: false, source: "pr-open" },
    g: { default: false, source: "pr-merged" },
    c: { default: false, source: "ci-success" },
    k: { default: false, source: "committed" },
    m: { default: false, source: "human" },
  },
  transitions: [{ from: "build", to: "release" }],
}), "f.geml").statechart;
const DICT = dict([
  { tool: "Bash(npm test)", for: "test", default: true },
  { tool: "Bash(npm run test)", for: "test" },
  { tool: "Bash(wrangler deploy)", for: "deploy", default: true },
  { tool: "mcp__img__*", for: "image", default: true },
]);

const TESTS_TRUE = [{ id: "t", value: true }];
const cmd = (command, exitCode = 0, state = "build") => commandSignals(SC, DICT, state, { command, exitCode });

test("a finished command bound to a use writes the use's variable from its exit status; a backgrounded call writes nothing", () => {
  assert.deepEqual(cmd("npm test", 0), TESTS_TRUE);
  assert.deepEqual(cmd("cd x && npm run test -- --grep y", 1), [{ id: "t", value: false }]);
  assert.deepEqual(cmd("npm test", null), []);
  assert.deepEqual(cmd("ls"), []);
});

test("a command is evidence only in a state that declares its use; the other commands of the line may be picked", () => {
  assert.deepEqual(cmd("wrangler deploy --env production", 0, "release"), [{ id: "d", value: true }]);
  assert.deepEqual(cmd("wrangler deploy --env production", 0, "build"), [], "deploy is not build's use");
  assert.deepEqual(commandSignals(SC, DICT, "build", { command: "npm test && npm run test", exitCode: 0, commands: [1] }), TESTS_TRUE);
  assert.deepEqual(commandSignals(SC, DICT, "build", { command: "npm test && ls", exitCode: 0, commands: [1] }), []);
});

test("toolSignals: any other tool's success or error, by the keys of the call", () => {
  assert.deepEqual(toolSignals(SC, DICT, "build", ["mcp__img__generate"], true), [{ id: "i", value: true }]);
  assert.deepEqual(toolSignals(SC, DICT, "build", ["mcp__img__generate"], false), [{ id: "i", value: false }]);
  assert.deepEqual(toolSignals(SC, DICT, "build", ["Read"], true), []);
  assert.deepEqual(toolSignals(SC, DICT, "release", ["mcp__img__generate"], true), []);
});

test("a command matches a key at its start, not anywhere in the line", () => {
  assert.deepEqual(cmd("cd x && npm test"), TESTS_TRUE);
  assert.deepEqual(cmd("echo npm test"), []);
  assert.deepEqual(cmd("npx wrangler deploy", 0, "release"), [], "no row for the npx spelling");
  assert.deepEqual(cmd("npm test && npm run test"), TESTS_TRUE, "one variable, not one per matching command");
});

test("leading NAME=value assignments are skipped before matching", () => {
  assert.deepEqual(cmd("CI=1 npm test"), TESTS_TRUE);
  assert.deepEqual(cmd("A=1 B_2='x y' C=\"p q\" D=\\ z E= npm test", 1), [{ id: "t", value: false }]);
  assert.deepEqual(cmd("cd x && CI=1 npm test"), TESTS_TRUE);
  assert.deepEqual(cmd("CI=1"), []);
  assert.deepEqual(cmd("1A=1 npm test"), [], "1A is not a variable name, so the command starts with it");
  assert.deepEqual(cmd("echo CI=1 npm test"), []);
});

test("an exit status speaks for the matched command only in a plain && chain", () => {
  for (const c of [
    "npm test || true", "npm test | tee log", "npm test |& tee log", "npm test; true", "true; npm test", "npm test &", "npm test&", "npm test\nnpm run build",
    "$(npm test)", "echo $(npm test)", "`npm test`", "(npm test)", "(cd x && npm test)", "npm test <(echo x)", "npm test && true || npm test",
  ]) assert.deepEqual(cmd(c), [], c);
});

test("quoted operators are not operators; redirections are not backgrounding", () => {
  assert.deepEqual(cmd('echo "a;b" && npm test'), TESTS_TRUE);
  assert.deepEqual(cmd("echo 'x|y' && npm test"), TESTS_TRUE);
  assert.deepEqual(cmd('echo "a && b" | wc && npm test'), [], "the unquoted pipe still counts");
  assert.deepEqual(cmd("npm test -- --grep 'a;b|c$(d)(e)`f`&g'"), TESTS_TRUE);
  assert.deepEqual(cmd('npm test -- --grep "a\\"; b"'), TESTS_TRUE);
  assert.deepEqual(cmd("npm test -- a\\;b"), TESTS_TRUE);
  for (const c of ["npm test 2>&1", "npm test >&2", "npm test >&-", "npm test <&3"]) assert.deepEqual(cmd(c), TESTS_TRUE, c);
  assert.deepEqual(cmd("npm test 2>&1 &"), [], "a redirection followed by a real background &");
  for (const c of ["npm test &> log", "npm test &>> log", "npm test &>/dev/null", "npm test 2>&1 &>x", "npm test >&>x", "npm test <&>x"]) assert.deepEqual(cmd(c), [], c);
});

test("a command line that is too long, or does not parse as a command line, reads nothing", () => {
  assert.deepEqual(cmd("npm test " + "x".repeat(70000)), []);
  assert.deepEqual(cmd("npm test " + "x".repeat(65536 - "npm test ".length)), TESTS_TRUE, "exactly 65536 characters is still read");
  assert.deepEqual(cmd("npm test " + "x".repeat(65536 - "npm test ".length + 1)), []);
  assert.deepEqual(cmd('npm test "unterminated'), []);
  assert.deepEqual(cmd("npm test &&"), []);
  assert.deepEqual(cmd("&& npm test"), []);
  assert.deepEqual(cmd(""), []);
});

test("a comment, a ${ or $[, a shell reserved word, or a command that can end the shell make the line unreadable", () => {
  for (const c of [
    "true #&& npm test", "npm test # note", "# npm test", "true && #x && npm test",
    "echo ${x:- && npm test}", "npm test -- ${ARGS}", "echo $[ 1 && npm test ]",
    "[[ x && npm test ]]", "{ npm test }", "if true && npm test", "for x in a && npm test",
    "exit 0 && npm test", "exec true && npm test", "trap 'exit 0' EXIT && npm test", "eval exit && npm test", "source x && npm test", ". x && npm test",
    "builtin exit 0 && npm test", "\\exit 0 && npm test", "FOO=1 exit 0 && npm test", "X=exit && $X 0 && npm test",
  ]) {
    assert.deepEqual(cmd(c), [], c);
    assert.equal(commandKeys({ command: c, exitCode: 0 }), null, c);
  }
  for (const c of ["npm test -- a#b", "npm test -- '#x' \"#y\" \\#z", "npm test -- '${x}' '$[1]'", "npm test -- $x $1 $$", "echo [[ && npm test", "echo exit && npm test", "cd exec && npm test", "FOO=exit npm test"]) {
    assert.deepEqual(cmd(c), TESTS_TRUE, c);
  }
});

test("blanks are the space and the tab, nothing else", () => {
  assert.deepEqual(cmd("CI=1\tnpm test"), TESTS_TRUE);
  assert.deepEqual(simpleCommands(" \t a \t&&\tb\t"), ["a", "b"]);
  for (const sp of [" ", "\u000b", "\u000c", "　", " ", " "]) {
    assert.deepEqual(cmd(`CI=1${sp}npm test x`), [], JSON.stringify(sp));
    assert.deepEqual(simpleCommands(`a${sp}&&b`), [`a${sp}`, "b"], JSON.stringify(sp));
  }
  assert.deepEqual(cmd("npm test\r"), TESTS_TRUE, "a carriage return is an ordinary character");
});

test("simpleCommands splits a plain && chain with a quote-aware scanner, and says null otherwise", () => {
  assert.deepEqual(simpleCommands("npm test"), ["npm test"]);
  assert.deepEqual(simpleCommands("cd x && npm test && echo done"), ["cd x", "npm test", "echo done"]);
  assert.deepEqual(simpleCommands('echo "a && b" \'c && d\' && ls'), ['echo "a && b" \'c && d\'', "ls"]);
  assert.deepEqual(simpleCommands("echo 'it\\' && ls"), ["echo 'it\\'", "ls"], "no escapes inside single quotes");
  assert.deepEqual(simpleCommands("npm test \\\n  --grep x"), ["npm test   --grep x"], "a backslash-newline is a line continuation");
  assert.deepEqual(simpleCommands("echo $'a\\'b' && npm test"), ["echo $'a\\'b'", "npm test"]);
  assert.deepEqual(simpleCommands(""), []);
  for (const line of ["a; b", "a || b", "a | b", "a &", "a\nb", "$(a)", "a `b`", "(a)", "a <(b)", "a && b || c", "a &&", "&& a", 'a "b', "a &> b", "a $'b"]) {
    assert.equal(simpleCommands(line), null, JSON.stringify(line));
  }
});

test("file evidence asks the host whether the glob matches; a walk that gave up establishes nothing", () => {
  assert.deepEqual(fileSignals(SC, (g) => g === "out/*.mp4"), [{ id: "r", value: true }]);
  assert.deepEqual(fileSignals(SC, () => false), [{ id: "r", value: false }]);
  assert.deepEqual(fileSignals(SC, () => undefined), []);
});

test("git evidence reads the facts; ci-success is every run on the head succeeding; an unknown fact writes nothing", () => {
  assert.deepEqual(gitSignals(SC, { prOpen: true, prMerged: false, committed: true }), [{ id: "p", value: true }, { id: "g", value: false }, { id: "k", value: true }]);
  assert.deepEqual(gitSignals(SC, { ci: [{ workflow: "build", success: true }, { workflow: "lint", success: false }] }), [{ id: "c", value: false }]);
  assert.deepEqual(gitSignals(SC, { ci: [{ workflow: "build", success: true }] }), [{ id: "c", value: true }]);
  assert.deepEqual(gitSignals(SC, { ci: [] }), [{ id: "c", value: false }]);
  assert.deepEqual(gitSignals(SC, {}), []);
  assert.deepEqual(readsGit(SC), { git: true, gh: true });
  assert.deepEqual(readsGit(loadStatechart(flowDoc({ initial: "a", states: { a: {}, b: {} }, vars: { k: { default: false, source: "committed" } }, transitions: [{ from: "a", to: "b" }] }), "g").statechart), { git: true, gh: false });
});

const REFUSED = /`gemworks (mark|unmark|advance)` is for a person/;

test("person-only: a gemworks mark, unmark or advance in command position is refused, however the CLI is reached", () => {
  for (const c of [
    "gemworks mark ok", "npx -y gemworks advance release", "cd x; gemworks unmark ok", "cd x && gemworks mark ok", "x=1 && gemworks  mark ok",
    "npx --yes gemworks mark ok", "npx gemworks@latest mark ok", "npm exec gemworks -- mark x", "pnpm dlx gemworks advance r",
    "pnpm exec gemworks mark x", "yarn dlx gemworks mark x", "bunx gemworks@1.2.3 UNMARK x", "npx -p gemworks gemworks mark ok",
    "./node_modules/.bin/gemworks advance release", "node integrations/gemworks/dist/cli.js mark ok", "node dist/cli.js mark ok", "node src/cli.ts advance x",
    '"gemworks" mark x', "GEMWORKS mark x", "gemwo\\rks mark ok", 'gem"works" m\'ark\' ok',"gemworks --quiet mark ok", "gemworks 2>&1 mark ok", "gemworks >log mark ok",
    "env gemworks mark ok", "env A=1 gemworks mark ok", "command gemworks mark ok", "FOO=1 gemworks mark ok", "time gemworks mark ok", "sudo gemworks mark ok",
    "timeout 5 gemworks mark ok", "xargs gemworks mark ok", "nohup gemworks advance x &",
    "gemwork mark ok", "npx gemwork advance r", "node node_modules/gemwork/cli.js mark ok", "gwx mark ok", "npx gwx advance r", "GWX unmark x",
    "(gemworks mark ok)", "echo $(gemworks mark ok)", 'echo "$(gemworks mark ok)"', "echo `gemworks mark ok`", "{ gemworks mark ok; }",
    "if true; then gemworks mark ok; fi", "true || gemworks mark ok", "true | gemworks mark ok", "true & gemworks mark ok", "true\ngemworks mark ok",
    'bash -c "gemworks mark ok"', "sh -c 'cd x && gemworks advance y'", "eval gemworks mark ok", 'eval "gemworks" mark ok', 'bash -c "bash -c \'gemworks mark ok\'"',
    "x=gemworks && $x mark ok", '"$X" mark gemworks', 'gemworks mark "ok', "gemworks 'advance",
    "sudo sh -c 'gemworks mark r'", "env bash -c 'gemworks mark r'", "npx -c 'gemworks mark r'", "npm exec --call='gemworks mark r'",
    'pwsh -c "gemworks mark r"', 'powershell -Command "gemworks mark r"', "pwsh -NoProfile -c gemworks advance done", "pwsh -c \"Invoke-Expression 'gemworks mark r'\"",
    "watch gemworks mark r", "script -c 'gemworks mark r' log", "su -c 'gemworks mark r'", "env -S 'gemworks mark r'", "uvx gemworks mark r",
  ]) assert.match(personOnlyRefusal(c) ?? "", REFUSED, JSON.stringify(c));
  assert.match(personOnlyRefusal("GEMWORKS MARK x"), /`gemworks mark` is for a person/, "the verb is named in lower case");
  for (const c of ["gemworks $V ok", "V=mark && gemworks $V ok", "gemworks $(echo mark) ok", 'gemworks "$V" ok', "npx gemworks $V"]) {
    assert.match(personOnlyRefusal(c) ?? "", /`gemworks mark\|unmark\|advance\|pause\|resume` is for a person/, c);
  }
  for (const c of ["sudo sh -c 'gemworks status'", "env bash -c 'echo gemworks mark'", "npx -c 'gemworks check flow.geml'", 'pwsh -c "Write-Output gemworks"', "timeout 5 bash script.sh"]) {
    assert.equal(personOnlyRefusal(c), undefined, c);
  }
});

test("a hostile line is judged by every scanner, not crashed on, and quickly", () => {
  const started = Date.now();
  for (const c of [
    '"$('.repeat(20000), "$(".repeat(30000), "`".repeat(30000), '"`'.repeat(30000), "(".repeat(60000), "\\".repeat(60000), "'".repeat(60001), "\"$('".repeat(10000),
    "bash -c ".repeat(8000) + "'gemworks mark'", " ".repeat(65000) + "x", "gemworks ".repeat(8000),
    "sudo ".repeat(12000) + "git", "pwsh -c ".repeat(8000) + "'gemworks mark'", "eval ".repeat(12000) + "x", "rg x | ".repeat(8000) + "head", "2>&1 ".repeat(12000),
    "$(".repeat(240000),
  ]) {
    assert.doesNotThrow(() => personOnlyRefusal(c), c.slice(0, 20));
    assert.doesNotThrow(() => runsGitOrGh(c), c.slice(0, 20));
    assert.doesNotThrow(() => isSearchOnlyCommand(c), c.slice(0, 20));
  }
  assert.match(personOnlyRefusal('echo "$(echo "$(echo "$(echo "$(echo "$(echo "$(echo "$(echo "$(echo "$(echo "$(gemworks mark ok)")")")")")")")")")")"') ?? "", REFUSED);
  for (const levels of [1, 2, 3, 4, 5, 9]) {
    let line = "gemworks mark ok";
    for (let n = 0; n < levels; n++) line = `bash -c ${JSON.stringify(line)}`;
    assert.match(personOnlyRefusal(line) ?? "", REFUSED, `${levels} shells deep`);
  }
  assert.ok(Date.now() - started < 5000, "all of them within seconds");
});

test("person-only: naming gemworks or a verb is not a call", () => {
  for (const c of [
    'git commit -m "feat(gemworks): advance the mark"', "grep gemworks docs/mark.md", "echo gemworks mark", "echo 'gemworks mark ok'",
    "mygemworks mark x", "gemworks status", "gemworks check flow.geml", "gemworks status; echo mark", "ls | grep mark",
    "cd integrations/gemworks && npm test", "node --test test/signals.test.mjs", "node dist/cli.js status", "gemworks check $FILE", "node scripts/cli.js mark ok",
    'echo "run gemworks mark later"', "# gemworks mark ok", "mark gemworks", "gemworks-mark", "gemworks marker x", "echo gemworks; mark",
  ]) assert.equal(personOnlyRefusal(c), undefined, JSON.stringify(c));
});

test("person-only: a here-document's body is data — a commit message may say gemworks and mark — but what follows it, and what an unquoted one expands, runs", () => {
  for (const c of [
    "git commit -F - <<'EOF'\nfeat: Gemworks's mark\n\ngemworks mark x\nEOF",
    'git commit -m "$(cat <<\'EOF\'\nfeat(gemworks): Gemworks\'s mark leads the band\nEOF\n)"',
    "cat <<'EOF'\n$(gemworks mark x)\nEOF", "cat <<\\EOF\n`gemworks advance x`\nEOF", "cat <<EOF\ngemworks mark x\nEOF",
    "cat <<-EOF\n\tgemworks mark x\n\tEOF", "cat <<EOF\ngemworks mark x", "cat <<EOF > notes.txt\nwe gemworks mark nothing\nEOF\necho done",
  ]) assert.equal(personOnlyRefusal(c), undefined, JSON.stringify(c));
  for (const c of [
    "cat <<EOF\nbody\nEOF\ngemworks mark x", "cat <<-EOF\n\tbody\n\tEOF\ngemworks advance x", "cat <<EOF\n$(gemworks mark x)\nEOF",
    "cat <<EOF\n`gemworks unmark x`\nEOF", "cat <<A <<B\na\nA\nb\nB\ngemworks mark x", "cat <<EOF; gemworks mark x\nbody\nEOF",
    'echo "$(cat <<EOF\n$(gemworks mark x)\nEOF\n)"',
  ]) assert.match(personOnlyRefusal(c) ?? "", REFUSED, JSON.stringify(c));
  assert.equal(runsGitOrGh("cat <<'EOF'\ngit push --force\nEOF"), false, "a body naming git runs no git");
  assert.equal(runsGitOrGh("cat <<'EOF' | sh\nbody\nEOF\ngit push"), true);
});

test("person-only: `<<` in arithmetic is a shift, so the lines after it are never skipped as a here-document's body", () => {
  for (const c of [
    "echo $((1 << 2))\ngemworks mark x\n2", "x=$((1<<2))\ngemworks advance x", "((n = 1 << 3))\ngemworks unmark x\n3",
    "echo $[1 << 2]\ngemworks mark x\n2", 'echo "$(echo $((1<<2)))"\ngemworks mark x\n2',
  ]) assert.match(personOnlyRefusal(c) ?? "", REFUSED, JSON.stringify(c));
  assert.equal(runsGitOrGh("echo $((1 << 2))\ngit push\n2"), true, "a git after it is still seen");
});

test("person-only: a `((` inside a here-document's body is code, not arithmetic — the line is still read exactly, so a body naming gemworks and a verb runs neither", () => {
  for (const c of [
    "cat >> t.ts <<'EOF'\nawait $.command.run({ command: 'gemworks', args: 'board' })\nconst ys = xs.map((x) => x)\nawait clock.advance(1)\nEOF",
    "node -e \"x\" && cat >> a.ts <<'EOF'\nf((1))\nEOF\ncat >> b.mjs <<'EOF'\n'gemworks' mark\nEOF\nhead -5 a.ts",
    "cat <<EOF\nys = xs.map((x) => x)\ngemworks pause\nEOF",
  ]) assert.equal(personOnlyRefusal(c), undefined, JSON.stringify(c));
  for (const c of [
    "cat <<'EOF'\nxs.map((x) => x)\nEOF\ngemworks advance x",
    "cat <<'EOF'\nxs.map((x) => x)\nEOF\necho $((1 << 2))\ngemworks mark x\n2",
    'echo "$(cat <<\'EOF\'\nf((1))\nEOF\n)"; gemworks advance y',
  ]) assert.match(personOnlyRefusal(c) ?? "", REFUSED, JSON.stringify(c));
});

test("runsGitOrGh: git or gh at any command position, at any path; merely naming either is not running it", () => {
  for (const line of [
    "git push", "gh pr create --fill", "cd app && git push -u origin HEAD", "npm test; git commit -m x", "(gh pr view)",
    "GIT_AUTHOR_NAME=x git commit", "/usr/bin/git status", "command git log", "if true; then git push; fi", "echo \"$(git rev-parse HEAD)\"",
    "git", "git.exe status", "echo 'unclosed && git push",
    "sudo git switch main", "env GIT_DIR=x git checkout -b y", "timeout 30 git pull", "bash -c 'git checkout -b x'", "sh -c \"cd app && gh pr checkout 7\"", "sudo sh -c 'git reset --hard'",
  ]) assert.equal(runsGitOrGh(line), true, line);
  for (const line of ["npm test", "echo git push", "cat .gitignore", "legit push", "echo 'git push'", "github-cli pr", "ls ghost", "", "bash -c 'echo git push'", "ls git"]) {
    assert.equal(runsGitOrGh(line), false, line);
  }
});

test("personOnlyReason is the person-only refusal's wording", () => {
  assert.equal(personOnlyRefusal("gemworks mark x"), personOnlyReason("mark"));
  assert.match(personOnlyReason("advance"), /^`gemworks advance` is for a person, not the model/);
});
