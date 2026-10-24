import type { SVGAttributes } from 'react';

/**
 * The Knack "Join" mark: the K's two arms meet at the stem, two files in and
 * one out. Colours are fixed so the mark reads the same everywhere.
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
                d="M27 32L43 48"
                stroke="#FF5B23"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.5"
            />
            <path
                d="M22 16V48"
                stroke="#F5F4EF"
                strokeWidth="8"
                strokeLinecap="round"
            />
            <path
                d="M43 16L27 32"
                stroke="#FF5B23"
                strokeWidth="8"
                strokeLinecap="round"
            />
        </svg>
    );
}
