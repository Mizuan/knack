import { describe, expect, it, vi } from 'vitest';
import { fitToSize } from './fit';

/** A fake encoder: size grows with pixels and quality, like a real JPEG. */
const fakeEncoder = (bytesPerPixel = 1) =>
    vi.fn(
        async (width: number, height: number, quality: number) =>
            new Blob([
                new Uint8Array(
                    Math.round(width * height * bytesPerPixel * quality),
                ),
            ]),
    );

describe('fitToSize', () => {
    it('keeps full size and top quality when it already fits', async () => {
        const encode = fakeEncoder();
        const result = await fitToSize(100, 100, 1_000_000, encode);

        expect(result).toMatchObject({
            width: 100,
            height: 100,
            quality: 0.92,
            fits: true,
        });
        expect(encode).toHaveBeenCalledTimes(1);
    });

    it('lowers quality before touching the size', async () => {
        // 1000×1000 at 0.92 ≈ 920 KB; the limit needs about 0.7.
        const result = await fitToSize(1000, 1000, 700_000, fakeEncoder());

        expect(result.fits).toBe(true);
        expect([result.width, result.height]).toEqual([1000, 1000]);
        expect(result.blob.size).toBeLessThanOrEqual(700_000);
        expect(result.quality).toBeGreaterThan(0.6);
    });

    it('shrinks the image when quality alone is not enough', async () => {
        // Even at the lowest quality, 4000×3000 is ~5.4 MB; the limit is 1 MB.
        const result = await fitToSize(4000, 3000, 1_000_000, fakeEncoder());

        expect(result.fits).toBe(true);
        expect(result.blob.size).toBeLessThanOrEqual(1_000_000);
        expect(result.width).toBeLessThan(4000);
        expect(result.width / result.height).toBeCloseTo(4000 / 3000, 1);
    });

    it('reports when nothing fits, without going below the minimum size', async () => {
        const result = await fitToSize(2000, 2000, 10, fakeEncoder(), {
            minSide: 320,
        });

        expect(result.fits).toBe(false);
        expect(Math.max(result.width, result.height)).toBeGreaterThanOrEqual(
            320,
        );
    });
});
