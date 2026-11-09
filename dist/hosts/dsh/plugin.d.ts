import type { IncomingMessage, ServerResponse } from "node:http";
import z from "@deepseek-ai/schemastery";
import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import { type CoachData } from "./board.js";
import { type Statechart } from "../../core/statechart.js";
import type { Run } from "../../core/run.js";
import { Supervisor } from "../../core/supervisor.js";
/** Cordis plugin name, used by loader diagnostics. */
export declare const name = "gemworks";
/** Services this plugin calls into. */
export declare const inject: string[];
export interface Config {
    /**
     * A workflow file to use as it is; relative paths resolve against the
     * session's working directory. Left unset, the workflow is resolved as
     * `gemworks` resolves it: `GEMWORKS_STATECHART`, else the workflow the
     * project's `.geml/project.geml` names, else its only workflow
     * (`.geml/workflows/<name>.geml` in the project's home).
     */
    statechart?: string;
    /** Where each session's journal is written, as `<journalDir>/<sessionId>.geml`. */
    journalDir: string;
    /** What to do when the session has no workflow: leave the agent alone, or fail its startup. */
    onMissing?: "skip" | "fail";
}
export declare const Config: z<Config>;
/** A live supervision: the run, where it is being recorded, what the board reads, and how to stop. */
export interface Attached {
    readonly run: Run;
    readonly journalPath: string;
    readonly sup: Supervisor;
    readonly sc: Statechart;
    readonly workflowFile: string;
    readonly workflowDir: string;
    /** The session's working directory. */
    readonly cwd: string;
    /** Resolves once every deferred append (a finished call's evidence) has settled. */
    whenSettled(): Promise<void>;
    dispose(): void;
}
export declare function apply(ctx: Context, config: Config): void;
/**
 * One agent in the project's shared session record (session-store.ts): its
 * prompts as each turn opens, its answer as the turn closes (the text the
 * stream carried), the files its write tools wrote and the commits its
 * commands made, the decisions the model notes with `gemworks_note`; and the
 * other sessions' decisions of the last three days in its context. What fails
 * to be written is missed, never the agent's.
 */
export declare function recordSession(agent: Agent, recorded?: Map<string, string>): void;
/** The words the loop speaks in, as this host names its tools: the gemworks `work` tool is `gemworks_work` here. */
export declare const dshWords: (text: string) => string;
/**
 * A tool's JSON Schema as this host declares parameters (dsh-tools' schema DSL): each property says itself whether it
 * is required, every object whether it is open; a bound on an array's length is left to the tool, which checks it.
 */
export declare function dshParameters(schema: Record<string, unknown>): Record<string, unknown>;
/** What the light flows put on a session's board, read from the project's record now. */
export declare function coachDataOf(cwd: string, id: string): CoachData;
/**
 * The board's routes (spec §8.10). `GET /api/gemworks/board?session=<id>&tab=…&filter=…&expanded=…&lang=…`
 * answers one tab's rows with the tabs and the header; `POST /api/gemworks/act`
 * with `{ session, action }` runs a press (a board action, or a field's typed
 * value as `{ op: "input", field, value }`). A session no workflow supervises
 * is drawn from the project's record (its work items and flows) when it is one
 * the plugin records, else 404; a press the host cannot run is 400 with the
 * reason. Exported for the tests.
 */
export declare function boardApi(sessions: ReadonlyMap<string, Attached>, recorded?: ReadonlyMap<string, string>): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
/**
 * Put one agent under supervision. Exported so tests can drive it directly:
 * the harness testkit publishes an agent without running a turn, and this is
 * the same entry point `agent/created` uses.
 *
 * @returns the live supervision, or null when this agent is left unsupervised
 *   (no workflow, or a journal that does not verify).
 */
export declare function attach(ctx: Context, agent: Agent, source: string, config: Config): Attached | null;
