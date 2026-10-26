import type { Rotation } from '@/lib/rotation';
import type { WorkerReply } from '@/lib/worker';

export type ShrinkFormat = 'jpg' | 'webp';

export type ShrinkRequest = {
    images: { blob: Blob; rotation: Rotation; name: string; size: number }[];
    /** Size limit in bytes. */
    target: number;
    format: ShrinkFormat;
};

export type ShrinkOutcome = {
    before: number;
    after: number;
    /** Under the limit. */
    fits: boolean;
    /** Already under the limit in the right format, so passed through as is. */
    unchanged: boolean;
    /** The image had to be made smaller to fit. */
    resized: boolean;
};

export type Shrunk = {
    bytes: Uint8Array;
    kind: 'image' | 'zip';
    outcomes: ShrinkOutcome[];
};

export type WorkerMessage = WorkerReply<Shrunk>;
