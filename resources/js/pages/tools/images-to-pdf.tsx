import { Head } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import FileNameField from '@/components/tools/file-name-field';
import FileGrid from '@/components/tools/file-grid';
import Segmented from '@/components/tools/segmented';
import ToolActions from '@/components/tools/tool-actions';
import type { ToolProgress, ToolResult } from '@/components/tools/tool-actions';
import ToolShell from '@/components/tools/tool-shell';
import { useImageList } from '@/hooks/use-image-list';
import { safeFileName } from '@/lib/files';
import { createPdf } from '@/tools/images-to-pdf/client';
import PagePreview from '@/tools/images-to-pdf/page-preview';
import type { Output, PdfOptions } from '@/tools/images-to-pdf/types';

export default function ImagesToPdf() {
    const [options, setOptions] = useState<PdfOptions>({
        pageSize: 'a4',
        orientation: 'auto',
        margin: 'small',
    });
    const [output, setOutput] = useState<Output>('single');
    const [fileName, setFileName] = useState('images');
    const [progress, setProgress] = useState<ToolProgress | null>(null);
    const [result, setResult] = useState<ToolResult | null>(null);
    const job = useRef<{ cancel: () => void } | null>(null);

    const list = useImageList({
        maxImages: 100,
        onChange: () => setResult(null),
    });

    const busy = progress !== null;
    const count = list.ready.length;
    const zipped = output === 'separate' && count > 1;

    const setOption = <K extends keyof PdfOptions>(
        key: K,
        value: PdfOptions[K],
    ) => {
        setResult(null);
        setOptions((current) => ({ ...current, [key]: value }));
    };

    const build = async () => {
        const images = list.ready.flatMap((item) =>
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
        const label = (done: number) =>
            `${zipped ? 'Making PDF' : 'Adding page'} ${Math.min(done + 1, images.length)} of ${images.length}…`;

        setProgress({ label: label(0), done: 0, total: images.length });

        const current = createPdf(
            { images, options, output, title: name },
            (done, total) => setProgress({ label: label(done), done, total }),
        );

        job.current = current;

        try {
            const built = await current.promise;

            setResult({
                blob: built.blob,
                fileName: `${name}.${built.kind}`,
                details:
                    built.kind === 'zip'
                        ? `${built.files} PDFs in a ZIP`
                        : `${built.pages} ${built.pages === 1 ? 'page' : 'pages'}`,
            });
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

    return (
        <>
            <Head title="Images to PDF" />

            <ToolShell
                title="Images to PDF"
                description="Turn photos and scans into a PDF. Drag to reorder, rotate any page, then download."
                noun="images"
                accept="image/*,.heic,.heif"
                emptyHint={`JPG, PNG, WebP, HEIC and more · up to ${list.maxItems} images`}
                hasFiles={list.items.length > 0}
                busy={busy}
                onFiles={list.add}
                settingsTitle="PDF settings"
                actions={
                    <ToolActions
                        label={
                            list.loading
                                ? 'Preparing images…'
                                : zipped
                                  ? `Create ${count} PDFs`
                                  : `Create PDF${count ? ` · ${count} ${count === 1 ? 'page' : 'pages'}` : ''}`
                        }
                        disabled={count === 0 || list.loading}
                        progress={progress}
                        result={result}
                        onRun={build}
                        onCancel={cancel}
                        onStartOver={list.clear}
                    />
                }
                settings={
                    <>
                        <Segmented
                            label="Output"
                            value={output}
                            onChange={(value) => {
                                setResult(null);
                                setOutput(value);
                            }}
                            options={[
                                { value: 'single', label: 'One PDF' },
                                { value: 'separate', label: 'PDF per image' },
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
                            onChange={(value) => setOption('pageSize', value)}
                            options={[
                                { value: 'a4', label: 'A4' },
                                { value: 'letter', label: 'Letter' },
                                { value: 'fit', label: 'Fit image' },
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
                                { value: 'portrait', label: 'Portrait' },
                                { value: 'landscape', label: 'Landscape' },
                            ]}
                        />
                        <Segmented
                            label="Margin"
                            value={options.margin}
                            onChange={(value) => setOption('margin', value)}
                            options={[
                                { value: 'none', label: 'None' },
                                { value: 'small', label: 'Small' },
                                { value: 'normal', label: 'Normal' },
                            ]}
                        />
                        <FileNameField
                            value={fileName}
                            extension={zipped ? 'zip' : 'pdf'}
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
                            <PagePreview item={item} options={options} />
                        )}
                    />
                )}
            </ToolShell>
        </>
    );
}
