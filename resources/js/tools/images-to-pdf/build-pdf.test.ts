import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildPdf } from './build-pdf';
import { jpegOrientation, orientationToRotation } from './exif';
import { PAGE_SIZES } from './layout';
import { sniffKind } from './prepare';
import type { PdfOptions, PreparedImage } from './types';

const fixture = (name: string) =>
    new Uint8Array(
        readFileSync(
            resolve(__dirname, '../../../../tests/fixtures/images', name),
        ),
    );

// What prepareImage does for JPEG and PNG files (the canvas path needs a browser).
const prepared = (name: string): PreparedImage => {
    const bytes = fixture(name);
    const kind = sniffKind(bytes);

    if (kind === 'other') {
        throw new Error(`${name} is not a JPEG or PNG`);
    }

    return {
        kind,
        bytes,
        rotation:
            kind === 'jpg'
                ? (orientationToRotation(jpegOrientation(bytes)) ?? 0)
                : 0,
    };
};

const build = async (names: string[], options: Partial<PdfOptions> = {}) => {
    const bytes = await buildPdf(
        names.length,
        async (i) => prepared(names[i]),
        { pageSize: 'a4', orientation: 'auto', margin: 'none', ...options },
        { title: 'Test' },
    );

    return PDFDocument.load(bytes);
};

describe('buildPdf', () => {
    it('makes one page per image, in order', async () => {
        const doc = await build([
            'landscape.jpg',
            'landscape.png',
            'rotated-exif-6.jpg',
        ]);
        const sizes = doc.getPages().map((page) => page.getSize());

        expect(doc.getPageCount()).toBe(3);
        expect(sizes[0].width).toBeGreaterThan(sizes[0].height);
        expect(sizes[1].width).toBeGreaterThan(sizes[1].height);
        // The EXIF-rotated photo is 60x40 on disk but upright it's portrait.
        expect(sizes[2]).toEqual(PAGE_SIZES.a4);
        expect(doc.getTitle()).toBe('Test');
    });

    it('sizes "fit" pages to the upright image', async () => {
        const doc = await build(['landscape.jpg', 'rotated-exif-6.jpg'], {
            pageSize: 'fit',
        });
        const [wide, tall] = doc.getPages().map((page) => page.getSize());

        expect(wide.width / wide.height).toBeCloseTo(60 / 40);
        expect(tall.width / tall.height).toBeCloseTo(40 / 60);
    });

    it('embeds JPEG bytes without re-encoding them', async () => {
        const original = fixture('landscape.jpg');
        const doc = await build(['landscape.jpg']);
        const saved = await doc.save();

        expect(
            Buffer.from(saved).includes(Buffer.from(original.slice(2))),
        ).toBe(true);
    });

    it('reports progress after each page', async () => {
        const seen: number[] = [];

        await buildPdf(
            2,
            async () => prepared('landscape.png'),
            { pageSize: 'letter', orientation: 'auto', margin: 'small' },
            { title: 'Progress' },
            (done) => seen.push(done),
        );

        expect(seen).toEqual([1, 2]);
    });
});
