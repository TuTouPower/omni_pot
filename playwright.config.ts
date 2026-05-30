import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './tests/user_e2e/specs',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['html', { open: 'never' }], ['list']],
    globalSetup: './tests/user_e2e/global_setup.ts',
    projects: [
        {
            name: 'core',
            grep: /@core/,
        },
        {
            name: 'ui',
            grep: /@ui/,
        },
        {
            name: 'external',
            grep: /@external/,
        },
    ],
    use: {
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    outputDir: './tests/user_e2e/test-results',
})
