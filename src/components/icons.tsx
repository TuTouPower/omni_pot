import React from 'react'
import { MdSmartButton } from 'react-icons/md'
import { CgSpaceBetween } from 'react-icons/cg'

interface IconProps {
    size?: number
    strokeWidth?: number
    fill?: boolean
    style?: React.CSSProperties
    className?: string
}

function Icon({ d, size = 15, strokeWidth = 1.85, fill = false, style, className }: IconProps & { d: string | string[] }): React.ReactElement {
    const paths = Array.isArray(d) ? d : [d]
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={fill ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={style}
            className={className}
        >
            {paths.map((p, i) => <path key={i} d={p} />)}
        </svg>
    )
}

export const Icons = {
    Close: (p: IconProps) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />,
    Min: (p: IconProps) => <Icon {...p} d="M5 12h14" />,
    Max: (p: IconProps) => <Icon {...p} d="M5 5h14v14H5z" />,
    Pin: ({ size = 15, strokeWidth = 1.85, fill = false, style, className }: IconProps) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
            <path d="M8 3h8l-1.5 6 2.5 4H7l2.5-4L8 3z" fill={fill ? 'currentColor' : 'none'} />
            <path d="M12 16v6" stroke={fill ? 'var(--bg)' : 'currentColor'} />
        </svg>
    ),
    Lock: ({ size = 15, strokeWidth = 1.85, fill = false, style, className }: IconProps) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
            <path d="M5 11h14v10H5z" fill={fill ? 'currentColor' : 'none'} />
            <path d="M8 11V7a4 4 0 018 0v4" />
            <path d="M12 15v3" stroke={fill ? 'var(--bg)' : 'currentColor'} />
        </svg>
    ),
    Newline: ({ size = 17, style, className }: IconProps) => (
        <MdSmartButton size={size} style={style} className={className} />
    ),
    Space: ({ size = 17, style, className }: IconProps) => (
        <CgSpaceBetween size={size} style={style} className={className} />
    ),
    Bell: (p: IconProps) => <Icon {...p} d={["M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9", "M14 21a2 2 0 01-4 0"]} />,
    Translate: (p: IconProps) => <Icon {...p} d={["M4 5h10", "M9 4v2c0 4-3 8-7 8", "M14 19l3-8 3 8", "M15 16h4", "M5 8c0 3 4 7 8 7"]} />,
    Volume: (p: IconProps) => <Icon {...p} d={["M11 5L6 9H3v6h3l5 4V5z", "M15 9a4 4 0 010 6", "M18 6a8 8 0 010 12"]} />,
    Copy: (p: IconProps) => <Icon {...p} d={["M8 8h11v11H8z", "M5 5h11v3", "M5 5v11h3"]} />,
    Trash: (p: IconProps) => <Icon {...p} d={["M4 7h16", "M9 7V4h6v3", "M6 7l1 13h10l1-13"]} />,
    Swap: (p: IconProps) => <Icon {...p} d={["M4 9h14", "M15 6l3 3-3 3", "M20 15H6", "M9 12l-3 3 3 3"]} />,
    Chev: (p: IconProps) => <Icon {...p} d="M6 9l6 6 6-6" />,
    ChevUp: (p: IconProps) => <Icon {...p} d="M6 15l6-6 6 6" />,
    ChevR: (p: IconProps) => <Icon {...p} d="M9 6l6 6-6 6" />,
    Plus: (p: IconProps) => <Icon {...p} d="M12 5v14M5 12h14" />,
    Search: (p: IconProps) => <Icon {...p} d={["M11 19a8 8 0 100-16 8 8 0 000 16z", "M21 21l-4.3-4.3"]} />,
    Settings: (p: IconProps) => <Icon {...p} d={["M12 9a3 3 0 100 6 3 3 0 000-6z", "M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1A2 2 0 114.6 17l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1A2 2 0 117 4.6l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1A2 2 0 1119.4 7l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"]} />,
    Camera: (p: IconProps) => <Icon {...p} d={["M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z", "M12 17a4 4 0 100-8 4 4 0 000 8z"]} />,
    Image: (p: IconProps) => <Icon {...p} d={["M3 5h18v14H3z", "M3 16l5-5 4 4 3-3 6 6", "M9 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"]} />,
    Hash: (p: IconProps) => <Icon {...p} d={["M4 9h16", "M4 15h16", "M10 3l-2 18", "M16 3l-2 18"]} />,
    Layers: (p: IconProps) => <Icon {...p} d={["M12 2l9 5-9 5-9-5 9-5z", "M3 12l9 5 9-5", "M3 17l9 5 9-5"]} />,
    Kbd: (p: IconProps) => <Icon {...p} d={["M3 7h18v10H3z", "M7 11h0M11 11h0M15 11h0M7 14h10"]} />,
    Clock: (p: IconProps) => <Icon {...p} d={["M12 21a9 9 0 100-18 9 9 0 000 18z", "M12 7v5l3 2"]} />,
    Cloud: (p: IconProps) => <Icon {...p} d="M18 18H7a4 4 0 01-1-7.9 6 6 0 0111.7-1A4 4 0 0118 18z" />,
    Export: (p: IconProps) => <Icon {...p} d={["M3 14v4a2 2 0 002 2h14a2 2 0 002-2v-4", "M7 10l5-5 5 5", "M12 5v12"]} />,
    Info: (p: IconProps) => <Icon {...p} d={["M12 21a9 9 0 100-18 9 9 0 000 18z", "M12 16v-5", "M12 8h0"]} />,
    Grid: (p: IconProps) => <Icon {...p} d={["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"]} />,
    Drag: (p: IconProps) => <Icon {...p} d={["M9 5h0M9 12h0M9 19h0M15 5h0M15 12h0M15 19h0"]} strokeWidth={2.4} />,
    Edit: (p: IconProps) => <Icon {...p} d={["M12 20h9", "M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z"]} />,
    Cycle: (p: IconProps) => <Icon {...p} d={["M21 12a9 9 0 11-3-6.7", "M21 4v5h-5"]} />,
    Heart: (p: IconProps) => <Icon {...p} d="M20.8 5.6a5.5 5.5 0 00-7.8 0L12 6.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />,
    Reverse: (p: IconProps) => <Icon {...p} d={["M3 12c0-5 4-9 9-9", "M21 12c0 5-4 9-9 9", "M3 7v5h5", "M21 17v-5h-5"]} />,
    Check: (p: IconProps) => <Icon {...p} d="M5 12l5 5L20 7" />,
    Globe: (p: IconProps) => <Icon {...p} d={["M12 21a9 9 0 100-18 9 9 0 000 18z", "M3 12h18", "M12 3a14 14 0 010 18", "M12 3a14 14 0 000 18"]} />,
    Type: (p: IconProps) => <Icon {...p} d={["M4 7V5h16v2", "M9 5v14", "M15 5v14", "M7 19h4M13 19h4"]} />,
    Sliders: (p: IconProps) => <Icon {...p} d={["M4 6h10", "M18 6h2", "M4 12h4", "M12 12h8", "M4 18h12", "M18 18h2", "M16 4v4", "M10 10v4", "M16 16v4"]} />,
    Power: (p: IconProps) => <Icon {...p} d={["M12 2v10", "M18.4 6.6a9 9 0 11-12.8 0"]} />,
}
