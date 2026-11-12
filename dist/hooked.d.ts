import { type CallFacts } from "./hosts/claude-code/fastpath.js";
/** How a host names its tools, and where its calls say what they did. */
export interface HostTools {
    /** The shell tool's name. */
    readonly shell: string;
    /** Whether a tool is the shell, for a host that has it under several names; else the one `shell` names. */
    readonly isShell?: (tool: string) => boolean;
    /** The call as the gate and the dictionary read it: Claude Code's tool names. */
    readonly callOf: (tool: string, input: Readonly<Record<string, unknown>>) => CallFacts;
    /** The files a call writes, as it names them; none for a tool that writes nothing. */
    readonly writes: (tool: string, input: Readonly<Record<string, unknown>>) => readonly string[];
    /** A shell call's exit status from its result; null when there is none. */
    readonly exitCodeOf: (response: unknown) => number | null;
    /** An MCP tool's own name. */
    readonly bareTool: (tool: string) => string;
}
/** One event, in no host's shape. */
export type HookedEvent = {
    kind: "start";
    source?: string;
}
/** `personal`: the words are surely the person's, so this is a new turn whatever `turn` says. */
 | {
    kind: "prompt";
    words?: string;
    turn?: string;
    personal: boolean;
} | {
    kind: "before";
    tool: string;
    callId?: string;
    input: Record<string, unknown>;
} | {
    kind: "after";
    tool: string;
    callId?: string;
    input: Record<string, unknown>;
    failed: boolean;
    response?: unknown;
}
/** `retry`: the turn already went on once because the host's stop was blocked. */
 | {
    kind: "stop";
    answer?: string;
    retry: boolean;
};
/** What the host should do; undefined is nothing. */
export type HookedAnswer = {
    kind: "context";
    text: string;
} | {
    kind: "deny";
    reason: string;
}
/** The call goes on, with `input` in place of its own when given, and `context` for the model when given. */
 | {
    kind: "allow";
    input?: Record<string, unknown>;
    context?: string;
} | {
    kind: "continue";
    reason: string;
} | undefined;
export interface HookedOptions {
    home?: string;
    platform?: string;
    now?: string;
}
/** Where an adapter keeps its sessions' state. */
export declare const hostStateDir: (host: string, home?: string) => string;
/** The session a host's hooks last saw and its project: what an MCP server started outside any project writes for. */
export interface Active {
    session: string;
    root: string;
    at: string;
}
export declare function activeOf(host: string, home?: string): Active | undefined;
/** The project and session a host's MCP server works in: its own folder when that has a `.geml/` (undefined), else the one the hooks last saw. */
export declare function mcpRootOf(host: string, root: string, home?: string): Active | undefined;
/** One event of session `sid` in project `root`, as host `host` names its tools. */
export declare function runHooked(host: string, tools: HostTools, sid: string, root: string, ev: HookedEvent, o?: HookedOptions): Promise<HookedAnswer>;
