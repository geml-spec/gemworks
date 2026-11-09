import { DATA_DEPTH } from "./bounds.js";
/** The wrapper keys this reading reserves. A string key may not begin with `$`. */
const WRAP_SET = "$set";
const WRAP_UUID = "$uuid";
const WRAP_INST = "$inst";
const isSpace = (c) => c === " " || c === "\t" || c === "\n" || c === "\r" || c === ",";
// EDN symbol/keyword constituents. Deliberately permissive: what matters here
// is finding the token's END, and anything that is not a legal name is refused
// by the caller with a sentence about what it actually was.
const isNameChar = (c) => /[A-Za-z0-9*+!\-_?$%&=<>:#.'/]/.test(c);
// §3.2: a sequence or map inside DATA_DEPTH others is outside the value tree,
// in every engine. Past it a refusal, not a stack overflow thrown through
// parse(): ten kilobytes of `[` were enough for that. A `#_` discard nests the
// reader too, so it counts as a level on the same counter.
class Reader {
    text;
    i = 0;
    depth = 0;
    numbers;
    constructor(text, numbers) { this.text = text; this.numbers = numbers; }
    /** 0-based line of the current position, for diagnostics. */
    line(at = this.i) {
        let n = 0;
        for (let k = 0; k < at && k < this.text.length; k++)
            if (this.text[k] === "\n")
                n++;
        return n;
    }
    /** Whitespace, commas, `;` comments and `#_` discards, in one pass. */
    skip() {
        for (;;) {
            while (this.i < this.text.length && isSpace(this.text[this.i]))
                this.i++;
            if (this.text[this.i] === ";") {
                while (this.i < this.text.length && this.text[this.i] !== "\n")
                    this.i++;
                continue;
            }
            // `#_` discards the NEXT datum entirely — read it and throw it away.
            if (this.text[this.i] === "#" && this.text[this.i + 1] === "_") {
                this.i += 2;
                this.nest(() => this.value()); // may throw Refusal, which is right: a discarded
                continue; // datum outside the subset is still outside it
            }
            return;
        }
    }
    /** The one way this reader reports: a sentence plus the line it happened on. */
    refuse(what, at = this.i) {
        throw new Refusal(what, this.line(at));
    }
    // One level for each container being read, and for each `#_` discard.
    nest(read) {
        if (++this.depth > DATA_DEPTH)
            this.refuse(`nesting deeper than ${DATA_DEPTH} levels is outside the value tree`);
        try {
            return read();
        }
        finally {
            this.depth--;
        }
    }
    value() {
        this.skip();
        if (this.i >= this.text.length)
            this.refuse("the body ends where a value was expected");
        const c = this.text[this.i];
        if (c === "{")
            return this.nest(() => this.map());
        if (c === "[")
            return this.nest(() => this.vector());
        if (c === "(")
            this.refuse("a list `(…)` — this reading has vectors and sets, not lists");
        if (c === '"')
            return this.string();
        if (c === "\\")
            this.refuse("a character literal `\\x`");
        if (c === "#")
            return this.text[this.i + 1] === "{" ? this.nest(() => this.dispatch()) : this.dispatch();
        return this.atom();
    }
    map() {
        const open = this.i;
        this.i++; // {
        // NO PROTOTYPE. On a plain `{}` the assignment below is not a key for the
        // name `__proto__` — it REPLACES the object's prototype, so the entry never
        // becomes an own key: `Object.keys` loses it, the body written back loses it,
        // and what the author wrote is gone with nothing said. A null-prototype map
        // makes every name an ordinary key, `__proto__` included. Every reader here
        // already goes through `Object.prototype.hasOwnProperty.call`, which a
        // prototype-less object answers exactly as well.
        const out = Object.create(null);
        for (;;) {
            this.skip();
            if (this.i >= this.text.length)
                this.refuse("a map that is never closed with `}`", open);
            if (this.text[this.i] === "}") {
                this.i++;
                return out;
            }
            const keyAt = this.i;
            // Whether the key was WRITTEN as a string literal, which `mapKey` cannot
            // tell afterwards: a keyword and a string both arrive as a JS string, and
            // the whole point of that check is telling `:x` from `":x"`.
            const wasString = this.text[this.i] === '"';
            const key = this.value();
            const name = this.mapKey(key, wasString, keyAt);
            this.skip();
            if (this.i >= this.text.length || this.text[this.i] === "}") {
                this.refuse(`the map key \`${name}\` has no value`, keyAt);
            }
            if (Object.prototype.hasOwnProperty.call(out, name)) {
                this.refuse(`the map has the key \`${name}\` twice`, keyAt);
            }
            out[name] = this.value();
        }
    }
    /**
     * A map key, as the object key it becomes. Keywords keep their colon, strings
     * stay bare — so a string may not LOOK like a keyword or a wrapper, or two
     * different EDN maps would encode to the same object.
     */
    mapKey(key, wasString, at) {
        if (typeof key !== "string") {
            this.refuse(`a map key that is ${describe(key)} — this reading has keyword and string keys`, at);
        }
        if (!wasString)
            return key; // a keyword; the colon is part of it
        if (key.startsWith(":")) {
            this.refuse(`the string key \`"${key}"\` — it would encode as the keyword \`${key}\` does`, at);
        }
        if (key.startsWith("$")) {
            this.refuse(`the string key \`"${key}"\` — a leading \`$\` is reserved for ${WRAP_UUID}/${WRAP_INST}/${WRAP_SET}`, at);
        }
        return key;
    }
    vector() {
        const open = this.i;
        this.i++; // [
        const out = [];
        for (;;) {
            this.skip();
            if (this.i >= this.text.length)
                this.refuse("a vector that is never closed with `]`", open);
            if (this.text[this.i] === "]") {
                this.i++;
                return out;
            }
            out.push(this.value());
        }
    }
    string() {
        const open = this.i;
        this.i++; // "
        let s = "";
        while (this.i < this.text.length) {
            const c = this.text[this.i];
            if (c === '"') {
                this.i++;
                return s;
            }
            if (c === "\\") {
                const e = this.text[this.i + 1];
                this.i += 2;
                if (e === "n") {
                    s += "\n";
                    continue;
                }
                if (e === "t") {
                    s += "\t";
                    continue;
                }
                if (e === "r") {
                    s += "\r";
                    continue;
                }
                if (e === '"' || e === "\\") {
                    s += e;
                    continue;
                }
                if (e === "u") {
                    const hex = this.text.slice(this.i, this.i + 4);
                    if (!/^[0-9a-fA-F]{4}$/.test(hex))
                        this.refuse("a `\\u` escape without four hex digits", this.i);
                    s += String.fromCharCode(parseInt(hex, 16));
                    this.i += 4;
                    continue;
                }
                this.refuse(`the string escape \`\\${e ?? ""}\``, this.i - 2);
            }
            s += c;
            this.i++;
        }
        this.refuse("a string that is never closed", open);
    }
    /** `#{…}` a set, `#uuid`/`#inst` a tagged literal, anything else refused. */
    dispatch() {
        const at = this.i;
        this.i++; // #
        if (this.text[this.i] === "{") {
            const open = this.i;
            this.i++;
            const members = [];
            for (;;) {
                this.skip();
                if (this.i >= this.text.length)
                    this.refuse("a set that is never closed with `}`", open);
                if (this.text[this.i] === "}") {
                    this.i++;
                    return { [WRAP_SET]: members };
                }
                members.push(this.value());
            }
        }
        let j = this.i;
        while (j < this.text.length && isNameChar(this.text[j]))
            j++;
        const tag = this.text.slice(this.i, j);
        this.i = j;
        if (tag !== "uuid" && tag !== "inst") {
            this.refuse(tag === ""
                ? "a `#` that begins no set and no tag"
                : `the tagged literal \`#${tag}\` — this reading has \`#uuid\` and \`#inst\``, at);
        }
        this.skip();
        if (this.text[this.i] !== '"')
            this.refuse(`\`#${tag}\` without a string after it`, at);
        const s = this.string();
        return tag === "uuid" ? { [WRAP_UUID]: s } : { [WRAP_INST]: s };
    }
    /** nil, a boolean, a number, a keyword — or a refusal naming what it was. */
    atom() {
        const at = this.i;
        let j = this.i;
        while (j < this.text.length && isNameChar(this.text[j]))
            j++;
        const t = this.text.slice(this.i, j);
        this.i = j;
        if (t === "")
            this.refuse(`the character \`${this.text[at]}\` begins no value this reading has`, at);
        if (t === "nil")
            return null;
        if (t === "true")
            return true;
        if (t === "false")
            return false;
        if (t.startsWith(":")) {
            if (t === ":")
                this.refuse("a bare `:` with no name after it", at);
            return t;
        }
        // Numbers, and the numeric shapes this reading refuses BY NAME rather than
        // rounding into a float: EDN's arbitrary-precision and ratio literals mean
        // something JSON's number cannot hold.
        if (/^[+-]?\d+[NM]$/.test(t) || /^[+-]?\d*\.\d+M$/.test(t)) {
            this.refuse(`the arbitrary-precision literal \`${t}\` — a JSON number cannot hold it`, at);
        }
        if (/^[+-]?\d+\/\d+$/.test(t))
            this.refuse(`the ratio \`${t}\` — a JSON number cannot hold it`, at);
        if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
            const n = Number(t);
            if (Number.isFinite(n)) {
                this.numbers?.push({ literal: t, line: this.line(at) });
                return n;
            }
            this.refuse(`the number \`${t}\` is not finite`, at);
        }
        this.refuse(`the symbol \`${t}\` — this reading has keywords, not symbols`, at);
    }
}
class Refusal extends Error {
    what;
    at;
    constructor(what, at) {
        super(what);
        this.what = what;
        this.at = at;
    }
}
function describe(v) {
    if (v === null)
        return "nil";
    if (Array.isArray(v))
        return "a vector";
    if (typeof v === "object")
        return "a set or a tagged literal";
    return `the ${typeof v} \`${String(v)}\``;
}
/**
 * One EDN datum, as the value tree §3.2 has. A body with a second datum after
 * the first is refused: `data` holds ONE value, and `jsonl` is the shape for a
 * sequence of them.
 */
