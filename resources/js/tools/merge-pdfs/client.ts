import { runWorker } from '@/lib/worker';
import type { Merged, MergeRequest } from './types';
import workerUrl from './worker?worker&url';

/** Merge the PDFs in a Web Worker. */
export function mergePdfs(
    request: MergeRequest,
    onProgress: (done: number, total: number) => void,
): { promise: Promise<{ blob: Blob; pages: number }>; cancel: () => void } {
    const job = runWorker<MergeRequest, Merged>(workerUrl, request, onProgress);

    return {
        cancel: job.cancel,
        promise: job.promise.then(({ bytes, pages }) => ({
            blob: new Blob([bytes as Uint8Array<ArrayBuffer>], {
                type: 'application/pdf',
            }),
            pages,
        })),
    };
}
