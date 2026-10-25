import { safeFileName } from './files';

/**
 * A PDF name for each image ("IMG_0012.HEIC" → "IMG_0012.pdf"), numbered when
 * two images share a name so nothing in the ZIP is overwritten.
 */
export function pdfNames(imageNames: string[]): string[] {
    const used = new Set<string>();

    return imageNames.map((name, index) => {
        const base = safeFileName(
            name.replace(/\.[^.]+$/, ''),
            `page-${index + 1}`,
        );
        let candidate = `${base}.pdf`;

        for (let n = 2; used.has(candidate.toLowerCase()); n++) {
            candidate = `${base} (${n}).pdf`;
        }

        used.add(candidate.toLowerCase());

        return candidate;
    });
}
