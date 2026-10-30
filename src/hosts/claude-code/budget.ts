/**
 * The desktop draws and presses a pane of some 1,500 elements and none past
 * it: the person's test pages on 2026-10-23 drew 1,476 elements fine and
 * 1,676 not, however few of them were buttons (800 plain buttons drew fine).
 * The board keeps its body under BODY_NODES and says what it left out.
 */

/** The most elements the board's body draws on a surface that draws pictures. */
export const BODY_NODES = 1_100;

/** The elements in a drawn tree: each element and those under it; strings, numbers and nothing are not elements. */
export function elementsIn(node: unknown): number {
  if (node === null || typeof node !== "object") return 0;
  if (Array.isArray(node)) return node.reduce((n: number, x: unknown) => n + elementsIn(x), 0);
  const el = node as { children?: unknown; props?: { children?: unknown } };
  return 1 + elementsIn(el.children ?? el.props?.children ?? []);
}

/** The text size a tab's body is drawn at: one step under the surface's body text, so more of a tab fits. */
export const BODY_SIZE = "footnote";

/**
 * A drawn tree one text size down: each Text with no size of its own drawn at BODY_SIZE (a Text inside one keeps
 * following it), and a button with only a label given that label as such a Text, since a button's label has no size.
 * The terminal has one size and is not asked.
 */
export function stepDown(node: unknown, inText = false): unknown {
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((x) => stepDown(x, inText));
  const el = node as { type?: unknown; props?: Record<string, unknown>; children?: unknown[] };
  if (el.type === "Text") {
    const children = el.children?.map((x) => stepDown(x, true));
    return { ...el, ...(inText || el.props?.["size"] !== undefined ? {} : { props: { ...el.props, size: BODY_SIZE } }), ...(children !== undefined ? { children } : {}) };
  }
  if (el.type === "Button" && (el.children === undefined || el.children.length === 0) && typeof el.props?.["label"] === "string" && el.props["label"] !== "") {
    return { ...el, children: [{ type: "Text", props: { size: BODY_SIZE }, children: [el.props["label"]] }] };
  }
  return el.children !== undefined ? { ...el, children: el.children.map((x) => stepDown(x, inText)) } : el;
}

/** The leading items whose elements fit in `budget`, how many were left out, and the elements drawn. */
export function fitToBudget<T>(items: readonly T[], budget: number = BODY_NODES): { kept: T[]; left: number; drawn: number } {
  let drawn = 0;
  for (let k = 0; k < items.length; k++) {
    const n = elementsIn(items[k]);
    if (drawn + n > budget) return { kept: items.slice(0, k), left: items.length - k, drawn };
    drawn += n;
  }
  return { kept: [...items], left: 0, drawn };
}
