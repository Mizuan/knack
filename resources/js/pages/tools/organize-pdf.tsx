import { Head } from '@inertiajs/react';
import { CircleAlert, FileText, Plus, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import FileNameField from '@/components/tools/file-name-field';
import PageGrid from '@/components/tools/page-grid';
import type { PageItem } from '@/components/tools/page-grid';
import ToolActions from '@/components/tools/tool-actions';
import type { ToolProgress, ToolResult } from '@/components/tools/tool-actions';
import ToolShell from '@/components/tools/tool-shell';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useFileList } from '@/hooks/use-file-list';
import { safeFileName } from '@/lib/files';
import { isPdf, preparePdf, renderPageThumbnails } from '@/lib/pdf';
import type { PdfMeta } from '@/lib/pdf';
import { addRotation } from '@/lib/rotation';
import { organizePdf } from '@/tools/organize-pdf/client';

const MAX_PAGES = 400;

const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

/** "A", "B", … "Z", "AA" for the PDFs in the order they were added. */
const labelFor = (n: number): string =>
    n < 26
        ? String.fromCharCode(65 + n)
        : labelFor(Math.floor(n / 26) - 1) + labelFor(n % 26);

export default function OrganizePdf() {
    const [pages, setPages] = useState<PageItem[]>([]);
    const [fileName, setFileName] = useState('organized');
    const [progress, setProgress] = useState<ToolProgress | null>(null);
    const [result, setResult] = useState<ToolResult | null>(null);
    const job = useRef<{ cancel: () => void } | null>(null);
    // Files whose pages are drawn or being drawn, and their labels.
    const expanded = useRef(new Map<string, string>());
    const removed = useRef(new Set<string>());
    const urls = useRef(new Set<string>());
    // Every page as first drawn, per PDF, for resetting.
    const original = useRef(new Map<string, PageItem[]>());
    // PDFs are drawn one after another so their pages stay in order.
    const queue = useRef<Promise<void>>(Promise.resolve());
    // Pages drawn so far, per PDF (deleting a page doesn't change this).
    const [drawn, setDrawn] = useState<Record<string, number>>({});

    const list = useFileList<PdfMeta>({
        maxItems: 20,
        maxFileBytes: 100 * 1024 * 1024,
        noun: ['PDF', 'PDFs'],
        accepts: isPdf,
        prepare: preparePdf,
        onChange: () => setResult(null),
    });

    // Draw every page of each PDF once it has been read.
    useEffect(() => {
        for (const item of list.ready) {
            if (expanded.current.has(item.id) || !item.source) {
                continue;
            }

            const label = labelFor(expanded.current.size);

            expanded.current.set(item.id, label);
            queue.current = queue.current.then(() =>
                renderPageThumbnails(
                    item.source as Blob,
                    (thumbnail) => {
                        const page: PageItem = {
                            id: `${item.id}-${thumbnail.index}`,
                            fileId: item.id,
                            fileLabel: label,
                            page: thumbnail.index,
                            rotation: 0,
                            thumbnail: thumbnail.url,
                            width: thumbnail.width,
                            height: thumbnail.height,
                        };

                        urls.current.add(thumbnail.url);
                        original.current.set(item.id, [
                            ...(original.current.get(item.id) ?? []),
                            page,
                        ]);
                        setPages((current) =>
                            current.length >= MAX_PAGES
                                ? current
                                : [...current, page],
                        );
                        setDrawn((current) => ({
                            ...current,
                            [item.id]: (current[item.id] ?? 0) + 1,
                        }));
                    },
                    () => removed.current.has(item.id),
                ).catch(() => {
                    toast.error(`Couldn't show the pages of ${item.name}.`);
                }),
            );
        }
    }, [list.ready]);

    // Release page previews when leaving.
    useEffect(() => {
        const all = urls.current;

        return () => all.forEach((url) => URL.revokeObjectURL(url));
    }, []);

    const busy = progress !== null;
    const files = list.items;
    const drawing = list.ready.reduce(
        (sum, item) => sum + (item.meta?.pageCount ?? 0),
        0,
    );
    const drawnTotal = list.ready.reduce(
        (sum, item) => sum + (drawn[item.id] ?? 0),
        0,
    );
    const loadingPages =
        list.loading || drawnTotal < Math.min(drawing, MAX_PAGES);
    const pageCounts = new Map<string, number>();

    for (const page of pages) {
        pageCounts.set(page.fileId, (pageCounts.get(page.fileId) ?? 0) + 1);
    }

    const changePages = (next: (current: PageItem[]) => PageItem[]) => {
        setResult(null);
        setPages(next);
    };

    const removeFile = (id: string) => {
        removed.current.add(id);
        list.remove(id);
        changePages((current) => current.filter((page) => page.fileId !== id));
    };

    const deletePage = (id: string) => {
        const index = pages.findIndex((page) => page.id === id);
        const page = pages[index];

        if (!page) {
            return;
        }

        changePages((current) =>
            current.filter((candidate) => candidate.id !== id),
        );
        toast(`Deleted page ${page.page + 1}`, {
            action: {
                label: 'Undo',
                onClick: () =>
                    changePages((current) => [
                        ...current.slice(0, index),
                        page,
                        ...current.slice(index),
                    ]),
            },
        });
    };

    // Back to every page in its original order and rotation.
    // Back to every page of every PDF, in the original order and rotation.
    const resetPages = () =>
        changePages(() =>
            list.ready.flatMap((item) => original.current.get(item.id) ?? []),
        );

    const save = async () => {
        const sources = list.ready.filter((item) => item.source);
        const index = new Map(sources.map((item, i) => [item.id, i]));
        const picks = pages.flatMap((page) => {
            const source = index.get(page.fileId);

            return source === undefined
                ? []
                : [{ source, page: page.page, rotation: page.rotation }];
        });
        const name = safeFileName(fileName, 'organized');
        const progressLabel = (done: number, total: number) =>
            `Adding page ${Math.min(done + 1, total)} of ${total}…`;

        setProgress({
            label: progressLabel(0, picks.length),
            done: 0,
            total: picks.length,
        });

        const current = organizePdf(
            {
                sources: sources.map((item) => item.source as Blob),
                picks,
                title: name,
            },
            (done, total) =>
                setProgress({ label: progressLabel(done, total), done, total }),
        );

        job.current = current;

        try {
            const { blob, pages: count } = await current.promise;

            setResult({
                blob,
                fileName: `${name}.pdf`,
                details: plural(count, 'page', 'pages'),
            });
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong while saving.',
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

    const deleted = Math.max(0, Math.min(drawnTotal, MAX_PAGES) - pages.length);

    return (
        <>
            <Head title="Organise PDF" />

            <ToolShell
                title="Organise PDF"
                description="Reorder, rotate and delete pages, even across several PDFs, then save them as one."
                noun="PDFs"
                accept="application/pdf,.pdf"
                emptyHint={`PDF files · up to ${MAX_PAGES} pages in total`}
                hasFiles={files.length > 0}
                busy={busy}
                onFiles={list.add}
                settingsTitle="New PDF"
                actions={
                    <ToolActions
                        label={
                            loadingPages
                                ? 'Showing pages…'
                                : pages.length === 0
                                  ? 'No pages left'
                                  : `Save ${plural(pages.length, 'page', 'pages')} as a PDF`
                        }
                        disabled={loadingPages || pages.length === 0}
                        progress={progress}
                        result={result}
                        onRun={save}
                        onCancel={cancel}
                        onStartOver={() => {
                            files.forEach((item) =>
                                removed.current.add(item.id),
                            );
                            list.clear();
                            setPages([]);
                        }}
                    />
                }
                settings={
                    <>
                        <dl className="grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-secondary px-4 py-3">
                                <dt className="text-muted-foreground">Pages</dt>
                                <dd className="mt-0.5 font-display text-2xl font-bold tabular-nums">
                                    {pages.length}
                                </dd>
                            </div>
                            <div className="rounded-xl bg-secondary px-4 py-3">
                                <dt className="text-muted-foreground">
                                    Deleted
                                </dt>
                                <dd className="mt-0.5 font-display text-2xl font-bold tabular-nums">
                                    {deleted}
                                </dd>
                            </div>
                        </dl>
                        <Button
                            variant="outline"
                            className="h-10 w-full rounded-full"
                            onClick={resetPages}
                            disabled={loadingPages}
                        >
                            <RotateCcw />
                            Reset to the original pages
                        </Button>
                        <FileNameField
                            value={fileName}
                            extension="pdf"
                            onChange={(value) => {
                                setResult(null);
                                setFileName(value);
                            }}
                        />
                    </>
                }
            >
                {(pick) => (
                    <>
                        <section
                            aria-label="PDFs"
                            className="flex flex-wrap items-center gap-2"
                        >
                            {files.map((item) => (
                                <span
                                    key={item.id}
                                    className="inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-border bg-card pr-1 pl-3 text-sm"
                                >
                                    {item.status === 'loading' ? (
                                        <Spinner className="size-4" />
                                    ) : item.status === 'error' ? (
                                        <CircleAlert className="size-4 text-destructive-foreground" />
                                    ) : (
                                        <span className="inline-flex size-5 items-center justify-center rounded bg-secondary text-xs font-semibold">
                                            {expanded.current.get(item.id) ?? (
                                                <FileText className="size-3" />
                                            )}
                                        </span>
                                    )}
                                    <span className="max-w-48 truncate">
                                        {item.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {item.status === 'error'
                                            ? (item.error ??
                                              "Can't read this file")
                                            : item.meta
                                              ? `${pageCounts.get(item.id) ?? 0}/${item.meta.pageCount}`
                                              : ''}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeFile(item.id)}
                                        disabled={busy}
                                        aria-label={`Remove ${item.name}`}
                                        className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                                    >
                                        <X className="size-4" />
                                    </button>
                                </span>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10 rounded-full"
                                onClick={pick}
                                disabled={busy}
                            >
                                <Plus />
                                Add PDF
                            </Button>
                        </section>

                        <fieldset
                            disabled={busy}
                            className={
                                busy
                                    ? 'pointer-events-none opacity-60'
                                    : undefined
                            }
                        >
                            <PageGrid
                                pages={pages}
                                showFiles={files.length > 1}
                                onReorder={(next) => changePages(() => next)}
                                onRotate={(id) =>
                                    changePages((current) =>
                                        current.map((page) =>
                                            page.id === id
                                                ? {
                                                      ...page,
                                                      rotation: addRotation(
                                                          page.rotation,
                                                          90,
                                                      ),
                                                  }
                                                : page,
                                        ),
                                    )
                                }
                                onDelete={deletePage}
                            />
                        </fieldset>
                        <p className="text-xs text-muted-foreground">
                            <span className="pointer-coarse:hidden">
                                Drag pages to change the order.
                            </span>
                            <span className="hidden pointer-coarse:inline">
                                Press and hold a page to move it.
                            </span>{' '}
                            {drawing > MAX_PAGES &&
                                `Only the first ${MAX_PAGES} pages are shown.`}
                        </p>
                    </>
                )}
            </ToolShell>
        </>
    );
}
