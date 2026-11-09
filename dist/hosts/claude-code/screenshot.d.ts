import { type T } from "./text.js";
/** A way to start a region capture that leaves the picture on the clipboard. */
export interface Capture {
    argv: string[];
}
/**
 * The ways on a platform (win32, darwin, linux, as Node names them), in order. Windows starts Snipping Tool's region capture (the one
 * Win+Shift+S starts) and macOS `screencapture` (interactive, to the clipboard); Linux has whichever of the common
 * tools is installed. None elsewhere.
 */
export declare function capturesFor(platform: string | undefined): Capture[];
/** Whether the band offers the button: drawn on the desktop app, whose system has a capture. Remote Control does not
 * hide it: a phone attached draws its own band, and the press on this one comes from the person at the desktop. */
export declare function offersCapture(o: {
    surface: string;
    platform: string | undefined;
}): boolean;
/** The key that pastes into the prompt. */
export declare function pasteKey(platform: string | undefined): string;
/** What the band says while the pointer is on the button, in the line's place. */
export declare function captureHint(platform: string | undefined, t?: T): string;
/** The toast when no capture started: on Linux, which tools to install; elsewhere, why. */
export declare function captureFailed(platform: string | undefined, reason: string, t?: T): string;
