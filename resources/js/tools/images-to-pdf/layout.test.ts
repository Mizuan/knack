import { describe, expect, it } from 'vitest';
import {
    addRotation,
    displayedSize,
    drawParams,
    PAGE_SIZES,
    pageSizeFor,
    placeImage,
} from './layout';
import type { PdfOptions, Rotation } from './types';

const options = (overrides: Partial<PdfOptions> = {}): PdfOptions => ({
    pageSize: 'a4',
    orientation: 'auto',
    margin: 'none',
    ...overrides,
});

describe('pageSizeFor', () => {
    it('turns A4 sideways for wide images when orientation is auto', () => {
        expect(pageSizeFor({ width: 300, height: 200 }, options())).toEqual({
            width: PAGE_SIZES.a4.height,
            height: PAGE_SIZES.a4.width,
        });
        expect(pageSizeFor({ width: 200, height: 300 }, options())).toEqual(
            PAGE_SIZES.a4,
        );
    });

    it('keeps the chosen orientation whatever the image shape', () => {
        expect(
            pageSizeFor(
                { width: 300, height: 200 },
                options({ pageSize: 'letter', orientation: 'portrait' }),
            ),
        ).toEqual(PAGE_SIZES.letter);
    });

    it('shapes "fit" pages like the image, long side A4, plus margins', () => {
        const page = pageSizeFor(
            { width: 4000, height: 2000 },
            options({ pageSize: 'fit', margin: 'small' }),
        );

        expect(page.width).toBeCloseTo(PAGE_SIZES.a4.height + 36);
        expect(page.height).toBeCloseTo(PAGE_SIZES.a4.height / 2 + 36);
    });
});

describe('placeImage', () => {
    it('fits the image inside the margins and centres it', () => {
        const box = placeImage(
            { width: 600, height: 800 },
            { width: 200, height: 100 },
            'normal',
        );

        expect(box.width).toBeCloseTo(528);
        expect(box.height).toBeCloseTo(264);
        expect(box.x).toBeCloseTo(36);
        expect(box.y).toBeCloseTo((800 - 264) / 2);
    });
});

describe('rotation helpers', () => {
    it('wraps rotations past a full turn', () => {
        expect(addRotation(270, 180)).toBe(90);
        expect(addRotation(90, 270)).toBe(0);
    });

    it('swaps width and height for quarter turns', () => {
        expect(displayedSize({ width: 3, height: 2 }, 90)).toEqual({
            width: 2,
            height: 3,
        });
        expect(displayedSize({ width: 3, height: 2 }, 180)).toEqual({
            width: 3,
            height: 2,
        });
    });
});

describe('drawParams', () => {
    // Where the image's corners land after pdf-lib rotates it
    // counter-clockwise around its origin.
    const footprint = (p: ReturnType<typeof drawParams>) => {
        const radians = (p.rotate * Math.PI) / 180;
        const corners = [
            [0, 0],
            [p.width, 0],
            [0, p.height],
            [p.width, p.height],
        ].map(([u, v]) => [
            p.x + u * Math.cos(radians) - v * Math.sin(radians),
            p.y + u * Math.sin(radians) + v * Math.cos(radians),
        ]);
        const xs = corners.map(([x]) => x);
        const ys = corners.map(([, y]) => y);

        return {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
        };
    };

    it.each([0, 90, 180, 270] as Rotation[])(
        'fills the target box exactly at %i°',
        (rotation) => {
            const box = { x: 20, y: 30, width: 400, height: 250 };
            const landed = footprint(drawParams(box, rotation));

            expect(landed.x).toBeCloseTo(box.x);
            expect(landed.y).toBeCloseTo(box.y);
            expect(landed.width).toBeCloseTo(box.width);
            expect(landed.height).toBeCloseTo(box.height);
        },
    );
});
