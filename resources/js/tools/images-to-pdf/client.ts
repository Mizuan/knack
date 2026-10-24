import type { BuildRequest, WorkerMessage } from './types';
import workerUrl from './worker?worker&url';

export type BuildResult = {
    blob: Blob;
    kind: 'pdf' | 'zip';
    pages: number;
    files: number;
};

/**
 * Build the PDF in a Web Worker so the page stays responsive. Call `cancel`
 * to stop early; the promise then never settles.
 */
export function createPdf(
    request: BuildRequest,
    onProgress: (done: number, total: number) => void,
): { promise: Promise<BuildResult>; cancel: () => void } {
    const worker = spawnWorker();

    const promise = new Promise<BuildResult>((resolve, reject) => {
        worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
            if (data.type === 'progress') {
                onProgress(data.done, data.total);

                return;
            }

            worker.terminate();

            if (data.type === 'done') {
                resolve({
                    blob: new Blob([data.bytes as Uint8Array<ArrayBuffer>], {
                        type:
                            data.kind === 'zip'
                                ? 'application/zip'
                                : 'application/pdf',
                    }),
                    kind: data.kind,
                    pages: data.pages,
                    files: data.files,
                });
            } else {
                reject(new Error(data.message));
            }
        };

        worker.onerror = (event) => {
            worker.terminate();
            reject(new Error(event.message || 'The PDF builder crashed.'));
        };
    });

    worker.postMessage(request);

    return { promise, cancel: () => worker.terminate() };
}

/**
 * Workers must load from the page's own origin. In development the script
 * comes from the Vite dev server on another port, so start the worker from a
 * same-origin blob that imports it.
 */
function spawnWorker(): Worker {
    const url = new URL(workerUrl, window.location.href);

    if (url.origin === window.location.origin) {
        return new Worker(url, { type: 'module' });
    }

    const boot = URL.createObjectURL(
        new Blob([`import ${JSON.stringify(url.href)};`], {
            type: 'text/javascript',
        }),
    );

    return new Worker(boot, { type: 'module' });
}
