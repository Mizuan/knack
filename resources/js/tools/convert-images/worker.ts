/// <reference lib="webworker" />
import { zipSync } from 'fflate';
import { withExtension } from '@/lib/file-names';
import { isQuarterTurn } from '@/lib/rotation';
import { FORMATS, outputSize } from './formats';
import type { ConvertRequest, Outcome, WorkerMessage } from './types';

declare const self: DedicatedWorkerGlobalScope;

const post = (message: WorkerMessage, transfer: Transferable[] = []) =>
    self.postMessage(message, transfer);

self.onmessage = async ({ data }: MessageEvent<ConvertRequest>) => {
    const { images, format, quality, maxSide } = data;
    const { mime, extension, label, lossy } = FORMATS[format];
    const outputs: Uint8Array[] = [];
    const outcomes: Outcome[] = [];

    try {
        for (const [i, image] of images.entries()) {
            const bitmap = await createImageBitmap(image.blob, {
                imageOrientation: 'from-image',
            });
            const turned = isQuarterTurn(image.rotation);
            const size = outputSize(
                turned ? bitmap.height : bitmap.width,
                turned ? bitmap.width : bitmap.height,
                maxSide,
            );
            const canvas = new OffscreenCanvas(size.width, size.height);
            const context = canvas.getContext('2d');

            if (!context) {
                throw new Error('This browser cannot draw images.');
            }

            // JPG has no transparency, so transparent areas become white.
            if (format === 'jpg') {
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, size.width, size.height);
            }

            const width = turned ? size.height : size.width;
            const height = turned ? size.width : size.height;

            context.imageSmoothingQuality = 'high';
            context.translate(size.width / 2, size.height / 2);
            context.rotate((image.rotation * Math.PI) / 180);
            context.drawImage(bitmap, -width / 2, -height / 2, width, height);
            bitmap.close();

            // Re-drawing keeps only the pixels, so camera details and GPS
            // location in the original's metadata are left behind.
            const blob = await canvas.convertToBlob(
                lossy ? { type: mime, quality } : { type: mime },
            );

            if (blob.type !== mime) {
                throw new Error(`This browser can't save ${label} images.`);
            }

            outputs.push(new Uint8Array(await blob.arrayBuffer()));
            outcomes.push({ before: image.size, after: blob.size });
            post({ type: 'progress', done: i + 1, total: images.length });
        }

        if (outputs.length === 1) {
            post({ type: 'done', bytes: outputs[0], kind: 'image', outcomes }, [
                outputs[0].buffer,
            ]);

            return;
        }

        const names = withExtension(
            images.map((image) => image.name),
            extension,
            'image',
        );
        const bytes = zipSync(
            Object.fromEntries(names.map((name, i) => [name, outputs[i]])),
            { level: 0 },
        );

        post({ type: 'done', bytes, kind: 'zip', outcomes }, [bytes.buffer]);
    } catch (error) {
        post({
            type: 'error',
            message:
                error instanceof Error && error.message
                    ? error.message
                    : 'Something went wrong while converting.',
        });
    }
};
