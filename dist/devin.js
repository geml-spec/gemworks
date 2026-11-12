// `gemworks devin`: Gemworks's adapter for Devin — Devin Desktop (formerly Windsurf) and the Devin CLI, which share one
// hook system. `gemworks devin install` puts the hooks under `hooks` in Devin's user config
// (`~/.config/devin/config.json`, `%APPDATA%\devin\config.json` on Windows) and the MCP server in
// `mcp_config.json` beside it. Devin runs one command per hook with the event on stdin; its hooks are Claude Code's, so
// the adapter is Qwen Code's with Devin's names, and the decisions are src/hooked.ts's.
//
// What differs: a refusal is exit code 2 with the reason on stderr, the way Devin's docs block a call; before a call
// only `updatedInput` reaches Devin (it merges it into the call's arguments), so a note for the model there is not
// said; a call's result says `success` and no exit status, so a shell command's status comes from the wrapper alone.
// The project is `DEVIN_PROJECT_DIR`, else the event's `cwd`, else the folder the hook runs in. Devin's docs do not
// say where an MCP server starts, so each event leaves the project and session it was in for the MCP server, which
// uses them when its own folder has no `.geml/`. Nothing here stops the agent: whatever fails, there is no output and
// exit 0, and the reason goes to stderr.
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { activeOf as hookedActiveOf, mcpRootOf as hookedMcpRootOf, runHooked } from "./hooked.js";
import { bareTool, callOf, exitCodeOf, failedIn, SHELL, writes } from "./hosts/devin/hook.js";
import { readEvent } from "./hosts/qwen/hook.js";
import { readSettings } from "./cursor.js";
export const DEVIN_HOST = "devin";
const TOOLS = { shell: SHELL, callOf, writes, exitCodeOf, bareTool };
/** The project: `DEVIN_PROJECT_DIR`, else the event's `cwd`, else the folder the hook runs in. */
export function projectOf(env, cwd, here = process.cwd()) {
    const dir = env["DEVIN_PROJECT_DIR"] !== undefined && env["DEVIN_PROJECT_DIR"] !== "" ? env["DEVIN_PROJECT_DIR"] : cwd ?? here;
    return resolve(dir);
}
/** The session the hooks last saw and its project, and what the MCP server works in: src/hooked.ts keeps them. */
export const activeOf = (home = homedir()) => hookedActiveOf(DEVIN_HOST, home);
export const mcpRootOf = (root, home = homedir()) => hookedMcpRootOf(DEVIN_HOST, root, home);
const NOTHING = { stdout: "", stderr: "", code: 0 };
const say = (o) => ({ stdout: `${JSON.stringify(o)}\n`, stderr: "", code: 0 });
const context = (event, text) => say({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
export async function runDevin(text, env, o = {}) {
    const ev = readEvent(text);
    if (ev === undefined)
        return NOTHING;
    const sid = ev.session_id;
    if (sid === undefined)
        return NOTHING;
    const root = projectOf(env, ev.cwd, o.here);
    let event;
    switch (ev.hook_event_name) {
        case "SessionStart":
            event = { kind: "start", ...(ev.source !== undefined ? { source: ev.source } : {}) };
            break;
        case "UserPromptSubmit":
            event = { kind: "prompt", personal: false, ...(ev.prompt !== undefined ? { words: ev.prompt } : {}), ...(ev.prompt_id !== undefined ? { turn: ev.prompt_id } : {}) };
            break;
        case "PreToolUse":
            if (ev.tool_name === undefined)
                return NOTHING;
            event = { kind: "before", tool: ev.tool_name, input: ev.tool_input ?? {} };
            break;
        case "PostToolUse": {
            if (ev.tool_name === undefined)
                return NOTHING;
            // A shell command's status is the wrapper's when it printed one; `success: false` fails any other call.
            const failed = failedIn(ev.tool_response) && !(ev.tool_name === SHELL && exitCodeOf(ev.tool_response) !== null);
            event = { kind: "after", tool: ev.tool_name, input: ev.tool_input ?? {}, failed, response: ev.tool_response };
            break;
        }
        case "Stop":
            event = { kind: "stop", retry: ev.stop_hook_active === true, ...(ev.last_assistant_message !== undefined ? { answer: ev.last_assistant_message } : {}) };
            break;
        default: return NOTHING;
    }
    const answer = await runHooked(DEVIN_HOST, TOOLS, sid, root, event, o);
    if (answer === undefined)
        return NOTHING;
    switch (answer.kind) {
        case "context": return ev.hook_event_name === "Stop" || ev.hook_event_name === "PreToolUse" ? NOTHING : context(ev.hook_event_name, answer.text);
        case "deny": return { stdout: "", stderr: `gemworks: ${answer.reason}\n`, code: 2 };
        case "allow": return answer.input === undefined ? NOTHING : say({ hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput: answer.input } });
        case "continue": return say({ decision: "block", reason: answer.reason });
    }
}
/** The hook events the adapter answers, and how long Devin waits for each, in seconds. */
const EVENTS = { SessionStart: 60, UserPromptSubmit: 30, PreToolUse: 30, PostToolUse: 60, Stop: 30 };
/** Whether a hook is one of this adapter's, from this install or an earlier one wherever the bundle lay. */
const isOurs = (hook) => typeof hook === "object" && hook !== null && typeof hook.command === "string" && /gemworks(\.mjs)?"?\s+devin$/.test(hook.command);
/** The config's hooks with this adapter's put in, every other hook kept; a group left with no hook goes. */
export function hooksWith(config, command) {
    const given = config["hooks"];
    const hooks = typeof given === "object" && given !== null && !Array.isArray(given) ? { ...given } : {};
    for (const [event, timeout] of Object.entries(EVENTS)) {
        const groups = Array.isArray(hooks[event]) ? hooks[event] : [];
        const kept = groups.flatMap((g) => {
            if (typeof g !== "object" || g === null || !Array.isArray(g.hooks))
                return [g];
            const left = (g.hooks).filter((h) => !isOurs(h));
            return left.length === 0 ? [] : [{ ...g, hooks: left }];
        });
        hooks[event] = [...kept, { hooks: [{ type: "command", command, timeout }] }];
    }
    return { ...config, hooks };
}
/** Devin's user config folder: `%APPDATA%\devin` on Windows, `~/.config/devin` elsewhere. */
export function configDir(home = homedir(), env = process.env, platform = process.platform) {
    if (platform === "win32" && env["APPDATA"] !== undefined && env["APPDATA"] !== "")
        return join(env["APPDATA"], "devin");
    return join(home, ".config", "devin");
}
/** `gemworks devin install`: the hooks into Devin's user config and the MCP server into its MCP config, both running `bundle`. Returns the files written. */
export function installDevin(bundle, home = homedir(), env = process.env, platform = process.platform) {
    const dir = configDir(home, env, platform);
    const configFile = join(dir, "config.json");
    const mcpFile = join(dir, "mcp_config.json");
    // Both read before either is written: a file that is no plain JSON leaves both as they were.
    const config = readSettings(configFile);
    const mcp = readSettings(mcpFile);
    const path = bundle.split("\\").join("/");
    const servers = typeof mcp["mcpServers"] === "object" && mcp["mcpServers"] !== null ? mcp["mcpServers"] : {};
    mkdirSync(dir, { recursive: true });
    writeFileSync(configFile, `${JSON.stringify(hooksWith(config, `node "${path}" devin`), null, 2)}\n`, "utf8");
    writeFileSync(mcpFile, `${JSON.stringify({ ...mcp, mcpServers: { ...servers, gemworks: { command: "node", args: [bundle, "mcp", "--host", DEVIN_HOST] } } }, null, 2)}\n`, "utf8");
    return [configFile, mcpFile];
}
