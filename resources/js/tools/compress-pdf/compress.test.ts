import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { compressPdf, imageJob, STRENGTHS } from './compress';
import type { Recompress } from './types';

const fixture = (name: string) =>
    new Uint8Array(
        readFileSync(
            resolve(__dirname, '../../../../tests/fixtures/images', name),
        ),
    );

/** A two-page PDF: a 400×267 JPEG photo and a 300×200 PNG. */
async function samplePdf(extra?: (document: PDFDocument) => void) {
    const document = await PDFDocument.create();
    const jpeg = await document.embedJpg(fixture('photo-400.jpg'));
    const png = await document.embedPng(fixture('photo-300.png'));

    document.addPage([400, 267]).drawImage(jpeg, { x: 0, y: 0 });
    document.addPage([300, 200]).drawImage(png, { x: 0, y: 0 });
    extra?.(document);

    return document.save();
}

async function imageStreams(bytes: Uint8Array) {
    const document = await PDFDocument.load(bytes);

    return document.context
        .enumerateIndirectObjects()
        .map(([, object]) => object)
        .filter(
            (object): object is PDFRawStream =>
                object instanceof PDFRawStream &&
                object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'),
        );
}

const width = (stream: PDFRawStream) =>
    (stream.dict.get(PDFName.of('Width')) as PDFNumber).asNumber();

describe('compressPdf', () => {
    it('hands JPEG bytes and raw pixels to the re-encoder', async () => {
        const recompress = vi.fn<Recompress>(async () => null);

        await compressPdf(await samplePdf(), STRENGTHS.balanced, recompress);

        const jobs = recompress.mock.calls.map(([job]) => job);

        expect(jobs).toHaveLength(2);
        expect(jobs).toContainEqual(
            expect.objectContaining({ kind: 'jpeg', width: 400, height: 267 }),
        );

        const pixels = jobs.find((job) => job.kind === 'pixels');

        expect(pixels).toMatchObject({ channels: 3, width: 300, height: 200 });
        expect(pixels?.kind === 'pixels' && pixels.pixels.length).toBe(
            300 * 200 * 3,
        );
    });

    it('swaps in smaller images as JPEG, keeping the pages', async () => {
        const recompress: Recompress = async (job) => ({
            bytes: new Uint8Array(64),
            width: job.width / 2,
            height: job.height / 2,
        });

        const result = await compressPdf(
            await samplePdf(),
            STRENGTHS.strong,
            recompress,
        );
        const streams = await imageStreams(result.bytes);

        expect(result).toMatchObject({ images: 2, replaced: 2 });
        expect(streams.map(width).sort((a, b) => a - b)).toEqual([150, 200]);
        expect(
            streams.every(
                (stream) =>
                    stream.dict.get(PDFName.of('Filter')) ===
                        PDFName.of('DCTDecode') &&
                    stream.contents.length === 64,
            ),
        ).toBe(true);
        expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(2);
    });

    it('keeps the original image when the new one is not clearly smaller', async () => {
        const original = await samplePdf();
        const recompress: Recompress = async (job) => ({
            bytes: new Uint8Array(10_000_000),
            width: job.width,
            height: job.height,
        });

        const result = await compressPdf(original, STRENGTHS.light, recompress);

        expect(result.replaced).toBe(0);
        expect(
            (await imageStreams(result.bytes)).map(width).sort((a, b) => a - b),
        ).toEqual([300, 400]);
    });

    it('drops objects nothing refers to', async () => {
        const withOrphan = await samplePdf((document) => {
            document.context.register(
                document.context.flateStream('x'.repeat(50_000)),
            );
        });

        const before = (await PDFDocument.load(withOrphan)).context
            .largestObjectNumber;
        const result = await compressPdf(
            withOrphan,
            STRENGTHS.balanced,
            async () => null,
        );
        const after = await PDFDocument.load(result.bytes);

        expect(after.context.enumerateIndirectObjects().length).toBeLessThan(
            before,
        );
        expect(result.bytes.length).toBeLessThan(withOrphan.length);
        expect(after.getPageCount()).toBe(2);
    });

    it('reports progress per image', async () => {
        const seen: string[] = [];

        await compressPdf(
            await samplePdf(),
            STRENGTHS.balanced,
            async () => null,
            (done, total) => seen.push(`${done}/${total}`),
        );

        expect(seen).toEqual(['1/2', '2/2']);
    });
});

describe('imageJob', () => {
    it('leaves CMYK images, masks and tiny images alone', async () => {
        const document = await PDFDocument.create();
        const { context } = document;
        const image = (entries: Record<string, unknown>) =>
            context.stream(new Uint8Array(4), {
                Type: 'XObject',
                Subtype: 'Image',
                Width: 400,
                Height: 400,
                BitsPerComponent: 8,
                ColorSpace: 'DeviceRGB',
                Filter: 'DCTDecode',
                ...entries,
            } as never);

        expect(imageJob(context, image({}))).not.toBeNull();
        expect(
            imageJob(context, image({ ColorSpace: 'DeviceCMYK' })),
        ).toBeNull();
        expect(imageJob(context, image({ ImageMask: true }))).toBeNull();
        expect(
            imageJob(context, image({ Mask: [0, 10, 0, 10, 0, 10] })),
        ).toBeNull();
        expect(imageJob(context, image({ Width: 50, Height: 50 }))).toBeNull();
        expect(imageJob(context, image({ BitsPerComponent: 16 }))).toBeNull();
        expect(imageJob(context, image({ Filter: 'JPXDecode' }))).toBeNull();
    });
});
