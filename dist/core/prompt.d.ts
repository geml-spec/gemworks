import type { Dictionary } from "./dictionary.js";
import { type Snapshot } from "./snapshot.js";
import { type Statechart } from "./statechart.js";
/** The ways out of a state, one per line, for a tool description. */
export declare function describeTransitions(sc: Statechart, stateId: string): string;
/** The per-step snapshot: a few hundred bytes. */
export declare function renderContext(sc: Statechart, snap: Snapshot, dict?: Dictionary): string;
