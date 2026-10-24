import { describe, expect, it } from 'vitest';
import { jpegOrientation, orientationToRotation } from './exif';

/** A JPEG header with one EXIF APP1 segment holding the orientation tag. */
function jpegWithOrientation(orientation: number, little = false): Uint8Array {
    const u16 = (n: number) =>
        little ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff];
    const u32 = (n: number) =>
        little
            ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24]
            : [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
    const tiff = [
        ...(little ? [0x49, 0x49] : [0x4d, 0x4d]),
        ...u16(42),
        ...u32(8),
        ...u16(2),
        // An unrelated tag first (ImageWidth), then Orientation.
        ...u16(0x0100),
        ...u16(3),
        ...u32(1),
        ...u16(640),
        0,
        0,
        ...u16(0x0112),
        ...u16(3),
        ...u32(1),
        ...u16(orientation),
        0,
        0,
        ...u32(0),
    ];
    const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
    const length = app1.length + 2;

    return new Uint8Array([
        0xff,
        0xd8,
        // A JFIF APP0 segment before the EXIF one.
        0xff,
        0xe0,
        0x00,
        0x04,
        0x00,
        0x00,
        0xff,
        0xe1,
        length >> 8,
        length & 0xff,
        ...app1,
        0xff,
        0xda,
    ]);
}

describe('jpegOrientation', () => {
    it('reads big-endian EXIF', () => {
        expect(jpegOrientation(jpegWithOrientation(6))).toBe(6);
    });

    it('reads little-endian EXIF', () => {
        expect(jpegOrientation(jpegWithOrientation(8, true))).toBe(8);
    });

    it('defaults to 1 without EXIF, for non-JPEGs and for bad values', () => {
        expect(jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xda]))).toBe(
            1,
        );
        expect(jpegOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(
            1,
        );
        expect(jpegOrientation(jpegWithOrientation(42))).toBe(1);
    });

    it('does not read past a truncated segment', () => {
        expect(jpegOrientation(jpegWithOrientation(6).slice(0, 30))).toBe(1);
    });
});

describe('orientationToRotation', () => {
    it('maps the plain rotations and rejects mirrored ones', () => {
        expect([1, 3, 6, 8].map(orientationToRotation)).toEqual([
            0, 180, 90, 270,
        ]);
        expect([2, 4, 5, 7].map(orientationToRotation)).toEqual([
            null,
            null,
            null,
            null,
        ]);
    });
});
