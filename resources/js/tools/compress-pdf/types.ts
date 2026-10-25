import type { WorkerReply } from '@/lib/worker';

export type Strength = 'strong' | 'balanced' | 'light';

export type ImageSettings = {
    /** Longest side, in pixels, that an image is reduced to. */
    maxSide: number;
    /** JPEG quality, 0 to 1. */
    quality: number;
};

/** An image from the PDF, ready to re-encode. */
export type ImageJob =
    | { kind: 'jpeg'; bytes: Uint8Array; width: number; height: number }
    | {
          kind: 'pixels';
          pixels: Uint8Array;
          channels: 1 | 3;
          width: number;
          height: number;
      };

export type Recompressed = { bytes: Uint8Array; width: number; height: number };

export type Recompress = (
    job: ImageJob,
    settings: ImageSettings,
) => Promise<Recompressed | null>;

export type CompressRequest = {
    files: { blob: Blob; name: string }[];
    strength: Strength;
};

export type FileOutcome = {
    before: number;
    after: number;
    /** The file couldn't be read, so it was passed through unchanged. */
    failed: boolean;
};

export type Compressed = {
    bytes: Uint8Array;
    kind: 'pdf' | 'zip';
    outcomes: FileOutcome[];
};

export type WorkerMessage = WorkerReply<Compressed>;
