/** The command line a tool call would run: its input's `command`, when that is a string, whatever the tool (Bash, Monitor, a host's own runner). */
export declare function commandOf(input: Readonly<Record<string, unknown>> | undefined): string | undefined;
/** The longest command line a command signal reads; the scanner is linear, but a signal pattern is the author's regular expression. */
export declare const MAX_SIGNAL_COMMAND_LENGTH = 65536;
/**
 * The simple commands of a command line that is nothing but simple commands
 * joined by `&&` — the only shape whose exit status speaks for each command in
 * it — or null for any other line. A small quote-aware scanner, not a shell
 * parser. Single quotes hide everything; `$'…'` hides everything but a
 * backslash escape; double quotes hide operators from the split (the shell
 * still runs `$(…)` and backticks inside them, which cannot change the status
 * of the command they sit in) but not `${`, and in them a backslash escapes
 * only `$`, a backtick, `"`, `\` and a newline; a backslash outside quotes
 * escapes the next character (a backslash-newline is a line continuation). Blanks are
 * the space and the tab only. Outside quotes `;`, `||`, a pipe, a background
 * `&` (`&>` included), a newline, `$(`, `${`, `$[`, a backtick, `(` and a `#`
 * that starts a word (a comment) make the line null; a `&` inside a redirection
 * (`2>&1`, `>&log`) is not a background `&`. So does a simple command whose
 * command word is a shell keyword (`[[`, `{`, `function`, `if`, …), a builtin
 * that can end the shell or rewrite what runs (`exit`, `exec`, `trap`, `eval`,
 * `alias`, …, looking through `builtin` and `command`), or a word built by
 * expansion. A blank line has no commands; an empty command (`a &&`) or an
 * unterminated quote is not a command line at all.
 */
export declare function simpleCommands(line: string): string[] | null;
/** What a command signal's start-anchored pattern is tested against: each simple command of a plain `&&` chain, without its leading assignments; null when the line speaks for no command signal (too long, or not such a chain). */
export declare function signalHeads(line: string): string[] | null;
/** The line with line continuations, quotes and backslashes removed and every run of blanks made one space: roughly the text the shell will read as words. */
export declare function withoutQuoting(command: string): string;
/** The person-only refusal's words for one verb: what the model reads, whichever scan found the verb. */
export declare function personOnlyReason(verb: string): string;
/**
 * The line without the bodies of the here-documents it writes as text: a body
 * fed to a command that runs no code from it (`cat <<EOF > notes.md`, `tee`)
 * is data. One fed to a shell, a launcher, an interpreter or ssh, or whose
 * command pipes on (`cat <<EOF | bash`), runs, and stays. Quotes and
 * backslashes as the other scanners read them. Null when the line cannot be
 * read this way — a quote that does not close, `<<` after an arithmetic
 * context, a word that hides its command — and the caller reads it whole.
 */
export declare function withoutDataHereDocs(line: string, depth?: number): string | null;
/**
 * Whether a command line runs git or gh: a command at any command position
 * (after `;`, `&&`, `|`, a newline, a subshell, a substitution, assignments, a
 * redirection or a prefix such as `command`) whose name is git or gh, at any
 * path; either among the arguments of a launcher (`sudo git switch main`,
 * `timeout 30 git pull`); or either in a string a shell is handed (`bash -c
 * "git checkout -b x"`, `sudo sh -c "…"`). Naming either as an argument of
 * another command (`echo git push`) is not running it. A line that does not
 * tokenise, or nests shells deeper than the scan reads, counts when it holds
 * either as a word: the answer decides whether git's facts are read again, so
 * the safe side is yes.
 */
