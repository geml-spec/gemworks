import type { SessionEvent } from "./session-log.js";
/** One turn of a transcript: a prompt and what followed it before the next. */
export interface TranscriptTurn {
    /** The prompt record's uuid: what makes a turn the same one when the transcript is read again. */
    uuid: string;
    at: string;
    text: string;
    /** Who asked: the person; a scheduled task (`scheduled` names it); another session's message. */
    kind: "person" | "scheduled" | "peer";
    scheduled?: string;
    branch?: string;
    cwd?: string;
    /** The last answer with words before the next prompt, and when. */
    answer?: string;
    answerAt?: string;
    /** The files Write, Edit and NotebookEdit wrote, in order, once each. */
    files: string[];
    /** The pages the Artifact tool published. */
    links: {
        url: string;
        version?: string;
        title?: string;
    }[];
    /** Pictures and documents the person gave with the prompt: their bytes as the transcript holds them. */
    uploads: {
        name?: string;
        mediaType?: string;
        data: string;
    }[];
}
export interface Transcript {
    id: string;
    cwd?: string;
    branch?: string;
    started: string;
    last: string;
    turns: TranscriptTurn[];
}
/** The folder under ~/.claude/projects that holds a directory's transcripts: every character but letters, digits and `-` becomes `-`. */
export declare function slugOf(path: string): string;
/** A message the person typed while a turn ran: its record's uuid, its words, when it was sent. */
export interface QueuedMessage {
    uuid: string;
    text: string;
    at: string;
}
/** The messages the person typed while a turn ran: attachment records of type queued_command, in order. */
export declare function queuedMessages(text: string): QueuedMessage[];
/** The transcript's turns; undefined when the text holds no session. */
export declare function readTranscript(text: string): Transcript | undefined;
/**
 * A transcript as the session record's events, turns numbered from `from`:
 * a session line first when `head` is wanted, then each turn's prompt (its
 * uuid kept, marked backfilled), its answer, and the files it wrote.
 */
export declare function transcriptEvents(tr: Transcript, host: string, o: {
    head: boolean;
    from?: number;
}): SessionEvent[];
/** The turns of `tr` whose prompt uuid no event of `events` carries: what a transcript read again still adds. */
export declare function newTurns(tr: Transcript, events: readonly SessionEvent[]): Transcript;
