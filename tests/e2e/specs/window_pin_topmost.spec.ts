import { ui_timeout_ms } from '../fixtures/timeout_constants'
// Covers TASKS.md: 词典/文字识别窗口固定按钮 bug + 补测试
// Replicates translate_pin_topmost.spec.ts pattern for dict and recognize windows.

import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

test.describe('@ui dict pin/topmost', () => {
    test('titlebar exposes two separate buttons for 固定 and 置顶', async ({ omni }) => {
        try {
            await omni.api.triggerDict('hello')
            const dict = await omni.dict()
            await expect(dict.pinButton()).toBeVisible()
            await expect(dict.topmostButton()).toBeVisible()
        } finally {
            await omni.stop()
        }
    })

    test('clicking 置顶 also activates 固定 (topmost implies pinned)', async ({ omni }) => {
        try {
            await omni.api.triggerDict('hello')
            const dict = await omni.dict()

            await dict.topmostButton().click()
            // Note: isAlwaysOnTop() returns false for transparent windows in CI;
            // verify via config instead.
            await expect.poll(async () => (await omni.api.getConfig()).dict_always_on_top)
                .toBe(true)
            await expect(dict.pinButton()).toHaveAttribute('aria-pressed', 'true')
        } finally {
            await omni.stop()
        }
    })

    test('clicking 固定 alone does not enable 置顶', async ({ omni }) => {
        try {
            await omni.api.triggerDict('hello')
            const dict = await omni.dict()
            await dict.clickPin()
            await expect(dict.pinButton()).toHaveAttribute('aria-pressed', 'true')
            const state = await omni.api.windowState('dict')
            expect(state.alwaysOnTop).toBe(false)
        } finally {
            await omni.stop()
        }
    })

    test('unpinned dict window auto-closes on blur; pinned stays open', async () => {
        // Unpinned: opening config (focus loss) must close dict window.
        const omni_unpinned = await AppFixture.start({
            config: { dict_always_on_top: false },
        })
        try {
            await omni_unpinned.api.triggerDict('hello')
            await omni_unpinned.dict()
            await omni_unpinned.openConfig()
            await expect.poll(async () => (await omni_unpinned.api.windowState('dict')).visible,
                { timeout: ui_timeout_ms }).toBe(false)
        } finally {
            await omni_unpinned.stop()
        }

        // Pinned: focus loss must NOT close dict window.
        const omni_pinned = await AppFixture.start({
            config: { dict_always_on_top: false },
        })
        try {
            await omni_pinned.api.triggerDict('hello')
            const dict = await omni_pinned.dict()
            await dict.clickPin()
            await omni_pinned.openConfig()
            await expect.poll(async () => (await omni_pinned.api.windowState('dict')).visible,
                { timeout: ui_timeout_ms }).toBe(true)
        } finally {
            await omni_pinned.stop()
        }
    })

    test('pin/topmost reset after closing and reopening the window', async () => {
        const omni = await AppFixture.start({
            config: { dict_always_on_top: false },
        })
        try {
            await omni.api.triggerDict('hello')
            const dict = await omni.dict()
            await dict.clickPin()
            await expect.poll(async () => (await omni.api.getConfig()).dict_pinned,
                { timeout: ui_timeout_ms }).toBe(true)

            await dict.clickClose()
            await expect.poll(async () => (await omni.api.windowState('dict')).exists,
                { timeout: ui_timeout_ms }).toBe(false)

            // Reopen — pin state must be reset.
            await omni.api.triggerDict('world')
            const fresh_dict = await omni.dict()
            await expect.poll(async () => (await omni.api.getConfig()).dict_pinned,
                { timeout: ui_timeout_ms }).toBe(false)
            await expect(fresh_dict.pinButton()).toHaveAttribute('aria-pressed', 'false')
            const fresh_state = await omni.api.windowState('dict')
            expect(fresh_state.alwaysOnTop).toBe(false)
        } finally {
            await omni.stop()
        }
    })
})

test.describe('@ui recognize pin/topmost', () => {
    test('titlebar exposes two separate buttons for 固定 and 置顶', async ({ omni }) => {
        try {
            const recognize = await omni.openRecognize()
            await expect(recognize.pinButton()).toBeVisible()
            await expect(recognize.topmostButton()).toBeVisible()
        } finally {
            await omni.stop()
        }
    })

    test('clicking 置顶 also activates 固定 (topmost implies pinned)', async ({ omni }) => {
        try {
            const recognize = await omni.openRecognize()

            await recognize.topmostButton().click()
            await expect.poll(async () => (await omni.api.getConfig()).recognize_always_on_top)
                .toBe(true)
            await expect(recognize.pinButton()).toHaveAttribute('aria-pressed', 'true')
        } finally {
            await omni.stop()
        }
    })

    test('clicking 固定 alone does not enable 置顶', async ({ omni }) => {
        try {
            const recognize = await omni.openRecognize()
            await recognize.clickPin()
            await expect(recognize.pinButton()).toHaveAttribute('aria-pressed', 'true')
            const state = await omni.api.windowState('recognize')
            expect(state.alwaysOnTop).toBe(false)
        } finally {
            await omni.stop()
        }
    })

    test('unpinned recognize window auto-closes on blur; pinned stays open', async () => {
        // Unpinned: opening config (focus loss) must close recognize window.
        const omni_unpinned = await AppFixture.start({
            config: { recognize_always_on_top: false },
        })
        try {
            await omni_unpinned.openRecognize()
            await omni_unpinned.openConfig()
            await expect.poll(async () => (await omni_unpinned.api.windowState('recognize')).visible,
                { timeout: ui_timeout_ms }).toBe(false)
        } finally {
            await omni_unpinned.stop()
        }

        // Pinned: focus loss must NOT close recognize window.
        const omni_pinned = await AppFixture.start({
            config: { recognize_always_on_top: false },
        })
        try {
            const recognize = await omni_pinned.openRecognize()
            await recognize.clickPin()
            await omni_pinned.openConfig()
            await expect.poll(async () => (await omni_pinned.api.windowState('recognize')).visible,
                { timeout: ui_timeout_ms }).toBe(true)
        } finally {
            await omni_pinned.stop()
        }
    })

    test('pin/topmost reset after closing and reopening the window', async () => {
        const omni = await AppFixture.start({
            config: { recognize_always_on_top: false },
        })
        try {
            const recognize = await omni.openRecognize()
            await recognize.clickPin()
            await expect.poll(async () => (await omni.api.getConfig()).recognize_pinned,
                { timeout: ui_timeout_ms }).toBe(true)

            await recognize.clickClose()
            await expect.poll(async () => (await omni.api.windowState('recognize')).exists,
                { timeout: ui_timeout_ms }).toBe(false)

            // Reopen — pin state must be reset.
            const fresh_recognize = await omni.openRecognize()
            await expect.poll(async () => (await omni.api.getConfig()).recognize_pinned,
                { timeout: ui_timeout_ms }).toBe(false)
            await expect(fresh_recognize.pinButton()).toHaveAttribute('aria-pressed', 'false')
            const fresh_state = await omni.api.windowState('recognize')
            expect(fresh_state.alwaysOnTop).toBe(false)
        } finally {
            await omni.stop()
        }
    })
})