export declare function runsGitOrGh(line: string): boolean;
/**
 * Why the model may not run this command — a manual signal or a person's
 * transition — or undefined. A command line is refused when one of its commands
 * (found at command position: after `;`, `&&`, `|`, a newline, a subshell, a
 * substitution, a prefix such as `env` or `command`, or a shell string such as
 * `bash -c "…"`, `pwsh -c "…"`, `sudo sh -c "…"` or `npx -c "…"`) runs gemworks —
 * a command called gemworks at any path, or one of the package runners and
 * interpreters given `gemworks` or its `cli` script — and the first
 * argument that is not an option is mark, unmark, advance, pause or resume, in any case (or
 * is built by expansion, so could be). Merely naming them (`echo gemworks
 * mark`, a commit message) is not a call. When the command word is built by
 * expansion, or the line does not tokenise, the line is refused if it holds
 * gemworks and one of the verbs as words.
 */
export declare function personOnlyRefusal(command: string): string | undefined;
/**
 * Whether a command line does nothing but search: one or more stages joined by
 * `|`, each a plain `&&` chain (simpleCommands), every command in them one of
 * rg, grep, egrep, fgrep, ls, find, fd, tree, wc, head and tail, written as the
 * bare name, with no word built by expansion; no redirection that writes a
 * file (`2>&1` and `/dev/null` write none); find without -exec, -execdir,
 * -ok, -okdir, -delete, -fprint, -fprint0, -fprintf or -fls; fd without -x,
 * -X, --exec or --exec-batch; rg without --pre; tree without -o. Claude Code's
 * native builds have no Grep or Glob, so where a state admits search and not
 * run, such a line through Bash is the search it admits.
 */
export declare function isSearchOnlyCommand(line: string): boolean;
/** Whether one simple command is a directory change: cd, pushd, popd or chdir as its command word (past assignments and prefixes such as `builtin`). */
export declare function isDirectoryChange(command: string): boolean;
/**
 * The directory each simple command of a plain `&&` chain (simpleCommands)
 * runs in: `startDir`, moved by every cd, pushd or chdir before it — a change
 * itself runs where the shell stood. From a change whose target the line does
 * not say (see cdTarget, and popd) on, the directory is undefined. Null for a
 * line that is no such chain. Paths are absolute, POSIX or a Windows drive
 * path, the latter in the `/` form absoluteNormal gives (`C:/a/b`); a start
 * directory in another form (a relative one) stands as given for the commands
 * before the first change, and every directory after one is unknown.
 */
export declare function commandDirs(line: string, startDir: string): (string | undefined)[] | null;
/**
 * Whether a command line moves its shell to another directory anywhere: cd,
 * pushd, popd or chdir as a command at any command position (after `;`, `&&`,
 * `|`, a newline, a subshell, a substitution, assignments or a prefix such as
 * `builtin`). A line that does not tokenise counts when it holds one as a word.
 */
export declare function changesDirectory(line: string): boolean;
/** A word that may name a file, and whether it holds a glob character: the shell, or the program, may read it as several files. */
export interface PathWord {
    text: string;
    glob: boolean;
}
/**
 * The words of one simple command after its command word that may name a
 * file: each argument, and the value of a `--name=value` option. Other
 * options, redirections and words built by expansion are left out.
 */
export declare function pathWords(command: string): PathWord[];
/**
 * Whether a command line does nothing but switch the work item — the way out
 * of any state: a plain `&&` chain (simpleCommands)
 * every command of which is `git switch <branch>`, `git switch
 * -c|-C|--create|--force-create <branch> [<start>]`, `git checkout -b|-B
 * <branch> [<start>]`, `git checkout <branch>` when `isBranch` says the
 * branch is an existing local one (without `isBranch`, never), `git worktree
 * add [-b|-B <branch>] [--detach] <path> [<start>]` or `cd <path>`, written
 * as the bare words. Any other option (`-f`, `--force`, `--discard-changes`,
 * `--merge`, `--`, `git -C`) or operand, a redirection or an expansion makes
 * it no switch.
 */
export declare function switchesWorkItemOnly(line: string, isBranch?: (name: string) => boolean): boolean;
