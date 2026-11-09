// 应用层 profile 的词汇表注册表。机制本身是规范性的，见 GEML-spec §8.6
// 「Application-layer vocabularies」；这个文件只是本实现认识哪几份词汇表。
//
// 一份文档在 `=== meta` 里用 `profile = "<name> …"`（空格分隔的列表，
// 因为 §4 不支持数组）声明它使用哪些应用层词汇表。声明之后，那些块类型不再算
// `unknown-block-type`，那些属性键不再算 `unknown-attribute`。
//
// 这不改规范：§8.6 定义了机制，§8.5 明写 "The type registry (§3) is **open**"，§8.2(6) 约束的是
// 处理器*不认识*的类型必须降级。一个处理器通过 profile 认识了更多名字，完全合规。
//
// 为什么这个模块必须存在，而不是在 geml.ts 里多写几个 if：在它之前，codemap 的
// `anchor`/`name`/`entry-via` 硬编码在核心的属性校验表里，后果是这三个键在**任何
// 文档的任何 code 块**上都静默通过 —— 全世界每份 GEML 文档都永久让出了它们的
// 拼写检查，只为一个应用的清净。而且 §8.4 的一致性面被污染：第二实现要么复刻
// codemap 的词汇表，要么报出参考实现不报的 warning。
//
// 同样的理由排除了"旧产物兼容探测"（认 `resolution-default` 为隐式声明）：那是
// 同一类实现特定知识，第二实现照样得复刻它。旧图重新 build 一次即可。
//
// 范围（GEP-0013 之后）：profile 放行名字，**并且**为它放行的类型声明 body 模式。
// 不认识这份词汇表的处理器把那些正文一律当 raw，并报出 `unrecognized-vocabulary`
// —— 规则 4 之所以能给这个例外，靠的就是规则 3 要求把这件事说出来。没声明 body
// 的类型照旧 raw。
import { MEDIA_SEVERITY } from "./media-diagnostics.js";
import { STYLE_SEVERITY } from "./style-diagnostics.js";
// 名字统一以 `geml-` 起头，好一眼认出这是本项目自己出的词汇表，而不是第三方的。
// 改名此刻是免费的：profile 机制落在 46eb5fd（2026-08-30），晚于 1.8.8 发布，
// 而 1.9.0 尚未 publish —— 没有任何已发布产物声明过旧名字。
export const PROFILES = {
    // spec/profiles/geml-codemap/geml-codemap-profile.md
    "geml-codemap/v1": {
        verbs: ["codemap"],
        state: "stable", since: "1.9.0",
        attrs: { code: ["anchor", "name", "entry-via"] },
    },
    // spec/profiles/geml-translator/geml-translator-profile.md — GEP 0010.
    // A translated document is a projection: `=== embed` blocks carrying the axis
    // (`translate-to=`, on the embed or as the document default on `=== meta`,
    // with `none` holding one block back), plus an optional `glossary` meta key
    // naming a hidden table. §8.6.1 lists attribute keys among the three things a
    // vocabulary may admit, so this needs no specification change.
    //
    // `translate-to` and not `lang`: on `code`, `lang=` names a PROGRAMMING language
    // and is a statement about what the body is. Here it would name a natural
    // language and be an INSTRUCTION about what to do with it — two value spaces and
    // two word classes under one key. `translate-to=` is a verb and cannot be read
    // as either of the other two.
    //
    // `translate-to` is the whole vocabulary: on `=== meta` it is the document's
    // default and on an `embed` it overrides that, with `none` holding one back.
    // There is no key for WHICH ENGINE — there is one engine, so a key selecting
    // among engines would parse, do nothing, and read as supported. `translator=`
    // is reserved for when there is a second.
    //
    // There is no `except=`. An earlier draft had one — a list of ids to leave
    // alone inside a section embed — and the document default removed the need for
    // it: a mosaic of one embed per unit now costs almost nothing to write, so an
    // exception is `translate-to=none` on the one embed that means it. A second
    // spelling for the same intent would also have needed a core diagnostic, since
    // a typo in such a list draws only `unknown attribute` and never an unresolved
    // reference — silence, in a vocabulary whose purpose is to remove it.
    "geml-translator/v1": {
        state: "draft", since: "1.10.0",
        attrs: { embed: ["translate-to"] },
    },
    // spec/profiles/geml-style/geml-style-profile.md
    "geml-style/v1": {
        verbs: ["style"],
        state: "draft", since: "1.9.0",
        // metaKeys 故意不声明：样式表的 `=== meta` 是一张**作者自定义的 token 表**
        // （`{{accent}}` 这样引用），和它的属性空间开放是同一个理由——核心不可能持有
        // 那份词典。声明一个闭集会把每个 token 报成拼错的键。
        // 八个码里七个不带 `style-` 前缀，违反本层的命名约定（README「Naming」）。
        // 引用检查器自己的那张表而不是抄一遍——同一份事实抄两处，上游一动就漂。
        diagnostics: STYLE_SEVERITY,
        types: ["style-rule", "style-state", "style-screen", "style-frame"],
    },
    // spec/profiles/geml-form/geml-form-profile.md — GEP 0008 (draft).
    // The form-* family itself is the specification's (a body mode and an id scope
    // need §3's registry); the CONSTRAINTS on a field need neither, so they ride
    // here as attribute keys: declared, stored, never evaluated (§9.1). Until
    // form-field is a registered type these keys have nothing to attach to, and
    // admitting them is inert.
    "geml-form/v1": {
        state: "draft", since: "1.10.0",
        // GEP-0008's structural rules, held here with the family until the GEP
        // lands in §3 — as the profile's §1.1 says of the attribute keys: a
        // `form-*` block is meaningful only inside a `form` (geml.ts checkFormChild),
        // and a field carries a `name=` no other field of its form carries
        // (checkFieldName) — the key a handler receives and a coordinate addresses.
        diagnostics: { "form-child-outside-form": "error", "form-field-missing-name": "error", "form-duplicate-name": "error" },
        // 类型进来了：在 GEP-0008 落到 §3 的核心注册表之前，声明了这个 profile 的文档就能用
        // form-* 家族 —— 和 geml-style 用同一条路。不声明的文档照旧 unknown-block-type。
        types: ["form", "form-field", "form-group", "form-options", "form-note"],
        // form 和 form-group 是容器：`==== form` 里套 form-field（GEP-0008 §6）。
        bodies: { form: "flow", "form-group": "flow" },
        // 这几张表现在**会被执行**（属性检查按类型 opt-in）。所以它们必须完整，否则
        // GEP-0008 自己的例子会逐键报未知。键的归属是分开的，写在这里只是因为类型还
        // 住在 profile 里：
        //   · 六个约束键（pattern/min/max/step/maxlength/accept）是**这份 profile 的**；
        //   · 其余是 **GEP-0008 的**（name/label/description/placeholder/type/required/
        //     multiple/value/options，form 的 handler，form-options 的表体键）。
        // GEP-0008 一旦落进 §3，后者应当搬到核心的类型表里，这里只留前六个。
        attrs: {
            "form-field": [
                "pattern", "min", "max", "step", "maxlength", "accept",
                "name", "label", "description", "placeholder", "type", "required", "multiple", "value", "options",
            ],
            form: ["handler"],
            "form-group": ["label", "description", "required"],
            // 体是一张 value/label 表（GEP-0008 §6），所以收表体那几个键。此前这几个键
            // 写在核心的 validRe 分支里，而那条分支永远走不到 —— form-options 不在核心
            // REGISTRY 里，profile 类型在它之前就 return 了。
            "form-options": ["format", "delim", "header", "src"],
        },
    },
    // spec/profiles/geml-media/geml-media-profile.md —— 素材、剪辑与生成血缘。
    //
    // 三个类型，不是两个：`media-text` 是剧本层的散文块（外貌、提示词、台词），
    // 它就是「`text` 加五个键」。为什么不直接在核心 `text` 上放行那五个键：那样键
    // 跟着**文档**走，声明了 profile 的文档里每个 `text` 块都合法；挂在自己的类型上
    // 则跟着**类型**走。代价是核心把 `text` 当特权类型的那几处要认得它 —— 所以有
    // `prose`，没有它 `![[#hero-look]]` 这样的投射会直接报
    // inline-transclusion-not-inline，而那是这份 profile 最核心的机制。
    //
    // 属性表是**闭集**（登记了 attrs 就会被查拼写）。这三个类型的键全部来自设计稿
    // §5，按第一个真实用例跑过一遍。
    "geml-media/v1": {
        verbs: ["media"],
        state: "draft", since: "1.10.3",
        // 六个 meta 键都不带 `media-` 前缀，违反命名约定；`fps` 和 `aspect` 尤其是
        // 第二份 profile 会想要的通用词。登记以让测试拦得住新增的同类。
        metaKeys: ["aspect", "target-duration", "episode"],
        diagnostics: MEDIA_SEVERITY,
        types: ["media", "media-asset", "media-clip", "media-text", "media-comp", "media-layer", "media-interaction"],
        // `media-interaction` 也是散文：头行是几何（谁的哪个点碰谁的哪个点），body 是这一步发生了
        // 什么 —— 人按步读，写实的精修拿它当提示词（§16.8）。
        prose: ["media-text", "media-interaction"],
        // `media` 是容器：`==== media` 里套 `media-clip`。无体的 `media` 是一个可播的单源。
        // `media-comp` 同形：`==== media-comp` 里套 `media-layer`（设计记录 §16）。
        bodies: { media: "flow", "media-comp": "flow" },
        attrs: {
            // §5.0 一段可播的东西，两种形态由**形状**分，不由属性分 —— 和 `<video>` 一样：
            // `<video src>` 是单源，`<video><source></video>` 是它的孩子说了算。
            //   **有体**＝装配：`tracks` `primary` `fps` 三个键，片段住在体里。
            //   **无体 + src=**＝单源：`src` `in` `out` `duration`，它就是「只有一个片段的
            //   时间线」，下游一条代码都不用分叉。
            // 两组互斥，`check` 会管。画面比例不在这儿（那是呈现，归样式表），种类也不在
            // （从被引的 `media-asset` 读，同一件事不写两遍）。
            media: ["tracks", "primary", "fps", "src", "in", "out", "duration"],
            // §5.1 一个文件。`of` 说这份素材画的是谁，`role` 说它在生成里当什么用 ——
            // 没有这两个，「林夏的三视图是哪张」只能靠文件名猜。
            // `points`（§16.8）：这张图上的点，源坐标 —— `"hand:562,522 eyes:290,300"`。
            "media-asset": ["src", "sha256", "kind", "duration", "fps", "size",
                "origin", "license", "mime", "of", "role", "points"],
            // §5.2 一个片段。`track` 必填，轨道的种类由所属 `media` 的 `tracks=` 给出。
            "media-clip": ["track", "src", "in", "out", "duration", "over", "offset", "at",
                "transition-in", "transition-out", "transition-duration",
                "gain", "fade-in", "fade-out", "speed", "xywh"],
            // §5.4 剧本层。`speaker` 必填；`shot` 把提示词钉到分镜表的镜号上。`points` 在角色 /
            // 场景的 `.look` 上声明点的**名字**（坐标在素材上）—— 标题节上的同名属性核心本来不查。
            "media-text": ["shot", "speaker", "to", "emotion", "since", "points"],
            // §16 一张合成的画面：`size` 是画布，是这张图的事实而不是呈现。`shot` 同 `.prompt`。
            // `at`（§16.8.1）：这一帧在镜头里的时刻；同 shot 的几个 comp 按它排成序列。
            "media-comp": ["shot", "size", "at"],
            // §16 一层：先裁（`xywh`，与 `media-clip` 同一把尺）、再缩（`w`，等比）、再翻
            // （`flip=h`）、再放（`x` `y`，左上角）。层序是文档顺序，所以没有 `z`。
            // `dx` `dy`：位置由连接定了之后的微调（§16.8）。
            "media-layer": ["src", "xywh", "w", "x", "y", "flip", "dx", "dy"],
            // §16.8 一条连接：`a` `b` 是 `#层:点`，`kind` 是 contact（重合）或 gaze（对上）。
            "media-interaction": ["a", "b", "kind"],
        },
    },
    // spec/profiles/geml-history/geml-history-profile.md
    // （语义是规范性的，在 spec/profiles/geml-history/geml-history-profile.md）—— `.gemlhistory` 边车自己的词汇表。它是一份
    // 姊妹**规范**的产物，不是第三方扩展，但同样必须声明：核心注册表只认 §3 的
    // 九个类型，所以在此之前这个项目写出的每一个 .gemlhistory 都固定吃三条
    // unknown-block-type（全库 333 处）。属性键取自规范的块定义，并与语料逐一核对。
    "geml-history/v1": {
        verbs: ["history"],
        state: "stable", since: "1.9.0",
        // §8.5 asks an extension for hyphenated names, so these carry the profile's
        // own prefix the way `style-rule` carries geml-style's. The bare `revision`
        // / `keyframe` / `blob` they replace are not read: an unhyphenated name this
        // specification does not define squats space reserved for future versions of
        // it, and keeping a second spelling alive would have been the squatting.
        types: ["history-revision", "history-keyframe", "history-blob"],
        attrs: {
            "history-revision": ["id", "parent", "author", "summary", "hash", "newline"],
            "history-keyframe": ["id", "hash"],
            "history-blob": ["lang"],
        },
    },
    // spec/profiles/geml-statechart/geml-statechart-profile.md — a statechart in
    // one `diagram` block. The vocabulary admits the format name and the
    // `current=` attribute on that block, nothing else: the body is raw to the
    // core either way (§8.6.1), and the renderer that reads the JSON, the
    // `statechart-*` checks and the Markdown projection are the format's own.
    "geml-statechart/v1": {
        // `since` 留空：还没随任何解析器版本发出去。
        state: "draft",
        attrs: { diagram: ["current"] },
        formats: ["geml-statechart"],
        diagnostics: {
            "statechart-body": "error",
            "statechart-initial": "error",
            "statechart-state": "error",
            "statechart-transition": "error",
            "statechart-guard": "error",
            "statechart-actions": "error",
            "statechart-vars": "error",
            "statechart-current": "error",
            "statechart-unreachable": "warning",
        },
    },
};
// ---------------------------------------------------------------------------
// 运行时注册（默认关）
// ---------------------------------------------------------------------------
//
// `PROFILES` 是编译期常量，所以在此之前「处理器认识哪些词汇表由实现自定」
// （§8.6.2 规则 3）在实践中等于「fork 这个解析器」。这合规，但它把生态的上限
// 锁死在这个仓发了什么。
//
// 开关默认**关**，而且这是有意的：一个宿主注册了词汇表，它的诊断就和别的宿主
// 不同——规则 1 本来就允许这件事（它整条都是在说诊断随处理器认识什么而不同），
// 但那是**这个宿主的决定**，不该由一次 import 悄悄替它做。所以要显式打开。
//
// 注册**不是**规则 2 禁止的推断：规则 2 禁的是从文档内容、文件名或扩展名去猜一份
// 词汇表。宿主说「我认识这一份」，是宿主在陈述自己的能力，不是在读文档。
let registrationOpen = false;
const RUNTIME = Object.create(null);
/** 打开/关闭运行时注册。默认关；宿主自己决定要不要开。 */
export function enableProfileRegistration(on = true) {
    registrationOpen = on;
    if (!on)
        for (const k of Object.keys(RUNTIME))
            delete RUNTIME[k];
}
/**
 * 注册一份词汇表。要求开关已打开，并且**当场执行命名约定**——名字的形状，以及
 * 它自己的类型、诊断码、meta 键都带自己的前缀。内建的那六份有历史豁免（见
 * `geml-parser/test/profiles.test.mjs` 的 NAMING_EXCEPTIONS）；新来的没有，这是
 * 这条约定唯一能真正拦住东西的地方。
 */
