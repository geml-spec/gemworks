import type { JsonValue } from "./schema.js";
import type { FlowDiagnostic } from "./statechart.js";
export declare const TOOLS_FILE = "tools.geml";
export declare const TOOLS_TABLE = "tools";
export declare const COLUMNS: readonly ["tool", "for", "allow", "deny", "default", "params"];
export interface DictRow {
    /** The key pattern: a tool name (`Read`, `mcp__geml__*`) or a command (`Bash(npm test)`, `Bash(geml media todo * --check)`). */
    tool: string;
    /** The use it is bound to, when any. */
    for?: string;
    /** State ids, or `*`. */
    allow: string[];
    deny: string[];
    /** The use's preferred tool. */
    default: boolean;
    params?: Record<string, JsonValue>;
    /** 1-based row in the table. */
    row: number;
}
export interface Dictionary {
    rows: DictRow[];
    diagnostics: FlowDiagnostic[];
}
export declare const NAME: RegExp;
/** An empty dictionary: every call is the dictionary's to learn. */
export declare const EMPTY_DICTIONARY: Dictionary;
export declare const RUN_KEY: RegExp;
/** A command as a key reads: quoting removed, each run of blanks (the space and the tab: what the shell splits words at) one space. */
export declare const normalizedCommand: (command: string) => string;
/**
 * The keys of one call (spec §5.3): the tool's name; for a tool that runs a
 * command line (`runTools`) one `Bash(<command>)` per simple command of the
 * line — the whole line as one key when it cannot be read as commands; for a
 * tool that writes files (`writeTools`) `<tool>(<path>)`, so a row can tell
 * one file from another (writing a matter from writing the code).
 */
export declare function keysOf(tool: string, input: Readonly<Record<string, unknown>> | undefined, runTools: readonly string[], writeTools?: readonly string[]): string[];
/**
 * The keys of a finished command line that may speak for evidence (spec
 * §5.2): one `Bash(<command>)` per simple command of a plain `&&` chain —
 * `commands` picks which (signalHeads' order) — and none when the line is
 * anything else, since its exit status says nothing about the command that
 * matched.
 */
export declare function evidenceKeys(command: string, commands?: readonly number[]): string[] | null;
/**
 * Whether a row's `tool` pattern takes `key`. A command pattern takes a
 * command; a tool's name takes the tool, with any path; `<tool>(<glob>)` takes
 * the tool's calls on a path that ends in a match of the glob, so one row
 * holds for the file wherever the project lies.
 */
export declare function keyMatches(pattern: string, key: string): boolean;
/** The literal part of a pattern, for "the longest literal wins". */
export declare function literalLength(pattern: string): number;
/** The row that takes `key`: among the matching rows, the one with the longest literal; undefined when none. */
export declare function bindingOf(dict: Dictionary, key: string): DictRow | undefined;
/** The preferred tool of a use: its `default` row, else the first row bound to it. */
export declare function preferred(dict: Dictionary, use: string): DictRow | undefined;
export type KeyVerdict = {
    key: string;
    kind: "allow";
    use?: string;
} | {
    key: string;
    kind: "refuse";
    reason: string;
}
/** No row takes the key: the call is not the workflow's business, and goes through unclassified. */
 | {
    key: string;
    kind: "unknown";
};
export type Decision = 
/** `unknown`: the keys no row takes — let through, unclassified (spec §5.3). */
{
    kind: "allow";
    uses: string[];
    unknown: string[];
}
/** `keys`: the keys refused, one reason each. */
 | {
    kind: "refuse";
    reasons: string[];
    keys: string[];
};
/** Where a decision is made: the current state, the uses it declares, which states declare any use, and whether a use is a rule (fenced to them). */
export interface Scope {
    state: string;
    uses: readonly string[];
    declaring: (use: string) => readonly string[];
    fenced: (use: string) => boolean;
}
/**
 * One key against the dictionary in state S: bound to a use S declares →
 * allowed; bound to a use S does not → refused; else a written allow or deny;
 * else unknown. Whether an unknown command is safe to run is the host's
 * permission system's to judge, by its arguments' values; the dictionary only
 * says which use a call is, and so where it may run.
 */
export declare function judgeKey(dict: Dictionary, scope: Scope, key: string): KeyVerdict;
/** The call's decision from its keys: any key refused refuses the call; otherwise it is allowed, the keys no row takes named as unknown. */
export declare function decide(dict: Dictionary, scope: Scope, keys: readonly string[]): Decision;
/**
 * Fenced uses, searched anywhere in a command line (spec §5.2): a command
 * pattern bound to a use the state does not declare, found in the line or in
 * its copy without quoting, refuses the call — so a wrapped deployment
 * (`bash -c "…"`, `npx …`) is refused too. Among the command patterns found
 * in the line the one with the longest literal speaks, as it does for a key:
 * `wrangler deploy*--env staging` (staging) wins over `wrangler deploy`
 * (production) in a staging deploy. A line that wraps two commands is read as
 * its longest one; the keys of a plain `&&` chain are judged one by one.
 */
export declare function fencedRefusal(dict: Dictionary, scope: Scope, command: string): string | undefined;
/** The dictionary row that fences a command line in this state (fencedRefusal's reading), or undefined: its `tool` is the key a person waives. */
export declare function fencedRow(dict: Dictionary, scope: Scope, whole: string): DictRow | undefined;
/** The uses a finished call's keys are bound to, for the `tool` evidence: only keys bound to a use the state declares. */
export declare function usesOf(dict: Dictionary, scope: Scope, keys: readonly string[]): string[];
export type Lesson = {
    kind: "allow";
    key: string;
    where: string | "*";
} | {
    kind: "deny";
    key: string;
    where: string | "*";
} | {
    kind: "use";
    key: string;
    use: string;
} | {
    kind: "default";
    key: string;
    use: string;
} | {
    kind: "params";
    key: string;
    params: Record<string, JsonValue>;
}
/** The row of exactly that key goes: the tool is judged as if nobody had written it. */
 | {
    kind: "forget";
    key: string;
};
/**
 * The dictionary with one lesson written in: an existing row of exactly that
 * key is changed, else a row is added. A key with a line break (a command
 * line that spans lines) is not learned: no table cell can hold it, and the
 * answer still decides the call it was given for.
 */
export declare function learn(dict: Dictionary, lesson: Lesson): Dictionary;
