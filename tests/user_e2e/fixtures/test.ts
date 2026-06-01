import { test as base, expect } from '@playwright/test'
import { AppFixture } from './app_fixture'

type TestFixtures = { omni: AppFixture }

/**
 * `omni` is test-scoped — each test gets a fresh Electron instance with a
 * temporary userData dir. This is the simplest model for spec authors and
 * avoids the cross-test runtime-state pollution (alwaysOnTop, pinned,
 * window size, IME state, GlobalShortcut, tray menu, etc.) that a shared
 * instance would leak.
 *
 * Two faster knobs are kept: (1) `playwright.config.ts` runs the
 * parallel-safe specs in a dedicated `ui-parallel` project with
 * `fullyParallel: true`; (2) `scripts/run_e2e.mjs` builds once in phase one
 * and reuses the build for phase two via `OMNI_POT_E2E_SKIP_BUILD=1`.
 *
 * Tests that need a non-default startup config (`firstRun`, custom
 * `userDataDir`, `init_script`, preset config keys) still call
 * `AppFixture.start(...)` directly and skip this fixture.
 */
export const test = base.extend<TestFixtures>({
    omni: async ({ }, use) => {
        const omni = await AppFixture.start({ config: { welcome_dismissed: true } })
        try {
            await use(omni)
        } finally {
            await omni.stop()
        }
    },
})

export { expect }
