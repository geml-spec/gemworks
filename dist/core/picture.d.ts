import { type Overlay } from "@geml/geml/dist/statechart-svg.js";
import type { Statechart } from "./statechart.js";
import type { Status } from "./status.js";
import type { FlowPicture, TimelineEntry } from "../hosts/claude-code/protocol.js";
export interface PictureInput {
    sc: Statechart;
    status: Status | null;
    /** Every work item with a journal and the state it stands in. */
    items: readonly {
        id: string;
        state: string;
    }[];
    /** The current work item's journal, as the board lists it. */
    timeline: readonly TimelineEntry[];
}
/** What the picture lays over the chart: the runtime's view of the current item, and the items' spread. */
export declare function flowOverlay(p: PictureInput): Overlay;
/** The flow as the board draws it: the topology, the runtime laid over it, and the SVG of both, top to bottom. */
export declare function flowPicture(p: PictureInput): FlowPicture;
