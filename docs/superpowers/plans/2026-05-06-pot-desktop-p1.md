# Pot Desktop P1: 应用壳 + 翻译核心 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Electron 多窗口应用壳，实现可用的翻译弹窗 + 3 个翻译服务 + 基础配置页 + 系统托盘 + 全局快捷键。

**Architecture:** 多窗口 Electron 架构。Main process 负责窗口管理、系统托盘、全局快捷键、配置读写。Renderer 按窗口标签渲染不同 React 组件。IPC 通过 contextBridge 暴露结构化 API。翻译服务在前端 renderer 中调用（HTTP 请求），通过统一接口注册。

**Tech Stack:** Electron 35+ / React 19 / TypeScript / electron-vite / HeroUI v2 (`@heroui/react`) / Tailwind CSS / Zustand / Vitest / Playwright

**注意事项：**
- 共享类型放在仓库根的 `shared/types/`，main 与 renderer 都通过 `tsconfig` include + 路径 alias 引用，避免跨进程 import 越过各自 tsconfig 的 `include`
- 所有 UI 组件统一用 HeroUI（`@heroui/react`），原 NextUI 已改名废弃
- WSL 开发需启用 WSLg 才能弹出 Electron GUI 窗口

---

## File Structure

### New files (按创建顺序)

| 文件 | 职责 |
|---|---|
| `package.json` | 项目依赖和脚本 |
| `electron.vite.config.ts` | electron-vite 构建配置 |
| `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json` | TypeScript 配置 |
| `postcss.config.js` / `tailwind.config.js` | CSS 工具链 |
| `index.html` | Renderer HTML 入口 |
| `electron/main.ts` | Electron 主进程入口 |
| `electron/preload.ts` | contextBridge + IPC 暴露 |
| `electron/windows/types.ts` | 窗口标签枚举 + 窗口选项类型 |
| `electron/windows/manager.ts` | 窗口创建/复用/定位 |
| `electron/config/store.ts` | JSON 配置读写 + 文件监听 |
| `electron/tray/index.ts` | 系统托盘菜单 |
| `electron/hotkey/index.ts` | 全局快捷键注册 |
| `electron/ipc/config_handlers.ts` | 配置相关 IPC handlers |
| `electron/ipc/window_handlers.ts` | 窗口操作 IPC handlers |
| `electron/ipc/hotkey_handlers.ts` | 快捷键 IPC handlers |
| `src/env.d.ts` | electron-vite 类型声明 |
| `shared/types/language.ts` | 语言代码 + LanguageFlag（main 与 renderer 共享） |
| `shared/types/service.ts` | 服务接口 + 实例类型 |
| `shared/types/config.ts` | 配置键类型 + 默认值 |
| `shared/types/ipc.ts` | IPC API 类型声明 |
| `src/services/registry.ts` | 服务注册表 |
| `src/services/bing.ts` | 必应翻译服务 |
| `src/services/google.ts` | 谷歌翻译服务 |
| `src/services/deepl.ts` | DeepL 翻译服务 |
| `src/stores/config_store.ts` | Zustand 配置 store (sync with main process) |
| `src/stores/translate_store.ts` | 翻译窗口状态 store |
| `src/hooks/use_config.ts` | 配置读写 hook |
| `src/i18n/index.ts` | i18next 初始化 |
| `src/i18n/locales/en.json` | 英文翻译 |
| `src/i18n/locales/zh_cn.json` | 中文翻译 |
| `src/styles/globals.css` | Tailwind 入口 |
| `src/main.tsx` | React 入口 |
| `src/App.tsx` | 窗口标签路由 |
| `src/windows/translate/index.tsx` | 翻译窗口主组件 |
| `src/windows/translate/source_area.tsx` | 源文本输入区 |
| `src/windows/translate/language_area.tsx` | 语言选择区 |
| `src/windows/translate/target_area.tsx` | 翻译结果卡片 |
| `src/windows/config/index.tsx` | 配置窗口主组件 |
| `src/windows/config/general.tsx` | 通用设置页 |
| `src/windows/config/translate_settings.tsx` | 翻译设置页 |
| `resources/icon.png` | 应用图标 |
| `tests/unit/services/test_bing.ts` | Bing 翻译测试 |
| `tests/unit/services/test_google.ts` | Google 翻译测试 |
| `tests/unit/services/test_deepl.ts` | DeepL 翻译测试 |
| `tests/unit/stores/test_translate_store.ts` | 翻译 store 测试 |
| `tests/integration/test_config.ts` | 配置读写集成测试 |
| `vitest.config.ts` | Vitest 配置 |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`
- Create: `postcss.config.js`
- Create: `tailwind.config.js`
- Create: `index.html`
- Create: `src/env.d.ts`
- Create: `src/styles/globals.css`
- Create: `resources/icon.png` (placeholder)

- [ ] **Step 1: 初始化 npm 项目（不依赖 electron-vite 脚手架，避免脚手架覆盖 docs/）**

```bash
cd /home/karon/karson_ubuntu/omni_pot
npm init -y
```

`package.json` 替换为：

```json
{
  "name": "omni-pot",
  "version": "1.0.0",
  "private": true,
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
    "test": "vitest run",
    "start": "electron-vite preview"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install electron@^35 @electron-toolkit/utils
npm install @heroui/react @heroui/theme framer-motion zustand react react-dom react-i18next i18next nanoid react-icons
npm install -D typescript @types/react @types/react-dom @types/node electron-vite vite @vitejs/plugin-react tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom
```

注意：原版用的 `react-beautiful-dnd` 已被作者宣布废弃（P3 服务排序时改用 `@dnd-kit/core` + `@dnd-kit/sortable`），P1 不安装。

PostCSS 配置：

`postcss.config.js`：

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

- [ ] **Step 3: Configure electron.vite.config.ts**

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve(__dirname, 'shared') }
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/main.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve(__dirname, 'shared') }
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/preload.ts') }
      }
    }
  },
  renderer: {
    root: '.',
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, 'shared')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'index.html') }
      }
    }
  }
})
```

- [ ] **Step 4: Configure tsconfig.json**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

`tsconfig.node.json`（main + preload，**include 包含 shared/**）：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "strict": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["shared/*"]
    },
    "types": ["node", "electron-vite/node"]
  },
  "include": [
    "electron/**/*.ts",
    "shared/**/*.ts",
    "electron.vite.config.ts"
  ]
}
```

`tsconfig.web.json`（renderer，**include 包含 shared/**；不要 composite + noEmit 同存）：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "strict": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@shared/*": ["shared/*"]
    }
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/env.d.ts",
    "shared/**/*.ts"
  ]
}
```

- [ ] **Step 5: Configure Tailwind (HeroUI)**

`tailwind.config.js`:

```javascript
const { heroui } = require('@heroui/react')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {}
  },
  darkMode: 'class',
  plugins: [heroui()]
}
```

`src/styles/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

- [ ] **Step 6: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pot</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.ts']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
```

- [ ] **Step 8: Create src/env.d.ts**

```typescript
/// <reference types="electron-vite/node" />
```

- [ ] **Step 9: Create placeholder icon (无外部依赖)**

用 Node 一行写一个 1x1 蓝色 PNG（之后再换成正式图标即可）：

```bash
mkdir -p resources
node -e "require('fs').writeFileSync('resources/icon.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'))"
```

- [ ] **Step 10: Verify setup（仅类型检查；不要现在跑 electron-vite build——后续 task 才会填充 import）**

```bash
npx tsc --noEmit -p tsconfig.web.json
```

