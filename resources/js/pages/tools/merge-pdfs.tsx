import { Head } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import FileGrid, { FittedThumbnail } from '@/components/tools/file-grid';
import FileNameField from '@/components/tools/file-name-field';
import ToolActions from '@/components/tools/tool-actions';
import type { ToolProgress, ToolResult } from '@/components/tools/tool-actions';
import ToolShell from '@/components/tools/tool-shell';
import { Input } from '@/components/ui/input';
import type { FileItem } from '@/hooks/use-file-list';
import { useFileList } from '@/hooks/use-file-list';
import { formatBytes, safeFileName } from '@/lib/files';
import { cn } from '@/lib/utils';
import { mergePdfs } from '@/tools/merge-pdfs/client';
import { parsePages } from '@/tools/merge-pdfs/pages';
import { isPdf, preparePdf } from '@/tools/merge-pdfs/prepare';
import type { PdfMeta } from '@/tools/merge-pdfs/types';

type PdfItem = FileItem<PdfMeta>;

const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

export default function MergePdfs() {
    const [fileName, setFileName] = useState('merged');
    const [progress, setProgress] = useState<ToolProgress | null>(null);
    const [result, setResult] = useState<ToolResult | null>(null);
    const job = useRef<{ cancel: () => void } | null>(null);

    const list = useFileList<PdfMeta>({
        maxItems: 50,
        maxFileBytes: 100 * 1024 * 1024,
        noun: ['PDF', 'PDFs'],
        accepts: isPdf,
        prepare: preparePdf,
        onChange: () => setResult(null),
    });

    const busy = progress !== null;
    const selections = list.ready.map((item) =>
        parsePages(item.meta?.pages ?? '', item.meta?.pageCount ?? 0),
    );
    const invalid = selections.some((selection) => selection.error !== null);
    const totalPages = selections.reduce(
        (sum, selection) => sum + (selection.pages?.length ?? 0),
        0,
    );

    const merge = async () => {
        const files = list.ready.flatMap((item, i) => {
            const pages = selections[i].pages;

            return item.source && pages
                ? [{ blob: item.source, rotation: item.rotation, pages }]
                : [];
        });
        const name = safeFileName(fileName, 'merged');
        const label = (done: number) =>
            done < files.length
                ? `Adding ${Math.min(done + 1, files.length)} of ${files.length}…`
                : 'Saving…';

        setProgress({ label: label(0), done: 0, total: files.length });

        const current = mergePdfs({ files, title: name }, (done, total) =>
            setProgress({ label: label(done), done, total }),
        );

        job.current = current;

        try {
            const { blob, pages } = await current.promise;

            setResult({
                blob,
                fileName: `${name}.pdf`,
                details: plural(pages, 'page', 'pages'),
            });
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong while merging the PDFs.',
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

    const count = list.ready.length;

    return (
        <>
            <Head title="Merge PDFs" />

            <ToolShell
                title="Merge PDFs"
                description="Combine PDFs into one file. Put them in order, pick the pages you need and rotate any file."
                noun="PDFs"
                accept="application/pdf,.pdf"
                emptyHint={`PDF files · up to ${list.maxItems} files, 100 MB each`}
                hasFiles={list.items.length > 0}
                busy={busy}
                onFiles={list.add}
                settingsTitle="Merged PDF"
                actions={
                    <ToolActions
                        label={
                            list.loading
                                ? 'Reading PDFs…'
                                : invalid
                                  ? 'Check the page numbers'
                                  : count === 0
                                    ? 'Add a PDF'
                                    : `Merge ${plural(count, 'PDF', 'PDFs')} · ${plural(totalPages, 'page', 'pages')}`
                        }
                        disabled={count === 0 || list.loading || invalid}
                        progress={progress}
                        result={result}
                        onRun={merge}
                        onCancel={cancel}
                        onStartOver={list.clear}
                    />
                }
                settings={
                    <>
                        <dl className="grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-secondary px-4 py-3">
                                <dt className="text-muted-foreground">Files</dt>
                                <dd className="mt-0.5 font-display text-2xl font-bold tabular-nums">
                                    {count}
                                </dd>
                            </div>
                            <div className="rounded-xl bg-secondary px-4 py-3">
                                <dt className="text-muted-foreground">Pages</dt>
                                <dd className="mt-0.5 font-display text-2xl font-bold tabular-nums">
                                    {totalPages}
                                </dd>
                            </div>
                        </dl>
                        <p className="text-xs text-muted-foreground">
                            To use only some pages of a file, type them under
                            it, like <span className="font-medium">1-3, 5</span>
                            . Pages are added in the order you type them.
                        </p>
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
                    <FileGrid
                        list={list}
                        pick={pick}
                        busy={busy}
                        renderPreview={(item) => (
                            <FittedThumbnail
                                item={item}
                                className="rounded-none bg-white shadow-[0_1px_3px_rgb(20_22_27/0.18)] ring-1 ring-black/5"
                            />
                        )}
                        renderInfo={(item) =>
                            `${plural(item.meta?.pageCount ?? 0, 'page', 'pages')} · ${formatBytes(item.size)}`
                        }
                        renderExtra={(item) => (
                            <PagesField
                                item={item}
                                onChange={(pages) =>
                                    item.meta &&
                                    list.setMeta(item.id, {
                                        ...item.meta,
                                        pages,
                                    })
                                }
                            />
                        )}
                    />
                )}
            </ToolShell>
        </>
    );
}

function PagesField({
    item,
    onChange,
}: {
    item: PdfItem;
    onChange: (pages: string) => void;
}) {
    const value = item.meta?.pages ?? '';
    const { error } = parsePages(value, item.meta?.pageCount ?? 0);
    const errorId = `${item.id}-pages-error`;

    return (
        <div>
            <Input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="All pages"
                aria-label={`Pages to use from ${item.name}`}
                aria-invalid={error !== null}
                aria-describedby={error ? errorId : undefined}
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                className={cn(
                    'h-9 text-xs md:text-xs',
                    error && 'border-destructive',
                )}
            />
            {error && (
                <p
                    id={errorId}
                    className="mt-1 text-[11px] leading-snug text-destructive-foreground"
                >
                    {error}
                </p>
            )}
        </div>
    );
}
