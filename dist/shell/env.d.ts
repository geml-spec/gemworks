import { type T } from "./text.js";
/** The machine the session runs on and its checkout, as the bridge reads them (it runs beside the session). */
export interface HostInfo {
    /** The machine's name (os.hostname). */
    name: string;
    /** process.platform: win32, darwin, linux. */
    platform: string;
    /** The account the session runs as. */
    user?: string;
    /** The checkout's current branch. */
    branch?: string;
}
/** A client attached to the session (session.attach): where it draws, and its id. */
export interface AttachedClient {
    clientId: string;
    surface: string;
}
/** The environment as parts of one short line: 运行于 <machine>, the checkout's folder, the branch, 远程控制 when in play. What is not known is left out. */
export declare function envParts(o: {
    host: HostInfo | null;
    root: string | null;
    remote: boolean;
    t?: T;
}): string[];
/**
 * Whether Remote Control is in play: the band is drawn on a phone, or a phone
 * is attached, or the last prompt came over Remote Control — the times a
 * person may not be at the machine the session runs on.
 */
export declare function remoteInPlay(o: {
    surface?: string;
    clients: readonly AttachedClient[];
    origin?: string;
}): boolean;
