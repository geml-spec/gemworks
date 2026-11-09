import { type SessionEvent, type SessionSummary, type SharedDecision } from "./core/session-log.js";
/** The directory of a project's session logs, for any of its checkouts. */
export declare function sessionsDirOf(root: string): string;
/**
 * A session's log with the events `make` adds at its end (given the events
 * so far, a session line first when there was none); returns every event.
 * The directory and its ignore file are made the first time.
 */
export declare function appendSession(root: string, host: string, id: string, make: (events: SessionEvent[]) => SessionEvent[], now?: string): SessionEvent[];
/** Every session in the project's record. */
export declare function readSessions(root: string): SessionSummary[];
/** The session of `host` that asked last, in this checkout when it has one: what an MCP server, which is told no session, writes for. */
export declare function latestSessionOf(root: string, host: string): string | undefined;
/** A person's prompt into the log, as the next turn. */
export declare function recordPrompt(root: string, host: string, id: string, text: string, now?: string): void;
/** The model's decisions into the log, under the turn under way. */
export declare function recordDecisions(root: string, host: string, id: string, decisions: readonly string[], now?: string): number;
/** A file the session wrote, once. */
export declare function recordFile(root: string, host: string, id: string, path: string, now?: string): void;
/** A turn's end: its answer, and when a command in it committed, the commits made since its prompt. */
export declare function recordAnswer(root: string, host: string, id: string, answer: string, committed: boolean, now?: string): void;
/** The other sessions' decisions after `since` (the last three days when null). */
export declare function decisionsFor(root: string, id: string, since: string | null, now?: string): SharedDecision[];
/** How long a session's mark of being open holds: one that marks every two minutes and has not for this long is closed. */
export declare const OPEN_MS: number;
/** An open session, as its last mark says: which tool, which checkout and branch, when. */
export interface OpenSession {
    id: string;
    host: string;
    checkout: string;
    branch?: string;
    at: string;
}
/**
 * Mark session `id` of `host` open now, in `root` on the checkout's branch (a file of its own under the logs' `open/`);
 * answer the other sessions marked open within OPEN_MS, newest first.
 */
export declare function markOpen(root: string, host: string, id: string, now?: Date): OpenSession[];
/** The branches the other open sessions work on and this one (on `own`) does not: each once, with the folder its newest session works in. */
export declare function branchesElsewhere(open: readonly OpenSession[], own: string | undefined): {
    branch: string;
    where: string;
}[];
/** A host's name for the line beside a prompt. */
export declare function hostLabel(host: string): string;
/** Whether a shell command makes a commit. */
export declare function commits(command: string): boolean;
