import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SortableDictCard } from '../../../src/windows/dict/dict_card'
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

describe('dictionary pronunciation audio', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('plays the Cambridge audio URL from the pronunciation button', () => {
        const play = vi.fn(() => Promise.resolve())
        const audio_constructor = vi.fn()
        class MockAudio {
            constructor(url: string) {
                audio_constructor(url)
            }

            play(): Promise<void> {
                return play()
            }
        }
        vi.stubGlobal('Audio', MockAudio)
        const result: DictResult = {
            type: 'dict',
            pronunciations: [{ region: 'UK', phonetic: '/test/', audio_url: 'https://dictionary.cambridge.org/media/test.mp3' }],
            definitions: [{ part_of_speech: 'noun', meanings: ['test meaning'] }],
            examples: [],
        }

        render(React.createElement(SortableDictCard, {
            instanceKey: 'cambridge_dict@default',
            result,
            isLoading: false,
        }))

        fireEvent.click(screen.getByTestId('dict-pron-audio-btn'))

        expect(audio_constructor).toHaveBeenCalledWith('https://dictionary.cambridge.org/media/test.mp3')
        expect(play).toHaveBeenCalledOnce()
    })
})
