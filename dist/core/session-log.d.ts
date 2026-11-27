/** The directory under the project's shared `.geml/` that holds the logs, and the ignore file that keeps them out of git. */
export declare const SESSIONS_DIR = "sessions";
export declare const SESSIONS_GITIGNORE = "*\n";
export type SessionEvent = 
/** `backfilled`: read from the host's own transcript after the fact (transcript.ts), not recorded as it happened; `scheduled`: a scheduled task's session, by name. */
{
    t: "session";
    id: string;
    host: string;
    at: string;
    branch?: string;
    checkout?: string;
    backfilled?: boolean;
    scheduled?: string;
}
/** `uuid`: the prompt's row in the host's transcript, where known; `kind`: whose the prompt was when not the person's. */
 | {
    t: "prompt";
    turn: number;
    at: string;
    text: string;
    uuid?: string;
    backfilled?: boolean;
    kind?: "scheduled" | "peer";
} | {
    t: "answer";
    turn: number;
    at: string;
    text: string;
}
/**
 * A decision, and whose it is (`by`, DecidedBy): the person's words for it (`said`), or their press (`pressed`). An
 * event written before `by` was reads as the person's press when its text is one of the session's prompts — a press
 * says its words as the prompt and records them as the decision — and as the model's otherwise.
 */
 | {
    t: "decision";
    turn: number;
    at: string;
    text: string;
    by?: DecidedBy;
    said?: string;
    pressed?: boolean;
} | {
    t: "file";
    turn: number;
    at: string;
    path: string;
    branch?: string;
} | {
    t: "commit";
    turn: number;
    at: string;
    sha: string;
    subject: string;
    branch?: string;
}
/**
 * A work item the turn was about, as the model reported it (the work tool) or a press set it: which flow, the steps whose
 * leave requirement is met (`met`; an event written before steps were met names only `state`), the step it stands at,
 * what it still needs, what comes next and what it should be at the end. The newest event of an id, in any session, is
 * the item as it stands.
 */
 | {
    t: "item";
    turn: number;
    at: string;
    id: string;
    flow: string;
    title: string;
    state: string;
    needs: string;
    goal: string;
    status: ItemStatus;
    met?: MetStep[];
    next?: string;
}
/**
 * A question the turn ends with, as the model registered it (the ask tool) on a host with no status band: what the
 * GEML board lists under 等你 until the session's next prompt, which answers it or leaves it for the model to ask again.
 */
 | {
    t: "ask";
    turn: number;
    at: string;
    question: string;
    options: string[];
    recommended?: string;
    item?: string;
};
/**
 * Whose a decision is: `person` — their press, or their own words (`said`) found in a prompt they typed in the session
 * that recorded it; `model` — a model's note with no such words. Only the person's are passed on as theirs.
 */
export type DecidedBy = "person" | "model";
/** Where a work item stands: on its way, put aside by the person, finished, or given up. */
export type ItemStatus = "open" | "held" | "done" | "dropped";
/**
 * A step whose leave requirement is met: when, in which turn, and how — a step the person judges by their words or
 * their press (`said` then holds the button's words); a fact step by what proves it as the model gave it
 * (`evidence`), and the run this session saw that matches it (`seen`).
 */
