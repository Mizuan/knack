const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis'];

export function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }

    return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** Natural, case-insensitive order: "IMG_2" before "IMG_10". */
export function compareNames(a: string, b: string): number {
    return a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: 'base',
    });
}

/** Strip characters that file systems reject, and fall back when empty. */
export function safeFileName(name: string, fallback: string): string {
    const cleaned = name
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\.pdf$/i, '');

    return cleaned.slice(0, 120) || fallback;
}

/** iPhone photos (HEIC/HEIF), by name, type or the file's own header. */
export async function isHeif(file: File): Promise<boolean> {
    if (
        /\.(heic|heif)$/i.test(file.name) ||
        /^image\/hei[cf]/.test(file.type)
    ) {
        return true;
    }

    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const text = (from: number, to: number) =>
        String.fromCharCode(...head.slice(from, to));

    return text(4, 8) === 'ftyp' && HEIF_BRANDS.includes(text(8, 12));
}

/** Decode HEIC with libheif (WebAssembly), loaded only when first needed. */
export async function heifToJpeg(file: File): Promise<Blob> {
    const { heicTo } = await import('heic-to/csp');

    return heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
}

export type Thumbnail = { url: string; width: number; height: number };

/** A small JPEG preview, upright, plus the image's real size. */
export async function makeThumbnail(
    source: Blob,
    longSide = 360,
): Promise<Thumbnail> {
    const bitmap = await createImageBitmap(source, {
        imageOrientation: 'from-image',
    });
    const { width, height } = bitmap;
    const scale = Math.min(1, longSide / Math.max(width, height));
    const canvas = document.createElement('canvas');

    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext('2d');

    if (!context) {
        bitmap.close();
        throw new Error('This browser cannot draw images.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.8),
    );

    if (!blob) {
        throw new Error('Could not make a preview.');
    }

    return { url: URL.createObjectURL(blob), width, height };
}

export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Give the browser time to start the download before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
