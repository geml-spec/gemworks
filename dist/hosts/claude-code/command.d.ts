import type { BoardTab } from "./actions.js";
import type { BridgeResponse, ShellStatus } from "./protocol.js";
import { type T } from "./text.js";
export type CommandIntent = {
    kind: "status";
} | {
    kind: "board";
    tab?: BoardTab;
} | {
    kind: "pause";
} | {
    kind: "resume";
} | {
    kind: "use";
    workflow: string;
} | {
    kind: "add";
    workflow?: string;
} | {
    kind: "trace";
    on: boolean;
} | {
    kind: "help";
    reason?: string;
};
export declare const COMMAND_HINT = "[board [\u6807\u7B7E] | pause | resume | use <\u6D41\u7A0B> | add [\u6D41\u7A0B] | trace on|off]";
/** The usage, in the language chosen. */
export declare function usageText(t?: T): string;
export declare const COMMAND_USAGE: string;
export declare function parseCommand(args: string): CommandIntent;
/** Why there is no status, in a line: the quiet case points at /gemworks add. */
export declare function noStatusText(shell: ShellStatus, t?: T): string;
export declare function statusText(shell: ShellStatus, t?: T): string;
export declare function addText(res: Extract<BridgeResponse, {
    ok: true;
}>, t?: T): string;
/** What `/gemworks board` says: opened, opened but waiting for room, or why the board could not be read (then nothing opens). */
export declare function boardText(waitReason: string | undefined, failure?: string, t?: T): string;
/** Why a `board` request brought no board — no answer, an error answer, no workflow or a broken one — or undefined when it did. */
export declare function boardFailure(res: BridgeResponse | undefined, problem: string | null, t?: T): string | undefined;
/** What /gemworks trace on|off answers: the diagnosis trace switched. */
export declare function traceText(on: boolean, t?: T): string;
export declare function commandText(intent: CommandIntent, res: BridgeResponse | undefined, problem: string | null, t?: T): string;
