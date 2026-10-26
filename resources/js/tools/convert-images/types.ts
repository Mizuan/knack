import type { Rotation } from '@/lib/rotation';
import type { WorkerReply } from '@/lib/worker';

export type Format = 'jpg' | 'png' | 'webp';

export type ConvertRequest = {
    images: { blob: Blob; rotation: Rotation; name: string; size: number }[];
    format: Format;
    /** 0 to 1, for JPG and WebP. */
    quality: number;
    /** Longest side in pixels, or null to keep the original size. */
    maxSide: number | null;
};

export type Outcome = { before: number; after: number };

export type Converted = {
    bytes: Uint8Array;
    kind: 'image' | 'zip';
    outcomes: Outcome[];
};

export type WorkerMessage = WorkerReply<Converted>;
