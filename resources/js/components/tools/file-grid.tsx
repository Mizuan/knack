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
import {
    ArrowDownAZ,
    CircleAlert,
    Plus,
    RotateCw,
    Trash2,
    X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { FileItem, FileListState } from '@/hooks/use-file-list';
import { formatBytes } from '@/lib/files';
import { displayedSize } from '@/lib/rotation';
import { cn } from '@/lib/utils';

type Render<Meta> = (item: FileItem<Meta>) => ReactNode;

/**
 * The picked files: a toolbar (add, sort, clear) and a grid you can drag to
 * reorder. Each tool draws its own preview, info line and extra controls.
 */
export default function FileGrid<Meta>({
    list,
    pick,
    busy,
    renderPreview,
    renderInfo = (item) => formatBytes(item.size),
    renderExtra,
    className,
}: {
    list: FileListState<Meta>;
    pick: () => void;
    busy: boolean;
    renderPreview: Render<Meta>;
    /** The small line under the name; the file size by default. */
    renderInfo?: Render<Meta>;
    /** Controls under the card, outside the drag handle. */
    renderExtra?: Render<Meta>;
    /** Grid columns, e.g. to fit more, smaller cards. */
    className?: string;
}) {
    const { items } = list;
    const [one, many] = list.noun;

    return (
        <section aria-label="Files" className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                        {items.length} {items.length === 1 ? one : many}
                    </span>{' '}
                    · {formatBytes(list.totalBytes)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-full"
                        onClick={pick}
                        disabled={busy || items.length >= list.maxItems}
                    >
                        <Plus />
                        Add
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-full"
                        onClick={list.sortByName}
                        disabled={busy || items.length < 2}
                    >
                        <ArrowDownAZ />
                        Sort by name
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 rounded-full"
                        onClick={list.clear}
                        disabled={busy}
                    >
                        <Trash2 />
                        Clear
                    </Button>
                </div>
            </div>

            <fieldset
                disabled={busy}
                className={cn(
                    'min-w-0 transition-opacity',
                    busy && 'pointer-events-none opacity-60',
                )}
            >
                <SortableGrid
                    list={list}
                    renderPreview={renderPreview}
                    renderInfo={renderInfo}
                    renderExtra={renderExtra}
                    className={className}
                />
            </fieldset>
            <p className="mt-4 text-xs text-muted-foreground">
                <span className="pointer-coarse:hidden">
                    Drag {many} to change the order, or drop more anywhere on
                    the page.
                </span>
                <span className="hidden pointer-coarse:inline">
                    Press and hold {one === 'image' ? 'an' : 'a'} {one} to move
                    it.
                </span>
            </p>
        </section>
    );
}

function SortableGrid<Meta>({
    list,
    renderPreview,
    renderInfo,
    renderExtra,
    className,
}: {
    list: FileListState<Meta>;
    renderPreview: Render<Meta>;
    renderInfo: Render<Meta>;
    renderExtra?: Render<Meta>;
    className?: string;
}) {
    const { items } = list;
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

        list.reorder(arrayMove(items, from, to));
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            accessibility={{
                screenReaderInstructions: {
                    draggable:
                        'To move a file, press space or enter, use the arrow keys, then press space or enter again to drop it.',
                },
            }}
        >
            <SortableContext items={items} strategy={rectSortingStrategy}>
                <ol
                    className={cn(
                        'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4',
                        className,
                    )}
                >
                    {items.map((item, index) => (
                        <FileCard
                            key={item.id}
                            item={item}
                            position={index + 1}
                            preview={
                                item.status === 'ready' && renderPreview(item)
                            }
                            info={
                                item.status === 'ready'
                                    ? renderInfo(item)
                                    : formatBytes(item.size)
                            }
                            extra={
                                item.status === 'ready' && renderExtra?.(item)
                            }
                            onRotate={() => list.rotate(item.id)}
                            onRemove={() => list.remove(item.id)}
                        />
                    ))}
                </ol>
            </SortableContext>
        </DndContext>
    );
}

function FileCard<Meta>({
    item,
    position,
    preview,
    info,
    extra,
    onRotate,
    onRemove,
}: {
    item: FileItem<Meta>;
    position: number;
    preview: ReactNode;
    info: ReactNode;
    extra: ReactNode;
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
                aria-label={`${position}: ${item.name}`}
                className="cursor-grab touch-manipulation rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
            >
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-muted">
                    {preview}
                    {item.status === 'loading' && (
                        <Spinner className="size-6 text-muted-foreground" />
                    )}
                    {item.status === 'error' && (
                        <div className="flex flex-col items-center gap-1.5 px-3 text-center text-xs text-destructive-foreground">
                            <CircleAlert className="size-6" />
                            {item.error ?? "Can't read this file."} It will be
                            left out.
                        </div>
                    )}
                </div>
                <div className="mt-2 flex items-center gap-2 px-1 pb-0.5">
                    <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
                        {position}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">
                            {item.name}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                            {info}
                        </span>
                    </span>
                </div>
            </div>
            {extra && <div className="mt-2 px-1 pb-0.5">{extra}</div>}

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
    children: ReactNode;
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

/** An image drawn upright and turned by the user's rotation, filling its box. */
export function RotatedImage({
    item,
    boxWidth,
    boxHeight,
}: {
    item: Pick<FileItem<unknown>, 'thumbnail' | 'rotation'>;
    boxWidth: number;
    boxHeight: number;
}) {
    const turned = item.rotation === 90 || item.rotation === 270;

    return (
        <img
            src={item.thumbnail ?? undefined}
            alt=""
            draggable={false}
            className="absolute top-1/2 left-1/2 max-w-none transition-transform duration-300"
            style={{
                width: turned ? percent(boxHeight / boxWidth) : '100%',
                height: turned ? percent(boxWidth / boxHeight) : '100%',
                transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
            }}
        />
    );
}

const percent = (value: number) => `${value * 100}%`;

/** The file's preview, upright and fitted inside the card's square. */
export function FittedThumbnail({
    item,
    className,
}: {
    item: Pick<
        FileItem<unknown>,
        'thumbnail' | 'rotation' | 'width' | 'height'
    >;
    /** Extra classes for the fitted box, e.g. to make it look like a page. */
    className?: string;
}) {
    const upright = displayedSize(item, item.rotation);
    const wide = upright.width >= upright.height;
    const width = wide ? 1 : upright.width / upright.height;
    const height = wide ? upright.height / upright.width : 1;

    return (
        <div className="absolute inset-[8%]">
            <div
                className={cn(
                    'absolute overflow-hidden rounded-sm transition-all duration-300',
                    className,
                )}
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
