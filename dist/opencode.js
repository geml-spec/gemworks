// `gemworks opencode`: Gemworks's adapter for OpenCode (2.x). OpenCode loads plugins in its own process, so
// `gemworks opencode install` puts a small plugin in OpenCode's global plugins folder; the plugin registers the
// gemworks MCP server and, on each hook, runs `gemworks opencode` with one event on stdin — `{ session, root, event }`,
// the event already in no host's shape (src/hooked.ts) — and reads the answer from stdout.
//
// The plugin's hooks: a session's first prompt starts it (OpenCode has no session-start hook), and each prompt is one
// turn (OpenCode runs the prompt hook for the person's prompts only); what the model should read goes into the system
// part of every model request of the turn, through the `context` hook. Before a call, a refusal is the hook's rejection,
// which OpenCode hands the model as the tool's error, and a rewritten input replaces the call's. After a call, what the
// model should read is appended to the result. When the session would go idle, the work reminder is a synthetic
// message, which keeps the session going. Nothing here stops the agent: whatever fails, the answer is empty and the
// plugin lets the call through.
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { runHooked } from "./hooked.js";
import { bareTool, callOf, exitCodeOf, SHELL, writes } from "./hosts/opencode/hook.js";
export const OPENCODE_HOST = "opencode";
const TOOLS = { shell: SHELL, callOf, writes, exitCodeOf, bareTool };
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
/** The plugin's request; undefined when it is not one. */
export function readRequest(text) {
    let v;
    try {
        v = JSON.parse(text);
    }
    catch {
        return undefined;
    }
    if (!isObject(v) || typeof v["session"] !== "string" || typeof v["root"] !== "string" || !isObject(v["event"]))
        return undefined;
    const e = v["event"];
    const str = (k) => (typeof e[k] === "string" ? { [k]: e[k] } : {});
    const input = isObject(e["input"]) ? e["input"] : {};
    let event;
    switch (e["kind"]) {
        case "start":
            event = { kind: "start", ...str("source") };
            break;
        case "prompt":
            event = { kind: "prompt", personal: true, ...str("words") };
            break;
        case "before":
            if (typeof e["tool"] !== "string")
                return undefined;
            event = { kind: "before", tool: e["tool"], input, ...str("callId") };
            break;
        case "after":
            if (typeof e["tool"] !== "string")
                return undefined;
            event = { kind: "after", tool: e["tool"], input, failed: e["failed"] === true, response: e["response"], ...str("callId") };
            break;
        case "stop":
            event = { kind: "stop", retry: false, ...(typeof e["answer"] === "string" ? { answer: e["answer"] } : {}) };
            break;
        default: return undefined;
    }
    return { session: v["session"], root: resolve(v["root"]), event };
}
/** One request from the plugin; its answer as one JSON line, or nothing. */
export async function runOpencode(text, o = {}) {
    const req = readRequest(text);
    if (req === undefined)
        return { stdout: "" };
    const answer = await runHooked(OPENCODE_HOST, TOOLS, req.session, req.root, req.event, o);
    return { stdout: answer === undefined ? "" : `${JSON.stringify(answer)}\n` };
}
/** OpenCode's global plugins folder: `$XDG_CONFIG_HOME/opencode/plugins`, else `~/.config/opencode/plugins`. */
export function pluginsDir(env = process.env, home = homedir()) {
    const config = env["XDG_CONFIG_HOME"] !== undefined && env["XDG_CONFIG_HOME"] !== "" ? env["XDG_CONFIG_HOME"] : join(home, ".config");
    return join(config, "opencode", "plugins");
}
/** The plugin OpenCode loads, running `node` (this Node, by its full path: OpenCode's own PATH may not have one) on `bundle`. */
export function pluginSource(node, bundle) {
    return `// Gemworks for OpenCode, written by \`gemworks opencode install\`: each hook asks \`gemworks opencode\` (one event on
// stdin, the answer on stdout) and does what it says. Install again to update it; delete this folder to remove it.
import { spawn } from "node:child_process";

const NODE = ${JSON.stringify(node)};
const BUNDLE = ${JSON.stringify(bundle)};
const WAIT = 30000;

/** The answer to one event; undefined when there is none or anything failed. */
function ask(root, session, event) {
  return new Promise((done) => {
    let out = "";
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; done(v); } };
    let child;
    try { child = spawn(NODE, [BUNDLE, "opencode"], { cwd: root, stdio: ["pipe", "pipe", "ignore"], windowsHide: true }); } catch { finish(undefined); return; }
    const timer = setTimeout(() => { try { child.kill(); } catch {} finish(undefined); }, WAIT);
    child.stdout.on("data", (d) => { out += d; });
    child.on("error", () => { clearTimeout(timer); finish(undefined); });
    child.on("close", () => { clearTimeout(timer); try { finish(out.trim() === "" ? undefined : JSON.parse(out)); } catch { finish(undefined); } });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify({ session, root, event }));
  });
}

export default {
  id: "gemworks",
  async setup(ctx) {
    const root = ctx.location.directory;
    /** Per session: what the model reads on every request (\`standing\`, from the session's start) and this turn (\`turn\`). */
    const sessions = new Map();
    const of = (id) => { let s = sessions.get(id); if (s === undefined) { s = { started: false, standing: "", turn: "" }; sessions.set(id, s); } return s; };
    /** Per call: a note \`before\` had for the model, given back with the result. */
    const notes = new Map();
    const text = (a) => (a !== undefined && a !== null && typeof a.text === "string" ? a.text : "");

    try {
      await ctx.mcp.transform((editor) => {
        editor.set("gemworks", { type: "local", command: [NODE, BUNDLE, "mcp", "--host", "opencode"], cwd: root });
      });
    } catch {}

    await ctx.session.hook("prompt", async (event) => {
      try {
        const s = of(event.sessionID);
        if (!s.started) {
          s.started = true;
          s.standing = text(await ask(root, event.sessionID, { kind: "start", source: "startup" }));
        }
        s.turn = text(await ask(root, event.sessionID, { kind: "prompt", words: event.prompt?.text ?? "" }));
      } catch {}
    });

    await ctx.session.hook("context", (event) => {
      try {
        const s = sessions.get(event.sessionID);
        if (s === undefined) return;
        for (const t of [s.standing, s.turn]) if (t !== "") event.system.push({ type: "text", text: t });
      } catch {}
    });

    await ctx.tool.hook("execute.before", async (event) => {
      let answer;
      try { answer = await ask(root, event.sessionID, { kind: "before", tool: event.tool, callId: event.id, input: event.input ?? {} }); } catch { return; }
      if (answer === undefined || answer === null) return;
      // The one rejection on purpose: OpenCode hands the model the reason as the tool's error.
      if (answer.kind === "deny") throw new Error("gemworks: " + answer.reason);
      if (answer.kind === "allow") {
        if (answer.input !== undefined) event.input = answer.input;
        if (typeof answer.context === "string") notes.set(event.id, answer.context);
      }
    });

    await ctx.tool.hook("execute.after", async (event) => {
      try {
        const note = notes.get(event.id);
        notes.delete(event.id);
        const failed = event.status !== "completed";
        const answer = await ask(root, event.sessionID, { kind: "after", tool: event.tool, callId: event.id, input: event.input ?? {}, failed, ...(failed ? {} : { response: event.result }) });
        const said = [note, text(answer)].filter((t) => typeof t === "string" && t !== "").join("\\n");
        if (said === "") return;
        if (!failed && Array.isArray(event.result.content)) event.result = { ...event.result, content: [...event.result.content, { type: "text", text: said }] };
        else { const s = of(event.sessionID); s.turn = s.turn === "" ? said : s.turn + "\\n\\n" + said; }
      } catch {}
    });

    await ctx.session.hook("experimental.idle", async (event) => {
      try {
        const answer = await ask(root, event.sessionID, { kind: "stop" });
        if (answer !== undefined && answer !== null && answer.kind === "continue") await ctx.session.synthetic({ sessionID: event.sessionID, text: answer.reason });
      } catch {}
    });
  },
};
`;
}
/** `gemworks opencode install`: the plugin into OpenCode's global plugins folder, running `bundle`. Returns the files written. */
export function installOpencode(bundle, node = process.execPath, env = process.env, home = homedir()) {
    const dir = join(pluginsDir(env, home), "gemworks");
    mkdirSync(dir, { recursive: true });
    const pkg = join(dir, "package.json");
    const index = join(dir, "index.js");
    writeFileSync(pkg, `${JSON.stringify({ name: "gemworks-opencode", private: true, type: "module", exports: { ".": "./index.js" } }, null, 2)}\n`, "utf8");
    writeFileSync(index, pluginSource(node, bundle), "utf8");
    return [index, pkg];
}
