import { RotatedImage } from '@/components/tools/image-list';
import type { ImageItem } from '@/hooks/use-image-list';
import { displayedSize } from '@/lib/rotation';
import { cn } from '@/lib/utils';
import type { Plan } from './types';

const percent = (value: number) => `${value * 100}%`;

/** The preview frame follows the image's shape, between square and 12:5. */
const frameRatioFor = (ratio: number) => Math.min(Math.max(ratio, 1), 2.4);

/**
 * The merged image as it will come out, drawn from the same plan the worker
 * uses, with the small previews standing in for the full images.
 */
export default function MergePreview({
    items,
    plan,
    background,
}: {
    items: ImageItem[];
    plan: Plan;
    background: string | null;
}) {
    const ratio = plan.width / plan.height;
    const frame = frameRatioFor(ratio);
    const width = ratio >= frame ? 1 : ratio / frame;
    const height = ratio >= frame ? frame / ratio : 1;

    return (
        <section
            aria-label="Preview"
            className="rounded-3xl border border-border bg-card p-3 sm:p-4"
        >
            <div className="flex items-baseline justify-between gap-3 px-1 pb-3">
                <h2 className="font-display text-lg font-bold tracking-tight">
                    Preview
                </h2>
                <p className="text-sm text-muted-foreground tabular-nums">
                    {plan.width.toLocaleString()} ×{' '}
                    {plan.height.toLocaleString()} px
                </p>
            </div>
            <div
                className="relative overflow-hidden rounded-2xl bg-muted transition-[aspect-ratio] duration-300"
                style={{ aspectRatio: frame }}
            >
                <div
                    className={cn(
                        'absolute shadow-[0_1px_3px_rgb(20_22_27/0.18)] ring-1 ring-black/5 transition-all duration-300',
                        !background &&
                            'bg-[conic-gradient(#e5e3dc_25%,#fff_0_50%,#e5e3dc_0_75%,#fff_0)] bg-[length:16px_16px]',
                    )}
                    style={{
                        width: percent(width * 0.92),
                        height: percent(height * 0.92),
                        left: percent((1 - width * 0.92) / 2),
                        top: percent((1 - height * 0.92) / 2),
                        backgroundColor: background ?? undefined,
                    }}
                >
                    {items.map((item, i) => {
                        const box = plan.boxes[i];

                        if (!box) {
                            return null;
                        }

                        return (
                            <div
                                key={item.id}
                                className="absolute overflow-hidden transition-all duration-300"
                                style={{
                                    left: percent(box.x / plan.width),
                                    top: percent(box.y / plan.height),
                                    width: percent(box.width / plan.width),
                                    height: percent(box.height / plan.height),
                                }}
                            >
                                <RotatedImage
                                    item={item}
                                    boxWidth={box.width}
                                    boxHeight={box.height}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
            {plan.limited && (
                <p className="mt-3 px-1 text-xs text-muted-foreground">
                    Scaled down to stay within what browsers can draw.
                </p>
            )}
        </section>
    );
}

/** A plain upright thumbnail for the image list. */
export function Thumbnail({ item }: { item: ImageItem }) {
    const upright = displayedSize(item, item.rotation);
    const wide = upright.width >= upright.height;
    const width = wide ? 1 : upright.width / upright.height;
    const height = wide ? upright.height / upright.width : 1;

    return (
        <div className="absolute inset-[8%]">
            <div
                className="absolute overflow-hidden rounded-sm transition-all duration-300"
                style={{
                    width: percent(width),
                    height: percent(height),
                    left: percent((1 - width) / 2),
                    top: percent((1 - height) / 2),
                }}
            >
                <RotatedImage
                    item={item}
                    boxWidth={upright.width}
                    boxHeight={upright.height}
                />
            </div>
        </div>
    );
}
