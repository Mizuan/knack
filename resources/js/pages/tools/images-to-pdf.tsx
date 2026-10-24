import { Head, Link } from '@inertiajs/react';
import {
    ArrowDownAZ,
    ArrowLeft,
    CircleCheck,
    Download,
    ImagePlus,
    Lock,
    Plus,
    RotateCcw,
    Share2,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import Segmented from '@/components/tools/segmented';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    compareNames,
    downloadBlob,
    formatBytes,
    heifToJpeg,
    isHeif,
    makeThumbnail,
    safeFileName,
} from '@/lib/files';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import { createPdf } from '@/tools/images-to-pdf/client';
import type { ImageItem } from '@/tools/images-to-pdf/image-grid';
import ImageGrid from '@/tools/images-to-pdf/image-grid';
import { addRotation } from '@/tools/images-to-pdf/layout';
import type { Output, PdfOptions } from '@/tools/images-to-pdf/types';

const MAX_IMAGES = 100;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const LARGE_BATCH_BYTES = 300 * 1024 * 1024;
const ACCEPT = 'image/*,.heic,.heif';

// crypto.randomUUID() needs HTTPS; a counter works everywhere.
let lastId = 0;

type Progress = { done: number; total: number };
type Result = {
    blob: Blob;
    kind: 'pdf' | 'zip';
    pages: number;
    files: number;
    fileName: string;
};

