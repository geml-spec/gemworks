// GEP 0011: a coordinate addresses a unit INSIDE a block — a table's rows,
// cells and columns, or a node of a `data` block's value tree.
//
// Why this is its own module: every other address in §2 resolves to a unit of
// the document and is answered by slicing the file. A coordinate has no span —
// a cell is a few characters inside a body that a parser had to read to find
// them — so it is answered from the MODEL. Keeping that here leaves cli.ts with
// one shape of answer to print and one shape of refusal to report, and keeps
// this projection testable without a filesystem.
//
// The three token species (§0011: integer, "quoted string", bare word) are the
// selector's business; this module only interprets them against a block.
import { DATA_DEPTH } from "./bounds.js";
import { serializeEdn } from "./edn.js";
import { serialize } from "./serialize.js";
import { iJsonFault, tooDeep } from "./ijson.js";
import { escapeCellPipes, whiteSpaceBounds } from "./table.js";
const miss = (why) => ({ ok: false, why });
/** How a coordinate step reads back, for an error message. */
export function stepText(s) {
    if (s.kind === "index")
        return `[${s.n}]`;
    if (s.kind === "word")
        return `[${s.name}]`;
    return `["${s.name}"]`;
}
export const pathText = (path) => path.map(stepText).join("");
// A block with nothing inside a coordinate could name. An embed is the case
// worth more than a refusal (§5.2): its body is empty and its `src=` resolves
// at render time, so the unit the reader wants is on the source, and the
// diagnostic SHOULD name that address. A whole-document embed (`src=` without
// `#`) has no block for a coordinate to start from, so it gets the bare refusal.
function noUnits(block, path, rebase = (s) => s) {
    const why = `\`${block.type}\` carries no addressable units inside it — a coordinate needs a table, a \`data\` block, \`meta\` (GEP 0011), or a \`form\` (GEP 0008)`;
    const src = block.type === "embed" ? block.attrs["src"] : undefined;
    if (typeof src !== "string" || !src.includes("#"))
        return why;
    return `${why}; address it on the embed's source instead: \`${rebase(src)}${pathText(path)}\``;
}
// The one column namespace (§6): a header name, or the letter that IS the name
// when the table has no header row. `compute=`/`summary=` resolve a column this
// way, and a coordinate must not invent a second rule for the same thing.
function columnIndex(model, name) {
    const byName = model.columns.indexOf(name);
    if (byName >= 0)
        return byName;
    if (/^[A-Z]$/.test(name)) {
        const i = name.charCodeAt(0) - 65;
        if (i < model.columns.length)
            return i;
    }
    return -1;
}
// An attribute value as a string, or undefined. Attributes are
// document-controlled, so `format=1` is a legal thing to write and the answer
// has to be "not a string" rather than a cast — asked once here so the two
// answers are exercised once rather than at three call sites.
const attrStr = (attrs, key) => (typeof attrs[key] === "string" ? attrs[key] : undefined);
const cellJson = (c) => ({ text: c.text, ...(c.value !== undefined ? { value: c.value } : {}) });
// A row printed back as one line, in the body form the block was written in:
// a data body rejoins on its delimiter, a visual grid rebuilds its pipes. This
// is a rendering of the row, not a slice of the file — a borrowed or computed
// row has no line of its own to quote.
function rowText(block, cells) {
    const fmt = attrStr(block.attrs, "format");
    const texts = cells.map((c) => c.text);
    if (fmt === "tsv")
        return texts.join("\t");
    if (fmt === "csv") {
        return texts.join(`${delimOf(block.attrs)} `);
    }
    return `| ${texts.map(escapeCellPipes).join(" | ")} |`;
}
// Why a `data` block has no value tree to address. GEP-0005 makes `format=`
// DECLARED, never sniffed: `json` (the default) and `jsonl` are parsed here,
// `yaml`/`toml` are reserved names, and anything else is unknown — the last two
// keep the body raw with a warning. Answering "no addressable units" for all of
// them would hide which case a reader is in.
function noValueTree(block) {
    const fmt = attrStr(block.attrs, "format") ?? "json";
    if (fmt === "json" || fmt === "jsonl") {
        return `this \`data\` block's body did not parse as \`${fmt}\`, so it has no value tree to address`;
    }
    return `this \`data\` block declares \`format=${fmt}\`, which this processor keeps raw — there is no value tree to address`;
}
const delimOf = (attrs) => {
    const d = attrStr(attrs, "delim");
    return d !== undefined && d.length === 1 ? d : ",";
};
function projectTable(block, model, path) {
    const first = path[0];
    let cells;
    let whatRow = "";
    if (first.kind === "index") {
        // 1-based over BODY rows: a header is not a row (§6's model draws that line
        // too). `[0]` is a typo rather than "the header", and saying so beats
        // answering with a row the author did not mean.
        if (first.n < 1)
            return miss(`a row index starts at 1 (the header is not a row), so \`${stepText(first)}\` addresses nothing`);
        cells = model.rows[first.n - 1];
        if (!cells)
            return miss(`this table has ${model.rows.length} body row${model.rows.length === 1 ? "" : "s"}, so \`${stepText(first)}\` addresses nothing`);
        whatRow = `row ${first.n}`;
    }
    else if (first.kind === "word") {
        if (first.name !== "summary") {
            return miss(`\`${stepText(first)}\` is not a row this table has — \`[summary]\` is the only reserved row name (GEP 0011)`);
        }
        if (!model.summary)
            return miss("this table has no `summary=` foot row, so `[summary]` addresses nothing");
        cells = model.summary;
        whatRow = "the summary row";
    }
    else {
        // A column: every body cell of it, top to bottom.
        if (path.length > 1)
            return miss(`a column takes no further step, so \`${pathText(path)}\` addresses nothing — write \`[<row>]["${first.name}"]\` for one cell`);
        const ci = columnIndex(model, first.name);
        if (ci < 0)
            return miss(`this table has no column \`${first.name}\` (it has ${model.columns.map((c) => `\`${c}\``).join(", ")})`);
        const column = model.rows.map((r) => r[ci]).filter((c) => c !== undefined);
        return { ok: true, text: column.map((c) => c.text).join("\n"), json: column.map(cellJson), shape: "column" };
    }
    if (path.length === 1)
        return { ok: true, text: rowText(block, cells), json: cells.map(cellJson), shape: "row", cells: cells.map((c) => c.text) };
    const second = path[1];
    if (second.kind !== "key")
        return miss(`inside a row, a step names a column: write \`["<column>"]\` rather than \`${stepText(second)}\``);
    if (path.length > 2)
        return miss(`a cell takes no further step, so \`${pathText(path)}\` addresses nothing`);
    const ci = columnIndex(model, second.name);
    if (ci < 0)
        return miss(`this table has no column \`${second.name}\` (it has ${model.columns.map((c) => `\`${c}\``).join(", ")})`);
    const cell = cells[ci];
    if (!cell)
        return miss(`${whatRow} has no cell in column \`${second.name}\``);
    return { ok: true, text: cell.text, json: cellJson(cell), shape: "leaf" };
}
// A value tree walks by KEY into a map and by INDEX into a sequence, which is
// also how the two are told apart: a quoted step is a name, a bare integer a
// position. Sequences are 0-based here and rows are 1-based above — rows are
// lines a reader counts, a sequence is JSON (GEP 0011 records the asymmetry).
function projectValue(value, path) {
    let cur = value;
    const walked = [];
    for (const step of path) {
        walked.push(step);
        const so_far = pathText(walked);
        if (step.kind === "word")
            return miss(`a value tree has no reserved names, so \`${stepText(step)}\` addresses nothing — quote it (\`["${step.name}"]\`) to name a key`);
        if (step.kind === "key") {
            if (cur === null || typeof cur !== "object" || Array.isArray(cur))
                return miss(`\`${so_far}\` names a key, but what it steps into is ${describe(cur)}`);
            if (!Object.prototype.hasOwnProperty.call(cur, step.name)) {
                const above = pathText(walked.slice(0, -1));
                return miss(`no key \`${step.name}\` ${above === "" ? "at the root of this value tree" : `at \`${above}\``}`);
            }
            cur = cur[step.name];
            continue;
        }
        if (!Array.isArray(cur))
            return miss(`\`${so_far}\` names a position, but what it steps into is ${describe(cur)}`);
        if (step.n < 0 || step.n >= cur.length)
            return miss(`\`${so_far}\` is out of range: that sequence has ${cur.length} element${cur.length === 1 ? "" : "s"}`);
        cur = cur[step.n];
    }
    const shape = cur !== null && typeof cur === "object" ? "tree" : "leaf";
    return { ok: true, text: typeof cur === "string" ? cur : JSON.stringify(cur), json: cur, shape };
}
function describe(v) {
    if (v === null)
        return "null";
    if (Array.isArray(v))
        return "a sequence";
    if (typeof v === "object")
        return "a map";
    return `a ${typeof v}`;
}
// What the text a write puts into a value tree stands for: JSON when it parses
// as JSON, a string when it does not — so `1.3.0` stays a string while `42` and
// `{"a":1}` arrive as themselves. JSON the value domain excludes (§3.2) is no
// value at all: a key twice in one map, a lone surrogate, a number past
// binary64's range, a tree past `data-depth`. Taking it anyway rewrote it —
// `1e400` as `null`, a repeated key as its last value — and a tree a few
// thousand levels deep overflowed the serializer. Depth is judged on the text,
// before any tree is built, for the same reason.
// `json` is the content's own JSON text, around which nothing but JSON's
// white space stood — what a write puts in as written.
export function readContent(value) {
    if (tooDeep(value) >= 0)
        return { ok: false, why: `nesting deeper than ${DATA_DEPTH} levels is outside what this processor reads` };
    let parsed;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        return { ok: true, value };
    }
    const fault = iJsonFault(value);
    return fault ? { ok: false, why: `${fault.why}, which the value domain excludes (I-JSON)` } : { ok: true, value: parsed, json: value.replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, "") };
}
const oneLine = (v) => !/[\r\n]/.test(v);
// The field extents of a delimited line, so a cell can be replaced without
// rejoining the whole row (which would eat the author's spacing).
function replaceField(line, sep, ci, value) {
    const parts = line.split(sep);
    if (ci >= parts.length)
        return null;
    // Keep the field's own padding — what the reader trims (§6) — around the value.
    const field = parts[ci];
    const [a, b] = whiteSpaceBounds(field);
    parts[ci] = field.slice(0, a) + value + field.slice(b);
    return parts.join(sep);
}
function writeTable(block, model, path, value, body) {
    const first = path[0];
    if (first.kind === "word") {
        if (first.name === "summary") {
            return { ok: false, why: "the summary row is declared in `summary=`, not written in the body — edit that attribute" };
        }
        return { ok: false, why: `\`${stepText(first)}\` is not a row this table has — \`[summary]\` is the only reserved row name` };
    }
    if (first.kind === "key") {
        return { ok: false, why: `a column is one unit per row and \`set\` writes one — address a cell: \`[<row>]["${first.name}"]\`` };
    }
    // The second write refusal, and it needs no special case: a grid that arrived
    // through `src=` has no lines here to rewrite.
    if (!model.rowLines) {
        return { ok: false, why: "these rows are not in this document — they arrive through `src=`, so edit the source they come from" };
    }
    if (first.n < 1)
        return { ok: false, why: `a row index starts at 1 (the header is not a row), so \`${stepText(first)}\` addresses nothing` };
    const cells = model.rows[first.n - 1];
    const lineIdx = model.rowLines[first.n - 1];
    if (!cells || lineIdx === undefined) {
        return { ok: false, why: `this table has ${model.rows.length} body row${model.rows.length === 1 ? "" : "s"}, so \`${stepText(first)}\` addresses nothing` };
    }
    const line = body[lineIdx];
    if (line === undefined)
        return { ok: false, why: "that row has no line in this body — it was not parsed from one" };
    if (!oneLine(value))
        return { ok: false, why: "a row is one line; the replacement spans several" };
    const out = [...body];
    if (path.length === 1) {
        // A row is data. A line the scanner reads as STRUCTURE — a close fence, an
        // opening fence, a `%%` hidden line — is not a row: written into the body it
        // closes the table early and everything below it is re-read as new blocks.
        // The splice guard now catches that too, but the refusal belongs here, where
        // the address that asked for it can be named.
        if (/^[ \t]*={3,}(?:[ \t]|$)/.test(value) || /^[ \t]*%%/.test(value)) {
            return { ok: false, why: `a row cannot begin with a fence (\`===\`) or a hidden-line marker (\`%%\`) — the body would be re-read as block structure` };
        }
        out[lineIdx] = value;
        return { ok: true, body: out };
    }
    const second = path[1];
    if (second.kind !== "key")
        return { ok: false, why: `inside a row, a step names a column: write \`["<column>"]\` rather than \`${stepText(second)}\`` };
    if (path.length > 2)
        return { ok: false, why: `a cell takes no further step, so \`${pathText(path)}\` addresses nothing` };
    const ci = columnIndex(model, second.name);
    if (ci < 0)
        return { ok: false, why: `this table has no column \`${second.name}\` (it has ${model.columns.map((c) => `\`${c}\``).join(", ")})` };
    // The first write refusal: a computed column is not in the source at all.
    if (cells[ci]?.computed) {
        return { ok: false, why: `column \`${second.name}\` is produced by \`compute=\`, so it has no bytes in the body — edit the formula` };
    }
    const fmt = attrStr(block.attrs, "format");
    if (fmt === "csv" || fmt === "tsv") {
        const d = fmt === "tsv" ? "\t" : delimOf(block.attrs);
        // The third refusal. A data body splits on the delimiter and does nothing
        // more — it does not dequote — so a value carrying one would silently turn
        // one cell into two and shift every cell after it.
        if (value.includes(d)) {
            const shown = d === "\t" ? "a tab" : `\`${d}\``;
            return { ok: false, why: `that value contains ${shown}, the delimiter this body splits on, so writing it would re-split the row — use a visual pipe grid, or \`delim=\` to split on something the data does not contain` };
        }
        const rewritten = replaceField(line, d, ci, value);
        if (rewritten === null)
            return { ok: false, why: `row ${first.n} has ${line.split(d).length} field${line.split(d).length === 1 ? "" : "s"}, so column ${ci + 1} has nothing to write` };
        out[lineIdx] = rewritten;
        return { ok: true, body: out };
    }
    // A visual grid: the row is rebuilt from its cells, which is also what
    // re-pads it. A pipe in any of them goes back as `\|` (§6(a)).
    const texts = cells.map((c) => c.text);
    texts[ci] = value;
    out[lineIdx] = `| ${texts.map(escapeCellPipes).join(" | ")} |`;
    return { ok: true, body: out };
}
// A value-tree edit. New text is read by readContent; the target is found by
// the READ projection, so the two cannot disagree about a wrong turn; and a
// json or jsonl body is edited by splicing its own text — the new value goes
// where the old one stood, or beside its neighbours, and every other byte
// stays: the neighbour a re-serialization would have rounded (an integer past
// 2^53) and the author's layout alike. The caller has already established
// there IS a value tree: a block without one never reaches here.
function editValue(block, path, edit, root, body) {
    let content;
    if (edit.op !== "remove") {
        const read = readContent(edit.value);
        if (!read.ok)
            return { ok: false, why: `data: ${read.why}`, broken: true };
        content = read;
    }
    const parent = projectValue(root, path.slice(0, -1));
    if (!parent.ok)
        return { ok: false, why: parent.why };
    const cur = parent.json;
    const last = path[path.length - 1];
    if (last.kind === "word")
        return { ok: false, why: `a value tree has no reserved names, so \`${stepText(last)}\` addresses nothing` };
    if (last.kind === "key") {
        if (cur === null || typeof cur !== "object" || Array.isArray(cur))
            return { ok: false, why: `\`${pathText(path)}\` names a key, but what it steps into is ${describe(cur)}` };
        if (edit.op === "insert")
            return { ok: false, why: `\`${pathText(path)}\` names a map's member, and a map has no order to insert into — add a member by writing its key with \`set\`` };
        if (edit.op === "remove" && !Object.prototype.hasOwnProperty.call(cur, last.name))
            return { ok: true, body, absent: true };
    }
    else {
        if (!Array.isArray(cur))
            return { ok: false, why: `\`${pathText(path)}\` names a position, but what it steps into is ${describe(cur)}` };
        const len = cur.length;
        const shown = `${len} element${len === 1 ? "" : "s"}`;
        if (edit.op === "remove" && last.n >= len)
            return { ok: true, body, absent: true };
        if (edit.op === "insert" && last.n >= len)
            return { ok: false, why: `\`${pathText(path)}\` is out of range: that sequence has ${shown}, so there is no element to insert beside`, missing: true };
        if (edit.op === "put" && last.n > len)
            return { ok: false, why: `\`${pathText(path)}\` is out of range: that sequence has ${shown} — \`[${len}]\` appends one, and \`set\` writes no further` };
    }
    const fmt = attrStr(block.attrs, "format") ?? "json";
    if (fmt === "edn") {
        // Written back AS EDN, the whole tree: the node changes in the tree, and
        // the tree is re-emitted. Without this arm an edit would have rewritten an
        // EDN body as JSON — silently changing the block's format.
        if (last.kind === "key") {
            const map = cur;
            if (edit.op === "remove")
                delete map[last.name];
            else
                map[last.name] = content.value;
        }
        else {
            const seq = cur;
            if (edit.op === "remove")
                seq.splice(last.n, 1);
            else if (edit.op === "insert")
                seq.splice(edit.before ? last.n : last.n + 1, 0, content.value);
            else
                seq[last.n] = content.value;
        }
        return { ok: true, body: serializeEdn(root) };
    }
    // Any other `format=` leaves the body raw with no value tree at all, so this
    // function is never entered for one — save `yaml`, which HAS a reader. Its
    // authored bytes are its canonical form (`serialize` refuses to rewrite one
    // for the same reason), so an edit would have re-emitted it as JSON.
    if (fmt !== "json" && fmt !== "jsonl") {
        return { ok: false, why: `this processor reads \`${fmt}\` but does not write it, so a coordinate edit here would rewrite the body as JSON — edit the block's body instead` };
    }
    // The new value's text: the content as written when it is JSON, a string
    // literal when it is not.
    const text = content === undefined ? "" : content.json ?? JSON.stringify(edit.value);
    const json = edit.op === "remove" ? edit : { ...edit, value: text };
    if (fmt === "json")
        return { ok: true, body: editJson(body.join("\n"), path, json).split("\n") };
    // One record per line: a record is added or removed as its line, and an edit
    // inside one changes that line only, the new value folded onto it.
    const folded = json.op === "remove" ? json : { ...json, value: json.value.replace(/\s*\n\s*/g, " ") };
    const out = [...body];
    const n = path[0].n;
    if (path.length === 1) {
        if (folded.op === "remove") {
            out.splice(recordLine(body, n), 1);
            return { ok: true, body: out };
        }
        if (folded.op === "insert") {
            const at = recordLine(body, n);
            out.splice(folded.before ? at : at + 1, 0, folded.value);
            return { ok: true, body: out };
        }
        const count = root.length;
        if (n === count) {
            out.splice(count === 0 ? out.length : recordLine(body, count - 1) + 1, 0, folded.value);
            return { ok: true, body: out };
        }
    }
    const at = recordLine(body, n);
    const line = out[at];
    const from = line.length - line.trimStart().length;
    const to = line.trimEnd().length;
    const record = path.length === 1 ? folded.value : editJson(line.slice(from, to), path.slice(1), folded);
    out[at] = line.slice(0, from) + record + line.slice(to);
    return { ok: true, body: out };
}
/** The body line holding a jsonl body's record `n`: its `n`th non-blank line. */
function recordLine(body, n) {
    let seen = -1;
    for (let i = 0; i < body.length; i++) {
        if (body[i].trim() !== "" && ++seen === n)
            return i;
    }
    return -1; // unreachable: the record was found in the tree first
}
function spot(text, i) {
    const ws = (k) => {
        while (k < text.length && (text[k] === " " || text[k] === "\t" || text[k] === "\n" || text[k] === "\r"))
            k++;
        return k;
    };
    const stringEnd = (k) => {
        let j = k + 1;
        while (text[j] !== '"')
            j += text[j] === "\\" ? 2 : 1;
        return j + 1;
    };
    const c = text[i];
    if (c === "{") {
        const members = [];
        let k = ws(i + 1);
        while (text[k] !== "}") {
            const keyEnd = stringEnd(k);
            const value = spot(text, ws(ws(keyEnd) + 1));
            members.push({ key: JSON.parse(text.slice(k, keyEnd)), keyStart: k, keyEnd, value });
            k = ws(value.end);
            if (text[k] === ",")
                k = ws(k + 1);
        }
        return { start: i, end: k + 1, members };
    }
    if (c === "[") {
        const items = [];
        let k = ws(i + 1);
        while (text[k] !== "]") {
            const item = spot(text, k);
            items.push(item);
            k = ws(item.end);
            if (text[k] === ",")
                k = ws(k + 1);
        }
        return { start: i, end: k + 1, items };
    }
    if (c === '"')
        return { start: i, end: stringEnd(i) };
    let k = i;
    while (k < text.length && !" \t\n\r,]}".includes(text[k]))
        k++;
    return { start: i, end: k };
}
/**
 * `text` with one edit at `path`. A new member or element goes after the
 * container's last one, or beside its anchor, separated the way its neighbours
 * are separated from each other — a sole one: on a line of its own when it
 * stands on one, else after `, `. A removed one takes the separator after it
 * (the one before it, when it is the last), and a container left empty is `{}`
 * or `[]`.
 */
