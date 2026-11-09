import { type Dictionary } from "./dictionary.js";
import type { JsonValue } from "./schema.js";
import { type Snapshot } from "./snapshot.js";
import { type Statechart } from "./statechart.js";
export interface StageContext {
    state: string;
    rev: number;
    text: string;
    included: string[];
    truncated: string[];
}
/** One line per way out: what it needs, and who takes it. */
export declare function nextLines(sc: Statechart, snap: Snapshot): string[];
/** The uses of a state with the tools the dictionary binds to each, for the model. */
export declare function toolLines(sc: Statechart, stateId: string, dict: Dictionary | undefined): string[];
/**
 * The stage text. The description, skills, tools, variables and ways out are
 * never cut; the prompt gets the bytes that remain, and when it does not fit
 * the text says where to read it.
 */
export declare function buildStageContext(sc: Statechart, snap: Snapshot, getPrompt: (ref: string) => string | undefined, dict?: Dictionary): StageContext;
/**
 * `.geml/context.geml` (spec §5.4): `text {#current}` is the stage text, fenced
 * wider than any `=`-run that starts a line of it; `data {#stage}` says which
 * item, state and revision it speaks for; `data {#vars}` is the variables as
 * they stand — a view to read, never a way to write them.
 */
export declare function renderContextDoc(ctx: StageContext, o: {
    at: string;
    item: string;
    vars?: Record<string, JsonValue>;
}): string;
export interface ContextDoc {
    state: string;
    rev: number;
    at: string;
    item: string;
    text: string;
    vars?: Record<string, JsonValue>;
}
export declare function readContextDoc(source: string): ContextDoc | undefined;
