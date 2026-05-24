# 翻译窗口尺寸与滚动改造 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改造翻译窗口的尺寸、滚动与可调性:输入区固定在窗口顶部、结果区按引擎返回分次扩张、超出 75vh 时仅结果区滚动、高度由主进程锁定、宽度用户可拖(只限最小宽 360px)。

**Architecture:** 渲染端通过新的专属 IPC `translate:report-content-height` 上报内容自然高度;主进程依据当前显示器 `workArea.height * 0.75` 计算 `target_h`,通过 `setMinimumSize`/`setMaximumSize` 同值锁定高度、用 0 表示宽度无上界,通过 `setBounds` 应用高度。原有通用 `window:setContentHeight` 保留给其他窗口不动。

**Tech Stack:** Electron 39 BrowserWindow / screen API、React 19 + ResizeObserver、TypeScript 6、Vitest 单元、Playwright e2e。

**Spec:** `docs/superpowers/specs/2026-05-24-translate-window-resize-design.md`

---

## File Structure

### 新增文件

- `electron/windows/translate_height_controller.ts` — 主进程翻译窗口高度管控:`compute_target_height` 纯函数 + `TranslateHeightController` 类(绑定窗口生命周期、监听 move/display-metrics-changed、应用 setMinimumSize/setMaximumSize/setBounds)。
- `tests/unit/windows/translate_height_controller.test.ts` — `compute_target_height` 单元测试。
- `tests/user_e2e/specs/translate_window_resize.spec.ts` — 新增 e2e 测试套件。

### 修改文件

- `electron/windows/translate_options.ts` — 改最小宽 360、删 maxHeight 上限、删 minHeight 上限、初始高度改小、停止用 config 还原 height。
- `electron/windows/manager.ts` — 翻译窗口 resize 持久化只保存 width;创建翻译窗口时实例化 `TranslateHeightController`。
- `electron/ipc/window_handlers.ts` — 新增 `translate:report-content-height` handler;**不修改** `window:setContentHeight`。
- `electron/preload.ts` — 新增 `electronAPI.translate.reportContentHeight(height)` 绑定。
- `shared/types/ipc.ts` — 新增 `translate` namespace 类型 `{ reportContentHeight(height: number): Promise<void> }`。
- `src/windows/translate/index.tsx` — 重构布局结构(flex column / 100vh / ResultsScroll 包裹结果区);把 fit_height 改为只上报内容高度的 ResizeObserver。
- `src/windows/translate/target_area.tsx` — 容器去掉 `overflow:auto`(交给外层 ResultsScroll);保证卡片宽度 100%。
- `src/styles/index.css`(或现存全局样式) — 新增 `.thin-scroll` 工具类。
- `tests/user_e2e/specs/translate_window_constraints.spec.ts` — 改用新 IPC stub,删 maxHeight 假设。
- `docs/spec.md` — 翻译窗口章节同步窗口尺寸/滚动/可调性约束。
- `TASKS.md` — 记录本次改造完成状态。

### 不改动

- `window:setContentHeight` / `window:setContentSize` IPC handler 本体(保留给其他窗口)。
- 词典窗口、识别窗口、配置窗口的尺寸策略。

---

## Constants

写入 `electron/windows/translate_height_controller.ts` 顶部(并 `export`):

```ts
export const TRANSLATE_MIN_WIDTH = 360
export const TRANSLATE_MAX_HEIGHT_RATIO = 0.75
export const TRANSLATE_HEIGHT_REPORT_DEBOUNCE_PX = 1
export const TRANSLATE_SCREEN_MOVE_DEBOUNCE_MS = 100
```

渲染端 textarea 行数限制保持现有 `source_area.tsx` 的 8 行逻辑,不动。

---

## Task 1: 全局滚动条样式 `.thin-scroll`

**Files:**
- Modify: `src/styles/index.css`(或 `src/index.css`,以仓库实际入口为准;若不存在则定位到 `src/main.tsx` 引入的样式入口)

- [ ] **Step 1: 找到全局样式入口**

Run: `grep -rn "@tailwind\|@import" src/ --include="*.css" | head -5`
Expected: 输出全局样式文件路径(例如 `src/styles/index.css`)。把该路径填入下方 Step 2。

- [ ] **Step 2: 追加 `.thin-scroll` 工具类**

在文件末尾追加:

```css
.thin-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.thin-scroll::-webkit-scrollbar-track { background: transparent; }
.thin-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}
.thin-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.30);
}
```