export function parseEdn(body, numbers) {
    const r = new Reader(body.join("\n"), numbers);
    try {
        const value = r.value();
        r.skip();
        if (r.i < r.text.length) {
            return { error: "a second value after the first — a `data` block holds one", line: r.line() };
        }
        return { value };
    }
    catch (e) {
        if (e instanceof Refusal)
            return { error: e.what, line: e.at };
        throw e;
    }
}
// --- writing it back ---------------------------------------------------------
const isWrap = (v, key) => v !== null && typeof v === "object" && !Array.isArray(v) &&
    Object.keys(v).length === 1 && Object.prototype.hasOwnProperty.call(v, key);
function scalar(v) {
    if (v === null)
        return "nil";
    if (typeof v === "boolean")
        return v ? "true" : "false";
    if (typeof v === "number")
        return String(v);
    // A keyword went in with its colon and comes back out with it; every other
    // string is quoted. This is the inverse of `mapKey`, which is why a bare
    // string beginning with `:` is refused on the way in.
    //
    // `render` handles every collection before delegating here, so a non-string
    // at this point is a value tree this module did not produce — JSON.stringify
    // is the honest answer for it rather than a cast that pretends otherwise.
    if (typeof v !== "string")
        return JSON.stringify(v);
    if (v.startsWith(":"))
        return v;
    return JSON.stringify(v);
}
/**
 * The value tree back to EDN text, laid out to be read: a map breaks one entry
 * per line and nests, vectors and sets stay inline. `geml set` writes through
 * this, so a coordinate write into an `edn` body re-emits EDN rather than
 * rewriting the block as JSON.
 */
export function serializeEdn(value, indent = "") {
    return render(value, indent).split("\n");
}
function render(v, indent) {
    if (isWrap(v, WRAP_UUID))
        return `#uuid ${JSON.stringify(v[WRAP_UUID])}`;
    if (isWrap(v, WRAP_INST))
        return `#inst ${JSON.stringify(v[WRAP_INST])}`;
    if (isWrap(v, WRAP_SET)) {
        const members = v[WRAP_SET];
        if (!Array.isArray(members))
            return `#{${render(members, indent)}}`;
        return `#{${members.map((m) => render(m, indent)).join(" ")}}`;
    }
    if (Array.isArray(v))
        return `[${v.map((m) => render(m, indent)).join(" ")}]`;
    if (v !== null && typeof v === "object") {
        const entries = Object.entries(v);
        if (entries.length === 0)
            return "{}";
        const pad = indent + " ";
        const lines = entries.map(([k, val]) => {
            const key = k.startsWith(":") ? k : JSON.stringify(k);
            return pad + key + " " + render(val, pad + " ".repeat(key.length + 1));
        });
        return "{" + lines.join("\n").slice(pad.length) + "}";
    }
    return scalar(v);
}
