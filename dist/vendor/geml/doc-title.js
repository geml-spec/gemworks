export function docTitle(doc) {
    let title;
    for (const b of doc.children) {
        if (b.kind === "block" && b.type === "meta" && b.data && "title" in b.data) {
            const v = b.data["title"];
            title = typeof v === "string" ? v.trim() : undefined;
            break;
        }
    }
    if (title === undefined || title === "")
        return { echo: false };
    const first = doc.children.find((b) => b.kind === "heading" && !b.hidden);
    const echo = first?.kind === "heading" && first.level === 1 && first.text.trim() === title;
    return { title, echo };
}
/** Levels a projection adds to every body heading: one when the title is emitted as a heading of its own. */
export function headingShift(t) {
    return t.title !== undefined && !t.echo ? 1 : 0;
}
