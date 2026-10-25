import { RotatedImage } from '@/components/tools/file-grid';
import type { ImageItem } from '@/hooks/use-image-list';
import { displayedSize } from '@/lib/rotation';
import { pageSizeFor, placeImage } from './layout';
import type { PdfOptions } from './types';

const percent = (value: number) => `${value * 100}%`;

/**
 * The page as it will come out: its shape, orientation and margin, with the
 * image placed by the same layout code the PDF builder uses.
 */
export default function PagePreview({
    item,
    options,
}: {
    item: ImageItem;
    options: PdfOptions;
}) {
    const upright = displayedSize(item, item.rotation);
    const page = pageSizeFor(upright, options);
    const box = placeImage(page, upright, options.margin);
    const wide = page.width >= page.height;

    // Page size as a share of the square preview area.
    const pageWidth = wide ? 1 : page.width / page.height;
    const pageHeight = wide ? page.height / page.width : 1;

    return (
        <div className="absolute inset-[9%]">
            <div
                className="absolute bg-white shadow-[0_1px_3px_rgb(20_22_27/0.18)] ring-1 ring-black/5 transition-all duration-300"
                style={{
                    width: percent(pageWidth),
                    height: percent(pageHeight),
                    left: percent((1 - pageWidth) / 2),
                    top: percent((1 - pageHeight) / 2),
                }}
            >
                <div
                    className="absolute overflow-hidden transition-all duration-300"
                    style={{
                        left: percent(box.x / page.width),
                        // PDF y runs up from the bottom; CSS top runs down.
                        top: percent(
                            (page.height - box.y - box.height) / page.height,
                        ),
                        width: percent(box.width / page.width),
                        height: percent(box.height / page.height),
                    }}
                >
                    <RotatedImage
                        item={item}
                        boxWidth={box.width}
                        boxHeight={box.height}
                    />
                </div>
            </div>
        </div>
    );
}