export default function ImagesToPdf() {
    const [items, setItems] = useState<ImageItem[]>([]);
    const [options, setOptions] = useState<PdfOptions>({
        pageSize: 'a4',
        orientation: 'auto',
        margin: 'small',
    });
    const [output, setOutput] = useState<Output>('single');
    const [fileName, setFileName] = useState('images');
    const [progress, setProgress] = useState<Progress | null>(null);
    const [result, setResult] = useState<Result | null>(null);
    const [dragging, setDragging] = useState(false);
    const job = useRef<{ cancel: () => void } | null>(null);
    const thumbnails = useRef(new Set<string>());
    const input = useRef<HTMLInputElement>(null);
    const pickFiles = () => input.current?.click();

    const busy = progress !== null;
    const ready = items.filter((item) => item.status === 'ready');
    const loading = items.some((item) => item.status === 'loading');
    const totalBytes = items.reduce((sum, item) => sum + item.size, 0);
    const zipped = output === 'separate' && ready.length > 1;

    // Release previews and stop any build when leaving the page.
    useEffect(() => {
        const urls = thumbnails.current;

        return () => {
            job.current?.cancel();
            urls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, []);

    const update = (id: string, patch: Partial<ImageItem>) =>
        setItems((current) =>
            current.map((item) =>
                item.id === id ? { ...item, ...patch } : item,
            ),
        );

    const changeItems = (next: (current: ImageItem[]) => ImageItem[]) => {
        setResult(null);
        setItems(next);
    };

    const addFiles = useCallback(
        async (list: FileList | File[]) => {
            const files = Array.from(list);
            const images = files.filter(
                (file) =>
                    file.type.startsWith('image/') ||
                    /\.(heic|heif)$/i.test(file.name),
            );
            const tooBig = images.filter((file) => file.size > MAX_FILE_BYTES);
            const room = MAX_IMAGES - items.length;
            const accepted = images
                .filter((file) => file.size <= MAX_FILE_BYTES)
                .slice(0, Math.max(0, room));

            if (images.length < files.length) {
                toast.error(
                    'Some files were skipped because they are not images.',
                );
            }

            if (tooBig.length) {
                toast.error(
                    `${tooBig.length === 1 ? 'One image is' : `${tooBig.length} images are`} over 50 MB and ${tooBig.length === 1 ? 'was' : 'were'} skipped.`,
                );
            }

            if (images.length - tooBig.length > accepted.length) {
                toast.error(
                    `You can add up to ${MAX_IMAGES} images at a time.`,
                );
            }

            if (!accepted.length) {
                return;
            }

            if (
                totalBytes + accepted.reduce((s, f) => s + f.size, 0) >
                LARGE_BATCH_BYTES
            ) {
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

            changeItems((current) => [...current, ...added]);

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
        },
        [items.length, totalBytes],
    );

    // Paste images straight from the clipboard.
    useEffect(() => {
        const onPaste = (event: ClipboardEvent) => {
            const files = Array.from(event.clipboardData?.files ?? []);

            if (files.length && !busy) {
                event.preventDefault();
                void addFiles(files);
            }
        };

        window.addEventListener('paste', onPaste);

        return () => window.removeEventListener('paste', onPaste);
    }, [addFiles, busy]);

    const removeItem = (id: string) => {
        const item = items.find((candidate) => candidate.id === id);

        if (item?.thumbnail) {
            URL.revokeObjectURL(item.thumbnail);
            thumbnails.current.delete(item.thumbnail);
        }

        changeItems((current) => current.filter((c) => c.id !== id));
    };

    const clearAll = () => {
        items.forEach((item) => {
            if (item.thumbnail) {
                URL.revokeObjectURL(item.thumbnail);
                thumbnails.current.delete(item.thumbnail);
            }
        });
        changeItems(() => []);
    };

    const rotateItem = (id: string) =>
        changeItems((current) =>
            current.map((item) =>
                item.id === id
                    ? { ...item, rotation: addRotation(item.rotation, 90) }
                    : item,
            ),
        );

    const sortByName = () =>
        changeItems((current) =>
            [...current].sort((a, b) => compareNames(a.name, b.name)),
        );

    const setOption = <K extends keyof PdfOptions>(
        key: K,
        value: PdfOptions[K],
    ) => {
        setResult(null);
        setOptions((current) => ({ ...current, [key]: value }));
    };

    const build = async () => {
        const images = ready.flatMap((item) =>
            item.source
                ? [
                      {
                          blob: item.source,
                          rotation: item.rotation,
                          name: item.name,
                      },
                  ]
                : [],
        );
        const name = safeFileName(fileName, 'images');

        setProgress({ done: 0, total: images.length });

        const current = createPdf(
            { images, options, output, title: name },
            (done, total) => setProgress({ done, total }),
        );

        job.current = current;

        try {
            const built = await current.promise;

            setResult({ ...built, fileName: `${name}.${built.kind}` });
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong while building the PDF.',
            );
        } finally {
            job.current = null;
            setProgress(null);
        }
    };

    const cancel = () => {
        job.current?.cancel();
        job.current = null;
        setProgress(null);
    };

    const actions = (
        <Actions
            canBuild={ready.length > 0 && !loading}
            count={ready.length}
            zipped={zipped}
            loading={loading}
            progress={progress}
            result={result}
            onBuild={build}
            onCancel={cancel}
            onStartOver={clearAll}
        />
    );

    return (
        <>
            <Head title="Images to PDF" />

            <div
                className="relative"
                onDragEnter={(event) => {
                    if (event.dataTransfer.types.includes('Files')) {
                        setDragging(true);
                    }
                }}
                onDragOver={(event) => {
                    if (event.dataTransfer.types.includes('Files')) {
                        event.preventDefault();
                    }
                }}
                onDragLeave={(event) => {
                    if (
                        !event.currentTarget.contains(
                            event.relatedTarget as Node,
                        )
                    ) {
                        setDragging(false);
                    }
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);

                    if (!busy && event.dataTransfer.files.length) {
                        void addFiles(event.dataTransfer.files);
                    }
                }}
            >
                <input
                    ref={input}
                    type="file"
                    multiple
                    accept={ACCEPT}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(event) => {
                        if (event.target.files) {
                            void addFiles(event.target.files);
                        }

                        event.target.value = '';
                    }}
                />

                <div
                    className={cn(
                        'mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12',
                        items.length > 0 && 'pb-32 lg:pb-12',
                    )}
                >
                    <Link
                        href={home()}
                        className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="size-4" />
                        All tools
                    </Link>
                    <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                        Images to PDF
                    </h1>
                    <p className="mt-3 max-w-2xl text-pretty text-muted-foreground sm:text-lg">
                        Turn photos and scans into a PDF. Drag to reorder,
                        rotate any page, then download.
                    </p>
                    <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink">
                        <Lock className="size-3.5" />
                        Your images never leave this device.
                    </p>

                    {items.length === 0 ? (
                        <EmptyDropZone onPick={pickFiles} />
                    ) : (
                        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
                            <section aria-label="Pages" className="min-w-0">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm text-muted-foreground">
                                        <span className="font-semibold text-foreground">
                                            {items.length}{' '}
                                            {items.length === 1
                                                ? 'image'
                                                : 'images'}
                                        </span>{' '}
                                        · {formatBytes(totalBytes)}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-10 rounded-full"
                                            onClick={pickFiles}
                                            disabled={
                                                busy ||
                                                items.length >= MAX_IMAGES
                                            }
                                        >
                                            <Plus />
                                            Add
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-10 rounded-full"
                                            onClick={sortByName}
                                            disabled={busy || items.length < 2}
                                        >
                                            <ArrowDownAZ />
                                            Sort by name
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-10 rounded-full"
                                            onClick={clearAll}
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
                                        busy &&
                                            'pointer-events-none opacity-60',
                                    )}
                                >
                                    <ImageGrid
                                        items={items}
                                        options={options}
                                        onReorder={(next) =>
                                            changeItems(() => next)
                                        }
                                        onRotate={rotateItem}
                                        onRemove={removeItem}
                                    />
                                </fieldset>
                                <p className="mt-4 text-xs text-muted-foreground">
                                    <span className="pointer-coarse:hidden">
                                        Drag images to change the page order, or
                                        drop more images anywhere on the page.
                                    </span>
                                    <span className="hidden pointer-coarse:inline">
                                        Press and hold an image to move it.
                                    </span>
                                </p>
                            </section>

                            <aside className="rounded-3xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-24">
                                <h2 className="font-display text-xl font-bold tracking-tight">
                                    PDF settings
                                </h2>
                                <fieldset
                                    disabled={busy}
                                    className="mt-5 space-y-5"
                                >
                                    <Segmented
                                        label="Output"
                                        value={output}
                                        onChange={(value) => {
                                            setResult(null);
                                            setOutput(value);
                                        }}
                                        options={[
                                            {
                                                value: 'single',
                                                label: 'One PDF',
                                            },
                                            {
                                                value: 'separate',
                                                label: 'PDF per image',
                                            },
                                        ]}
                                        hint={
                                            output === 'separate'
                                                ? 'Each image becomes its own PDF, downloaded together as a ZIP.'
                                                : 'All images go into one PDF, a page each.'
                                        }
                                    />
                                    <Segmented
                                        label="Page size"
                                        value={options.pageSize}
                                        onChange={(value) =>
                                            setOption('pageSize', value)
                                        }
                                        options={[
                                            { value: 'a4', label: 'A4' },
                                            {
                                                value: 'letter',
                                                label: 'Letter',
                                            },
                                            {
                                                value: 'fit',
                                                label: 'Fit image',
                                            },
                                        ]}
                                        hint={
                                            options.pageSize === 'fit'
                                                ? 'Each page takes the shape of its image.'
                                                : undefined
                                        }
                                    />
                                    <Segmented
                                        label="Orientation"
                                        value={options.orientation}
                                        onChange={(value) =>
                                            setOption('orientation', value)
                                        }
                                        disabled={options.pageSize === 'fit'}
                                        options={[
                                            { value: 'auto', label: 'Auto' },
                                            {
                                                value: 'portrait',
                                                label: 'Portrait',
                                            },
                                            {
                                                value: 'landscape',
                                                label: 'Landscape',
                                            },
                                        ]}
                                    />
                                    <Segmented
                                        label="Margin"
                                        value={options.margin}
                                        onChange={(value) =>
                                            setOption('margin', value)
                                        }
                                        options={[
                                            { value: 'none', label: 'None' },
                                            { value: 'small', label: 'Small' },
                                            {
                                                value: 'normal',
                                                label: 'Normal',
                                            },
                                        ]}
                                    />
                                    <div>
                                        <Label htmlFor="pdf-name">
                                            File name
                                        </Label>
                                        <div className="mt-2 flex items-center rounded-lg border border-input bg-background focus-within:ring-[3px] focus-within:ring-ring/50">
                                            <Input
                                                id="pdf-name"
                                                value={fileName}
                                                onChange={(event) => {
                                                    setResult(null);
                                                    setFileName(
                                                        event.target.value,
                                                    );
                                                }}
                                                autoComplete="off"
                                                spellCheck={false}
                                                className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
                                            />
                                            <span className="pr-3 text-sm text-muted-foreground">
                                                {zipped ? '.zip' : '.pdf'}
                                            </span>
                                        </div>
                                    </div>
                                </fieldset>

                                <div className="mt-6 hidden lg:block">
                                    {actions}
                                </div>
                            </aside>
                        </div>
                    )}
                </div>

                {items.length > 0 && (
                    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
                        {actions}
                    </div>
                )}

                {dragging && (
                    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
                        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-brand bg-card px-6 py-12 text-center">
                            <ImagePlus className="size-10 text-brand" />
                            <p className="font-display text-2xl font-bold tracking-tight">
                                Drop to add images
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function EmptyDropZone({ onPick }: { onPick: () => void }) {
    return (
        <button
            type="button"
            onClick={onPick}
            className="group mt-8 flex w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-input bg-card px-6 py-14 text-center transition-colors outline-none hover:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:py-20"
        >
            <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition-colors group-hover:bg-brand group-hover:text-white">
                <ImagePlus className="size-8" />
            </span>
            <span className="mt-5 hidden font-display text-2xl font-bold tracking-tight sm:block">
                Drop images here
            </span>
            <span className="mt-5 inline-flex h-12 items-center rounded-full bg-primary px-6 font-medium text-primary-foreground sm:mt-4">
                Choose images
            </span>
            <span className="mt-4 text-sm text-muted-foreground">
                JPG, PNG, WebP, HEIC and more · up to {MAX_IMAGES} images
            </span>
        </button>
    );
}

function Actions({
    canBuild,
    count,
    zipped,
    loading,
    progress,
    result,
    onBuild,
    onCancel,
    onStartOver,
}: {
    canBuild: boolean;
    count: number;
    zipped: boolean;
    loading: boolean;
    progress: Progress | null;
    result: Result | null;
    onBuild: () => void;
    onCancel: () => void;
    onStartOver: () => void;
}) {
    if (progress) {
        const percent = progress.total
            ? Math.round((progress.done / progress.total) * 100)
            : 0;

        return (
            <div className="space-y-3" aria-live="polite">
                <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                        {zipped ? 'Making PDF' : 'Adding page'}{' '}
                        {Math.min(progress.done + 1, progress.total)} of{' '}
                        {progress.total}…
                    </span>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="h-9 rounded-full px-3 text-muted-foreground hover:text-foreground"
                    >
                        Cancel
                    </button>
                </div>
                <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    aria-label="Building PDF"
                    className="h-2 overflow-hidden rounded-full bg-secondary"
                >
                    <div
                        className="h-full rounded-full bg-brand transition-[width] duration-300"
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>
        );
    }

    if (result) {
        return <ResultCard result={result} onStartOver={onStartOver} />;
    }

    return (
        <Button
            onClick={onBuild}
            disabled={!canBuild}
            className="h-12 w-full rounded-full text-base"
        >
            {loading
                ? 'Preparing images…'
                : zipped
                  ? `Create ${count} PDFs`
                  : `Create PDF${count ? ` · ${count} ${count === 1 ? 'page' : 'pages'}` : ''}`}
        </Button>
    );
}

function ResultCard({
    result,
    onStartOver,
}: {
    result: Result;
    onStartOver: () => void;
}) {
    const file = new File([result.blob], result.fileName, {
        type: result.blob.type,
    });
    const canShare =
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

    const share = async () => {
        try {
            await navigator.share({ files: [file], title: result.fileName });
        } catch (error) {
            if (
                !(error instanceof DOMException && error.name === 'AbortError')
            ) {
                toast.error('Sharing did not work. Try downloading instead.');
            }
        }
    };

    return (
        <div className="space-y-3" aria-live="polite">
            <div className="flex items-center gap-3">
                <CircleCheck className="size-6 shrink-0 text-brand" />
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                        {result.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {result.kind === 'zip'
                            ? `${result.files} PDFs in a ZIP`
                            : `${result.pages} ${result.pages === 1 ? 'page' : 'pages'}`}{' '}
                        · {formatBytes(result.blob.size)}
                    </p>
                </div>
            </div>
            <div className="flex gap-2">
                <Button
                    onClick={() => downloadBlob(result.blob, result.fileName)}
                    className="h-12 flex-1 rounded-full text-base"
                >
                    <Download className="size-5" />
                    Download
                </Button>
                {canShare && (
                    <Button
                        variant="outline"
                        onClick={share}
                        className="size-12 rounded-full"
                        aria-label="Share"
                    >
                        <Share2 className="size-5" />
                    </Button>
                )}
                <Button
                    variant="outline"
                    onClick={onStartOver}
                    className="size-12 rounded-full"
                    aria-label="Start over"
                    title="Start over"
                >
                    <RotateCcw className="size-5" />
                </Button>
            </div>
        </div>
    );
}
