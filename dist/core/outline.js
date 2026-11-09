// The project's outline (project.geml `#items`): every work item the project
// has had, and where it ended up — being worked on, merged, closed or dropped
// — read off git, never typed by a person. A branch item's state comes from
// its branch (there or gone), its commits (in the default branch or not) and
// its pull request; a file item's from its flow's state. The table is what
// gemworks remembers of a branch once git has forgotten it: its last tip and
// how many commits it had say whether a deleted branch was merged or dropped.
// Pure: facts in, rows and text out; the bridge reads git and writes the file.
import { parse, unitSpans } from "@geml/geml";
export const ITEMS_TABLE = "items";
export const OUTLINE_COLUMNS = ["item", "state", "flow", "stage", "worktree", "commits", "pr", "tip", "since", "last"];
export const END_STATES = ["doing", "merged", "closed", "dropped"];
export const prText = (p) => `#${p.number} ${p.state}`;
/** The pull request a row remembers. */
export function prOf(text) {
    const m = /^#(\d+)\s+(open|merged|closed)$/.exec(text.trim());
    return m === null ? undefined : { number: Number(m[1]), state: m[2] };
}
/**
 * Where a branch work item ended up. Merged is a merged pull request, or a
 * branch that had commits of its own and whose tip the default branch now
 * holds; a branch with none of its own is being worked on while it is there,
 * and so is one that went on after its merge. Once the branch is gone it is
 * closed when it was merged, and dropped when it was not, or never had a
 * commit.
 */
export function branchState(prev, b, pr) {
    const committed = (b.ahead ?? 0) > 0 || (prev?.commits ?? 0) > 0;
    if (b.exists) {
        if (pr?.state === "merged")
            return "merged";
        return (b.ahead ?? 0) === 0 && committed && b.inDefault === true ? "merged" : "doing";
    }
    const merged = pr?.state === "merged" || prev?.state === "merged" || prev?.state === "closed";
    return merged || (committed && b.tipInDefault === true) ? "closed" : "dropped";
}
/** Where a file work item stands: its flow's final state closes it, a state named `parked` drops it, anything else is being worked on. */
export function fileState(final, state) {
    return final ? "closed" : state === "parked" ? "dropped" : "doing";
}
/**
 * A branch item's row now: what git says, and what the row remembered where
 * git says nothing — the commits a merged branch had, the tip of one that is
 * gone, its pull request until gh is asked again.
 */
export function branchRow(prev, item, b, pr) {
    const ahead = b.exists ? b.ahead : undefined;
    const commits = ahead !== undefined && ahead > 0 ? ahead : prev?.commits ?? ahead ?? null;
    const known = pr ?? (prev !== undefined ? prOf(prev.pr) : undefined);
    return {
        item: item.id, state: branchState(prev, b, known), flow: item.flow, stage: item.stage,
        worktree: b.exists ? b.worktree ?? "" : "", commits, pr: known !== undefined ? prText(known) : "",
        tip: (b.exists ? b.tip : undefined) ?? prev?.tip ?? "", since: item.since, last: item.last,
    };
}
/** A file item's row now. */
export function fileRow(item, final, state) {
    return { item: item.id, state: fileState(final, state), flow: item.flow, stage: item.stage, worktree: "", commits: null, pr: "", tip: "", since: item.since, last: item.last };
}
/** The rows of a document's `#items` table; none when it has no such table, or one without the outline's columns. */
export function readOutline(source) {
    const tb = parse(source).children.find((b) => b.kind === "block" && b.type === "table" && b.id === ITEMS_TABLE);
    const table = tb?.table;
    if (table === undefined || !table.header)
        return [];
    const cols = table.columns.map((c) => c.trim().toLowerCase());
    if (!cols.includes("item") || !cols.includes("state"))
        return [];
    const cell = (row, name) => {
        const c = row[cols.indexOf(name)];
        if (!c)
            return "";
        const only = c.inlines.length === 1 ? c.inlines[0] : undefined;
        return (only?.type === "code" ? only.value : c.text).trim();
    };
    return table.rows.flatMap((row) => {
        const item = cell(row, "item");
        const state = cell(row, "state");
        if (item === "" || !END_STATES.includes(state))
            return [];
        const n = cell(row, "commits");
        return [{
                item, state, flow: cell(row, "flow"), stage: cell(row, "stage"), worktree: cell(row, "worktree"),
                commits: /^\d+$/.test(n) ? Number(n) : null, pr: cell(row, "pr"), tip: cell(row, "tip"), since: cell(row, "since"), last: cell(row, "last"),
            }];
    });
}
/** A cell's text: a value that holds the table's own `|` goes in code. */
const cellText = (s) => (s.includes("|") ? `\`${s}\`` : s);
/** The `#items` table block, the rows in the order given. */
export function renderOutline(rows) {
    const lines = rows.map((r) => [r.item, r.state, r.flow, r.stage, r.worktree, r.commits === null ? "" : String(r.commits), r.pr, r.tip, r.since, r.last].map(cellText));
    const widths = OUTLINE_COLUMNS.map((c, i) => Math.max(c.length, ...lines.map((l) => l[i].length)));
    const fmt = (cells) => `| ${cells.map((c, i) => c.padEnd(widths[i])).join(" | ")} |`;
    return [`=== table {#${ITEMS_TABLE}}`, fmt(OUTLINE_COLUMNS), `|${widths.map((w) => "-".repeat(w + 2)).join("|")}|`, ...lines.map(fmt), "==="].join("\n");
}
/** `source` with its `#items` table replaced by `rows`; only that block is rewritten. A document without it gets it appended; none at all becomes one. */
export function withOutline(source, rows) {
    const table = renderOutline(rows);
    if (source === null)
        return ["=== meta", 'title = "Gemworks"', "===", "", table, ""].join("\n");
    const src = source.replace(/\r\n?/g, "\n");
    const unit = unitSpans(src).find((u) => u.kind === "block" && u.id === ITEMS_TABLE);
    if (unit === undefined)
        return `${src.replace(/\n*$/, "\n\n")}${table}\n`;
    const lines = src.split("\n");
    // A span ends on the line after its closing fence.
    return [...lines.slice(0, unit.span.start), ...table.split("\n"), ...lines.slice(unit.span.end)].join("\n");
}
/** The outline's order: the latest activity first. */
export const byLast = (a, b) => b.last.localeCompare(a.last) || a.item.localeCompare(b.item);
