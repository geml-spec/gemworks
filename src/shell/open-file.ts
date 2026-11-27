/**
 * Opening a local file from the board. A `file:` link opens nothing on the
 * desktop, phone or VS Code panes: the engine draws any href but `https:`
 * there as plain text. So a press runs the machine's own opener instead, by
 * its argument vector (no shell).
 *
 * On Windows the opener is cmd's `start`, then PowerShell's Start-Process,
 * never explorer.exe itself: the engine starts its commands with their
 * windows hidden, and Explorer builds the folder window it opens hidden too
 * (it exists and never shows). Both start what they open in a normal window;
 * cmd starts far sooner. The path travels in an environment variable, so no
 * quoting can break it. What a browser shows as it is opens in the default
 * browser, where a tab opens at once; the rest in the file's own app.
 */

/** The environment variable that carries the path to the Windows opener. */
export const OPEN_PATH_VAR = "GEMWORKS_OPEN_PATH";

const POWERSHELL = ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command"];
/** The file or folder the variable names, opened with its default app in a normal window. */
const WIN_OPEN = `Start-Process -FilePath $env:${OPEN_PATH_VAR} -WindowStyle Normal`;
/** Explorer at the item's folder with the item selected, in a normal window; the quotes are [char]34, so no double quote crosses the command line. */
const WIN_REVEAL = `Start-Process -FilePath explorer.exe -ArgumentList ('/select,' + [char]34 + $env:${OPEN_PATH_VAR} + [char]34) -WindowStyle Normal`;

/** One way to open a path: the command, and what it adds to the environment. */
export interface Opener { argv: string[]; env?: Record<string, string> }

/**
 * The command line cmd's `start` runs, in a variable: cmd expands it once and then parses it with its quotes, so a
 * path's spaces, `&` or `^` stay in the path, and no element of the argument vector holds a quote or a space for the
 * engine to quote. `start` opens what it names in a normal window whatever window cmd itself was started with, and
 * cmd starts in a fraction of PowerShell's time (Start-Process stays the way to reveal, and the fallback).
 */
export const START_VAR = "GEMWORKS_START";
const CMD_START = ["cmd.exe", "/d", "/c", "start", `%${START_VAR}%`];
function winStart(...args: string[]): Opener {
  return { argv: CMD_START, env: { [START_VAR]: ['""', ...args.map((a) => `"${a}"`)].join(" ") } };
}

/** What opens in the browser: pictures, pages, PDFs, plain text, JSON, and GEML (as text, or through a GEML viewer
 * the browser has). Markdown keeps its own app, an editor as a rule. */
const IN_BROWSER = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif", "html", "htm", "pdf", "txt", "json", "geml"]);
export function opensInBrowser(path: string): boolean {
  const ext = /\.([A-Za-z0-9]+)$/.exec(baseName(path))?.[1];
  return ext !== undefined && IN_BROWSER.has(ext.toLowerCase());
}

/** The path as a file: URL, each segment percent-encoded: `C:\a b\x.png` → `file:///C:/a%20b/x.png`. */
export function fileUrl(path: string): string {
  const p = path.split("\\").join("/");
  const segments = p.split("/").map((s, i) => (i === 0 && /^[A-Za-z]:$/.test(s) ? s : encodeURIComponent(s))).join("/");
  return p.startsWith("/") ? `file://${segments}` : `file:///${segments}`;
}

/** Asks Windows which app opens https links, the person's default browser, by its ProgId. */
export const BROWSER_PROGID_ARGV = ["reg", "query", "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice", "/v", "ProgId"];
/** The ProgId in `reg query`'s answer (`ProgId    REG_SZ    ChromeHTML`). */
export function progIdOf(out: string): string | undefined {
  return /ProgId\s+REG_SZ\s+(\S+)/.exec(out)?.[1];
}
/** Asks Windows the command that opens a ProgId's links. */
export function browserCommandArgv(progId: string): string[] {
  return ["reg", "query", `HKCR\\${progId}\\shell\\open\\command`, "/ve"];
}
/** The program in that command (`"C:\…\chrome.exe" --single-argument %1` → `C:\…\chrome.exe`); none that is not an .exe. */
export function browserExeOf(out: string): string | undefined {
  const line = /REG_(?:EXPAND_)?SZ\s+(.+)$/m.exec(out)?.[1]?.trim();
  if (line === undefined || line === "") return undefined;
  const exe = line.startsWith('"') ? line.slice(1, line.indexOf('"', 1)) : (line.split(/\s+/)[0] ?? "");
  return /\.exe$/i.test(exe) ? exe : undefined;
}

/** A path's folder, in forward slashes. */
function folderOf(path: string): string {
  const p = path.split("\\").join("/").replace(/\/+$/, "");
  const cut = p.lastIndexOf("/");
  return cut <= 0 ? "/" : p.slice(0, cut);
}

/**
 * The ways to open `path` on the machine the session runs on, in the order
 * to try them; with `reveal`, its folder is shown with it selected where the
 * system can (Explorer, Finder), else its folder is opened. Windows goes
 * through `start` (in `browser`, the default browser's program, where a
 * browser shows the file), then Start-Process (backslashes); macOS through
 * `open` (`-R` reveals), elsewhere `xdg-open`. With no platform known, a drive
 * letter says Windows; otherwise `xdg-open` comes before `open`, which on
 * Debian is openvt.
 */
export function openersFor(platform: string | undefined, path: string, reveal = false, browser?: string): Opener[] {
  const os = platform ?? (/^[A-Za-z]:[\\/]/.test(path) || path.startsWith("\\\\") ? "win32" : undefined);
  if (os === "win32") {
    const win = path.split("/").join("\\");
    const shell: Opener = { argv: [...POWERSHELL, reveal ? WIN_REVEAL : WIN_OPEN], env: { [OPEN_PATH_VAR]: win } };
    if (reveal) return [shell];
    // What a browser shows, in the default browser (a tab where it is open already); else the file's own app.
    const inBrowser = browser !== undefined && opensInBrowser(path) ? [winStart(browser, fileUrl(path))] : [];
    return [...inBrowser, winStart(win), shell];
  }
  const mac: Opener = { argv: reveal ? ["open", "-R", path] : ["open", path] };
  if (os === "darwin") return [mac];
  const xdg: Opener = { argv: ["xdg-open", reveal ? folderOf(path) : path] };
  return os === undefined ? [xdg, mac] : [xdg];
}

/** A path's last segment, a folder's too: what a toast names. */
export function baseName(path: string): string {
  const p = path.split("\\").join("/").replace(/\/+$/, "");
  return p.slice(p.lastIndexOf("/") + 1) || p;
}
