import type { LucideIcon } from 'lucide-react';
import { FileImage, Files, Images, Shrink } from 'lucide-react';
import { imagesToPdf } from '@/routes/tools';

export type Tool = {
    slug: string;
    title: string;
    description: string;
    icon: LucideIcon;
    /** Set once the tool is live; tools without one show as "Soon". */
    href?: string;
};

export const tools: Tool[] = [
    {
        slug: 'images-to-pdf',
        title: 'Images to PDF',
        description:
            'Turn photos and scans into one PDF, in the order you want.',
        icon: FileImage,
        href: imagesToPdf.url(),
    },
    {
        slug: 'merge-images',
        title: 'Merge images',
        description:
            'Join two or more images side by side, stacked or in a grid.',
        icon: Images,
    },
    {
        slug: 'merge-pdfs',
        title: 'Merge PDFs',
        description:
            'Combine several PDFs into one and pick the pages to keep.',
        icon: Files,
    },
    {
        slug: 'compress-pdf',
        title: 'Compress PDF',
        description:
            'Make a PDF smaller so it fits in an email or upload form.',
        icon: Shrink,
    },
];
