/// <reference lib="webworker" />
import { zipSync } from 'fflate';
import { buildPdf } from './build-pdf';
import { pdfNames } from '@/lib/file-names';
import { prepareImage } from './prepare';
import type { BuildRequest, WorkerMessage } from './types';

declare const self: DedicatedWorkerGlobalScope;

const post = (message: WorkerMessage, transfer: Transferable[] = []) =>
    self.postMessage(message, transfer);

self.onmessage = async ({ data }: MessageEvent<BuildRequest>) => {
    const { images, options, output, title } = data;
    const total = images.length;
    const load = (i: number) =>
        prepareImage(images[i].blob, images[i].rotation);

    try {
        if (output === 'single' || total === 1) {
            const bytes = await buildPdf(
                total,
                load,
                options,
                { title },
                (done) => post({ type: 'progress', done, total }),
            );

            post({ type: 'done', bytes, kind: 'pdf', pages: total, files: 1 }, [
                bytes.buffer,
            ]);

            return;
        }

        const names = pdfNames(images.map((image) => image.name));
        const entries: Record<string, Uint8Array> = {};

        for (let i = 0; i < total; i++) {
            entries[names[i]] = await buildPdf(1, () => load(i), options, {
                title: names[i].replace(/\.pdf$/, ''),
            });
            post({ type: 'progress', done: i + 1, total });
        }

        // PDFs are already compressed, so store them as they are.
        const bytes = zipSync(entries, { level: 0 });

        post({ type: 'done', bytes, kind: 'zip', pages: total, files: total }, [
            bytes.buffer,
        ]);
    } catch (error) {
        post({
            type: 'error',
            message:
                error instanceof Error
                    ? error.message
                    : 'Something went wrong while building the PDF.',
        });
    }
};
