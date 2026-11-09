// GEML reference parser — the diagnostic catalogue (spec Appendix A).
//
// Every diagnostic a conforming parser emits carries a STABLE `code` in
// addition to its human-readable `message`. The message is prose: it may be
// reworded, translated, or given more context between releases. The code is
// the contract — it is what a conformance test, an editor integration, or a CI
// gate matches on, and it is what the specification's Appendix A enumerates.
//
// `DiagnosticCode` below is the single source of truth: it is a closed union,
// so a misspelled or unregistered code is a compile error, and the spec's
// catalogue can be checked against this list mechanically.
/**
 * Prefixes of the codes Appendix A does not list, by its own rule: conditions
 * the specification does not define. The catalogue drift guard skips them, and
 * requires that Appendix A never documents one.
 */
export const CATALOGUE_EXEMPT = ["markdown-", "form-"];
// The severity each code is emitted with. The specification fixes severity per
// code (Appendix A), so this table is normative, not advisory: a second
// implementation reporting `unknown-block-type` as an error does not conform.
export const SEVERITY = {
    "unterminated-block": "error",
    "unknown-block-type": "warning",
    "unknown-attribute": "warning",
    "block-nesting-too-deep": "error",
    "list-nesting-too-deep": "error",
    "inline-nesting-too-deep": "error",
    "stray-labeled-fence": "warning",
    "fence-like-line": "warning",
    "unresolvable-code-source": "warning",
    "bad-code-source": "error",
    "bad-source-range": "error",
    "code-src-and-body": "error",
    // A warning, not an error: this has always parsed, and documents rely on the
    // leniency. What the author is missing is that it parsed as something else.
    "name-not-a-name": "warning",
    // Same leniency and the same reason: the heading parsed — as something the
    // author did not write, with the id they meant to address missing.
    "heading-attrs-trailing-text": "warning",
    "heading-attrs-unclosed": "warning",
    "duplicate-id": "error",
    "duplicate-name": "error",
    "unresolved-reference": "error",
    "unresolved-footnote": "error",
    "unresolved-cross-document-reference": "error",
    "unresolvable-document": "error",
    "unchecked-cross-document-reference": "warning",
    "embed-missing-src": "error",
    "ignored-embed-body": "warning",
    "transclusion-cycle": "error",
    "embed-target-not-geml": "error",
    "embed-target-not-projectable": "error",
    "media-target-is-document": "error",
    "inline-transclusion-not-inline": "error",
    "unsafe-embed-scheme": "error",
    "unresolvable-table-source": "error",
    "unknown-metadata-reference": "error",
    "duplicate-meta-key": "warning",
    "reserved-id": "error",
    "table-src-and-body": "error",
    "unknown-table-format": "warning",
    "bad-table-delimiter": "error",
    "bad-embed-part": "warning",
    "ignored-table-delimiter": "warning",
    "ragged-table-row": "warning",
    "table-too-large": "error",
    "bad-compute-formula": "error",
    "compute-error": "error",
    "compute-non-numeric-cell": "warning",
    "compute-not-a-number": "warning",
    "bad-summary-entry": "error",
    "summary-unknown-column": "error",
    "summary-error": "error",
    "view-missing-src": "error",
    "view-src-and-body": "error",
    "table-source-is-block": "error",
    "view-source-not-a-relation": "error",
    "view-source-cycle": "error",
    "view-source-too-deep": "error",
    "view-where-error": "error",
    "view-numeric-column-required": "error",
    "view-unknown-column": "error",
    "view-order-error": "error",
    "view-limit-error": "error",
    "view-select-expression": "error",
    "summary-projected-away": "error",
    "circular-view-filter": "error",
    "shadowed-source-column": "warning",
    "grouping-compute-aggregate": "error",
    "bad-aggregate-entry": "error",
    "aggregate-error": "error",
    "aggregate-without-by": "error",
    "unknown-diagram-format": "warning",
    "ignored-diagram-body": "warning",
    "code-graph-missing-src": "warning",
    "code-graph-unresolvable-document": "warning",
    "chart-missing-data": "error",
    "chart-data-not-a-table": "error",
    "chart-missing-type": "error",
    "chart-unknown-type": "error",
    "chart-unknown-rows-scope": "error",
    "chart-missing-channel": "error",
    "chart-empty-channel": "error",
    "chart-unknown-column": "error",
    "chart-unused-channel": "warning",
    "chart-missing-summary-row": "error",
    "chart-summary-row-unavailable": "warning",
    "chart-non-numeric-value": "error",
    "chart-data-not-records": "error",
    "data-parse": "error",
    "inexact-number": "warning",
    "unknown-data-format": "warning",
    "data-format-no-engine": "warning",
    "bad-data-schema": "error",
    "data-src-and-body": "error",
    "bad-data-source": "error",
    "unresolvable-data-source": "error",
    // A declared vocabulary this processor does not ship. Warning, and for the
    // reason `data-format-no-engine` is one: the document is well formed and it
    // is this reader that cannot see all of it (§8.6.2 rule 3).
    "unrecognized-vocabulary": "warning",
    // A meta key no declared vocabulary owns, in a document where at least one
    // vocabulary DID declare its keys. Warning, like `unknown-attribute`: the
    // document parses and means what it says; what it probably is, is a typo.
    "unknown-meta-key": "warning",
    // A wikilink to a note not found under the resolution root. Warning: in a
    // vault that is how a note is planned — Obsidian creates it on first click.
    "markdown-unresolved-wikilink": "warning",
    "form-child-outside-form": "error",
    "form-field-missing-name": "error",
    "form-duplicate-name": "error",
};
// ---------------------------------------------------------------------------
// Source normalization (spec §0)
// ---------------------------------------------------------------------------
// A conforming parser normalizes its input before scanning:
//
//   1. a single leading BOM (U+FEFF) is removed;
//   2. every line ending (CRLF, or a lone CR) becomes LF;
//   3. U+0000 becomes U+FFFD.
//
// All three preserve the LINE COUNT, which is what lets `blockSpans` index the
// original bytes by line: normalization only ever rewrites bytes *within* a
// line, never splits or joins one. (1) only touches the first line's leading
// bytes; (3) is a same-line substitution; (2) is per-line trailing bytes, and
// splitting on the normalized LF yields exactly the lines the original had.
export function normalizeSource(source) {
    const noBom = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
    return noBom.replace(/\r\n?/g, "\n").replace(/\0/g, "�");
}
