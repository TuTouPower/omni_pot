import { test as base, expect } from '@playwright/test'
import { AppFixture } from './app_fixture'

export const test = base.extend<{ omni: AppFixture }>({
    omni: async ({ browserName: _browserName }, use) => {
        void _browserName
        const omni = await AppFixture.start()
        await use(omni)
        await omni.stop()
    },
})

export { expect }
