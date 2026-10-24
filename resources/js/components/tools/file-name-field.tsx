import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function FileNameField({
    value,
    extension,
    onChange,
}: {
    value: string;
    extension: string;
    onChange: (value: string) => void;
}) {
    return (
        <div>
            <Label htmlFor="output-name">File name</Label>
            <div className="mt-2 flex items-center rounded-lg border border-input bg-background focus-within:ring-[3px] focus-within:ring-ring/50">
                <Input
                    id="output-name"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
                <span className="pr-3 text-sm text-muted-foreground">
                    .{extension}
                </span>
            </div>
        </div>
    );
}
