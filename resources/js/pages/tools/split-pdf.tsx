import { Head } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import FileGrid, { FittedThumbnail } from '@/components/tools/file-grid';
import FileNameField from '@/components/tools/file-name-field';
import PagesField from '@/components/tools/pages-field';
import Segmented from '@/components/tools/segmented';
import ToolActions from '@/components/tools/tool-actions';
import type { ToolProgress, ToolResult } from '@/components/tools/tool-actions';
import ToolShell from '@/components/tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFileList } from '@/hooks/use-file-list';
import { formatBytes, safeFileName } from '@/lib/files';
import { parsePages } from '@/lib/page-ranges';
import { isPdf, preparePdf } from '@/lib/pdf';
import type { PdfMeta } from '@/lib/pdf';
import { splitPdfs } from '@/tools/split-pdf/client';
import { splitGroups } from '@/tools/split-pdf/split';
import type { SplitMode } from '@/tools/split-pdf/split';

const MODE_HINTS: Record<SplitMode, string> = {
    extract: 'The pages you choose under each PDF become one new PDF.',
    each: 'Every page becomes its own PDF.',
    every: 'Every few pages become a PDF, in order.',
};

const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

export default function SplitPdf() {
    const [mode, setMode] = useState<SplitMode>('extract');
    const [chunk, setChunk] = useState('2');
    const [zipName, setZipName] = useState('split');
    const [progress, setProgress] = useState<ToolProgress | null>(null);
    const [result, setResult] = useState<ToolResult | null>(null);
    const job = useRef<{ cancel: () => void } | null>(null);

    const list = useFileList<PdfMeta>({
        maxItems: 20,
        maxFileBytes: 100 * 1024 * 1024,
        noun: ['PDF', 'PDFs'],
        accepts: isPdf,
        prepare: preparePdf,
        onChange: () => setResult(null),
    });

    const busy = progress !== null;
    const size = Math.max(1, Math.floor(Number(chunk) || 1));
    const selections = list.ready.map((item) =>
        parsePages(item.meta?.pages ?? '', item.meta?.pageCount ?? 0),
    );
    const invalid = selections.some((selection) => selection.error !== null);
    const outputs = selections.reduce(
        (sum, selection) =>
            sum + splitGroups(selection.pages ?? [], mode, size).length,
        0,
    );

    const split = async () => {
        const files = list.ready.flatMap((item, i) => {
            const pages = selections[i].pages;

            return item.source && pages
                ? [
                      {
                          blob: item.source,
                          name: item.name,
                          rotation: item.rotation,
                          pages,
                      },
                  ]
                : [];
        });
        const progressLabel = (done: number, total: number) =>
            `Making PDF ${Math.min(done + 1, total)} of ${total}…`;

        setProgress({
            label: progressLabel(0, outputs),
            done: 0,
            total: outputs,
        });

        const current = splitPdfs({ files, mode, chunk: size }, (done, total) =>
            setProgress({ label: progressLabel(done, total), done, total }),
        );

        job.current = current;

        try {
            const { blob, kind, files: count } = await current.promise;
            const single = files[0];

            setResult({
                blob,
                fileName:
                    kind === 'zip'
                        ? `${safeFileName(zipName, 'split')}.zip`
                        : `${safeFileName(single.name.replace(/\.pdf$/i, ''), 'document')}-extract.pdf`,
                details:
                    kind === 'zip'
                        ? `${plural(count, 'PDF', 'PDFs')} in a ZIP`
                        : plural(single.pages.length, 'page', 'pages'),
            });
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong while splitting.',
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
            <Head title="Split PDF" />

            <ToolShell
                title="Split PDF"
                description="Pull pages out of a PDF, or split it into a PDF per page or every few pages."
                noun="PDFs"
                accept="application/pdf,.pdf"
                emptyHint={`PDF files · up to ${list.maxItems} files, 100 MB each`}
                hasFiles={list.items.length > 0}
                busy={busy}
                onFiles={list.add}
                settingsTitle="Split"
                actions={
                    <ToolActions
                        label={
                            list.loading
                                ? 'Reading PDFs…'
                                : invalid
                                  ? 'Check the page numbers'
                                  : count === 0
                                    ? 'Add a PDF'
                                    : `Make ${plural(outputs, 'PDF', 'PDFs')}`
                        }
                        disabled={
                            count === 0 ||
                            list.loading ||
                            invalid ||
                            outputs === 0
                        }
                        progress={progress}
                        result={result}
                        onRun={split}
                        onCancel={cancel}
                        onStartOver={list.clear}
                    />
                }
                settings={
                    <>
                        <Segmented
                            label="Split into"
                            value={mode}
                            onChange={(value) => {
                                setResult(null);
                                setMode(value);
                            }}
                            options={[
                                { value: 'extract', label: 'One PDF' },
                                { value: 'each', label: 'Each page' },
                                { value: 'every', label: 'Every…' },
                            ]}
                            hint={MODE_HINTS[mode]}
                        />
                        {mode === 'every' && (
                            <div>
                                <Label htmlFor="chunk">Pages per PDF</Label>
                                <Input
                                    id="chunk"
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    value={chunk}
                                    onChange={(event) => {
                                        setResult(null);
                                        setChunk(event.target.value);
                                    }}
                                    className="mt-2 h-11"
                                />
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Type pages under a PDF, like{' '}
                            <span className="font-medium">1-3, 5</span>, to use
                            only those. Leave it empty for all pages.
                        </p>
                        {outputs > 1 && (
                            <FileNameField
                                value={zipName}
                                extension="zip"
                                onChange={(value) => {
                                    setResult(null);
                                    setZipName(value);
                                }}
                            />
                        )}
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