- [ ] **Step 3: 验证编译通过**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/styles/index.css
git commit -m "feat(translate): 新增 .thin-scroll 全局滚动条样式工具类"
```

---

## Task 2: 主进程纯函数 `compute_target_height` + 单元测试

**Files:**
- Create: `electron/windows/translate_height_controller.ts`
- Create: `tests/unit/windows/translate_height_controller.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `tests/unit/windows/translate_height_controller.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { compute_target_height } from '../../../electron/windows/translate_height_controller'

describe('compute_target_height', () => {
    it('returns content height when within bounds', () => {
        expect(compute_target_height(500, 1080, 100)).toBe(500)
    })

    it('clamps to min when content height is below min', () => {
        expect(compute_target_height(50, 1080, 100)).toBe(100)
    })

    it('clamps to max (75% of work area) when content exceeds it', () => {
        // 1080 * 0.75 = 810
        expect(compute_target_height(2000, 1080, 100)).toBe(810)
    })

    it('floors the max so it never exceeds integer pixels', () => {
        // 1079 * 0.75 = 809.25 → floor = 809
        expect(compute_target_height(2000, 1079, 100)).toBe(809)
    })

    it('returns min when both content and max are below min', () => {
        // 100 * 0.75 = 75, but min=100 wins
        expect(compute_target_height(50, 100, 100)).toBe(100)
    })

    it('rounds content height to integer', () => {
        expect(compute_target_height(500.7, 1080, 100)).toBe(501)
    })
})
```

- [ ] **Step 2: 运行,确认失败**

Run: `npx vitest run tests/unit/windows/translate_height_controller.test.ts`
Expected: FAIL — 模块未找到 / `compute_target_height` 未定义。

- [ ] **Step 3: 实现纯函数**

新建 `electron/windows/translate_height_controller.ts`(此 task 只放纯函数部分,类放 Task 3):

```ts
export const TRANSLATE_MIN_WIDTH = 360
export const TRANSLATE_MAX_HEIGHT_RATIO = 0.75
export const TRANSLATE_HEIGHT_REPORT_DEBOUNCE_PX = 1
export const TRANSLATE_SCREEN_MOVE_DEBOUNCE_MS = 100

export function compute_target_height(
    content_height: number,
    work_area_height: number,
    min_height: number,
): number {
    const max_height = Math.floor(work_area_height * TRANSLATE_MAX_HEIGHT_RATIO)
    const rounded = Math.round(content_height)
    if (rounded > max_height) return Math.max(min_height, max_height)
    if (rounded < min_height) return min_height
    return rounded
}
```

- [ ] **Step 4: 跑测试,确认通过**

Run: `npx vitest run tests/unit/windows/translate_height_controller.test.ts`
Expected: PASS 全部 6 个用例。

- [ ] **Step 5: Commit**

```bash
git add electron/windows/translate_height_controller.ts tests/unit/windows/translate_height_controller.test.ts
git commit -m "feat(translate): 新增 compute_target_height 与翻译窗口高度常量"
```

---

## Task 3: `TranslateHeightController` 类(主进程)

**Files:**
- Modify: `electron/windows/translate_height_controller.ts`

- [ ] **Step 1: 在同文件追加 controller 实现**

在 `compute_target_height` 后追加:

```ts
import { screen, type BrowserWindow, type Display } from 'electron'

interface ControllerOptions {
    initial_min_height: number
}

export class TranslateHeightController {
    private win: BrowserWindow
    private min_height: number
    private current_target_h: number
    private move_timer: ReturnType<typeof setTimeout> | null = null
    private last_reported_h = 0
    private disposed = false

    constructor(win: BrowserWindow, opts: ControllerOptions) {
        this.win = win
        this.min_height = opts.initial_min_height
        this.current_target_h = opts.initial_min_height
        this.apply_locked_height(this.current_target_h)

        win.on('move', this.on_move)
        win.on('restore', this.on_restore)
        screen.on('display-metrics-changed', this.on_display_metrics)
        win.once('closed', this.dispose)
    }

    /** Renderer 上报内容自然高度时调用 */
    report_content_height(content_height: number): void {
        if (this.disposed || this.win.isDestroyed()) return
        const rounded = Math.round(content_height)
        if (Math.abs(rounded - this.last_reported_h) < TRANSLATE_HEIGHT_REPORT_DEBOUNCE_PX) return
        this.last_reported_h = rounded
        const work_area_h = this.current_display().workArea.height
        const target_h = compute_target_height(rounded, work_area_h, this.min_height)
        if (target_h === this.current_target_h) return
        this.current_target_h = target_h
        this.apply_locked_height(target_h)
    }

    private apply_locked_height(h: number): void {
        if (this.win.isDestroyed()) return
        // setMinimumSize/setMaximumSize 同值 → 高度锁定;
        // 宽度上限传 0 表示 Electron 不限制最大宽。
        this.win.setMinimumSize(TRANSLATE_MIN_WIDTH, h)
        this.win.setMaximumSize(0, h)
        const bounds = this.win.getBounds()
        if (Math.abs(bounds.height - h) > 0) {
            this.win.setBounds({ ...bounds, height: h })
        }
    }

    private current_display(): Display {
        return screen.getDisplayMatching(this.win.getBounds())
    }

    private on_move = (): void => {
        if (this.move_timer) clearTimeout(this.move_timer)
        this.move_timer = setTimeout(() => {
            this.move_timer = null
            // 触发一次重算(基于已记录的 last_reported_h)
            if (this.last_reported_h > 0) {
                const work_area_h = this.current_display().workArea.height
                const target_h = compute_target_height(this.last_reported_h, work_area_h, this.min_height)
                if (target_h !== this.current_target_h) {
                    this.current_target_h = target_h
                    this.apply_locked_height(target_h)
                }
            }
        }, TRANSLATE_SCREEN_MOVE_DEBOUNCE_MS)
    }

    private on_restore = (): void => {
        // 恢复后重新应用高度锁
        this.apply_locked_height(this.current_target_h)
    }

    private on_display_metrics = (): void => {
        if (this.last_reported_h > 0) {
            const work_area_h = this.current_display().workArea.height
            const target_h = compute_target_height(this.last_reported_h, work_area_h, this.min_height)
            if (target_h !== this.current_target_h) {
                this.current_target_h = target_h
                this.apply_locked_height(target_h)
            }
        }
    }

    dispose = (): void => {
        if (this.disposed) return
        this.disposed = true
        if (this.move_timer) clearTimeout(this.move_timer)
        this.move_timer = null
        if (!this.win.isDestroyed()) {
            this.win.removeListener('move', this.on_move)
            this.win.removeListener('restore', this.on_restore)
        }
        screen.removeListener('display-metrics-changed', this.on_display_metrics)
    }
}
```

