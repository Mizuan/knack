import type { Rotation } from '@/lib/rotation';
import type { WorkerReply } from '@/lib/worker';

export type PdfMeta = {
    pageCount: number;
    /** The pages to use as typed, e.g. "1-3, 5"; empty means all. */
    pages: string;
};

export type MergeRequest = {
    files: { blob: Blob; rotation: Rotation; pages: number[] }[];
    title: string;
};

export type Merged = { bytes: Uint8Array; pages: number };

export type WorkerMessage = WorkerReply<Merged>;
