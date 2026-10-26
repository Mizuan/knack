import { runWorker } from '@/lib/worker';
import { FORMATS } from '@/tools/convert-images/formats';
import type { ShrinkOutcome, ShrinkRequest, Shrunk } from './types';
import workerUrl from './worker?worker&url';

/** Shrink the images in a Web Worker. */
export function shrinkImages(
    request: ShrinkRequest,
    onProgress: (done: number, total: number) => void,
): {
    promise: Promise<{
        blob: Blob;
        kind: 'image' | 'zip';
        outcomes: ShrinkOutcome[];
    }>;
    cancel: () => void;
} {
    const job = runWorker<ShrinkRequest, Shrunk>(
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