- [ ] **Step 2: 验证类型与构建**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add electron/windows/translate_height_controller.ts
git commit -m "feat(translate): 新增 TranslateHeightController 类(高度锁定/多屏重算)"
```

---

## Task 4: IPC 类型与 preload 绑定

**Files:**
- Modify: `shared/types/ipc.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: 扩展 IPC 类型**

打开 `shared/types/ipc.ts`,在 `electronAPI` 接口同级或内部追加 `translate` namespace。先 grep 找到现有 namespace 模式:

Run: `grep -n "history\|text\b\|window\b" shared/types/ipc.ts | head -20`
Expected: 看到现有 namespace 的声明位置(例如 `window: { ... }`、`history: { ... }`)。

在 `window` 同级追加(用与现有 namespace 一致的缩进/风格):

```ts
    translate: {
        reportContentHeight(height: number): Promise<void>
    }
```

- [ ] **Step 2: preload 注册同名绑定**

打开 `electron/preload.ts`,在 `window:` namespace 同级追加:

```ts
    translate: {
        reportContentHeight: (height: number) => ipcRenderer.invoke('translate:reportContentHeight', height),
    },
```

- [ ] **Step 3: 验证编译**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add shared/types/ipc.ts electron/preload.ts
git commit -m "feat(translate): 新增 translate:reportContentHeight IPC 类型与 preload 绑定"
```

---

## Task 5: 主进程 IPC handler 注册

**Files:**
- Modify: `electron/ipc/window_handlers.ts`
- Modify: `electron/windows/manager.ts`

- [ ] **Step 1: 在 manager.ts 注入 controller**

在 `electron/windows/manager.ts` 顶部 import:

```ts
import { TranslateHeightController } from './translate_height_controller'
```

新增私有字段:

```ts
private translate_height_controller: TranslateHeightController | null = null
```

在 `createWindow()` 内,`if (opts.label === WindowLabel.TRANSLATE) { win.setSize(...) }` 之后追加:

```ts
    if (opts.label === WindowLabel.TRANSLATE) {
        this.translate_height_controller?.dispose()
        this.translate_height_controller = new TranslateHeightController(win, {
            initial_min_height: opts.height,
        })
    }
```

在 `win.on('closed', ...)` 回调内部,WindowLabel.TRANSLATE 分支末尾追加 dispose:

```ts
        if (opts.label === WindowLabel.TRANSLATE) {
            setConfig('translate_pinned', false)
            setConfig('translate_always_on_top', false)
            this.translate_height_controller?.dispose()
            this.translate_height_controller = null
        }
```

新增 public getter,供 IPC handler 拿到 controller:

```ts
getTranslateHeightController(): TranslateHeightController | null {
    return this.translate_height_controller
}
```

- [ ] **Step 2: 在 window_handlers.ts 注册 handler**

打开 `electron/ipc/window_handlers.ts`,在文件末尾(最后一个 `ipcMain.handle` 之后、`}` 之前)追加:

```ts
  ipcMain.handle('translate:reportContentHeight', (event, height: number) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    const label = manager.getLabelById(win.id)
    if (label !== WindowLabel.TRANSLATE) return
    const controller = manager.getTranslateHeightController()
    controller?.report_content_height(height)
  })
```

确认 `WindowLabel` 已经在文件顶部 import。

- [ ] **Step 3: 验证编译**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add electron/ipc/window_handlers.ts electron/windows/manager.ts
git commit -m "feat(translate): 注册 translate:reportContentHeight handler 并绑定到翻译窗口"
```

