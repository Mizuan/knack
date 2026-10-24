import { Head } from '@inertiajs/react';
import { Check } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import FileNameField from '@/components/tools/file-name-field';
import ImageList from '@/components/tools/image-list';
import Segmented from '@/components/tools/segmented';
import ToolActions from '@/components/tools/tool-actions';
import type { ToolProgress, ToolResult } from '@/components/tools/tool-actions';
import ToolShell from '@/components/tools/tool-shell';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useImageList } from '@/hooks/use-image-list';
import { safeFileName } from '@/lib/files';
import { displayedSize } from '@/lib/rotation';
import { cn } from '@/lib/utils';
import { mergeImages } from '@/tools/merge-images/client';
import { planMerge } from '@/tools/merge-images/layout';
import MergePreview, { Thumbnail } from '@/tools/merge-images/preview';
import type { MergeOptions } from '@/tools/merge-images/types';

type Format = 'jpg' | 'png';

const BACKGROUNDS = [
    { value: '#ffffff', label: 'White' },
    { value: '#000000', label: 'Black' },
    { value: null, label: 'Transparent' },
] as const;

const ALIGN_LABELS = {
    vertical: ['Left', 'Centre', 'Right'],
    horizontal: ['Top', 'Middle', 'Bottom'],
} as const;

