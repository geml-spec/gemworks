/**
 * The entries of `version`'s section of a Keep-a-Changelog file (`## [x.y.z] — date`), each as its first sentence,
 * its `**scope**:` prefix and its Markdown marks left out; none when the file has no section for that version.
 */
export declare function releaseNotesOf(changelog: string, version: string): string[];
/** Whether `candidate` is a later version than `current`: major, minor, patch, each by number (a pre-release tag is not weighed). */
export declare function isNewer(candidate: string, current: string): boolean;
