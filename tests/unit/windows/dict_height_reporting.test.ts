import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

vi.mock('electron', () => ({}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key }),
}))

vi.mock('../../../src/services/registry', () => ({
    translateServiceRegistry: { get: vi.fn(() => null) },
}))

vi.mock('../../../src/services/detect', () => ({
    detectLanguage: vi.fn(() => Promise.resolve('en')),
}))

vi.mock('../../../src/i18n/language_names', () => ({
    native_language_name: vi.fn(() => 'English'),
}))

vi.mock('@dnd-kit/core', () => ({
    DndContext: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    closestCenter: vi.fn(),
    PointerSensor: vi.fn(),
    useSensor: vi.fn(),
    useSensors: vi.fn(() => []),
}))

vi.mock('@dnd-kit/sortable', () => ({
    SortableContext: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useSortable: () => ({
        attributes: {},
        listeners: {},
        setNodeRef: vi.fn(),
        transform: null,
        transition: undefined,
        isDragging: false,
    }),
    verticalListSortingStrategy: vi.fn(),
}))

vi.mock('@dnd-kit/utilities', () => ({
    CSS: { Transform: { toString: vi.fn(() => undefined) } },
}))

import { useDictStore } from '../../../src/stores/dict_store'
import { useConfigStore } from '../../../src/stores/config_store'

function reset_stores(): void {
    useDictStore.setState({ word: '', detectedLanguage: null, results: {}, isLoading: false })
    useConfigStore.setState({
        config: {
            ...useConfigStore.getState().config,
            dictionary_service_list: [],
            english_dictionary_service_list: ['cambridge_dict@default'],
            service_instances: { 'cambridge_dict@default': { serviceKey: 'cambridge_dict', config: {} } },
        },
    })
}

describe('dict window height reporting uses inner content measurement', () => {
    let report_spy: ReturnType<typeof vi.fn>
    let raf_cb: FrameRequestCallback | null = null
    let original_raf: typeof window.requestAnimationFrame
    let original_caf: typeof window.cancelAnimationFrame

    beforeEach(() => {
        report_spy = vi.fn(() => Promise.resolve())
        ;(window as any).electronAPI = {
            dict: { reportContentHeight: report_spy },
            text: { writeClipboard: vi.fn(() => Promise.resolve()), onDictLookup: vi.fn(() => () => {}), onDictSelectionEmpty: vi.fn(() => () => {}) },
            window: { close: vi.fn(() => Promise.resolve()), setAlwaysOnTop: vi.fn(() => Promise.resolve()) },
            ready: vi.fn(),
            config: { getAll: vi.fn(() => Promise.resolve({})), onChange: vi.fn(() => () => {}) },
            log: { write: vi.fn(() => Promise.resolve()) },
        }
        original_raf = window.requestAnimationFrame
        original_caf = window.cancelAnimationFrame
        raf_cb = null
        window.requestAnimationFrame = ((cb: FrameRequestCallback) => { raf_cb = cb; return 1 }) as any
        window.cancelAnimationFrame = vi.fn() as any
        reset_stores()
    })

    afterEach(() => {
        window.requestAnimationFrame = original_raf
        window.cancelAnimationFrame = original_caf
        delete (window as any).electronAPI
    })

    it('reports height based on inner content getBoundingClientRect, not scrollHeight', async () => {
        const { default: DictWindow } = await import('../../../src/windows/dict/index')

        // Override ResizeObserver to track observed elements
        const elements: Element[] = []
        class MockResizeObserver {
            observe = vi.fn((el: Element) => { elements.push(el) })
            disconnect = vi.fn()
            unobserve = vi.fn()
        }
        ;(window as any).ResizeObserver = MockResizeObserver

        const { container } = render(React.createElement(DictWindow))

        const titlebar_el = container.querySelector('.op-titlebar') as HTMLElement
        // content_outer is the flex:1 div, inner is its first child
        const content_outer = titlebar_el?.nextElementSibling as HTMLElement | null
        const inner = content_outer?.firstElementChild as HTMLElement | null
        expect(titlebar_el).not.toBeNull()
        expect(content_outer).not.toBeNull()
        expect(inner).not.toBeNull()

        // Mock getBoundingClientRect per element
        const original_gbr = Element.prototype.getBoundingClientRect
        let inner_height = 500
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
            if (this === titlebar_el) return { width: 350, height: 40, x: 0, y: 0, top: 0, left: 0, right: 350, bottom: 40, toJSON: () => {} }
            if (this === inner) return { width: 350, height: inner_height, x: 0, y: 44, top: 44, left: 0, right: 350, bottom: 44 + inner_height, toJSON: () => {} }
            return original_gbr.call(this)
        })

        // Mock getComputedStyle padding for content_outer
        const original_gcs = window.getComputedStyle
        vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element | null) => {
            const cs = original_gcs(el as Element)
            if (el === content_outer) {
                Object.defineProperty(cs, 'paddingTop', { value: '4', configurable: true })
                Object.defineProperty(cs, 'paddingBottom', { value: '14', configurable: true })
            }
            return cs
        })

        // Trigger initial RAF callback
        expect(raf_cb).not.toBeNull()
        act(() => { raf_cb!(0) })

        // Initial: titlebar(40) + inner(500) + padding(18) = 558
        expect(report_spy).toHaveBeenCalledWith(558)

        // Simulate card collapse: inner shrinks
        inner_height = 200
        act(() => { raf_cb!(0) })

        // After collapse: titlebar(40) + inner(200) + padding(18) = 258
        expect(report_spy).toHaveBeenCalledWith(258)
    })
})
