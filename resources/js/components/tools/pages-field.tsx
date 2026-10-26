import { Input } from '@/components/ui/input';
import type { FileItem } from '@/hooks/use-file-list';
import { parsePages } from '@/lib/page-ranges';
import type { PdfMeta } from '@/lib/pdf';
import { cn } from '@/lib/utils';

/** The "pages to use" box under a PDF card, with an inline error. */
export default function PagesField({
    item,
    onChange,
}: {
    item: FileItem<PdfMeta>;
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
