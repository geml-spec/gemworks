import { type Practice, type PracticeLayer } from "./core/practices.js";
export declare const PRACTICES_FILE = "practices.geml";
/** The file of each layer for a checkout. */
export declare function practicePaths(root: string, home?: string): Record<PracticeLayer, string>;
/** Every layer's practices, the team's first; whether this project's memory was moved in. */
export declare function readPractices(root: string, home?: string): {
    practices: Practice[];
    memoryMoved: boolean;
};
/** Practices written into their layers (personal or project); `memory` marks the project's memory moved. */
export declare function writePractices(root: string, added: readonly Practice[], memory: boolean, home?: string): void;
/**
 * One practice changed: taken out (kept as a tombstone, so it is not learned again), moved to the other of the
 * person's and the project's layers, or hung on every flow and step (`everywhere`: what it asks was said off its step
 * too). A team practice is changed in the repository, not here. False when there is no such practice it can change.
 */
export declare function changePractice(root: string, id: string, change: {
    deleted?: boolean;
    layer?: "personal" | "project";
    everywhere?: boolean;
}, home?: string): boolean;
/** Practices moved from the person's or the project's layer into the team's (the repository's .gemworks/practices.geml); how many moved. */
export declare function sharePractices(root: string, ids: readonly string[], home?: string): number;
