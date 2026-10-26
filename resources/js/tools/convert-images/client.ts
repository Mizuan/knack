import { runWorker } from '@/lib/worker';
import { FORMATS } from './formats';
import type { Converted, ConvertRequest, Outcome } from './types';
import workerUrl from './worker?worker&url';

/** Convert the images in a Web Worker. */
export function convertImages(
    request: ConvertRequest,
    onProgress: (done: number, total: number) => void,
): {
    promise: Promise<{
        blob: Blob;
        kind: 'image' | 'zip';
        outcomes: Outcome[];
    }>;
    cancel: () => void;
} {
    const job = runWorker<ConvertRequest, Converted>(
        workerUrl,
        request,
        onProgress,
    );

    return {
        cancel: job.cancel,
        promise: job.promise.then(({ bytes, kind, outcomes }) => ({
            blob: new Blob([bytes as Uint8Array<ArrayBuffer>], {
                type:
                    kind === 'zip'
                        ? 'application/zip'
                        : FORMATS[request.format].mime,
            }),
            kind,
            outcomes,
        })),
    };
}
