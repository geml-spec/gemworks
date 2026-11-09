/**
 * The files a shell command hands to `git commit` as its message: a draft
 * written for the commit, not for the person, so never one of the work
 * item's artifacts. `-F <file>`, `-F<file>`, `--file <file>` and
 * `--file=<file>` each name one; `-F -` (the message on stdin) names none. A
 * variable the same command assigns (`S=/tmp/x && git commit -F $S/msg.txt`)
 * is expanded; one it does not assign is left as written.
 */
/** The message files of every `git commit` in `command`, in order, variables expanded. */
export declare function commitMessageFiles(command: string): string[];
