// Outward actions: the calls that reach beyond this machine — a push, a pull request or a release, a package published,
// an image pushed, a deployment, a request that sends data, a remote login or copy, an MCP tool that writes somewhere
// else. Gemworks asks the person once before one runs, unless the project's dictionary lets it through in every state
// (a row with `allow *`); 以后都放行 writes that row. Which calls these are is read from the words of a command line
// (command-line.ts commandsRun) and from an MCP tool's name; what the reading cannot place is not outward, and is
// never held. Pure.
import { commandsRun } from "./command-line.js";
import { keyMatches } from "./dictionary.js";

/** What kind of outward action a call is, in the words the question says it (translated where it is shown). */
export type OutwardKind = "推到远端" | "GitHub 写操作" | "发包" | "推镜像" | "部署" | "往外发数据" | "远程登录" | "传到远端" | "MCP 写操作";

/**
 * An outward action a call makes: the dictionary key 以后都放行 writes (`key`), the keys a row written by hand may
 * match as well (`keys`, the first the action's own), and what kind it is.
 */
export interface Outward { key: string; keys: string[]; what: OutwardKind }

/** The words a launcher puts before the command it runs: skipped to find that command. */
const LAUNCHERS: ReadonlySet<string> = new Set([
  "rtk", "sudo", "doas", "env", "nohup", "nice", "ionice", "time", "timeout", "gtimeout", "command", "builtin", "exec",
  "stdbuf", "setsid", "caffeinate", "chronic", "npx", "bunx", "pnpx", "uvx", "xargs",
]);

/** The programs an outward command starts with. */
const PROGRAMS: ReadonlySet<string> = new Set([
  "git", "gh", "npm", "pnpm", "yarn", "docker", "podman", "curl", "wget", "vercel", "netlify", "wrangler", "firebase",
  "fly", "flyctl", "terraform", "kubectl", "helm", "ssh", "scp", "rsync", "sftp",
]);

/** A program's name: the last part of its path, without `.exe` or `.cmd`, in lower case. */
const programName = (word: string): string => word.slice(Math.max(word.lastIndexOf("/"), word.lastIndexOf("\\")) + 1).replace(/\.(?:exe|cmd)$/i, "").toLowerCase();

/** A command's words with what a launcher put before it skipped: from the first word after it that names an outward program. */
function launched(argv: readonly string[]): string[] {
  const first = argv[0];
  if (first === undefined) return [];
  if (!LAUNCHERS.has(programName(first))) return [...argv];
  const at = argv.findIndex((w, i) => i > 0 && PROGRAMS.has(programName(w)));
  return at < 0 ? [] : argv.slice(at);
}

/** git's subcommand: past its global options, and the values `-C`, `-c` and the like take. */
function gitSub(args: readonly string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (a === "-C" || a === "-c" || a === "--git-dir" || a === "--work-tree" || a === "--namespace" || a === "--exec-path") { i++; continue; }
    if (!a.startsWith("-")) return a;
  }
  return undefined;
}

/** The gh subcommands that change something on GitHub, by command group. */
const GH_WRITES: Readonly<Record<string, readonly string[]>> = {
  pr: ["create", "merge", "close", "comment", "review", "edit", "ready", "reopen"],
  issue: ["create", "close", "comment", "edit", "reopen", "delete", "transfer", "lock", "unlock", "pin", "unpin"],
  release: ["create", "upload", "delete", "edit"],
  repo: ["create", "delete", "edit", "rename", "archive", "fork", "sync"],
  workflow: ["run", "enable", "disable"],
  run: ["rerun", "cancel", "delete"],
  secret: ["set", "delete", "remove"],
  variable: ["set", "delete", "remove"],
  gist: ["create", "edit", "delete"],
  label: ["create", "edit", "delete", "clone"],
};

const WRITE_METHOD = /^(?:POST|PUT|PATCH|DELETE)$/i;
/** A remote path for scp, sftp and rsync (`host:path`, `user@host:path`), not a Windows drive (`C:\…`, and `C:a` once the shell has taken the backslash). */
const REMOTE = /^[^-\s/\\:][^\s/\\:]*:/;
const DRIVE = /^[A-Za-z]:/;

