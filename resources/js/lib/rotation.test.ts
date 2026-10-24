import { describe, expect, it } from 'vitest';
import { addRotation, displayedSize } from './rotation';

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
