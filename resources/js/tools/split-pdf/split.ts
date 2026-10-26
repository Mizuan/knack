export type SplitMode = 'extract' | 'each' | 'every';

/** Group the chosen pages (zero-based) into the PDFs to make. */
export function splitGroups(
    pages: number[],
    mode: SplitMode,
    chunk = 2,
): number[][] {
    if (pages.length === 0) {
        return [];
    }

    if (mode === 'extract') {
        return [pages];
    }

    const size = mode === 'each' ? 1 : Math.max(1, Math.floor(chunk));
    const groups: number[][] = [];

    for (let i = 0; i < pages.length; i += size) {
        groups.push(pages.slice(i, i + size));
    }

    return groups;
}

/**
 * Name a group after its pages: "report-p3.pdf", "report-p03-05.pdf" for a run
 * of pages, or "report-part2.pdf" when the pages jump around.
 */
export function groupName(
    base: string,
    group: number[],
    index: number,
    pageCount: number,
): string {
    const width = String(pageCount).length;
    const page = (i: number) => String(i + 1).padStart(width, '0');
    const first = group[0];
    const last = group[group.length - 1];
    const consecutive = group.every((p, i) => p === first + i);

    if (group.length === 1) {
        return `${base}-p${page(first)}.pdf`;
    }

    return consecutive
        ? `${base}-p${page(first)}-${page(last)}.pdf`
        : `${base}-part${index + 1}.pdf`;
}
