import type { Rotation } from '@/lib/rotation';
import type { WorkerReply } from '@/lib/worker';
import type { SplitMode } from './split';

export type SplitRequest = {
    files: { blob: Blob; name: string; rotation: Rotation; pages: number[] }[];
    mode: SplitMode;
    chunk: number;
};

export type Split = { bytes: Uint8Array; kind: 'pdf' | 'zip'; files: number };

export type WorkerMessage = WorkerReply<Split>;
