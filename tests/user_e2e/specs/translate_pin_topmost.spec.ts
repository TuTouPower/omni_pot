// Covers docs/issues.md "固定与置顶功能拆分与联动":
//   - 标题栏存在 TWO buttons: 固定 (pin / 不失焦关闭) 与 置顶 (always-on-top)
//   - 未点击固定 + 失焦 -> 窗口自动关闭
//   - 点击置顶 -> 自动激活固定
//   - 点击固定 -> 仅固定, 不一定置顶
//
// The existing translate_titlebar.spec.ts treats pin === always-on-top because
// the current data model collapses them into one flag. This spec exists to
// document the split-button acceptance criteria and will fail until the source
// model is split.

import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const TOPMOST_TESTID = 'titlebar-topmost'

test.describe('@ui translate pin/topmost split', () => {
    test('titlebar exposes two separate buttons for 固定 and 置顶', async ({ omni }) => {
        const translate = await omni.translate()
        await expect(translate.pinButton()).toBeVisible()
        // New required testid — present test will fail until source adds it.
        await expect(translate['page'].getByTestId(TOPMOST_TESTID)).toBeVisible()
    })

    test('clicking 置顶 also activates 固定 (topmost implies pinned)', async ({ omni }) => {
        const translate = await omni.translate()
        const topmost = translate['page'].getByTestId(TOPMOST_TESTID)

        await topmost.click()
        await expect.poll(async () => (await omni.api.windowState('translate')).alwaysOnTop)
            .toBe(true)
        await expect(translate.pinButton()).toHaveAttribute('aria-pressed', 'true')
    })

    test('clicking 固定 alone does not enable 置顶', async ({ omni }) => {
        const translate = await omni.translate()
        await translate.clickPin()
        await expect(translate.pinButton()).toHaveAttribute('aria-pressed', 'true')
        const state = await omni.api.windowState('translate')
        expect(state.alwaysOnTop).toBe(false)
    })

    test('unpinned window auto-closes on blur; pinned window stays open', async () => {
        // Unpinned: default config has translate_close_on_blur=true, so opening
        // config (focus loss) must hide the translate window.
        const omni_unpinned = await AppFixture.start({
            config: { translate_close_on_blur: true, translate_always_on_top: false },
        })
        try {
            await omni_unpinned.translate()
            await omni_unpinned.openConfig()
            await expect.poll(async () => (await omni_unpinned.api.windowState('translate')).visible,
                { timeout: 5_000 }).toBe(false)
        } finally {
            await omni_unpinned.stop()
        }

        // Pinned (固定): focus loss must NOT hide the translate window even
        // when always-on-top is off.
        const omni_pinned = await AppFixture.start({
            config: { translate_close_on_blur: true, translate_always_on_top: false },
        })
        try {
            const translate = await omni_pinned.translate()
            await translate.clickPin()
            await omni_pinned.openConfig()
            await expect.poll(async () => (await omni_pinned.api.windowState('translate')).visible,
                { timeout: 3_000 }).toBe(true)
        } finally {
            await omni_pinned.stop()
        }
    })

    test('pin/topmost reset to default after closing and reopening the window', async () => {
        const omni = await AppFixture.start({
            config: { translate_close_on_blur: false, translate_always_on_top: false },
        })
        try {
            const translate = await omni.translate()
            await translate.clickPin()
            await expect.poll(async () => (await omni.api.windowState('translate')).alwaysOnTop,
                { timeout: 3_000 }).toBe(true)

            // Close the translate window through the titlebar close button.
            await translate.clickClose()
            await expect.poll(async () => (await omni.api.windowState('translate')).exists,
                { timeout: 5_000 }).toBe(false)

            // Reopen — both pin and topmost must be off again, regardless of the
            // previous session's pin state.
            const reopened = await omni.translate()
            await expect(reopened.pinButton()).toHaveAttribute('aria-pressed', 'false')
            const fresh_state = await omni.api.windowState('translate')
            expect(fresh_state.alwaysOnTop).toBe(false)
        } finally {
            await omni.stop()
        }
    })
})
