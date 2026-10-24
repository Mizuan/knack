/// <reference lib="webworker" />
import { isQuarterTurn } from '@/lib/rotation';
import type { MergeRequest, WorkerMessage } from './types';

declare const self: DedicatedWorkerGlobalScope;

const post = (message: WorkerMessage) => self.postMessage(message);

self.onmessage = async ({ data }: MessageEvent<MergeRequest>) => {
    const { images, plan, background, format } = data;

    try {
        const canvas = new OffscreenCanvas(plan.width, plan.height);
        const context = canvas.getContext('2d');

        if (!context) {
            throw new Error('This browser cannot draw images.');
        }

        context.imageSmoothingQuality = 'high';

        if (background) {
            context.fillStyle = background;
            context.fillRect(0, 0, plan.width, plan.height);
        }

        // Decode and draw one image at a time to keep memory low.
        for (const [i, image] of images.entries()) {
            const box = plan.boxes[i];
            const bitmap = await createImageBitmap(image.blob, {
                imageOrientation: 'from-image',
            });
            const turned = isQuarterTurn(image.rotation);
            const width = turned ? box.height : box.width;
            const height = turned ? box.width : box.height;

            context.save();
            context.translate(box.x + box.width / 2, box.y + box.height / 2);
            context.rotate((image.rotation * Math.PI) / 180);
            context.drawImage(bitmap, -width / 2, -height / 2, width, height);
            context.restore();
            bitmap.close();

            post({ type: 'progress', done: i + 1, total: images.length });
        }

        const blob = await canvas.convertToBlob({
            type: format,
            quality: 0.92,
        });

        post({ type: 'done', blob });
    } catch (error) {
        post({
            type: 'error',
            message:
                error instanceof Error
                    ? error.message
                    : 'Something went wrong while merging the images.',
        });
    }
};
