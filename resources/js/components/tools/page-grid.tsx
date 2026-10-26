import type { DragEndEvent } from '@dnd-kit/core';
import { closestCenter, DndContext } from '@dnd-kit/core';
import {
    arrayMove,
    rectSortingStrategy,
    SortableContext,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RotateCw, Trash2 } from 'lucide-react';
import {
    CardButton,
    FittedThumbnail,
    useCardSensors,
} from '@/components/tools/file-grid';
import type { Rotation } from '@/lib/rotation';
import { cn } from '@/lib/utils';

export type PageItem = {
    id: string;
    /** The PDF this page came from. */
    fileId: string;
    /** A short label for that PDF, e.g. "A", shown when there are several. */
    fileLabel: string;
    /** Zero-based page number in that PDF. */
    page: number;
    rotation: Rotation;
    thumbnail: string;
    width: number;
    height: number;
};

/** Every page as a card: drag to reorder, rotate or delete each one. */
export default function PageGrid({
    pages,
    showFiles,
    onReorder,
    onRotate,
    onDelete,
}: {
    pages: PageItem[];
    showFiles: boolean;
    onReorder: (pages: PageItem[]) => void;
    onRotate: (id: string) => void;
    onDelete: (id: string) => void;
}) {
    const sensors = useCardSensors();

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) {
            return;
        }

        const from = pages.findIndex((page) => page.id === active.id);
        const to = pages.findIndex((page) => page.id === over.id);

        onReorder(arrayMove(pages, from, to));
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
            <SortableContext items={pages} strategy={rectSortingStrategy}>
                <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5">
                    {pages.map((page, index) => (
                        <PageCard
                            key={page.id}
                            page={page}
                            position={index + 1}
                            showFile={showFiles}
                            onRotate={() => onRotate(page.id)}
                            onDelete={() => onDelete(page.id)}
                        />
                    ))}
                </ol>
            </SortableContext>
        </DndContext>
    );
}

function PageCard({
    page,
    position,
    showFile,
    onRotate,
    onDelete,
}: {
    page: PageItem;
    position: number;
    showFile: boolean;
    onRotate: () => void;
    onDelete: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: page.id });
    const name = showFile
        ? `File ${page.fileLabel}, page ${page.page + 1}`
        : `Page ${page.page + 1}`;

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(
                'relative rounded-xl border border-border bg-card p-1.5 select-none',
                isDragging &&
                    'z-10 shadow-[0_18px_40px_-12px_rgb(20_22_27/0.35)] ring-2 ring-brand',
            )}
        >
            <div
                {...attributes}
                {...listeners}
                aria-label={`Position ${position}: ${name}`}
                className="cursor-grab touch-manipulation rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
            >
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
                    <FittedThumbnail
                        item={page}
                        className="rounded-none bg-white shadow-[0_1px_3px_rgb(20_22_27/0.18)] ring-1 ring-black/5"
                    />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-1 px-1 pb-0.5 text-[11px]">
                    <span className="font-semibold tabular-nums">
                        {position}
                    </span>
                    <span className="truncate text-muted-foreground">
                        {showFile && (
                            <span className="mr-1 inline-flex size-4 items-center justify-center rounded bg-secondary font-semibold text-foreground">
                                {page.fileLabel}
                            </span>
                        )}
                        p.{page.page + 1}
                    </span>
                </div>
            </div>

            <div className="absolute top-2.5 right-2.5 flex flex-col gap-1">
                <CardButton label={`Rotate ${name}`} onClick={onRotate}>
                    <RotateCw className="size-4" />
                </CardButton>
                <CardButton label={`Delete ${name}`} onClick={onDelete}>
                    <Trash2 className="size-4" />
                </CardButton>
            </div>
        </li>
    );
}
