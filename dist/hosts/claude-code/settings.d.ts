export type LanguageSetting = "system" | "zh" | "en" | "ja";
export interface Settings {
    language: LanguageSetting;
    /**
     * Desktop notifications: a question the band asks (`inbox`; a strict workflow's approvals too), a work item at a step
     * the person judges (`confirm`), a tool held by a rule or a strict workflow (`refusal`, one per reason every few minutes),
     * a strict workflow's stage change; and a new version, said on the board.
     */
    notify: {
        inbox: boolean;
        confirm: boolean;
        refusal: boolean;
        stage: boolean;
        update: boolean;
    };
    /** Typed answers: whether a small model reads a typed prompt as the answer to a question the band asks. */
    judge: {
        enabled: boolean;
    };
    /** Learning: whether a small model reads each prompt for corrections, themes them and proposes flow steps from them. */
    learn: {
        enabled: boolean;
    };
    /** The diagnosis trace: presses, drawings, loads into .geml/trace.log and the transcript. Off unless a board problem is being chased: on, it floods the conversation. */
    trace: {
        enabled: boolean;
    };
}
export declare const DEFAULT_SETTINGS: Settings;
/** The settings keys a `setting` action names, `group.field`. */
export declare const SETTING_KEYS: readonly ["language", "notify.inbox", "notify.confirm", "notify.refusal", "notify.stage", "notify.update", "judge.enabled", "learn.enabled", "trace.enabled"];
export type SettingKey = (typeof SETTING_KEYS)[number];
/** A stored value read as settings: every field as stored when it is of the right type, else its default. */
export declare function settingsFrom(stored: unknown): Settings;
/** The settings with one key changed; an unknown key or a value of the wrong type changes nothing. */
export declare function withSetting(s: Settings, key: string, value: string | boolean): Settings;
