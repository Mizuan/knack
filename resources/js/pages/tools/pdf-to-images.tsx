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
import { useFileList } from '@/hooks/use-file-list';
import { formatBytes, safeFileName } from '@/lib/files';
import { parsePages } from '@/lib/page-ranges';
import { isPdf, preparePdf } from '@/lib/pdf';
import type { PdfMeta } from '@/lib/pdf';
import { RenderCancelled, renderPdfPages } from '@/tools/pdf-to-images/render';
import type { PageImageFormat } from '@/tools/pdf-to-images/render';

const RESOLUTIONS = [
    {
        value: '72',
        label: 'Small',
        hint: 'Screen size (72 dpi). Quick to share, soft when zoomed.',
    },
    {
        value: '150',
        label: 'Standard',
        hint: 'Sharp on screens and fine for most printing (150 dpi).',
    },
    {
        value: '300',
        label: 'Print',
        hint: 'Print quality (300 dpi). Large files.',
    },
];

const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

export default function PdfToImages() {
    const [format, setFormat] = useState<PageImageFormat>('jpg');
    const [dpi, setDpi] = useState('150');
    const [zipName, setZipName] = useState('pages');
    const [progress, setProgress] = useState<ToolProgress | null>(null);
    const [result, setResult] = useState<ToolResult | null>(null);
    const cancelled = useRef(false);

    const list = useFileList<PdfMeta>({
        maxItems: 20,
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

    const render = async () => {
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
            `Saving page ${Math.min(done + 1, total)} of ${total}…`;

        cancelled.current = false;
        setProgress({
            label: progressLabel(0, totalPages),
            done: 0,
            total: totalPages,
        });

        try {
            const { blob, kind, count } = await renderPdfPages(
                files,
                { format, dpi: Number(dpi), quality: 0.9 },
                (done, total) =>
                    setProgress({
                        label: progressLabel(done, total),
                        done,
                        total,
                    }),
                () => cancelled.current,
            );
            const single = files[0];

            setResult({
                blob,
                fileName:
                    kind === 'zip'
                        ? `${safeFileName(zipName, 'pages')}.zip`
                        : `${safeFileName(single.name.replace(/\.pdf$/i, ''), 'page')}-p${single.pages[0] + 1}.${format}`,
                details:
                    kind === 'zip'
                        ? `${plural(count, 'image', 'images')} in a ZIP`
                        : `${format.toUpperCase()} image`,
            });
        } catch (error) {
            if (!(error instanceof RenderCancelled)) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : 'Something went wrong while saving the pages.',
                );
            }
        } finally {
            setProgress(null);
        }
    };

    const count = list.ready.length;

    return (
        <>
            <Head title="PDF to images" />

            <ToolShell
                title="PDF to images"
                description="Save PDF pages as JPG or PNG images, all of them or just the ones you pick."
                noun="PDFs"
                accept="application/pdf,.pdf"
                emptyHint={`PDF files · up to ${list.maxItems} files, 100 MB each`}
                hasFiles={list.items.length > 0}
                busy={busy}
                onFiles={list.add}
                settingsTitle="Images"
                actions={
                    <ToolActions
                        label={
                            list.loading
                                ? 'Reading PDFs…'
                                : invalid
                                  ? 'Check the page numbers'
                                  : count === 0
                                    ? 'Add a PDF'
                                    : `Save ${plural(totalPages, 'page', 'pages')} as ${format.toUpperCase()}`
                        }
                        disabled={
                            count === 0 ||
                            list.loading ||
                            invalid ||
                            totalPages === 0
                        }
                        progress={progress}
                        result={result}
                        onRun={render}
                        onCancel={() => {
                            cancelled.current = true;
                            setProgress(null);
                        }}
                        onStartOver={list.clear}
                    />
                }
                settings={
                    <>
                        <Segmented
                            label="Save as"
                            value={format}
                            onChange={(value) => {
                                setResult(null);
                                setFormat(value);
                            }}
                            options={[
                                { value: 'jpg', label: 'JPG' },
                                { value: 'png', label: 'PNG' },
                            ]}
                            hint={
                                format === 'jpg'
                                    ? 'Smaller files, good for scans and photos.'
                                    : 'Crisp text and lines, larger files.'
                            }
                        />
                        <Segmented
                            label="Resolution"
                            value={dpi}
                            onChange={(value) => {
                                setResult(null);
                                setDpi(value);
                            }}
                            options={RESOLUTIONS}
                            hint={
                                RESOLUTIONS.find(
                                    (option) => option.value === dpi,
                                )?.hint
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            To save only some pages, type them under a PDF, like{' '}
                            <span className="font-medium">1-3, 5</span>.
                        </p>
                        {totalPages > 1 && (
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
