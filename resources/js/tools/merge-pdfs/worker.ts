/// <reference lib="webworker" />
import { degrees, PDFDocument } from 'pdf-lib';
import type { MergeRequest, WorkerMessage } from './types';

declare const self: DedicatedWorkerGlobalScope;

const post = (message: WorkerMessage, transfer: Transferable[] = []) =>
    self.postMessage(message, transfer);

self.onmessage = async ({ data }: MessageEvent<MergeRequest>) => {
    const { files, title } = data;

    try {
        const merged = await PDFDocument.create();

        merged.setTitle(title);
        merged.setCreator('Tinyfold');
        merged.setProducer('Tinyfold');

        // Load one source at a time so only one is in memory with the result.
        for (const [i, file] of files.entries()) {
            const source = await PDFDocument.load(
                new Uint8Array(await file.blob.arrayBuffer()),
                { updateMetadata: false },
            );
            const pages = await merged.copyPages(source, file.pages);

            for (const page of pages) {
                if (file.rotation) {
                    page.setRotation(
                        degrees(
                            (page.getRotation().angle + file.rotation) % 360,
                        ),
                    );
                }

                merged.addPage(page);
            }

            post({ type: 'progress', done: i + 1, total: files.length });
        }

        const bytes = await merged.save();

        post({ type: 'done', bytes, pages: merged.getPageCount() }, [
            bytes.buffer,
        ]);
    } catch (error) {
        post({
            type: 'error',
            message:
                error instanceof Error && error.name === 'EncryptedPDFError'
                    ? 'One of the PDFs is locked, so it could not be merged.'
                    : 'Something went wrong while merging the PDFs.',
        });
    }
};
