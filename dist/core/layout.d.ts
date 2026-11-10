export declare const GEML_DIR = ".geml";
/** A workflow is one file here, `<name>.geml`: its statechart and its stages' texts. */
export declare const WORKFLOWS_DIR = ".geml/workflows";
/** The earlier layout, still read: a workflow directory holding this file, with its guide and dictionary beside it. */
export declare const FLOW_FILE = "flow.geml";
export declare const JOURNALS_DIR = ".geml/journals";
export declare const CONTEXT_DOC = ".geml/context.geml";
export declare const BACKLOG_DOC = ".geml/backlog.geml";
/** Where the board's exports go (spec §8.2): journals, workflow copies, share texts. */
export declare const EXPORTS_DIR = ".geml/exports";
/** The project document: meta `flow-workflow` names the default workflow. */
export declare const PROJECT_DOC = ".geml/project.geml";
/** What each work item made (core/artifacts.ts): the `#artifacts` table. */
export declare const ARTIFACTS_DOC = ".geml/artifacts.geml";
/** The copies of the files git does not keep, by content hash; a table row's `where` is relative to GEML_DIR. */
export declare const ARTIFACTS_DIR = ".geml/artifacts";
/** The project's tool dictionary: one for all its workflows. */
export declare const TOOLS_DOC = ".geml/tools.geml";
/** Where `geml codemap build` writes this project's code graph. */
export declare const DEFAULT_CODEMAP_DIR = ".geml/codemap";
