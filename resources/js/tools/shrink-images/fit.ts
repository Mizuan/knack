export type Encoded = {
    blob: Blob;
    width: number;
    height: number;
    quality: number;
};

export type Encode = (
    width: number,
    height: number,
    quality: number,
) => Promise<Blob>;

export type FitOptions = {
    /** Lowest JPEG/WebP quality tried before making the image smaller. */
    minQuality?: number;
    /** Quality used when there is room to spare. */
    maxQuality?: number;
    /** Never shrink the longest side below this. */
    minSide?: number;
};

/**
 * Find the best version of an image that fits in `target` bytes: the highest
 * quality at full size if possible, otherwise the largest size that fits at
 * the lowest acceptable quality. Returns the smallest attempt, with `fits`
 * false, when nothing gets under the limit.
 */
export async function fitToSize(
    width: number,
    height: number,
    target: number,
    encode: Encode,
    { minQuality = 0.45, maxQuality = 0.92, minSide = 320 }: FitOptions = {},
): Promise<Encoded & { fits: boolean }> {
    let scale = 1;
    let smallest: Encoded | null = null;

    for (let attempt = 0; attempt < 10; attempt++) {
        const w = Math.max(1, Math.round(width * scale));
        const h = Math.max(1, Math.round(height * scale));
        const at = async (quality: number): Promise<Encoded> => ({
            blob: await encode(w, h, quality),
            width: w,
            height: h,
            quality,
        });

        const best = await at(maxQuality);

        if (best.blob.size <= target) {
            return { ...best, fits: true };
        }

        const low = await at(minQuality);

        if (!smallest || low.blob.size < smallest.blob.size) {
            smallest = low;
        }

        if (low.blob.size <= target) {
            // Narrow down to the highest quality that still fits.
            let fitting = low;
            let lo = minQuality;
            let hi = maxQuality;

            for (let step = 0; step < 6; step++) {
                const mid = (lo + hi) / 2;
                const candidate = await at(mid);

                if (candidate.blob.size <= target) {
                    fitting = candidate;
                    lo = mid;
                } else {
                    hi = mid;
                }
            }

            return { ...fitting, fits: true };
        }

        // Even the lowest quality is too big: shrink, aiming a little under.
        if (Math.max(w, h) <= minSide) {
            break;
        }

        const next = scale * Math.sqrt(target / low.blob.size) * 0.95;
        const floor = minSide / Math.max(width, height);

        scale = Math.max(next, floor);
    }

    return { ...(smallest as Encoded), fits: false };
}
