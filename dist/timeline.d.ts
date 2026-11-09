import type { Journal } from "./core/journal.js";
import type { JsonValue } from "./core/schema.js";
import { type Snapshot } from "./core/snapshot.js";
import type { TimelineEntry } from "./hosts/claude-code/protocol.js";
/** The variables a revision changed against the one before it, with their new values. */
export declare function changedVars(prev: Snapshot | undefined, s: Snapshot): Record<string, JsonValue> | undefined;
export declare function timelineOf(j: Journal): TimelineEntry[];
