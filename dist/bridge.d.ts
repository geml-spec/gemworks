import type { BridgeRequest, BridgeResponse } from "./hosts/claude-code/protocol.js";
/** The text with the project's and the home directory's absolute paths taken out, both separators. */
export declare function stripPaths(text: string, root: string): string;
/** One request, answered. A throw — from opening the workspace or from the op — becomes an error answer with no shell: the last good one stays. */
export declare function handleRequest(req: BridgeRequest): Promise<BridgeResponse>;
/** handleRequest, answered at once: every op is answered without waiting on anything but the files and git. */
export declare function answerRequest(req: BridgeRequest): BridgeResponse;
