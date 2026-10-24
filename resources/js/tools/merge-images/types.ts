import type { Rotation } from '@/lib/rotation';

export type Direction = 'vertical' | 'horizontal' | 'grid';

/** Scale images to line up ("match"), or keep each at its own size. */
export type Sizing = 'match' | 'original';

export type Align = 'start' | 'center' | 'end';

export type MergeOptions = {
    direction: Direction;
    sizing: Sizing;
    align: Align;
    columns: 'auto' | 2 | 3 | 4;
    /** Space between images, as a percentage of the images' size. */
    spacing: number;
    /** Also put the spacing around the outside. */
    edges: boolean;
    /** Longest side of the result in pixels, or null for full size. */
    maxSide: number | null;
};

export type Box = { x: number; y: number; width: number; height: number };

export type Plan = {
    width: number;
    height: number;
    /** Where each upright image goes, in result pixels. */
    boxes: Box[];
    /** True when browser limits made the result smaller than asked for. */
    limited: boolean;
};

export type MergeRequest = {
    images: { blob: Blob; rotation: Rotation }[];
    plan: Plan;
    /** A CSS colour, or null for transparent. */
    background: string | null;
    format: 'image/jpeg' | 'image/png';
};

export type WorkerMessage =
    | { type: 'progress'; done: number; total: number }
    | { type: 'done'; blob: Blob }
    | { type: 'error'; message: string };
