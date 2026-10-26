import { Head } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import FileGrid, { FittedThumbnail } from '@/components/tools/file-grid';
import FileNameField from '@/components/tools/file-name-field';
import Segmented from '@/components/tools/segmented';
import ToolActions from '@/components/tools/tool-actions';
import type { ToolProgress, ToolResult } from '@/components/tools/tool-actions';
import ToolShell from '@/components/tools/tool-shell';
import { useFileList } from '@/hooks/use-file-list';
import { formatBytes, safeFileName } from '@/lib/files';
import { compressPdfs } from '@/tools/compress-pdf/client';
import type { FileOutcome, Strength } from '@/tools/compress-pdf/types';
import { isPdf, preparePdf } from '@/lib/pdf';
import type { PdfMeta } from '@/lib/pdf';

const STRENGTH_HINTS: Record<Strength, string> = {
    strong: 'Smallest files. Images at about 100 dpi: fine on screen, softer in print.',
    balanced: 'Good for email and upload forms. Images at about 150 dpi.',
    light: 'Keeps images sharp for printing, at about 300 dpi. Smaller savings.',
};

/** Below this, a saving isn't worth a new file. */
const WORTHWHILE = 0.99;

const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

const percentSaved = (before: number, after: number) =>
    Math.round((1 - after / before) * 100);

export default function CompressPdf() {
    const [strength, setStrength] = useState<Strength>('balanced');
    const [fileName, setFileName] = useState<string | null>(null);
    const [outcomes, setOutcomes] = useState<Record<string, FileOutcome>>({});
    const [progress, setProgress] = useState<ToolProgress | null>(null);
    const [result, setResult] = useState<ToolResult | null>(null);
    const [note, setNote] = useState<string | null>(null);
    const job = useRef<{ cancel: () => void } | null>(null);

    const reset = () => {
        setResult(null);
        setNote(null);
        setOutcomes({});
    };

    const list = useFileList<PdfMeta>({
        maxItems: 20,
        maxFileBytes: 200 * 1024 * 1024,
        noun: ['PDF', 'PDFs'],
        accepts: isPdf,
        prepare: preparePdf,
        onChange: reset,
    });

    const busy = progress !== null;
    const count = list.ready.length;
    const zipped = count > 1;
    const suggestedName =
        count === 1
            ? `${list.ready[0].name.replace(/\.pdf$/i, '')}-compressed`
            : 'compressed';
    const name = fileName ?? suggestedName;

    const compress = async () => {
        const ready = list.ready.filter((item) => item.source);
        const files = ready.map((item) => ({
            blob: item.source as Blob,
            name: item.name,
        }));
        const output = safeFileName(name, suggestedName);
        const label = (done: number, total: number) =>
            files.length > 1
                ? `Compressing ${Math.min(done + 1, total)} of ${total}…`
                : total
                  ? `Compressing image ${Math.min(done + 1, total)} of ${total}…`
                  : 'Compressing…';

        setOutcomes({});
        setNote(null);
        setProgress({
            label: label(0, files.length > 1 ? files.length : 0),
            done: 0,
            total: 1,
        });

        const current = compressPdfs({ files, strength }, (done, total) =>
            setProgress({ label: label(done, total), done, total }),
        );

        job.current = current;

        try {
            const { blob, kind, outcomes: results } = await current.promise;
            const before = results.reduce(
                (sum, outcome) => sum + outcome.before,
                0,
            );
            const after = results.reduce(
                (sum, outcome) => sum + outcome.after,
                0,
            );

            setOutcomes(
                Object.fromEntries(
                    ready.map((item, i) => [item.id, results[i]]),
                ),
            );

            if (results.some((outcome) => outcome.failed)) {
                toast.warning(
                    'Some PDFs could not be read and are included unchanged.',
                );
            }

            if (after >= before * WORTHWHILE) {
                setNote(
                    `${count === 1 ? 'This PDF is' : 'These PDFs are'} already about as small as Tinyfold can make ${count === 1 ? 'it' : 'them'}${strength === 'strong' ? '.' : '. Try Strong for a smaller file with softer images.'}`,
                );

                return;
            }

            setResult({
                blob,
                fileName: `${output}.${kind}`,
                details: `${percentSaved(before, after)}% smaller, was ${formatBytes(before)}`,
            });
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong while compressing.',
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
            <Head title="Compress PDF" />

            <ToolShell
                title="Compress PDF"
                description="Make PDFs smaller so they fit in an email or an upload form. Works best on scans and PDFs with photos."
                noun="PDFs"
                accept="application/pdf,.pdf"
                emptyHint={`PDF files · up to ${list.maxItems} files, 200 MB each`}
                hasFiles={list.items.length > 0}
                busy={busy}
                onFiles={list.add}
                settingsTitle="Compression"
                actions={
                    <ToolActions
                        label={
                            list.loading
                                ? 'Reading PDFs…'
                                : count === 0
                                  ? 'Add a PDF'
                                  : `Compress ${plural(count, 'PDF', 'PDFs')}`
                        }
                        disabled={count === 0 || list.loading}
                        progress={progress}
                        result={result}
                        note={note}
                        onRun={compress}
                        onCancel={cancel}
                        onStartOver={list.clear}
                    />
                }
                settings={
                    <>
                        <Segmented
                            label="Strength"
                            value={strength}
                            onChange={(value) => {
                                reset();
                                setStrength(value);
                            }}
                            options={[
                                { value: 'strong', label: 'Strong' },
                                { value: 'balanced', label: 'Balanced' },
                                { value: 'light', label: 'Light' },
                            ]}
                            hint={STRENGTH_HINTS[strength]}
                        />
                        <p className="text-xs text-muted-foreground">
                            Tinyfold shrinks the photos inside the PDF and
                            clears out leftover data. Text stays sharp. PDFs
                            that are mostly text are usually small already.
                        </p>
                        <FileNameField
                            value={name}
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
                        canRotate={false}
                        renderPreview={(item) => (
                            <FittedThumbnail
                                item={item}
                                className="rounded-none bg-white shadow-[0_1px_3px_rgb(20_22_27/0.18)] ring-1 ring-black/5"
                            />
                        )}
                        renderInfo={(item) => {
                            const outcome = outcomes[item.id];

                            if (!outcome) {
                                return `${plural(item.meta?.pageCount ?? 0, 'page', 'pages')} · ${formatBytes(item.size)}`;
                            }

                            if (outcome.failed) {
                                return "Couldn't compress";
                            }

                            return outcome.after < outcome.before * WORTHWHILE
                                ? `${formatBytes(outcome.before)} → ${formatBytes(outcome.after)} (−${percentSaved(outcome.before, outcome.after)}%)`
                                : 'Already compact';
                        }}
                    />
                )}
            </ToolShell>
        </>
    );
}
