// Where the session runs, in a few words: the machine it runs on (under Remote
// Control the machine at the other end, not the one in the person's hand), the
// checkout and its branch, and whether Remote Control is in play. Pure and
// Node-free: the bridge reads the machine (os.hostname), the hooks module the
// clients attached and where the last prompt came from.
import { ZH } from "./text.js";
/** The environment as parts of one short line: 运行于 <machine>, the checkout's folder, the branch, 远程控制 when in play. What is not known is left out. */
export function envParts(o) {
    const t = o.t ?? ZH;
    const parts = [];
    if (o.host !== null)
        parts.push(t("运行于 {0}", o.host.name));
    const folder = (o.root ?? "").split(/[\\/]/).filter((s) => s !== "").pop();
    if (folder !== undefined)
        parts.push(folder);
    if (o.host?.branch !== undefined && o.host.branch !== "")
        parts.push(o.host.branch);
    if (o.remote)
        parts.push(t("远程控制"));
    return parts;
}
/**
 * Whether Remote Control is in play: the band is drawn on a phone, or a phone
 * is attached, or the last prompt came over Remote Control — the times a
 * person may not be at the machine the session runs on.
 */
export function remoteInPlay(o) {
    return o.surface === "mobile" || o.clients.some((c) => c.surface === "mobile") || o.origin === "bridge";
}
