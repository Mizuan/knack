import { runWorker } from '@/lib/worker';
import type { Organized, OrganizeRequest } from './types';
import workerUrl from './worker?worker&url';

/** Build the organised PDF in a Web Worker. */
export function organizePdf(
    request: OrganizeRequest,
    onProgress: (done: number, total: number) => void,
): { promise: Promise<{ blob: Blob; pages: number }>; cancel: () => void } {
    const job = runWorker<OrganizeRequest, Organized>(
        workerUrl,
        request,
        onProgress,
    );

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
