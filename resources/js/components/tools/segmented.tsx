import { useId } from 'react';
import { cn } from '@/lib/utils';

type Option<T extends string> = { value: T; label: string };

/** A row of radio buttons styled as a segmented control. */
export default function Segmented<T extends string>({
    label,
    value,
    options,
    onChange,
    disabled = false,
    hint,
}: {
    label: string;
    value: T;
    options: Option<T>[];
    onChange: (value: T) => void;
    disabled?: boolean;
    hint?: string;
}) {
    const name = useId();

    return (
        <fieldset disabled={disabled} className="group/segmented min-w-0">
            <legend className="mb-2 text-sm font-medium">{label}</legend>
            <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-secondary p-1 group-disabled/segmented:opacity-50">
                {options.map((option) => (
                    <label
                        key={option.value}
                        className={cn(
                            'flex h-10 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors select-none group-disabled/segmented:cursor-not-allowed has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                            option.value === value
                                ? 'bg-card text-foreground shadow-sm dark:bg-input'
                                : 'hover:text-foreground',
                        )}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={option.value === value}
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
