import { zipSync } from 'fflate';
import { withExtension } from '@/lib/file-names';
import { loadPdfJs } from '@/lib/pdf';
import type { Rotation } from '@/lib/rotation';
import { MAX_PIXELS } from '@/tools/convert-images/formats';
import { pageImageNames } from './names';

export type PageImageFormat = 'jpg' | 'png';

export type RenderFile = {
    blob: Blob;
    name: string;
    rotation: Rotation;
    /** Zero-based pages to render, in order. */
    pages: number[];
};

const MIME: Record<PageImageFormat, string> = {
    jpg: 'image/jpeg',
    png: 'image/png',
};

/** Stops a render part-way; the caller catches it and says nothing. */
export class RenderCancelled extends Error {}

/**
 * Draw the chosen pages as images with pdf.js. Parsing happens in pdf.js's
 * own worker; each page is drawn here, one at a time, with a pause in between
 * so the page stays responsive.
 */
export async function renderPdfPages(
    files: RenderFile[],
    {
        format,
        dpi,
        quality,
    }: { format: PageImageFormat; dpi: number; quality: number },
    onProgress: (done: number, total: number) => void,
    isCancelled: () => boolean,
): Promise<{ blob: Blob; kind: 'image' | 'zip'; count: number }> {
    const { getDocument } = await loadPdfJs();
    const total = files.reduce((sum, file) => sum + file.pages.length, 0);
    const bases = withExtension(
        files.map((file) => file.name),
        'pdf',
        'document',
    ).map((name) => name.replace(/\.pdf$/, ''));
    const images: [string, Uint8Array][] = [];
    let last: Blob | null = null;

    onProgress(0, total);

    for (const [f, file] of files.entries()) {
        const task = getDocument({
            data: new Uint8Array(await file.blob.arrayBuffer()),
        });
        const document = await task.promise;

        try {
            const names = pageImageNames(
                bases[f],
                file.pages,
                document.numPages,
                format,
            );

            for (const [i, index] of file.pages.entries()) {
                if (isCancelled()) {
                    throw new RenderCancelled();
                }

                const page = await document.getPage(index + 1);
                const rotation = (page.rotate + file.rotation) % 360;
                const natural = page.getViewport({ scale: 1, rotation });
                const scale = Math.min(
                    dpi / 72,
                    Math.sqrt(MAX_PIXELS / (natural.width * natural.height)),
                );
                const viewport = page.getViewport({ scale, rotation });
                const canvas = window.document.createElement('canvas');

                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);

                await page.render({ canvas, viewport, background: '#ffffff' })
                    .promise;

                const blob = await new Promise<Blob | null>((resolve) =>
                    canvas.toBlob(resolve, MIME[format], quality),
                );

                canvas.width = canvas.height = 0;
                page.cleanup();

                if (!blob) {
                    throw new Error('Could not save a page as an image.');
                }

                last = blob;
                images.push([
                    names[i],
                    new Uint8Array(await blob.arrayBuffer()),
                ]);
                onProgress(images.length, total);

                // Let the browser paint and handle input between pages.
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        } finally {
            await task.destroy();
        }
    }

    if (images.length === 1 && last) {
        return { blob: last, kind: 'image', count: 1 };
    }

    const zip = zipSync(Object.fromEntries(images), { level: 0 });

    return {
        blob: new Blob([zip as Uint8Array<ArrayBuffer>], {
            type: 'application/zip',
        }),
        kind: 'zip',
        count: images.length,
    };
}
