/// <reference lib="webworker" />
import { zipSync } from 'fflate';
import { degrees, PDFDocument } from 'pdf-lib';
import { withExtension } from '@/lib/file-names';
import { groupName, splitGroups } from './split';
import type { SplitRequest, WorkerMessage } from './types';

declare const self: DedicatedWorkerGlobalScope;

const post = (message: WorkerMessage, transfer: Transferable[] = []) =>
    self.postMessage(message, transfer);

self.onmessage = async ({ data }: MessageEvent<SplitRequest>) => {
    const { files, mode, chunk } = data;
    const bases = withExtension(
        files.map((file) => file.name),
        'pdf',
        'document',
    ).map((name) => name.replace(/\.pdf$/, ''));
    const plans = files.map((file) => splitGroups(file.pages, mode, chunk));
    const total = plans.reduce((sum, groups) => sum + groups.length, 0);
    const outputs: [string, Uint8Array][] = [];

    try {
        for (const [f, file] of files.entries()) {
            const source = await PDFDocument.load(
                new Uint8Array(await file.blob.arrayBuffer()),
                { updateMetadata: false },
            );

            for (const [g, group] of plans[f].entries()) {
                const name = groupName(
                    bases[f],
                    group,
                    g,
                    source.getPageCount(),
                );
                const part = await PDFDocument.create();

                part.setTitle(name.replace(/\.pdf$/, ''));
                part.setCreator('Tinyfold');
                part.setProducer('Tinyfold');

                for (const page of await part.copyPages(source, group)) {
                    if (file.rotation) {
                        page.setRotation(
                            degrees(
                                (page.getRotation().angle + file.rotation) %
                                    360,
                            ),
                        );
                    }

                    part.addPage(page);
                }

                outputs.push([name, await part.save()]);
                post({ type: 'progress', done: outputs.length, total });
            }
        }

        if (outputs.length === 1) {
            const [[, bytes]] = outputs;

            post({ type: 'done', bytes, kind: 'pdf', files: 1 }, [
                bytes.buffer,
            ]);

            return;
        }

        const bytes = zipSync(Object.fromEntries(outputs), { level: 0 });

        post({ type: 'done', bytes, kind: 'zip', files: outputs.length }, [
            bytes.buffer,
        ]);
    } catch (error) {
        post({
            type: 'error',
            message:
                error instanceof Error && error.name === 'EncryptedPDFError'
                    ? 'One of the PDFs is locked, so it could not be split.'
                    : 'Something went wrong while splitting the PDF.',
        });
    }
};
