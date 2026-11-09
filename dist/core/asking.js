const PREFER_ONCE = "这次允许";
const PREFER_DEFAULT = "以后默认用它";
const DENY = "拒绝";
/** The question for a tool that is bound to a use but is not the use's preferred tool. */
export function preferQuestion(key, use, preferredTool) {
    return { question: `gemworks：${use} 的首选是 ${preferredTool}，这次用 ${key}？`, options: [PREFER_ONCE, PREFER_DEFAULT, DENY] };
}
export function preferAnswer(answer, key, use, preferredTool) {
    if (answer === PREFER_DEFAULT)
        return { kind: "learn", lessons: [{ kind: "default", key, use }] };
    if (answer === DENY)
        return { kind: "deny", reason: `use ${preferredTool} for ${use}, the preferred tool` };
    return { kind: "pass" };
}
