import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const screenshot_config = {
    recognize_service_list: [],
    service_instances: {},
}

test.describe('@perf screenshot latency', () => {
    test('screenshot overlay is visible within 300ms after trigger', async () => {
        const omni = await AppFixture.start({ config: screenshot_config })
        try {
            const started_at = Date.now()
            const trigger = omni.api.triggerScreenshot('recognize')
            await expect.poll(async () => (await omni.api.windowState('screenshot')).visible, {
                intervals: [20, 40, 80],
                timeout: 300,
            }).toBe(true)
            expect(Date.now() - started_at).toBeLessThan(300)
            const result = await trigger
            expect(result.success).toBe(true)
        } finally {
            await omni.stop()
        }
    })
})
