import { runWorker } from '@/lib/worker';
import type { MergeRequest } from './types';
import workerUrl from './worker?worker&url';

/** Draw the merged image in a Web Worker. */
export function mergeImages(
    request: MergeRequest,
    onProgress: (done: number, total: number) => void,
): { promise: Promise<Blob>; cancel: () => void } {
    const job = runWorker<MergeRequest, { blob: Blob }>(
        workerUrl,
        request,
        onProgress,
    );

    return {
        cancel: job.cancel,
        promise: job.promise.then(({ blob }) => blob),
    };
}