function editJson(text, path, edit) {
    let lead = 0;
    while (lead < text.length && " \t\n\r".includes(text[lead]))
        lead++;
    let at = spot(text, lead);
    for (const step of path.slice(0, -1)) {
        at = step.kind === "key" ? at.members.find((m) => m.key === step.name).value : at.items[step.n];
    }
    const last = path[path.length - 1];
    const isMap = at.members !== undefined;
    const entries = isMap ? at.members.map((m) => ({ start: m.keyStart, end: m.value.end })) : at.items.map((s) => ({ start: s.start, end: s.end }));
    const i = last.kind === "index" ? last.n : at.members.findIndex((m) => m.key === last.name);
    const sep = (k) => {
        if (k > 0)
            return text.slice(entries[k - 1].end, entries[k].start);
        if (entries.length > 1)
            return text.slice(entries[0].end, entries[1].start);
        const before = text.slice(at.start + 1, entries[0].start);
        const nl = before.lastIndexOf("\n");
        return nl < 0 ? ", " : "," + before.slice(nl);
    };
    if (edit.op === "remove") {
        if (entries.length === 1)
            return text.slice(0, at.start) + (isMap ? "{}" : "[]") + text.slice(at.end);
        if (i + 1 < entries.length)
            return text.slice(0, entries[i].start) + text.slice(entries[i + 1].start);
        return text.slice(0, entries[i - 1].end) + text.slice(entries[i].end);
    }
    if (edit.op === "insert") {
        const e = entries[i];
        return edit.before ? text.slice(0, e.start) + edit.value + sep(i) + text.slice(e.start) : text.slice(0, e.end) + sep(i) + edit.value + text.slice(e.end);
    }
    if (i >= 0 && i < entries.length) {
        const target = isMap ? at.members[i].value : at.items[i];
        return text.slice(0, target.start) + edit.value + text.slice(target.end);
    }
    // Appended: an element past the last, or a member under a new key.
    const colon = isMap && at.members.length > 0 ? text.slice(at.members.at(-1).keyEnd, at.members.at(-1).value.start) : ": ";
    const entry = isMap ? JSON.stringify(last.name) + colon + edit.value : edit.value;
    if (entries.length === 0)
        return text.slice(0, at.start) + (isMap ? `{${entry}}` : `[${entry}]`) + text.slice(at.end);
    const tail = entries.at(-1);
    return text.slice(0, tail.end) + sep(entries.length - 1) + entry + text.slice(tail.end);
}
export function metaView(children) {
    const blocks = [];
    const walk = (bs) => {
        for (const b of bs) {
            if (b.kind !== "block")
                continue;
            if (b.type === "meta")
                blocks.push(b);
            if (b.children)
                walk(b.children);
        }
    };
    walk(children);
    const value = {};
    const owner = new Map();
    blocks.forEach((b, i) => {
        for (const [k, v] of Object.entries(b.data ?? {})) {
            if (owner.has(k))
                continue; // §4: the first definition is the one in force
            value[k] = v;
            owner.set(k, i);
        }
    });
    return { value, blocks, owner };
}
/** The view as a `meta` body reads: one `key = value` line per key. */
export function metaText(view) {
    return Object.entries(view.value).map(([k, v]) => `${k} = ${metaLiteral(v)}`).join("\n");
}
// A meta value as §4 writes one: a bare number or boolean, anything else
// quoted. Same rule the value-tree write uses for reading a value back in, so
// `1.3.0` stays a string and `42` is a number.
function metaLiteral(v) {
    if (typeof v === "number" || typeof v === "boolean")
        return String(v);
    return JSON.stringify(String(v));
}
/**
 * Plan the write of one meta key into the body of the block that owns it.
 *
 * A key already there keeps its own spelling and spacing — only the value
 * changes. A key defined nowhere is appended, which is how `set` can fill in a
 * document's configuration rather than only overwrite it.
 */
