import { GITIGNORE } from "./project-home.js";
export { GITIGNORE };
/** The workflows this package ships: the directories under its `workflows/`. */
export declare function bundledWorkflows(): string[];
/** Which bundled workflow fits a project that has none yet, and what in the project says so. */
export interface Suggestion {
    workflow: string;
    by: "media" | "deploy" | "code" | "default";
    file?: string;
}
export declare function suggestWorkflow(root: string): Suggestion;
/** The workflows a project has, by name: its home's files, and the earlier layout's directories. */
export declare function projectWorkflows(root: string): string[];
/** The project's config document naming `name` as the active workflow. */
export declare function configText(name: string): string;
/** A workflow written (`target` is its file), or why not: 2 for a name the package does not ship, 1 for a workflow of that name the project has. */
export type Added = {
    ok: true;
    name: string;
    target: string;
    activated: boolean;
} | {
    ok: false;
    code: 1;
    reason: string;
    target: string;
} | {
    ok: false;
    code: 2;
    reason: string;
};
/** Write the bundled workflow `name` into the project's home as one file, add its tools to the project's dictionary, and make it active when asked. */
export declare function addWorkflow(root: string, name: string, o: {
    activate: boolean;
}): Added;
export type Imported = {
    ok: true;
    name: string;
    target: string;
    activated: boolean;
} | {
    ok: false;
    reason: string;
};
/**
 * Write a workflow from a path into the project's home (spec §8.7): a
 * directory holding a `flow.geml` (its guide taken in, its dictionary's rows
 * added to the project's), a `flow.geml` (its directory), or any other
 * `.geml` file (its dictionary's rows bound to the workflow's uses added).
 * The flow must load without errors; a name the project has a workflow of is
 * refused. The first workflow of a project becomes its default.
 */
export declare function importWorkflow(root: string, path: string): Imported;
/** Make an installed workflow the default for new work items. Only a workflow the project has is one: a name is not a path out of .geml/workflows. */
export declare function useWorkflow(root: string, name: string): {
    ok: true;
} | {
    ok: false;
    reason: string;
};