export default function MergeImages() {
    const [options, setOptions] = useState<MergeOptions>({
        direction: 'vertical',
        sizing: 'match',
        align: 'center',
        columns: 'auto',
        spacing: 0,
        edges: false,
        maxSide: null,
    });
    const [background, setBackground] = useState<string | null>('#ffffff');
    const [format, setFormat] = useState<Format>('jpg');
    const [fileName, setFileName] = useState('merged');
    const [progress, setProgress] = useState<ToolProgress | null>(null);
    const [result, setResult] = useState<ToolResult | null>(null);
    const job = useRef<{ cancel: () => void } | null>(null);

    const list = useImageList({
        maxImages: 30,
        onChange: () => setResult(null),
    });

    const busy = progress !== null;
    const ready = list.ready;
    const plan = planMerge(
        ready.map((item) => displayedSize(item, item.rotation)),
        options,
    );

    const setOption = <K extends keyof MergeOptions>(
        key: K,
        value: MergeOptions[K],
    ) => {
        setResult(null);
        setOptions((current) => ({ ...current, [key]: value }));
    };

    const chooseBackground = (value: string | null) => {
        setResult(null);
        setBackground(value);

        // Only PNG keeps transparency.
        if (value === null) {
            setFormat('png');
        }
    };

    const chooseFormat = (value: Format) => {
        setResult(null);
        setFormat(value);

        if (value === 'jpg' && background === null) {
            setBackground('#ffffff');
        }
    };

    const merge = async () => {
        const images = ready.flatMap((item) =>
            item.source ? [{ blob: item.source, rotation: item.rotation }] : [],
        );
        const name = safeFileName(fileName, 'merged');
        const label = (done: number) =>
            done < images.length
                ? `Adding image ${done + 1} of ${images.length}…`
                : 'Saving…';

        setProgress({ label: label(0), done: 0, total: images.length });

        const current = mergeImages(
            {
                images,
                plan,
                background,
                format: format === 'png' ? 'image/png' : 'image/jpeg',
            },
            (done, total) => setProgress({ label: label(done), done, total }),
        );

        job.current = current;

        try {
            const blob = await current.promise;

            setResult({
                blob,
                fileName: `${name}.${format}`,
                details: `${plan.width.toLocaleString()} × ${plan.height.toLocaleString()} px`,
            });
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong while merging the images.',
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

    const alignLabels =
        options.direction === 'grid' ? null : ALIGN_LABELS[options.direction];

    return (
        <>
            <Head title="Merge images" />

            <ToolShell
                title="Merge images"
                description="Join photos and screenshots into one image: stacked, side by side or in a grid."
                accept="image/*,.heic,.heif"
                emptyHint={`JPG, PNG, WebP, HEIC and more · up to ${list.maxImages} images`}
                hasFiles={list.items.length > 0}
                busy={busy}
                onFiles={list.add}
                settingsTitle="Layout"
                actions={
                    <ToolActions
                        label={
                            list.loading
                                ? 'Preparing images…'
                                : ready.length < 2
                                  ? 'Add at least 2 images'
                                  : `Merge ${ready.length} images`
                        }
                        disabled={ready.length < 2 || list.loading}
                        progress={progress}
                        result={result}
                        onRun={merge}
                        onCancel={cancel}
                        onStartOver={list.clear}
                    />
                }
                settings={
                    <>
                        <Segmented
                            label="Arrange"
                            value={options.direction}
                            onChange={(value) => setOption('direction', value)}
                            options={[
                                { value: 'vertical', label: 'Stacked' },
                                { value: 'horizontal', label: 'In a row' },
                                { value: 'grid', label: 'Grid' },
                            ]}
                        />
                        {options.direction === 'grid' && (
                            <Segmented
                                label="Columns"
                                value={String(options.columns)}
                                onChange={(value) =>
                                    setOption(
                                        'columns',
                                        value === 'auto'
                                            ? 'auto'
                                            : (Number(value) as 2 | 3 | 4),
                                    )
                                }
                                options={[
                                    { value: 'auto', label: 'Auto' },
                                    { value: '2', label: '2' },
                                    { value: '3', label: '3' },
                                    { value: '4', label: '4' },
                                ]}
                            />
                        )}
                        <Segmented
                            label="Image size"
                            value={options.sizing}
                            onChange={(value) => setOption('sizing', value)}
                            options={[
                                { value: 'match', label: 'Match' },
                                { value: 'original', label: 'Original' },
                            ]}
                            hint={
                                options.sizing === 'match'
                                    ? {
                                          vertical:
                                              'Images are scaled to the same width.',
                                          horizontal:
                                              'Images are scaled to the same height.',
                                          grid: 'Images are scaled to fill equal cells.',
                                      }[options.direction]
                                    : 'Each image keeps its own size.'
                            }
                        />
                        {alignLabels && options.sizing === 'original' && (
                            <Segmented
                                label="Align"
                                value={options.align}
                                onChange={(value) => setOption('align', value)}
                                options={[
                                    { value: 'start', label: alignLabels[0] },
                                    { value: 'center', label: alignLabels[1] },
                                    { value: 'end', label: alignLabels[2] },
                                ]}
                            />
                        )}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <Label htmlFor="spacing">Spacing</Label>
                                <span className="text-sm text-muted-foreground tabular-nums">
                                    {options.spacing === 0
                                        ? 'None'
                                        : `${options.spacing}%`}
                                </span>
                            </div>
                            <input
                                id="spacing"
                                type="range"
                                min={0}
                                max={10}
                                step={0.5}
                                value={options.spacing}
                                onChange={(event) =>
                                    setOption(
                                        'spacing',
                                        Number(event.target.value),
                                    )
                                }
                                className="h-11 w-full cursor-pointer accent-brand"
                            />
                            <Label className="mt-1 flex h-9 cursor-pointer items-center gap-2.5 font-normal">
                                <Checkbox
                                    checked={options.edges}
                                    onCheckedChange={(checked) =>
                                        setOption('edges', checked === true)
                                    }
                                    disabled={options.spacing === 0}
                                />
                                Space around the edges too
                            </Label>
                        </div>
                        <BackgroundPicker
                            value={background}
                            onChange={chooseBackground}
                        />
                        <Segmented
                            label="Format"
                            value={format}
                            onChange={chooseFormat}
                            options={[
                                { value: 'jpg', label: 'JPG' },
                                { value: 'png', label: 'PNG' },
                            ]}
                            hint={
                                format === 'jpg'
                                    ? 'Smaller files, best for photos.'
                                    : 'Sharp edges and transparency, larger files.'
                            }
                        />
                        <Segmented
                            label="Longest side"
                            value={String(options.maxSide ?? 'full')}
                            onChange={(value) =>
                                setOption(
                                    'maxSide',
                                    value === 'full' ? null : Number(value),
                                )
                            }
                            options={[
                                { value: 'full', label: 'Full' },
                                { value: '4000', label: '4000' },
                                { value: '2000', label: '2000' },
                                { value: '1080', label: '1080' },
                            ]}
                            hint="Smaller sizes are quicker to send in chat apps."
                        />
                        <FileNameField
                            value={fileName}
                            extension={format}
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
                        {ready.length > 0 && (
                            <MergePreview
                                items={ready}
                                plan={plan}
                                background={background}
                            />
                        )}
                        <ImageList
                            list={list}
                            pick={pick}
                            busy={busy}
                            className="grid-cols-3 sm:grid-cols-4 xl:grid-cols-5"
                            renderPreview={(item) => <Thumbnail item={item} />}
                        />
                    </>
                )}
            </ToolShell>
        </>
    );
}

function BackgroundPicker({
    value,
    onChange,
}: {
    value: string | null;
    onChange: (value: string | null) => void;
}) {
    const custom =
        value !== null && !BACKGROUNDS.some((option) => option.value === value);

    return (
        <fieldset>
            <legend className="mb-2 text-sm font-medium">Background</legend>
            <div
                role="radiogroup"
                aria-label="Background"
                className="flex flex-wrap items-center gap-2"
            >
                {BACKGROUNDS.map((option) => (
                    <Swatch
                        key={option.label}
                        label={option.label}
                        selected={value === option.value}
                        onSelect={() => onChange(option.value)}
                        className={cn(
                            option.value === null &&
                                'bg-[conic-gradient(#e5e3dc_25%,#fff_0_50%,#e5e3dc_0_75%,#fff_0)] bg-[length:12px_12px]',
                        )}
                        style={
                            option.value
                                ? { background: option.value }
                                : undefined
                        }
                        dark={option.value === '#000000'}
                    />
                ))}
                <label
                    className={cn(
                        'relative flex size-11 cursor-pointer items-center justify-center rounded-full bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)] ring-1 ring-border has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                        custom &&
                            'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                    )}
                    title="Custom colour"
                    style={custom && value ? { background: value } : undefined}
                >
                    <input
                        type="color"
                        value={custom && value ? value : '#ff5b23'}
                        onChange={(event) => onChange(event.target.value)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label="Custom background colour"
                    />
                    {custom && (
                        <Check className="size-4 text-white mix-blend-difference" />
                    )}
                </label>
            </div>
        </fieldset>
    );
}

function Swatch({
    label,
    selected,
    onSelect,
    className,
    style,
    dark = false,
}: {
    label: string;
    selected: boolean;
    onSelect: () => void;
    className?: string;
    style?: React.CSSProperties;
    dark?: boolean;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={onSelect}
            className={cn(
                'flex size-11 items-center justify-center rounded-full ring-1 ring-border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                selected &&
                    'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                className,
            )}
            style={style}
        >
            {selected && (
                <Check
                    className={cn('size-4', dark ? 'text-white' : 'text-black')}
                />
            )}
        </button>
    );
}
