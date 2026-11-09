import type { SessionSummary } from "../../core/session-log.js";
import type { T } from "./text.js";
export interface PromptRecord {
    id: string;
    at: string;
    text: string;
    /** The row's id in the host's record, as `session.append` gave it: what locates the prompt in the transcript and names its turn to the bridge. */
    uuid?: string;
    item?: string;
    /** The work item's name and its flow's title, as the prompt was sent. */
    itemTitle?: string;
    flow?: string;
    state?: string;
    /** What the turn after it did: the first sentence of its answer, once it ended; tool calls, refusals, the states entered, the evidence written. */
    did?: string;
    tools: number;
    refusals: number;
    entered: string[];
    signals: string[];
    /** Read back from the host's transcript (a turn before gemworks loaded), not recorded as it happened. */
    backfilled?: boolean;
}
export interface PromptGroup {
    state?: string;
    from: string;
    to?: string;
    prompts: PromptRecord[];
}
/** The first line of a prompt, at most `max` cells. */
export declare function promptLine(text: string, max?: number): string;
/**
 * The first sentence of a turn's answer, as plain words: its first line of
 * prose (code blocks, headings, tables and rules skipped; quotes' and lists'
 * marks, emphasis, inline code and link targets left out), up to the end of
 * its first sentence; undefined for an answer with none.
 */
export declare function answerGist(answer: string): string | undefined;
/** Consecutive prompts under one stage make a group, from the first's time to the last's. */
export declare function promptGroups(prompts: readonly PromptRecord[]): PromptGroup[];
/** What followed a prompt, in a few words: `7 次工具调用 · tests-pass ✓ · 自动进 #review`. */
export declare function promptTail(p: PromptRecord, t: T): string;
/** The session's prompts as a document: GEML (a `data {#session}` index, then one text block per prompt), or Markdown for the share dialog's copy. */
export declare function sessionExport(prompts: readonly PromptRecord[], format: "geml" | "md", session: string, t: T): string;
/**
 * A session's record (session-log.ts) as a GEML document: every turn's prompt
 * and answer and the decisions it recorded, oldest first — a `data {#session}`
 * index, then a text block for each prompt and each answer. For this session
 * and for another's alike.
 */
export declare function logExport(s: SessionSummary, t: T): string;
/** Whether a line fits the pane: a guard for the tests, so the export's width rules live here. */
export declare const fits: (text: string, columns: number) => boolean;
