/** One memory: its file in the folder, the title and the hook its index line gives, its type, when it was last written. */
export interface MemoryEntry {
    file: string;
    title: string;
    hook: string;
    type: string;
    at: string;
}
/** A project's memory: the folder it is in, and its entries, the newest first. */
export interface MemoryList {
    dir: string;
    entries: MemoryEntry[];
}
/** The folder Claude Code keeps a project's memory in: its projects folder, then the project's path with every other character a dash, then memory. */
export declare function memoryDir(projects: string, project: string): string;
/** The memory the index lists, the newest first; none when the folder or its index is not there. */
export declare function readMemory(dir: string): MemoryList;
/** Rewrites one memory's index line with a new hook, its title and file kept; false when the file is not listed or the hook is empty or spans lines. */
export declare function setMemoryHook(dir: string, file: string, hook: string, trash: string): boolean;
/** Takes one memory out: its file moved into the trash folder, its index line dropped; false when the file is not listed. */
export declare function deleteMemory(dir: string, file: string, trash: string): boolean;
