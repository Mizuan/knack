import { safeFileName } from './files';

/**
 * Give each file a new extension ("IMG_0012.HEIC" → "IMG_0012.jpg"),
 * numbering duplicates so nothing in a ZIP is overwritten.
 */
export function withExtension(
    names: string[],
    extension: string,
    fallback = 'file',
): string[] {
    const used = new Set<string>();

    return names.map((name, index) => {
        const base = safeFileName(
            name.replace(/\.[^.]+$/, ''),
            `${fallback}-${index + 1}`,
        );
        let candidate = `${base}.${extension}`;

        for (let n = 2; used.has(candidate.toLowerCase()); n++) {
            candidate = `${base} (${n}).${extension}`;
        }

        used.add(candidate.toLowerCase());

        return candidate;
    });
}

/** A PDF name for each image, as `withExtension` with "page" fallbacks. */
export function pdfNames(imageNames: string[]): string[] {
    return withExtension(imageNames, 'pdf', 'page');
}
