/**
 * Whether the work item waits on a person (the board's 待处理, the band's one
 * thing): some way on — a way out that does not go back to the start — is
 * theirs to take (an approval whose condition holds, or one whose condition
 * reads only what a person ticks), and nobody else has one (the model's
 * judgement, or evidence the machine reads). A way back to the start alone,
 * reopening what was put aside, is no waiting.
 */
export function waitsOnPerson(next, sources) {
    const ticked = (x) => x.judge === "machine" && x.reads.length > 0 && x.reads.every((r) => sources[r] === "human");
    const on = next.filter((x) => !x.toStart);
    return !on.some((x) => !x.approval && !ticked(x)) && on.some((x) => (x.approval ? x.holds : ticked(x)));
}
