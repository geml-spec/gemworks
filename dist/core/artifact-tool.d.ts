export declare const isImagePath: (path: string) => boolean;
/**
 * Whether a file is one of the work item's artifacts on its own: a document,
 * a picture, sound or video — made for a person, wherever it was written. A
 * script, code or a config the work wrote for itself is not; the model names
 * one that is with the artifact tool.
 */
export declare const isMadeForPeople: (path: string) => boolean;
/** A link a publish tool's result names: `Published … at <url> (Version N …)` for a new page, `Updated the Artifact at <url> (Version N …)` for one published again — the Artifact tool's words. */
export declare function publishedLink(result: string): {
    url: string;
    version?: string;
} | undefined;
/** The tool the model records an artifact with that gemworks does not see made: a link it shared, a picture it generated. */
export declare const ARTIFACT_TOOL: {
    readonly name: "artifact";
    readonly description: "Record something this work item made that gemworks cannot see by itself, so the board lists it under the work item's artifacts: a link (an online document, a published page, a design) or a generated picture or file. Files written with the write tools, commits, and pages published with the Artifact tool are recorded already; do not record those.";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly kind: {
                readonly type: "string";
                readonly enum: readonly ["link", "image", "file"];
                readonly description: "link: an address; image or file: a file on this machine.";
            };
            readonly name: {
                readonly type: "string";
                readonly description: "What it is, in a few words (a link's title).";
            };
            readonly where: {
                readonly type: "string";
                readonly description: "The link's address, or the file's path.";
            };
            readonly version: {
                readonly type: "string";
                readonly description: "The version its publisher gave it, when it gave one.";
            };
        };
        readonly required: readonly ["kind", "where"];
        readonly additionalProperties: false;
    };
};
