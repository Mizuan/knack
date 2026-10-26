/**
 * File names for rendered pages: "report-p01.jpg", "report-p02.jpg", padded
 * to the PDF's page count so they sort in order.
 */
export function pageImageNames(
    base: string,
    pageIndexes: number[],
    pageCount: number,
    extension: string,
): string[] {
    const width = String(pageCount).length;

    return pageIndexes.map(
        (index) =>
            `${base}-p${String(index + 1).padStart(width, '0')}.${extension}`,
    );
}
