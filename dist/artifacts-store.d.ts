import { type ArtifactRow } from "./core/artifacts.js";
/** The table's rows; none when there is no table yet. */
export declare function readArtifactRows(home: string): ArtifactRow[];
/** A row's copy, as an absolute path: under the home's .geml for one in the artifacts directory, else the path it names. */
export declare function copyPath(home: string, where: string): string;
/**
 * The files a work item wrote (project paths under `root`) that git does not
 * keep, one version each whose content changed since the table last had it.
 * Answers the table's rows; nothing changes where git cannot say which it
 * keeps.
 */
export declare function syncWritten(root: string, home: string, item: string, everything: readonly string[]): ArtifactRow[];
/** A document git keeps that the work item changed: its path, its last commit and that commit's time. */
export interface GitDoc {
    path: string;
    sha: string;
    at: string;
}
/** The work item's documents in git, one row each, the ones it had replaced: git keeps their versions. */
export declare function syncDocs(home: string, item: string, docs: readonly GitDoc[]): ArtifactRow[];
/**
 * A link the work item published or shared: a new row when the table has no
 * row of that version under that name — a resumed or forked session's
 * transcript holds the publishes before it again. Without a name it keeps the
 * one it had, else goes by `fallback` (its published file's name), else its
 * address.
 */
export declare function recordLink(home: string, item: string, link: {
    name?: string;
    fallback?: string;
    url: string;
    version?: string;
    at: string;
}): ArtifactRow[];
/**
 * A file the model says the work item made (a picture it generated): a
 * version of it when its content is new, by its project path when it is
 * under `root`, else its own. Answers the row recorded, or undefined.
 */
export declare function recordFile(root: string, home: string, item: string, path: string, kind: "image" | "file"): ArtifactRow | undefined;
/**
 * Bytes the person gave (an upload), copied under their hash and known to the
 * table by `name`; nothing new when this item has these bytes already.
 * Answers the row recorded, or undefined.
 */
export declare function recordBytes(home: string, item: string, given: {
    name: string;
    bytes: Buffer;
    kind: "image" | "file";
    at: string;
}): ArtifactRow | undefined;
/** The directory the copies are in. */
export declare const artifactsDir: (home: string) => string;
/** Whether `path` is `dir` or inside it, separators aside; letter case aside where the file system ignores it. */
export declare function isUnder(path: string, dir: string): boolean;
/**
 * The files named taken out of the table, every version of them under any
 * work item: what turned out not to be for the person (a draft handed to git
 * commit as its message). The copies no row keeps any more move into `trash`,
 * a GEML copy's history with it. Answers how many rows went.
 */
export declare function forgetFiles(root: string, home: string, paths: readonly string[], trash: string): number;