export function registerProfile(name, def) {
    if (!registrationOpen) {
        throw new Error("profile registration is off; call enableProfileRegistration() first");
    }
    if (!/^[a-z][a-z0-9-]*\/v\d+$/.test(name)) {
        throw new Error(`profile name must look like \`thing/v1\`, got \`${name}\``);
    }
    if (Object.hasOwn(PROFILES, name)) {
        throw new Error(`\`${name}\` is built in; a registration may not replace it`);
    }
    const stem = name.replace(/^geml-/, "").replace(/\/v\d+$/, "") + "-";
    const offenders = [
        ...(def.types ?? []),
        ...Object.keys(def.diagnostics ?? {}),
        ...(def.metaKeys ?? []),
    ].filter((n) => !n.startsWith(stem));
    if (offenders.length > 0) {
        throw new Error(`\`${name}\` owns the prefix \`${stem}\`; these do not carry it: ${offenders.join(", ")}`);
    }
    RUNTIME[name] = def;
}
/** 内建的与已注册的，内建优先（注册不得替换内建）。 */
function profileDef(name) {
    return Object.hasOwn(PROFILES, name) ? PROFILES[name] : RUNTIME[name];
}
/** 本处理器此刻认识的全部词汇表名。 */
export function knownProfiles() {
    return [...Object.keys(PROFILES), ...Object.keys(RUNTIME)];
}
/**
 * 一份文档的 meta 决定它放行哪些名字。多个 profile 取**并集** —— 校验只问
 * "这个名字允许吗"，不问"它是什么意思"，所以两个 profile 放行同一个键不是冲突，
 * 是同一个答案说了两遍（§8.6）。
 */
