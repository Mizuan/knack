import { degrees, PDFDocument } from 'pdf-lib';
import type { Rotation } from '@/lib/rotation';

export type PagePick = {
    /** Which source PDF, by position in the sources list. */
    source: number;
    /** Zero-based page in that PDF. */
    page: number;
    /** Extra clockwise turn chosen by the person. */
    rotation: Rotation;
};

/** Build one PDF from pages picked across several, in the order given. */
export async function assemblePages(
    sources: Uint8Array[],
    picks: PagePick[],
    title: string,
    onPage?: (done: number, total: number) => void,
): Promise<Uint8Array> {
    const documents = await Promise.all(
        sources.map((bytes) =>
            PDFDocument.load(bytes, { updateMetadata: false }),
        ),
    );
    const output = await PDFDocument.create();

    output.setTitle(title);
    output.setCreator('Tinyfold');
    output.setProducer('Tinyfold');

    for (const [i, pick] of picks.entries()) {
        const [page] = await output.copyPages(documents[pick.source], [
            pick.page,
        ]);

        if (pick.rotation) {
            page.setRotation(
                degrees((page.getRotation().angle + pick.rotation) % 360),
            );
        }

        output.addPage(page);
        onPage?.(i + 1, picks.length);
    }

    return output.save();
}
