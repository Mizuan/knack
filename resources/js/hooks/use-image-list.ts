import type { FileItem } from '@/hooks/use-file-list';
import { useFileList } from '@/hooks/use-file-list';
import { heifToJpeg, isHeif, makeThumbnail } from '@/lib/files';

export type ImageItem = FileItem;

const isImage = (file: File) =>
    file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);

/** Picked images, with iPhone HEIC photos turned into JPEG as they arrive. */
export function useImageList({
    maxImages,
    onChange,
}: {
    maxImages: number;
    onChange?: () => void;
}) {
    return useFileList({
        maxItems: maxImages,
        noun: ['image', 'images'],
        accepts: isImage,
        prepare: async (file) => {
            const source = (await isHeif(file)) ? await heifToJpeg(file) : file;

            return {
                source,
                thumbnail: await makeThumbnail(source),
                meta: null,
            };
        },
        onChange,
    });
}
