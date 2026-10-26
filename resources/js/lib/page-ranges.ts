export type PageSelection =
    | { pages: number[]; error: null }
    | { pages: null; error: string };

/**
 * Read a page selection like "1-3, 5, 8-" into zero-based page indexes, in
 * the order written. Empty means every page. Ranges can run backwards
 * ("5-3") and be open at either end ("-3", "8-").
 */
export function parsePages(text: string, pageCount: number): PageSelection {
    const trimmed = text.trim();

    if (trimmed === '' || /^all$/i.test(trimmed)) {
        return {
            pages: Array.from({ length: pageCount }, (_, i) => i),
            error: null,
        };
    }

    const pages: number[] = [];

    for (const part of trimmed.split(/[,;]+/)) {
        const piece = part.trim();

        if (piece === '') {
            continue;
        }

        const match =
            /^(\d*)\s*[-–]\s*(\d*)$/.exec(piece) ?? /^(\d+)$/.exec(piece);

        if (!match) {
            return { pages: null, error: `"${piece}" isn't a page or range.` };
        }

        const isRange = match.length === 3;
        const from = match[1] === '' ? 1 : Number(match[1]);
        const to = isRange
            ? match[2] === ''
                ? pageCount
                : Number(match[2])
            : from;

        for (const page of [from, to]) {
            if (page < 1 || page > pageCount) {
                return {
                    pages: null,
                    error:
                        pageCount === 1
                            ? `There's no page ${page}; this PDF has 1 page.`
                            : `There's no page ${page}; this PDF has ${pageCount} pages.`,
                };
            }
        }

        const step = from <= to ? 1 : -1;

        for (let page = from; page !== to + step; page += step) {
            pages.push(page - 1);
        }
    }

    if (pages.length === 0) {
        return { pages: null, error: 'Choose at least one page.' };
    }

    return { pages, error: null };
}

const ENCRYPT = new TextEncoder().encode('/Encrypt');

/**
 * Whether the PDF is encrypted. Copying pages out of an encrypted PDF without
 * its key gives garbled pages, so those are left out of a merge.
 */
export function isEncrypted(bytes: Uint8Array): boolean {
    const first = ENCRYPT[0];

    for (
        let i = bytes.indexOf(first);
        i !== -1;
        i = bytes.indexOf(first, i + 1)
    ) {
        let matches = true;

        for (let j = 1; j < ENCRYPT.length; j++) {
            if (bytes[i + j] !== ENCRYPT[j]) {
                matches = false;
                break;
            }
        }

        // "/Encrypt" followed by a name character is a different key.
        if (
            matches &&
            !/[A-Za-z0-9]/.test(
                String.fromCharCode(bytes[i + ENCRYPT.length] ?? 32),
            )
        ) {
            return true;
        }
    }

    return false;
}
