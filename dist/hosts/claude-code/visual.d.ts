/** The tools that draw a widget inline: the visualize connector's, whatever the host calls the connector. */
export declare const isVisualTool: (tool: string) => boolean;
/** The page's file name: the widget's title, made safe for any file system; `visual` when it has none. */
export declare function visualFileName(title: string): string;
/** The page for a widget: its title as the heading, the widget as it was drawn, the look it was drawn for. */
export declare function visualPage(title: string, code: string): string;
