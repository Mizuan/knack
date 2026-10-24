import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';

const next: Record<Appearance, Appearance> = {
    system: 'light',
    light: 'dark',
    dark: 'system',
};

const labels: Record<Appearance, string> = {
    system: 'Theme: system',
    light: 'Theme: light',
    dark: 'Theme: dark',
};

export default function AppearanceToggle() {
    const { appearance, updateAppearance } = useAppearance();
    const Icon = { system: Monitor, light: Sun, dark: Moon }[appearance];

    return (
        <Button
            variant="ghost"
            size="icon"
            className="size-11 rounded-full"
            onClick={() => updateAppearance(next[appearance])}
            aria-label={`${labels[appearance]}. Switch to ${next[appearance]}.`}
            title={labels[appearance]}
        >
            <Icon className="size-5" />
        </Button>
    );
}
