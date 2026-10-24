import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Lock, UserX, Zap } from 'lucide-react';
import type { Tool } from '@/tools/registry';
import { tools } from '@/tools/registry';

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

            <section
                aria-labelledby="tools-heading"
                className="mx-auto max-w-6xl px-4 pb-16 sm:px-6"
            >
                <h2 id="tools-heading" className="sr-only">
                    Tools
                </h2>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {tools.map((tool) => (
                        <li key={tool.slug} className="flex">
                            <ToolCard tool={tool} />
                        </li>
                    ))}
                </ul>
            </section>

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
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition-colors group-hover:bg-brand group-hover:text-white">
                    <Icon className="size-6" />
                </div>
                {tool.href ? (
                    <ArrowRight className="mt-1 size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                ) : (
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        Soon
                    </span>
                )}
            </div>
            <h3 className="mt-6 font-display text-xl font-bold tracking-tight">
                {tool.title}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
                {tool.description}
            </p>
        </>
    );

    const card =
        'group flex w-full flex-col rounded-3xl border border-border bg-card p-5 sm:p-6';

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
