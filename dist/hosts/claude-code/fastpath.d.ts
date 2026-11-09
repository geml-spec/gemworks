import type { FlowPolicy } from "../../core/policy.js";
import { isOwnTool, OWN_TOOL_PREFIX } from "../../core/verb-specs.js";
export { isOwnTool, OWN_TOOL_PREFIX };
export interface CallFacts {
    tool: string;
    input: Record<string, unknown>;
}
export interface CallOutcome {
    isError: boolean;
    /** A run tool's exit status; null when it has none (backgrounded, interrupted). */
    exitCode?: number | null;
    /** The project-relative path a write tool touched. */
    wrotePath?: string;
    gitOperation: boolean;
    /** `before` was consulted and recorded something. */
    consulted: boolean;
}
/**
 * What the hooks module does before a call: let it through, ask the CLI's
 * `before` (which refuses and records), or ask the person about a tool that
 * is not its use's preferred one (spec §5.3, preferences). A key no row takes
 * passes: whether it is safe to run is the host's permission system's call.
 */
export type BeforeDecision = {
    kind: "pass";
}
/** `waived`: keys a person let through once (the board's "allow once") that this call would be refused on; the CLI's `before` is told. */
 | {
    kind: "consult";
    waived?: string[];
} | {
    kind: "prefer";
    key: string;
    use: string;
    preferred: string;
};
/** Whether a written path is a work item of a `file:` unit. */
export declare function matchesUnit(p: FlowPolicy | null, path: string | undefined, units?: readonly string[]): boolean;
/**
 * What tells the hooks module whether a call may act outside the session's
 * checkout: `elsewhere` outright when the command line moves the shell
 * (changesDirectory), or the call's directory — a written file's, else the one
 * the call starts in — is not under the root; otherwise the directories to look
 * in for a `.git` entry, from that directory up to the root, the root's own
 * excluded. A `.git` entry there is a checkout of its own (a worktree, another
 * repository) below the root.
 */
export declare function checkoutProbe(call: CallFacts, cwd: string, root: string): {
    elsewhere: true;
} | {
    elsewhere: false;
    dirs: string[];
};
export declare function beforeDecision(p: FlowPolicy | null, call: CallFacts, elsewhere?: boolean, passes?: readonly string[]): BeforeDecision;
export declare function afterNeeded(p: FlowPolicy | null, call: CallFacts, o: CallOutcome, elsewhere?: boolean): boolean;
/**
 * The parameters a call leaves out that its tool's dictionary row fills in
 * (spec §5.3, preferences): for a tool whose input is structured data, never
 * a command line. Undefined when there is nothing to fill.
 */
export declare function paramsToFill(p: FlowPolicy | null, call: CallFacts): Record<string, unknown> | undefined;
export { preferAnswer, preferQuestion, type Answered } from "../../core/asking.js";
