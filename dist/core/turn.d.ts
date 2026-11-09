import type { NextStep } from "./status.js";
/** What deciding whose turn it is reads of a way out. */
export type WayOut = Pick<NextStep, "approval" | "holds" | "judge" | "reads" | "toStart">;
/**
 * Whether the work item waits on a person (the board's 待处理, the band's one
 * thing): some way on — a way out that does not go back to the start — is
 * theirs to take (an approval whose condition holds, or one whose condition
 * reads only what a person ticks), and nobody else has one (the model's
 * judgement, or evidence the machine reads). A way back to the start alone,
 * reopening what was put aside, is no waiting.
 */
export declare function waitsOnPerson(next: readonly WayOut[], sources: Readonly<Record<string, string>>): boolean;
