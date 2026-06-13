import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Icons } from '@/components/icons'

// Render an SVG icon to an HTML string for attribute assertions.
function render_icon(el: React.ReactElement): string {
    return renderToStaticMarkup(el)
}

describe('Pin icon stick stroke', () => {
    it('stick inherits currentColor when inactive (fill=false)', () => {
        const html = render_icon(React.createElement(Icons.Pin, { fill: false }))
        // The stick path M12 16v6 must NOT set stroke to var(--bg)
        expect(html).toContain('d="M12 16v6"')
        const stick_match = html.match(/<path[^>]*d="M12 16v6"[^>]*>/)
        expect(stick_match).not.toBeNull()
        if (stick_match === null) throw new Error('stick path not found')
        expect(stick_match[0]).not.toContain('var(--bg)')
    })

    it('stick inherits currentColor when active (fill=true)', () => {
        const html = render_icon(React.createElement(Icons.Pin, { fill: true }))
        const stick_match = html.match(/<path[^>]*d="M12 16v6"[^>]*>/)
        expect(stick_match).not.toBeNull()
        if (stick_match === null) throw new Error('stick path not found')
        expect(stick_match[0]).not.toContain('var(--bg)')
    })

    it('Lock keyhole uses var(--bg) when active (fill=true) — different from Pin', () => {
        const html = render_icon(React.createElement(Icons.Lock, { fill: true }))
        // Lock's keyhole path should use var(--bg) to cut out against the filled body
        expect(html).toContain('var(--bg)')
    })
})
