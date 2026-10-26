import { describe, expect, it } from 'vitest';
import { isEncrypted, parsePages } from './page-ranges';

describe('parsePages', () => {
    it('takes every page when empty or "all"', () => {
        expect(parsePages('', 3).pages).toEqual([0, 1, 2]);
        expect(parsePages(' All ', 2).pages).toEqual([0, 1]);
    });

    it('reads single pages and ranges in the order written', () => {
        expect(parsePages('1-3, 5', 6).pages).toEqual([0, 1, 2, 4]);
        expect(parsePages('6, 1', 6).pages).toEqual([5, 0]);
    });

    it('allows open-ended and backwards ranges', () => {
        expect(parsePages('-2', 5).pages).toEqual([0, 1]);
        expect(parsePages('4-', 5).pages).toEqual([3, 4]);
        expect(parsePages('3-1', 5).pages).toEqual([2, 1, 0]);
        expect(parsePages('2 – 3', 5).pages).toEqual([1, 2]);
    });

    it('explains pages that do not exist', () => {
        expect(parsePages('2-9', 4)).toEqual({
            pages: null,
            error: "There's no page 9; this PDF has 4 pages.",
        });
        expect(parsePages('0', 1).error).toBe(
            "There's no page 0; this PDF has 1 page.",
        );
    });

    it('rejects text that is not a page or range', () => {
        expect(parsePages('1, two', 3).error).toBe(
            '"two" isn\'t a page or range.',
        );
        expect(parsePages(',,', 3).error).toBe('Choose at least one page.');
    });
});

describe('isEncrypted', () => {
    const bytes = (text: string) => new TextEncoder().encode(text);

    it('finds the /Encrypt key in the trailer', () => {
        expect(isEncrypted(bytes('trailer << /Size 9 /Encrypt 7 0 R >>'))).toBe(
            true,
        );
        expect(isEncrypted(bytes('<</Encrypt<</Filter/Standard>>>>'))).toBe(
            true,
        );
    });

    it('ignores plain PDFs and longer key names', () => {
        expect(isEncrypted(bytes('trailer << /Size 9 /Root 1 0 R >>'))).toBe(
            false,
        );
        expect(isEncrypted(bytes('/EncryptMetadata false'))).toBe(false);
    });
});
