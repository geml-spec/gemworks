import type { VerbName } from "./core/verb-specs.js";
import type { Status, Workspace } from "./workspace.js";
/** A verb's answer; `context` is the new stage text when an accepted verb changed the stage. */
export interface VerbAnswer {
    ok: boolean;
    text: string;
    context?: string;
}
export declare function statusForModel(s: Status): string;
/** What `status` answers for the stage text before the first one exists. */
export declare const NO_STAGE_CONTEXT = "[gemworks] no stage context yet";
export declare function runVerb(ws: Workspace, name: VerbName, args: Record<string, unknown>, callId?: string): VerbAnswer;
