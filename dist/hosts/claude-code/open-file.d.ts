/**
 * Opening a local file from the board. A `file:` link opens nothing on the
 * desktop, phone or VS Code panes: the engine draws any href but `https:`
 * there as plain text. So a press runs the machine's own opener instead, by
 * its argument vector (no shell).
 *
 * On Windows the opener is PowerShell's Start-Process, never explorer.exe
 * itself: the engine starts its commands with their windows hidden, and
 * Explorer builds the folder window it opens hidden too (it exists and never
 * shows). Start-Process starts what it opens in a normal window. The path
 * travels in an environment variable, so no quoting can break it.
 */
/** The environment variable that carries the path to the Windows opener. */
export declare const OPEN_PATH_VAR = "GEMWORKS_OPEN_PATH";
/** One way to open a path: the command, and what it adds to the environment. */
export interface Opener {
    argv: string[];
    env?: Record<string, string>;
}
/**
 * The ways to open `path` on the machine the session runs on, in the order
 * to try them; with `reveal`, its folder is shown with it selected where the
 * system can (Explorer, Finder), else its folder is opened. Windows goes
 * through Start-Process (backslashes), macOS through `open` (`-R` reveals),
 * elsewhere `xdg-open`. With no platform known, a drive letter says Windows;
 * otherwise `xdg-open` comes before `open`, which on Debian is openvt.
 */
export declare function openersFor(platform: string | undefined, path: string, reveal?: boolean): Opener[];
/** A path's last segment, a folder's too: what a toast names. */
export declare function baseName(path: string): string;
