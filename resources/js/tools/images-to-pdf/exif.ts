import type { Rotation } from './types';

/**
 * Read the EXIF orientation (1-8) from JPEG bytes. Returns 1 when there is
 * none. Only the first APP1 segment is read, so passing the file's first 128 KB
 * is enough.
 */
export function jpegOrientation(bytes: Uint8Array): number {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
        return 1;
    }

    let offset = 2;

    while (offset + 4 <= view.byteLength) {
        if (view.getUint8(offset) !== 0xff) {
            return 1;
        }

        const marker = view.getUint8(offset + 1);

        // Fill bytes before a marker.
        if (marker === 0xff) {
            offset += 1;
            continue;
        }

        // Start of scan or end of image: no EXIF before the image data.
        if (marker === 0xda || marker === 0xd9) {
            return 1;
        }

        const length = view.getUint16(offset + 2);

        if (marker === 0xe1 && isExifHeader(view, offset + 4)) {
            // Trust the declared length only as far as the bytes actually go.
            const end = Math.min(offset + 2 + length, view.byteLength);

            return readOrientation(view, offset + 10, end);
        }

        offset += 2 + length;
    }

    return 1;
}

/**
 * The clockwise turn that shows an image upright, or null for the mirrored
 * orientations (2, 4, 5, 7), which need re-drawing on a canvas.
 */
export function orientationToRotation(orientation: number): Rotation | null {
    switch (orientation) {
        case 1:
            return 0;
        case 3:
            return 180;
        case 6:
            return 90;
        case 8:
            return 270;
        default:
            return null;
    }
}

function isExifHeader(view: DataView, at: number): boolean {
    return (
        at + 6 <= view.byteLength &&
        view.getUint32(at) === 0x45786966 && // "Exif"
        view.getUint16(at + 4) === 0
    );
}

function readOrientation(view: DataView, tiff: number, end: number): number {
    if (tiff + 8 > end) {
        return 1;
    }

    const little = view.getUint16(tiff) === 0x4949; // "II"
    const ifd = tiff + view.getUint32(tiff + 4, little);

    if (ifd + 2 > end) {
        return 1;
    }

    const entries = view.getUint16(ifd, little);

    for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;

        if (entry + 12 > end) {
            return 1;
        }

        if (view.getUint16(entry, little) === 0x0112) {
            const value = view.getUint16(entry + 8, little);

            return value >= 1 && value <= 8 ? value : 1;
        }
    }

    return 1;
}
