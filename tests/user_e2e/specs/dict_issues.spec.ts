// Covers docs/issues.md:
//   - 中文词典查询失败 (querying a single Chinese character such as "我" must
//     return a real CC-CEDICT/chinese-dictionary result, not an error)
//   - 词典卡片内容被遮挡 (the word header card must show the pronunciation/POS
//     tags fully — they are currently clipped by the card bottom edge)

import { test, expect } from '../fixtures/test'

test.describe('@ui dict query and layout', () => {
    test('single Chinese character returns a non-error dictionary card', async ({ omni }) => {
        const result = await omni.api.triggerDict('我')
        expect(result.success).toBe(true)

        const dict = await omni.dict()
        await expect(dict['page'].getByTestId('dict-word')).toHaveText('我', { timeout: 10_000 })

        const card = dict['page'].getByTestId('dict-card').first()
        await expect(card).toBeVisible({ timeout: 30_000 })

        // No "查询失败" / "未找到" text inside any dict card.
        const card_text = await dict['page'].locator('[data-testid="dict-card"]').allInnerTexts()
        for (const text of card_text) {
            expect(text, '中文单字词典不应返回失败提示').not.toMatch(/查询失败|未找到|查无此词/)
        }
    })

    test('dict header card shows pronunciation and POS tags without clipping', async ({ omni }) => {
        await omni.api.triggerDict('reconcile')
        const dict = await omni.dict()
        const word = dict['page'].getByTestId('dict-word')
        await expect(word).toHaveText('reconcile', { timeout: 10_000 })

        // Pronunciation and POS tags are now in a separate card below the source card (index 1).
        const meta_elements = dict['page'].locator('[data-testid="dict-pronunciation"], [data-testid="dict-pos-tag"]')
        await expect(meta_elements.first(), '词典卡片应展示读音/词性 chip').toBeVisible({ timeout: 10_000 })

        // The pronunciation card is always at index 1 (index 0 = source card).
        const pronunciation_card = dict['page'].getByTestId('dict-card').nth(1)
        const card_box = await pronunciation_card.boundingBox()
        if (!card_box) throw new Error('missing pronunciation card box')
        const count = await meta_elements.count()

        for (let i = 0; i < count; i += 1) {
            const box = await meta_elements.nth(i).boundingBox()
            if (!box) throw new Error(`missing metadata chip box at index ${String(i)}`)
            expect(box.y + box.height,
                `第 ${String(i)} 个元数据 chip 超出卡片底边，被遮挡`)
                .toBeLessThanOrEqual(card_box.y + card_box.height)
        }
    })

    test('dict cards do not impose a max-height that would clip body content', async ({ omni }) => {
        // Spec: dictionary cards grow to fit content; only the outer window
        // scrolls when the combined content exceeds the viewport. No card may
        // declare a fixed max-height (or it must be 'none'/'auto').
        await omni.api.triggerDict('hello')
        const dict = await omni.dict()
        const page = dict['page']
        await expect(page.getByTestId('dict-word')).toHaveText('hello', { timeout: 10_000 })
        await expect(page.locator('[data-testid="dict-card"]').first()).toBeVisible({ timeout: 30_000 })

        const max_heights = await page.locator('[data-testid="dict-card"]').evaluateAll(
            (cards) => cards.map((c) => window.getComputedStyle(c).maxHeight),
        )
        for (const max_h of max_heights) {
            expect(['none', '', 'auto'], `dict-card has a clipping max-height: ${max_h}`).toContain(max_h)
        }
    })
})
