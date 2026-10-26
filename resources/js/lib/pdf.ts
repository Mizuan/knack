import { FileProblem } from '@/hooks/use-file-list';
import type { Prepared } from '@/hooks/use-file-list';
import { spawnWorker } from '@/lib/worker';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url';
import { isEncrypted } from './page-ranges';

export type PdfMeta = {
    pageCount: number;
    /** The pages to use as typed, e.g. "1-3, 5"; empty means all. */
    pages: string;
};

export type PdfJs = typeof import('pdfjs-dist');

let pdfjs: Promise<PdfJs> | null = null;

/** pdf.js is large, so it loads only once someone adds a PDF. */
export function loadPdfJs(): Promise<PdfJs> {
    pdfjs ??= import('pdfjs-dist').then((lib) => {
        lib.GlobalWorkerOptions.workerPort = spawnWorker(pdfWorkerUrl);

        return lib;
    });

    return pdfjs;
}

export const isPdf = (file: File) =>
    file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

const PDF_HEADER = new TextEncoder().encode('%PDF-');

function hasPdfHeader(bytes: Uint8Array): boolean {
    // The header may follow a little junk, so look in the first kilobyte.
    const head = bytes.subarray(0, 1024);

    return head.some((_, i) =>
        PDF_HEADER.every((byte, j) => head[i + j] === byte),
    );
}

/** Check a PDF can be merged, count its pages and draw its first page. */
export async function preparePdf(file: File): Promise<Prepared<PdfMeta>> {
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (!hasPdfHeader(bytes)) {
        throw new FileProblem("This isn't a PDF.");
    }

    if (isEncrypted(bytes)) {
        throw new FileProblem('This PDF is password-protected or locked.');
    }

    const { getDocument } = await loadPdfJs();
    let document;

    try {
        // pdf.js takes ownership of the buffer it's given, so pass a copy.
        document = await getDocument({ data: bytes.slice() }).promise;
    } catch (error) {
        throw new FileProblem(
            error instanceof Error && error.name === 'PasswordException'
                ? 'This PDF is password-protected or locked.'
                : 'This PDF looks damaged.',
        );
    }

    try {
        const page = await document.getPage(1);
        const natural = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
            scale: 360 / Math.max(natural.width, natural.height),
        });
        const canvas = window.document.createElement('canvas');

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({ canvas, viewport, background: '#ffffff' }).promise;

        const preview = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', 0.85),
        );

        if (!preview) {
            throw new FileProblem('Could not draw a preview of this PDF.');
        }

        return {
            source: file,
            thumbnail: {
                url: URL.createObjectURL(preview),
                width: natural.width,
                height: natural.height,
            },
            meta: { pageCount: document.numPages, pages: '' },
        };
    } finally {
        // Frees the document and its memory in pdf.js's worker.
        await document.loadingTask.destroy();
    }
}
