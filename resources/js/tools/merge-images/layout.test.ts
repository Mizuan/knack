import { describe, expect, it } from 'vitest';
import { columnsFor, MAX_PIXELS, planMerge } from './layout';
import type { MergeOptions } from './types';

const options = (overrides: Partial<MergeOptions> = {}): MergeOptions => ({
    direction: 'vertical',
    sizing: 'match',
    align: 'center',
    columns: 'auto',
    spacing: 0,
    edges: false,
    maxSide: null,
    ...overrides,
});

const wide = { width: 400, height: 200 };
const small = { width: 200, height: 200 };

describe('planMerge', () => {
    it('stacks images at the same width', () => {
        const plan = planMerge([wide, small], options());

        expect(plan.width).toBe(400);
        expect(plan.height).toBe(600);
        expect(plan.boxes).toEqual([
            { x: 0, y: 0, width: 400, height: 200 },
            { x: 0, y: 200, width: 400, height: 400 },
        ]);
    });

    it('puts images side by side at the same height', () => {
        const plan = planMerge(
            [wide, small],
            options({ direction: 'horizontal' }),
        );

        expect([plan.width, plan.height]).toEqual([600, 200]);
        expect(plan.boxes[1]).toEqual({
            x: 400,
            y: 0,
            width: 200,
            height: 200,
        });
    });

    it('keeps original sizes and aligns them', () => {
        const plan = planMerge(
            [wide, small],
            options({ sizing: 'original', align: 'end' }),
        );

        expect([plan.width, plan.height]).toEqual([400, 400]);
        expect(plan.boxes[1]).toEqual({
            x: 200,
            y: 200,
            width: 200,
            height: 200,
        });
    });

    it('adds spacing between images and, if asked, around them', () => {
        const between = planMerge([wide, wide], options({ spacing: 5 }));
        const around = planMerge(
            [wide, wide],
            options({ spacing: 5, edges: true }),
        );

        // 5% of 400 px = 20 px
        expect([between.width, between.height]).toEqual([400, 420]);
        expect(between.boxes[1].y).toBe(220);
        expect([around.width, around.height]).toEqual([440, 460]);
        expect(around.boxes[0]).toMatchObject({ x: 20, y: 20 });
    });

    it('lays out a grid with centred images in equal cells', () => {
        const plan = planMerge(
            [wide, small, wide],
            options({ direction: 'grid' }),
        );

        // 3 images → 2 columns, 2 rows of 400×200 cells
        expect([plan.width, plan.height]).toEqual([800, 400]);
        expect(plan.boxes[1]).toEqual({
            x: 500,
            y: 0,
            width: 200,
            height: 200,
        });
        expect(plan.boxes[2]).toEqual({
            x: 0,
            y: 200,
            width: 400,
            height: 200,
        });
    });

    it('scales down to the chosen size without flagging a limit', () => {
        const plan = planMerge([wide, small], options({ maxSide: 300 }));

        expect([plan.width, plan.height]).toEqual([200, 300]);
        expect(plan.boxes[1]).toEqual({
            x: 0,
            y: 100,
            width: 200,
            height: 200,
        });
        expect(plan.limited).toBe(false);
    });

    it('never upscales when the chosen size is bigger', () => {
        expect(planMerge([wide], options({ maxSide: 4000 })).width).toBe(400);
    });

    it('stays inside what browsers can draw', () => {
        const photo = { width: 6000, height: 4000 };
        const plan = planMerge([photo, photo, photo], options());

        expect(plan.width * plan.height).toBeLessThanOrEqual(MAX_PIXELS);
        expect(plan.limited).toBe(true);
    });
});

describe('columnsFor', () => {
    it('picks a near-square grid when automatic, never more than the images', () => {
        expect([1, 2, 4, 5, 9, 10].map((n) => columnsFor(n, 'auto'))).toEqual([
            1, 2, 2, 3, 3, 4,
        ]);
        expect(columnsFor(2, 4)).toBe(2);
    });
});
