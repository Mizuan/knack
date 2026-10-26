import { Head } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import FileGrid, { FittedThumbnail } from '@/components/tools/file-grid';
import FileNameField from '@/components/tools/file-name-field';
import Segmented from '@/components/tools/segmented';
import ToolActions from '@/components/tools/tool-actions';
import type { ToolProgress, ToolResult } from '@/components/tools/tool-actions';
import ToolShell from '@/components/tools/tool-shell';
import { Label } from '@/components/ui/label';
import { useImageList } from '@/hooks/use-image-list';
import { formatBytes, safeFileName } from '@/lib/files';
import { convertImages } from '@/tools/convert-images/client';
import { canSave, FORMATS } from '@/tools/convert-images/formats';
import type { Format, Outcome } from '@/tools/convert-images/types';

const FORMAT_HINTS: Record<Format, string> = {
    jpg: 'Works everywhere. Best for photos; transparent areas become white.',
    png: 'No quality loss and keeps transparency. Larger files, best for screenshots and graphics.',
    webp: 'Smaller than JPG at the same quality, with transparency. Most apps and browsers open it.',
};

/** "IMG_0012.HEIC" → "HEIC". */
const formatOf = (name: string) =>
    name.includes('.') ? (name.split('.').pop() ?? '').toUpperCase() : 'Image';

const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

export default function ConvertImages() {
    const [format, setFormat] = useState<Format>('jpg');
    const [quality, setQuality] = useState(90);
    const [maxSide, setMaxSide] = useState<number | null>(null);
    const [webp, setWebp] = useState(true);
    const [zipName, setZipName] = useState('converted');
    const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
    const [progress, setProgress] = useState<ToolProgress | null>(null);
    const [result, setResult] = useState<ToolResult | null>(null);
    const job = useRef<{ cancel: () => void } | null>(null);

    const reset = () => {
        setResult(null);
        setOutcomes({});
    };

    // HEIC goes to PNG first so converting it loses nothing extra.
    const list = useImageList({
        maxImages: 50,
        heicAs: 'image/png',
        onChange: reset,
    });

    useEffect(() => {
        void canSave('webp').then((supported) => {
            setWebp(supported);

            if (!supported) {
                setFormat((current) => (current === 'webp' ? 'jpg' : current));
            }
        });
    }, []);

    const busy = progress !== null;
    const count = list.ready.length;
    const { label, extension, lossy } = FORMATS[format];

    const convert = async () => {
        const ready = list.ready.filter((item) => item.source);
        const images = ready.map((item) => ({
            blob: item.source as Blob,
            rotation: item.rotation,
            name: item.name,
            size: item.size,
        }));
        const progressLabel = (done: number) =>
            `Converting ${Math.min(done + 1, images.length)} of ${images.length}…`;

        setOutcomes({});
        setProgress({ label: progressLabel(0), done: 0, total: images.length });

        const current = convertImages(
            { images, format, quality: quality / 100, maxSide },
            (done, total) =>
                setProgress({ label: progressLabel(done), done, total }),
        );

        job.current = current;

        try {
            const { blob, kind, outcomes: results } = await current.promise;

            setOutcomes(
                Object.fromEntries(
                    ready.map((item, i) => [item.id, results[i]]),
                ),
            );

            const single = images[0].name.replace(/\.[^.]+$/, '');

            setResult({
                blob,
                fileName:
                    kind === 'zip'
                        ? `${safeFileName(zipName, 'converted')}.zip`
                        : `${safeFileName(single, 'image')}.${extension}`,
                details:
                    kind === 'zip'
                        ? `${plural(images.length, `${label} image`, `${label} images`)} in a ZIP`
                        : `${label}, photo details removed`,
            });
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong while converting.',
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
            <Head title="Convert images" />

            <ToolShell
                title="Convert images"
                description="Change image formats: iPhone HEIC to JPG, PNG to JPG, JPG to PNG and more. Converting also removes hidden photo details like location."
                noun="images"
                accept="image/*,.heic,.heif"
                emptyHint={`HEIC, JPG, PNG, WebP and more · up to ${list.maxItems} images`}
                hasFiles={list.items.length > 0}
                busy={busy}
                onFiles={list.add}
                settingsTitle="Convert"
                actions={
                    <ToolActions
                        label={
                            list.loading
                                ? 'Preparing images…'
                                : count === 0
                                  ? 'Add an image'
                                  : `Convert ${plural(count, 'image', 'images')} to ${label}`
                        }
                        disabled={count === 0 || list.loading}
                        progress={progress}
                        result={result}
                        onRun={convert}
                        onCancel={cancel}
                        onStartOver={list.clear}
                    />
                }
                settings={
                    <>
                        <Segmented
                            label="Convert to"
                            value={format}
                            onChange={(value) => {
                                reset();
                                setFormat(value);
                            }}
                            options={[
                                { value: 'jpg', label: 'JPG' },
                                { value: 'png', label: 'PNG' },
                                {
                                    value: 'webp',
                                    label: 'WebP',
                                    disabled: !webp,
                                },
                            ]}
                            hint={
                                webp
                                    ? FORMAT_HINTS[format]
                                    : `${FORMAT_HINTS[format]} This browser can't save WebP.`
                            }
                        />
                        {lossy && (
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <Label htmlFor="quality">Quality</Label>
                                    <span className="text-sm text-muted-foreground tabular-nums">
                                        {quality}%
                                    </span>
                                </div>
                                <input
                                    id="quality"
                                    type="range"
                                    min={50}
                                    max={100}
                                    step={5}
                                    value={quality}
                                    onChange={(event) => {
                                        reset();
                                        setQuality(Number(event.target.value));
                                    }}
                                    className="h-11 w-full cursor-pointer accent-brand"
                                />
                                <p className="mt-1 text-xs text-muted-foreground">
                                    90% looks the same as the original for most
                                    photos. Lower makes smaller files.
                                </p>
                            </div>
                        )}
                        <Segmented
                            label="Longest side"
                            value={String(maxSide ?? 'full')}
                            onChange={(value) => {
                                reset();
                                setMaxSide(
                                    value === 'full' ? null : Number(value),
                                );
                            }}
                            options={[
                                { value: 'full', label: 'Full' },
                                { value: '4000', label: '4000' },
                                { value: '2000', label: '2000' },
                                { value: '1080', label: '1080' },
                            ]}
                            hint="Images are never enlarged."
                        />
                        {count > 1 && (
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
                        className="grid-cols-3 sm:grid-cols-4"
                        renderPreview={(item) => (
                            <FittedThumbnail item={item} />
                        )}
                        renderInfo={(item) => {
                            const outcome = outcomes[item.id];

                            return outcome
                                ? `${formatBytes(outcome.before)} → ${formatBytes(outcome.after)}`
                                : `${formatOf(item.name)} · ${formatBytes(item.size)}`;
                        }}
                    />
                )}
            </ToolShell>
        </>
    );
}
