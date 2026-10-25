import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Thumbnail } from '@/lib/files';
import { compareNames } from '@/lib/files';
import { addRotation } from '@/lib/rotation';
import type { Rotation } from '@/lib/rotation';

export type FileItem<Meta = null> = {
    id: string;
    name: string;
    size: number;
    /** The file to use, once prepared (HEIC photos are JPEG by now). */
    source: Blob | null;
    thumbnail: string | null;
    /** Upright size of the preview's subject, before the user's rotation. */
    width: number;
    height: number;
    rotation: Rotation;
    status: 'loading' | 'ready' | 'error';
    /** Why the file can't be used, when we know. */
    error: string | null;
    /** Extra details for this kind of file, e.g. a PDF's page count. */
    meta: Meta | null;
};

export type Prepared<Meta> = {
    source: Blob;
    thumbnail: Thumbnail;
    meta: Meta;
};

/** A problem with a file that the person can understand and act on. */
export class FileProblem extends Error {}

export type FileListOptions<Meta> = {
    maxItems: number;
    maxFileBytes?: number;
    /** Singular and plural, e.g. ['image', 'images']. */
    noun: [string, string];
    accepts: (file: File) => boolean;
    prepare: (file: File) => Promise<Prepared<Meta>>;
    /** Runs on every change so the tool can drop a result that no longer matches. */
    onChange?: () => void;
};

export type FileListState<Meta = null> = ReturnType<typeof useFileList<Meta>>;

const LARGE_BATCH_BYTES = 300 * 1024 * 1024;

// crypto.randomUUID() needs HTTPS; a counter works everywhere.
let lastId = 0;

/**
 * The files picked for a tool: adding (one at a time, with previews),
 * rotating, reordering and removing.
 */
export function useFileList<Meta = null>({
    maxItems,
    maxFileBytes = 50 * 1024 * 1024,
    noun,
    accepts,
    prepare,
    onChange,
}: FileListOptions<Meta>) {
    const [items, setItems] = useState<FileItem<Meta>[]>([]);
    const current = useRef<FileItem<Meta>[]>([]);
    const thumbnails = useRef(new Set<string>());
    const [one, many] = noun;

    useEffect(() => {
        current.current = items;
    }, [items]);

    // Release previews when the tool closes.
    useEffect(() => {
        const urls = thumbnails.current;

        return () => urls.forEach((url) => URL.revokeObjectURL(url));
    }, []);

    const change = (next: (items: FileItem<Meta>[]) => FileItem<Meta>[]) => {
        onChange?.();
        setItems(next);
    };

    const update = (id: string, patch: Partial<FileItem<Meta>>) =>
        setItems((list) =>
            list.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        );

    const release = (item: FileItem<Meta>) => {
        if (item.thumbnail) {
            URL.revokeObjectURL(item.thumbnail);
            thumbnails.current.delete(item.thumbnail);
        }
    };

    const add = async (list: FileList | File[]) => {
        const files = Array.from(list);
        const usable = files.filter(accepts);
        const tooBig = usable.filter((file) => file.size > maxFileBytes);
        const room = maxItems - current.current.length;
        const accepted = usable
            .filter((file) => file.size <= maxFileBytes)
            .slice(0, Math.max(0, room));
        const limitMb = Math.round(maxFileBytes / 1024 / 1024);

        if (usable.length < files.length) {
            toast.error(
                `Some files were skipped because they are not ${many}.`,
            );
        }

        if (tooBig.length) {
            toast.error(
                tooBig.length === 1
                    ? `One ${one} is over ${limitMb} MB and was skipped.`
                    : `${tooBig.length} ${many} are over ${limitMb} MB and were skipped.`,
            );
        }

        if (usable.length - tooBig.length > accepted.length) {
            toast.error(`You can add up to ${maxItems} ${many} at a time.`);
        }

        if (!accepted.length) {
            return;
        }

        const batchBytes =
            current.current.reduce((sum, item) => sum + item.size, 0) +
            accepted.reduce((sum, file) => sum + file.size, 0);

        if (batchBytes > LARGE_BATCH_BYTES) {
            toast.warning(
                `That is a lot of ${many}. It may be slow on a phone; try fewer if it struggles.`,
            );
        }

        const added: FileItem<Meta>[] = accepted.map((file) => ({
            id: `file-${++lastId}`,
            name: file.name || `Pasted ${one}`,
            size: file.size,
            source: null,
            thumbnail: null,
            width: 0,
            height: 0,
            rotation: 0,
            status: 'loading',
            error: null,
            meta: null,
        }));

        change((list) => [...list, ...added]);

        // One at a time keeps memory low on phones.
        for (const [i, file] of accepted.entries()) {
            const { id } = added[i];

            try {
                const { source, thumbnail, meta } = await prepare(file);

                thumbnails.current.add(thumbnail.url);
                update(id, {
                    source,
                    thumbnail: thumbnail.url,
                    width: thumbnail.width,
                    height: thumbnail.height,
                    meta,
                    status: 'ready',
                });
            } catch (error) {
                update(id, {
                    status: 'error',
                    error: error instanceof FileProblem ? error.message : null,
                });
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

    const setMeta = (id: string, meta: Meta) =>
        change((list) =>
            list.map((item) => (item.id === id ? { ...item, meta } : item)),
        );

    const sortByName = () =>
        change((list) =>
            [...list].sort((a, b) => compareNames(a.name, b.name)),
        );

    const reorder = (next: FileItem<Meta>[]) => change(() => next);

    return {
        items,
        ready: items.filter((item) => item.status === 'ready'),
        loading: items.some((item) => item.status === 'loading'),
        totalBytes: items.reduce((sum, item) => sum + item.size, 0),
        maxItems,
        noun,
        add,
        remove,
        clear,
        rotate,
        setMeta,
        sortByName,
        reorder,
    };
}