---

## Task 6: 翻译窗口初始尺寸/可调性

**Files:**
- Modify: `electron/windows/translate_options.ts`
- Modify: `electron/windows/manager.ts`

- [ ] **Step 1: 改写 `get_translate_window_options`**

替换 `electron/windows/translate_options.ts` 全部内容为:

```ts
import type { BrowserWindow } from 'electron'
import { getConfig, setConfig } from '../config/store'
import { WindowLabel, type WindowOptions } from './types'
import { TRANSLATE_MIN_WIDTH } from './translate_height_controller'

const TRANSLATE_INITIAL_HEIGHT = 160  // 初始高度:语言条 + 单行输入 + 操作行
const TRANSLATE_DEFAULT_WIDTH = 430

export function get_translate_window_options(): WindowOptions {
    const remember_size = getConfig('translate_remember_window_size') as boolean
    const width = remember_size
        ? Math.max(TRANSLATE_MIN_WIDTH, getConfig('translate_window_width') as number)
        : TRANSLATE_DEFAULT_WIDTH
    return {
        label: WindowLabel.TRANSLATE,
        width,
        height: TRANSLATE_INITIAL_HEIGHT,
        minWidth: TRANSLATE_MIN_WIDTH,
        minHeight: TRANSLATE_INITIAL_HEIGHT,
        // maxHeight 由 TranslateHeightController 动态管理,不在 options 里固定
        resizable: true,
        alwaysOnTop: getConfig('translate_always_on_top') as boolean,
    }
}

// 旧 attach_translate_resize_persistence 已废弃:现在只持久化宽度,且逻辑在 manager.ts 内联。
```

- [ ] **Step 2: 更新 manager.ts 的尺寸持久化**

定位 `if (opts.label === WindowLabel.TRANSLATE)` 块内的 `persistSize` 逻辑(管 `translate_remember_window_size`),改为只持久化宽度:

```ts
    if (opts.label === WindowLabel.TRANSLATE) {
      if (getConfig('translate_remember_window_size') && !win.listenerCount('resize')) {
        const persistSize = debounce(() => {
          if (win.isDestroyed()) return
          const [w] = win.getSize()
          setConfig('translate_window_width', w)
        }, 300)
        win.on('resize', persistSize)
      }
    }
```

(注意:`translate_window_height` 配置字段保留以兼容已存档配置,但不再写入也不再读取作为初始高度。)

- [ ] **Step 3: 更新 `tests/unit/windows/window_options.test.ts` 期望**

打开该测试文件,找到 `expect(get_translate_window_options()).toMatchObject({ width: 710, height: 720 })`。改为:

```ts
expect(get_translate_window_options()).toMatchObject({ width: 710, height: 160 })
```

并确认其他断言中 `height: 720` 的引用同步改成 160 或删除——逐个 grep:

Run: `grep -n "translate.*height\|720\|160" tests/unit/windows/window_options.test.ts`
Expected: 把所有翻译窗口高度断言改为 160。

- [ ] **Step 4: 跑相关单元测试**

Run: `npx vitest run tests/unit/windows/window_options.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add electron/windows/translate_options.ts electron/windows/manager.ts tests/unit/windows/window_options.test.ts
git commit -m "feat(translate): 翻译窗口初始尺寸/最小宽 360/持久化只保留宽度"
```

---

## Task 7: 渲染端布局重构

**Files:**
- Modify: `src/windows/translate/index.tsx`

- [ ] **Step 1: 把 `#app` 改为受控的 flex 列布局**

定位 `index.tsx` 的 return JSX,把根 `<div ref={root_ref} className="op-window" ...>` 的 style 改为:

```tsx
<div
    ref={root_ref}
    className="op-window"
    style={{
        fontSize: appFontSize,
        fontFamily: appFont === 'default' ? undefined : appFont,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
    }}
>
```

- [ ] **Step 2: 拆分 content 容器为"上固定 + 下滚动"两块**

把原来的:

```tsx
<div ref={content_ref} style={{ flex: '0 1 auto', overflow: 'auto', padding: '4px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
    {showSource && !show_welcome_empty && (<SourceArea ... />)}
    {!hideLanguage && !show_welcome_empty && <LanguageArea ... />}
    {show_welcome_empty && (<WelcomeEmpty ... />)}
    {!show_welcome_empty && (<TargetArea ... />)}
</div>
```

改为:

