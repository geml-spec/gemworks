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
export declare const OPEN_PATH_VAR = "GEMWORKS_OPEN_PATH";
/** One way to open a path: the command, and what it adds to the environment. */
export interface Opener {
    argv: string[];
    env?: Record<string, string>;
}
/**
 * The command line cmd's `start` runs, in a variable: cmd expands it once and then parses it with its quotes, so a
 * path's spaces, `&` or `^` stay in the path, and no element of the argument vector holds a quote or a space for the
 * engine to quote. `start` opens what it names in a normal window whatever window cmd itself was started with, and
 * cmd starts in a fraction of PowerShell's time (Start-Process stays the way to reveal, and the fallback).
 */
export declare const START_VAR = "GEMWORKS_START";
export declare function opensInBrowser(path: string): boolean;
/** The path as a file: URL, each segment percent-encoded: `C:\a b\x.png` → `file:///C:/a%20b/x.png`. */
export declare function fileUrl(path: string): string;
/** Asks Windows which app opens https links, the person's default browser, by its ProgId. */
export declare const BROWSER_PROGID_ARGV: string[];
/** The ProgId in `reg query`'s answer (`ProgId    REG_SZ    ChromeHTML`). */
export declare function progIdOf(out: string): string | undefined;
/** Asks Windows the command that opens a ProgId's links. */
export declare function browserCommandArgv(progId: string): string[];
/** The program in that command (`"C:\…\chrome.exe" --single-argument %1` → `C:\…\chrome.exe`); none that is not an .exe. */
export declare function browserExeOf(out: string): string | undefined;
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
export declare function openersFor(platform: string | undefined, path: string, reveal?: boolean, browser?: string): Opener[];
/** A path's last segment, a folder's too: what a toast names. */
export declare function baseName(path: string): string;