/**
 * 文档声明了、而本处理器不认识的词汇表名（§8.6.2 规则 3，GEP-0013）。
 *
 * 规则 3 从「当作不存在，不是错误也不是警告」改成了「什么也不放行，并且必须报出
 * 来」。报的不是文档的毛病——文档有效——而是**这个读者读不全它**：那些类型的正文
 * 会按 §8.2(6) 当 raw，那个词汇表本会让它们产生的可寻址单元在这里就是没有。规则 4
 * 之所以能放开 body 模式，靠的正是这句话被说出来。
 *
 * `Object.hasOwn` 而不是 `in`：`PROFILES` 是普通对象，`in` 会把 `toString` 这类
 * 原型键认成已注册的词汇表。
 */
/**
 * 一个 `=== meta` 键**落在某份已声明词汇表的命名空间里、而那份词汇表没有声明它**
 * 时，返回那个词汇表名；否则返回 null。
 *
 * 这是 meta 检查唯一正确的形状，而第一版不是。`=== meta` 同时装着两种东西：
 * **文档元数据**（`title`、`chapter`、作者想记的任何事——开放，永远是作者的）和
 * **词汇表参数**（`media-fps` 这种）。对整块做闭集检查会把前者报成拼写错误：实测
 * 本仓的 playground 教程用 `chapter = "6 / 7"`，它不该也不可能被任何词汇表登记。
 *
 * 所以检查的是**命名空间**，不是整块。一份词汇表拥有前缀 `<stem>-`
 * （spec/profiles/README「Naming」），落在那个前缀里的键就该由它登记；不带前缀的
 * 键核心不置一词。
 *
 * 今天这条几乎不发声，而那是诚实的：codemap 与 media 的 meta 键都早于命名约定、
 * 不带前缀，登记在豁免表里。名字改好的那天它自己就开始生效——豁免表因此不只是
 * 一张催办单，它还是这条检查的开关。
 */
