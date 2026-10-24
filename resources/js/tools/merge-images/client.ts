import { spawnWorker } from '@/lib/worker';
import type { MergeRequest, WorkerMessage } from './types';
import workerUrl from './worker?worker&url';

/**
 * Draw the merged image in a Web Worker so the page stays responsive. Call
 * `cancel` to stop early; the promise then never settles.
 */
export function mergeImages(
    request: MergeRequest,
    onProgress: (done: number, total: number) => void,
): { promise: Promise<Blob>; cancel: () => void } {
    const worker = spawnWorker(workerUrl);

    const promise = new Promise<Blob>((resolve, reject) => {
        worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
            if (data.type === 'progress') {
                onProgress(data.done, data.total);

                return;
            }

            worker.terminate();

            if (data.type === 'done') {
                resolve(data.blob);
            } else {
                reject(new Error(data.message));
            }
        };

        worker.onerror = (event) => {
            worker.terminate();
            reject(new Error(event.message || 'The image merger crashed.'));
        };
    });

    worker.postMessage(request);

    return { promise, cancel: () => worker.terminate() };
}