```tsx
{/* 顶部固定:语言区 + 输入区 + 欢迎页 */}
<div
    ref={top_ref}
    style={{ flex: '0 0 auto', padding: '4px 10px 0', display: 'flex', flexDirection: 'column', gap: 8 }}
>
    {!hideLanguage && !show_welcome_empty && <LanguageArea onSwap={handleSwapLanguages} />}
    {showSource && !show_welcome_empty && (
        <SourceArea
            onTranslate={handle_source_translate}
            onTts={() => { handleSourceTts().catch(console.error); }}
            ttsAvailable={sourceTtsAvailable}
            ttsBusy={sourceTtsBusy}
            ttsPlaying={sourceTtsPlaying}
            onDetectedLanguageClick={handleSwapLanguages}
            inputRef={inputRef}
        />
    )}
    {show_welcome_empty && (
        <WelcomeEmpty onSkip={() => { setConfig('welcome_dismissed', true); window.electronAPI.window.close().catch(console.error); }} />
    )}
</div>

{/* 下方滚动:结果区 */}
{!show_welcome_empty && (
    <div
        ref={results_ref}
        className="thin-scroll"
        data-testid="translate-results-scroll"
        style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            padding: '8px 10px 12px',
        }}
    >
        <TargetArea serviceList={enabledServiceList} ttsServiceList={enabledTtsServiceList} onRetry={(instanceKey) => { handleRetry(instanceKey).catch(console.error); }} />
    </div>
)}
```

在组件顶部 ref 声明区域(`const root_ref = useRef<...>`)新增:

```tsx
const top_ref = useRef<HTMLDivElement>(null)
const results_ref = useRef<HTMLDivElement>(null)
```

删除 `content_ref` 的声明与使用。

- [ ] **Step 3: 给 textarea 也加 .thin-scroll**

打开 `src/windows/translate/source_area.tsx`,找到 `<textarea ref={textAreaRef} ...>`,在 className 中追加 `thin-scroll`(若原本无 className 属性,加上 `className="thin-scroll"`)。

- [ ] **Step 4: 验证类型**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/windows/translate/index.tsx src/windows/translate/source_area.tsx
git commit -m "refactor(translate): 拆分顶部固定区与底部 ResultsScroll、应用 .thin-scroll"
```

---

## Task 8: 渲染端高度上报(替换 fit_height)

**Files:**
- Modify: `src/windows/translate/index.tsx`

- [ ] **Step 1: 删除旧 fit_height effect 与 result_fit_key**

定位 `index.tsx` 中的 `useEffect`(它持有 `const fit_height = () => { ... window.electronAPI.window.setContentHeight(...) }`),整段删除。同时删除其依赖里出现的 `result_fit_key` 的定义(若未被其他地方使用)与 `Math` 拼接逻辑。grep 确认无残留引用:

Run: `grep -n "fit_height\|result_fit_key\|setContentHeight" src/windows/translate/index.tsx`
Expected: 命中 0 行。

- [ ] **Step 2: 新增上报内容高度的 effect**

在删除位置插入:

```tsx
useEffect(() => {
    const root = root_ref.current
    if (!root) return

    let frame_id = 0
    const report = (): void => {
        window.cancelAnimationFrame(frame_id)
        frame_id = window.requestAnimationFrame(() => {
            // 用 scrollHeight 拿到内容自然高度(忽略 100vh 限制)
            const top = top_ref.current
            const results = results_ref.current
            const top_h = top ? top.scrollHeight : 0
            const results_h = results ? results.scrollHeight : 0
            // titlebar 高度由 root 顶部子元素提供(Titlebar 组件)
            const titlebar_h = titlebar_ref.current ? titlebar_ref.current.getBoundingClientRect().height : 0
            const total = Math.ceil(titlebar_h + top_h + results_h)
            window.electronAPI.translate.reportContentHeight(total).catch(() => undefined)
        })
    }

    report()
    const observer = new ResizeObserver(report)
    if (titlebar_ref.current) observer.observe(titlebar_ref.current)
    if (top_ref.current) observer.observe(top_ref.current)
    if (results_ref.current) observer.observe(results_ref.current)

    return () => {
        window.cancelAnimationFrame(frame_id)
        observer.disconnect()
    }
}, [show_welcome_empty, showSource, hideLanguage, enabledServiceList.length, isTranslating, appFont, appFontSize])
```

(注意:依赖里不再需要 `sourceText` 或 `result_fit_key`——ResizeObserver 已经会监听到自然变化。`show_welcome_empty` 等保留是因为它们会改变挂载结构。)

- [ ] **Step 3: 类型检查**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: dev 跑一次看视觉**

Run: `npm run dev`(用户手动启动,本步骤跳过自动验证;若用户要求自动,改为 `npm run build`)
Expected: 翻译窗口打开,初始只显示输入区一行;输入文本时输入区增长;触发翻译后,引擎卡片逐张出现,窗口跟着扩张;粘大段文字让结果超出屏幕 75%,窗口锁定,结果区出现细滚动条;拖宽窗口宽度生效,拖高窗口高度被锁。

- [ ] **Step 5: Commit**

```bash
git add src/windows/translate/index.tsx
git commit -m "refactor(translate): 渲染端改用 translate:reportContentHeight 替代 fit_height"
```

---

## Task 9: 结果区容器去掉自身 overflow

**Files:**
- Modify: `src/windows/translate/target_area.tsx`

- [ ] **Step 1: 修改 TargetArea 外层容器**

定位 `target_area.tsx` 的 return JSX:

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
```

