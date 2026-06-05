import { defineConfig } from '@playwright/test'

/**
 * Parallel-safe UI specs: do not touch OS-global state (GlobalShortcut, tray,
 * clipboard, screenshot, focus, window bounds/topmost) and tolerate other
 * Electron instances running concurrently. Run in `ui-parallel` project with
 * `fullyParallel: true`. All other specs run serially.
 */
const ui_parallel_safe = [
    'app_http_api.spec.ts',
    'terminology_settings.spec.ts',
    'translate_core.spec.ts',
    'translate_input_rows.spec.ts',
    'translate_language_area.spec.ts',
    'translate_result_states.spec.ts',
    'window_rounded_corner.spec.ts',
]

export default defineConfig({
    testDir: './tests/e2e/specs',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    workers: 1,
    retries: 1,
    reporter: [['html', { open: 'never' }], ['list']],
    globalSetup: './tests/e2e/global_setup.ts',
    projects: [
        {
            name: 'core',
            grep: /@core/,
        },
        {
            name: 'ui-serial',
            grep: /@ui/,
            testIgnore: ui_parallel_safe,
        },
        {
            name: 'ui-parallel',
            grep: /@ui/,
            testMatch: ui_parallel_safe,
            fullyParallel: true,
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
    outputDir: './tests/e2e/test-results',
})
