import { Head } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import FileGrid, { FittedThumbnail } from '@/components/tools/file-grid';
import FileNameField from '@/components/tools/file-name-field';
import Segmented from '@/components/tools/segmented';
import ToolActions from '@/components/tools/tool-actions';
import type { ToolProgress, ToolResult } from '@/components/tools/tool-actions';
import ToolShell from '@/components/tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useImageList } from '@/hooks/use-image-list';
import { formatBytes, safeFileName } from '@/lib/files';
import { canSave, FORMATS } from '@/tools/convert-images/formats';
import { shrinkImages } from '@/tools/shrink-images/client';
import type { ShrinkFormat, ShrinkOutcome } from '@/tools/shrink-images/types';

/**
 * Limits use 1 MB = 1,000,000 bytes, the stricter reading, so a file that
 * fits here also fits forms that count 1 MB as 1,048,576 bytes.
 */
const PRESETS = [
    { value: '100000', label: '100 KB' },
    { value: '200000', label: '200 KB' },
    { value: '500000', label: '500 KB' },
    { value: '1000000', label: '1 MB' },
    { value: '2000000', label: '2 MB' },
    { value: 'custom', label: 'Other' },
];

const limitLabel = (bytes: number) =>
    bytes >= 1_000_000
        ? `${+(bytes / 1_000_000).toFixed(2)} MB`
        : `${Math.round(bytes / 1000)} KB`;

const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

export default function ShrinkImages() {
    const [preset, setPreset] = useState('1000000');
    const [custom, setCustom] = useState({
        amount: '300',
        unit: 'KB' as 'KB' | 'MB',
    });
    const [format, setFormat] = useState<ShrinkFormat>('jpg');
    const [webp, setWebp] = useState(true);
    const [zipName, setZipName] = useState('shrunk');
    const [outcomes, setOutcomes] = useState<Record<string, ShrinkOutcome>>({});
    const [progress, setProgress] = useState<ToolProgress | null>(null);
    const [result, setResult] = useState<ToolResult | null>(null);
    const job = useRef<{ cancel: () => void } | null>(null);

    const reset = () => {
        setResult(null);
        setOutcomes({});
    };

    const list = useImageList({
        maxImages: 50,
        heicAs: 'image/png',
        onChange: reset,
    });

    useEffect(() => {
        void canSave('webp').then(setWebp);
    }, []);

    const customBytes =
        Number(custom.amount) * (custom.unit === 'MB' ? 1_000_000 : 1000);
    const target = preset === 'custom' ? customBytes : Number(preset);
    const validTarget = Number.isFinite(target) && target >= 10_000;
    const busy = progress !== null;
    const count = list.ready.length;
    const { label, extension } = FORMATS[format];

    const shrink = async () => {
        const ready = list.ready.filter((item) => item.source);
        const images = ready.map((item) => ({
            blob: item.source as Blob,
            rotation: item.rotation,
            name: item.name,
            size: item.size,
        }));
        const progressLabel = (done: number) =>
            `Shrinking ${Math.min(done + 1, images.length)} of ${images.length}…`;

        setOutcomes({});
        setProgress({ label: progressLabel(0), done: 0, total: images.length });

        const current = shrinkImages(
            { images, target, format },
            (done, total) =>
                setProgress({ label: progressLabel(done), done, total }),
        );

        job.current = current;

        try {
            const { blob, kind, outcomes: results } = await current.promise;
            const missed = results.filter((outcome) => !outcome.fits).length;

            setOutcomes(
                Object.fromEntries(
                    ready.map((item, i) => [item.id, results[i]]),
                ),
            );

            if (missed) {
                toast.warning(
                    `${plural(missed, 'image', 'images')} couldn't get under ${limitLabel(target)} without becoming too small. ${missed === 1 ? 'It is' : 'They are'} included at the smallest size Tinyfold could make.`,
                );
            }

            setResult({
                blob,
                fileName:
                    kind === 'zip'
                        ? `${safeFileName(zipName, 'shrunk')}.zip`
                        : `${safeFileName(images[0].name.replace(/\.[^.]+$/, ''), 'image')}.${extension}`,
                details:
                    kind === 'zip'
                        ? `${plural(images.length, 'image', 'images')} in a ZIP`
                        : missed
                          ? `Smallest possible ${label}`
                          : `${label} under ${limitLabel(target)}`,
            });
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong while shrinking.',
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
            <Head title="Shrink images" />

            <ToolShell
                title="Shrink images"
                description="Get photos under a size limit, like 1 MB for an upload form. Tinyfold keeps the best quality that fits and only makes images smaller when it has to."
                noun="images"
                accept="image/*,.heic,.heif"
                emptyHint={`JPG, PNG, HEIC, WebP and more · up to ${list.maxItems} images`}
                hasFiles={list.items.length > 0}
                busy={busy}
                onFiles={list.add}
                settingsTitle="Size limit"
                actions={
                    <ToolActions
                        label={
                            list.loading
                                ? 'Preparing images…'
                                : !validTarget
                                  ? 'Choose a limit of at least 10 KB'
                                  : count === 0
                                    ? 'Add an image'
                                    : `Shrink ${plural(count, 'image', 'images')} under ${limitLabel(target)}`
                        }
                        disabled={count === 0 || list.loading || !validTarget}
                        progress={progress}
                        result={result}
                        onRun={shrink}
                        onCancel={cancel}
                        onStartOver={list.clear}
                    />
                }
                settings={
                    <>
                        <Segmented
                            label="Each image under"
                            value={preset}
                            onChange={(value) => {
                                reset();
                                setPreset(value);
                            }}
                            options={PRESETS}
                            columns={3}
                        />
                        {preset === 'custom' && (
                            <div>
                                <Label htmlFor="custom-limit">
                                    Custom limit
                                </Label>
                                <div className="mt-2 flex gap-2">
                                    <Input
                                        id="custom-limit"
                                        type="number"
                                        inputMode="decimal"
                                        min={10}
                                        step="any"
                                        value={custom.amount}
                                        onChange={(event) => {
                                            reset();
                                            setCustom({
                                                ...custom,
                                                amount: event.target.value,
                                            });
                                        }}
                                        className="h-11"
                                    />
                                    <div className="w-36 shrink-0">
                                        <Segmented
                                            label="Unit"
                                            hideLabel
                                            value={custom.unit}
                                            onChange={(unit) => {
                                                reset();
                                                setCustom({ ...custom, unit });
                                            }}
                                            options={[
                                                { value: 'KB', label: 'KB' },
                                                { value: 'MB', label: 'MB' },
                                            ]}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        <Segmented
                            label="Save as"
                            value={format}
                            onChange={(value) => {
                                reset();
                                setFormat(value);
                            }}
                            options={[
                                { value: 'jpg', label: 'JPG' },
                                {
                                    value: 'webp',
                                    label: 'WebP',
                                    disabled: !webp,
                                },
                            ]}
                            hint={
                                format === 'jpg'
                                    ? 'JPG is accepted by almost every upload form.'
                                    : 'WebP gets more quality into the same size, but some forms only take JPG.'
                            }
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

                            if (!outcome) {
                                return formatBytes(item.size);
                            }

                            if (outcome.unchanged) {
                                return 'Already under the limit';
                            }

                            return `${formatBytes(outcome.before)} → ${formatBytes(outcome.after)}${outcome.fits ? '' : ' (too big)'}`;
                        }}
                    />
                )}
            </ToolShell>
        </>
    );
}
