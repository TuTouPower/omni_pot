import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('electron', () => ({}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key }),
}))

vi.mock('../../../src/services/registry', () => ({
    translateServiceRegistry: { get: vi.fn(() => ({ key: 'mymemory', name: 'MyMemory', languages: [] })) },
}))

vi.mock('../../../src/services/tts_registry', () => ({
    ttsServiceRegistry: { get: vi.fn(() => null) },
}))

vi.mock('../../../src/components/svc_tile', () => ({
    SvcTile: ({ name }: { name: string }) => React.createElement('span', { 'data-testid': 'svc-tile' }, name),
    svcLabel: (key: string) => key,
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

import { useTranslateStore } from '../../../src/stores/translate_store'
import { useConfigStore } from '../../../src/stores/config_store'
import { TargetArea } from '../../../src/windows/translate/target_area'

const INSTANCE_KEY = 'mymemory@default'

function reset_stores(): void {
    useTranslateStore.setState({ results: {}, isTranslating: false })
    useConfigStore.setState({
        config: {
            ...useConfigStore.getState().config,
            translate_service_list: [INSTANCE_KEY],
            service_instances: { [INSTANCE_KEY]: { serviceKey: 'mymemory', config: {} } },
        },
    })
}

describe('TargetArea card collapse behavior', () => {
    beforeEach(() => { reset_stores() })
    afterEach(() => { reset_stores() })

    it('cards start collapsed when result is not yet in store', () => {
        render(React.createElement(TargetArea, {
            serviceList: [INSTANCE_KEY],
            ttsServiceList: [],
            hasAnyRequest: true,
        }))
        expect(screen.getByTestId('result-collapse').getAttribute('aria-expanded')).toBe('false')
        expect(screen.queryByTestId('result-body')).toBeNull()
    })

    it('cards auto-expand when result arrives in store', () => {
        const { rerender } = render(React.createElement(TargetArea, {
            serviceList: [INSTANCE_KEY],
            ttsServiceList: [],
            hasAnyRequest: true,
        }))
        expect(screen.getByTestId('result-collapse').getAttribute('aria-expanded')).toBe('false')

        act(() => {
            useTranslateStore.setState({ results: { [INSTANCE_KEY]: '你好世界' } })
        })
        rerender(React.createElement(TargetArea, {
            serviceList: [INSTANCE_KEY],
            ttsServiceList: [],
            hasAnyRequest: true,
        }))
        expect(screen.getByTestId('result-collapse').getAttribute('aria-expanded')).toBe('true')
        expect(screen.getByTestId('result-body')).toBeTruthy()
    })

    it('clicking collapse button hides body, clicking again shows it', () => {
        act(() => {
            useTranslateStore.setState({ results: { [INSTANCE_KEY]: '你好世界' } })
        })
        render(React.createElement(TargetArea, {
            serviceList: [INSTANCE_KEY],
            ttsServiceList: [],
            hasAnyRequest: true,
        }))
        expect(screen.getByTestId('result-body')).toBeTruthy()

        fireEvent.click(screen.getByTestId('result-collapse'))
        expect(screen.getByTestId('result-collapse').getAttribute('aria-expanded')).toBe('false')
        expect(screen.queryByTestId('result-body')).toBeNull()

        fireEvent.click(screen.getByTestId('result-collapse'))
        expect(screen.getByTestId('result-collapse').getAttribute('aria-expanded')).toBe('true')
        expect(screen.getByTestId('result-body')).toBeTruthy()
    })

    it('hides shimmer when collapsed even while loading', () => {
        act(() => {
            useTranslateStore.setState({ isTranslating: true })
        })
        render(React.createElement(TargetArea, {
            serviceList: [INSTANCE_KEY],
            ttsServiceList: [],
            hasAnyRequest: true,
        }))
        // Card is collapsed (no result yet), shimmer should be hidden
        expect(screen.queryByTestId('result-shimmer')).toBeNull()
    })

    it('new translation resets manual collapse state', () => {
        act(() => {
            useTranslateStore.setState({ results: { [INSTANCE_KEY]: '第一轮' } })
        })
        const { rerender } = render(React.createElement(TargetArea, {
            serviceList: [INSTANCE_KEY],
            ttsServiceList: [],
            hasAnyRequest: true,
        }))
        // Manually collapse
        fireEvent.click(screen.getByTestId('result-collapse'))
        expect(screen.getByTestId('result-collapse').getAttribute('aria-expanded')).toBe('false')

        // New translation starts
        act(() => {
            useTranslateStore.setState({ isTranslating: true, results: {} })
        })
        rerender(React.createElement(TargetArea, {
            serviceList: [INSTANCE_KEY],
            ttsServiceList: [],
            hasAnyRequest: true,
        }))
        // Collapse state should be reset (collapsed because no result, but not manually)
        expect(screen.getByTestId('result-collapse').getAttribute('aria-expanded')).toBe('false')

        // Result arrives — card should auto-expand (not stay manually collapsed)
        act(() => {
            useTranslateStore.setState({ isTranslating: false, results: { [INSTANCE_KEY]: '第二轮' } })
        })
        rerender(React.createElement(TargetArea, {
            serviceList: [INSTANCE_KEY],
            ttsServiceList: [],
            hasAnyRequest: true,
        }))
        expect(screen.getByTestId('result-collapse').getAttribute('aria-expanded')).toBe('true')
        expect(screen.getByTestId('result-body').textContent).toContain('第二轮')
    })

    it('renders error state when result is null', () => {
        act(() => {
            useTranslateStore.setState({ results: { [INSTANCE_KEY]: null } })
        })
        render(React.createElement(TargetArea, {
            serviceList: [INSTANCE_KEY],
            ttsServiceList: [],
            hasAnyRequest: true,
        }))
        expect(screen.getByTestId('result-error')).toBeTruthy()
        expect(screen.getByTestId('result-error').textContent).toContain('翻译失败')
    })
})