/** One command, a launcher's words skipped, as an outward action: the words it is learned by and what kind it is; undefined when it is none. */
export function outwardCommand(argv: readonly string[]): { pattern: string; what: OutwardKind } | undefined {
  const words = launched(argv);
  const program = words[0] === undefined ? "" : programName(words[0]);
  const args = words.slice(1);
  const [a, b] = args;
  const any = (re: RegExp): boolean => args.some((x) => re.test(x));
  const valued = (flags: readonly string[], value: RegExp): boolean =>
    args.some((x, i) => (flags.includes(x) && value.test(args[i + 1] ?? "")) || flags.some((f) => f.startsWith("--") && x.startsWith(`${f}=`) && value.test(x.slice(f.length + 1))));
  switch (program) {
    case "git": return gitSub(args) === "push" ? { pattern: "git push", what: "推到远端" } : undefined;
    case "gh":
      if (a === "api") return valued(["-X", "--method"], WRITE_METHOD) || any(/^(?:-[fF]|--field|--raw-field|--input)(?:=|$)/) ? { pattern: "gh api", what: "GitHub 写操作" } : undefined;
      return a !== undefined && b !== undefined && GH_WRITES[a]?.includes(b) === true ? { pattern: `gh ${a} ${b}`, what: "GitHub 写操作" } : undefined;
    case "npm": case "pnpm": case "yarn": {
      const berry = program === "yarn" && a === "npm";
      const sub = berry ? b : a;
      if (sub === "publish" || sub === "unpublish" || sub === "deprecate") return { pattern: `${program}${berry ? " npm" : ""} ${sub}`, what: "发包" };
      if (program === "npm" && a === "dist-tag" && (b === "add" || b === "rm")) return { pattern: `npm dist-tag ${b}`, what: "发包" };
      return undefined;
    }
    case "docker": case "podman":
      return a === "push" ? { pattern: `${program} push`, what: "推镜像" } : a === "image" && b === "push" ? { pattern: `${program} image push`, what: "推镜像" } : undefined;
    case "curl":
      return valued(["-X", "--request"], WRITE_METHOD) || any(/^(?:-[dFT]|--data\S*|--form\S*|--upload-file|--json)(?:=|$)/) || any(/^-[dFT]\S/) ? { pattern: "curl", what: "往外发数据" } : undefined;
    case "wget":
      return any(/^--(?:post|body)-(?:data|file)(?:=|$)/) || valued(["--method"], WRITE_METHOD) ? { pattern: "wget", what: "往外发数据" } : undefined;
    case "vercel":
      return args.length === 0 || a === "deploy" || a === "promote" || any(/^--prod$/) ? { pattern: "vercel", what: "部署" } : undefined;
    case "netlify": case "wrangler": case "firebase": case "fly": case "flyctl": {
      const sub = args.find((x) => x === "deploy" || x === "publish");
      return sub !== undefined ? { pattern: `${program} ${sub}`, what: "部署" } : undefined;
    }
    case "terraform": return a === "apply" || a === "destroy" ? { pattern: `terraform ${a}`, what: "部署" } : undefined;
    case "kubectl":
      return a !== undefined && ["apply", "delete", "create", "replace", "patch", "edit", "scale", "rollout", "set", "label", "annotate"].includes(a) ? { pattern: `kubectl ${a}`, what: "部署" } : undefined;
    case "helm": return a !== undefined && ["install", "upgrade", "uninstall", "rollback", "delete"].includes(a) ? { pattern: `helm ${a}`, what: "部署" } : undefined;
    case "ssh": return args.some((x) => !x.startsWith("-")) ? { pattern: "ssh", what: "远程登录" } : undefined;
    case "scp": case "sftp": case "rsync": return args.some((x) => REMOTE.test(x) && !DRIVE.test(x)) ? { pattern: program, what: "传到远端" } : undefined;
    default: return undefined;
  }
}

/** The MCP servers whose tools act on this machine, this session or the person's own screen: never asked about. */
const LOCAL_SERVERS = /^mcp__(?:gemworks|ccd_[^_]+|Claude_Browser|claude-in-chrome|visualize|terminal|code-review-graph|plugin_geml_geml|pdf-viewer|plugin_pdf-viewer_pdf|plugin_desktop-commander_desktop-commander|photocraft|scheduled-tasks|plugin_dak_dak-notebook|PowerPoint)__/;

/** The words in an MCP tool's name that say it changes something where it acts. */
const MCP_WRITES: ReadonlySet<string> = new Set([
  "send", "post", "publish", "create", "add", "update", "edit", "set", "delete", "remove", "drop", "merge", "comment",
  "reply", "share", "upload", "deploy", "transfer", "pay", "put", "write", "submit", "approve", "grant", "revoke",
  "start", "stop", "abolish", "rerun", "trigger", "execute", "invite", "move", "rename", "overwrite", "insert",
  "archive", "cancel", "say", "import", "copy", "transition",
]);