Expected: 退出码 0（此时 src 目录还没有 .ts 文件，tsc 直接跳过即可）。

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with electron-vite + react + heroui + tailwind"
```

---

### Task 2: Shared Types

**Files:**
- Create: `shared/types/language.ts`
- Create: `shared/types/service.ts`
- Create: `shared/types/config.ts`
- Create: `shared/types/ipc.ts`
- Create: `electron/windows/types.ts`

放到 `shared/` 而不是 `src/types/`，是因为 main 进程的 `tsconfig.node.json` `include` 不包含 `src/**`，跨进程共享类型必须放双方 tsconfig 都覆盖到的目录。

- [ ] **Step 1: Write language types**

`shared/types/language.ts`:

```typescript
export const LANGUAGE_CODES = [
  'auto', 'zh_cn', 'zh_tw', 'yue', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
  'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
  'hi', 'mn_mo', 'mn_cy', 'km', 'nb_no', 'nn_no', 'fa', 'sv', 'pl',
  'nl', 'uk', 'he'
] as const

export type LanguageCode = typeof LANGUAGE_CODES[number]

export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  auto: 'Auto Detect',
  zh_cn: '简体中文',
  zh_tw: '繁體中文',
  yue: '粤语',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  es: 'Español',
  ru: 'Русский',
  de: 'Deutsch',
  it: 'Italiano',
  tr: 'Türkçe',
  pt_pt: 'Português (Portugal)',
  pt_br: 'Português (Brasil)',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  th: 'ไทย',
  ms: 'Bahasa Melayu',
  ar: 'العربية',
  hi: 'हिन्दी',
  mn_mo: 'Монгол (Монгол)',
  mn_cy: 'Монгол (Кирил)',
  km: 'ភាសាខ្មែរ',
  nb_no: 'Norsk bokmål',
  nn_no: 'Norsk nynorsk',
  fa: 'فارسی',
  sv: 'Svenska',
  pl: 'Polski',
  nl: 'Nederlands',
  uk: 'Українська',
  he: 'עברית'
}
```

- [ ] **Step 2: Write service interface types**

`shared/types/service.ts`:

```typescript
import type { LanguageCode } from './language'

export interface ServiceConfig {
  [key: string]: string | number | boolean | undefined
  instanceName?: string
  enable?: boolean
}

export interface DictPronunciation {
  region: string
  phonetic: string
}

export interface DictDefinition {
  partOfSpeech: string
  meanings: string[]
}

export interface DictExample {
  source: string
  target: string
}

export interface DictResult {
  type: 'dict'
  pronunciations: DictPronunciation[]
  definitions: DictDefinition[]
  examples: DictExample[]
}

export interface TranslateService {
  readonly key: string
  readonly name: string
  readonly languages: LanguageCode[]
  translate(
    text: string,
    from: LanguageCode,
    to: LanguageCode,
    config: ServiceConfig
  ): Promise<string | DictResult>
  testConfig(config: ServiceConfig): Promise<boolean>
}

export interface ServiceInstance {
  key: string        // e.g. 'bing@abc123'
  serviceKey: string // e.g. 'bing'
  config: ServiceConfig
}

export function createServiceInstanceKey(serviceKey: string): string {
  const id = Math.random().toString(36).substring(2, 10)
  return `${serviceKey}@${id}`
}

export function getServiceKey(instanceKey: string): string {
  return instanceKey.split('@')[0]
}
```

- [ ] **Step 3: Write config types**

`shared/types/config.ts`:

```typescript
export interface AppConfig {
  app_language: string
  app_theme: 'system' | 'light' | 'dark'
  app_font: string
  app_fallback_font: string
  app_font_size: number
  dev_mode: boolean
  transparent: boolean
  check_update: boolean
  server_port: number

  proxy_enable: boolean
  proxy_host: string
  proxy_port: string

  translate_source_language: string
  translate_target_language: string
  translate_second_language: string
  translate_detect_engine: string
  translate_auto_copy: 'disable' | 'source' | 'target' | 'source_target'
  incremental_translate: boolean
  history_disable: boolean
  dynamic_translate: boolean
  translate_delete_newline: boolean
  translate_remember_language: boolean

  translate_window_position: 'mouse' | 'pre_state'
  translate_remember_window_size: boolean
  translate_close_on_blur: boolean
  translate_always_on_top: boolean
  hide_source: boolean
  hide_language: boolean
  translate_hide_window: boolean

  translate_window_width: number
  translate_window_height: number
  translate_window_position_x: number
  translate_window_position_y: number

  hotkey_selection_translate: string
  hotkey_input_translate: string
  hotkey_ocr_recognize: string
  hotkey_ocr_translate: string

  translate_service_list: string[]
  recognize_service_list: string[]
  tts_service_list: string[]
  collection_service_list: string[]

  service_instances: ServiceInstancesMap
}

export const DEFAULT_CONFIG: AppConfig = {
  app_language: 'en',
  app_theme: 'system',
  app_font: 'default',
  app_fallback_font: 'default',
  app_font_size: 16,
  dev_mode: false,
  transparent: true,
  check_update: true,
  server_port: 60828,

  proxy_enable: false,
  proxy_host: '',
  proxy_port: '',

  translate_source_language: 'auto',
  translate_target_language: 'zh_cn',
  translate_second_language: 'en',
  translate_detect_engine: 'bing',
  translate_auto_copy: 'disable',
  incremental_translate: false,
  history_disable: false,
  dynamic_translate: false,
  translate_delete_newline: false,
  translate_remember_language: false,

  translate_window_position: 'mouse',
  translate_remember_window_size: false,
  translate_close_on_blur: true,
  translate_always_on_top: false,
  hide_source: false,
  hide_language: false,
  translate_hide_window: false,

  translate_window_width: 350,
  translate_window_height: 420,
  translate_window_position_x: 0,
  translate_window_position_y: 0,

  hotkey_selection_translate: '',
  hotkey_input_translate: '',
  hotkey_ocr_recognize: '',
  hotkey_ocr_translate: '',

  translate_service_list: ['bing@default', 'google@default', 'deepl@default'],
  recognize_service_list: [],
  tts_service_list: [],
  collection_service_list: [],

  service_instances: DEFAULT_SERVICE_INSTANCES
}

// service_instances: 实例 key → 实例配置；首次启动时 main 进程负责为内置服务建好默认实例
export interface ServiceInstancesMap {
  [instanceKey: string]: { serviceKey: string; config: Record<string, unknown> }
}

export const DEFAULT_SERVICE_INSTANCES: ServiceInstancesMap = {
  'bing@default': { serviceKey: 'bing', config: {} },
  'google@default': { serviceKey: 'google', config: {} },
  'deepl@default': { serviceKey: 'deepl', config: { type: 'free', authKey: '' } }
}

export type ConfigKey = keyof AppConfig
```

- [ ] **Step 4: Write IPC type declarations**

`shared/types/ipc.ts`:

```typescript
import type { ConfigKey, AppConfig } from './config'

export interface ElectronAPI {
  window: {
    close(): Promise<void>
    minimize(): Promise<void>
    maximize(): Promise<void>
    setAlwaysOnTop(flag: boolean): Promise<void>
    getLabel(): Promise<string>
  }
  config: {
    get(key: ConfigKey): Promise<unknown>
    set(key: ConfigKey, value: unknown): Promise<void>
    getAll(): Promise<AppConfig>
    onChange(callback: (key: ConfigKey, value: unknown) => void): () => void
  }
  hotkey: {
    register(name: string, shortcut: string): Promise<boolean>
    unregister(name: string, shortcut: string): Promise<void>
  }
  text: {
    getSelection(): Promise<string>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
```

- [ ] **Step 5: Write Electron window types**

`electron/windows/types.ts`:

```typescript
export enum WindowLabel {
  DAEMON = 'daemon',
  TRANSLATE = 'translate',
  SCREENSHOT = 'screenshot',
  RECOGNIZE = 'recognize',
  CONFIG = 'config',
  UPDATER = 'updater'
}

export interface WindowOptions {
  label: WindowLabel
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  resizable?: boolean
  alwaysOnTop?: boolean
  skipTaskbar?: boolean
  show?: boolean
  transparent?: boolean
  frame?: boolean
  focusable?: boolean
}
```

- [ ] **Step 6: Commit**

```bash
git add shared/types/ electron/windows/types.ts
git commit -m "feat: add shared type definitions for language, service, config, ipc, and windows"
```

---

### Task 3: Electron Main Process Entry

**Files:**
- Create: `electron/main.ts`
- Create: `electron/main_stubs.ts`（先写空实现以便单独验证 main 进程编译；Task 4–7 会替换）

> 注意：原版 plan 的 Task 3 在 manager/tray/hotkey/config 都没实现时就要求跑 `electron-vite build`，是不可能通过的。改为 stub-first：先建空模块占位，main.ts 引用它们；后续 task 用真实实现替换文件内容（不动 import）。

- [ ] **Step 1: Write stub modules**

`electron/windows/manager.ts`（暂时占位，Task 4 替换）：

```typescript
import type { BrowserWindow } from 'electron'
import type { WindowLabel, WindowOptions } from './types'

export class WindowManager {
  createWindow(_opts: WindowOptions): BrowserWindow { throw new Error('stub') }
  getWindow(_label: WindowLabel): BrowserWindow | undefined { return undefined }
  focusOrCreate(_label: WindowLabel, opts: WindowOptions): BrowserWindow { return this.createWindow(opts) }
  closeWindow(_label: WindowLabel): void {}
  getLabel(_id: number): WindowLabel | undefined { return undefined }
  getAllWindows(): BrowserWindow[] { return [] }
}
```

`electron/config/store.ts`（暂时占位，Task 6 替换）：

```typescript
import type { AppConfig, ConfigKey } from '@shared/types/config'
import { DEFAULT_CONFIG } from '@shared/types/config'

export function initConfigStore(): void {}
export function getConfig(_key: ConfigKey): unknown { return undefined }
export function setConfig(_key: ConfigKey, _value: unknown): void {}
export function getAllConfig(): AppConfig { return { ...DEFAULT_CONFIG } }
export function isFirstRun(): boolean { return false }
```

`electron/tray/index.ts`（占位，Task 19）：

```typescript
import type { WindowManager } from '../windows/manager'
export function setWindowManagerForTray(_mgr: WindowManager): void {}
export function createTray(): void {}
export function destroyTray(): void {}
```

`electron/hotkey/index.ts`（占位，Task 20）：

```typescript
import type { WindowManager } from '../windows/manager'
export function setWindowManagerForHotkey(_mgr: WindowManager): void {}
export function registerGlobalShortcutsFromConfig(): void {}
export function unregisterAll(): void {}
```

- [ ] **Step 2: Write main process skeleton**

`electron/main.ts`:

```typescript
import { app } from 'electron'
import { WindowManager } from './windows/manager'
import { WindowLabel } from './windows/types'
import { initConfigStore, isFirstRun } from './config/store'
import { createTray, setWindowManagerForTray } from './tray'
import { setWindowManagerForHotkey, registerGlobalShortcutsFromConfig, unregisterAll } from './hotkey'

let windowManager: WindowManager | undefined

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    windowManager?.focusOrCreate(WindowLabel.CONFIG, {
      label: WindowLabel.CONFIG,
      width: 800,
      height: 600,
      minWidth: 800,
      minHeight: 400
    })
  })

  app.whenReady().then(() => {
    initConfigStore()

    windowManager = new WindowManager()

    setWindowManagerForTray(windowManager)
    setWindowManagerForHotkey(windowManager)

    createTray()
    registerGlobalShortcutsFromConfig()

    // Daemon window (hidden background worker)
    windowManager.createWindow({
      label: WindowLabel.DAEMON,
      width: 0,
      height: 0,
      show: false,
      skipTaskbar: true,
      transparent: false,
      frame: false
    })

    if (isFirstRun()) {
      windowManager.createWindow({
        label: WindowLabel.CONFIG,
        width: 800,
        height: 600,
        minWidth: 800,
        minHeight: 400
      })
    }
  })

  // 不退出应用——Pot 是托盘常驻；用户主动 Quit 时通过 tray 菜单触发 app.quit()
  app.on('window-all-closed', () => {
    // intentionally empty: keep running in tray
  })

  app.on('will-quit', () => {
    unregisterAll()
  })
}
```

要点：
- `requestSingleInstanceLock` 拿不到锁直接 `app.quit()`，不用 `releaseSingleInstanceLock`（该 API 不存在）。
- `window-all-closed` listener 无参数，且对于托盘常驻应用**留空**（不调用 `app.quit()`）。
- 注销 `globalShortcut` 在 `will-quit`，避免泄漏。

- [ ] **Step 3: Verify main process compiles**

```bash
npx electron-vite build
```

Expected: Build 成功（stub + main 都已就绪）。

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts electron/windows/manager.ts electron/config/store.ts electron/tray/index.ts electron/hotkey/index.ts
git commit -m "feat: electron main process entry with single-instance lock and tray-resident lifecycle"
```

---

### Task 4: Window Manager

**Files:**
- Replace: `electron/windows/manager.ts`（覆盖 Task 3 的 stub）
- Test: `tests/unit/windows/test_manager.ts`

**测试策略：** Electron 的 BrowserWindow 必须在 Electron runtime 里运行；纯 unit 测试无法构造真实窗口。这里的"单元测试"目的是验证**WindowManager 的 label-id 映射逻辑**——把 `BrowserWindow` 的构造、`focus`、`isDestroyed`、`setPosition` 等都 stub 掉是合理的。窗口实际行为留到 Task 21 的 e2e（真实 Electron 启动）覆盖。

- [ ] **Step 1: Write test for WindowManager**

`tests/unit/windows/test_manager.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 完整的 BrowserWindow stub:实现里调用到的每个方法都要存在
function makeWindowStub(opts: unknown): Record<string, unknown> {
  const win: Record<string, unknown> = {
    id: Math.floor(Math.random() * 1_000_000),
    webContents: { loadFile: vi.fn(), loadURL: vi.fn(), id: Math.random() },
    loadFile: vi.fn(),
    loadURL: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    setPosition: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
    options: opts
  }
  return win
}

vi.mock('electron', () => ({
  BrowserWindow: vi.fn().mockImplementation(makeWindowStub),
  screen: {
    getCursorScreenPoint: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    getDisplayNearestPoint: vi.fn().mockReturnValue({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 }
    })
  }
}))

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))

import { BrowserWindow } from 'electron'
import { WindowManager } from '../../../electron/windows/manager'
import { WindowLabel } from '../../../electron/windows/types'

describe('WindowManager', () => {
  let manager: WindowManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new WindowManager()
  })

  it('creates a new window', () => {
    manager.createWindow({
      label: WindowLabel.TRANSLATE,
      width: 350,
      height: 420
    })
    expect(BrowserWindow).toHaveBeenCalledTimes(1)
  })

  it('reuses existing window with same label and focuses it', () => {
    const win = manager.createWindow({
      label: WindowLabel.TRANSLATE,
      width: 350,
      height: 420
    })
    vi.mocked(BrowserWindow).mockClear()

    const win2 = manager.createWindow({
      label: WindowLabel.TRANSLATE,
      width: 350,
      height: 420
    })

    expect(BrowserWindow).not.toHaveBeenCalled()
    expect(win2).toBe(win)
    expect(win.focus).toHaveBeenCalledTimes(1)
  })

  it('looks up label by browser window id', () => {
    const win = manager.createWindow({
      label: WindowLabel.CONFIG,
      width: 800,
      height: 600
    })
    expect(manager.getLabelById((win as unknown as { id: number }).id)).toBe(WindowLabel.CONFIG)
  })

  it('removes mapping when window closes', () => {
    const win = manager.createWindow({
      label: WindowLabel.TRANSLATE,
      width: 350,
      height: 420
    }) as unknown as { on: import('vitest').Mock }
    // 取出注册的 'closed' 回调并触发
    const closedHandler = win.on.mock.calls.find((c) => c[0] === 'closed')?.[1] as () => void
    expect(closedHandler).toBeTypeOf('function')
    closedHandler()
    expect(manager.getWindow(WindowLabel.TRANSLATE)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test (should fail — implementation 还是 stub)**

```bash
npx vitest run tests/unit/windows/test_manager.ts
```

Expected: FAIL — `stub` error 或断言失败。

- [ ] **Step 3: Implement WindowManager**

`electron/windows/manager.ts`:

```typescript
import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { WindowOptions } from './types'
import { WindowLabel } from './types'

export class WindowManager {
  private byLabel = new Map<WindowLabel, BrowserWindow>()
  private labelById = new Map<number, WindowLabel>()

  createWindow(opts: WindowOptions): BrowserWindow {
    const existing = this.byLabel.get(opts.label)
    if (existing && !existing.isDestroyed()) {
      existing.focus()
      return existing
    }

    const point = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(point)
    const { workArea } = display

    const win = new BrowserWindow({
      width: opts.width,
      height: opts.height,
      minWidth: opts.minWidth,
      minHeight: opts.minHeight,
      resizable: opts.resizable ?? true,
      alwaysOnTop: opts.alwaysOnTop ?? false,
      skipTaskbar: opts.skipTaskbar ?? false,
      show: opts.show ?? true,
      transparent: opts.transparent ?? false,
      frame: opts.frame ?? true,
      focusable: opts.focusable ?? true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    if (opts.label !== WindowLabel.DAEMON) {
      const x = Math.round(workArea.x + (workArea.width - opts.width) / 2)
      const y = Math.round(workArea.y + (workArea.height - opts.height) / 2)
      win.setPosition(x, y)
    }

    // 通过 hash 传递 label，避开 file:// 下 query string 在某些 Electron 版本上被忽略的问题
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${opts.label}`)
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: opts.label
      })
    }

    win.on('closed', () => {
      this.byLabel.delete(opts.label)
      this.labelById.delete(win.id)
    })

    this.byLabel.set(opts.label, win)
    this.labelById.set(win.id, opts.label)
    return win
  }

  getWindow(label: WindowLabel): BrowserWindow | undefined {
    const win = this.byLabel.get(label)
    if (win && !win.isDestroyed()) return win
    return undefined
  }

  getLabelById(id: number): WindowLabel | undefined {
    return this.labelById.get(id)
  }

  focusOrCreate(label: WindowLabel, opts: WindowOptions): BrowserWindow {
    const existing = this.getWindow(label)
    if (existing) {
      existing.focus()
      return existing
    }
    return this.createWindow(opts)
  }

  closeWindow(label: WindowLabel): void {
    const win = this.getWindow(label)
    if (win) win.close()
  }

  getAllWindows(): BrowserWindow[] {
    return Array.from(this.byLabel.values()).filter((w) => !w.isDestroyed())
  }
}
```

注意：默认窗口外观改成 `transparent: false / frame: true`，按需通过 `WindowOptions` 显式设置；spec 中无装饰透明窗口在 P2/P4 视情况开启，避免 P1 默认透明导致的渲染问题。

- [ ] **Step 4: Run test**

```bash
npx vitest run tests/unit/windows/test_manager.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add electron/windows/manager.ts tests/unit/windows/test_manager.ts
git commit -m "feat: window manager with create/reuse/focus behavior"
```

---

### Task 5: IPC + Preload

**Files:**
- Create: `electron/preload.ts`
- Create: `electron/ipc/config_handlers.ts`
- Create: `electron/ipc/window_handlers.ts`
- Create: `electron/ipc/hotkey_handlers.ts`
- Create: `electron/ipc/text_handlers.ts`

所有 IPC handler 都接收 `windowManager` 注入，**签名一次定型**——不要 Task 20 再改签名（违反 plan 类型一致性）。

- [ ] **Step 1: Write config IPC handlers**

`electron/ipc/config_handlers.ts`:

```typescript
import { ipcMain } from 'electron'
import type { ConfigKey } from '@shared/types/config'
import { getConfig, setConfig, getAllConfig } from '../config/store'

export function registerConfigHandlers(): void {
  ipcMain.handle('config:get', (_event, key: ConfigKey) => getConfig(key))
  ipcMain.handle('config:set', (_event, key: ConfigKey, value: unknown) => setConfig(key, value))
  ipcMain.handle('config:getAll', () => getAllConfig())
}
```

- [ ] **Step 2: Write window IPC handlers**

`electron/ipc/window_handlers.ts`:

```typescript
import { ipcMain, BrowserWindow } from 'electron'
import type { WindowManager } from '../windows/manager'

export function registerWindowHandlers(manager: WindowManager): void {
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.handle('window:setAlwaysOnTop', (event, flag: boolean) => {
    BrowserWindow.fromWebContents(event.sender)?.setAlwaysOnTop(flag)
  })
  ipcMain.handle('window:getLabel', (event): string => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return ''
    return manager.getLabelById(win.id) ?? ''
  })
}
```

`getLabel` 通过 `manager.getLabelById` 反查（Electron 没有 `BrowserWindow.getLabel()` 方法，原 plan 这里是 bug）。

- [ ] **Step 3: Write hotkey IPC handlers (一次定签名，包含 manager)**

`electron/ipc/hotkey_handlers.ts`:

```typescript
import { ipcMain } from 'electron'
import type { WindowManager } from '../windows/manager'
import { registerHotkey, unregisterHotkey, buildHotkeyAction } from '../hotkey'

export function registerHotkeyHandlers(manager: WindowManager): void {
  ipcMain.handle(
    'hotkey:register',
    (_event, name: string, shortcut: string): boolean => {
      if (!shortcut) return false
      const action = buildHotkeyAction(name, manager)
      return registerHotkey(name, shortcut, action)
    }
  )

  ipcMain.handle(
    'hotkey:unregister',
    (_event, _name: string, shortcut: string): void => {
      if (shortcut) unregisterHotkey(shortcut)
    }
  )
}
```

`buildHotkeyAction` 在 Task 20 的 `electron/hotkey/index.ts` 中实现；这里只引用，不内联。

- [ ] **Step 4: Write text selection IPC handler (P1 占位实现，返回空字符串；划词翻译完整版本延后)**

`electron/ipc/text_handlers.ts`:

```typescript
import { ipcMain, clipboard } from 'electron'

export function registerTextHandlers(): void {
  // P1：通过剪贴板兜底获取选中文本（用户复制后再触发）；原生选区抓取在 P2/P4 接入
  ipcMain.handle('text:getSelection', (): string => clipboard.readText() ?? '')
}
```

- [ ] **Step 5: Write preload script**

`electron/preload.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '@shared/types/ipc'
import type { ConfigKey } from '@shared/types/config'

const api: ElectronAPI = {
  window: {
    close: () => ipcRenderer.invoke('window:close'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    setAlwaysOnTop: (flag) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
    getLabel: () => ipcRenderer.invoke('window:getLabel')
  },
  config: {
    get: (key) => ipcRenderer.invoke('config:get', key),
    set: (key, value) => ipcRenderer.invoke('config:set', key, value),
    getAll: () => ipcRenderer.invoke('config:getAll'),
    onChange: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, key: ConfigKey, value: unknown) =>
        callback(key, value)
      ipcRenderer.on('config:changed', handler)
      return () => { ipcRenderer.removeListener('config:changed', handler) }
    }
  },
  hotkey: {
    register: (name, shortcut) => ipcRenderer.invoke('hotkey:register', name, shortcut),
    unregister: (name, shortcut) => ipcRenderer.invoke('hotkey:unregister', name, shortcut)
  },
  text: {
    getSelection: () => ipcRenderer.invoke('text:getSelection')
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
```

- [ ] **Step 6: Register handlers in main.ts**

在 `electron/main.ts` 的 `app.whenReady().then(() => { ... })` 中、`new WindowManager()` 之后插入：

```typescript
import { registerConfigHandlers } from './ipc/config_handlers'
import { registerWindowHandlers } from './ipc/window_handlers'
import { registerHotkeyHandlers } from './ipc/hotkey_handlers'
import { registerTextHandlers } from './ipc/text_handlers'

// 在 app.whenReady 回调中、windowManager 创建之后：
registerConfigHandlers()
registerWindowHandlers(windowManager)
registerHotkeyHandlers(windowManager)
registerTextHandlers()
```

- [ ] **Step 7: Verify build**

```bash
npx electron-vite build
```

Expected: Build succeeds（hotkey 模块此时仍是 stub，但已有 `buildHotkeyAction` 占位导出——Task 20 替换实现）。在 Task 5 的 stub 阶段，先在 `electron/hotkey/index.ts` 中加：

```typescript
import type { WindowManager } from '../windows/manager'
export function registerHotkey(_name: string, _shortcut: string, _action: () => void): boolean { return false }
export function unregisterHotkey(_shortcut: string): void {}
export function buildHotkeyAction(_name: string, _mgr: WindowManager): () => void { return () => {} }
```

（Task 20 替换为真实实现。）

- [ ] **Step 8: Commit**

```bash
git add electron/preload.ts electron/ipc/ electron/hotkey/index.ts
git commit -m "feat: IPC handlers and preload script with contextBridge"
```

---

### Task 6: Config System

**Files:**
- Create: `electron/config/store.ts`
- Test: `tests/integration/test_config.ts`

- [ ] **Step 1: Write config store integration test**

`tests/integration/test_config.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// We test the pure logic by importing the module
// For real integration tests, we'd need an Electron environment

describe('Config Store - pure logic', () => {
  const testDir = join(tmpdir(), 'pot-test-config-' + Date.now())
  const configPath = join(testDir, 'config.json')

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('reads config from JSON file', async () => {
    const config = { app_language: 'zh_cn', app_theme: 'dark' }
    writeFileSync(configPath, JSON.stringify(config))

    const { readFileSync } = await import('fs')
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'))
    expect(raw.app_language).toBe('zh_cn')
    expect(raw.app_theme).toBe('dark')
  })

  it('writes config to JSON file', async () => {
    const config = { app_language: 'en' }
    writeFileSync(configPath, JSON.stringify(config, null, 2))

    const { readFileSync } = await import('fs')
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'))
    expect(raw.app_language).toBe('en')
  })

  it('returns default for missing key', () => {
    const defaults = { app_language: 'en', app_theme: 'system' as const }
    const stored: Record<string, unknown> = {}
    const get = (key: string) => stored[key] ?? defaults[key as keyof typeof defaults]
    expect(get('app_language')).toBe('en')
    expect(get('app_theme')).toBe('system')
  })
})
```

- [ ] **Step 2: Run test (should pass — uses fs directly)**

```bash
npx vitest run tests/integration/test_config.ts
```

Expected: PASS

- [ ] **Step 3: Implement config store with broadcast**

`electron/config/store.ts`（覆盖 Task 3 的 stub）：

```typescript
import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { DEFAULT_CONFIG, DEFAULT_SERVICE_INSTANCES } from '@shared/types/config'
import type { AppConfig, ConfigKey } from '@shared/types/config'

interface PersistedShape extends Partial<AppConfig> {
  __initialized?: boolean
  service_instances?: typeof DEFAULT_SERVICE_INSTANCES
}

let configPath: string
let data: PersistedShape = {}

export function initConfigStore(): void {
  const dir = app.getPath('userData')
  configPath = join(dir, 'config.json')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  if (existsSync(configPath)) {
    try {
      data = JSON.parse(readFileSync(configPath, 'utf-8')) as PersistedShape
    } catch {
      // 损坏的配置文件——重置但不抛错
      data = {}
    }
  } else {
    data = {}
  }

  if (!data.__initialized) {
    // 首次启动：写入默认服务实例 + 标记
    data = {
      ...data,
      service_instances: { ...DEFAULT_SERVICE_INSTANCES, ...(data.service_instances ?? {}) }
    }
    // 注意此时 __initialized 仍为 false——由 main 进程在调用 isFirstRun() 后再 commitFirstRun() 标记，
    // 这样能区分"全新安装"和"上次启动崩溃在初始化前"。
    saveToDisk()
  }
}

export function isFirstRun(): boolean {
  return data.__initialized !== true
}

export function commitFirstRun(): void {
  data.__initialized = true
  saveToDisk()
}

export function getConfig(key: ConfigKey): unknown {
  return key in data && data[key] !== undefined ? data[key] : DEFAULT_CONFIG[key]
}

export function setConfig(key: ConfigKey, value: unknown): void {
  ;(data as Record<string, unknown>)[key] = value
  saveToDisk()
  broadcastChange(key, value)
}

export function getAllConfig(): AppConfig {
  return { ...DEFAULT_CONFIG, ...data } as AppConfig
}

function saveToDisk(): void {
  writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8')
}

function broadcastChange(key: ConfigKey, value: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('config:changed', key, value)
    }
  }
}
```

要点：
- **`isFirstRun` 用专门 `__initialized` 标记**——原 plan 用 `Object.keys(data).length === 0` 在文件存在但内容为空时永远返回 true。
- **`setConfig` 后通过 `webContents.send('config:changed', key, value)` 主动广播**——原 plan 在 preload 注册了监听器但 main 从未发送，是死链。
- 损坏的配置文件 catch 后重置，避免应用永远启动失败。

- [ ] **Step 4: Update main.ts to call commitFirstRun**

在 `electron/main.ts` 的 first-run 分支中追加：

```typescript
import { isFirstRun, commitFirstRun } from './config/store'

if (isFirstRun()) {
  windowManager.createWindow({
    label: WindowLabel.CONFIG,
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 400
  })
  commitFirstRun()
}
```

- [ ] **Step 5: Run build**

```bash
npx electron-vite build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add electron/config/store.ts electron/main.ts tests/integration/test_config.ts
git commit -m "feat: JSON config store with first-run marker and config:changed IPC broadcast"
```

---

### Task 7: Service Interface + Registry

**Files:**
- Create: `src/services/registry.ts`
- Test: `tests/unit/services/test_registry.ts`

- [ ] **Step 1: Write registry test**

`tests/unit/services/test_registry.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { TranslateService } from '@shared/types/service'
import { ServiceRegistry } from '../../../src/services/registry'

const mockService: TranslateService = {
  key: 'mock',
  name: 'Mock Service',
  languages: ['auto', 'en', 'zh_cn'],
  translate: async (text) => `translated: ${text}`,
  testConfig: async () => true
}

describe('ServiceRegistry', () => {
  it('registers and retrieves a service', () => {
    const registry = new ServiceRegistry<TranslateService>()
    registry.register(mockService)
    expect(registry.get('mock')).toBe(mockService)
  })

  it('returns undefined for unregistered service', () => {
    const registry = new ServiceRegistry<TranslateService>()
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('lists all registered services', () => {
    const registry = new ServiceRegistry<TranslateService>()
    registry.register(mockService)
    expect(registry.getAll()).toHaveLength(1)
  })

  it('lists only keys', () => {
    const registry = new ServiceRegistry<TranslateService>()
    registry.register(mockService)
    expect(registry.getKeys()).toEqual(['mock'])
  })
})
```

- [ ] **Step 2: Run test (should fail)**

```bash
npx vitest run tests/unit/services/test_registry.ts
```

Expected: FAIL — cannot find module

- [ ] **Step 3: Implement registry**

`src/services/registry.ts`:

```typescript
export class ServiceRegistry<T extends { readonly key: string }> {
  private services = new Map<string, T>()

  register(service: T): void {
    this.services.set(service.key, service)
  }

  get(key: string): T | undefined {
    return this.services.get(key)
  }

  getAll(): T[] {
    return Array.from(this.services.values())
  }

  getKeys(): string[] {
    return Array.from(this.services.keys())
  }
}

import type { TranslateService } from '@shared/types/service'

export const translateServiceRegistry = new ServiceRegistry<TranslateService>()
```

- [ ] **Step 4: Run test**

```bash
npx vitest run tests/unit/services/test_registry.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/registry.ts tests/unit/services/test_registry.ts
git commit -m "feat: generic service registry with register/get/getAll"
```

---

### Task 8: Bing Translate Service

**Files:**
- Create: `src/services/bing.ts`
- Test: `tests/unit/services/test_bing.ts`

- [ ] **Step 1: Write Bing translate test**

`tests/unit/services/test_bing.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { bingService } from '../../../src/services/bing'

const RUN_NET = process.env.RUN_NETWORK_TESTS === '1'

describe('Bing Translate Service', () => {
  it('has correct key and name', () => {
    expect(bingService.key).toBe('bing')
    expect(bingService.name).toBe('Bing')
  })

  it('includes common languages', () => {
    expect(bingService.languages).toContain('auto')
    expect(bingService.languages).toContain('en')
    expect(bingService.languages).toContain('zh_cn')
  })

  // 真实 API 调用：用 RUN_NETWORK_TESTS=1 npx vitest 触发；CI 默认跳过
  it.skipIf(!RUN_NET)('translates text via real Bing API', async () => {
    const result = await bingService.translate('hello', 'en', 'zh_cn', {})
    expect(typeof result).toBe('string')
    expect((result as string).length).toBeGreaterThan(0)
  }, 15000)
})
```

**注意：** 不要用 `try/catch { console.warn(...) }` 来"跳过"网络测试——那样网络挂时测试仍然 PASS，断言失效。`it.skipIf` 才是 vitest 提供的真正跳过机制。CLAUDE.md 要求"少用 mock 多用真实环境"——所以我们保留真实 API 测试，但用环境变量门槛区分 unit/integration。

- [ ] **Step 2: Run test (should fail)**

```bash
npx vitest run tests/unit/services/test_bing.ts
```

Expected: FAIL — cannot find module

- [ ] **Step 3: Implement Bing service**

The Bing translator API works by:
1. Getting a token from `https://www.bing.com/translator`
2. POSTing to `https://www.bing.com/ttranslatev3` with the token

`src/services/bing.ts`:

```typescript
import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const BING_LANGUAGES: LanguageCode[] = [
  'auto', 'zh_cn', 'zh_tw', 'yue', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
  'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
  'hi', 'nb_no', 'fa', 'sv', 'pl', 'nl', 'uk', 'he'
]

const BING_LANG_MAP: Record<string, string> = {
  'auto': 'auto-detect',
  'zh_cn': 'zh-Hans',
  'zh_tw': 'zh-Hant',
  'yue': 'yue',
  'en': 'en',
  'ja': 'ja',
  'ko': 'ko',
  'fr': 'fr',
  'es': 'es',
  'ru': 'ru',
  'de': 'de',
  'it': 'it',
  'tr': 'tr',
  'pt_pt': 'pt',
  'pt_br': 'pt-br',
  'vi': 'vi',
  'id': 'id',
  'th': 'th',
  'ms': 'ms',
  'ar': 'ar',
  'hi': 'hi',
  'nb_no': 'nb',
  'nn_no': 'nb',
  'fa': 'fa',
  'sv': 'sv',
  'pl': 'pl',
  'nl': 'nl',
  'uk': 'uk',
  'he': 'he'
}

async function getToken(): Promise<string> {
  const resp = await fetch('https://www.bing.com/translator')
  const html = await resp.text()
  const match = html.match(/params_AbusePreventionHelper\s*=\s*\[.*?,.*?,(\d+),\s*"([^"]+)"/)
  if (!match) throw new Error('Failed to get Bing token')
  return `${match[1]}_${match[2]}`
}

export const bingService: TranslateService = {
  key: 'bing',
  name: 'Bing',
  languages: BING_LANGUAGES,

  async translate(
    text: string,
    from: LanguageCode,
    to: LanguageCode,
    _config: ServiceConfig
  ): Promise<string> {
    const token = await getToken()
    const fromLang = BING_LANG_MAP[from] ?? from
    const toLang = BING_LANG_MAP[to] ?? to

    const resp = await fetch('https://www.bing.com/ttranslatev3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        fromLang,
        to: toLang,
        text,
        token,
        key: ''
      }).toString()
    })

    const data = await resp.json()
    return data[0]?.translations?.[0]?.text ?? ''
  },

  async testConfig(): Promise<boolean> {
    try {
      const result = await this.translate('hello', 'en', 'zh_cn', {})
      return result.length > 0
    } catch {
      return false
    }
  }
}
```

- [ ] **Step 4: Register in registry**

Create `src/services/index.ts`:

```typescript
import { translateServiceRegistry } from './registry'
import { bingService } from './bing'

export function registerAllServices(): void {
  translateServiceRegistry.register(bingService)
  // Google and DeepL registered in Tasks 9-10
}

export { translateServiceRegistry } from './registry'
```

- [ ] **Step 5: Run test**

```bash
npx vitest run tests/unit/services/test_bing.ts
```

Expected: PASS (network test may be skipped)

- [ ] **Step 6: Commit**

```bash
git add src/services/bing.ts src/services/index.ts tests/unit/services/test_bing.ts
git commit -m "feat: Bing translate service with token-based API"
```

---

### Task 9: Google Translate Service

**Files:**
- Create: `src/services/google.ts`
- Test: `tests/unit/services/test_google.ts`

- [ ] **Step 1: Write Google translate test**

`tests/unit/services/test_google.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { googleService } from '../../../src/services/google'

const RUN_NET = process.env.RUN_NETWORK_TESTS === '1'

describe('Google Translate Service', () => {
  it('has correct key and name', () => {
    expect(googleService.key).toBe('google')
    expect(googleService.name).toBe('Google')
  })

  it('includes common languages', () => {
    expect(googleService.languages).toContain('auto')
    expect(googleService.languages).toContain('en')
    expect(googleService.languages).toContain('zh_cn')
  })

  it.skipIf(!RUN_NET)('translates text via real Google API', async () => {
    const result = await googleService.translate('hello', 'en', 'zh_cn', {})
    expect(typeof result).toBe('string')
    expect((result as string).length).toBeGreaterThan(0)
  }, 15000)
})
```

- [ ] **Step 2: Run test (should fail)**

```bash
npx vitest run tests/unit/services/test_google.ts
```

- [ ] **Step 3: Implement Google service**

Google 免费翻译用 `client=gtx` endpoint，**不需要 tk token**——这是 Google Translate 移动端公开使用的 client 标识，可以直接 GET，不会被拒。原 plan 的 `generateToken` 是假实现（注释自称"production needs full algorithm"），运行时会被 Google 拒绝；按 plan SKILL "complete code in every step" 不允许这种半成品。

`src/services/google.ts`:

```typescript
import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const GOOGLE_LANGUAGES: LanguageCode[] = [
  'auto', 'zh_cn', 'zh_tw', 'ja', 'en', 'ko', 'fr', 'es', 'ru', 'de',
  'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi',
  'nb_no', 'nn_no', 'fa', 'sv', 'pl', 'nl', 'uk', 'he'
]

const GOOGLE_LANG_MAP: Record<string, string> = {
  auto: 'auto',
  zh_cn: 'zh-CN',
  zh_tw: 'zh-TW',
  pt_pt: 'pt',
  pt_br: 'pt',
  nb_no: 'no',
  nn_no: 'no'
}

function mapLang(code: LanguageCode): string {
  return GOOGLE_LANG_MAP[code] ?? code
}

export const googleService: TranslateService = {
  key: 'google',
  name: 'Google',
  languages: GOOGLE_LANGUAGES,

  async translate(
    text: string,
    from: LanguageCode,
    to: LanguageCode,
    config: ServiceConfig
  ): Promise<string> {
    const baseUrl = (config.custom_url as string) || 'https://translate.googleapis.com'

    const url = new URL(`${baseUrl}/translate_a/single`)
    url.searchParams.set('client', 'gtx')
    url.searchParams.set('sl', mapLang(from))
    url.searchParams.set('tl', mapLang(to))
    url.searchParams.set('dt', 't')
    url.searchParams.set('q', text)

    const resp = await fetch(url.toString())
    if (!resp.ok) {
      throw new Error(`Google translate API ${resp.status}`)
    }
    const data = (await resp.json()) as Array<unknown>
    // Google 返回结构：[[["translated text","original",null,null,n], ...], ...]
    const segments = data[0] as Array<Array<unknown>> | undefined
    if (!segments) throw new Error('Google translate returned empty body')
    return segments.map((seg) => String(seg[0] ?? '')).join('')
  },

  async testConfig(config: ServiceConfig): Promise<boolean> {
    try {
      const result = await this.translate('hello', 'en', 'zh_cn', config)
      return typeof result === 'string' && result.length > 0
    } catch {
      return false
    }
  }
}
```

- [ ] **Step 4: Register in index.ts**

Add to `src/services/index.ts`:

```typescript
import { googleService } from './google'

// In registerAllServices():
translateServiceRegistry.register(googleService)
```

- [ ] **Step 5: Run test**

```bash
npx vitest run tests/unit/services/test_google.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/google.ts src/services/index.ts tests/unit/services/test_google.ts
git commit -m "feat: Google translate service"
```

---

### Task 10: DeepL Translate Service

**Files:**
- Create: `src/services/deepl.ts`
- Test: `tests/unit/services/test_deepl.ts`

- [ ] **Step 1: Write DeepL test**

`tests/unit/services/test_deepl.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { deeplService } from '../../../src/services/deepl'

afterEach(() => vi.restoreAllMocks())

describe('DeepL Translate Service', () => {
  it('has correct key and name', () => {
    expect(deeplService.key).toBe('deepl')
    expect(deeplService.name).toBe('DeepL')
  })

  it('supports Free, API, and DeepLX modes via config', () => {
    expect(deeplService.languages).toContain('auto')
    expect(deeplService.languages).toContain('en')
  })

  it('hits api-free.deepl.com for type=free with authKey', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ translations: [{ text: '你好' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const result = await deeplService.translate('hello', 'en', 'zh_cn', {
      type: 'free',
      authKey: 'fake-key'
    })
    expect(result).toBe('你好')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api-free.deepl.com/v2/translate')
    expect((init.headers as Record<string, string>).Authorization).toBe('DeepL-Auth-Key fake-key')
  })

  it('hits configured customUrl for type=deeplx without Authorization header', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { translations: [{ text: 'hi' }] } }), { status: 200 })
    )
    await deeplService.translate('hello', 'en', 'zh_cn', {
      type: 'deeplx',
      customUrl: 'http://localhost:1188/translate'
    })
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:1188/translate')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })
})
```

要点：原 plan 的 `try { await ... } catch (e) { expect(e).toBeDefined() }` 是反测试模式——成功时 catch 块根本不执行、try 块也没断言，整个 test 仍然 PASS。这里对 DeepL（付费/需要 key 的服务）用 fetch spy + 真实代码路径验证 URL/Header 拼装，符合 CLAUDE.md "尽量少用 mock"——只 stub 网络层这一处，被测的服务代码完全真实运行。

- [ ] **Step 2: Run test (should fail)**

```bash
npx vitest run tests/unit/services/test_deepl.ts
```

- [ ] **Step 3: Implement DeepL service**

`src/services/deepl.ts`:

```typescript
import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const DEEPL_LANGUAGES: LanguageCode[] = [
  'auto', 'zh_cn', 'zh_tw', 'ja', 'en', 'ko', 'fr', 'es', 'ru', 'de',
  'it', 'tr', 'pt_pt', 'pt_br', 'id', 'sv', 'pl', 'nl', 'uk'
]

function getApiUrl(type: string, customUrl?: string): string {
  switch (type) {
    case 'free':
      return 'https://api-free.deepl.com/v2/translate'
    case 'api':
      return 'https://api.deepl.com/v2/translate'
    case 'deeplx':
      return customUrl || 'http://localhost:1188/translate'
    default:
      return 'https://api-free.deepl.com/v2/translate'
  }
}

export const deeplService: TranslateService = {
  key: 'deepl',
  name: 'DeepL',
  languages: DEEPL_LANGUAGES,

  async translate(
    text: string,
    from: LanguageCode,
    to: LanguageCode,
    config: ServiceConfig
  ): Promise<string> {
    const type = (config.type as string) || 'free'
    const authKey = (config.authKey as string) || ''
    const customUrl = config.customUrl as string | undefined
    const url = getApiUrl(type, customUrl)

    const body: Record<string, string> = {
      text,
      target_lang: to.toUpperCase().replace('_', '-')
    }
    if (from !== 'auto') {
      body.source_lang = from.toUpperCase().replace('_', '-')
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded'
    }

    if (type !== 'deeplx') {
      headers['Authorization'] = `DeepL-Auth-Key ${authKey}`
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: new URLSearchParams(body).toString()
    })

    if (!resp.ok) {
      throw new Error(`DeepL API error: ${resp.status}`)
    }

    const data = await resp.json()

    if (type === 'deeplx') {
      return data.data?.translations?.[0]?.text ?? data.translations?.[0]?.text ?? ''
    }
    return data.translations?.[0]?.text ?? ''
  },

  async testConfig(config: ServiceConfig): Promise<boolean> {
    try {
      const result = await this.translate('hello', 'en', 'zh_cn', config)
      return result.length > 0
    } catch {
      return false
    }
  }
}
```

- [ ] **Step 4: Register in index.ts**

Add to `src/services/index.ts`:

```typescript
import { deeplService } from './deepl'

// In registerAllServices():
translateServiceRegistry.register(deeplService)
```

- [ ] **Step 5: Run all service tests**

```bash
npx vitest run tests/unit/services/
```

Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/deepl.ts src/services/index.ts tests/unit/services/test_deepl.ts
git commit -m "feat: DeepL translate service with Free/API/DeepLX modes"
```

---

### Task 11: Renderer Entry + Window Router

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`

- [ ] **Step 1: Write React entry point**

`src/main.tsx`（P1 最小版本——只注册服务 + 挂载 React；Task 12 加 config store，Task 18 加 i18n）：

```typescript
import React from 'react'
import { createRoot } from 'react-dom/client'
import { HeroUIProvider } from '@heroui/react'
import App from './App'
import './styles/globals.css'
import { registerAllServices } from './services'

registerAllServices()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HeroUIProvider>
      <App />
    </HeroUIProvider>
  </React.StrictMode>
)
```

注意：`HeroUIProvider`（HeroUI v2）替代原 `NextUIProvider`。Config store 和 i18n 将在后续 Task 中加入 bootstrap 逻辑。

- [ ] **Step 2: Write window label router**

`src/App.tsx`:

```typescript
import React, { Suspense } from 'react'
import { Spinner } from '@heroui/react'

const TranslateWindow = React.lazy(() => import('./windows/translate'))
const ConfigWindow = React.lazy(() => import('./windows/config'))

function getLabel(): string {
  // window manager 通过 hash (`#translate`、`#config` 等) 传递 label
  return window.location.hash.replace(/^#/, '') || 'translate'
}

export default function App(): React.ReactElement {
  const label = getLabel()

  const child = (() => {
    switch (label) {
      case 'translate':
      case 'daemon':
        return <TranslateWindow />
      case 'config':
        return <ConfigWindow />
      case 'screenshot':
      case 'recognize':
      case 'updater':
        return <div className="p-4 text-center">{label} window (coming soon)</div>
      default:
        return <TranslateWindow />
    }
  })()

  return <Suspense fallback={<Spinner />}>{child}</Suspense>
}
```

- [ ] **Step 3: Verify build**

```bash
npx electron-vite build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat: renderer entry with window label routing"
```

---

### Task 12: Zustand Stores

**Files:**
- Create: `src/stores/config_store.ts`
- Create: `src/stores/translate_store.ts`
- Create: `src/hooks/use_config.ts`
- Test: `tests/unit/stores/test_translate_store.ts`

- [ ] **Step 1: Write translate store test**

`tests/unit/stores/test_translate_store.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useTranslateStore } from '../../../src/stores/translate_store'
import type { LanguageCode } from '@shared/types/language'

describe('TranslateStore', () => {
  beforeEach(() => {
    useTranslateStore.setState({
      sourceText: '',
      targetLanguage: 'zh_cn',
      sourceLanguage: 'auto',
      detectedLanguage: null,
      results: {},
      isTranslating: false
    })
  })

  it('sets source text', () => {
    useTranslateStore.getState().setSourceText('hello')
    expect(useTranslateStore.getState().sourceText).toBe('hello')
  })

  it('sets target language', () => {
    useTranslateStore.getState().setTargetLanguage('ja')
    expect(useTranslateStore.getState().targetLanguage).toBe('ja')
  })

  it('swaps languages', () => {
    useTranslateStore.getState().setSourceLanguage('en')
    useTranslateStore.getState().setTargetLanguage('zh_cn')
    useTranslateStore.getState().swapLanguages()
    expect(useTranslateStore.getState().sourceLanguage).toBe('zh_cn')
    expect(useTranslateStore.getState().targetLanguage).toBe('en')
  })

  it('sets translation result for a service instance', () => {
    useTranslateStore.getState().setResult('bing@abc', '你好')
    expect(useTranslateStore.getState().results['bing@abc']).toBe('你好')
  })
})
```

- [ ] **Step 2: Run test (should fail)**

```bash
npx vitest run tests/unit/stores/test_translate_store.ts
```

- [ ] **Step 3: Implement config store**

`src/stores/config_store.ts`:

```typescript
import { create } from 'zustand'
import type { AppConfig, ConfigKey } from '@shared/types/config'
import { DEFAULT_CONFIG } from '@shared/types/config'

interface ConfigStore {
  config: AppConfig
  loaded: boolean
  loadConfig: () => Promise<void>
  get: <K extends ConfigKey>(key: K) => AppConfig[K]
  set: <K extends ConfigKey>(key: K, value: AppConfig[K]) => void
}

export const useConfigStore = create<ConfigStore>()((set, get) => ({
  config: DEFAULT_CONFIG,
  loaded: false,

  loadConfig: async () => {
    const all = await window.electronAPI.config.getAll()
    set({ config: { ...DEFAULT_CONFIG, ...all }, loaded: true })

    window.electronAPI.config.onChange((key, value) => {
      set((state) => ({
        config: { ...state.config, [key]: value }
      }))
    })
  },

  get: (key) => get().config[key],

  set: (key, value) => {
    set((state) => ({
      config: { ...state.config, [key]: value }
    }))
    window.electronAPI.config.set(key, value)
  }
}))
```

- [ ] **Step 4: Implement translate store**

`src/stores/translate_store.ts`:

```typescript
import { create } from 'zustand'
import type { LanguageCode } from '@shared/types/language'
import type { DictResult } from '@shared/types/service'

interface TranslateResults {
  [instanceKey: string]: string | DictResult | null
}

interface TranslateStore {
  sourceText: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  detectedLanguage: LanguageCode | null
  results: TranslateResults
  isTranslating: boolean

  setSourceText: (text: string) => void
  setSourceLanguage: (lang: LanguageCode) => void
  setTargetLanguage: (lang: LanguageCode) => void
  setDetectedLanguage: (lang: LanguageCode | null) => void
  setResult: (instanceKey: string, result: string | DictResult | null) => void
  setIsTranslating: (flag: boolean) => void
  swapLanguages: () => void
  clearResults: () => void
}

export const useTranslateStore = create<TranslateStore>()((set, get) => ({
  sourceText: '',
  sourceLanguage: 'auto',
  targetLanguage: 'zh_cn',
  detectedLanguage: null,
  results: {},
  isTranslating: false,

  setSourceText: (text) => set({ sourceText: text }),
  setSourceLanguage: (lang) => set({ sourceLanguage: lang }),
  setTargetLanguage: (lang) => set({ targetLanguage: lang }),
  setDetectedLanguage: (lang) => set({ detectedLanguage: lang }),
  setResult: (instanceKey, result) =>
    set((state) => ({ results: { ...state.results, [instanceKey]: result } })),
  setIsTranslating: (flag) => set({ isTranslating: flag }),
  swapLanguages: () => {
    const { sourceLanguage, targetLanguage } = get()
    if (sourceLanguage !== 'auto') {
      set({ sourceLanguage: targetLanguage, targetLanguage: sourceLanguage })
    }
  },
  clearResults: () => set({ results: {} })
}))
```

- [ ] **Step 5: Write useConfig hook**

`src/hooks/use_config.ts`:

```typescript
import { useCallback } from 'react'
import { useConfigStore } from '../stores/config_store'
import type { AppConfig, ConfigKey } from '@shared/types/config'

export function useConfig<K extends ConfigKey>(
  key: K
): [AppConfig[K], (value: AppConfig[K]) => void] {
  const value = useConfigStore((s) => s.config[key])
  const setValue = useCallback(
    (newValue: AppConfig[K]) => useConfigStore.getState().set(key, newValue),
    [key]
  )
  return [value, setValue]
}
```

简化为 `[value, setValue]`——原 plan 的 `value ?? defaultValue ?? store.config[key]` 第三个 fallback 等于第一个，逻辑无意义；getValue 也没有真实使用场景，删掉。

- [ ] **Step 6: Wire config store into main.tsx**

更新 `src/main.tsx`，加入 config store 的加载：

```typescript
import React from 'react'
import { createRoot } from 'react-dom/client'
import { HeroUIProvider } from '@heroui/react'
import App from './App'
import './styles/globals.css'
import { registerAllServices } from './services'
import { useConfigStore } from './stores/config_store'

async function bootstrap(): Promise<void> {
  registerAllServices()
  await useConfigStore.getState().loadConfig()

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HeroUIProvider>
        <App />
      </HeroUIProvider>
    </React.StrictMode>
  )
}

void bootstrap()
```

- [ ] **Step 7: Run store tests**

```bash
npx vitest run tests/unit/stores/test_translate_store.ts
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/stores/ src/hooks/ src/main.tsx tests/unit/stores/
git commit -m "feat: Zustand stores for config and translate state + useConfig hook"
```

---

### Task 13: Translate Window - SourceArea

**Files:**
- Create: `src/windows/translate/source_area.tsx`

- [ ] **Step 1: Implement SourceArea**

`src/windows/translate/source_area.tsx`:

```typescript
import React, { useCallback } from 'react'
import { Textarea, Button, Spacer, Chip } from '@heroui/react'
import { HiTranslate } from 'react-icons/hi'
import { MdContentCopy, MdSmartButton } from 'react-icons/md'
import { LuDelete } from 'react-icons/lu'
import { useTranslateStore } from '../../stores/translate_store'
import { useConfig } from '../../hooks/use_config'

interface SourceAreaProps {
  onTranslate: () => void
}

export function SourceArea({ onTranslate }: SourceAreaProps): React.ReactElement | null {
  const sourceText = useTranslateStore((s) => s.sourceText)
  const setSourceText = useTranslateStore((s) => s.setSourceText)
  const detectedLanguage = useTranslateStore((s) => s.detectedLanguage)
  const [hideSource] = useConfig('hide_source')

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onTranslate()
      }
    },
    [onTranslate]
  )

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(sourceText)
  }, [sourceText])

  const handleDeleteNewline = useCallback(() => {
    setSourceText(sourceText.replace(/-\s+/g, '').replace(/\s+/g, ' '))
  }, [sourceText, setSourceText])

  const handleClear = useCallback(() => {
    setSourceText('')
  }, [setSourceText])

  if (hideSource) return null

  return (
    <div className="flex flex-col p-2 gap-1">
      <div className="relative">
        <Textarea
          value={sourceText}
          onValueChange={setSourceText}
          onKeyDown={handleKeyDown}
          placeholder="Enter text to translate..."
          minRows={2}
          maxRows={6}
          variant="bordered"
          classNames={{ input: 'text-sm' }}
        />
        {detectedLanguage && (
          <Chip size="sm" color="primary" variant="flat" className="absolute top-1 right-1">
            {detectedLanguage}
          </Chip>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button isIconOnly size="sm" variant="light" onPress={onTranslate}>
          <HiTranslate className="text-lg" />
        </Button>
        <Button isIconOnly size="sm" variant="light" onPress={handleCopy} isDisabled={!sourceText}>
          <MdContentCopy className="text-lg" />
        </Button>
        <Button isIconOnly size="sm" variant="light" onPress={handleDeleteNewline} isDisabled={!sourceText}>
          <MdSmartButton className="text-lg" />
        </Button>
        <Spacer x={1} />
        <Button isIconOnly size="sm" variant="light" onPress={handleClear} isDisabled={!sourceText}>
          <LuDelete className="text-lg" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/windows/translate/source_area.tsx
git commit -m "feat: SourceArea component for translate window"
```

---

### Task 14: Translate Window - LanguageArea

**Files:**
- Create: `src/windows/translate/language_area.tsx`

- [ ] **Step 1: Implement LanguageArea**

`src/windows/translate/language_area.tsx`:

```typescript
import React from 'react'
import { Select, SelectItem, Button } from '@heroui/react'
import { BiTransferAlt } from 'react-icons/bi'
import { useTranslateStore } from '../../stores/translate_store'
import { LANGUAGE_CODES, LANGUAGE_NAMES } from '@shared/types/language'
import type { LanguageCode } from '@shared/types/language'

const SOURCE_LANGUAGES = ['auto', ...LANGUAGE_CODES.filter((c) => c !== 'auto')]
const TARGET_LANGUAGES = LANGUAGE_CODES.filter((c) => c !== 'auto')

export function LanguageArea(): React.ReactElement {
  const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
  const targetLanguage = useTranslateStore((s) => s.targetLanguage)
  const setSourceLanguage = useTranslateStore((s) => s.setSourceLanguage)
  const setTargetLanguage = useTranslateStore((s) => s.setTargetLanguage)
  const swapLanguages = useTranslateStore((s) => s.swapLanguages)

  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <Select
        size="sm"
        selectedKeys={[sourceLanguage]}
        onChange={(e) => setSourceLanguage(e.target.value as LanguageCode)}
        className="flex-1"
        aria-label="Source language"
      >
        {SOURCE_LANGUAGES.map((code) => (
          <SelectItem key={code} value={code}>
            {LANGUAGE_NAMES[code]}
          </SelectItem>
        ))}
      </Select>
      <Button isIconOnly size="sm" variant="light" onPress={swapLanguages}>
        <BiTransferAlt className="text-lg" />
      </Button>
      <Select
        size="sm"
        selectedKeys={[targetLanguage]}
        onChange={(e) => setTargetLanguage(e.target.value as LanguageCode)}
        className="flex-1"
        aria-label="Target language"
      >
        {TARGET_LANGUAGES.map((code) => (
          <SelectItem key={code} value={code}>
            {LANGUAGE_NAMES[code]}
          </SelectItem>
        ))}
      </Select>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/windows/translate/language_area.tsx
git commit -m "feat: LanguageArea component with source/target selectors"
```

---

### Task 15: Translate Window - TargetArea

**Files:**
- Create: `src/windows/translate/target_area.tsx`

- [ ] **Step 1: Implement TargetArea**

`src/windows/translate/target_area.tsx`:

```typescript
import React, { useCallback } from 'react'
import { Card, CardBody, CardHeader, Button, Textarea, Spinner } from '@heroui/react'
import { MdContentCopy } from 'react-icons/md'
import { TbTransformFilled } from 'react-icons/tb'
import { useTranslateStore } from '../../stores/translate_store'
import { translateServiceRegistry } from '../../services/registry'
import { getServiceKey } from '@shared/types/service'
import type { DictResult } from '@shared/types/service'

interface TargetAreaProps {
  serviceList: string[]
  onRetry?: (instanceKey: string) => void
}

export function TargetArea({ serviceList, onRetry }: TargetAreaProps): React.ReactElement {
  const results = useTranslateStore((s) => s.results)
  const isTranslating = useTranslateStore((s) => s.isTranslating)
  const setSourceText = useTranslateStore((s) => s.setSourceText)

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
  }, [])

  const handleReverseTranslate = useCallback(
    (text: string) => {
      setSourceText(text)
    },
    [setSourceText]
  )

  const renderResult = (instanceKey: string) => {
    const result = results[instanceKey]
    const serviceKey = getServiceKey(instanceKey)
    const service = translateServiceRegistry.get(serviceKey)

    if (isTranslating && result === undefined) {
      return <Spinner size="sm" color="primary" />
    }

    if (result === null) {
      return <p className="text-danger text-xs">Translation failed</p>
    }

    if (result === undefined) {
      return null
    }

    if (typeof result === 'string') {
      return (
        <>
          <Textarea
            isReadOnly
            value={result}
            variant="flat"
            minRows={1}
            maxRows={4}
            classNames={{ input: 'text-sm' }}
          />
          <div className="flex items-center gap-1 mt-1">
            <Button isIconOnly size="sm" variant="light" onPress={() => handleCopy(result)}>
              <MdContentCopy className="text-base" />
            </Button>
            <Button isIconOnly size="sm" variant="light" onPress={() => handleReverseTranslate(result)}>
              <TbTransformFilled className="text-base" />
            </Button>
          </div>
        </>
      )
    }

    // DictResult
    const dict = result as DictResult
    return (
      <div className="text-sm">
        {dict.definitions.map((def, i) => (
          <div key={i}>
            <span className="text-primary font-bold">{def.partOfSpeech}</span>{' '}
            {def.meanings.join('; ')}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-2 overflow-y-auto" style={{ maxHeight: '300px' }}>
      {serviceList.map((instanceKey) => {
        const serviceKey = getServiceKey(instanceKey)
        const service = translateServiceRegistry.get(serviceKey)
        if (!service) return null

        return (
          <Card key={instanceKey} variant="bordered" className="shadow-none">
            <CardHeader className="flex justify-between px-3 py-1">
              <span className="text-xs font-semibold">{service.name}</span>
            </CardHeader>
            <CardBody className="px-3 py-2">
              {renderResult(instanceKey)}
            </CardBody>
          </Card>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/windows/translate/target_area.tsx
git commit -m "feat: TargetArea component with result cards for each service"
```

---

### Task 16: Translate Window Assembly

**Files:**
- Create: `src/windows/translate/index.tsx`

- [ ] **Step 1: Assemble translate window**

`src/windows/translate/index.tsx`:

```typescript
import React, { useCallback, useEffect } from 'react'
import { Button } from '@heroui/react'
import { BsPinFill } from 'react-icons/bs'
import { AiFillCloseCircle } from 'react-icons/ai'
import { SourceArea } from './source_area'
import { LanguageArea } from './language_area'
import { TargetArea } from './target_area'
import { useTranslateStore } from '../../stores/translate_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { getServiceKey } from '@shared/types/service'

export default function TranslateWindow(): React.ReactElement {
  const sourceText = useTranslateStore((s) => s.sourceText)
  const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
  const targetLanguage = useTranslateStore((s) => s.targetLanguage)
  const setIsTranslating = useTranslateStore((s) => s.setIsTranslating)
  const setResult = useTranslateStore((s) => s.setResult)
  const clearResults = useTranslateStore((s) => s.clearResults)

  const serviceList = useConfigStore((s) => s.config.translate_service_list)
  const serviceInstances = useConfigStore((s) => s.config.service_instances)
  const alwaysOnTop = useConfigStore((s) => s.config.translate_always_on_top)
  const closeOnBlur = useConfigStore((s) => s.config.translate_close_on_blur)

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) return

    setIsTranslating(true)
    clearResults()

    const promises = serviceList.map(async (instanceKey) => {
      const serviceKey = getServiceKey(instanceKey)
      const service = translateServiceRegistry.get(serviceKey)
      if (!service) {
        setResult(instanceKey, null)
        return
      }
      const instanceConfig = serviceInstances[instanceKey]?.config ?? {}

      try {
        const result = await service.translate(
          sourceText,
          sourceLanguage,
          targetLanguage,
          instanceConfig
        )
        setResult(instanceKey, result)
      } catch {
        setResult(instanceKey, null)
      }
    })

    await Promise.allSettled(promises)
    setIsTranslating(false)
  }, [sourceText, sourceLanguage, targetLanguage, serviceList, serviceInstances, setIsTranslating, setResult, clearResults])

  // Close on blur
  useEffect(() => {
    if (!closeOnBlur) return
    const handleBlur = () => window.electronAPI.window.close()
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [closeOnBlur])

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.electronAPI.window.close()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleClose = useCallback(() => window.electronAPI.window.close(), [])

  return (
    <div className="flex flex-col h-screen select-none" style={{ fontSize: 16 }}>
      {/* Top bar */}
      <div className="flex justify-between items-center px-2 py-1 drag-region">
        <Button
          isIconOnly
          size="sm"
          variant="light"
          color={alwaysOnTop ? 'primary' : 'default'}
          onPress={() => window.electronAPI.window.setAlwaysOnTop(!alwaysOnTop)}
        >
          <BsPinFill />
        </Button>
        <Button isIconOnly size="sm" variant="light" onPress={handleClose}>
          <AiFillCloseCircle />
        </Button>
      </div>

      <SourceArea onTranslate={handleTranslate} />
      <LanguageArea />
      <TargetArea serviceList={serviceList} />
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx electron-vite build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/windows/translate/index.tsx
git commit -m "feat: translate window assembly with translate workflow"
```

---

### Task 17: Config Window - Shell + General + Translate Pages

**Files:**
- Create: `src/windows/config/index.tsx`
- Create: `src/windows/config/general.tsx`
- Create: `src/windows/config/translate_settings.tsx`

- [ ] **Step 1: Implement config window shell**

`src/windows/config/index.tsx`:

```typescript
import React, { useState } from 'react'
import { Button } from '@heroui/react'
import { AiFillAppstore } from 'react-icons/ai'
import { PiTranslateFill } from 'react-icons/pi'
import GeneralPage from './general'
import TranslatePage from './translate_settings'

