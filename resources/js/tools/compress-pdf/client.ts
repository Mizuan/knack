import { runWorker } from '@/lib/worker';
import type { Compressed, CompressRequest, FileOutcome } from './types';
import workerUrl from './worker?worker&url';

/** Compress the PDFs in a Web Worker. */
export function compressPdfs(
    request: CompressRequest,
    onProgress: (done: number, total: number) => void,
): {
    promise: Promise<{
        blob: Blob;
        kind: 'pdf' | 'zip';
        outcomes: FileOutcome[];
    }>;
    cancel: () => void;
} {
    const job = runWorker<CompressRequest, Compressed>(
        workerUrl,
        request,
        onProgress,
    );

    return {
        cancel: job.cancel,
        promise: job.promise.then(({ bytes, kind, outcomes }) => ({
            blob: new Blob([bytes as Uint8Array<ArrayBuffer>], {
                type: kind === 'zip' ? 'application/zip' : 'application/pdf',
            }),
            kind,
            outcomes,
        })),
    };
}
