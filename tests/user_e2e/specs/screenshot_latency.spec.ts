import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const screenshot_config = {
    recognize_service_list: [],
    service_instances: {},
}

// Wall-clock-bounded perf check. Crosses Playwright polling + Electron IPC +
// Windows process scheduling, so it is gated behind an opt-in env var and uses
// a generous ceiling to avoid flaking on cold/loaded runners.
const PERF_LATENCY_MS = Number(process.env.OMNI_POT_SCREENSHOT_LATENCY_MS ?? '1500')

test.describe('@perf screenshot latency', () => {
    test.skip(process.env.OMNI_POT_PERF_TESTS !== '1',
        'Set OMNI_POT_PERF_TESTS=1 to run wall-clock latency checks')

    test(`screenshot overlay is visible within ${String(PERF_LATENCY_MS)}ms after trigger`, async () => {
        const omni = await AppFixture.start({ config: screenshot_config })
        try {
            // Warm-up: first window creation on Windows pays one-time costs.
            await omni.api.triggerScreenshot('recognize')
            await omni.api.windowState('screenshot')

            const started_at = Date.now()
            const trigger = omni.api.triggerScreenshot('recognize')
            await expect.poll(async () => (await omni.api.windowState('screenshot')).visible, {
                intervals: [20, 40, 80],
                timeout: PERF_LATENCY_MS,
            }).toBe(true)
            expect(Date.now() - started_at).toBeLessThan(PERF_LATENCY_MS)
            const result = await trigger
            expect(result.success).toBe(true)
        } finally {
            await omni.stop()
        }
    })
})
