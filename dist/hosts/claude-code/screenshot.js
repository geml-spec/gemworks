// The band's screenshot button, on the desktop app: one press starts the system's own region capture, which leaves
// the picture on the clipboard, and the person pastes it into the prompt (a plugin cannot put a picture there). The
// button and its words say which key pastes, so nobody has to remember the capture's shortcut. Pure and Node-free:
// the hooks module runs the commands, one after another until one starts.
import { ZH } from "./text.js";
/**
 * The ways on a platform (win32, darwin, linux, as Node names them), in order. Windows starts Snipping Tool's region capture (the one
 * Win+Shift+S starts) and macOS `screencapture` (interactive, to the clipboard); Linux has whichever of the common
 * tools is installed. None elsewhere.
 */
export function capturesFor(platform) {
    if (platform === "win32")
        return [{ argv: ["explorer.exe", "ms-screenclip:"] }];
    if (platform === "darwin")
        return [{ argv: ["screencapture", "-i", "-c"] }];
    if (platform === "linux")
        return [
            { argv: ["flameshot", "gui", "--clipboard"] },
            { argv: ["gnome-screenshot", "--area", "--clipboard"] },
            // Short flags: `-c` is --clipboard in the older Spectacle and --copy-image in the newer.
            { argv: ["spectacle", "-r", "-b", "-c"] },
        ];
    return [];
}
/** Whether the band offers the button: drawn on the desktop app, whose system has a capture. Remote Control does not
 * hide it: a phone attached draws its own band, and the press on this one comes from the person at the desktop. */
export function offersCapture(o) {
    return o.surface === "desktop" && capturesFor(o.platform).length > 0;
}
/** The key that pastes into the prompt. */
export function pasteKey(platform) {
    return platform === "darwin" ? "⌘V" : "Ctrl+V";
}
/** What the band says while the pointer is on the button, in the line's place. */
export function captureHint(platform, t = ZH) {
    const hint = t("框选要截的地方，截好后在输入框按 {0}", pasteKey(platform));
    return platform === "darwin" ? `${hint}${t("（第一次会问屏幕录制权限）")}` : hint;
}
/** The toast when no capture started: on Linux, which tools to install; elsewhere, why. */
export function captureFailed(platform, reason, t = ZH) {
    return platform === "linux" ? t("没找到截图工具：装 flameshot 或 gnome-screenshot 后再点") : t("截图没有启动：{0}", reason);
}
