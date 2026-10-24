/** Clockwise rotation, in degrees, needed to show an image upright. */
export type Rotation = 0 | 90 | 180 | 270;

export type Size = { width: number; height: number };

export function addRotation(a: Rotation, b: Rotation): Rotation {
    return ((a + b) % 360) as Rotation;
}

export function isQuarterTurn(rotation: Rotation): boolean {
    return rotation === 90 || rotation === 270;
}

export function displayedSize(size: Size, rotation: Rotation): Size {
    return isQuarterTurn(rotation)
        ? { width: size.height, height: size.width }
        : { width: size.width, height: size.height };
}
