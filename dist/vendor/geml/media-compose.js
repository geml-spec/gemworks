// 合成的几何（设计记录 §16.8）：层怎么放，点怎么变换，连接怎么把一层放到另一层的点上。
//
// 这份逻辑 check 和 compose 各用一次 —— 同一份，不是两份：check 据此报"位置冲突""缺 size"
// "两点合成后分开了"，compose 据此算 overlay 的坐标。两处各算各的，迟早一处对一处错。
//
// 和 media-check / media-verbs 一样不碰 node:*（geml-viewer 会把它打进浏览器包）。
import { MEDIA_APART_PX } from "./bounds.js";
const num = (v) => {
    if (v === undefined || v === null || v === "")
        return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
};
/** `"hand:562,522 eyes:290,300"` → Map。写坏的条目跳过：点是可选的，坏一个不该让整份素材失效。 */
export function parsePoints(v) {
    const out = new Map();
    if (typeof v !== "string")
        return out;
    for (const item of v.trim().split(/\s+/)) {
        const m = /^([A-Za-z0-9_-]+):(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(item);
        if (m !== null)
            out.set(m[1], { x: Number(m[2]), y: Number(m[3]) });
    }
    return out;
}
/** 角色 / 场景块上声明的点名：`"hand eyes feet"`。没声明返回 null（不查）。 */
export function parsePointNames(v) {
    if (typeof v !== "string" || v.trim() === "")
        return null;
    return new Set(v.trim().split(/\s+/));
}
export function parseSize(v) {
    if (typeof v !== "string")
        return undefined;
    const m = /^(\d+)x(\d+)$/.exec(v.trim());
    return m === null ? undefined : { w: Number(m[1]), h: Number(m[2]) };
}
export function parseXywh(v) {
    if (typeof v !== "string")
        return undefined;
    const p = v.split(",").map((s) => Number(s.trim()));
    if (p.length !== 4 || p.some((n) => !Number.isFinite(n)))
        return undefined;
    return { x: p[0], y: p[1], w: p[2], h: p[3] };
}
/** `#layer:point` → 两半。别的形状一律 null。 */
export function parseEnd(v) {
    if (typeof v !== "string")
        return null;
    const m = /^#([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/.exec(v.trim());
    return m === null ? null : { layer: m[1], point: m[2] };
}
/** 从层块与它引用的素材块的属性建 spec。素材缺失时传空属性：点为空，之后自然报引不到点。 */
export function layerSpec(id, index, attrs, assetAttrs) {
    const spec = { id, index, dx: num(attrs["dx"]) ?? 0, dy: num(attrs["dy"]) ?? 0, points: parsePoints(assetAttrs["points"]) };
    const x = num(attrs["x"]);
    if (x !== undefined)
        spec.x = x;
    const y = num(attrs["y"]);
    if (y !== undefined)
        spec.y = y;
    const w = num(attrs["w"]);
    if (w !== undefined)
        spec.w = w;
    const crop = parseXywh(attrs["xywh"]);
    if (crop !== undefined)
        spec.crop = crop;
    const size = parseSize(assetAttrs["size"]);
    if (size !== undefined)
        spec.size = size;
    if (attrs["flip"] === "h")
        spec.flip = "h";
    return spec;
}
/** 源图（裁切后）多宽：有裁切用裁切宽，否则用素材的 size=。答不上来是 undefined。 */
export const widthOf = (l) => l.crop?.w ?? l.size?.w;
/** 缩放比例。有 w 没 crop 也没 size 时答不上来 —— 返回 null，调用方报 size-required。 */
export function scaleOf(l) {
    if (l.w === undefined)
        return 1;
    const srcW = widthOf(l);
    if (srcW === undefined || srcW <= 0)
        return null;
    return l.w / srcW;
}
/** 一个点在这一层"自己的"坐标里：裁切后的位置，翻转过就从右边量。 */
export function localPoint(l, p) {
    const cx = l.crop?.x ?? 0;
    const cy = l.crop?.y ?? 0;
    let lx = p.x - cx;
    if (l.flip === "h") {
        const srcW = widthOf(l);
        if (srcW !== undefined)
            lx = srcW - lx;
    }
    return { x: lx, y: p.y - cy };
}
/** 源图上的一个点落在画布的哪里。 */
export function canvasPoint(l, pos, p, s) {
    const lp = localPoint(l, p);
    return { x: pos.x + lp.x * s, y: pos.y + lp.y * s };
}
/**
 * 逐条连接放层。规矩只有三条（§16.8）：文档里排在后面的层是自由的；一个层只有第一条连接
 * 定位置，其余只验不动；由连接定位的层不能再写 x y（contact 两个都不能，gaze 只管 y）。
 * 连接的两端已由调用方解析过（层在、点在）；这里不再报"引不到"。
 */
export function solveLayout(layers, interactions) {
    const byId = new Map(layers.map((l) => [l.id, l]));
    const pos = new Map();
    for (const l of layers)
        pos.set(l.id, { x: l.x ?? 0, y: l.y ?? 0 });
    const placedBy = new Map();
    const problems = [];
    const sized = new Set();
    const needWidth = (l, why) => {
        if (sized.has(l.id))
            return;
        sized.add(l.id);
        problems.push({ code: "size-required", id: l.id, message: `层 #${l.id} ${why}，却既没有裁切也没有素材的 size=：算不出来，给素材写上 size=宽x高` });
    };
    const scale = (l) => {
        const s = scaleOf(l);
        if (s !== null) {
            if (l.flip === "h" && widthOf(l) === undefined)
                needWidth(l, "翻转了（点要从右边量）");
            return s;
        }
        needWidth(l, "有 w=（点要随 w 缩放）");
        return 1;
    };
    const verify = [];
    for (const it of interactions) {
        const la = byId.get(it.a.layer);
        const lb = byId.get(it.b.layer);
        if (la === undefined || lb === undefined)
            continue;
        const [free, fixed, freeEnd, fixedEnd] = la.index > lb.index ? [la, lb, it.a, it.b] : [lb, la, it.b, it.a];
        if (placedBy.has(free.id)) {
            verify.push(it);
            continue;
        }
        const conflict = it.kind === "contact" ? (free.x !== undefined || free.y !== undefined) : free.y !== undefined;
        if (conflict) {
            problems.push({ code: "position-conflict", id: free.id, message: `层 #${free.id} 写了 ${it.kind === "contact" ? "x/y" : "y"}，又被 #${it.id} 定位置：二选一，微调用 dx dy` });
            verify.push(it);
            continue;
        }
        const pf = free.points.get(freeEnd.point);
        const pt = fixed.points.get(fixedEnd.point);
        if (pf === undefined || pt === undefined)
            continue;
        const target = canvasPoint(fixed, pos.get(fixed.id), pt, scale(fixed));
        const s = scale(free);
        const lp = localPoint(free, pf);
        const cur = pos.get(free.id);
        const next = it.kind === "contact"
            ? { x: target.x - lp.x * s + free.dx, y: target.y - lp.y * s + free.dy }
            : { x: cur.x, y: target.y - lp.y * s + free.dy };
        pos.set(free.id, next);
        placedBy.set(free.id, it.id);
    }
    for (const it of verify) {
        const la = byId.get(it.a.layer);
        const lb = byId.get(it.b.layer);
        const pa = la.points.get(it.a.point);
        const pb = lb.points.get(it.b.point);
        if (pa === undefined || pb === undefined)
            continue;
        const ca = canvasPoint(la, pos.get(la.id), pa, scale(la));
        const cb = canvasPoint(lb, pos.get(lb.id), pb, scale(lb));
        const d = it.kind === "contact" ? Math.hypot(ca.x - cb.x, ca.y - cb.y) : Math.abs(ca.y - cb.y);
        if (d > MEDIA_APART_PX) {
            problems.push({ code: "apart", id: it.id, message: `#${it.id}：${it.a.layer}:${it.a.point} 与 ${it.b.layer}:${it.b.point} 合成后${it.kind === "gaze" ? "高度" : ""}差 ${Math.round(d)} 像素 —— 它们的位置由更早的连接或写死的 x y 定了，这一条只验不动` });
        }
    }
    return { pos, placedBy, problems };
}
