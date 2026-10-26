/// <reference lib="webworker" />
import { zipSync } from 'fflate';
import { withExtension } from '@/lib/file-names';
import { isQuarterTurn } from '@/lib/rotation';
import { FORMATS, outputSize } from '@/tools/convert-images/formats';
import { fitToSize } from './fit';
import type { ShrinkOutcome, ShrinkRequest, WorkerMessage } from './types';

declare const self: DedicatedWorkerGlobalScope;

const post = (message: WorkerMessage, transfer: Transferable[] = []) =>
    self.postMessage(message, transfer);

self.onmessage = async ({ data }: MessageEvent<ShrinkRequest>) => {
    const { images, target, format } = data;
    const { mime, extension } = FORMATS[format];
    const outputs: Uint8Array[] = [];
    const outcomes: ShrinkOutcome[] = [];

    try {
        for (const [i, image] of images.entries()) {
            // Already small enough and in the right format: leave it alone.
            if (
                image.size <= target &&
                image.blob.type === mime &&
                image.rotation === 0
            ) {
                outputs.push(new Uint8Array(await image.blob.arrayBuffer()));
                outcomes.push({
                    before: image.size,
                    after: image.size,
                    fits: true,
                    unchanged: true,
                    resized: false,
                });
                post({ type: 'progress', done: i + 1, total: images.length });
                continue;
            }

            const bitmap = await createImageBitmap(image.blob, {
                imageOrientation: 'from-image',
            });
            const turned = isQuarterTurn(image.rotation);
            const upright = outputSize(
                turned ? bitmap.height : bitmap.width,
                turned ? bitmap.width : bitmap.height,
                null,
            );

            const encode = async (
                width: number,
                height: number,
                quality: number,
            ) => {
                const canvas = new OffscreenCanvas(width, height);
                const context = canvas.getContext('2d');

                if (!context) {
                    throw new Error('This browser cannot draw images.');
                }

                if (format === 'jpg') {
                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, width, height);
                }

                const w = turned ? height : width;
                const h = turned ? width : height;

                context.imageSmoothingQuality = 'high';
                context.translate(width / 2, height / 2);
                context.rotate((image.rotation * Math.PI) / 180);
                context.drawImage(bitmap, -w / 2, -h / 2, w, h);

                const blob = await canvas.convertToBlob({
                    type: mime,
                    quality,
                });

                if (blob.type !== mime) {
                    throw new Error(
                        `This browser can't save ${FORMATS[format].label} images.`,
                    );
                }

                return blob;
            };

            const result = await fitToSize(
                upright.width,
                upright.height,
                target,
                encode,
            );

            bitmap.close();
            outputs.push(new Uint8Array(await result.blob.arrayBuffer()));
            outcomes.push({
                before: image.size,
                after: result.blob.size,
                fits: result.fits,
                unchanged: false,
                resized: result.width < upright.width,
            });
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
                    : 'Something went wrong while shrinking.',
        });
    }
};
