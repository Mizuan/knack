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
