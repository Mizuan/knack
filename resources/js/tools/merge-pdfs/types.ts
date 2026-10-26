import type { Rotation } from '@/lib/rotation';
import type { WorkerReply } from '@/lib/worker';

export type { PdfMeta } from '@/lib/pdf';

export type MergeRequest = {
    files: { blob: Blob; rotation: Rotation; pages: number[] }[];
    title: string;
};

export type Merged = { bytes: Uint8Array; pages: number };

export type WorkerMessage = WorkerReply<Merged>;
