import { type TSchema } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type Statechart } from "../../core/statechart.js";
import { type ParamSpec, type ToolSpec } from "../../core/tools.js";
import { resolveWorkflow } from "../../workspace.js";
/** Read from the environment at load time; see `readSettings`. */
export interface PiSettings {
    /**
     * The active workflow, resolved at load time as `gemworks` resolves it
     * (`GEMWORKS_STATECHART`, else the workflow the project's `.geml/project.geml`
     * names, else its only workflow, `.geml/workflows/<name>.geml` in the
     * project's home): its file, absolute, or why there is none.
     */
    workflow: ReturnType<typeof resolveWorkflow>;
    /** Where journals go; when absent, next to the session files. */
    journalDir?: string;
}
/** One verb as Pi registers it. Pi has no output schema, so ToolSpec's is dropped. */
export type PiVerb = Pick<ToolSpec, "name" | "description" | "parameters">;
/**
 * A ToolSpec's parameters as TypeBox, which is what Pi registers tools with.
 * The projection is exact: `required` becomes TypeBox's required list, anything
 * else becomes `Type.Optional`, and every keyword the core spec set (`enum`
 * above all) survives into the schema Pi validates against - so the shape is
 * enforced by the host, not merely described to the model.
 */
export declare function toTypeBox(parameters: ParamSpec): TSchema;
/** Every target any state can reach: move's domain on this host. */
export declare function everyTarget(sc: Statechart): string[];
/**
 * The three verbs as Pi registers them: one registration per verb for the whole
 * session, with the widest schema the workflow admits. Narrowing to the state
 * is `Supervisor.invoke`'s job.
 */
export declare function verbSpecs(sc: Statechart): PiVerb[];
/** `cwd` is the directory Pi was started in: the project the workflow is looked for in. */
export declare function readSettings(env: Record<string, string | undefined>, cwd?: string): PiSettings;
/**
 * The extension. Default-exported as Pi's `ExtensionFactory`.
 *
 * The workflow is read HERE, at load time, because the three verbs have to be
 * registered before the first session starts and their schemas come from it.
 * That is also why the workflow is found from the environment and the working
 * directory rather than a CLI flag: flags are not parsed yet at this point. No
 * workflow, no registrations and no tool listeners - the Pi equivalent of DSH's
 * `onMissing: skip`. No workflow at all is just as quiet: most projects an
 * installed extension meets do not use gemworks, and a notice on every session
 * would be noise. Several workflows with none chosen, or one named wrongly, is
 * a setup to fix, and each session says so.
 */
export default function gemworks(pi: ExtensionAPI): void;
