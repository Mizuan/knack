/// <reference lib="webworker" />
import { assemblePages } from './assemble';
import type { OrganizeRequest, WorkerMessage } from './types';

declare const self: DedicatedWorkerGlobalScope;

const post = (message: WorkerMessage, transfer: Transferable[] = []) =>
    self.postMessage(message, transfer);

self.onmessage = async ({ data }: MessageEvent<OrganizeRequest>) => {
    try {
        const sources = await Promise.all(
            data.sources.map(
                async (blob) => new Uint8Array(await blob.arrayBuffer()),
            ),
        );
        const bytes = await assemblePages(
            sources,
            data.picks,
            data.title,
            (done, total) => post({ type: 'progress', done, total }),
        );

        post({ type: 'done', bytes, pages: data.picks.length }, [bytes.buffer]);
    } catch (error) {
        post({
            type: 'error',
            message:
                error instanceof Error && error.name === 'EncryptedPDFError'
                    ? 'One of the PDFs is locked, so its pages could not be used.'
                    : 'Something went wrong while saving the PDF.',
        });
    }
};
