/**
 * Start a module worker from a URL imported with `?worker&url`.
 *
 * Workers must load from the page's own origin. In development the script
 * comes from the Vite dev server on another port, so start the worker from a
 * same-origin blob that imports it.
 */
export function spawnWorker(scriptUrl: string): Worker {
    const url = new URL(scriptUrl, window.location.href);

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

/** What a tool worker sends back: progress, then a result or an error. */
export type WorkerReply<Done> =
    | { type: 'progress'; done: number; total: number }
    | ({ type: 'done' } & Done)
    | { type: 'error'; message: string };

/**
 * Send one job to a fresh worker and wait for its result. Call `cancel` to
 * stop early; the promise then never settles.
 */
export function runWorker<Request, Done>(
    scriptUrl: string,
    request: Request,
    onProgress: (done: number, total: number) => void,
): { promise: Promise<Done>; cancel: () => void } {
    const worker = spawnWorker(scriptUrl);

    const promise = new Promise<Done>((resolve, reject) => {
        worker.onmessage = ({ data }: MessageEvent<WorkerReply<Done>>) => {
            if (data.type === 'progress') {
                onProgress(data.done, data.total);

                return;
            }

            worker.terminate();

            if (data.type === 'error') {
                reject(new Error(data.message));
            } else {
                const { type: _type, ...done } = data;

                resolve(done as Done);
            }
        };

        worker.onerror = (event) => {
            worker.terminate();
            reject(
                new Error(event.message || 'The tool stopped unexpectedly.'),
            );
        };
    });

    worker.postMessage(request);

    return { promise, cancel: () => worker.terminate() };
}
