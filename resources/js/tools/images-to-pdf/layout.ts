import type { Margin, PdfOptions, Rotation } from './types';

type Size = { width: number; height: number };
type Box = Size & { x: number; y: number };

/** Page sizes in PDF points (1/72 inch), portrait. */
export const PAGE_SIZES = {
    a4: { width: 595.28, height: 841.89 },
    letter: { width: 612, height: 792 },
} as const;

export const MARGINS: Record<Margin, number> = {
    none: 0,
    small: 18,
    normal: 36,
};

/**
 * "Fit to image" pages keep the image's shape, scaled so the long side matches
 * A4. The image keeps its full resolution; only the page's printed size is set.
 */
const FIT_LONG_SIDE = PAGE_SIZES.a4.height;

export function addRotation(a: Rotation, b: Rotation): Rotation {
    return ((a + b) % 360) as Rotation;
}

export function displayedSize(size: Size, rotation: Rotation): Size {
    return rotation === 90 || rotation === 270
        ? { width: size.height, height: size.width }
        : size;
}

export function pageSizeFor(image: Size, options: PdfOptions): Size {
    const margin = MARGINS[options.margin];

    if (options.pageSize === 'fit') {
        const scale = FIT_LONG_SIDE / Math.max(image.width, image.height);

        return {
            width: image.width * scale + margin * 2,
            height: image.height * scale + margin * 2,
        };
    }

    const page = PAGE_SIZES[options.pageSize];
    const landscape =
        options.orientation === 'landscape' ||
        (options.orientation === 'auto' && image.width > image.height);

    return landscape
        ? { width: page.height, height: page.width }
        : { width: page.width, height: page.height };
}

/** The largest box with the image's shape that fits inside the margins, centred. */
export function placeImage(page: Size, image: Size, margin: Margin): Box {
    const inset = MARGINS[margin];
    const room = {
        width: page.width - inset * 2,
        height: page.height - inset * 2,
    };
    const scale = Math.min(
        room.width / image.width,
        room.height / image.height,
    );
    const width = image.width * scale;
    const height = image.height * scale;

    return {
        x: (page.width - width) / 2,
        y: (page.height - height) / 2,
        width,
        height,
    };
}

/**
 * pdf-lib draws an image from its bottom-left corner and rotates it
 * counter-clockwise around that corner. Given the upright box the image should
 * fill, return the origin and unrotated size that land it there.
 */
export function drawParams(box: Box, rotation: Rotation) {
    const turned = rotation === 90 || rotation === 270;
    const width = turned ? box.height : box.width;
    const height = turned ? box.width : box.height;
    const origin = {
        0: { x: box.x, y: box.y },
        90: { x: box.x, y: box.y + box.height },
        180: { x: box.x + box.width, y: box.y + box.height },
        270: { x: box.x + box.width, y: box.y },
    }[rotation];

    return { ...origin, width, height, rotate: -rotation };
}
