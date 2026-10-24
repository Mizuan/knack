import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { compareNames, heifToJpeg, isHeif, makeThumbnail } from '@/lib/files';
import { addRotation } from '@/lib/rotation';
import type { Rotation } from '@/lib/rotation';

export type ImageItem = {
    id: string;
    name: string;
    size: number;
    /** The image to use; HEIC photos are already converted to JPEG here. */
    source: Blob | null;
    thumbnail: string | null;
    /** Upright size in pixels, before the user's own rotation. */
    width: number;
    height: number;
    rotation: Rotation;
    status: 'loading' | 'ready' | 'error';
};

export type ImageList = ReturnType<typeof useImageList>;

const LARGE_BATCH_BYTES = 300 * 1024 * 1024;

// crypto.randomUUID() needs HTTPS; a counter works everywhere.
let lastId = 0;

/**
 * The picked images for a tool: adding (with HEIC conversion and previews),
 * rotating, reordering and removing. `onChange` runs on every user change so
 * the tool can drop a result that no longer matches.
 */
export function useImageList({
    maxImages,
    maxFileBytes = 50 * 1024 * 1024,
    onChange,
}: {
    maxImages: number;
    maxFileBytes?: number;
    onChange?: () => void;
}) {
    const [items, setItems] = useState<ImageItem[]>([]);
    const current = useRef<ImageItem[]>([]);
    const thumbnails = useRef(new Set<string>());

    useEffect(() => {
        current.current = items;
    }, [items]);

    // Release previews when the tool closes.
    useEffect(() => {
        const urls = thumbnails.current;

        return () => urls.forEach((url) => URL.revokeObjectURL(url));
    }, []);

    const change = (next: (items: ImageItem[]) => ImageItem[]) => {
        onChange?.();
        setItems(next);
    };

    const update = (id: string, patch: Partial<ImageItem>) =>
        setItems((list) =>
            list.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        );

    const release = (item: ImageItem) => {
        if (item.thumbnail) {
            URL.revokeObjectURL(item.thumbnail);
            thumbnails.current.delete(item.thumbnail);
        }
    };

    const add = async (list: FileList | File[]) => {
        const files = Array.from(list);
        const images = files.filter(
            (file) =>
                file.type.startsWith('image/') ||
                /\.(heic|heif)$/i.test(file.name),
        );
        const tooBig = images.filter((file) => file.size > maxFileBytes);
        const room = maxImages - current.current.length;
        const accepted = images
            .filter((file) => file.size <= maxFileBytes)
            .slice(0, Math.max(0, room));
        const limitMb = Math.round(maxFileBytes / 1024 / 1024);

        if (images.length < files.length) {
            toast.error('Some files were skipped because they are not images.');
        }

        if (tooBig.length) {
            toast.error(
                tooBig.length === 1
                    ? `One image is over ${limitMb} MB and was skipped.`
                    : `${tooBig.length} images are over ${limitMb} MB and were skipped.`,
            );
        }

        if (images.length - tooBig.length > accepted.length) {
            toast.error(`You can add up to ${maxImages} images at a time.`);
        }

        if (!accepted.length) {
            return;
        }

        const batchBytes =
            current.current.reduce((sum, item) => sum + item.size, 0) +
            accepted.reduce((sum, file) => sum + file.size, 0);

        if (batchBytes > LARGE_BATCH_BYTES) {
            toast.warning(
                'That is a big batch. It may be slow on a phone; try fewer images if it struggles.',
            );
        }

        const added: ImageItem[] = accepted.map((file) => ({
            id: `image-${++lastId}`,
            name: file.name || 'Pasted image',
            size: file.size,
            source: null,
            thumbnail: null,
            width: 0,
            height: 0,
            rotation: 0,
            status: 'loading',
        }));

        change((list) => [...list, ...added]);

        // One at a time keeps memory low on phones.
        for (const [i, file] of accepted.entries()) {
            const { id } = added[i];

            try {
                const source = (await isHeif(file))
                    ? await heifToJpeg(file)
                    : file;
                const thumbnail = await makeThumbnail(source);

                thumbnails.current.add(thumbnail.url);
                update(id, {
                    source,
                    thumbnail: thumbnail.url,
                    width: thumbnail.width,
                    height: thumbnail.height,
                    status: 'ready',
                });
            } catch {
                update(id, { status: 'error' });
            }
        }
    };

    const remove = (id: string) => {
        const item = items.find((candidate) => candidate.id === id);

        if (item) {
            release(item);
        }

        change((list) => list.filter((candidate) => candidate.id !== id));
    };

    const clear = () => {
        items.forEach(release);
        change(() => []);
    };

    const rotate = (id: string) =>
        change((list) =>
            list.map((item) =>
                item.id === id
                    ? { ...item, rotation: addRotation(item.rotation, 90) }
                    : item,
            ),
        );

    const sortByName = () =>
        change((list) =>
            [...list].sort((a, b) => compareNames(a.name, b.name)),
        );

    const reorder = (next: ImageItem[]) => change(() => next);

    const ready = items.filter((item) => item.status === 'ready');

    return {
        items,
        ready,
        loading: items.some((item) => item.status === 'loading'),
        totalBytes: items.reduce((sum, item) => sum + item.size, 0),
        maxImages,
        add,
        remove,
        clear,
        rotate,
        sortByName,
        reorder,
    };
}
