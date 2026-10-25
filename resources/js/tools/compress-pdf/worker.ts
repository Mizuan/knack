/// <reference lib="webworker" />
import { zipSync } from 'fflate';
import { pdfNames } from '@/lib/file-names';
import { compressPdf, STRENGTHS } from './compress';
import type {
    CompressRequest,
    FileOutcome,
    ImageJob,
    ImageSettings,
    Recompressed,
    WorkerMessage,
} from './types';

declare const self: DedicatedWorkerGlobalScope;

const post = (message: WorkerMessage, transfer: Transferable[] = []) =>
    self.postMessage(message, transfer);

/** PDF viewers ignore JPEG orientation tags, so decode without applying them. */
async function decodeJpeg(bytes: Uint8Array): Promise<ImageBitmap> {
    const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], {
        type: 'image/jpeg',
    });

    try {
        return await createImageBitmap(blob, { imageOrientation: 'none' });
    } catch {
        return createImageBitmap(blob);
    }
}

function pixelsToBitmap(job: Extract<ImageJob, { kind: 'pixels' }>) {
    const rgba = new Uint8ClampedArray(job.width * job.height * 4);

    for (let i = 0, j = 0; i < rgba.length; i += 4, j += job.channels) {
        rgba[i] = job.pixels[j];
        rgba[i + 1] = job.pixels[job.channels === 3 ? j + 1 : j];
        rgba[i + 2] = job.pixels[job.channels === 3 ? j + 2 : j];
        rgba[i + 3] = 255;
    }

    return createImageBitmap(new ImageData(rgba, job.width, job.height));
}

/** Shrink an image to the chosen size and save it as a JPEG. */
async function recompress(
    job: ImageJob,
    { maxSide, quality }: ImageSettings,
): Promise<Recompressed | null> {
    try {
        const source =
            job.kind === 'jpeg'
                ? await decodeJpeg(job.bytes)
                : await pixelsToBitmap(job);
        const scale = Math.min(
            1,
            maxSide / Math.max(source.width, source.height),
        );
        const width = Math.max(1, Math.round(source.width * scale));
        const height = Math.max(1, Math.round(source.height * scale));
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d');

        if (!context) {
            source.close();

            return null;
        }

        context.imageSmoothingQuality = 'high';
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(source, 0, 0, width, height);
        source.close();

        const blob = await canvas.convertToBlob({
            type: 'image/jpeg',
            quality,
        });

        return {
            bytes: new Uint8Array(await blob.arrayBuffer()),
            width,
            height,
        };
    } catch {
        // An image the browser can't decode stays as it was.
        return null;
    }
}

self.onmessage = async ({ data }: MessageEvent<CompressRequest>) => {
    const { files, strength } = data;
    const settings = STRENGTHS[strength];
    const single = files.length === 1;
    const outcomes: FileOutcome[] = [];
    const outputs: Uint8Array[] = [];

    try {
        for (const [i, file] of files.entries()) {
            const input = new Uint8Array(await file.blob.arrayBuffer());
            let output: Uint8Array = input;
            let failed = false;

            try {
                const { bytes } = await compressPdf(
                    input,
                    settings,
                    recompress,
                    single
                        ? (done, total) =>
                              post({ type: 'progress', done, total })
                        : undefined,
                );

                // Never hand back a bigger file.
                if (bytes.length < input.length) {
                    output = bytes;
                }
            } catch {
                failed = true;
            }

            outcomes.push({
                before: input.length,
                after: output.length,
                failed,
            });
            outputs.push(output);

            if (!single) {
                post({ type: 'progress', done: i + 1, total: files.length });
            }
        }

        if (single) {
            post({ type: 'done', bytes: outputs[0], kind: 'pdf', outcomes }, [
                outputs[0].buffer,
            ]);

            return;
        }

        const names = pdfNames(files.map((file) => file.name));
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
                    : 'Something went wrong while compressing.',
        });
    }
};
