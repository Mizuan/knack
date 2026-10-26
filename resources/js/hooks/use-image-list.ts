import type { FileItem } from '@/hooks/use-file-list';
import { useFileList } from '@/hooks/use-file-list';
import { decodeHeif, isHeif, makeThumbnail } from '@/lib/files';

export type ImageItem = FileItem;

const isImage = (file: File) =>
    file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);

/**
 * Picked images, with iPhone HEIC photos decoded as they arrive: to JPEG by
 * default, or to PNG when no detail may be lost.
 */
export function useImageList({
    maxImages,
    heicAs = 'image/jpeg',
    onChange,
}: {
    maxImages: number;
    heicAs?: 'image/jpeg' | 'image/png';
    onChange?: () => void;
}) {
    return useFileList({
        maxItems: maxImages,
        noun: ['image', 'images'],
        accepts: isImage,
        prepare: async (file) => {
            const source = (await isHeif(file))
                ? await decodeHeif(file, heicAs)
                : file;

            return {
                source,
                thumbnail: await makeThumbnail(source),
                meta: null,
            };
        },
        onChange,
    });
}
