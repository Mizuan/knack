import type { DragEndEvent } from '@dnd-kit/core';
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    rectSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CircleAlert, RotateCw, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { formatBytes } from '@/lib/files';
import { cn } from '@/lib/utils';
import { displayedSize, pageSizeFor, placeImage } from './layout';
import type { PdfOptions, Rotation } from './types';

export type ImageItem = {
    id: string;
    name: string;
    size: number;
    /** The image to embed; HEIC photos are already converted to JPEG here. */
    source: Blob | null;
    thumbnail: string | null;
    /** Upright size in pixels, before the user's own rotation. */
    width: number;
    height: number;
    rotation: Rotation;
    status: 'loading' | 'ready' | 'error';
};

export default function ImageGrid({
    items,
    options,
    onReorder,
    onRotate,
    onRemove,
}: {
    items: ImageItem[];
    options: PdfOptions;
    onReorder: (items: ImageItem[]) => void;
    onRotate: (id: string) => void;
    onRemove: (id: string) => void;
}) {
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        // Long-press to drag on touch screens, so a normal swipe still scrolls.
        useSensor(TouchSensor, {
            activationConstraint: { delay: 200, tolerance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) {
            return;
        }

        const from = items.findIndex((item) => item.id === active.id);
        const to = items.findIndex((item) => item.id === over.id);

        onReorder(arrayMove(items, from, to));
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            accessibility={{
                screenReaderInstructions: {
                    draggable:
                        'To move a page, press space or enter, use the arrow keys, then press space or enter again to drop it.',
                },
            }}
        >
            <SortableContext items={items} strategy={rectSortingStrategy}>
                <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                    {items.map((item, index) => (
                        <ImageCard
                            key={item.id}
                            item={item}
                            options={options}
                            page={index + 1}
                            onRotate={() => onRotate(item.id)}
                            onRemove={() => onRemove(item.id)}
                        />
                    ))}
                </ol>
            </SortableContext>
        </DndContext>
    );
}

function ImageCard({
    item,
    options,
    page,
    onRotate,
    onRemove,
}: {
    item: ImageItem;
    options: PdfOptions;
    page: number;
    onRotate: () => void;
    onRemove: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(
                'relative rounded-2xl border border-border bg-card p-2 select-none',
                isDragging &&
                    'z-10 shadow-[0_18px_40px_-12px_rgb(20_22_27/0.35)] ring-2 ring-brand',
                item.status === 'error' && 'border-destructive/50',
            )}
        >
            <div
                {...attributes}
                {...listeners}
                aria-label={`Page ${page}: ${item.name}`}
                className="cursor-grab touch-manipulation rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
            >
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-muted">
                    {item.status === 'ready' && item.thumbnail && (
                        <PagePreview item={item} options={options} />
                    )}
                    {item.status === 'loading' && (
                        <Spinner className="size-6 text-muted-foreground" />
                    )}
                    {item.status === 'error' && (
                        <div className="flex flex-col items-center gap-1.5 px-3 text-center text-xs text-destructive-foreground">
                            <CircleAlert className="size-6" />
                            Can't read this image. It will be left out.
                        </div>
                    )}
                </div>
                <div className="mt-2 flex items-center gap-2 px-1 pb-0.5">
                    <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
                        {page}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">
                            {item.name}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                            {formatBytes(item.size)}
                        </span>
                    </span>
                </div>
            </div>

            <div className="absolute top-3 right-3 flex gap-1.5">
                {item.status === 'ready' && (
                    <CardButton
                        label={`Rotate ${item.name}`}
                        onClick={onRotate}
                    >
                        <RotateCw className="size-4" />
                    </CardButton>
                )}
                <CardButton label={`Remove ${item.name}`} onClick={onRemove}>
                    <X className="size-4" />
                </CardButton>
            </div>
        </li>
    );
}

function CardButton({
    label,
    onClick,
    children,
}: {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="flex size-9 items-center justify-center rounded-full bg-card/90 text-foreground shadow-sm ring-1 ring-border backdrop-blur transition-colors outline-none hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:size-11"
        >
            {children}
        </button>
    );
}

const percent = (value: number) => `${value * 100}%`;

/**
 * The page as it will come out: its shape, orientation and margin, with the
 * image placed by the same layout code the PDF builder uses.
 */
function PagePreview({
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
    const turned = item.rotation === 90 || item.rotation === 270;

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
                    <img
                        src={item.thumbnail ?? undefined}
                        alt=""
                        draggable={false}
                        className="absolute top-1/2 left-1/2 max-w-none transition-transform duration-300"
                        style={{
                            width: turned
                                ? percent(box.height / box.width)
                                : '100%',
                            height: turned
                                ? percent(box.width / box.height)
                                : '100%',
                            transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
