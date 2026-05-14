const { heroui } = require('@heroui/theme')

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
        './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}'
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    primary: 'var(--brand-primary)',
                    'primary-soft': 'var(--brand-primary-soft)',
                    'primary-hover': 'var(--brand-primary-hover)',
                },
                surface: {
                    bg: 'var(--bg)',
                    elev: 'var(--bg-elev)',
                    card: 'var(--bg-card)',
                    sunk: 'var(--bg-sunk)',
                    input: 'var(--bg-input)',
                },
                line: {
                    DEFAULT: 'var(--line)',
                    soft: 'var(--line-soft)',
                    strong: 'var(--line-strong)',
                },
                content: {
                    DEFAULT: 'var(--text)',
                    dim: 'var(--text-dim)',
                    mute: 'var(--text-mute)',
                },
                status: {
                    ok: 'var(--ok)',
                    warn: 'var(--warn)',
                    danger: 'var(--danger)',
                },
            },
            borderRadius: {
                xs: 'var(--r-xs)',
                sm: 'var(--r-sm)',
                md: 'var(--r-md)',
                lg: 'var(--r-lg)',
                xl: 'var(--r-xl)',
            },
            fontFamily: {
                sans: 'var(--font-sans)',
                mono: 'var(--font-mono)',
            },
            fontSize: {
                base: 'var(--fs-base)',
            },
            spacing: {
                gap: 'var(--gap)',
                pad: 'var(--pad)',
                'row-h': 'var(--row-h)',
            },
        }
    },
    darkMode: 'class',
    plugins: [heroui()]
}
