import { CircleCheck, Download, RotateCcw, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { downloadBlob, formatBytes } from '@/lib/files';

export type ToolProgress = { label: string; done: number; total: number };

export type ToolResult = {
    blob: Blob;
    fileName: string;
    /** A short summary shown under the file name, e.g. "4 pages". */
    details: string;
};

/**
 * The tool's main action: the button, then a progress bar while it works,
 * then the finished file with download, share and start over.
 */
export default function ToolActions({
    label,
    disabled,
    progress,
    result,
    onRun,
    onCancel,
    onStartOver,
}: {
    label: string;
    disabled: boolean;
    progress: ToolProgress | null;
    result: ToolResult | null;
    onRun: () => void;
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
                    <span className="font-medium">{progress.label}</span>
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
                    aria-label={progress.label}
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
            onClick={onRun}
            disabled={disabled}
            className="h-12 w-full rounded-full text-base"
        >
            {label}
        </Button>
    );
}

function ResultCard({
    result,
    onStartOver,
}: {
    result: ToolResult;
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
                        {result.details} · {formatBytes(result.blob.size)}
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
