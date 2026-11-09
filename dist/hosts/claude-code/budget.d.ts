/**
 * The desktop draws and presses a pane of some 1,500 elements and none past
 * it: the person's test pages on 2026-10-23 drew 1,476 elements fine and
 * 1,676 not, however few of them were buttons (800 plain buttons drew fine).
 * The board keeps its body under BODY_NODES and says what it left out.
 */
/** The most elements the board's body draws on a surface that draws pictures. */
export declare const BODY_NODES = 1100;
/** The elements in a drawn tree: each element and those under it; strings, numbers and nothing are not elements. */
export declare function elementsIn(node: unknown): number;
/** The text size a tab's body is drawn at: one step under the surface's body text, so more of a tab fits. */
export declare const BODY_SIZE = "footnote";
/**
 * A drawn tree one text size down: each Text with no size of its own drawn at BODY_SIZE (a Text inside one keeps
 * following it), and a button with only a label given that label as such a Text, since a button's label has no size.
 * The terminal has one size and is not asked.
 */
export declare function stepDown(node: unknown, inText?: boolean): unknown;
/** The leading items whose elements fit in `budget`, how many were left out, and the elements drawn. */
export declare function fitToBudget<T>(items: readonly T[], budget?: number): {
    kept: T[];
    left: number;
    drawn: number;
};
