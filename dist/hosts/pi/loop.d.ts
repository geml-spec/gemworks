import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type Waiting } from "../../core/board-page.js";
import { type Practice } from "../../core/practices.js";
import { type SharedDecision } from "../../core/session-log.js";
import { type CoachFlow, type WorkItem } from "../../core/work.js";
import { type Complete } from "../../ledger-run.js";
export declare const PI_HOST = "pi";
/** What the band and the board are drawn from. */
export interface PiLoopData {
    flows: readonly CoachFlow[];
    items: readonly WorkItem[];
    waiting: readonly Waiting[];
    practices: readonly Practice[];
    decisions: readonly SharedDecision[];
    /** This session's own questions, the recommended answer first. */
    asks: readonly {
        question: string;
        options: readonly string[];
    }[];
}
/** A width in terminal cells: the wide East Asian characters take two. */
export declare function cells(text: string): number;
/** A line cut to `width` cells, an ellipsis where it was cut. */
export declare function fit(text: string, width: number): string;
/**
 * The band above the editor, a line or three: this session's work item and where it stands (or that none is on the
 * way), the first thing that waits on the person and how many more, the step's first practice.
 */
export declare function bandLines(d: PiLoopData, session: string, width?: number): string[];
/** The board the overlay shows: what waits on the person, the work items, their step's practices, the other sessions' decisions. */
export declare function boardLines(d: PiLoopData, width?: number): string[];
/** The band's and the board's data, read from the project's record now. */
export declare function piLoopData(cwd: string, session: string): PiLoopData;
/**
 * The session's own model, borrowed: Pi's registry completes with the model the person chose and its own credentials.
 * Undefined when the session has none.
 */
export declare function piComplete(ctx: Pick<ExtensionContext, "model" | "modelRegistry">): Complete | undefined;
/** The work loop on Pi, for the session in `cwd`: registered once, at load. */
export declare function attachLoop(pi: ExtensionAPI, cwd: string): void;