export function misnamespacedMetaKey(key, declared) {
    for (const name of declared) {
        const stem = name.replace(/^geml-/, "").replace(/\/v\d+$/, "") + "-";
        if (!key.startsWith(stem))
            continue;
        const owned = profileDef(name)?.metaKeys;
        if (owned !== undefined && !owned.includes(key))
            return name;
    }
    return null;
}
export function unrecognizedVocabularies(meta) {
    return (meta.get("profile") ?? "")
        .split(/\s+/)
        .filter((name) => name.length > 0 && profileDef(name) === undefined);
}
/**
 * 文档声明了、而且**本处理器认识**的词汇表名。`unrecognizedVocabularies` 的补集，
 * 供需要按 profile 做事的宿主用：跑哪几份词汇表的检查，由文档的 `=== meta` 说了算。
 */
export function declaredVocabularies(meta) {
    return (meta.get("profile") ?? "")
        .split(/\s+/)
        .filter((name) => name.length > 0 && profileDef(name) !== undefined);
}
export function vocabularyFor(meta) {
    const declared = new Set((meta.get("profile") ?? "").split(/\s+/).filter((x) => x.length > 0));
    const types = new Set();
    const attrs = new Map();
    const formats = new Set();
    const bodies = new Map();
    const prose = new Set();
    for (const name of declared) {
        const def = profileDef(name);
        if (def === undefined)
            continue;
        for (const t of def.types ?? [])
            types.add(t);
        for (const f of def.formats ?? [])
            formats.add(f);
        for (const [t, m] of Object.entries(def.bodies ?? {}))
            bodies.set(t, m);
        // `prose` 蕴含 flow：散文要装段落。显式的 bodies 优先，所以把一个 prose 类型
        // 声明成 raw 是说得出口的 —— 那是自相矛盾，由注册表自己的测试挡，不在这里猜。
        for (const t of def.prose ?? []) {
            prose.add(t);
            if (!bodies.has(t))
                bodies.set(t, "prose");
        }
        for (const [type, keys] of Object.entries(def.attrs ?? {})) {
            let set = attrs.get(type);
            if (set === undefined) {
                set = new Set();
                attrs.set(type, set);
            }
            for (const k of keys)
                set.add(k);
        }
    }
    return { types, attrs, formats, bodies, prose };
}
/**
 * 空词汇表，给那些刻意不带 meta 的惰性上下文用（gatherEmbeds / gatherIds /
 * tableFromDocument：它们丢弃诊断，只要结构）。具名常量而不是就地 new，
 * 是为了让"这里确实什么都不放行"读起来像决定，而不像遗漏。
 */
export const EMPTY_VOCABULARY = { types: new Set(), attrs: new Map(), formats: new Set(), bodies: new Map(), prose: new Set() };
