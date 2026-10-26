import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Lock, UserX, Zap } from 'lucide-react';
import type { Tool } from '@/tools/registry';
import { toolGroups, tools } from '@/tools/registry';

const promises = [
    {
        icon: Lock,
        title: 'Nothing is uploaded',
        body: 'Your files are processed on your own device and never sent to a server.',
    },
    {
        icon: Zap,
        title: 'Quick',
        body: 'No upload or download wait. Results are ready in seconds.',
    },
    {
        icon: UserX,
        title: 'No account',
        body: 'Open a tool and use it. No sign-up, email or watermark.',
    },
];

export default function Home() {
    return (
        <>
            <Head title="Everyday file tools" />

            <section className="mx-auto max-w-6xl px-4 pt-12 pb-10 sm:px-6 sm:pt-20 sm:pb-14">
                <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand-ink">
                    <Lock className="size-3.5" />
                    Private by design
                </p>
                <h1 className="mt-5 max-w-3xl font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl">
                    Everyday file fixes, right in your browser.
                </h1>
                <p className="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
                    Turn images into a PDF, merge files and more. Free, fast,
                    and your files never leave your device.
                </p>
            </section>

            <div className="mx-auto max-w-6xl space-y-10 px-4 pb-16 sm:px-6">
                {toolGroups.map((group) => (
                    <section
                        key={group.key}
                        aria-labelledby={`${group.key}-tools`}
                    >
                        <h2
                            id={`${group.key}-tools`}
                            className="mb-4 font-display text-lg font-bold tracking-tight sm:text-xl"
                        >
                            {group.title}
                        </h2>
                        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                            {tools
                                .filter((tool) => tool.group === group.key)
                                .map((tool) => (
                                    <li key={tool.slug} className="flex">
                                        <ToolCard tool={tool} />
                                    </li>
                                ))}
                        </ul>
                    </section>
                ))}
            </div>

            <section className="border-t border-border/70 bg-card/60">
                <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
                    {promises.map(({ icon: Icon, title, body }) => (
                        <div key={title} className="flex gap-4">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                                <Icon className="size-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold">{title}</h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {body}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </>
    );
}

function ToolCard({ tool }: { tool: Tool }) {
    const Icon = tool.icon;
    const body = (
        <>
            <div className="flex items-start justify-between gap-3">
                <Icon
                    className="size-7 text-foreground transition-colors group-hover:text-brand sm:size-8"
                    strokeWidth={1.75}
                />
                {tool.href ? (
                    <ArrowRight className="mt-0.5 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:size-5" />
                ) : (
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        Soon
                    </span>
                )}
            </div>
            <h3 className="mt-3 font-display text-base leading-tight font-bold tracking-tight sm:text-lg">
                {tool.title}
            </h3>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground sm:text-sm">
                {tool.description}
            </p>
        </>
    );

    const card =
        'group flex w-full flex-col rounded-2xl border border-border bg-card p-4 sm:rounded-3xl sm:p-5';

    if (!tool.href) {
        return <div className={`${card} opacity-75`}>{body}</div>;
    }

    return (
        <Link
            href={tool.href}
            className={`${card} transition-[border-color,box-shadow] outline-none hover:border-foreground/20 hover:shadow-[0_8px_30px_-12px_rgb(20_22_27/0.25)] focus-visible:ring-[3px] focus-visible:ring-ring/50`}
        >
            {body}
        </Link>
    );
}
