import { type Proposal } from "./core/growth.js";
import { type CoachFlow, type WorkItem } from "./core/work.js";
/** The flows the package ships, beside `dist/`. */
export declare const SHIPPED_COACH: string;
/** What a loop tool answers: whether it recorded anything, and the line the model reads. */
export interface LoopResult {
    ok: boolean;
    text: string;
}
/** A tool as an MCP server lists it. */
export interface LoopTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
/** The tools of the work loop on a host with no status band, in the order they are listed. */
export declare const LOOP_TOOLS: readonly LoopTool[];
/** Whether a tool name is one of the loop's. */
export declare const isLoopTool: (name: string) => boolean;
/** The project's own `.geml/` directory, in its main working tree: where every checkout reads and writes the same record. */
export declare const gemlHome: (root: string) => string;
/**
 * The light flows: for each shipped flow, the project's own (`.geml/coach/<name>.geml`), else the team's
 * (`.gemworks/flows/<name>.geml` in the checkout), else the shipped one; then the flows the project added. A flow that
 * does not read is left out.
 */
export declare function coachFlowsAt(root: string, shipped?: string): CoachFlow[];
/** The work items the project's sessions reported, as they stand now, newest first. */
export declare function workItemsAt(root: string, flows: readonly CoachFlow[]): WorkItem[];
/** The work tool: the turn's work items, checked against the flows, into this session's log. */
export declare function recordWork(root: string, host: string, session: string, args: Record<string, unknown>, now?: string): LoopResult;
/** The practice tool: the practices given, checked against the flows and the ones kept, into their layers. */
export declare function recordPractices(root: string, host: string, session: string, args: Record<string, unknown>, now?: string): LoopResult;
/** The proposals kept in the project's `.geml/proposals.geml`. */
export declare function proposalsAt(root: string): Proposal[];
/** The proposals written back into the project's `.geml/proposals.geml`. */
export declare function saveProposals(root: string, list: readonly Proposal[]): void;
/** The propose tool: the proposals given, checked against the flows and the ones kept, for the person to answer. */
export declare function recordProposals(root: string, args: Record<string, unknown>, now?: string): LoopResult;
/** The answer tool: the person's yes or no to an open proposal, in their words; a yes writes the flow as the project's own. */
export declare function answerProposal(root: string, args: Record<string, unknown>): LoopResult;
/** The ask tool on a host with no status band: the question into this session's log, for the board until the next prompt. */
export declare function recordAsk(root: string, host: string, session: string, args: Record<string, unknown>, now?: string): LoopResult;
/**
 * The artifact tool: a link, a picture or a file under the work item this is for — the workflow's current one when the
 * project runs a workflow, else this session's work item on the way.
 */
export declare function recordArtifact(root: string, session: string, args: Record<string, unknown>): Promise<LoopResult>;
/** One of the loop's tools, called: its answer, or undefined for a name that is none of them. */
export declare function callLoopTool(root: string, host: string, session: string, name: string, args: Record<string, unknown>, now?: string): Promise<LoopResult | undefined>;
/** What the model is told once, at a session's start, about the loop's tools: with the flows' steps, when there are flows. */
export declare function loopPrompt(flows: readonly CoachFlow[]): string[];
/** The lines beside a prompt: the work items on the way, by id, and the practices of the step this session's item stands at. */
export declare function loopContext(root: string, session: string, flows?: readonly CoachFlow[]): string[];
