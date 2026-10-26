import { describe, expect, it } from 'vitest';
import { groupName, splitGroups } from './split';

describe('splitGroups', () => {
    const pages = [0, 1, 2, 3, 4];

    it('extracts the chosen pages into one PDF', () => {
        expect(splitGroups([2, 0], 'extract')).toEqual([[2, 0]]);
    });

    it('makes one PDF per page', () => {
        expect(splitGroups(pages, 'each')).toEqual([[0], [1], [2], [3], [4]]);
    });

    it('chunks every N pages, with a shorter last one', () => {
        expect(splitGroups(pages, 'every', 2)).toEqual([[0, 1], [2, 3], [4]]);
        expect(splitGroups(pages, 'every', 0)).toHaveLength(5);
    });

    it('makes nothing from no pages', () => {
        expect(splitGroups([], 'each')).toEqual([]);
    });
});

describe('groupName', () => {
    it('names single pages and runs, padded to the page count', () => {
        expect(groupName('report', [2], 0, 12)).toBe('report-p03.pdf');
        expect(groupName('report', [2, 3, 4], 0, 12)).toBe('report-p03-05.pdf');
        expect(groupName('scan', [0, 1], 0, 4)).toBe('scan-p1-2.pdf');
    });

    it('falls back to a part number when pages are not in a run', () => {
        expect(groupName('report', [4, 0], 1, 9)).toBe('report-part2.pdf');
    });
});
