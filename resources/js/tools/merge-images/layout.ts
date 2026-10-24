import type { Size } from '@/lib/rotation';
import type { Align, Box, MergeOptions, Plan } from './types';

/**
 * Canvas limits that hold in every current browser: iOS Safari refuses
 * canvases over ~16.7 million pixels, and no browser goes past 16384 px a side.
 */
export const MAX_PIXELS = 16_000_000;
export const MAX_SIDE = 16_384;

export function columnsFor(count: number, columns: MergeOptions['columns']) {
    const wanted = columns === 'auto' ? Math.ceil(Math.sqrt(count)) : columns;

    return Math.max(1, Math.min(count, wanted));
}

function offset(room: number, size: number, align: Align): number {
    if (align === 'start') {
        return 0;
    }

    return align === 'center' ? (room - size) / 2 : room - size;
}

/**
 * Lay out upright images into one picture: where each goes and how big the
 * result is, scaled down to the chosen size and to what browsers can draw.
 */
export function planMerge(sizes: Size[], options: MergeOptions): Plan {
    if (sizes.length === 0) {
        return { width: 0, height: 0, boxes: [], limited: false };
    }

    const match = options.sizing === 'match';
    const widest = Math.max(...sizes.map((size) => size.width));
    const tallest = Math.max(...sizes.map((size) => size.height));
    let boxes: Box[];
    let width: number;
    let height: number;

    if (options.direction === 'vertical') {
        const gap = (widest * options.spacing) / 100;
        const pad = options.edges ? gap : 0;
        let y = pad;

        boxes = sizes.map((size) => {
            const w = match ? widest : size.width;
            const h = match ? (size.height * widest) / size.width : size.height;
            const box = {
                x: pad + offset(widest, w, options.align),
                y,
                width: w,
                height: h,
            };

            y += h + gap;

            return box;
        });

        width = widest + pad * 2;
        height = y - gap + pad;
    } else if (options.direction === 'horizontal') {
        const gap = (tallest * options.spacing) / 100;
        const pad = options.edges ? gap : 0;
        let x = pad;

        boxes = sizes.map((size) => {
            const h = match ? tallest : size.height;
            const w = match ? (size.width * tallest) / size.height : size.width;
            const box = {
                x,
                y: pad + offset(tallest, h, options.align),
                width: w,
                height: h,
            };

            x += w + gap;

            return box;
        });

        width = x - gap + pad;
        height = tallest + pad * 2;
    } else {
        const columns = columnsFor(sizes.length, options.columns);
        const rows = Math.ceil(sizes.length / columns);
        const gap = (Math.min(widest, tallest) * options.spacing) / 100;
        const pad = options.edges ? gap : 0;

        // Every cell is as big as the largest image; images sit centred in it.
        boxes = sizes.map((size, i) => {
            const scale = match
                ? Math.min(widest / size.width, tallest / size.height)
                : 1;
            const w = size.width * scale;
            const h = size.height * scale;
            const column = i % columns;
            const row = Math.floor(i / columns);

            return {
                x: pad + column * (widest + gap) + (widest - w) / 2,
                y: pad + row * (tallest + gap) + (tallest - h) / 2,
                width: w,
                height: h,
            };
        });

        width = columns * widest + (columns - 1) * gap + pad * 2;
        height = rows * tallest + (rows - 1) * gap + pad * 2;
    }

    const longest = Math.max(width, height);
    const wanted = Math.min(1, options.maxSide ? options.maxSide / longest : 1);
    const scale = Math.min(
        wanted,
        MAX_SIDE / longest,
        Math.sqrt(MAX_PIXELS / (width * height)),
    );

    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        boxes: boxes.map((box) => ({
            x: box.x * scale,
            y: box.y * scale,
            width: box.width * scale,
            height: box.height * scale,
        })),
        limited: scale < wanted,
    };
}
