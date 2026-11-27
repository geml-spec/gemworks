// The online documents a tool call wrote: a Lark doc, a Google sheet, a Notion
// page — made or changed through a command-line tool (lark-cli, gws, gog) or an
// MCP tool, and named by an address in what the call answered or was given.
// They are among the work item's artifacts as links, one version a turn.
// Pure, and free of @geml/geml: the hooks module imports it.
const LARK = /(^|\.)(larksuite\.com|feishu\.cn|larkoffice\.com)$/i;
const GOOGLE = /^docs\.google\.com$/i;
/** The online documents gemworks knows, one row a kind: a new site is one more row. */
export const ONLINE_DOC_SITES = [
    // A Lark token is some 27 letters and digits: a shorter one is an address cut short in what a tool printed.
    { host: LARK, path: /^\/(docx|docs|wiki|mindnotes)\/[A-Za-z0-9]{20,}(\/|$)/, word: "飞书文档" },
    { host: LARK, path: /^\/sheets\/[A-Za-z0-9]{20,}(\/|$)/, word: "飞书表格" },
    { host: LARK, path: /^\/base\/[A-Za-z0-9]{20,}(\/|$)/, word: "多维表格" },
    { host: LARK, path: /^\/slides\/[A-Za-z0-9]{20,}(\/|$)/, word: "飞书幻灯片" },
    { host: GOOGLE, path: /^\/document\/d\/[\w-]{10,}/, word: "Google 文档" },
    { host: GOOGLE, path: /^\/spreadsheets\/d\/[\w-]{10,}/, word: "Google 表格" },
    { host: GOOGLE, path: /^\/presentation\/d\/[\w-]{10,}/, word: "Google 幻灯片" },
    { host: /(^|\.)notion\.(so|site)$/i, path: /[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i, word: "Notion 页面" },
    { host: /\.atlassian\.net$/i, path: /^\/wiki\/spaces\/[^/]+\/pages\/\d+/, word: "Confluence 页面" },
    { host: /(\.sharepoint\.com|^onedrive\.live\.com|^1drv\.ms)$/i, path: /^\/./, word: "Office 文档" },
    { host: /^docs\.qq\.com$/i, path: /^\/(doc|sheet|slide|form|smartsheet|mind|flowchart|pdf)\/./, word: "腾讯文档" },
    { host: /(^|\.)yuque\.com$/i, path: /^\/[^/]+\/[^/]+\/./, word: "语雀文档" },
    { host: /^alidocs\.dingtalk\.com$/i, path: /^\/i\/nodes\/./, word: "钉钉文档" },
    { host: /(^|\.)kdocs\.cn$/i, path: /^\/l\/./, word: "金山文档" },
];
/** An online document's address, as one it is listed under: a Google document's at its edit page; the others without the part after `#` (and, but for Office's, after `?`). */
export function onlineDocOf(address) {
    let u;
    try {
        u = new URL(address.trim());
    }
    catch {
        return undefined;
    }
    if (u.protocol !== "https:" && u.protocol !== "http:")
        return undefined;
    const site = ONLINE_DOC_SITES.find((s) => s.host.test(u.hostname) && s.path.test(u.pathname));
    if (site === undefined)
        return undefined;
    if (GOOGLE.test(u.hostname)) {
        const m = /^\/(document|spreadsheets|presentation)\/d\/([\w-]+)/.exec(u.pathname);
        return { url: `https://docs.google.com/${m[1]}/d/${m[2]}/edit`, word: site.word };
    }
    const office = /sharepoint\.com$|onedrive\.live\.com$|^1drv\.ms$/i.test(u.hostname);
    const path = u.pathname.replace(/\/+$/, "");
    return { url: `https://${u.hostname.toLowerCase()}${path}${office ? u.search : ""}`, word: site.word };
}
/** A short name for a document known only by its address: its last part, cut to its ends when long. */
export function onlineDocShort(url) {
    let last = url;
    try {
        last = new URL(url).pathname.split("/").filter((x) => x !== "" && x !== "edit").at(-1) ?? url;
    }
    catch { /* the address itself */ }
    return last.length > 12 ? `${last.slice(0, 4)}…${last.slice(-4)}` : last;
}
// ---- which calls write
/** The words of a command or a tool's name that make it a write, and those that make it one that only reads, or removes. */
const WRITES = new Set(["create", "update", "import", "insert", "append", "write", "edit", "modify", "replace", "batch", "set", "patch", "copy", "move", "upload", "add", "overwrite", "upsert", "put", "save", "publish", "rename", "duplicate", "fill"]);
const READS = new Set(["get", "list", "search", "query", "fetch", "read", "export", "download", "history", "info", "meta", "view", "help", "revision", "changeset", "preview", "delete", "remove", "trash", "count", "find", "describe", "status", "auth", "login", "schema"]);
/** What is written about a document without writing it: a message or mail that links it, a comment on it, who may open it. */
const BESIDE = new Set(["message", "messages", "chat", "im", "mail", "email", "comment", "comments", "reply", "send", "calendar", "event", "events", "task", "tasks", "permission", "permissions", "member", "members", "folder", "share"]);
/** A name's words: split at `-`, `_`, `.`, `+` and where a capital starts a word. */
const wordsOf = (name) => name.split(/[-_.+\s]+|(?<=[a-z0-9])(?=[A-Z])/).map((w) => w.toLowerCase()).filter((w) => w !== "");
const isWrite = (words) => words.some((w) => WRITES.has(w)) && !words.some((w) => READS.has(w) || BESIDE.has(w));
/** The command-line tools that write online documents. */
const DOC_CLIS = ["lark-cli", "gws", "gog"];
const CLI_AT = new RegExp(`(?:^|[\\s;&|(\`$])(${DOC_CLIS.map((c) => c.replace(/-/g, "\\-")).join("|")})((?:[ \\t]+[^\\s;&|)'"\`]+)*)`, "g");
/** Whether a command line runs a document tool to write: its words before the first flag say a write, and it is no help, dry run or schema print. */
export function writesByCommand(command) {
    for (const m of command.matchAll(CLI_AT)) {
        const args = (m[2] ?? "").trim().split(/[ \t]+/);
        if (args.some((a) => /^(--help|-h|--dry-run|--print-schema)$/.test(a)))
            continue;
        const lead = args.slice(0, args.findIndex((a) => a.startsWith("-")) === -1 ? args.length : args.findIndex((a) => a.startsWith("-")));
        if (isWrite(lead.flatMap(wordsOf)))
            return true;
    }
    return false;
}
/** Whether an MCP tool writes, by its own name (the part after the server's): `docx_builtin_import`, `notion-create-pages`, `updateConfluencePage`. */
export function writesByTool(tool) {
    const m = /^mcp__(.+?)__(.+)$/.exec(tool);
    if (m === null || /gemworks/i.test(m[1]))
        return false;
    return isWrite(wordsOf(m[2]));
}
/** The tools that run a command line. */
const RUNS = new Set(["Bash", "PowerShell"]);
/** Whether a call may write an online document: worth keeping until its result says. */
export function mayWriteOnlineDoc(tool, input) {
    const command = input["command"];
    if (RUNS.has(tool))
        return typeof command === "string" && writesByCommand(command);
    return writesByTool(tool);
}
const ADDRESS = /https?:\/\/[^\s"'<>()\\`,;]+/g;
/** Google's API names what it made by id alone. */
const GOOGLE_IDS = [
    [/"documentId"\s*:\s*"([\w-]{20,})"/g, "document"],
    [/"spreadsheetId"\s*:\s*"([\w-]{20,})"/g, "spreadsheets"],
    [/"presentationId"\s*:\s*"([\w-]{20,})"/g, "presentation"],
];
/** At most this many documents a call: a list of them is one that read, not wrote. */
const MOST = 5;
const addressesIn = (text) => {
    const found = [...text.matchAll(ADDRESS)].map((m) => onlineDocOf(m[0].replace(/[.:]+$/, ""))).filter((d) => d !== undefined);
    for (const [re, kind] of GOOGLE_IDS)
        for (const m of text.matchAll(re))
            found.push(onlineDocOf(`https://docs.google.com/${kind}/d/${m[1]}/edit`));
    return found.filter((d, i) => found.findIndex((x) => x.url === d.url) === i);
};
/** What a write named its document: a title or name in its result or what it was given, when it names one. */
const NAME_IN = [/"title"\s*:\s*"([^"\n]{1,120})"/, /--title[ =]+(?:"([^"\n]{1,120})"|'([^'\n]{1,120})')/, /--name[ =]+(?:"([^"\n]{1,120})"|'([^'\n]{1,120})')/];
function nameIn(...texts) {
    for (const text of texts) {
        for (const re of NAME_IN) {
            const m = re.exec(text);
            const name = (m?.[1] ?? m?.[2])?.trim();
            if (name !== undefined && name !== "")
                return name;
        }
    }
    return undefined;
}
/**
 * The online documents a call wrote: none unless it is a write (a document
 * tool's write command, an MCP tool whose name says one) that did not fail;
 * the documents its result names, else the ones it was given; and when it wrote
 * one alone, the title it was given or answered with.
 */
export function onlineDocWrites(tool, input, result) {
    if (!mayWriteOnlineDoc(tool, input))
        return [];
    // A command's tool answers `"ok": false` when it failed and `"dry_run": true` when it only showed the request.
    if (/"dry_run"\s*:\s*true/.test(result))
        return [];
    if (/"ok"\s*:\s*false/.test(result) && !/"ok"\s*:\s*true/.test(result))
        return [];
    const given = typeof input["command"] === "string" ? input["command"] : JSON.stringify(input);
    const answered = addressesIn(result);
    const docs = (answered.length > 0 ? answered : addressesIn(given)).slice(0, MOST + 1);
    if (docs.length > MOST)
        return [];
    const name = docs.length === 1 ? nameIn(given, result) : undefined;
    return docs.map((d) => (name !== undefined ? { ...d, name } : d));
}
