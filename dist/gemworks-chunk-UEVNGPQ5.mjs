// src/core/command-line.ts
function commandOf(input) {
  const c = input?.["command"];
  return typeof c === "string" ? c : void 0;
}
var MAX_SIGNAL_COMMAND_LENGTH = 65536;
var PERSON_VERBS = /* @__PURE__ */ new Set(["mark", "unmark", "advance", "pause", "resume"]);
var isBlank = (c) => c === " " || c === "	";
var ASSIGNMENT_WORD = /^[A-Za-z_][A-Za-z0-9_]*=/;
var ASSIGNMENT_LIKE = /^[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]*\])?\+?=/;
var REDIRECTION = /^(?:\d+|\{[A-Za-z_][A-Za-z0-9_]*\})?(?:<<<|<<-?|<>|<&|>&|>>|>\||>|<)/;
var COMPOUND_WORDS = /* @__PURE__ */ new Set([
  "[[",
  "]]",
  "{",
  "}",
  "function",
  "if",
  "then",
  "elif",
  "else",
  "fi",
  "while",
  "until",
  "do",
  "done",
  "for",
  "case",
  "esac",
  "select",
  "coproc",
  "repeat",
  "foreach"
]);
var SHELL_CHANGING_WORDS = /* @__PURE__ */ new Set(["exit", "exec", "trap", "return", "logout", "hash", "alias", "unalias", "function", "enable", "eval", "source", "."]);
var PREFIX_WORDS = /* @__PURE__ */ new Set(["builtin", "command", "time", "!", "noglob", "nocorrect"]);
var COMMAND_INTRODUCERS = /* @__PURE__ */ new Set([...PREFIX_WORDS, "{", "if", "then", "elif", "else", "while", "until", "do"]);
var GEMWORKS_WORD = /(?:^|\/)(?:gemworks?|gwx)(?:@[^/]*)?(?:\.(?:[cm]?js|cmd|ps1))?$/i;
var GEMWORKS_CLI = /(?:^|\/)(?:gemworks?\/(?:.*\/)?|(?:dist|src|bin)\/)cli\.[cm]?[jt]s$/i;
var LAUNCHERS = /* @__PURE__ */ new Set([
  "npx",
  "bunx",
  "pnpx",
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "corepack",
  "uvx",
  "node",
  "nodejs",
  "deno",
  "tsx",
  "ts-node",
  "env",
  "exec",
  "nohup",
  "sudo",
  "doas",
  "su",
  "runuser",
  "timeout",
  "gtimeout",
  "nice",
  "ionice",
  "xargs",
  "parallel",
  "setsid",
  "stdbuf",
  "command",
  "builtin",
  "time",
  "watch",
  "caffeinate",
  "chronic",
  "flock",
  "script",
  "busybox"
]);
var SHELL_RUNNERS = /* @__PURE__ */ new Set(["sh", "bash", "zsh", "dash", "ksh", "ash", "fish", "eval", "pwsh", "powershell"]);
var PWSH_COMMAND = /^-c(?:o(?:m(?:m(?:a(?:n(?:d)?)?)?)?)?)?$/i;
var SHELL_OPTION = /^(?:-c|--call|--command|-S|--split-string)$/;
var SHELL_OPTION_JOINED = /^--(?:call|command|split-string)=/;
function words(command) {
  const out = [];
  let start = -1, text = "", expands = false;
  let quote = null;
  const end = (at) => {
    if (start < 0) return;
    out.push({ raw: command.slice(start, at), text, start, expands });
    start = -1;
    text = "";
    expands = false;
  };
  for (let i = 0; i < command.length; i++) {
    const c = command.charAt(i);
    if (start < 0) {
      if (isBlank(c)) continue;
      start = i;
    }
    if (quote === "'") {
      if (c === "'") quote = null;
      else text += c;
    } else if (quote === "$'") {
      if (c === "\\") i++;
      else if (c === "'") quote = null;
      else text += c;
    } else if (quote === '"') {
      if (c === "\\") {
        const next = command.charAt(i + 1);
        if (next === "\n") i++;
        else if (next === "$" || next === "`" || next === '"' || next === "\\") {
          text += next;
          i++;
        } else text += c;
      } else if (c === '"') quote = null;
      else {
        if (c === "$") expands = true;
        text += c;
      }
    } else if (isBlank(c)) end(i);
    else if (c === "'" || c === '"') quote = c;
    else if (c === "$" && command.charAt(i + 1) === "'") {
      quote = "$'";
      expands = true;
      i++;
    } else if (c === "\\") text += command.charAt(++i);
    else {
      if (c === "$") expands = true;
      text += c;
    }
  }
  end(command.length);
  return out;
}
function commandWordIndex(ws, through = PREFIX_WORDS) {
  let prefixed = false;
  for (let i = 0; i < ws.length; ) {
    const w = ws[i];
    if (w === void 0) break;
    const redirect = w.raw.match(REDIRECTION);
    if (ASSIGNMENT_LIKE.test(w.raw)) i++;
    else if (redirect) i += redirect[0].length === w.raw.length ? 2 : 1;
    else if (prefixed && w.text.startsWith("-")) i++;
    else if (!w.expands && through.has(w.text)) {
      prefixed = true;
      i++;
    } else return i;
  }
  return -1;
}
function speaksForItself(command) {
  const ws = words(command);
  const at = commandWordIndex(ws);
  const w = at < 0 ? void 0 : ws[at];
  return w === void 0 || !w.expands && !COMPOUND_WORDS.has(w.text) && !SHELL_CHANGING_WORDS.has(w.text);
}
function trimBlanks(s) {
  let a = 0, b = s.length;
  while (a < b && isBlank(s.charAt(a))) a++;
  while (b > a && isBlank(s.charAt(b - 1))) b--;
  return s.slice(a, b);
}
function simpleCommands(line) {
  const parts = [];
  let cur = "";
  let quote = null;
  let prev = "";
  let wordStart = true;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    const next = line.charAt(i + 1);
    if (quote !== null) {
      if (quote === '"' && c === "$" && next === "{") return null;
      cur += c;
      if (c === "\\" && quote !== "'" && i + 1 < line.length) cur += line.charAt(++i);
      else if (c === quote.slice(-1)) quote = null;
    } else if (c === "'" || c === '"') {
      quote = c;
      cur += c;
      prev = "";
      wordStart = false;
    } else if (c === "$" && next === "'") {
      quote = "$'";
      cur += "$'";
      i++;
      prev = "";
      wordStart = false;
    } else if (c === "$" && (next === "(" || next === "{" || next === "[")) {
      return null;
    } else if (c === "\\") {
      if (next === "\n") {
        i++;
        continue;
      }
      cur += c + next;
      i++;
      prev = "";
      wordStart = false;
    } else if (c === "&") {
      if (next === "&") {
        parts.push(cur);
        cur = "";
        i++;
        prev = "";
        wordStart = true;
        continue;
      }
      if (next === ">" || prev !== ">" && prev !== "<") return null;
      cur += c;
      prev = c;
      wordStart = true;
    } else if (c === "#" && wordStart) {
      return null;
    } else if (c === ";" || c === "|" || c === "\n" || c === "`" || c === "(") {
      return null;
    } else {
      cur += c;
      prev = c;
      wordStart = isBlank(c) || c === "<" || c === ">";
    }
  }
  if (quote !== null) return null;
  parts.push(cur);
  const commands = parts.map(trimBlanks);
  if (commands.length === 1 && commands[0] === "") return [];
  return commands.every((c) => c !== "" && speaksForItself(c)) ? commands : null;
}
function withoutAssignments(command) {
  const first = words(command).find((w) => !ASSIGNMENT_WORD.test(w.raw));
  return first === void 0 ? "" : command.slice(first.start);
}
function signalHeads(line) {
  if (line.length > MAX_SIGNAL_COMMAND_LENGTH) return null;
  const commands = simpleCommands(line);
  return commands === null ? null : commands.map(withoutAssignments);
}
function withoutQuoting(command) {
  return command.replace(/\\\n/g, "").replace(/['"\\]/g, "").replace(/[ \t]+/g, " ");
}
var MAX_NESTING = 8;
function hereDocAt(line, at) {
  if (line.charAt(at) !== "<" || line.charAt(at + 1) !== "<" || line.charAt(at + 2) === "<") return void 0;
  let j = at + 2;
  const strip = line.charAt(j) === "-";
  if (strip) j++;
  while (line.charAt(j) === " " || line.charAt(j) === "	") j++;
  let delim = "";
  let literal = false;
  while (j < line.length) {
    const c = line.charAt(j);
    if (c === "'" || c === '"') {
      const close = line.indexOf(c, j + 1);
      if (close < 0) return void 0;
      delim += line.slice(j + 1, close);
      literal = true;
      j = close + 1;
    } else if (c === "\\") {
      delim += line.charAt(j + 1);
      literal = true;
      j += 2;
    } else if (/[\s;&|()<>]/.test(c)) break;
    else {
      delim += c;
      j++;
    }
  }
  return delim === "" ? void 0 : { delim, strip, literal, end: j };
}
var ARITHMETIC = /\(\(|\$\[/;
function shellTextBefore(line, from, upto, skipped) {
  let out = "";
  let at = from;
  for (const [start, end] of skipped) {
    if (start >= upto) break;
    if (start > at) out += line.slice(at, start);
    at = Math.max(at, end);
  }
  return upto > at ? out + line.slice(at, upto) : out;
}
function hereDocBody(line, nl, doc) {
  let start = nl + 1;
  while (start <= line.length) {
    const found = line.indexOf("\n", start);
    const stop = found < 0 ? line.length : found;
    const text = line.slice(start, stop).replace(/\r$/, "");
    if ((doc.strip ? text.replace(/^\t+/, "") : text) === doc.delim) return { body: line.slice(nl + 1, start), end: stop };
    start = stop + 1;
  }
  return { body: line.slice(nl + 1), end: line.length };
}
function substitutionEnd(line, from, depth = 0) {
  if (depth > MAX_NESTING) return -1;
  let open = 1;
  const docs = [];
  const skipped = [];
  for (let i = from; i < line.length; i++) {
    const c = line.charAt(i);
    const doc = c === "<" ? hereDocAt(line, i) : void 0;
    if (doc !== void 0 && ARITHMETIC.test(shellTextBefore(line, from, i, skipped))) return -1;
    if (doc !== void 0) {
      docs.push(doc);
      i = doc.end - 1;
    } else if (c === "\n" && docs.length > 0) {
      for (const d of docs.splice(0)) {
        const end = hereDocBody(line, i, d).end;
        skipped.push([i + 1, end]);
        i = end;
      }
    } else if (c === "\\") i++;
    else if (c === "'") {
      i = line.indexOf("'", i + 1);
      if (i < 0) return -1;
    } else if (c === '"') {
      for (i++; i < line.length && line.charAt(i) !== '"'; i++) {
        if (line.charAt(i) === "\\") i++;
        else if (line.charAt(i) === "$" && line.charAt(i + 1) === "(") {
          i = substitutionEnd(line, i + 2, depth + 1);
          if (i < 0) return -1;
        }
      }
      if (i >= line.length) return -1;
    } else if (c === "(") open++;
    else if (c === ")" && --open === 0) return i;
  }
  return -1;
}
function backtickEnd(line, from) {
  for (let i = from; i < line.length; i++) {
    if (line.charAt(i) === "\\") i++;
    else if (line.charAt(i) === "`") return i;
  }
  return -1;
}
function commandSegments(line, depth = 0) {
  if (depth > MAX_NESTING) return null;
  const out = [];
  let cur = "";
  let quote = null;
  let prev = "";
  const flush = () => {
    const text = trimBlanks(cur);
    if (text !== "") out.push(text);
    cur = "";
  };
  const nested = (body) => {
    const inner = commandSegments(body, depth + 1);
    if (inner === null) return false;
    out.push(...inner);
    return true;
  };
  const expanded = (body) => {
    for (let j = 0; j < body.length; j++) {
      const c = body.charAt(j);
      if (c === "\\") j++;
      else if (c === "$" && body.charAt(j + 1) === "(") {
        const end = substitutionEnd(body, j + 2, depth);
        if (end < 0 || !nested(body.slice(j + 2, end))) return false;
        j = end;
      } else if (c === "`") {
        const end = backtickEnd(body, j + 1);
        if (end < 0 || !nested(body.slice(j + 1, end))) return false;
        j = end;
      }
    }
    return true;
  };
  const docs = [];
  const skipped = [];
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    const next = line.charAt(i + 1);
    const doc = quote === null && c === "<" ? hereDocAt(line, i) : void 0;
    if (doc !== void 0 && ARITHMETIC.test(shellTextBefore(line, 0, i, skipped))) return null;
    if (doc !== void 0) {
      docs.push(doc);
      cur += line.slice(i, doc.end);
      i = doc.end - 1;
      prev = "";
    } else if (quote === null && c === "\n" && docs.length > 0) {
      flush();
      prev = "";
      for (const d of docs.splice(0)) {
        const { body, end } = hereDocBody(line, i, d);
        if (!d.literal && !expanded(body)) return null;
        skipped.push([i + 1, end]);
        i = end;
      }
    } else if (quote === "'") {
      cur += c;
      if (c === "'") quote = null;
    } else if (quote === '"' && c === "$" && next === "(") {
      const end = substitutionEnd(line, i + 2, depth);
      if (end < 0 || !nested(line.slice(i + 2, end))) return null;
      cur += line.slice(i, end + 1);
      i = end;
    } else if (quote === '"' && c === "`") {
      const end = backtickEnd(line, i + 1);
      if (end < 0 || !nested(line.slice(i + 1, end))) return null;
      cur += line.slice(i, end + 1);
      i = end;
    } else if (quote !== null) {
      cur += c;
      if (c === "\\" && quote !== "'" && i + 1 < line.length) cur += line.charAt(++i);
      else if (c === quote.slice(-1)) quote = null;
    } else if (c === "'" || c === '"') {
      quote = c;
      cur += c;
      prev = "";
    } else if (c === "$" && next === "'") {
      quote = "$'";
      cur += "$'";
      i++;
      prev = "";
    } else if (c === "\\") {
      if (next === "\n") {
        i++;
        continue;
      }
      cur += c + next;
      i++;
      prev = "";
    } else if (c === "&" && next !== "&" && (prev === ">" || prev === "<" || next === ">")) {
      cur += c;
      prev = c;
    } else if (c === ";" || c === "&" || c === "|" || c === "\n" || c === "`" || c === "(" || c === ")") {
      flush();
      prev = "";
    } else {
      cur += c;
      prev = c;
    }
  }
  if (quote !== null) return null;
  flush();
  return out;
}
function personVerbAfter(ws, at) {
  for (let i = at + 1; i < ws.length; i++) {
    const w = ws[i];
    if (w === void 0) break;
    const redirect = w.raw.match(REDIRECTION);
    if (redirect) {
      if (redirect[0].length === w.raw.length) i++;
      continue;
    }
    if (w.text.startsWith("-") || namesGemworks(w.text)) continue;
    if (w.expands) return "mark|unmark|advance|pause|resume";
    const verb = w.text.toLowerCase();
    return PERSON_VERBS.has(verb) ? verb : void 0;
  }
  return void 0;
}
function namesGemworks(text) {
  return GEMWORKS_WORD.test(text) || GEMWORKS_CLI.test(text);
}
function personVerbLoosely(line) {
  const plain = withoutQuoting(line);
  return /\bgemworks\b/i.test(plain) ? plain.match(/\b(mark|unmark|advance|pause|resume)\b/i)?.[1]?.toLowerCase() : void 0;
}
var MAX_SHELL_DEPTH = 3;
function personVerb(line, depth = 0) {
  const segments = depth > MAX_SHELL_DEPTH ? null : commandSegments(line);
  if (segments === null) return personVerbLoosely(line);
  let looseRead = false;
  for (const segment of segments) {
    const ws = words(segment);
    const at = commandWordIndex(ws, COMMAND_INTRODUCERS);
    const head = at < 0 ? void 0 : ws[at];
    if (head === void 0) continue;
    if (head.expands) {
      if (looseRead) continue;
      looseRead = true;
      const verb = personVerbLoosely(line);
      if (verb !== void 0) return verb;
      continue;
    }
    if (namesGemworks(head.text)) {
      const verb = personVerbAfter(ws, at);
      if (verb !== void 0) return verb;
      continue;
    }
    if (LAUNCHERS.has(programName(head.text).toLowerCase())) {
      for (let i = at + 1; i < ws.length; i++) {
        const w = ws[i];
        const verb = w !== void 0 && namesGemworks(w.text) ? personVerbAfter(ws, i) : void 0;
        if (verb !== void 0) return verb;
      }
    }
    for (const inner of shellStrings(ws, at)) {
      const verb = personVerb(inner.text, depth + 1) ?? (inner.powershell ? personVerbLoosely(inner.text) : void 0);
      if (verb !== void 0) return verb;
    }
  }
  return void 0;
}
function runnerStrings(name, args) {
  if (name === "eval") return [{ text: args.join(" "), powershell: false }];
  if (name !== "pwsh" && name !== "powershell") return args.map((text) => ({ text, powershell: false }));
  const flag = args.findIndex((a) => PWSH_COMMAND.test(a));
  return [...args, (flag < 0 ? args : args.slice(flag + 1)).join(" ")].map((text) => ({ text, powershell: true }));
}
function shellStrings(ws, at) {
  const head = ws[at];
  if (head === void 0) return [];
  const name = programName(head.text).toLowerCase();
  if (SHELL_RUNNERS.has(name)) return runnerStrings(name, ws.slice(at + 1).map((w) => w.text));
  if (!LAUNCHERS.has(name)) return [];
  const out = [];
  for (let i = at + 1; i < ws.length; i++) {
    const text = ws[i].text;
    const inner = programName(text).toLowerCase();
    if (SHELL_RUNNERS.has(inner)) {
      out.push(...runnerStrings(inner, ws.slice(i + 1).map((w) => w.text)));
      break;
    }
    const next = ws[i + 1];
    if (SHELL_OPTION.test(text) && next !== void 0) out.push({ text: next.text, powershell: false });
    else if (SHELL_OPTION_JOINED.test(text)) out.push({ text: text.slice(text.indexOf("=") + 1), powershell: false });
  }
  return out;
}
function personOnlyReason(verb) {
  return `\`gemworks ${verb}\` is for a person, not the model: manual signals and a person's transitions are never taken by the agent`;
}
var STDIN_RUNNERS = /* @__PURE__ */ new Set(["python", "python3", "py", "perl", "ruby", "php", "lua", "osascript", "rscript", "tclsh", "ssh", "docker", "podman", "kubectl"]);
function withoutDataHereDocs(line, depth = 0) {
  if (depth > MAX_NESTING) return null;
  const cuts = [];
  const docs = [];
  let quote = null;
  let start = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if ((quote === null || quote === '"') && c === "$" && line.charAt(i + 1) === "(" && line.charAt(i + 2) === "(") return null;
    if ((quote === null || quote === '"') && c === "$" && line.charAt(i + 1) === "(") {
      const end = substitutionEnd(line, i + 2, depth);
      if (end < 0) return null;
      const inner = withoutDataHereDocs(line.slice(i + 2, end), depth + 1);
      if (inner === null) return null;
      cuts.push([i + 2, end, inner]);
      i = end;
      continue;
    }
    if (quote !== null) {
      if (c === "\\" && quote !== "'") i++;
      else if (c === quote.slice(-1)) quote = null;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      continue;
    }
    if (c === "$" && line.charAt(i + 1) === "'") {
      quote = "$'";
      i++;
      continue;
    }
    if (c === "\\") {
      i++;
      continue;
    }
    const doc = c === "<" ? hereDocAt(line, i) : void 0;
    if (doc !== void 0) {
      if (ARITHMETIC.test(shellTextBefore(line, 0, i, cuts.map(([a, b]) => [a, b])))) return null;
      const ws = words(line.slice(start, i));
      const at2 = commandWordIndex(ws, COMMAND_INTRODUCERS);
      const head = at2 < 0 ? void 0 : ws[at2];
      if (head?.expands === true) return null;
      const name = head === void 0 ? "" : programName(head.text).toLowerCase();
      const eol = line.indexOf("\n", doc.end);
      const pipes = /(^|[^|])\|(?!\|)/.test(line.slice(doc.end, eol < 0 ? line.length : eol));
      docs.push({ doc, runs: head === void 0 || SHELL_RUNNERS.has(name) || LAUNCHERS.has(name) || STDIN_RUNNERS.has(name) || pipes });
      i = doc.end - 1;
      continue;
    }
    if (c === "\n" && docs.length > 0) {
      for (const { doc: d, runs } of docs.splice(0)) {
        const { end } = hereDocBody(line, i, d);
        if (!runs && d.literal) cuts.push([i + 1, end, ""]);
        i = end;
      }
      start = i + 1;
      continue;
    }
    if (c === ";" || c === "&" || c === "|" || c === "\n" || c === "(" || c === ")" || c === "`") start = i + 1;
  }
  if (quote !== null) return null;
  let out = "";
  let at = 0;
  for (const [a, b, text] of cuts) {
    out += line.slice(at, a) + text;
    at = b;
  }
  return out + line.slice(at);
}
function programName(word) {
  return word.slice(Math.max(word.lastIndexOf("/"), word.lastIndexOf("\\")) + 1).replace(/\.exe$/i, "");
}
var GIT_WORD = /(?:^|[\s;&|(`/\\])(?:git|gh)(?:\.exe)?(?=[\s;&|)`]|$)/i;
function isGitOrGh(word) {
  const name = programName(word);
  return name === "git" || name === "gh";
}
function runsGitOrGh(line) {
  return gitIn(line, 0);
}
function gitIn(line, depth) {
  const segments = depth > MAX_SHELL_DEPTH ? null : commandSegments(line);
  if (segments === null) return GIT_WORD.test(line);
  return segments.some((segment) => {
    const ws = words(segment);
    const at = commandWordIndex(ws, COMMAND_INTRODUCERS);
    const head = at < 0 ? void 0 : ws[at];
    if (head === void 0 || head.expands) return false;
    if (isGitOrGh(head.text)) return true;
    if (LAUNCHERS.has(programName(head.text).toLowerCase()) && ws.slice(at + 1).some((w) => isGitOrGh(w.text))) return true;
    return shellStrings(ws, at).some((inner) => gitIn(inner.text, depth + 1) || inner.powershell && GIT_WORD.test(inner.text));
  });
}
function personOnlyRefusal(command) {
  const verb = personVerb(command);
  return verb === void 0 ? void 0 : personOnlyReason(verb);
}
var SEARCH_COMMANDS = /* @__PURE__ */ new Set(["rg", "grep", "egrep", "fgrep", "ls", "find", "fd", "tree", "wc", "head", "tail"]);
var FIND_ACTIONS = /* @__PURE__ */ new Set(["-exec", "-execdir", "-ok", "-okdir", "-delete", "-fprint", "-fprint0", "-fprintf", "-fls"]);
function runsOrWrites(command, arg) {
  switch (command) {
    case "find":
      return FIND_ACTIONS.has(arg);
    case "fd":
      return arg.startsWith("--exec") || /^-[^-]*[xX]/.test(arg);
    // -x, -X, --exec, --exec-batch, and a cluster holding either (-Hx)
    case "rg":
      return arg === "--pre" || arg.startsWith("--pre=");
    // a preprocessor runs for every file searched
    case "tree":
      return /^-[^-]*o/.test(arg);
    // -o writes the listing to a file
    default:
      return false;
  }
}
var QUIET_REDIRECT = />(?:&(?:\d+|-)|[ \t]*\/dev\/null)(?=[ \t|&;)]|$)/y;
function pipelineStages(line) {
  const out = [];
  let cur = "";
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    const next = line.charAt(i + 1);
    if (quote !== null) {
      if (quote === '"' && (c === "`" || c === "$" && next === "(")) return null;
      cur += c;
      if (c === "\\" && quote !== "'" && i + 1 < line.length) cur += line.charAt(++i);
      else if (c === quote.slice(-1)) quote = null;
    } else if (c === "'" || c === '"') {
      quote = c;
      cur += c;
    } else if (c === "$" && next === "'") {
      quote = "$'";
      cur += "$'";
      i++;
    } else if (c === "\\") {
      cur += c + next;
      i++;
    } else if (c === "|" && next !== "|" && next !== "&" && line.charAt(i - 1) !== "|" && line.charAt(i - 1) !== ">") {
      out.push(cur);
      cur = "";
    } else if (c === ">") {
      const prev = line.charAt(i - 1);
      QUIET_REDIRECT.lastIndex = i;
      const quiet = prev === "&" || prev === "<" || prev === ">" ? null : QUIET_REDIRECT.exec(line);
      if (quiet === null) return null;
      cur += quiet[0];
      i += quiet[0].length - 1;
    } else {
      cur += c;
    }
  }
  if (quote !== null) return null;
  out.push(cur);
  return out;
}
function searchesOnly(command) {
  const ws = words(command);
  const head = ws[0];
  if (head === void 0 || !SEARCH_COMMANDS.has(head.text) || ws.some((w) => w.expands)) return false;
  return ws.slice(1).every((w) => !runsOrWrites(head.text, w.text));
}
function isSearchOnlyCommand(line) {
  if (line.length > MAX_SIGNAL_COMMAND_LENGTH) return false;
  const stages = pipelineStages(line);
  if (stages === null) return false;
  return stages.every((stage) => {
    const commands = simpleCommands(stage);
    return commands !== null && commands.length > 0 && commands.every(searchesOnly);
  });
}
var DIRECTORY_CHANGERS = /* @__PURE__ */ new Set(["cd", "pushd", "popd", "chdir"]);
var CHANGER_WORD = /(?:^|[\s;&|(`])(?:cd|pushd|popd|chdir)(?=[\s;&|)`]|$)/;
function argumentsOf(ws, at) {
  const out = [];
  for (let i = at + 1; i < ws.length; i++) {
    const w = ws[i];
    if (w === void 0) break;
    const redirect = w.raw.match(REDIRECTION);
    if (redirect) {
      if (redirect[0].length === w.raw.length) i++;
      continue;
    }
    out.push(w);
  }
  return out;
}
var DRIVE = /^[A-Za-z]:[\\/]/;
function absoluteNormal(path) {
  const windows = DRIVE.test(path);
  if (!windows && (!path.startsWith("/") || path.includes("\\"))) return void 0;
  const prefix = windows ? `${path.charAt(0).toUpperCase()}:/` : "/";
  const out = [];
  for (const seg of path.slice(prefix.length).split(/[\\/]/)) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return `${prefix}${out.join("/")}`;
}
function cdTarget(from, arg) {
  const t = arg.text;
  if (arg.expands || arg.raw.includes("`") || t === "" || /^[~+-]/.test(t) || /[*?[]/.test(t)) return void 0;
  const here = absoluteNormal(from);
  if (here === void 0) return void 0;
  if (DRIVE.test(t)) return absoluteNormal(t);
  if (/^[A-Za-z]:/.test(t)) return void 0;
  if (t.startsWith("/")) {
    if (here.startsWith("/")) return absoluteNormal(t);
    const m = t.match(/^\/([A-Za-z])(?:\/(.*))?$/);
    return m ? absoluteNormal(`${m[1].toUpperCase()}:/${m[2] ?? ""}`) : void 0;
  }
  return absoluteNormal(`${here}/${t}`);
}
function directoryMove(command) {
  const ws = words(command);
  const at = commandWordIndex(ws);
  const head = at < 0 ? void 0 : ws[at];
  if (head === void 0 || head.expands || !DIRECTORY_CHANGERS.has(head.text)) return void 0;
  const args = argumentsOf(ws, at);
  const arg = args[0];
  if (head.text === "popd" || args.length !== 1 || arg === void 0) return () => void 0;
  return (from) => cdTarget(from, arg);
}
function isDirectoryChange(command) {
  return directoryMove(command) !== void 0;
}
function commandDirs(line, startDir) {
  const commands = simpleCommands(line);
  if (commands === null) return null;
  let dir = absoluteNormal(startDir) ?? startDir;
  return commands.map((command) => {
    const here = dir;
    const move = directoryMove(command);
    if (move !== void 0) dir = here === void 0 ? void 0 : move(here);
    return here;
  });
}
function changesDirectory(line) {
  const segments = commandSegments(line);
  if (segments === null) return CHANGER_WORD.test(line);
  return segments.some((segment) => {
    const ws = words(segment);
    const at = commandWordIndex(ws, COMMAND_INTRODUCERS);
    const head = at < 0 ? void 0 : ws[at];
    return head !== void 0 && !head.expands && DIRECTORY_CHANGERS.has(head.text);
  });
}
function pathWords(command) {
  const ws = words(command);
  const at = commandWordIndex(ws);
  if (at < 0) return [];
  const out = [];
  for (const w of argumentsOf(ws, at)) {
    if (w.expands || w.raw.includes("`")) continue;
    const option = w.text.startsWith("-");
    const eq = option ? w.text.indexOf("=") : -1;
    if (option && eq < 0) continue;
    const text = eq < 0 ? w.text : w.text.slice(eq + 1);
    if (text !== "") out.push({ text, glob: /[*?[]/.test(text) });
  }
  return out;
}
var isOperand = (w) => w !== void 0 && w.text !== "" && !w.text.startsWith("-");
function switchOnly(args) {
  const [a, b, c, ...more] = args;
  if (more.length > 0 || a === void 0) return false;
  if (["-c", "-C", "--create", "--force-create"].includes(a.text)) return isOperand(b) && (c === void 0 || isOperand(c));
  return isOperand(a) && b === void 0;
}
function checkoutOnly(args, isBranch) {
  const [a, b, c, ...more] = args;
  if (more.length > 0 || a === void 0) return false;
  if (a.text === "-b" || a.text === "-B") return isOperand(b) && (c === void 0 || isOperand(c));
  return isOperand(a) && b === void 0 && isBranch !== void 0 && isBranch(a.text);
}
function worktreeAddOnly(args) {
  let branch = false, detach = false, i = 0;
  for (; i < args.length && args[i].text.startsWith("-"); i++) {
    const t = args[i].text;
    if ((t === "-b" || t === "-B") && !branch && isOperand(args[i + 1])) {
      branch = true;
      i++;
    } else if (t === "--detach" && !detach) detach = true;
    else return false;
  }
  const operands = args.slice(i);
  return (operands.length === 1 || operands.length === 2) && operands.every(isOperand);
}
function switchesOnly(command, isBranch) {
  const ws = words(command);
  if (ws.some((w) => w.expands || w.raw.includes("`") || REDIRECTION.test(w.raw))) return false;
  const [head, sub, ...rest] = ws;
  if (head?.text === "cd") return isOperand(sub) && rest.length === 0;
  if (head?.text !== "git" || sub === void 0) return false;
  if (sub.text === "switch") return switchOnly(rest);
  if (sub.text === "checkout") return checkoutOnly(rest, isBranch);
  if (sub.text === "worktree") return rest[0]?.text === "add" && worktreeAddOnly(rest.slice(1));
  return false;
}
function switchesWorkItemOnly(line, isBranch) {
  if (line.length > MAX_SIGNAL_COMMAND_LENGTH) return false;
  const commands = simpleCommands(line);
  return commands !== null && commands.length > 0 && commands.every((c) => switchesOnly(c, isBranch));
}

export {
  commandOf,
  MAX_SIGNAL_COMMAND_LENGTH,
  simpleCommands,
  signalHeads,
  withoutQuoting,
  personOnlyReason,
  withoutDataHereDocs,
  runsGitOrGh,
  personOnlyRefusal,
  isSearchOnlyCommand,
  isDirectoryChange,
  commandDirs,
  changesDirectory,
  pathWords,
  switchesWorkItemOnly
};
