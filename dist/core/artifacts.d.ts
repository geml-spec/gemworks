export declare const ARTIFACTS_TABLE = "artifacts";
export declare const ARTIFACT_COLUMNS: readonly ["item", "kind", "name", "where", "version", "size", "at", "sha256"];
/** What an artifact is: a link (a published page, a canvas), a document in git, a file git does not keep, a picture. */
export type ArtifactKind = "link" | "doc" | "file" | "image";
export declare const ARTIFACT_KINDS: readonly ArtifactKind[];
/**
 * One version of an artifact. `name`: the link's title, or the file's project
 * path. `where`: the link's address; `git` for a document git keeps; the copy
 * under the home (`artifacts/<sha256>.<ext>`), or the file's own path when it
 * is too big to copy. `version`: a link's version number as its publisher
 * said it (empty when it said none), a git document's last commit, a copied
 * file's version count. `size` in bytes, null when not read.
 */
export interface ArtifactRow {
    item: string;
    kind: ArtifactKind;
    name: string;
    where: string;
    version: string;
    size: number | null;
    at: string;
    sha256: string;
}
/** The biggest file copied; a bigger one is kept by where it is and its hash. */
export declare const COPY_LIMIT: number;
export { isImagePath, isMadeForPeople } from "./artifact-tool.js";
/** The name an upload goes by in the table: `upload/<its file's name>`. */
export declare const UPLOAD_PREFIX = "upload/";
export declare const isDocPath: (path: string) => boolean;
export declare const isGemlPath: (path: string) => boolean;
/** A copy's name in the artifacts directory: the content's hash, then the original's extension. */
export declare function copyName(sha256: string, path: string): string;
/** The rows of a document's `#artifacts` table; none when it has none, or one without its columns. */
export declare function readArtifacts(source: string): ArtifactRow[];
/** The `#artifacts` table block, the rows in the order given. */
export declare function renderArtifacts(rows: readonly ArtifactRow[]): string;
/** `source` with its `#artifacts` table replaced by `rows`; only that block is rewritten. None at all becomes a document of its own. */
export declare function withArtifacts(source: string | null, rows: readonly ArtifactRow[]): string;
/** An artifact: its kind and name, its versions oldest first (its rows). */
export interface Artifact {
    kind: ArtifactKind;
    name: string;
    versions: ArtifactRow[];
}
/** A work item's artifacts from the table's rows, by kind and name; the newest version last within each; the most recently changed first. */
export declare function artifactsOfItem(rows: readonly ArtifactRow[], item: string): Artifact[];
/** A page's `<title>`, from its first 8 KB. */
export declare function pageTitle(html: string): string | undefined;
