import type { SVGAttributes } from 'react';

/**
 * The Tinyfold "Corner fold" mark: a page with its corner folded over.
 * Colours are fixed so the mark reads the same everywhere.
 */
export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            viewBox="0 0 64 64"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            {...props}
        >
            <rect
                width="64"
                height="64"
                rx="16"
                className="fill-[#14161B] dark:fill-[#2A2D35]"
            />
            <path
                d="M19 12H37L46 21V50A2 2 0 0 1 44 52H19A2 2 0 0 1 17 50V14A2 2 0 0 1 19 12Z"
                fill="#F5F4EF"
            />
            <path d="M37 12V19A2 2 0 0 0 39 21H46Z" fill="#FF5B23" />
            <rect x="22" y="30" width="18" height="3" rx="1.5" fill="#C9C5BA" />
            <rect x="22" y="37" width="13" height="3" rx="1.5" fill="#C9C5BA" />
            <rect x="22" y="44" width="16" height="3" rx="1.5" fill="#C9C5BA" />
        </svg>
    );
}
