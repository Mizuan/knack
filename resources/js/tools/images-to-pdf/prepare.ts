import { jpegOrientation, orientationToRotation } from './exif';
import { addRotation } from './layout';
import type { PreparedImage, Rotation } from './types';

/**
 * Canvas size limit: iOS Safari refuses canvases over 16.7 million pixels.
 * Larger images that need re-drawing are scaled down to fit.
 */
const MAX_CANVAS_PIXELS = 16_000_000;

export type SourceKind = 'jpg' | 'png' | 'other';

export function sniffKind(head: Uint8Array): SourceKind {
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
        return 'jpg';
    }

    if (
        head[0] === 0x89 &&
        head[1] === 0x50 &&
        head[2] === 0x4e &&
        head[3] === 0x47
    ) {
        return 'png';
    }

    return 'other';
}

/**
 * Turn a picked image into something pdf-lib can embed. JPEGs keep their
 * original bytes (no quality loss), PNGs stay lossless, and anything else is
 * drawn onto a white canvas and encoded as a high-quality JPEG.
 */
export async function prepareImage(
    source: Blob,
    rotation: Rotation,
): Promise<PreparedImage> {
    const bytes = new Uint8Array(await source.arrayBuffer());
    const kind = sniffKind(bytes);

    if (kind === 'jpg') {
        const turn = orientationToRotation(jpegOrientation(bytes));

        if (turn !== null) {
            return { kind, bytes, rotation: addRotation(turn, rotation) };
        }
    }

    if (kind === 'png') {
        return { kind, bytes, rotation };
    }

    return {
        kind: 'jpg',
        bytes: await redrawAsJpeg(source),
        rotation,
    };
}

async function redrawAsJpeg(source: Blob): Promise<Uint8Array> {
    let bitmap = await createImageBitmap(source, {
        imageOrientation: 'from-image',
    });
    const pixels = bitmap.width * bitmap.height;

    if (pixels > MAX_CANVAS_PIXELS) {
        const scale = Math.sqrt(MAX_CANVAS_PIXELS / pixels);
        const resized = await createImageBitmap(bitmap, {
            resizeWidth: Math.floor(bitmap.width * scale),
            resizeHeight: Math.floor(bitmap.height * scale),
            resizeQuality: 'high',
        });

        bitmap.close();
        bitmap = resized;
    }

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');

    if (!context) {
        bitmap.close();
        throw new Error('This browser cannot draw images.');
    }

    // PDF pages are white, so transparent areas become white rather than black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: 0.92,
    });

    return new Uint8Array(await blob.arrayBuffer());
}
