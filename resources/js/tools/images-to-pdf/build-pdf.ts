import { degrees, PDFDocument } from 'pdf-lib';
import { displayedSize } from '@/lib/rotation';
import { drawParams, pageSizeFor, placeImage } from './layout';
import type { PdfOptions, PreparedImage } from './types';

/**
 * Build a PDF with one page per image. Images are loaded one at a time through
 * `load` so only the one being embedded needs decoding.
 */
export async function buildPdf(
    count: number,
    load: (index: number) => Promise<PreparedImage>,
    options: PdfOptions,
    meta: { title: string },
    onProgress?: (done: number) => void,
): Promise<Uint8Array> {
    const doc = await PDFDocument.create();

    doc.setTitle(meta.title);
    doc.setCreator('Tinyfold');
    doc.setProducer('Tinyfold');

    for (let i = 0; i < count; i++) {
        const prepared = await load(i);
        const image =
            prepared.kind === 'jpg'
                ? await doc.embedJpg(prepared.bytes)
                : await doc.embedPng(prepared.bytes);

        const upright = displayedSize(image, prepared.rotation);
        const pageSize = pageSizeFor(upright, options);
        const page = doc.addPage([pageSize.width, pageSize.height]);
        const box = placeImage(pageSize, upright, options.margin);
        const { rotate, ...params } = drawParams(box, prepared.rotation);

        page.drawImage(image, { ...params, rotate: degrees(rotate) });
        onProgress?.(i + 1);
    }

    return doc.save();
}
