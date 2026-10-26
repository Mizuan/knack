import { degrees, PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { assemblePages } from './assemble';

/** A PDF whose pages have distinct widths, so their order can be checked. */
async function samplePdf(widths: number[]) {
    const document = await PDFDocument.create();

    widths.forEach((width) => document.addPage([width, 400]));

    return document.save();
}

const widthsOf = async (bytes: Uint8Array) =>
    (await PDFDocument.load(bytes)).getPages().map((page) => page.getWidth());

describe('assemblePages', () => {
    it('reorders pages across PDFs and drops the ones left out', async () => {
        const a = await samplePdf([100, 110, 120]);
        const b = await samplePdf([200, 210]);

        const result = await assemblePages(
            [a, b],
            [
                { source: 1, page: 1, rotation: 0 },
                { source: 0, page: 0, rotation: 0 },
                { source: 0, page: 2, rotation: 0 },
            ],
            'Mixed',
        );

        expect(await widthsOf(result)).toEqual([210, 100, 120]);
        expect((await PDFDocument.load(result)).getTitle()).toBe('Mixed');
    });

    it('adds the chosen rotation to a page’s own rotation', async () => {
        const document = await PDFDocument.create();

        document.addPage([100, 200]).setRotation(degrees(90));

        const result = await assemblePages(
            [await document.save()],
            [{ source: 0, page: 0, rotation: 270 }],
            'Turned',
        );
        const [page] = (await PDFDocument.load(result)).getPages();

        expect(page.getRotation().angle).toBe(0);
    });

    it('can use the same page twice and reports progress', async () => {
        const seen: number[] = [];
        const result = await assemblePages(
            [await samplePdf([100, 110])],
            [
                { source: 0, page: 1, rotation: 0 },
                { source: 0, page: 1, rotation: 90 },
            ],
            'Twice',
            (done) => seen.push(done),
        );

        expect(await widthsOf(result)).toEqual([110, 110]);
        expect(seen).toEqual([1, 2]);
    });
});
