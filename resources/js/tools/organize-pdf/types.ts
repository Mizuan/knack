import type { WorkerReply } from '@/lib/worker';
import type { PagePick } from './assemble';

export type OrganizeRequest = {
    sources: Blob[];
    picks: PagePick[];
    title: string;
};

export type Organized = { bytes: Uint8Array; pages: number };

export type WorkerMessage = WorkerReply<Organized>;
