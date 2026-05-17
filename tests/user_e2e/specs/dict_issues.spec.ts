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

        // Header card bounding box must fully contain pronunciation and POS
        // chips — none of them may overflow the card's bottom edge.
        const card_box = await dict['page'].locator('[data-testid="dict-card"]').first().boundingBox()
        expect(card_box).not.toBeNull()

        const meta_elements = dict['page'].locator(
            '[data-testid="dict-card"]:first-of-type [data-testid="dict-pronunciation"], '
            + '[data-testid="dict-card"]:first-of-type [data-testid="dict-pos-tag"]'
        )
        const count = await meta_elements.count()
        expect(count, '词典卡片应展示读音/词性 chip').toBeGreaterThan(0)

        for (let i = 0; i < count; i += 1) {
            const box = await meta_elements.nth(i).boundingBox()
            expect(box).not.toBeNull()
            expect(box!.y + box!.height,
                `第 ${String(i)} 个元数据 chip 超出卡片底边，被遮挡`)
                .toBeLessThanOrEqual(card_box!.y + card_box!.height)
        }
    })
})