export interface MetStep {
    step: string;
    at: string;
    turn: number;
    said?: string;
    pressed?: boolean;
    evidence?: string;
    seen?: SeenRun;
}
/** A command this session ran and how it ended: what a fact step's evidence is checked against. */
export interface SeenRun {
    command: string;
    exit: number;
    at: string;
}
/** A log's file name: the host and the session's id, neither able to leave the directory. */
export declare function logName(host: string, id: string): string;
/** The name an earlier log had (plain JSON lines): read, and carried into the GEML one when the session writes next. */
export declare function legacyLogName(host: string, id: string): string;
/** Whether a directory entry is a log: a GEML one, or an earlier .jsonl one with no GEML one beside it. */
export declare function isLogName(name: string, names: readonly string[]): boolean;
/** The events of a log (its events block, or every line of an earlier log); a line that is no event (one cut short while its session wrote it) is left out. */
export declare function parseLog(text: string): SessionEvent[];
/** A log document holding `events`, one JSON event a line in its events block. */
export declare function formatLog(events: readonly SessionEvent[]): string;
/** The log with `events` added at the end of its events (an earlier log comes out as a GEML one). */
export declare function appendEvents(text: string, events: readonly SessionEvent[]): string;
/** The turn the next prompt opens: one past the last one the log holds. */
export declare function nextTurn(events: readonly SessionEvent[]): number;
/** The turn now under way: the last prompt's. */
export declare function currentTurn(events: readonly SessionEvent[]): number;
/** `gist`: the answer's first sentence, kept by a reader that lets the answer itself go. */
/** A work item a turn moved: the steps it met in that turn (with their words or press), where the item then stood, and when. */
export interface TurnMove {
    id: string;
    title: string;
    flow: string;
    state: string;
    met: MetStep[];
    status: ItemStatus;
    at: string;
}
/** `byPerson`: of `decisions`, the ones that are the person's own (DecidedBy); the rest a model recorded. */
export interface SessionTurn {
    turn: number;
    at: string;
    prompt: string;
    answer?: string;
    gist?: string;
    decisions: string[];
    byPerson?: string[];
    uuid?: string;
    backfilled?: boolean;
    kind?: "scheduled" | "peer";
    moved?: TurnMove[];
}
/** A decision as a session's record holds it: when, in which turn, and whose (DecidedBy). */
export interface Decision {
    turn: number;
    at: string;
    text: string;
    by: DecidedBy;
    said?: string;
    pressed?: boolean;
}
/** One session as the record holds it: who, where, when, and what it asked, decided and made. */
export interface SessionSummary {
    id: string;
    host: string;
    branch?: string;
    checkout?: string;
    /** Read from the host's transcript after the fact; `scheduled` names the task whose session it was. */
    backfilled?: boolean;
    scheduled?: string;
    started: string;
    last: string;
    turns: SessionTurn[];
    decisions: Decision[];
    files: {
        path: string;
        at: string;
        branch?: string;
    }[];
    commits: {
        sha: string;
        subject: string;
        at: string;
        branch?: string;
    }[];
    /** The work items it reported, the newest event of each. */
    items?: Extract<SessionEvent, {
        t: "item";
    }>[];
    /** The questions its last turn ended with (the ask tool, on a host with no status band); gone at its next prompt. */
    asks?: Extract<SessionEvent, {
        t: "ask";
    }>[];
}
/** A log read as one session; undefined for a log with no session line. */
export declare function summarize(events: readonly SessionEvent[]): SessionSummary | undefined;
/** The prompts the person gave in a session: the ones they typed or pressed, not a scheduled task's or another session's. */
export declare function personPrompts(events: readonly SessionEvent[]): string[];
/** Whether `said` is the person's own words: found in one of the prompts they gave. */
export declare function saidByPerson(said: string, prompts: readonly string[]): boolean;
/** A note read: the decisions to record and whose each is, the lines left out as status, and the choices recorded as the model's because the person's words were not found. */
export interface NoteRead {
    decided: {
        text: string;
        by: DecidedBy;
        said?: string;
    }[];
    status: string[];
    unfound: string[];
}
/**
 * The note tool's arguments read against the person's prompts in this session: `decisions` are the model's, `theirs`
 * the person's when their words (`said`) are found in one of those prompts, the model's otherwise. A line that records
 * status rather than a decision is left out.
 */
export declare function readNote(args: unknown, prompts: readonly string[]): NoteRead;
/** What the note tool answers, on every host alike. */
export declare function noteReply(r: NoteRead): string;
/** How close in time two prompts with the same words are one prompt recorded twice (live, and read back from the transcript): the same moment, seconds apart; a person repeats a sentence minutes apart. */
export declare const SAME_PROMPT_MS = 30000;
/**
 * A session's events with turns read from its transcript put before the ones
 * it recorded live: the earlier turns, numbered from 1, go after the session
 * line, and every turn recorded live moves up by as many. An earlier turn
 * whose prompt is already there (the same words within five minutes) is left
 * out, so reading the transcript again adds nothing.
 */
