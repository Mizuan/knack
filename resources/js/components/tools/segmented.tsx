import { useId } from 'react';
import { cn } from '@/lib/utils';

type Option<T extends string> = {
    value: T;
    label: string;
    disabled?: boolean;
};

/** A row of radio buttons styled as a segmented control. */
export default function Segmented<T extends string>({
    label,
    value,
    options,
    onChange,
    disabled = false,
    hint,
    columns,
    hideLabel = false,
}: {
    label: string;
    value: T;
    options: Option<T>[];
    onChange: (value: T) => void;
    disabled?: boolean;
    hint?: string;
    /** Wrap the options into rows of this many; one row when unset. */
    columns?: number;
    /** Keep the label for screen readers only, e.g. next to a field. */
    hideLabel?: boolean;
}) {
    const name = useId();

    return (
        <fieldset disabled={disabled} className="group/segmented min-w-0">
            <legend
                className={cn(
                    'mb-2 text-sm font-medium',
                    hideLabel && 'sr-only',
                )}
            >
                {label}
            </legend>
            <div
                className={cn(
                    'grid gap-1 rounded-xl bg-secondary p-1 group-disabled/segmented:opacity-50',
                    !columns && 'auto-cols-fr grid-flow-col',
                )}
                style={
                    columns
                        ? {
                              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                          }
                        : undefined
                }
            >
                {options.map((option) => (
                    <label
                        key={option.value}
                        className={cn(
                            'flex h-10 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors select-none group-disabled/segmented:cursor-not-allowed has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                            option.value === value
                                ? 'bg-card text-foreground shadow-sm dark:bg-input'
                                : 'hover:text-foreground',
                            option.disabled &&
                                'cursor-not-allowed opacity-40 hover:text-muted-foreground',
                        )}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={option.value === value}
                            disabled={option.disabled}
                            onChange={() => onChange(option.value)}
                            className="sr-only"
                        />
                        {option.label}
                    </label>
                ))}
            </div>
            {hint && (
                <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
            )}
        </fieldset>
    );
}
