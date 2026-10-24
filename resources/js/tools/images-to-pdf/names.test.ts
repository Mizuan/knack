import { describe, expect, it } from 'vitest';
import { pdfNames } from './names';

describe('pdfNames', () => {
    it('swaps the image extension for .pdf', () => {
        expect(pdfNames(['IMG_0012.HEIC', 'scan.final.png'])).toEqual([
            'IMG_0012.pdf',
            'scan.final.pdf',
        ]);
    });

    it('numbers duplicates, ignoring case', () => {
        expect(pdfNames(['photo.jpg', 'Photo.png', 'photo.webp'])).toEqual([
            'photo.pdf',
            'Photo (2).pdf',
            'photo (3).pdf',
        ]);
    });

    it('cleans unsafe characters and falls back to the page number', () => {
        expect(pdfNames(['a/b:c?.jpg', '.png'])).toEqual([
            'a b c.pdf',
            'page-2.pdf',
        ]);
    });
});