export function planMetaWrite(key, value, body) {
    if (!oneLine(value))
        return { ok: false, why: "a meta value is one line; the replacement spans several" };
    const content = readContent(value);
    if (!content.ok)
        return { ok: false, why: `a meta value is a string, a number or a boolean; this content is JSON with ${content.why}` };
    const parsed = content.value;
    // §4: a meta value is a scalar. A map or a sequence has no meta literal — it
    // was written as `[object Object]`, or a sequence as its items run together.
    if (parsed !== null && typeof parsed === "object") {
        return { ok: false, why: `a meta value is a string, a number or a boolean; this content is a JSON ${Array.isArray(parsed) ? "sequence" : "map"}` };
    }
    const literal = metaLiteral(parsed);
    const out = [...body];
    const at = out.findIndex((l) => new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=`).test(l));
    if (at >= 0) {
        out[at] = out[at].replace(/^(\s*[^=]*=\s*).*$/, (_m, lead) => lead + literal);
        return { ok: true, body: out };
    }
    // Append after the last non-blank line, so a body that ends in a blank line
    // does not grow a gap in the middle of its own keys.
    let end = out.length;
    while (end > 0 && out[end - 1].trim() === "")
        end--;
    out.splice(end, 0, `${key} = ${literal}`);
    return { ok: true, body: out };
}
/**
 * Plan a coordinate write as the block's new body lines.
 *
 * `body` is the block's current body — the lines between its fences — and the
 * plan is the same lines with exactly one unit changed. Every refusal names
 * what is missing rather than what was asked.
 */
export function planCoordWrite(block, path, value, body) {
    if (path.length === 0)
        return { ok: false, why: "a coordinate needs at least one `[…]` step" };
    if (block.kind !== "block")
        return { ok: false, why: `a coordinate writes a unit inside a table or a \`data\` block; \`${block.kind}\` has none` };
    if (block.type === "view")
        return { ok: false, why: "a view has no body rows to write — edit the source relation or this view's attributes" };
    if (block.type === "form" || block.type === "form-group") {
        return { ok: false, why: "a form's field is a block of its own — give it an `{#id}` and edit it with `geml set '#<id>'`; a coordinate writes a unit inside a table or a `data` block" };
    }
    if (block.table)
        return writeTable(block, block.table, path, value, body);
    if (block.value !== undefined)
        return editValue(block, path, { op: "put", value }, block.value, body);
    if (block.type === "meta") {
        // A `meta` block that carries an id of its own is written exactly as the
        // merged `#meta` is: by key, into the body that declares it. Refusing here
        // (as an earlier stage did) made `#m["title"]` and `#meta["title"]` behave
        // differently for what is the same operation on the same bytes.
        if (path.length === 1 && path[0].kind === "key")
            return planMetaWrite(path[0].name, value, body);
        return { ok: false, why: `a meta key is written as \`["<key>"]\` — one quoted key, and nothing deeper` };
    }
    if (block.type === "data")
        return { ok: false, why: noValueTree(block) };
    return { ok: false, why: noUnits(block, path) };
}
/**
 * Plan an insertion beside, or the removal of, the unit a coordinate names, as
 * the block's new body. Only a value tree's sequence takes an insertion; a
 * value tree's member or element, and a `meta` block's key, take a removal.
 */
