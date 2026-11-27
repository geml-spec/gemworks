import type { T } from "./text.js";
/** Milliseconds between two ISO times; NaN when either does not parse. */
export declare function between(fromIso: string, toIso: string): number;
/** A span in words: `2 小时`, `1 小时 48 分`, `12 分钟`, `30 秒`; negative or unreadable, `0 秒`. */
export declare function durationText(ms: number, t: T): string;
/** How long ago: `刚刚` under a minute, then `3 分钟前`, `2 小时前`, `昨天`, `3 天前`; unreadable, empty. */
export declare function agoText(atIso: string, nowIso: string, t: T): string;
/** How long something has waited: `等了 12 分钟`; unreadable, empty. */
export declare function waitedText(sinceIso: string, nowIso: string, t: T): string;
/** The day of an ISO time as a heading, in the host's local time: `今天`, `昨天`, else its month and day; unreadable, empty. */
export declare function dayText(atIso: string, nowIso: string, t: T): string;
/** `HH:MM` of an ISO time in the host's local time; the raw text when it does not parse. */
export declare function hhmm(iso: string): string;
