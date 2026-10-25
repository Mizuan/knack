import { runWorker } from '@/lib/worker';
import type { BuildRequest, Built } from './types';
import workerUrl from './worker?worker&url';

export type BuildResult = {
    blob: Blob;
    kind: 'pdf' | 'zip';
    pages: number;
    files: number;
};

/** Build the PDF (or ZIP of PDFs) in a Web Worker. */
export function createPdf(
    request: BuildRequest,
    onProgress: (done: number, total: number) => void,
): { promise: Promise<BuildResult>; cancel: () => void } {
    const job = runWorker<BuildRequest, Built>(workerUrl, request, onProgress);

    return {
        cancel: job.cancel,
        promise: job.promise.then(({ bytes, kind, pages, files }) => ({
            blob: new Blob([bytes as Uint8Array<ArrayBuffer>], {
                type: kind === 'zip' ? 'application/zip' : 'application/pdf',
            }),
            kind,
            pages,
            files,
        })),
    };
}
