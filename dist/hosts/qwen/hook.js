import { exitCodeIn } from "../codex/hook.js";
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
/** The event Qwen Code wrote to stdin; undefined when it is not one. */
export function readEvent(text) {
    let v;
    try {
        v = JSON.parse(text);
    }
    catch {
        return undefined;
    }
    if (!isObject(v) || typeof v["hook_event_name"] !== "string")
        return undefined;
    const out = { hook_event_name: v["hook_event_name"] };
    for (const k of ["session_id", "cwd", "prompt_id", "tool_name", "tool_use_id", "error", "prompt", "submitted_prompt", "source", "last_assistant_message"]) {
        if (typeof v[k] === "string")
            out[k] = v[k];
    }
    if (isObject(v["tool_input"]))
        out.tool_input = v["tool_input"];
    if ("tool_response" in v)
        out.tool_response = v["tool_response"];
    if (typeof v["stop_hook_active"] === "boolean")
        out.stop_hook_active = v["stop_hook_active"];
    return out;
}
/** Qwen Code's shell tool. */
export const SHELL = "run_shell_command";
/** Qwen Code's tools that write a file, and the Claude Code tool each is taken as. */
const WRITERS = { write_file: "Write", edit: "Edit", replace: "Edit", notebook_edit: "NotebookEdit" };
export const writesFiles = (tool) => Object.hasOwn(WRITERS, tool);
/** The other built-in tools a dictionary may name by Claude Code's name. */
const READERS = { read_file: "Read", read_many_files: "Read", grep_search: "Grep", glob: "Glob", list_directory: "LS", web_fetch: "WebFetch", web_search: "WebSearch", todo_write: "TodoWrite", task: "Task" };
/** An MCP tool's own name: Qwen Code lists a server's tools as `mcp__<server>__<tool>`, or bare. */
export const bareTool = (tool) => {
    const m = tool.match(/^mcp__.+?__(.+)$/);
    return m !== null ? m[1] : tool;
};
/** Where a Qwen Code tool names its file. */
export function pathOf(input) {
    for (const k of ["file_path", "absolute_path", "notebook_path", "path"])
        if (typeof input[k] === "string" && input[k] !== "")
            return input[k];
    return undefined;
}
/**
 * The call as the gate and the dictionary read it: Claude Code's tool names, a
 * shell call's command line in `command`, a written file's path in `file_path`.
 */
export function callOf(tool, input) {
    if (tool === SHELL)
        return { tool: "Bash", input: { ...input } };
    if (writesFiles(tool)) {
        const path = pathOf(input);
        return { tool: WRITERS[tool], input: { ...input, ...(path !== undefined ? { file_path: path } : {}) } };
    }
    return { tool: READERS[tool] ?? bareTool(tool), input: { ...input } };
}
/**
 * A shell call's exit status from its result, whatever shape Qwen Code gives
 * it: the `[gemworks exit N]` a wrapped command printed last, else the
 * `Exit Code: N` line of the shell tool's own report, else a number its JSON
 * names (`exitCode`, `exit_code`); null when there is none.
 */
export function exitCodeOf(response) {
    const marked = exitCodeIn(response);
    if (marked !== null)
        return marked;
    let last = null;
    const visit = (v) => {
        if (typeof v === "string") {
            for (const m of v.matchAll(/^Exit Code: (\d+)\s*$/gm))
                last = Number(m[1]);
        }
        else if (Array.isArray(v))
            v.forEach(visit);
        else if (isObject(v)) {
            for (const k of ["exitCode", "exit_code"])
                if (typeof v[k] === "number")
                    last = v[k];
            if (last === null)
                Object.values(v).forEach(visit);
        }
    };
    visit(response);
    return last;
}
/** A refusal, read by the model as the tool's error. */
export const denyCall = (reason) => ({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `gemworks: ${reason}` } });
/**
 * The call goes on, rewritten when `updatedInput` is given (Qwen Code replaces the whole input with it), with a note for
 * the model when `context` is; undefined when there is neither. "allow" skips none of Qwen Code's own approvals.
 */
export function allowCall(updatedInput, context) {
    if (updatedInput === undefined && context === undefined)
        return undefined;
    return {
        hookSpecificOutput: {
            hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "gemworks",
            ...(updatedInput !== undefined ? { updatedInput } : {}), ...(context !== undefined ? { additionalContext: context } : {}),
        },
    };
}
export const contextFor = (event, text) => ({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
