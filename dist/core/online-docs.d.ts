/** A kind of online document: the sites that serve it (host and path), and its name as the artifacts list shows it. */
export interface OnlineDocSite {
    host: RegExp;
    path: RegExp;
    word: string;
}
/** The online documents gemworks knows, one row a kind: a new site is one more row. */
export declare const ONLINE_DOC_SITES: readonly OnlineDocSite[];
/** An online document's address, as one it is listed under: a Google document's at its edit page; the others without the part after `#` (and, but for Office's, after `?`). */
export declare function onlineDocOf(address: string): {
    url: string;
    word: string;
} | undefined;
/** A short name for a document known only by its address: its last part, cut to its ends when long. */
export declare function onlineDocShort(url: string): string;
/** Whether a command line runs a document tool to write: its words before the first flag say a write, and it is no help, dry run or schema print. */
export declare function writesByCommand(command: string): boolean;
/** Whether an MCP tool writes, by its own name (the part after the server's): `docx_builtin_import`, `notion-create-pages`, `updateConfluencePage`. */
export declare function writesByTool(tool: string): boolean;
/** Whether a call may write an online document: worth keeping until its result says. */
export declare function mayWriteOnlineDoc(tool: string, input: Readonly<Record<string, unknown>>): boolean;
/** An online document a call wrote: its address, its kind's word, its name when the call gave one. */
export interface OnlineDocWrite {
    url: string;
    word: string;
    name?: string;
}
/**
 * The online documents a call wrote: none unless it is a write (a document
 * tool's write command, an MCP tool whose name says one) that did not fail;
 * the documents its result names, else the ones it was given; and when it wrote
 * one alone, the title it was given or answered with.
 */
export declare function onlineDocWrites(tool: string, input: Readonly<Record<string, unknown>>, result: string): OnlineDocWrite[];
