import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp, type LaunchedApp } from './electron_app'
import { E2eApi } from './e2e_api'
import { TranslatePage } from '../pages/translate_page'
import { DictPage } from '../pages/dict_page'

export class AppFixture {
    readonly app: ElectronApplication
    readonly api: E2eApi
    private httpPort: number
    private userDataDir: string

    private constructor(launched: LaunchedApp) {
        this.app = launched.app
        this.httpPort = launched.httpPort
        this.userDataDir = launched.userDataDir
        this.api = new E2eApi(launched.httpPort)
    }

    static async start(opts: {
        config?: Record<string, unknown>
        firstRun?: boolean
    } = {}): Promise<AppFixture> {
        const launched = await launchApp(opts)
        return new AppFixture(launched)
    }

    async stop(): Promise<void> {
        await closeApp({
            app: this.app,
            httpPort: this.httpPort,
            userDataDir: this.userDataDir,
        })
    }

    async firstWindow(): Promise<Page> {
        return this.waitForWindow(/#translate/)
    }

    async waitForWindow(urlPattern: RegExp, timeout = 10_000): Promise<Page> {
        const start = Date.now()
        while (Date.now() - start < timeout) {
            for (const win of this.app.windows()) {
                if (urlPattern.test(win.url())) return win
            }
            await new Promise(r => setTimeout(r, 200))
        }
        throw new Error(`No window matching ${urlPattern} after ${timeout}ms`)
    }

    async translate(): Promise<TranslatePage> {
        const page = await this.firstWindow()
        return new TranslatePage(page)
    }

    async dict(): Promise<DictPage> {
        const page = await this.waitForWindow(/#dict/)
        return new DictPage(page)
    }

    async resetConfig(): Promise<void> {
        await this.api.resetConfig()
    }
}
