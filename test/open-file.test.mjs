// Opening a local file from the board: which command the machine opens it with, read as strings only (nothing is run).
import { test } from "node:test";
import assert from "node:assert/strict";
import { baseName, browserCommandArgv, browserExeOf, BROWSER_PROGID_ARGV, fileUrl, openersFor, opensInBrowser, OPEN_PATH_VAR, progIdOf, START_VAR } from "../dist/hosts/claude-code/open-file.js";

test("Windows opens through cmd's start, then Start-Process, in a normal window, the path in a variable in backslashes: explorer.exe started by the engine builds its window hidden", () => {
  const [start, shell] = openersFor("win32", "C:/r/.geml/exports/s b.geml");
  assert.deepEqual(start.argv, ["cmd.exe", "/d", "/c", "start", `%${START_VAR}%`], "cmd starts in a fraction of PowerShell's time");
  assert.deepEqual(start.env, { [START_VAR]: '"" "C:\\r\\.geml\\exports\\s b.geml"' }, "the title, then the path, quoted inside the variable");
  assert.equal(shell.argv[0], "powershell.exe", "Start-Process when start fails");
  assert.equal(shell.argv.at(-1), `Start-Process -FilePath $env:${OPEN_PATH_VAR} -WindowStyle Normal`);
  assert.deepEqual(shell.env, { [OPEN_PATH_VAR]: "C:\\r\\.geml\\exports\\s b.geml" });
  const reveal = openersFor("win32", "C:/r/x.md", true);
  assert.equal(reveal.length, 1);
  assert.equal(reveal[0].argv.at(-1), `Start-Process -FilePath explorer.exe -ArgumentList ('/select,' + [char]34 + $env:${OPEN_PATH_VAR} + [char]34) -WindowStyle Normal`, "the folder shown with the file selected");
  for (const o of [start, shell, ...reveal]) assert.ok(o.argv.every((a) => !a.includes('"') && !a.includes(" ") || a.startsWith("Start-Process")), "no quote or space for the engine to quote, but in PowerShell's own command");
});

test("what a browser shows as it is opens in the default browser on Windows, as a file: URL; the rest, and a reveal, in the file's own app", () => {
  for (const f of ["a.png", "b.JPG", "c.svg", "d.html", "e.pdf", "f.txt", "g.json", "h.webp"]) assert.equal(opensInBrowser(f), true, f);
  for (const f of ["a.md", "b.geml", "c.ts", "d.docx", "noext", "dir/"]) assert.equal(opensInBrowser(f), false, f);
  assert.equal(fileUrl("C:\\a b\\x#1.png"), "file:///C:/a%20b/x%231.png");
  assert.equal(fileUrl("/home/me/x y.png"), "file:///home/me/x%20y.png");
  const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const [inBrowser, own] = openersFor("win32", "C:/r/.geml/artifacts/aa bb.png", false, chrome);
  assert.deepEqual(inBrowser.env, { [START_VAR]: `"" "${chrome}" "file:///C:/r/.geml/artifacts/aa%20bb.png"` });
  assert.deepEqual(own.env, { [START_VAR]: '"" "C:\\r\\.geml\\artifacts\\aa bb.png"' }, "the file's own app when the browser does not start");
  assert.equal(openersFor("win32", "C:/r/x.md", false, chrome)[0].env?.[START_VAR], '"" "C:\\r\\x.md"', "Markdown keeps its own app");
  assert.equal(openersFor("win32", "C:/r/x.png", true, chrome)[0].argv[0], "powershell.exe", "a reveal shows the folder");
  assert.deepEqual(openersFor("darwin", "/Users/me/x.png", false, chrome), [{ argv: ["open", "/Users/me/x.png"] }], "elsewhere the system's own opener");
});

test("the default browser read from the registry: the https ProgId, then the program its open command runs", () => {
  assert.deepEqual(BROWSER_PROGID_ARGV.slice(0, 2), ["reg", "query"]);
  assert.equal(progIdOf("\r\nHKEY_CURRENT_USER\\...\\UserChoice\r\n    ProgId    REG_SZ    ChromeHTML\r\n\r\n"), "ChromeHTML");
  assert.equal(progIdOf("ERROR: The system was unable to find the specified registry key or value."), undefined);
  assert.deepEqual(browserCommandArgv("MSEdgeHTM"), ["reg", "query", "HKCR\\MSEdgeHTM\\shell\\open\\command", "/ve"]);
  assert.equal(browserExeOf('\r\nHKEY_CLASSES_ROOT\\ChromeHTML\\shell\\open\\command\r\n    (Default)    REG_SZ    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --single-argument %1\r\n'), "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
  assert.equal(browserExeOf("    (Default)    REG_EXPAND_SZ    C:\\Apps\\ff.exe -osint -url %1"), "C:\\Apps\\ff.exe");
  assert.equal(browserExeOf("    (Default)    REG_SZ    rundll32 url.dll,FileProtocolHandler %1"), undefined, "no .exe named: none");
  assert.equal(browserExeOf(""), undefined);
});

test("macOS opens with open and shows it in Finder with open -R; Linux opens with xdg-open and shows its folder; unknown, a drive letter says Windows, else xdg-open before open", () => {
  assert.deepEqual(openersFor("darwin", "/Users/me/r/x.md"), [{ argv: ["open", "/Users/me/r/x.md"] }]);
  assert.deepEqual(openersFor("darwin", "/Users/me/r/x.md", true), [{ argv: ["open", "-R", "/Users/me/r/x.md"] }]);
  assert.deepEqual(openersFor("linux", "/home/me/r/x.md"), [{ argv: ["xdg-open", "/home/me/r/x.md"] }]);
  assert.deepEqual(openersFor("linux", "/home/me/r/x.md", true), [{ argv: ["xdg-open", "/home/me/r"] }]);
  assert.equal(openersFor(undefined, "D:\\out\\s.geml")[0].argv[0], "cmd.exe", "a drive letter says Windows");
  assert.deepEqual(openersFor(undefined, "/r/x.md").map((o) => o.argv[0]), ["xdg-open", "open"], "xdg-open first: Debian's own open is openvt");
});

test("a toast names the file by its last segment, a folder's too", () => {
  assert.equal(baseName("C:\\a b\\c.txt"), "c.txt");
  assert.equal(baseName("/h/.geml/artifacts/"), "artifacts");
  assert.equal(baseName("x"), "x");
});
