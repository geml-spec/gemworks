export type Lang = "zh" | "en" | "ja";
export declare const LANGS: readonly Lang[];
/** The words function: a key (the Chinese text) and its arguments, in the language chosen. */
export type T = (key: string, ...args: readonly (string | number)[]) => string;
/** `{0}`, `{1}`… replaced in order; a hole with no argument stays. */
export declare function fill(text: string, args: readonly (string | number)[]): string;
/**
 * The language for a setting and a locale: `system` follows the locale
 * (`zh*` Chinese, `ja*` Japanese, anything else English); an explicit choice
 * is itself; nothing known is Chinese, the words' own language.
 */
export declare function langOf(setting: string | undefined, locale: string | undefined): Lang;
type Entry = {
    en: string;
    ja: string;
};
/** The table, keyed by the Chinese text. */
export declare const WORDS: Readonly<Record<string, Entry>>;
/** The words in `lang`: a key with no translation falls back to its Chinese text. */
export declare function wordsFor(lang: Lang): T;
/** The words in Chinese, their own language: what every pure function draws with when nothing chose. */
export declare const ZH: T;
export {};
