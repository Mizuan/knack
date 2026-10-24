import { Link } from '@inertiajs/react';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import AppearanceToggle from '@/components/appearance-toggle';
import { home, privacy } from '@/routes';

export default function PublicLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-svh flex-col">
            <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
                    <Link
                        href={home()}
                        className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                        <AppLogoIcon className="size-9" />
                        <span className="font-display text-2xl leading-none font-extrabold tracking-tight">
                            knack
                        </span>
                    </Link>
                    <nav className="flex items-center gap-1">
                        <Link
                            href={privacy()}
                            className="hidden h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
                        >
                            <Lock className="size-4" />
                            Files stay on your device
                        </Link>
                        <AppearanceToggle />
                    </nav>
                </div>
            </header>

            <main className="flex-1">{children}</main>

            <footer className="border-t border-border/70">
                <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <p>
                        Knack runs in your browser. Your files are never
                        uploaded.
                    </p>
                    <div className="flex gap-5">
                        <Link href={home()} className="hover:text-foreground">
                            Tools
                        </Link>
                        <Link
                            href={privacy()}
                            className="hover:text-foreground"
                        >
                            Privacy
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
