import {
    decodePDFRawStream,
    PDFArray,
    PDFDict,
    PDFDocument,
    PDFName,
    PDFNumber,
    PDFRawStream,
    PDFRef,
    PDFStream,
} from 'pdf-lib';
import type { PDFContext, PDFObject } from 'pdf-lib';
import type { ImageJob, ImageSettings, Recompress, Strength } from './types';

/** Long sides match an A4 page at about 100, 150 and 300 dpi. */
export const STRENGTHS: Record<Strength, ImageSettings> = {
    strong: { maxSide: 1240, quality: 0.55 },
    balanced: { maxSide: 1754, quality: 0.7 },
    light: { maxSide: 2480, quality: 0.82 },
};

/** Images smaller than this aren't worth re-encoding. */
const MIN_PIXELS = 128 * 128;

/** A new image must save at least this much to replace the original. */
const MIN_SAVING = 0.9;

/** Entries an image keeps when its pixels are swapped for a new JPEG. */
const KEPT_ENTRIES = [
    'SMask',
    'Intent',
    'Interpolate',
    'Metadata',
    'OC',
    'Name',
];

const name = (value: string) => PDFName.of(value);

export type CompressStats = { images: number; replaced: number };

/**
 * Make a PDF smaller: re-encode its large photos with `recompress`, keep each
 * new version only if it is clearly smaller, and drop objects nothing refers
 * to any more (old edits, removed images).
 */
export async function compressPdf(
    input: Uint8Array,
    settings: ImageSettings,
    recompress: Recompress,
    onImage?: (done: number, total: number) => void,
): Promise<{ bytes: Uint8Array } & CompressStats> {
    const document = await PDFDocument.load(input, { updateMetadata: false });
    const { context } = document;
    const images = context
        .enumerateIndirectObjects()
        .filter(
            (entry): entry is [PDFRef, PDFRawStream] =>
                entry[1] instanceof PDFRawStream &&
                entry[1].dict.get(name('Subtype')) === name('Image'),
        );
    let replaced = 0;

    for (const [i, [ref, stream]] of images.entries()) {
        const job = imageJob(context, stream);
        const result = job ? await recompress(job, settings) : null;

        if (
            result &&
            result.bytes.length < stream.contents.length * MIN_SAVING
        ) {
            context.assign(ref, jpegStream(context, stream, result));
            replaced++;
        }

        onImage?.(i + 1, images.length);
    }

    removeUnreachable(context);

    return {
        bytes: await document.save({ useObjectStreams: true }),
        images: images.length,
        replaced,
    };
}

/** What to re-encode, or null for images that can't be handled safely. */
export function imageJob(
    context: PDFContext,
    stream: PDFRawStream,
): ImageJob | null {
    const dict = stream.dict;
    const width = numberOf(context, dict.get(name('Width')));
    const height = numberOf(context, dict.get(name('Height')));
    const bits = numberOf(context, dict.get(name('BitsPerComponent')));

    if (!width || !height || width * height < MIN_PIXELS || bits !== 8) {
        return null;
    }

    // Masks and decode arrays tie the image to its exact colour values.
    if (
        dict.get(name('ImageMask')) ||
        dict.get(name('Mask')) ||
        dict.get(name('Decode'))
    ) {
        return null;
    }

    const channels = channelsOf(context, dict.get(name('ColorSpace')));
    const filter = singleFilter(context, dict.get(name('Filter')));

    if (!channels) {
        return null;
    }

    if (filter === 'DCTDecode') {
        return { kind: 'jpeg', bytes: stream.contents, width, height };
    }

    if (filter === 'FlateDecode' && !hasPredictor(context, dict)) {
        const pixels = decodePDFRawStream(stream).decode();

        return pixels.length === width * height * channels
            ? { kind: 'pixels', pixels, channels, width, height }
            : null;
    }

    return null;
}

function jpegStream(
    context: PDFContext,
    original: PDFRawStream,
    image: { bytes: Uint8Array; width: number; height: number },
): PDFRawStream {
    const dict = PDFDict.withContext(context);

    dict.set(name('Type'), name('XObject'));
    dict.set(name('Subtype'), name('Image'));
    dict.set(name('Width'), PDFNumber.of(image.width));
    dict.set(name('Height'), PDFNumber.of(image.height));
    dict.set(name('ColorSpace'), name('DeviceRGB'));
    dict.set(name('BitsPerComponent'), PDFNumber.of(8));
    dict.set(name('Filter'), name('DCTDecode'));

    for (const key of KEPT_ENTRIES) {
        const value = original.dict.get(name(key));

        if (value) {
            dict.set(name(key), value);
        }
    }

    return PDFRawStream.of(dict, image.bytes);
}

/**
 * Delete every object that can't be reached from the document's root or info
 * dictionary, such as superseded versions from incremental saves.
 */
export function removeUnreachable(context: PDFContext): number {
    const reachable = new Set<string>();
    const pending: (PDFObject | undefined)[] = [
        context.trailerInfo.Root,
        context.trailerInfo.Info,
    ];

    while (pending.length) {
        const object = pending.pop();

        if (object instanceof PDFRef) {
            if (!reachable.has(object.tag)) {
                reachable.add(object.tag);
                pending.push(context.lookup(object));
            }
        } else if (object instanceof PDFDict) {
            pending.push(...object.values());
        } else if (object instanceof PDFArray) {
            pending.push(...object.asArray());
        } else if (object instanceof PDFStream) {
            pending.push(object.dict);
        }
    }

    let removed = 0;

    for (const [ref] of context.enumerateIndirectObjects()) {
        if (!reachable.has(ref.tag)) {
            context.delete(ref);
            removed++;
        }
    }

    return removed;
}

function numberOf(
    context: PDFContext,
    value: PDFObject | undefined,
): number | null {
    const resolved = value instanceof PDFRef ? context.lookup(value) : value;

    return resolved instanceof PDFNumber ? resolved.asNumber() : null;
}

function channelsOf(
    context: PDFContext,
    value: PDFObject | undefined,
): 1 | 3 | null {
    const space = value instanceof PDFRef ? context.lookup(value) : value;

    if (space === name('DeviceRGB')) {
        return 3;
    }

    if (space === name('DeviceGray')) {
        return 1;
    }

    // [/ICCBased <stream>] with 1 or 3 components.
    if (space instanceof PDFArray && space.get(0) === name('ICCBased')) {
        const profile = context.lookup(space.get(1));
        const components =
            profile instanceof PDFStream
                ? numberOf(context, profile.dict.get(name('N')))
                : null;

        return components === 1 || components === 3 ? components : null;
    }

    // CMYK, indexed, Lab and other colour spaces are left alone.
    return null;
}

function singleFilter(
    context: PDFContext,
    value: PDFObject | undefined,
): string | null {
    const filter = value instanceof PDFRef ? context.lookup(value) : value;

    if (filter instanceof PDFName) {
        return filter.decodeText();
    }

    if (filter instanceof PDFArray && filter.size() === 1) {
        const only = filter.get(0);

        return only instanceof PDFName ? only.decodeText() : null;
    }

    return null;
}

function hasPredictor(context: PDFContext, dict: PDFDict): boolean {
    const params = dict.get(name('DecodeParms'));
    const resolved = params instanceof PDFRef ? context.lookup(params) : params;
    const predictor =
        resolved instanceof PDFDict
            ? numberOf(context, resolved.get(name('Predictor')))
            : null;

    return (
        resolved instanceof PDFArray || (predictor !== null && predictor > 1)
    );
}
