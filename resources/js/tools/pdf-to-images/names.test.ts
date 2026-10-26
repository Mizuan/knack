import { describe, expect, it } from 'vitest';
import { pageImageNames } from './names';

describe('pageImageNames', () => {
    it('numbers pages from 1, padded to the page count', () => {
        expect(pageImageNames('report', [0, 1, 9], 12, 'jpg')).toEqual([
            'report-p01.jpg',
            'report-p02.jpg',
            'report-p10.jpg',
        ]);
    });

    it('does not pad short documents', () => {
        expect(pageImageNames('scan', [2], 3, 'png')).toEqual(['scan-p3.png']);
    });
});
