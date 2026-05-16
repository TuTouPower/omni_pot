import { describe, expect, it } from 'vitest'
import { map_cover_rect_to_image_rect } from '../../../src/windows/screenshot/crop'

describe('screenshot crop mapping', () => {
    it('keeps coordinates unchanged when screenshot and overlay have the same pixel size', () => {
        expect(map_cover_rect_to_image_rect(
            { x: 100, y: 50, width: 200, height: 120 },
            { width: 1000, height: 600 },
            { width: 1000, height: 600 }
        )).toEqual({ x: 100, y: 50, width: 200, height: 120 })
    })

    it('maps CSS selection coordinates to physical screenshot pixels on scaled displays', () => {
        expect(map_cover_rect_to_image_rect(
            { x: 100, y: 50, width: 200, height: 120 },
            { width: 1000, height: 600 },
            { width: 2000, height: 1200 }
        )).toEqual({ x: 200, y: 100, width: 400, height: 240 })
    })

    it('accounts for horizontal cover overflow', () => {
        expect(map_cover_rect_to_image_rect(
            { x: 0, y: 50, width: 100, height: 100 },
            { width: 1000, height: 500 },
            { width: 1000, height: 1000 }
        )).toEqual({ x: 0, y: 300, width: 100, height: 100 })
    })

    it('accounts for vertical cover overflow', () => {
        expect(map_cover_rect_to_image_rect(
            { x: 450, y: 0, width: 100, height: 100 },
            { width: 500, height: 1000 },
            { width: 1000, height: 1000 }
        )).toEqual({ x: 700, y: 0, width: 100, height: 100 })
    })

    it('clamps selections to image bounds', () => {
        expect(map_cover_rect_to_image_rect(
            { x: -20, y: -30, width: 80, height: 90 },
            { width: 1000, height: 600 },
            { width: 1000, height: 600 }
        )).toEqual({ x: 0, y: 0, width: 60, height: 60 })
    })
})
