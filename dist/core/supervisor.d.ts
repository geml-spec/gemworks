import type { JsonValue } from "./schema.js";
import { type State, type Statechart } from "./statechart.js";
import { type Meta, type Snapshot } from "./snapshot.js";
import { type Run } from "./run.js";
import { type Dictionary } from "./dictionary.js";
import { type CommandOutcome, type SignalValue } from "./signals.js";
import { type ToolSpec } from "./tools.js";
import type { HostTools } from "./host-tools.js";
/** The verbs this supervisor carries out (`invoke`); `status` is read elsewhere. */
export declare const VERBS: readonly string[];
/** What the supervisor needs from its host: a journal sink, a clock, its tools and dictionary, optional hooks. */
export interface SupervisorHost {
    /** Append one journal block. Where it goes is the host's business. */
    append(block: string): void;
    /** The clock, as an ISO string. */
    now(): string;
    /** The state or the variables changed. Called after every accepted action. */
    changed?(): void;
    /** The tools this host runs commands and writes files with. */
    tools: HostTools;
    /** The workflow's tool dictionary as it stands. */
    dictionary: Dictionary;
    /** The work item's content fingerprint for this operation, when it could be read: `tool` evidence expires on a change. Read only when evidence is written or may expire: a host may make it a getter that reads it then. */
    readonly tree?: string;
    /** Whether a name is an existing local branch, for `git checkout <branch>` as a way out (switchesWorkItemOnly); absent, that form never is one. */
    isBranch?(name: string): boolean;
}
/** Why a transition is refused while a person holds the work item (spec §5.5). */
export declare const PAUSED_REASON = "the work item is paused; a person resumes it on the Gemworks board or with `gemworks resume`";
/** What a refusal adds: the way out that every state admits. */
export declare const WAY_OUT = "switching the work item is always allowed: git switch <branch>, git switch -c <branch>, git checkout -b <branch>, git worktree add <path>, cd <path>";
/** The verbs as a host that registers tools per state should see them for the state now (dsh). */
export interface Specs {
    status: ToolSpec;
    move: ToolSpec | null;
    set: ToolSpec | null;
}
/** A verb's outcome. `context`: the new stage text, when the caller keeps a context document and the verb changed the stage. */
export type Invoked = {
    ok: true;
    result: Record<string, JsonValue>;
    context?: string;
} | {
    ok: false;
    reason: string;
};
/** A gate's answer to a call before it runs. */
export type Gate = 
/** `unknown`: keys no row takes, let through unclassified (spec §5.3). */
{
    kind: "allow";
    uses: string[];
    unknown?: string[];
} | {
    kind: "refuse";
    reason: string;
};
/** `{at, call}` for the journal; `call` is omitted rather than left undefined. */
export declare function metaFor(at: string, callId?: unknown): Meta;
export declare class Supervisor {
    readonly sc: Statechart;
    readonly run: Run;
    private readonly host;
    private notice;
    constructor(sc: Statechart, run: Run, host: SupervisorHost);
    get verbs(): readonly string[];
    /** The three verbs of spec §8.5, bare or as a host lists them (`isOwnTool`). */
    owns(toolName: string): boolean;
    get snapshot(): Snapshot;
    /** Whether a person holds the work item (spec §5.5). */
    get paused(): boolean;
    state(): State | undefined;
    /** A line appended to every context snapshot — used when the workflow changed. */
    setNotice(text: string): void;
    /** The dictionary's reading of this state (spec §5.3). */
    private scope;
    /** Why a command line is refused for a fenced use in this state, or undefined — for a host whose command the sh scanners cannot read (pwsh). */
    fencedRefusal(command: string): string | undefined;
    /** The keys of a call on this host. */
    keys(toolName: string, input?: Record<string, unknown>): string[];
    /**
     * The gate before a call (spec §5.3). The rules that hold in every state
     * first: a person-only command is refused; a line that only switches the
     * work item is the way out of every state; the supervisor's own tools pass.
     * Then the fenced uses anywhere in a command line, and the dictionary's
     * decision on the call's keys. Deny-only by construction: nothing here
     * grants more than the dictionary does. A refusal is recorded.
     */
    gate(toolName: string, callId?: unknown, input?: Record<string, unknown>, waived?: readonly string[]): Gate;
    /** The gate as a reason to refuse, or undefined. */
    deny(toolName: string, callId?: unknown, input?: Record<string, unknown>): string | undefined;
    /** Record that the work wrote `path`, a project path: once per file per stage entry (Run.wrote). */
    recordWrite(toolName: string, path: string, callId?: unknown): void;
    /** Turn a call away: record it (with the key the gate judged, when it judged one), and say why. */
    refuse(toolName: string, reason: string, callId?: unknown, key?: string): string;
    /** The verbs for a host that registers tools per state; recomputed from the state, so `move`'s enum cannot drift from the transitions. */
    specs(): Specs;
    /** A model verb: the journal append, and the result. */
    invoke(name: string, args: Record<string, unknown>, meta: Meta): Invoked;
    private record;
    /** `move` takes a transition the model judges or one with no guard; a machine-judged one is taken on its own, one with approval by a person. */
    private doMove;
    private doSet;
    /** A person's rollback (`gemworks rollback`): the recorded state only, never what a command already did. */
    rollback(target: number | "checkpoint", meta: Meta): {
        ok: true;
        rev: number;
        restores: number;
        state: string;
        entered: string[];
    } | {
        ok: false;
        reason: string;
    };
    /**
     * Evidence expiry, at the start of an operation: the `tool` variables whose
     * content changed since their evidence was written return to their defaults
     * in one revision; then the automatic transitions that hold are taken.
     * Nothing without the operation's content fingerprint.
     */
    expire(meta: Meta): {
        expired: boolean;
        entered: string[];
    };
    /** Write each variable's value; then take automatic transitions while one holds. */
    /** The clock's evidence (spec §3.6): the `elapsed` variables as of `meta.at`; nothing in a final state, where the work item is closed. */
    elapse(meta: Meta): {
        wrote: string[];
        entered: string[];
    };
    applySignals(values: readonly SignalValue[], meta: Meta): {
        wrote: string[];
        entered: string[];
    };
    /** Which of the variables just written opened `edge`'s guard: the first the guard reads, else the last one written. */
    private openedBy;
    /** A call that ran a command line finished: its exit status is `tool` evidence for the uses its commands are bound to. */
    observeCommand(outcome: CommandOutcome, meta: Meta): {
        wrote: string[];
        entered: string[];
    };
    /** Any other call finished: `ok` is `tool` evidence for the use its key is bound to. */
    observeCall(toolName: string, input: Record<string, unknown> | undefined, ok: boolean, meta: Meta): {
        wrote: string[];
        entered: string[];
    };
    /** The uses a call's keys are bound to, in this state. */
    usesOfCall(toolName: string, input?: Record<string, unknown>): string[];
    /** A person moved the workflow (board or terminal). Approval is the act itself; a guard written beside it must hold. */
    humanTransition(to: string, meta: Meta): {
        ok: true;
        entered: string[];
    } | {
        ok: false;
        reason: string;
    };
    /** A person ticked or cleared a variable whose source is a person. */
    mark(name: string, checked: boolean, meta: Meta): {
        ok: true;
        wrote: string[];
        entered: string[];
    } | {
        ok: false;
        reason: string;
    };
    /**
     * A person holds the work item (spec §5.5): evidence goes on being recorded,
     * but no transition is taken, the model's, a person's or the machine's, until
     * they let it go.
     */
    pause(meta: Meta): {
        ok: true;
    } | {
        ok: false;
        reason: string;
    };
    /** A person lets the work item go: the machine-judged transition that came to hold meanwhile is taken now, as theirs. */
    resume(meta: Meta): {
        ok: true;
        entered: string[];
    } | {
        ok: false;
        reason: string;
    };
    /** Take the automatic transitions that hold from the current state, appending to the host's journal; `left` is the state a transition just left. Nothing while a person holds the item. */
    private autoAdvance;
    /** The state's own description. */
    instruction(): string;
    /** The per-step snapshot, a few hundred bytes; while a person holds the item, a line saying so. */
    context(): string;
}
export interface OpenOptions {
    sc: Statechart;
    /** The work item this run belongs to; goes in the journal head. */
    item: string;
    /** The workflow's path, for the journal head. */
    workflowFile: string;
    /** The journal as it stands, or null when there is none yet. */
    journalText: string | null;
    /** Why the session started. `clear` re-enters the initial state on the same chain. */
    source: string;
    now: string;
    /**
     * Where a fresh run starts: the state its work item says it stands in (a
     * file unit's item file, on a machine the journal never reached). Absent,
     * or a state the statechart does not have, the initial one.
     */
    startAt?: string;
}
export type Opened = {
    ok: true;
    run: Run;
    head: string;
    blocks: string[];
    notice: string;
    note?: string;
} | {
    ok: false;
    reason: string;
};
/**
 * Decide, without any I/O, what opening a run means: fresh or resumed, which
 * blocks the host must append, and whether the workflow moved underneath it.
 * The chain is verified before it is trusted — `resumeRun` does that.
 */
export declare function openRun(o: OpenOptions): Opened;
