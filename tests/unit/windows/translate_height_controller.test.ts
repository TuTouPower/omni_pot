import { describe, it, expect } from 'vitest'
import { compute_target_height, compute_target_min_width } from '../../../electron/windows/translate_height_controller'

describe('compute_target_height', () => {
    it('returns content height when within bounds', () => {
        expect(compute_target_height(500, 1080, 100)).toBe(500)
    })

    it('clamps to min when content height is below min', () => {
        expect(compute_target_height(50, 1080, 100)).toBe(100)
    })

    it('clamps to max when content exceeds it', () => {
        expect(compute_target_height(2000, 1080, 100)).toBe(810)
    })

    it('floors the max so it never exceeds integer pixels', () => {
        expect(compute_target_height(2000, 1079, 100)).toBe(809)
    })

    it('returns min when both content and max are below min', () => {
        expect(compute_target_height(50, 100, 100)).toBe(100)
    })

    it('rounds content height to integer', () => {
        expect(compute_target_height(500.7, 1080, 100)).toBe(501)
    })
})

describe('compute_target_min_width', () => {
    it('uses 280 as the hard fallback minimum', () => {
        expect(compute_target_min_width(100)).toBe(280)
    })

    it('uses measured language row width when it is wider than fallback', () => {
        expect(compute_target_min_width(341.2)).toBe(342)
    })
})
