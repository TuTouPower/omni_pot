import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SortableDictCard } from '../../../src/windows/dict/index'
import type { DictResult } from '@shared/types/service'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
    }),
}))

vi.mock('../../../src/services/registry', () => ({
    translateServiceRegistry: {
        get: vi.fn(() => ({ key: 'cambridge_dict', name: 'Cambridge Dictionary', languages: [] })),
    },
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

function make_result(): DictResult {
    return {
        type: 'dict',
        pronunciations: [],
        definitions: [
            { partOfSpeech: 'noun', meanings: ['面条 (noodle)'] },
        ],
        examples: [],
    }
}

describe('SortableDictCard collapse behavior', () => {
    it('hides definitions body when collapsed=true', () => {
        render(React.createElement(SortableDictCard, {
            instanceKey: 'cambridge_dict@default',
            result: make_result(),
            isLoading: false,
            collapsed: true,
        }))
        // Header still rendered, body hidden
        expect(screen.queryByTestId('dict-definition')).toBeNull()
        expect(screen.getByTestId('dict-collapse-btn')).toBeTruthy()
    })

    it('shows definitions body when collapsed=false', () => {
        render(React.createElement(SortableDictCard, {
            instanceKey: 'cambridge_dict@default',
            result: make_result(),
            isLoading: false,
            collapsed: false,
        }))
        expect(screen.getByTestId('dict-definition')).toBeTruthy()
    })

    it('hides shimmer when collapsed even while loading', () => {
        render(React.createElement(SortableDictCard, {
            instanceKey: 'cambridge_dict@default',
            result: undefined,
            isLoading: true,
            collapsed: true,
        }))
        expect(screen.queryByTestId('dict-shimmer')).toBeNull()
    })

    it('shows shimmer when expanded and loading (no result yet)', () => {
        render(React.createElement(SortableDictCard, {
            instanceKey: 'cambridge_dict@default',
            result: undefined,
            isLoading: true,
            collapsed: false,
        }))
        expect(screen.getByTestId('dict-shimmer')).toBeTruthy()
    })

    it('invokes onToggleCollapse when collapse button clicked', () => {
        const toggle = vi.fn()
        render(React.createElement(SortableDictCard, {
            instanceKey: 'cambridge_dict@default',
            result: make_result(),
            isLoading: false,
            collapsed: false,
            onToggleCollapse: toggle,
        }))
        fireEvent.click(screen.getByTestId('dict-collapse-btn'))
        expect(toggle).toHaveBeenCalledOnce()
    })

    it('reflects collapsed state via aria-expanded', () => {
        const { rerender } = render(React.createElement(SortableDictCard, {
            instanceKey: 'cambridge_dict@default',
            result: make_result(),
            isLoading: false,
            collapsed: true,
        }))
        expect(screen.getByTestId('dict-collapse-btn').getAttribute('aria-expanded')).toBe('false')
        rerender(React.createElement(SortableDictCard, {
            instanceKey: 'cambridge_dict@default',
            result: make_result(),
            isLoading: false,
            collapsed: false,
        }))
        expect(screen.getByTestId('dict-collapse-btn').getAttribute('aria-expanded')).toBe('true')
    })
})