export declare function withEarlierTurns(events: readonly SessionEvent[], earlier: readonly SessionEvent[]): SessionEvent[];
/** Another session's decision, whose it is (DecidedBy) and how the person gave it: their words (`said`) or their press. */
export interface SharedDecision {
    text: string;
    at: string;
    session: string;
    host: string;
    branch?: string;
    by: DecidedBy;
    said?: string;
    pressed?: boolean;
}
/** The other sessions' decisions recorded after `since` (all of them when null), oldest first, at most `limit` (the newest kept). */
export declare function decisionsSince(sessions: readonly SessionSummary[], ownId: string, since: string | null, limit?: number): SharedDecision[];
/** The files the sessions changed, each with the sessions that changed it; more than one is a clash to settle before merging. Newest first. */
export declare function filesBySession(sessions: readonly SessionSummary[]): {
    path: string;
    at: string;
    sessions: string[];
}[];
/** The tool every host lists for the model to record a turn's conclusions and decisions in its session's log. */
export declare const NOTE_TOOL: {
    readonly name: "note";
    readonly description: "Record this turn's decisions in the project's shared session record, so the project's other sessions (on other branches, worktrees and tools) know them. A decision is a choice that changes what comes next, or a finding the other sessions would otherwise discover again. A choice the person made goes in `theirs`, with their own words for it in `said` as they gave them in a prompt of this session: it is recorded as the person's only when those words are found there, and as yours otherwise. Your own conclusions, findings and the choices you made for them go in `decisions`. Never status (what was pushed, synced, committed, merged, built, or what a version does), progress or plans: git, the board and the journal hold those. Call it once before the turn ends, each decision a short sentence that stands on its own.";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly decisions: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
                readonly description: "Your own conclusions, findings and the choices you made for the person, one short sentence each.";
            };
            readonly theirs: {
                readonly type: "array";
                readonly items: {
                    readonly type: "object";
                    readonly properties: {
                        readonly text: {
                            readonly type: "string";
                            readonly description: "The choice, one short sentence.";
                        };
                        readonly said: {
                            readonly type: "string";
                            readonly description: "The person's own words for it, as they gave them in a prompt of this session.";
                        };
                    };
                    readonly required: readonly ["text", "said"];
                    readonly additionalProperties: false;
                };
                readonly description: "The choices the person made, each with their own words.";
            };
        };
        readonly additionalProperties: false;
    };
};
/** What the model is told once, in the system prompt, about the project's other sessions. */
export declare const SESSIONS_PROMPT = "Gemworks: this project is worked on in several sessions at once, on other branches, worktrees and tools. When a turn reaches a decision the other sessions should know \u2014 a choice the person made that changes what comes next, or a finding they would otherwise discover again \u2014 record it with the gemworks `note` tool before the turn ends, one short sentence each: the person's choices with their own words, yours and your findings apart; never status (pushed, synced, committed, what a version does) or plans. Decisions the other sessions recorded arrive beside the person's prompts, marked [gemworks]: the person's own apart from the ones only a model recorded, which are for reference and not the person's word.";
/**
 * Whether a line records status rather than a decision: a version and what
 * it does, something pushed, synced, committed, merged, released or built, a
 * test count. Git, the board and the journal hold those; the record does not.
 */
export declare function isStatusLine(text: string): boolean;
/** Whether an answer puts a question off rather than answering it (暂不, later): no decision to record. */
export declare function isDeferral(label: string): boolean;
/**
 * The other sessions' decisions as the line beside a prompt says them: the person's first, with how they gave each; then
 * the ones only a model recorded, marked as reference — a model's note is never passed on as the person's word.
 */
export declare function decisionsContext(decisions: readonly SharedDecision[], label: (d: SharedDecision) => string): string;
