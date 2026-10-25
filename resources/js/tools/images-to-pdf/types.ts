export type PageSize = 'fit' | 'a4' | 'letter';
export type Orientation = 'auto' | 'portrait' | 'landscape';
export type Margin = 'none' | 'small' | 'normal';

/** One PDF with every image, or a ZIP holding one PDF per image. */
export type Output = 'single' | 'separate';

import type { Rotation } from '@/lib/rotation';
import type { WorkerReply } from '@/lib/worker';

export type { Rotation };

export type PdfOptions = {
    pageSize: PageSize;
    orientation: Orientation;
    margin: Margin;
};

/** An image ready to embed: JPEG bytes go in as-is, PNG stays lossless. */
export type PreparedImage = {
    kind: 'jpg' | 'png';
    bytes: Uint8Array;
    rotation: Rotation;
};

export type BuildRequest = {
    images: { blob: Blob; rotation: Rotation; name: string }[];
    options: PdfOptions;
    output: Output;
    title: string;
};

export type Built = {
    bytes: Uint8Array;
    kind: 'pdf' | 'zip';
    pages: number;
    files: number;
};

export type WorkerMessage = WorkerReply<Built>;