export function planCoordEdit(block, path, edit, body) {
    if (edit.op === "put")
        return planCoordWrite(block, path, edit.value, body);
    if (path.length === 0)
        return { ok: false, why: "a coordinate needs at least one `[…]` step" };
    const what = edit.op === "insert" ? "an element is inserted into a `data` block's sequence" : "a member or an element is removed from a `data` block's value tree, or a key from a `meta` block";
    if (block.kind !== "block")
        return { ok: false, why: `${what}; \`${block.kind}\` has none` };
    if (block.type === "data" && block.value !== undefined)
        return editValue(block, path, edit, block.value, body);
    if (block.type === "meta" && edit.op === "remove") {
        if (path.length === 1 && path[0].kind === "key")
            return planMetaRemove(path[0].name, body);
        return { ok: false, why: `a meta key is removed as \`["<key>"]\` — one quoted key, and nothing deeper` };
    }
    if (block.type === "data")
        return { ok: false, why: noValueTree(block) };
    return { ok: false, why: `${what}, and this is a \`${block.type}\` block — edit its body instead` };
}
/** The removal of one meta key's line from the body that defines it. */
export function planMetaRemove(key, body) {
    const at = body.findIndex((l) => new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=`).test(l));
    if (at < 0)
        return { ok: true, body, absent: true };
    return { ok: true, body: body.filter((_, i) => i !== at) };
}
/**
 * Project a coordinate onto the block its base resolved to.
 *
 * The block is the one the id names; every refusal here is about what is
 * INSIDE it, so the caller can print `why` without adding context. `rebase` is
 * for a block that came from another document: see `SrcRebase`.
 */
export function projectCoord(block, path, rebase) {
    if (path.length === 0)
        return miss("a coordinate needs at least one `[…]` step");
    if (block.kind !== "block") {
        return miss(`a coordinate addresses a unit inside a table or a \`data\` block; \`${block.kind}\` has none`);
    }
    // A view HAS rows — its model is what the page renders — and GEP-0012 says a
    // coordinate on one "reads and never writes". Refusing the read too would
    // leave a document unable to reference the derived numbers most worth
    // referencing: `[[#busy[1]["Open"]]]` would fail on the very cell the reader
    // is looking at. The write is refused below, in `planCoordWrite`.
    // A view carries an empty model from the scan (like any `src=` block), so an
    // unresolved one has zero COLUMNS — a resolved view always has its source's,
    // even with no rows left. Saying "this table has 0 body rows" there would
    // describe the filter rather than the failure.
    if (block.type === "view" && (block.table === undefined || block.table.columns.length === 0)) {
        return miss("this view's `src=` did not resolve, so it has no rows to address");
    }
    // GEP-0008: a form's fields are its inner units, named by `name=`.
    if (block.type === "form" || block.type === "form-group")
        return projectForm(block, path);
    if (block.table)
        return projectTable(block, block.table, path);
    if (block.value !== undefined)
        return projectValue(block.value, path);
    if (block.data !== undefined)
        return projectValue(block.data, path);
    if (block.type === "data")
        return miss(noValueTree(block));
    return miss(noUnits(block, path, rebase));
}
// --------------------------------------------------------------------------
// Projection targets (§5.2). A coordinate may stand in for content elsewhere
// when it names ONE value, or one ROW of a table or view: a row reads as its
// cells in column order, on one line. A whole column is as many values as the
// table has rows, and a value-tree node that holds more nodes is the same case,
// so neither may be projected — inline or as a block. The parser's check, the
// renderers and the browser viewer all ask these functions, so none of them can
// draw the line somewhere else.
/** Why a column, a non-leaf value-tree node or a form field may not be projected. */
export function notProjectable(shape, written) {
    if (shape === "column") {
        return `\`${written}\` is a whole column — as many values as the table has rows; project one cell (\`[<row>]["<column>"]\`), a whole row (\`[<row>]\`), or select the rows with a \`view\` (\`where=\`, \`select=\`)`;
    }
    if (shape === "field") {
        return `\`${written}\` is a form field — a control, not content; reference it with \`[[…]]\`, which says its label`;
    }
    return `\`${written}\` is a value-tree node with more nodes inside it; project one leaf value under it`;
}
// --------------------------------------------------------------------------
// A form's fields (GEP-0008). A `form` is a flow container whose inner units are
// its `form-field` blocks, each carrying a `name=` unique within the form; a
// `form-group` adds structure, not a namespace, so a field inside a group is
// addressed on the form (`#signup["email"]`) as well as on the group. The
// answer is the field BLOCK — `geml get` prints it as written, `--json` gives
// its attributes — and a reference says the field's label. A field is a
// control, not content, so §5.2 refuses to project it.
function formFields(blocks) {
    const out = [];
    for (const b of blocks) {
        if (b.kind !== "block")
            continue;
        if (b.type === "form-field")
            out.push(b);
        else if (b.type === "form-group" && b.children !== undefined)
            out.push(...formFields(b.children));
    }
    return out;
}
function projectForm(block, path) {
    const step = path[0];
    if (step.kind === "index") {
        return miss(`a ${block.type}'s fields are addressed by \`name=\` — \`["<name>"]\` — not by position`);
    }
    if (block.children === undefined) {
        return miss(`this \`${block.type}\` was not read as a form, so it has no fields to address — is \`geml-form/v1\` declared?`);
    }
    const fields = formFields(block.children);
    const field = fields.find((f) => f.attrs["name"] === step.name);
    if (field === undefined) {
        const names = fields.map((f) => attrStr(f.attrs, "name")).filter((n) => n !== undefined);
        const have = names.length === 0 ? "it has no named field" : `its fields are ${names.map((n) => `\`${n}\``).join(", ")}`;
        return miss(`this \`${block.type}\` has no field named \`${step.name}\`; ${have}`);
    }
    if (path.length > 1) {
        return miss(`a field carries no units inside it — \`${pathText(path.slice(1))}\` addresses nothing under \`${stepText(step)}\``);
    }
    const json = field.id !== undefined ? { id: field.id, ...field.attrs } : { ...field.attrs };
    return { ok: true, shape: "field", text: serialize([field]).trimEnd(), json, shown: attrStr(field.attrs, "label") ?? step.name };
}
/** What an inline projection `![[…]]` of a coordinate shows, or why it may not. */
export function inlineProjection(hit, written) {
    if (hit.shape === "leaf")
        return { ok: true, text: hit.text };
    // One line whatever the cells hold: a newline inside a sentence is the
    // failure this rule exists to prevent.
    if (hit.shape === "row")
        return { ok: true, text: (hit.cells ?? []).map((c) => c.replace(/\s*\n\s*/g, " ")).join(", ") };
    return { ok: false, why: notProjectable(hit.shape, written) };
}
/** A block embed of a row: that row as a one-row table, header and all. */
export function rowTable(block, path) {
    if (block.kind !== "block" || !block.table || path.length !== 1)
        return null;
    const model = block.table;
    const step = path[0];
    const cells = step.kind === "index" ? model.rows[step.n - 1]
        : step.kind === "word" && step.name === "summary" ? model.summary
            : undefined;
    if (!cells)
        return null;
    return { header: model.header, columns: model.columns, align: model.align, rows: [cells] };
}