改为(去掉 `overflow: 'auto'`,因为现在外层 `ResultsScroll` 接管):

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
```

- [ ] **Step 2: 确认卡片宽度跟随容器**

每张 `<div className="card" ...>` 默认 block,会占满父宽,无需额外改动。

如果原代码里 SortableCard 的 outer wrapper(`<div ref={setNodeRef} style={style}>`)缺少 `width:100%`,显式补上:

```tsx
const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: '100%',
}
```

- [ ] **Step 3: 给卡片 body 加 word-break**

在 `result_to_text` 渲染的容器(`data-testid="result-body"` 的 div)style 中追加:

```tsx
whiteSpace: 'pre-wrap',
wordBreak: 'break-word',
```

合并后该 div 的 style 应为:

```tsx
style={{ marginTop: 8, marginLeft: 22, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
```

- [ ] **Step 4: 类型检查**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/windows/translate/target_area.tsx
git commit -m "refactor(translate): TargetArea 移除自身 overflow、卡片随宽度重排"
```

---

## Task 10: 迁移既有 e2e `translate_window_constraints.spec.ts`

**Files:**
- Modify: `tests/user_e2e/specs/translate_window_constraints.spec.ts`

- [ ] **Step 1: 把 setContentHeight stub 替换为 translate.reportContentHeight stub**

打开文件,把所有 `__orig_setContentHeight` / `api.window.setContentHeight` / `api.window.setContentHeight = ...` 替换为对 `api.translate.reportContentHeight` 的对应操作:

```ts
type TestElectronApi = Window['electronAPI'] & {
    __orig_report_content_height?: Window['electronAPI']['translate']['reportContentHeight']
}
const api = window.electronAPI as TestElectronApi
api.__orig_report_content_height = api.translate.reportContentHeight.bind(api.translate)
api.translate.reportContentHeight = () => Promise.resolve()
```

以及恢复:

```ts
if (api.__orig_report_content_height) {
    api.translate.reportContentHeight = api.__orig_report_content_height
}
```

- [ ] **Step 2: 调整"max height"断言**

原断言 `expect(final_bounds.height).toBeLessThanOrEqual(960)` 不再成立(现在最大 = 75vh,取决于显示器)。改为:

```ts
import { _electron as electron } from '@playwright/test'  // 若已有则跳过
// 或者直接通过 omni.api 取屏幕信息;若 e2e_api 没有暴露则补一个 helper。
// 简单做法:不写死 960,改成断言 < workArea.height,> 200。
expect(final_bounds.height).toBeLessThan(2000)
expect(final_bounds.height).toBeGreaterThan(200)
```

(精确的 75vh 断言放进 Task 11 的新 spec,这里只保证旧测试不假阴性。)

类似地,把 "3 cards × 8 lines" 那个 floor 断言保留,但断言对象改为 `report_content_height` stub 之后通过 `setContentSize` 模拟出的尺寸:

把这个测试直接删除并标注 TODO,迁到新 spec(Task 11)中以 75vh 上限的语义重写,因为"maxHeight=960 固定上限"已不存在。

- [ ] **Step 3: 跑该 spec**

Run: `npm run test:e2e -- tests/user_e2e/specs/translate_window_constraints.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/user_e2e/specs/translate_window_constraints.spec.ts
git commit -m "test(translate): 迁移旧约束 e2e 到 translate.reportContentHeight stub"
```

---

## Task 11: 新增 e2e 套件 `translate_window_resize.spec.ts`

**Files:**
- Create: `tests/user_e2e/specs/translate_window_resize.spec.ts`

- [ ] **Step 1: 写测试骨架**

新建 `tests/user_e2e/specs/translate_window_resize.spec.ts`:

```ts
// Covers docs/superpowers/specs/2026-05-24-translate-window-resize-design.md
// Verifies:
//   1. 初始高度 = 输入区高度(无结果时窗口紧凑)
//   2. 多行输入让 textarea 在 ≤8 行内增长,窗口跟着扩张;>8 行时窗口高度不再增长
//   3. 引擎结果到达时窗口分次扩张
//   4. 内容超过 75vh 时窗口锁定在 floor(workArea.height * 0.75),结果区出现滚动
//   5. 用户拖宽生效;拖高无效(高度由主进程锁定)
//   6. 清空后窗口缩回初始高度

import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const single_service_config = {
    translate_service_list: ['mymemory@default'],
    service_instances: {
        'mymemory@default': { serviceKey: 'mymemory', config: {} },
    },
    welcome_dismissed: true,
}

test.describe('@ui translate window resize', () => {
    test('initial window height equals input area only', async () => {
        const omni = await AppFixture.start({ config: single_service_config })
        try {
            await omni.translate()
            const bounds = (await omni.api.windowState('translate')).bounds
            if (!bounds) throw new Error('missing translate window bounds')
            // 初始高度应紧凑(≤ 220px:titlebar + language + 1 行 + action)
            expect(bounds.height).toBeLessThanOrEqual(220)
            expect(bounds.height).toBeGreaterThan(80)
        } finally { await omni.stop() }
    })

    test('window grows as textarea grows up to 8 lines, then stops', async () => {
        const omni = await AppFixture.start({ config: single_service_config })
        try {
            const translate = await omni.translate()
            const initial = (await omni.api.windowState('translate')).bounds?.height ?? 0

            await translate.typeSource('line1\nline2\nline3')
            const h3 = (await omni.api.windowState('translate')).bounds?.height ?? 0
            expect(h3).toBeGreaterThan(initial)

            await translate.typeSource('1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12')
            const h12 = (await omni.api.windowState('translate')).bounds?.height ?? 0
            // textarea 封顶 8 行 → 窗口高度不应进一步增加
            const h8_max_expected = initial + 8 * 24 + 40  // 24px line-height 上限近似
            expect(h12).toBeLessThanOrEqual(h8_max_expected)
        } finally { await omni.stop() }
    })

    test('window expands once per arriving result', async () => {
        const omni = await AppFixture.start({
            config: {
                ...single_service_config,
                translate_service_list: ['mymemory@default', 'google@default'],
                service_instances: {
                    'mymemory@default': { serviceKey: 'mymemory', config: {} },
                    'google@default': { serviceKey: 'google', config: {} },
                },
            },
        })
        const server = await omni.startTranslationTestServer()
        try {
            const translate = await omni.translate()
            const before = (await omni.api.windowState('translate')).bounds?.height ?? 0

            server.set_mymemory_response({ translated_text: 'first result body', status: 200 })
            server.set_google_response({ translated_text: 'second result body', status: 200 })
            await translate.typeSource('hello')
            await translate.clickTranslate()
            await translate.waitAllResults(30_000)

            const after = (await omni.api.windowState('translate')).bounds?.height ?? 0
            expect(after).toBeGreaterThan(before)
        } finally { await server.stop(); await omni.stop() }
    })

    test('window locks at 75% of work area when content exceeds it', async () => {
        const omni = await AppFixture.start({ config: single_service_config })
        const server = await omni.startTranslationTestServer()
        try {
            const translate = await omni.translate()
            const huge = Array.from({ length: 200 }, (_, i) => `paragraph ${i.toString()}`).join(' ')
            server.set_mymemory_response({ translated_text: huge, status: 200 })

            await translate.typeSource('big')
            await translate.clickTranslate()
            await translate.waitAllResults(30_000)

            const bounds = (await omni.api.windowState('translate')).bounds
            const display = await omni.api.primaryDisplay()  // 若 e2e_api 没有,改用 omni.api.displayMatching('translate')
            const work_area_h = display.workArea.height
            const expected_max = Math.floor(work_area_h * 0.75)

            if (!bounds) throw new Error('missing bounds')
            // 允许 ±4px 容差
            expect(Math.abs(bounds.height - expected_max)).toBeLessThanOrEqual(4)

            // 结果区出现滚动条
            const has_scroll = await (translate as unknown as { page: import('@playwright/test').Page }).page.evaluate(() => {
                const el = document.querySelector('[data-testid="translate-results-scroll"]')
                if (!el) return false
                return el.scrollHeight > el.clientHeight
            })
            expect(has_scroll).toBe(true)
        } finally { await server.stop(); await omni.stop() }
    })

    test('user can resize width but not height', async () => {
        const omni = await AppFixture.start({ config: single_service_config })
        try {
            const translate = await omni.translate()
            const before = (await omni.api.windowState('translate')).bounds
            if (!before) throw new Error('missing bounds')

            // 尝试同时改宽和高
            await translate.resizeWindowTo(before.width + 200, before.height + 400)
            const after = (await omni.api.windowState('translate')).bounds
            if (!after) throw new Error('missing bounds')

            expect(after.width).toBeGreaterThan(before.width)            // 宽度生效
            expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(2)  // 高度锁定
        } finally { await omni.stop() }
    })

    test('clearing source and results collapses back to initial height', async () => {
        const omni = await AppFixture.start({ config: single_service_config })
        const server = await omni.startTranslationTestServer()
        try {
            const translate = await omni.translate()
            const initial = (await omni.api.windowState('translate')).bounds?.height ?? 0

            server.set_mymemory_response({ translated_text: 'temp', status: 200 })
            await translate.typeSource('hi')
            await translate.clickTranslate()
            await translate.waitAllResults(30_000)

            await translate.clearSource()  // 若 fixture 没暴露,直接调用 setSourceText('')
            // 等一个 rAF + IPC 往返
            await translate.page.waitForTimeout(200)

            const after = (await omni.api.windowState('translate')).bounds?.height ?? 0
            // 折叠态卡片仍占 header 行,因此 after 可能比 initial 略大,但应远小于带 body 的高度
            expect(after).toBeLessThanOrEqual(initial + 8 * 40)  // 容忍折叠卡片若干 header 行
        } finally { await server.stop(); await omni.stop() }
    })
})
```

- [ ] **Step 2: 补充 fixture 缺失的 helper**

如果 `omni.api.primaryDisplay()` / `displayMatching()` / `translate.clearSource()` / `translate.page` 在现有 fixture 中不存在,补到 `tests/user_e2e/fixtures/e2e_api.ts` 与 `app_fixture.ts`。最小补丁:

- `e2e_api.ts` 加 `primaryDisplay(): Promise<{ workArea: { height: number; width: number; x: number; y: number } }>`,主进程侧暴露 `screen.getPrimaryDisplay().workArea`。
- `AppFixture.translate()` 返回对象上暴露 `page: Page`(若已有则忽略),`clearSource()` 等价于在 textarea 上 selectAll + Delete。

每补一个 helper 单独 commit。

- [ ] **Step 3: 跑新 spec**

Run: `npm run test:e2e -- tests/user_e2e/specs/translate_window_resize.spec.ts`
Expected: PASS 全部 6 个用例。

- [ ] **Step 4: Commit**

```bash
git add tests/user_e2e/specs/translate_window_resize.spec.ts tests/user_e2e/fixtures
git commit -m "test(translate): 新增翻译窗口尺寸/滚动 e2e 套件"
```

---

## Task 12: 整体回归

- [ ] **Step 1: 单元测试**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: 全部 e2e(核心 + UI)**

Run: `npm run test:e2e:core && npm run test:e2e:ui`
Expected: PASS

- [ ] **Step 5: 打包冒烟**

Run: `npm run dist:dir`
Expected: 构建成功并自动启动 unpacked 应用。手动验证:翻译窗口高度锁定 + 宽度可拖 + 结果区滚动。

---

## Task 13: 文档同步

**Files:**
- Modify: `docs/spec.md`
- Modify: `TASKS.md`

- [ ] **Step 1: 在 `docs/spec.md` 翻译窗口章节补充**

定位 spec.md 中描述翻译窗口的小节(grep `翻译窗口` 找到位置),追加段落:

```markdown
### 窗口尺寸与滚动

- 最小宽度 360px,无最大宽度上限,用户可拖宽。
- 高度由主进程锁定,用户**不可**手动调整;实际高度 = clamp(内容自然高度, 初始高度, floor(workArea.height × 0.75))。
- 内容超出上限时,结果区(`ResultsScroll`)内部出现滚动条,输入区与语言条固定在窗口顶部不滚动。
- 每个翻译引擎卡片初始为折叠态(只显示 header 一行),结果返回后自动展开 body,窗口分次扩张。
- 输入框 textarea 自动增长,最多 8 行,>8 行时 textarea 内部滚动,窗口高度不再增加。
- 实现细节:渲染端通过专属 IPC `translate:report-content-height` 上报自然内容高度,主进程通过 setMinimumSize/setMaximumSize 同值锁定高度;通用 `window:setContentHeight` 不参与本窗口。
```

- [ ] **Step 2: 在 `TASKS.md` 标记完成**

在 TASKS.md 找到合适位置(已完成项小节),追加:

```markdown
- [x] 2026-05-24 翻译窗口尺寸/滚动改造:输入固定、结果区滚动、高度锁定、宽度可拖
      规格:docs/superpowers/specs/2026-05-24-translate-window-resize-design.md
      计划:docs/superpowers/plans/2026-05-24-translate-window-resize.md
```

- [ ] **Step 3: Commit**

```bash
git add docs/spec.md TASKS.md
git commit -m "docs: 同步翻译窗口尺寸/滚动改造文档"
```

---

## Self-Review Notes

(本节由计划作者填写;实施完成后无需更新。)

- 覆盖性:spec §1(7 个目标)、§2(架构)、§3(布局)、§4(错误处理与边界)、§5(常量)、§6(IPC)、§7(测试)、§8(文档同步)逐一对应 Task 1–13。
- 没有把通用 `window:setContentHeight` 改动塞进任何任务(spec §6 与 §10 明确要求保留)。
- 单元测试覆盖纯函数 `compute_target_height`;e2e 覆盖 spec §7 的 7 个场景。
- 高度锁定通过 setMinimumSize/setMaximumSize 同值实现,Task 3 含 `on('restore')`/`on('move')`/`display-metrics-changed` 监听器(spec §4)。
- 文档同步在 Task 13 显式完成(spec §8)。
- 已知风险(Win11 DPI ±1px 偏差)通过 Task 11 的 e2e 容差 ±4px 缓解。