type ConfigPage = 'general' | 'translate'

export default function ConfigWindow(): React.ReactElement {
  const [activePage, setActivePage] = useState<ConfigPage>('general')

  const pages: { key: ConfigPage; label: string; icon: React.ReactNode }[] = [
    { key: 'general', label: 'General', icon: <AiFillAppstore /> },
    { key: 'translate', label: 'Translate', icon: <PiTranslateFill /> }
  ]

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-[230px] border-r flex flex-col p-3 gap-1">
        <h2 className="text-lg font-bold mb-3 px-2">Pot</h2>
        {pages.map(({ key, label, icon }) => (
          <Button
            key={key}
            variant={activePage === key ? 'flat' : 'light'}
            color={activePage === key ? 'primary' : 'default'}
            startContent={icon}
            className="justify-start"
            onPress={() => setActivePage(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activePage === 'general' && <GeneralPage />}
        {activePage === 'translate' && <TranslatePage />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement General page**

`src/windows/config/general.tsx`:

```typescript
import React from 'react'
import { Card, CardBody, Switch, Select, SelectItem, Input } from '@heroui/react'
import { useConfig } from '../../hooks/use_config'

const THEME_OPTIONS = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' }
]

const FONT_SIZE_OPTIONS = [10, 12, 14, 16, 18, 20, 24]

export default function GeneralPage(): React.ReactElement {
  const [appLanguage, setAppLanguage] = useConfig('app_language')
  const [appTheme, setAppTheme] = useConfig('app_theme')
  const [fontSize, setFontSize] = useConfig('app_font_size')
  const [transparent, setTransparent] = useConfig('transparent')
  const [devMode, setDevMode] = useConfig('dev_mode')
  const [checkUpdate, setCheckUpdate] = useConfig('check_update')
  const [serverPort, setServerPort] = useConfig('server_port')

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xl font-bold">General</h3>

      <Card>
        <CardBody className="gap-3 p-4">
          <h4 className="font-semibold">App Settings</h4>
          <Switch isSelected={checkUpdate} onValueChange={setCheckUpdate}>
            Check for updates on startup
          </Switch>
          <Input
            label="Server Port"
            type="number"
            value={String(serverPort)}
            onChange={(e) => setServerPort(Number(e.target.value))}
            min={0}
            max={65535}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="gap-3 p-4">
          <h4 className="font-semibold">Appearance</h4>
          <Select
            label="Theme"
            selectedKeys={[appTheme]}
            onChange={(e) => setAppTheme(e.target.value as 'system' | 'light' | 'dark')}
          >
            {THEME_OPTIONS.map((opt) => (
              <SelectItem key={opt.key}>{opt.label}</SelectItem>
            ))}
          </Select>
          <Select
            label="Font Size"
            selectedKeys={[String(fontSize)]}
            onChange={(e) => setFontSize(Number(e.target.value))}
          >
            {FONT_SIZE_OPTIONS.map((size) => (
              <SelectItem key={String(size)}>{size}px</SelectItem>
            ))}
          </Select>
          <Switch isSelected={transparent} onValueChange={setTransparent}>
            Transparent background
          </Switch>
          <Switch isSelected={devMode} onValueChange={setDevMode}>
            Developer mode (F12)
          </Switch>
        </CardBody>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Implement Translate Settings page**

`src/windows/config/translate_settings.tsx`:

```typescript
import React from 'react'
import { Card, CardBody, Switch, Select, SelectItem } from '@heroui/react'
import { useConfig } from '../../hooks/use_config'
import { LANGUAGE_CODES, LANGUAGE_NAMES } from '@shared/types/language'

const TARGET_LANGUAGES = LANGUAGE_CODES.filter((c) => c !== 'auto')
const ALL_LANGUAGES = LANGUAGE_CODES

const AUTO_COPY_OPTIONS = [
  { key: 'disable', label: 'Disable' },
  { key: 'source', label: 'Source text' },
  { key: 'target', label: 'Target text' },
  { key: 'source_target', label: 'Source + Target' }
]

const DETECT_ENGINES = [
  { key: 'bing', label: 'Bing' },
  { key: 'google', label: 'Google' },
  { key: 'local', label: 'Local (offline)' }
]

export default function TranslatePage(): React.ReactElement {
  const [sourceLang, setSourceLang] = useConfig('translate_source_language')
  const [targetLang, setTargetLang] = useConfig('translate_target_language')
  const [secondLang, setSecondLang] = useConfig('translate_second_language')
  const [detectEngine, setDetectEngine] = useConfig('translate_detect_engine')
  const [autoCopy, setAutoCopy] = useConfig('translate_auto_copy')
  const [deleteNewline, setDeleteNewline] = useConfig('translate_delete_newline')
  const [incremental, setIncremental] = useConfig('incremental_translate')
  const [closeOnBlur, setCloseOnBlur] = useConfig('translate_close_on_blur')
  const [alwaysOnTop, setAlwaysOnTop] = useConfig('translate_always_on_top')
  const [hideSource, setHideSource] = useConfig('hide_source')
  const [hideLanguage, setHideLanguage] = useConfig('hide_language')

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xl font-bold">Translate</h3>

      <Card>
        <CardBody className="gap-3 p-4">
          <h4 className="font-semibold">Language</h4>
          <Select
            label="Source Language"
            selectedKeys={[sourceLang]}
            onChange={(e) => setSourceLang(e.target.value as string)}
          >
            {ALL_LANGUAGES.map((code) => (
              <SelectItem key={code}>{LANGUAGE_NAMES[code]}</SelectItem>
            ))}
          </Select>
          <Select
            label="Target Language"
            selectedKeys={[targetLang]}
            onChange={(e) => setTargetLang(e.target.value as string)}
          >
            {TARGET_LANGUAGES.map((code) => (
              <SelectItem key={code}>{LANGUAGE_NAMES[code]}</SelectItem>
            ))}
          </Select>
          <Select
            label="Second Language"
            selectedKeys={[secondLang]}
            onChange={(e) => setSecondLang(e.target.value as string)}
          >
            {TARGET_LANGUAGES.map((code) => (
              <SelectItem key={code}>{LANGUAGE_NAMES[code]}</SelectItem>
            ))}
          </Select>
          <Select
            label="Detect Engine"
            selectedKeys={[detectEngine]}
            onChange={(e) => setDetectEngine(e.target.value as string)}
          >
            {DETECT_ENGINES.map((opt) => (
              <SelectItem key={opt.key}>{opt.label}</SelectItem>
            ))}
          </Select>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="gap-3 p-4">
          <h4 className="font-semibold">Behavior</h4>
          <Select
            label="Auto Copy"
            selectedKeys={[autoCopy]}
            onChange={(e) => setAutoCopy(e.target.value as 'disable' | 'source' | 'target' | 'source_target')}
          >
            {AUTO_COPY_OPTIONS.map((opt) => (
              <SelectItem key={opt.key}>{opt.label}</SelectItem>
            ))}
          </Select>
          <Switch isSelected={deleteNewline} onValueChange={setDeleteNewline}>
            Delete newlines
          </Switch>
          <Switch isSelected={incremental} onValueChange={setIncremental}>
            Incremental translate
          </Switch>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="gap-3 p-4">
          <h4 className="font-semibold">Window</h4>
          <Switch isSelected={closeOnBlur} onValueChange={setCloseOnBlur}>
            Close on blur
          </Switch>
          <Switch isSelected={alwaysOnTop} onValueChange={setAlwaysOnTop}>
            Always on top
          </Switch>
          <Switch isSelected={hideSource} onValueChange={setHideSource}>
            Hide source text
          </Switch>
          <Switch isSelected={hideLanguage} onValueChange={setHideLanguage}>
            Hide language selector
          </Switch>
        </CardBody>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
npx electron-vite build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/windows/config/
git commit -m "feat: config window with general and translate settings pages"
```

---

### Task 18: i18n Setup

**Files:**
- Create: `src/i18n/index.ts`
- Create: `src/i18n/locales/en.json`
- Create: `src/i18n/locales/zh_cn.json`

- [ ] **Step 1: Write i18n init**

`src/i18n/index.ts`:

```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import zhCn from './locales/zh_cn.json'
import { useConfigStore } from '../stores/config_store'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh_cn: { translation: zhCn }
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
})

// 启动后跟随 app_language 配置变化
export function bindI18nToConfig(): void {
  const apply = (lang: string): void => {
    if (i18n.language !== lang) i18n.changeLanguage(lang)
  }
  apply(useConfigStore.getState().config.app_language)
  useConfigStore.subscribe((state, prev) => {
    if (state.config.app_language !== prev.config.app_language) {
      apply(state.config.app_language)
    }
  })
}

export default i18n
```

加 `bindI18nToConfig`：在 renderer 加载完配置后调用，让 i18n 跟随 `app_language` 联动；原 plan 写死 `lng: 'en'`，用户在 config 改语言不生效，是 bug。

- [ ] **Step 2: Write English locale**

`src/i18n/locales/en.json`:

```json
{
  "app_name": "Pot",
  "general": "General",
  "translate": "Translate",
  "recognize": "Recognize",
  "hotkey": "Hotkeys",
  "service": "Services",
  "history": "History",
  "backup": "Backup",
  "about": "About",
  "source_placeholder": "Enter text to translate...",
  "close": "Close",
  "minimize": "Minimize",
  "maximize": "Maximize",
  "pin": "Pin",
  "unpin": "Unpin",
  "copy": "Copy",
  "translate_button": "Translate",
  "swap_languages": "Swap Languages",
  "source_language": "Source Language",
  "target_language": "Target Language",
  "auto_detect": "Auto Detect",
  "settings": {
    "check_update": "Check for updates on startup",
    "server_port": "Server Port",
    "theme": "Theme",
    "font_size": "Font Size",
    "transparent": "Transparent background",
    "dev_mode": "Developer mode (F12)",
    "delete_newline": "Delete newlines",
    "incremental_translate": "Incremental translate",
    "close_on_blur": "Close on blur",
    "always_on_top": "Always on top",
    "hide_source": "Hide source text",
    "hide_language": "Hide language selector"
  }
}
```

- [ ] **Step 3: Write Chinese locale**

`src/i18n/locales/zh_cn.json`:

```json
{
  "app_name": "Pot",
  "general": "通用",
  "translate": "翻译",
  "recognize": "识别",
  "hotkey": "快捷键",
  "service": "服务",
  "history": "历史记录",
  "backup": "备份",
  "about": "关于",
  "source_placeholder": "输入要翻译的文本...",
  "close": "关闭",
  "minimize": "最小化",
  "maximize": "最大化",
  "pin": "固定",
  "unpin": "取消固定",
  "copy": "复制",
  "translate_button": "翻译",
  "swap_languages": "交换语言",
  "source_language": "源语言",
  "target_language": "目标语言",
  "auto_detect": "自动检测",
  "settings": {
    "check_update": "启动时检查更新",
    "server_port": "服务器端口",
    "theme": "主题",
    "font_size": "字号",
    "transparent": "透明背景",
    "dev_mode": "开发者模式 (F12)",
    "delete_newline": "删除换行",
    "incremental_translate": "增量翻译",
    "close_on_blur": "失焦关闭",
    "always_on_top": "始终置顶",
    "hide_source": "隐藏源文本",
    "hide_language": "隐藏语言选择器"
  }
}
```

- [ ] **Step 4: Wire i18n into main.tsx**

更新 `src/main.tsx`，加入 i18n import 和 bindI18nToConfig 调用：

```typescript
import React from 'react'
import { createRoot } from 'react-dom/client'
import { HeroUIProvider } from '@heroui/react'
import App from './App'
import './styles/globals.css'
import { registerAllServices } from './services'
import { useConfigStore } from './stores/config_store'
import i18n, { bindI18nToConfig } from './i18n'

async function bootstrap(): Promise<void> {
  registerAllServices()
  await useConfigStore.getState().loadConfig()
  bindI18nToConfig()

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HeroUIProvider>
        <App />
      </HeroUIProvider>
    </React.StrictMode>
  )
}

void bootstrap()
```

- [ ] **Step 5: Commit**

```bash
git add src/i18n/ src/main.tsx
git commit -m "feat: i18n setup with English and Chinese locales"
```

---

### Task 19: System Tray

**Files:**
- Create: `electron/tray/index.ts`

- [ ] **Step 1: Implement system tray**

`electron/tray/index.ts`:

```typescript
import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { WindowLabel } from '../windows/types'
import type { WindowManager } from '../windows/manager'

let tray: Tray | null = null
let windowManager: WindowManager | null = null

export function setWindowManagerForTray(mgr: WindowManager): void {
  windowManager = mgr
}

function resolveIconPath(): string {
  // dev: __dirname = <repo>/out/main → 项目根 resources/icon.png
  // prod (asar): __dirname = .../app.asar/out/main → asar 内 resources/icon.png
  const candidates = [
    join(__dirname, '../../resources/icon.png'),
    join(process.resourcesPath ?? '', 'icon.png'),
    join(app.getAppPath(), 'resources/icon.png')
  ]
  return candidates.find((p) => p && existsSync(p)) ?? candidates[0]
}

export function createTray(): void {
  const iconPath = resolveIconPath()
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Pot Desktop')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Input Translate',
      click: () => {
        windowManager?.focusOrCreate(WindowLabel.TRANSLATE, {
          label: WindowLabel.TRANSLATE,
          width: 350,
          height: 420
        })
      }
    },
    { type: 'separator' },
    {
      label: 'Config',
      click: () => {
        windowManager?.focusOrCreate(WindowLabel.CONFIG, {
          label: WindowLabel.CONFIG,
          width: 800,
          height: 600,
          minWidth: 800,
          minHeight: 400
        })
      }
    },
    { type: 'separator' },
    {
      label: 'Restart',
      click: () => {
        app.relaunch()
        app.exit(0)
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
```

- [ ] **Step 2: Wire tray into main.ts**

Update `electron/main.ts` — replace the simple `createTray()` call:

```typescript
import { createTray, setWindowManagerForTray } from './tray'

// In app.whenReady().then(() => { ... }):
setWindowManagerForTray(windowManager)
createTray()
```

- [ ] **Step 3: Verify build**

```bash
npx electron-vite build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add electron/tray/
git commit -m "feat: system tray with input translate, config, restart, quit"
```

---

### Task 20: Global Hotkeys

**Files:**
- Replace: `electron/hotkey/index.ts`（覆盖 Task 3/5 的 stub）

> Task 5 的 IPC handler 已经按 `buildHotkeyAction(name, manager)` 调用 hotkey 模块；本 task 只是把 stub 替换为真实实现。**不再修改 main.ts 或 IPC handler 签名**——一开始就定型，避免类型不一致。

- [ ] **Step 1: Implement global hotkey module**

`electron/hotkey/index.ts`:

```typescript
import { globalShortcut } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { getConfig } from '../config/store'
import type { ConfigKey } from '@shared/types/config'

let windowManager: WindowManager | null = null

export function setWindowManagerForHotkey(mgr: WindowManager): void {
  windowManager = mgr
}

const TRANSLATE_OPTS = {
  label: WindowLabel.TRANSLATE,
  width: 350,
  height: 420
} as const

export function buildHotkeyAction(name: string, mgr: WindowManager): () => void {
  switch (name) {
    case 'hotkey_input_translate':
      return () => mgr.focusOrCreate(WindowLabel.TRANSLATE, TRANSLATE_OPTS)
    case 'hotkey_selection_translate':
      // P1：通过剪贴板兜底（用户复制后再触发热键）；原生选区抓取在 P2/P4 接入
      return () => {
        const win = mgr.focusOrCreate(WindowLabel.TRANSLATE, TRANSLATE_OPTS)
        win.webContents.send('translate:from-selection')
      }
    case 'hotkey_ocr_recognize':
    case 'hotkey_ocr_translate':
      // OCR 在 P2 实现
      return () => {}
    default:
      return () => {}
  }
}

export function registerHotkey(
  name: string,
  shortcut: string,
  action: () => void
): boolean {
  if (globalShortcut.isRegistered(shortcut)) {
    globalShortcut.unregister(shortcut)
  }
  return globalShortcut.register(shortcut, action)
}

export function unregisterHotkey(shortcut: string): void {
  if (globalShortcut.isRegistered(shortcut)) {
    globalShortcut.unregister(shortcut)
  }
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll()
}

const HOTKEY_KEYS: ConfigKey[] = [
  'hotkey_selection_translate',
  'hotkey_input_translate',
  'hotkey_ocr_recognize',
  'hotkey_ocr_translate'
]

export function registerGlobalShortcutsFromConfig(): void {
  if (!windowManager) return
  for (const name of HOTKEY_KEYS) {
    const shortcut = String(getConfig(name) ?? '')
    if (!shortcut) continue
    registerHotkey(name, shortcut, buildHotkeyAction(name, windowManager))
  }
}
```

要点：
- 没有空壳函数（删除原 `setupSelectionTranslate` / `setupInputTranslate` 占位符）。
- `buildHotkeyAction` 是同步的纯函数 → IPC handler 和启动时都能复用。
- `registerGlobalShortcutsFromConfig` 启动时一次性把配置里有值的快捷键全注册。
- `translate:from-selection` 事件由 renderer 端在 P2 接入剪贴板/选区读取逻辑；P1 不实现选区抓取，但事件契约已经定下。

- [ ] **Step 2: Verify full build**

```bash
npx electron-vite build
```

Expected: Build 成功。

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass（网络相关的 it.skipIf 不开 RUN_NETWORK_TESTS 时跳过）。

- [ ] **Step 4: Commit**

```bash
git add electron/hotkey/index.ts
git commit -m "feat: global hotkey actions for input/selection translate, registered from config"
```

---

### Task 21: Dev Run + Smoke Test

> **WSL 注意：** 在 WSL2 内启动 Electron GUI 需要 WSLg（Windows 11 + WSL ≥ 0.65）。如果 `wslg` 不可用，会得到 `Failed to connect to display` 错误——此时改在原生 Linux/Windows 桌面运行 dev 服务器，或用 X server（如 VcXsrv）+ `DISPLAY` 环境变量。

- [ ] **Step 1: Start dev server**

```bash
npx electron-vite dev
```

Expected: Electron window opens. Based on first-run detection, either config window or translate window appears.

- [ ] **Step 2: Verify translate window**

1. Type text in the SourceArea
2. Press Enter or click translate button
3. Verify that Bing, Google, and DeepL result cards appear
4. Click copy button on a result
5. Click swap languages button
6. Click pin/unpin button

- [ ] **Step 3: Verify config window**

1. Open config via tray menu
2. Change theme between light/dark/system
3. Change font size
4. Toggle "Close on blur" switch
5. Switch to Translate tab
6. Change source/target languages

- [ ] **Step 4: Verify system tray**

1. Right-click tray icon
2. Verify menu items appear
3. Click "Config" → config window opens
4. Click "Quit" → app exits

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: P1 complete - app shell, translate core, 3 services, config, tray, hotkeys"
```
