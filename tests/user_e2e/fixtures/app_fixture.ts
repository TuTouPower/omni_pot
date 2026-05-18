import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp, type LaunchedApp } from './electron_app'
import { E2eApi } from './e2e_api'
import { TranslatePage } from '../pages/translate_page'
import { DictPage } from '../pages/dict_page'
import { RecognizePage } from '../pages/recognize_page'
import { ScreenshotPage } from '../pages/screenshot_page'
import { ConfigPage } from '../pages/config_page'
import { UpdaterPage } from '../pages/updater_page'

export class AppFixture {
    app: ElectronApplication
    api: E2eApi
    private httpPort: number
    private userDataDir: string
    private e2eToken: string
    private cleanupUserDataDir: boolean
    private init_script: string | undefined
    private init_script_applied_to_first_window = false

    private constructor(launched: LaunchedApp, init_script?: string) {
        this.app = launched.app
        this.httpPort = launched.httpPort
        this.userDataDir = launched.userDataDir
        this.e2eToken = launched.e2eToken
        this.cleanupUserDataDir = launched.cleanupUserDataDir
        this.api = new E2eApi(launched.httpPort, launched.e2eToken)
        this.init_script = init_script
    }

    static async start(opts: {
        config?: Record<string, unknown>
        firstRun?: boolean
        userDataDir?: string
        cleanupUserDataDir?: boolean
        /**
         * JavaScript source executed in every renderer before app code runs.
         * Used by TTS tests to stub `window.speechSynthesis`. Applied via
         * Playwright's `electronApp.context().addInitScript`; the first
         * already-opened translate window is reloaded once so it also picks
         * up the script.
         */
        init_script?: string
    } = {}): Promise<AppFixture> {
        const launched = await launchApp(opts)
        const fixture = new AppFixture(launched, opts.init_script)
        if (opts.init_script) {
            await launched.app.context().addInitScript({ content: opts.init_script })
        }
        return fixture
    }

    async stop(options: { preserveUserData?: boolean } = {}): Promise<void> {
        await closeApp({
            app: this.app,
            httpPort: this.httpPort,
            userDataDir: this.userDataDir,
            e2eToken: this.e2eToken,
            cleanupUserDataDir: options.preserveUserData ? false : this.cleanupUserDataDir,
        })
    }

    async restart(): Promise<void> {
        await closeApp({
            app: this.app,
            httpPort: this.httpPort,
            userDataDir: this.userDataDir,
            e2eToken: this.e2eToken,
            cleanupUserDataDir: false,
        })
        const launched = await launchApp({
            userDataDir: this.userDataDir,
            cleanupUserDataDir: this.cleanupUserDataDir,
        })
        this.app = launched.app
        this.httpPort = launched.httpPort
        this.e2eToken = launched.e2eToken
        this.api = new E2eApi(launched.httpPort, launched.e2eToken)
    }

    async firstWindow(): Promise<Page> {
        const page = await this.waitForWindow(/#translate/)
        if (this.init_script && !this.init_script_applied_to_first_window) {
            // The first window was created during app startup, before
            // addInitScript was registered on the context. Reload it once so
            // the script runs in this window too.
            await page.reload()
            this.init_script_applied_to_first_window = true
        }
        return page
    }

    async waitForWindow(urlPattern: RegExp, timeout = 10_000): Promise<Page> {
        const start = Date.now()
        while (Date.now() - start < timeout) {
            for (const win of this.app.windows()) {
                if (urlPattern.test(win.url())) return win
            }
            await new Promise(r => setTimeout(r, 200))
        }
        throw new Error(`No window matching ${String(urlPattern)} after ${String(timeout)}ms`)
    }

    async translate(): Promise<TranslatePage> {
        const page = await this.firstWindow()
        return new TranslatePage(page)
    }

    async dict(): Promise<DictPage> {
        const page = await this.waitForWindow(/#dict/)
        return new DictPage(page)
    }

    async recognize(): Promise<RecognizePage> {
        const page = await this.waitForWindow(/#recognize/)
        return new RecognizePage(page)
    }

    async screenshot(): Promise<ScreenshotPage> {
        const page = await this.waitForWindow(/#screenshot/)
        return new ScreenshotPage(page)
    }

    async config(): Promise<ConfigPage> {
        const page = await this.waitForWindow(/#config/)
        return new ConfigPage(page)
    }

    async updater(): Promise<UpdaterPage> {
        const page = await this.waitForWindow(/#updater/)
        return new UpdaterPage(page)
    }

    async openConfig(): Promise<ConfigPage> {
        await this.api.openWindow('config')
        return this.config()
    }

    async openRecognize(): Promise<RecognizePage> {
        await this.api.openWindow('recognize')
        return this.recognize()
    }

    async openUpdater(): Promise<UpdaterPage> {
        await this.api.openWindow('updater')
        return this.updater()
    }

    async triggerInputTranslate(): Promise<TranslatePage> {
        await this.api.triggerInputTranslate()
        return this.translate()
    }

    async triggerScreenshot(mode: 'recognize' | 'translate' = 'recognize'): Promise<ScreenshotPage> {
        await this.api.triggerScreenshot(mode)
        return this.screenshot()
    }

    async mockUpdate(release: Parameters<E2eApi['mockUpdate']>[0] = {}): Promise<UpdaterPage> {
        await this.api.mockUpdate(release)
        return this.updater()
    }

    async resetConfig(): Promise<void> {
        await this.api.resetConfig()
    }
}
