// GEML reference parser — chart-from-table (§7 geml-chart renderer).
//
// A `diagram {format=geml-chart data=#id ...}` binds to a table and is drawn
// from a closed set of encoding channels (x, y, series, size). `type` only
// changes how those channels are drawn; it never adds new attributes. The
// processor validates the attributes against the referenced table's model and
// normalizes the selected rows into a dataset for a renderer. See the design
// doc and §7.
const TYPES = new Set(["bar", "line", "area", "pie", "scatter"]);
// Channels each type can use; supplying any other is a warning (ignored).
// Exported for the record-array projection (GEP-0005): it must validate only
// the channels the chart TYPE actually reads, matching buildChart's leniency
// (an unused channel is a warning here, so it must not be an error there).
export const USES = {
    bar: new Set(["x", "y", "series"]),
    line: new Set(["x", "y", "series"]),
    area: new Set(["x", "y", "series"]),
    scatter: new Set(["x", "y", "series", "size"]),
    pie: new Set(["x", "y"]),
};
function str(v) {
    return v === undefined ? undefined : typeof v === "string" ? v : String(v);
}
export function buildChart(attrs, table) {
    const diagnostics = [];
    const err = (code, m) => diagnostics.push({ severity: "error", code, message: m });
    const warn = (code, m) => diagnostics.push({ severity: "warning", code, message: m });
    const fail = () => ({ model: null, diagnostics });
    const typeRaw = str(attrs["type"]);
    if (!typeRaw) {
        err("chart-missing-type", "chart: missing `type`");
        return fail();
    }
    if (!TYPES.has(typeRaw)) {
        err("chart-unknown-type", `chart: unknown type \`${typeRaw}\` (supported: bar, line, area, pie, scatter; use format=vega-lite for others)`);
        return fail();
    }
    const type = typeRaw;
    // Validate rows scope up front so a bad value is reported even when a column
    // name is also wrong.
    const rowsAttr = (str(attrs["rows"]) ?? "data");
    if (!["data", "all", "summary"].includes(rowsAttr)) {
        err("chart-unknown-rows-scope", `chart: unknown rows scope \`${rowsAttr}\` (data|all|summary)`);
        return fail();
    }
    const x = str(attrs["x"]);
    const yRaw = str(attrs["y"]);
    if (!x)
        err("chart-missing-channel", "chart: missing required channel `x`");
    if (!yRaw)
        err("chart-missing-channel", "chart: missing required channel `y`");
    if (!x || !yRaw)
        return fail();
    let y = yRaw.split(",").map((s) => s.trim()).filter((s) => s !== "");
    if (y.length === 0) {
        err("chart-empty-channel", "chart: `y` lists no columns");
        return fail();
    }
    // Wrong-channel warnings (channel present but unused by this type).
    if (attrs["size"] !== undefined && !USES[type].has("size"))
        warn("chart-unused-channel", `chart: \`size\` is ignored for type \`${type}\``);
    if (attrs["series"] !== undefined && !USES[type].has("series"))
        warn("chart-unused-channel", `chart: \`series\` is ignored for type \`${type}\``);
    if (type === "pie" && y.length > 1) {
        warn("chart-unused-channel", "chart: pie uses a single `y`; extra columns ignored");
        y = [y[0]];
    }
    // Optional channels, only when used by this type.
    const series = USES[type].has("series") ? str(attrs["series"]) : undefined;
    const size = USES[type].has("size") ? str(attrs["size"]) : undefined;
    // Resolve columns by header name (x, y, and any used optional channels).
    const idx = (name) => table.columns.indexOf(name);
    for (const name of [x, ...y, ...(series ? [series] : []), ...(size ? [size] : [])]) {
        if (idx(name) < 0)
            err("chart-unknown-column", `chart: column \`${name}\` not found in table`);
    }
    if (diagnostics.some((d) => d.severity === "error"))
        return fail();
    // Select rows per scope.
    let picked;
    if (rowsAttr === "summary") {
        if (!table.summary) {
            err("chart-missing-summary-row", "chart: rows=summary but the table has no summary row");
            return fail();
        }
        picked = [table.summary];
    }
    else if (rowsAttr === "all") {
        if (!table.summary)
            warn("chart-summary-row-unavailable", "chart: rows=all but the table has no summary row; using data rows");
        picked = table.summary ? [...table.rows, table.summary] : table.rows;
    }
    else {
        picked = table.rows;
    }
    // Normalize: x text + numeric y/size columns; series text. A non-empty
    // non-numeric value in a numeric column is always an error; a row with an
    // empty numeric cell is skipped (no data point).
    const numCols = [...y, ...(size ? [size] : [])];
    const xi = idx(x);
    const si = series ? idx(series) : -1;
    const numIs = numCols.map(idx);
    const categories = [];
    const numbers = {};
    const seriesOf = [];
    for (const c of numCols)
        numbers[c] = [];
    for (const row of picked) {
        const cells = numIs.map((i) => row[i]);
        if (cells.some((cell) => (cell?.text ?? "") !== "" && typeof cell?.value !== "number")) {
            err("chart-non-numeric-value", "chart: non-numeric value in a y column");
            return fail();
        }
        if (cells.some((cell) => (cell?.text ?? "") === ""))
            continue;
        categories.push(row[xi]?.text ?? "");
        numIs.forEach((i, j) => numbers[numCols[j]].push(row[i].value));
        if (series)
            seriesOf.push(row[si]?.text ?? "");
    }
    const dataRef = (str(attrs["data"]) ?? "").replace(/^#/, "");
    const dataset = { categories, numbers };
    if (series)
        dataset.seriesOf = seriesOf;
    const model = { type, x, y, rows: rowsAttr, dataRef, dataset };
    if (series)
        model.series = series;
    if (size)
        model.size = size;
    return { model, diagnostics };
}
