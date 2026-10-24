import { Link } from '@inertiajs/react';
import { ArrowLeft, ImagePlus, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { home } from '@/routes';

/**
 * The frame every file tool shares: header, a drop/paste target for the whole
 * page, the empty state, and once files are in, the work area with a settings
 * sidebar (a pinned action bar on phones).
 */
export default function ToolShell({
    title,
    description,
    accept,
    emptyHint,
    hasFiles,
    busy,
    onFiles,
    settingsTitle,
    settings,
    actions,
    children,
}: {
    title: string;
    description: string;
    accept: string;
    emptyHint: string;
    hasFiles: boolean;
    busy: boolean;
    onFiles: (files: FileList | File[]) => void;
    settingsTitle: string;
    settings: ReactNode;
    actions: ReactNode;
    /** The work area; `pick` opens the file picker. */
    children: (pick: () => void) => ReactNode;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const pick = () => input.current?.click();

    // Paste images straight from the clipboard.
    useEffect(() => {
        const onPaste = (event: ClipboardEvent) => {
            const files = Array.from(event.clipboardData?.files ?? []);

            if (files.length && !busy) {
                event.preventDefault();
                onFiles(files);
            }
        };

        window.addEventListener('paste', onPaste);

        return () => window.removeEventListener('paste', onPaste);
    }, [busy, onFiles]);

    return (
        <div
            className="relative"
            onDragEnter={(event) => {
                if (event.dataTransfer.types.includes('Files')) {
                    setDragging(true);
                }
            }}
            onDragOver={(event) => {
                if (event.dataTransfer.types.includes('Files')) {
                    event.preventDefault();
                }
            }}
            onDragLeave={(event) => {
                if (
                    !event.currentTarget.contains(event.relatedTarget as Node)
                ) {
                    setDragging(false);
                }
            }}
            onDrop={(event) => {
                event.preventDefault();
                setDragging(false);

                if (!busy && event.dataTransfer.files.length) {
                    onFiles(event.dataTransfer.files);
                }
            }}
        >
            <input
                ref={input}
                type="file"
                multiple
                accept={accept}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                    if (event.target.files) {
                        onFiles(event.target.files);
                    }

                    event.target.value = '';
                }}
            />

            <div
                className={cn(
                    'mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12',
                    hasFiles && 'pb-32 lg:pb-12',
                )}
            >
                <Link
                    href={home()}
                    className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    All tools
                </Link>
                <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                    {title}
                </h1>
                <p className="mt-3 max-w-2xl text-pretty text-muted-foreground sm:text-lg">
                    {description}
                </p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink">
                    <Lock className="size-3.5" />
                    Your files never leave this device.
                </p>

                {hasFiles ? (
                    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
                        <div className="min-w-0 space-y-6">
                            {children(pick)}
                        </div>

                        <aside className="rounded-3xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-24">
                            <h2 className="font-display text-xl font-bold tracking-tight">
                                {settingsTitle}
                            </h2>
                            <fieldset
                                disabled={busy}
                                className="mt-5 min-w-0 space-y-5"
                            >
                                {settings}
                            </fieldset>
                            <div className="mt-6 hidden lg:block">
                                {actions}
                            </div>
                        </aside>
                    </div>
                ) : (
                    <EmptyDropZone onPick={pick} hint={emptyHint} />
                )}
            </div>

            {hasFiles && (
                <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
                    {actions}
                </div>
            )}

            {dragging && (
                <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
                    <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-brand bg-card px-6 py-12 text-center">
                        <ImagePlus className="size-10 text-brand" />
                        <p className="font-display text-2xl font-bold tracking-tight">
                            Drop to add images
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

function EmptyDropZone({ onPick, hint }: { onPick: () => void; hint: string }) {
    return (
        <button
            type="button"
            onClick={onPick}
            className="group mt-8 flex w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-input bg-card px-6 py-14 text-center transition-colors outline-none hover:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:py-20"
        >
            <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition-colors group-hover:bg-brand group-hover:text-white">
                <ImagePlus className="size-8" />
            </span>
            <span className="mt-5 hidden font-display text-2xl font-bold tracking-tight sm:block">
                Drop images here
            </span>
            <span className="mt-5 inline-flex h-12 items-center rounded-full bg-primary px-6 font-medium text-primary-foreground sm:mt-4">
                Choose images
            </span>
            <span className="mt-4 text-sm text-muted-foreground">{hint}</span>
        </button>
    );
}
