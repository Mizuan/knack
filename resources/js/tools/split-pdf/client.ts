import { runWorker } from '@/lib/worker';
import type { Split, SplitRequest } from './types';
import workerUrl from './worker?worker&url';

/** Split the PDFs in a Web Worker. */
export function splitPdfs(
    request: SplitRequest,
    onProgress: (done: number, total: number) => void,
): {
    promise: Promise<{ blob: Blob; kind: 'pdf' | 'zip'; files: number }>;
    cancel: () => void;
} {
    const job = runWorker<SplitRequest, Split>(workerUrl, request, onProgress);

    return {
        cancel: job.cancel,
        promise: job.promise.then(({ bytes, kind, files }) => ({
            blob: new Blob([bytes as Uint8Array<ArrayBuffer>], {
                type: kind === 'zip' ? 'application/zip' : 'application/pdf',
            }),
            kind,
            files,
        })),
    };
}