/** An MCP tool's name split into its words: at `_`, `-` and a lower case letter's capital (`CreateNode` → create, node). */
const nameWords = (name: string): string[] => name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().split(/[_\-]+/).filter((w) => w !== "");

/** Whether an MCP tool writes somewhere beyond this machine: a server not kept local, and a name with a word that changes something. */
export function mcpOutward(tool: string): boolean {
  if (!tool.startsWith("mcp__") || LOCAL_SERVERS.test(tool)) return false;
  const name = tool.split("__").slice(2).join("_");
  return nameWords(name).some((w) => MCP_WRITES.has(w));
}

/**
 * The outward actions a call makes, one each: an MCP tool that writes, or the outward commands of a shell tool's
 * command line (`shells`: the tools whose `command` is one), learned by their words (`Bash(git push*)`).
 */
export function outwardOf(tool: string, input: Readonly<Record<string, unknown>> | undefined, shells: readonly string[]): Outward[] {
  if (mcpOutward(tool)) return [{ key: tool, keys: [tool], what: "MCP 写操作" }];
  const command = typeof input?.["command"] === "string" ? (input["command"] as string) : undefined;
  if (command === undefined || !shells.includes(tool)) return [];
  const out: Outward[] = [];
  for (const argv of commandsRun(command)) {
    const o = outwardCommand(argv);
    if (o === undefined) continue;
    const key = `Bash(${o.pattern}*)`;
    if (!out.some((x) => x.key === key)) out.push({ key, keys: [`Bash(${o.pattern})`, `Bash(${launched(argv).join(" ")})`], what: o.what });
  }
  return out;
}

/** Whether a row's key (`allowed`: the dictionary's keys allowed in every state) lets an outward action through. */
export function allowedOutward(allowed: readonly string[], o: Outward): boolean {
  return allowed.some((pattern) => o.keys.some((k) => keyMatches(pattern, k)));
}

/** Whether a dictionary key is one 以后都放行 writes, or a hand-written one for an outward action: what the tools tab lists as let through. */
export function isOutwardKey(key: string): boolean {
  if (mcpOutward(key)) return true;
  const run = /^Bash\((.*)\)$/s.exec(key);
  if (run === null) return false;
  const words = (run[1] as string).replace(/\*+$/, "").trim().split(/\s+/);
  return outwardCommand(words) !== undefined;
}

/** The answers, as the question offers them (translated where they are shown). */
export const ALLOW_ONCE = "这次放行";
export const ALLOW_ALWAYS = "以后都放行";
export const HOLD = "不放行";

/** The translation of the words a question uses: the host's own. */
export type Words = (key: string, ...args: readonly (string | number)[]) => string;

/** The question put to the person before a call with outward actions runs: what they are, the call as it stands, and the three answers. */
export function outwardQuestion(found: readonly Outward[], shown: string, t: Words): { question: string; options: string[]; header: string } {
  const kinds = [...new Set(found.map((o) => o.what))].map((k) => t(k)).join(t("、"));
  const call = shown.replace(/\s+/g, " ").trim();
  return { question: t("gemworks：{0}：{1}，放行吗？", kinds, [...call].length > 80 ? `${[...call].slice(0, 80).join("")}…` : call), options: [t(ALLOW_ONCE), t(ALLOW_ALWAYS), t(HOLD)], header: t("对外动作") };
}

/** What an answer does: lets the call through, lets it through and writes its keys into the dictionary, or holds it. */
export type OutwardAnswer = { kind: "pass" } | { kind: "allow"; keys: string[] } | { kind: "hold"; reason: string };

/** An answer read: only 这次放行 and 以后都放行, as the question words them, let the call through; anything else holds it — 不放行, a question put away, words typed instead. */
export function outwardAnswer(answer: string | undefined, found: readonly Outward[], t: Words): OutwardAnswer {
  if (answer === t(ALLOW_ONCE)) return { kind: "pass" };
  if (answer === t(ALLOW_ALWAYS)) return { kind: "allow", keys: found.map((o) => o.key) };
  return { kind: "hold", reason: `the person did not let this outward action through (${found.map((o) => o.key).join(", ")}): ask them in the conversation before trying again` };
}
