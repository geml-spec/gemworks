/**
 * The text of the block `blockId` (without its `#`), or undefined when the
 * document has none. `markdown` reads the source as Markdown, the way `geml`
 * reads a `.md` file (a repeated heading's id gets GitHub's `-1` suffix);
 * hosts set it from `isMarkdownPath`. Ids compare as the parser compares them,
 * the first block with the id answers, line ends come back as LF and trailing
 * newlines are dropped.
 */
export declare function blockText(source: string, blockId: string, o?: {
    markdown?: boolean;
}): string | undefined;
