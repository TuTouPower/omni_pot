import { test as base, expect } from '@playwright/test'
import { AppFixture } from './app_fixture'

export const test = base.extend<{ omni: AppFixture }>({
    omni: async ({}, use) => {
        const omni = await AppFixture.start()
        await omni.resetConfig()
        await use(omni)
        await omni.stop()
    },
})

export { expect }
