import type { JsonValue } from "../../core/schema.js";
import type { NextStep } from "../../workspace.js";
import type { Pressable } from "./actions.js";
import type { InboxItem } from "./inbox.js";
import { type ShellStatus, type TimelineEntry, type TodoCount } from "./protocol.js";
import { type T } from "./text.js";
export type Tone = "normal" | "dim" | "success" | "warning" | "error" | "brand" | "mark";
export interface Segment {
    text: string;
    tone: Tone;
}
/** Drawn, dim, between two segments. */
export declare const SEP = " \u00B7 ";
/** Gemworks's red, for the current stage where a surface draws words. Nothing else is red. */
export declare const BRAND_RED = "#ef3b3f";
/** The violet of the mark's lower half: the mark where a surface draws no picture. */
export declare const MARK_VIOLET = "#8b5cf6";
/** The mark where a surface draws no picture (the terminal): Gemworks's one-character sign. */
export declare const MARK: Segment;
/** Gemworks's mark, the Prism Chevron: cyan over violet, a mint facet at each joint, for a surface that draws pictures. */
export declare const MARK_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"17.5 17 66 66\"><polygon points=\"27,20 55,20 79,50 67,50 48,30 35,30 51,50 39,50 22,30 22,25\" fill=\"#06b6d4\"/><polygon points=\"27,80 55,80 79,50 67,50 48,70 35,70 51,50 39,50 22,70 22,75\" fill=\"#8b5cf6\"/><polygon points=\"39,50 45,42 51,50 45,58\" fill=\"#67e8f9\"/><polygon points=\"35,45 45,42 39,50\" fill=\"#0ea5e9\"/><polygon points=\"35,55 45,58 39,50\" fill=\"#6366f1\"/><polygon points=\"67,50 73,42 79,50 73,58\" fill=\"#67e8f9\"/><polygon points=\"63,45 73,42 67,50\" fill=\"#0ea5e9\"/><polygon points=\"63,55 73,58 67,50\" fill=\"#6366f1\"/></svg>";
/** Terminal cells a string takes: East Asian wide and fullwidth characters two; joiners, combining marks and variation selectors none. */
export declare function cellWidth(text: string): number;
/** At most `max` cells, ending in `…` when cut; never half of a wide character. */
export declare function truncate(text: string, max: number): string;
/** `text` broken into rows of at most `width` cells, at most `rows` of them, the last ending in "…" when some is left over. */
export declare function wrapCells(text: string, width: number, rows: number): string[];
/** Whole segments while they fit in `columns`, separators counted; the first that does not is cut, the rest dropped. */
export declare function fitSegments(segments: readonly Segment[], columns: number): Segment[];
/** A `Text`'s props for a tone: a theme color, the brand's red or the mark's violet in bold, or dim. */
export declare function toneProps(tone: Tone): {
    color?: string;
    dimColor?: true;
    bold?: true;
};
/** Who takes a transition: a person, the machine when its guard holds, or the model (or a person) by hand. */
export declare const howText: (x: {
    judge: string;
    approval: boolean;
}, t?: T) => string;
/** The way on in the flow's words: the step it leads to, and its note or who takes it. */
export declare function wayOnText(x: NextStep, t?: T): string;
export declare function nextText(x: NextStep, t?: T): string;
/** A variable as the band shows it: a boolean as ✓ or ✗, anything else as its value. */
export declare function varSegment(name: string, value: JsonValue | undefined): Segment;
/** A media work item's to-do count (spec §7.2), as the last refresh or board read it: display only; past the cap, `999+`. */
export declare function todoSegment(count: number, t?: T): Segment;
/**
 * The band's words: the bridge's problem alone when there is one; else the
 * work item, its stage, its to-do count when it is a media entry, the
 * variables the next guards read, the next step and the warnings. `setup` — a
 * tool or command the session would not register — comes last, or alone when
 * there is no stage to show. `todo` counts only for the work item it names,
 * and only while that item is in the stage it was read in.
 */
export declare function bandSegments(shell: ShellStatus | null, problem: string | null, setup?: string | null, todo?: TodoCount | null, t?: T, show?: {
    vars: boolean;
}): Segment[];
export interface BandInput {
    shell: ShellStatus | null;
    problem: string | null;
    setup: string | null;
    /** A line of gemworks's own that stands in for the stage for a while: the initialization's count, then its outcome. */
    notice?: {
        text: string;
        tone: Tone;
    } | null;
    todo: TodoCount | null;
    /** The inbox, broken bridge first: its first item's actions are the band's. */
    inbox: readonly InboxItem[];
    timeline: readonly TimelineEntry[];
    now: string;
    t: T;
}
export interface BandView {
    /** What the person does with the line's one thing (定, 验收, 勾, 被拦), `已暂停`, `我在做`, or nothing. */
    verb: string;
    /** The one thing: a work item's name, a blocked tool, a problem's words. */
    title: string;
    tone: Tone;
    /** Dim words after the title: the stage while Claude works, the hold's meaning. */
    note: string;
    /** What hovering the title shows in its place: the thing whole. */
    detail: string;
    /** Its options, at most three, the main one first. */
    actions: Pressable[];
    /** The other things waiting on the person: how many, and their names for a hover. */
    more: {
        count: number;
        detail: string;
    };
}
/**
 * The band (spec §8.1): the one thing that is the person's now, with its
 * options, then how many more wait. A broken bridge or a setup problem comes
 * first; a held item offers `继续`; with nothing waiting, what Claude is
 * working on and in which stage.
 */
export declare function bandView(o: BandInput): BandView;
