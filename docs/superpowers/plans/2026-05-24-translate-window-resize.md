# 翻译窗口尺寸与滚动改造 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改造翻译窗口的尺寸、滚动与可调性:输入区固定在窗口顶部、结果区按引擎返回分次扩张、超出 75vh 时仅结果区滚动、高度由主进程锁定、宽度用户可拖(只限最小宽 360px)。

**Architecture:** 渲染端通过新的专属 IPC `translate:reportContentHeight` 上报内容自然高度;主进程依据当前显示器 `workArea.height * 0.75` 计算 `target_h`,通过 `setMinimumSize`/`setMaximumSize` 同高度锁定、最大宽度用 `MAX_W_SENTINEL=100000` 表达"无实际上限",通过 `setBounds` 应用高度。原有通用 `window:setContentHeight` 保留给其他窗口不动。

**Spec:** `docs/superpowers/specs/2026-05-24-translate-window-resize-design.md`

**Commit 约定:** 每个 Task 末尾给出建议的 commit 命令仅为参考;**默认在所有 Task 完成、整体回归通过后,再由用户决定如何分组提交**。如用户明确要求"每个 task 一个 commit",再按 Task 末的提示提交。

---

## File Structure

### 新增

- `electron/windows/translate_height_controller.ts` — 主进程翻译窗口高度管控:`compute_target_height` 纯函数 + `TranslateHeightController` 类。
- `tests/unit/windows/translate_height_controller.test.ts` — `compute_target_height` 单元测试。
- `tests/user_e2e/specs/translate_window_resize.spec.ts` — 新增 e2e 测试套件(7 个场景,见 Task 11)。

### 修改

- `electron/windows/translate_options.ts` — 改最小宽 360、删 maxHeight 上限、改最小高度初值、不再从 config 还原 height。
- `electron/windows/manager.ts` — 翻译窗口 resize 持久化只保存 width;创建翻译窗口时实例化 `TranslateHeightController`。
- `electron/ipc/window_handlers.ts` — 新增 `translate:reportContentHeight` handler。**不修改** `window:setContentHeight`。
- `electron/preload.ts` — 新增 `electronAPI.translate.reportContentHeight(height)`。
- `shared/types/ipc.ts` — 新增 `translate` namespace 类型。
- `src/windows/translate/index.tsx` — 重构布局(顶部固定块 + 底部 `ResultsScroll` 滚动块、内层 `ResultsContent` 节点供高度上报);删除旧 `fit_height` effect 改用新 IPC;向 SourceArea 传入清空结果回调。
- `src/windows/translate/source_area.tsx` — 清空输入时同时触发父组件传入的结果清空回调,确保窗口回缩。
- `src/windows/translate/target_area.tsx` — 容器去掉 `overflow:auto`;卡片宽度 100%;body 加 `white-space:pre-wrap; word-break:break-word`;接受 `hasAnyRequest` 控制是否渲染卡片列表(无翻译请求时不渲染任何卡片)。
- `src/styles/globals.css` — 新增 `.thin-scroll` 工具类。
- `tests/user_e2e/specs/translate_window_constraints.spec.ts` — **不删除**,改写 stub 到新 IPC,保留并改造既有断言以适配 75vh 上限语义。
- `docs/spec.md` — 翻译窗口章节同步窗口尺寸/滚动/可调性约束。
- `TASKS.md` — 记录本次改造完成状态。

### 不改动

- `window:setContentHeight` / `window:setContentSize` handler 本体(保留给其他窗口)。
- 词典、识别、配置窗口的尺寸策略。

---

## 结果区状态机(关键!对应 review §1)

`TargetArea` 是否渲染卡片列表,取决于"是否曾发起过翻译请求"。增加 `translate_store` 字段 `hasAnyRequest: boolean`(由 `nextRequestId` 顺带置 true,`clearResults` 时置 false),或直接用 `requestId !== 0`(`translate_store` 已有 `nextRequestId()`,默认 0,递增后非 0)判断。

具体规则:

| 状态 | hasAnyRequest | `results` 内容 | TargetArea 渲染 |
|---|---|---|---|
| 初次打开,未触发翻译 | false | `{}` | **不渲染任何卡片**(返回 `null` 或空数组) |
| 用户点翻译,引擎调用中 | true | `{}` 或部分 key | 渲染所有配置的引擎卡片,无结果的处于折叠态(只显示 header + loading) |
| 全部结果到达 | true | 全 key 有 value | 卡片 body 展开 |
| 清空输入/结果 | false | `{}` | **不渲染任何卡片**,窗口缩回 |

实现入口:`TargetArea` 接收新 prop `hasAnyRequest: boolean`,在 `serviceList.map` 之前 `if (!hasAnyRequest) return null`。`clearResults` 把 `hasAnyRequest` 置 false(已有 setter 体系)。

---

## Constants

写入 `electron/windows/translate_height_controller.ts` 顶部并 export:

```ts
export const TRANSLATE_MIN_WIDTH = 360
export const TRANSLATE_MAX_HEIGHT_RATIO = 0.75
export const TRANSLATE_HEIGHT_REPORT_DEBOUNCE_PX = 1
export const TRANSLATE_SCREEN_MOVE_DEBOUNCE_MS = 100
export const TRANSLATE_MAX_W_SENTINEL = 100000  // 传给 setMaximumSize 的"足够大"宽度上限
```

---

## Task 0: 验证 `setMaximumSize(100000, h)` 在 Win11 + Electron 39 下宽度可拖到大值

**目的:** review §4 指出 `setMaximumSize(0, h)` 行为未验证;改为 `MAX_W_SENTINEL=100000` 后,仍需在动手前确认 Electron 不会把"100000"视作奇怪上限。

- [ ] **Step 1: 临时实验脚本**

在仓库根写一份临时实验(不入库):

```ts
// scripts/_spike_max_size.ts(用完即删)
import { app, BrowserWindow } from 'electron'
app.whenReady().then(() => {
    const win = new BrowserWindow({ width: 500, height: 400, resizable: true })
    win.setMinimumSize(360, 400)
    win.setMaximumSize(100000, 400)
    win.loadURL('data:text/html,<h1>resize-me</h1>')
    setTimeout(() => {
        console.log('bounds:', win.getBounds())
        console.log('min:', win.getMinimumSize(), 'max:', win.getMaximumSize())
    }, 500)
})
```

- [ ] **Step 2: 跑实验,人工拖宽**

Run: `npx electron scripts/_spike_max_size.ts`
Expected:打开的小窗口可以被鼠标拖到非常宽(>2000px);高度无法被拖动。控制台打印的 `max:` 含 `100000`。

- [ ] **Step 3: 删脚本**

Run: `rm scripts/_spike_max_size.ts`

如果 Step 2 失败(例如宽度被限制在 100000 以外的值),停止本计划,反馈给作者改用其他策略(例如不调用 `setMaximumSize`,而在 `resize` 事件里把高度强制回弹)。

---

## Task 1: 全局滚动条样式 `.thin-scroll`

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: 追加 `.thin-scroll` 工具类**

在 `src/styles/globals.css` 末尾追加:

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

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck`
Expected: PASS

- [ ] **建议 commit(可选):**

```bash
git add src/styles/globals.css
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

新建 `electron/windows/translate_height_controller.ts`(此 task 只放常量+纯函数;类放 Task 3):

```ts
export const TRANSLATE_MIN_WIDTH = 360
export const TRANSLATE_MAX_HEIGHT_RATIO = 0.75
export const TRANSLATE_HEIGHT_REPORT_DEBOUNCE_PX = 1
export const TRANSLATE_SCREEN_MOVE_DEBOUNCE_MS = 100
export const TRANSLATE_MAX_W_SENTINEL = 100000

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

- [ ] **Step 4: 测试通过**

Run: `npx vitest run tests/unit/windows/translate_height_controller.test.ts`
Expected: PASS(6/6)。

- [ ] **建议 commit(可选):**

```bash
git add electron/windows/translate_height_controller.ts tests/unit/windows/translate_height_controller.test.ts
git commit -m "feat(translate): 新增 compute_target_height 与翻译窗口高度常量"
```

---

## Task 3: `TranslateHeightController` 类(主进程)

**Files:**
- Modify: `electron/windows/translate_height_controller.ts`

- [ ] **Step 1: 追加 controller 实现**

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
        this.win.setMinimumSize(TRANSLATE_MIN_WIDTH, h)
        this.win.setMaximumSize(TRANSLATE_MAX_W_SENTINEL, h)
        const bounds = this.win.getBounds()
        if (bounds.height !== h) {
            this.win.setBounds({ ...bounds, height: h })
        }
    }

    private current_display(): Display {
        return screen.getDisplayMatching(this.win.getBounds())
    }

    private recompute_for_new_workarea(): void {
        if (this.last_reported_h <= 0) return
        const work_area_h = this.current_display().workArea.height
        const target_h = compute_target_height(this.last_reported_h, work_area_h, this.min_height)
        if (target_h !== this.current_target_h) {
            this.current_target_h = target_h
            this.apply_locked_height(target_h)
        }
    }

    private on_move = (): void => {
        if (this.move_timer) clearTimeout(this.move_timer)
        this.move_timer = setTimeout(() => {
            this.move_timer = null
            this.recompute_for_new_workarea()
        }, TRANSLATE_SCREEN_MOVE_DEBOUNCE_MS)
    }

    private on_restore = (): void => {
        this.apply_locked_height(this.current_target_h)
    }

    private on_display_metrics = (): void => {
        this.recompute_for_new_workarea()
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

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck`
Expected: PASS

- [ ] **建议 commit(可选):**

```bash
git add electron/windows/translate_height_controller.ts
git commit -m "feat(translate): 新增 TranslateHeightController 类(高度锁定/多屏重算)"
```

---

## Task 4: IPC 类型与 preload 绑定

**Files:**
- Modify: `shared/types/ipc.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: 找现有 namespace 模式**

Run: `grep -n "window:\|history:\|text:" shared/types/ipc.ts | head -20`
Expected: 看到现有 namespace 的声明位置和命名风格(`window: { setContentHeight(...) }` 这类)。

- [ ] **Step 2: 扩展 IPC 类型**

在 `shared/types/ipc.ts` 中 `window` namespace 同级追加:

```ts
    translate: {
        reportContentHeight(height: number): Promise<void>
    }
```

- [ ] **Step 3: preload 注册同名绑定**

在 `electron/preload.ts` 的 `window:` namespace 同级追加:

```ts
    translate: {
        reportContentHeight: (height: number) => ipcRenderer.invoke('translate:reportContentHeight', height),
    },
```

- [ ] **Step 4: 类型检查**

Run: `npm run typecheck`
Expected: PASS

- [ ] **建议 commit(可选):**

```bash
git add shared/types/ipc.ts electron/preload.ts
git commit -m "feat(translate): 新增 translate:reportContentHeight IPC 类型与 preload 绑定"
```

---

## Task 5: 主进程 IPC handler 注册 + controller 接入

**Files:**
- Modify: `electron/windows/manager.ts`
- Modify: `electron/ipc/window_handlers.ts`

- [ ] **Step 1: 在 manager.ts 注入 controller**

`electron/windows/manager.ts` 顶部 import:

```ts
import { TranslateHeightController } from './translate_height_controller'
```

`WindowManager` 类内新增字段:

```ts
private translate_height_controller: TranslateHeightController | null = null
```

定位 `createWindow()` 中 `if (opts.label === WindowLabel.TRANSLATE) { win.setSize(opts.width, opts.height) }`,其后追加:

```ts
    if (opts.label === WindowLabel.TRANSLATE) {
        this.translate_height_controller?.dispose()
        this.translate_height_controller = new TranslateHeightController(win, {
            initial_min_height: opts.height,
        })
    }
```

定位同一函数 `win.on('closed', () => { ... })` 内的 `WindowLabel.TRANSLATE` 分支,追加:

```ts
        if (opts.label === WindowLabel.TRANSLATE) {
            setConfig('translate_pinned', false)
            setConfig('translate_always_on_top', false)
            this.translate_height_controller?.dispose()
            this.translate_height_controller = null
        }
```

新增 public getter:

```ts
getTranslateHeightController(): TranslateHeightController | null {
    return this.translate_height_controller
}
```

- [ ] **Step 2: 注册 IPC handler**

`electron/ipc/window_handlers.ts` 末尾追加:

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

确认 `WindowLabel` 已 import(本文件已 import,见现有代码)。

- [ ] **Step 3: 类型检查**

Run: `npm run typecheck`
Expected: PASS

- [ ] **建议 commit(可选):**

```bash
git add electron/ipc/window_handlers.ts electron/windows/manager.ts
git commit -m "feat(translate): 注册 translate:reportContentHeight handler 并绑定到翻译窗口"
```

---

## Task 6: 翻译窗口初始尺寸 / 可调性 / 尺寸持久化

**Files:**
- Modify: `electron/windows/translate_options.ts`
- Modify: `electron/windows/manager.ts`
- Modify: `tests/unit/windows/window_options.test.ts`

- [ ] **Step 1: 改写 `translate_options.ts`**

替换全文为:

```ts
import { getConfig } from '../config/store'
import { WindowLabel, type WindowOptions } from './types'
import { TRANSLATE_MIN_WIDTH } from './translate_height_controller'

const TRANSLATE_INITIAL_HEIGHT = 160
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
        resizable: true,
        alwaysOnTop: getConfig('translate_always_on_top') as boolean,
    }
}
```

(删去 `attach_translate_resize_persistence` 及 `setConfig` import,因为持久化逻辑下移到 manager.ts 内联)

- [ ] **Step 2: 更新 manager.ts 持久化逻辑**

定位现有的:

```ts
    if (opts.label === WindowLabel.TRANSLATE) {
      if (getConfig('translate_remember_window_size') && !win.listenerCount('resize')) {
        const persistSize = debounce(() => { ... const [w, h] = win.getSize(); setConfig('translate_window_width', w); setConfig('translate_window_height', h) }, 300)
        ...
      }
    }
```

改为只保存 width:

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

(`translate_window_height` 配置字段保留以兼容已存档配置,不再被读/写)

- [ ] **Step 3: 调整 window_options 单元测试**

打开 `tests/unit/windows/window_options.test.ts`,把所有 `height: 720` / `height: 360` 等针对 `get_translate_window_options()` 的断言改为 `height: 160`。grep 验证无残留:

Run: `grep -nE "height:\s*(720|360)" tests/unit/windows/window_options.test.ts`
Expected: 输出 0 行(或只剩与翻译窗口无关的部分)。

- [ ] **Step 4: 跑测试**

Run: `npx vitest run tests/unit/windows/window_options.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查**

Run: `npm run typecheck`
Expected: PASS

- [ ] **建议 commit(可选):**

```bash
git add electron/windows/translate_options.ts electron/windows/manager.ts tests/unit/windows/window_options.test.ts
git commit -m "feat(translate): 翻译窗口初始尺寸/最小宽 360/持久化只保留宽度"
```

---

## Task 7: 渲染端布局重构(顶部固定 + 底部滚动 + 内层 content 节点)

**Files:**
- Modify: `src/windows/translate/index.tsx`
- Modify: `src/windows/translate/source_area.tsx`

**额外要求:** SourceArea 清空按钮必须同时清空翻译结果,否则 `Object.keys(results).length > 0` 会让 `hasAnyRequest` 继续为 true,窗口无法缩回初始高度。实现方式:给 `SourceArea` 新增 `onClearResults?: () => void` prop,父组件传入 `clearResults`,并在 `handleClear` 中调用。

- [ ] **Step 1: 改根容器**

在 `src/windows/translate/index.tsx` 的 return,把根 `<div ref={root_ref} className="op-window" ...>` 的 style 改为:

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

- [ ] **Step 2: 新增 ref**

组件顶部 ref 声明区域新增:

```tsx
const top_ref = useRef<HTMLDivElement>(null)
const results_scroll_ref = useRef<HTMLDivElement>(null)
const results_content_ref = useRef<HTMLDivElement>(null)
```

删除 `content_ref` 声明与使用。

- [ ] **Step 3: 拆分 content 容器**

把原 `<div ref={content_ref} ...>{showSource && ...}{LanguageArea}{WelcomeEmpty}{TargetArea}</div>` 替换为:

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

{/* 下方滚动容器 ── ResultsScroll;**始终渲染**但高度可能为 0 */}
<div
    ref={results_scroll_ref}
    className="thin-scroll"
    data-testid="translate-results-scroll"
    style={{
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        padding: show_welcome_empty ? 0 : '8px 10px 12px',
    }}
>
    {/* 内层 content 节点 ── 高度上报与 ResizeObserver 都观察这个 */}
    <div ref={results_content_ref}>
        {!show_welcome_empty && (
            <TargetArea
                serviceList={enabledServiceList}
                ttsServiceList={enabledTtsServiceList}
                hasAnyRequest={isTranslating || Object.keys(results).length > 0}
                onRetry={(instanceKey) => { handleRetry(instanceKey).catch(console.error); }}
            />
        )}
    </div>
</div>
```

(`isTranslating || Object.keys(results).length > 0` 表示"已发起且尚未清空的翻译会话";`clearResults` 把 `results` 清空、`setIsTranslating(false)` 触发条件为 false → 卡片列表不再渲染。)

- [ ] **Step 4: textarea 应用 `.thin-scroll`,清空时同步清空结果**

`src/windows/translate/source_area.tsx` 的 `<textarea ref={textAreaRef} ...>`:若原本无 `className` 属性,加 `className="thin-scroll"`;若有,合并。

同时扩展 `SourceAreaProps`:

```ts
    onClearResults?: () => void
```

函数参数解构加入 `onClearResults`,并把 `handleClear` 改为:

```ts
const handleClear = useCallback(() => {
    setSourceText('')
    setDetectedLanguage(null)
    onClearResults?.()
}, [setSourceText, setDetectedLanguage, onClearResults])
```

父组件 `src/windows/translate/index.tsx` 调用 `<SourceArea ... />` 时传入:

```tsx
onClearResults={clearResults}
```

这样用户点击清空输入后,`results` 同步清空,`hasAnyRequest` 变为 false,窗口能缩回初始高度。

- [ ] **Step 5: 类型检查**

Run: `npm run typecheck`
Expected: PASS(若报 `TargetArea` 缺 `hasAnyRequest` prop,Task 9 会补;先用 `// @ts-expect-error wired in Task 9` 临时跳过,Task 9 完成后再移除——若不愿临时注释,把 Task 9 与 Task 7 合并到同一 commit。)

- [ ] **建议 commit(可选):**

```bash
git add src/windows/translate/index.tsx src/windows/translate/source_area.tsx
git commit -m "refactor(translate): 拆分顶部固定区与 ResultsScroll(含内层 content 节点)"
```

---

## Task 8: 渲染端高度上报(替换 fit_height,观察内层 content)

**Files:**
- Modify: `src/windows/translate/index.tsx`

- [ ] **Step 1: 删除旧 fit_height effect**

定位含 `window.electronAPI.window.setContentHeight(height)` 的 useEffect,整段删除。删完后:

Run: `grep -n "fit_height\|result_fit_key\|setContentHeight" src/windows/translate/index.tsx`
Expected: 0 行。

(`result_fit_key` 的 `useMemo` 也一并删除——它原本只服务于 fit_height 的依赖列表。)

- [ ] **Step 2: 新增 reporter effect**

在原 fit_height effect 位置插入:

```tsx
useEffect(() => {
    const titlebar = titlebar_ref.current
    const top = top_ref.current
    const results_content = results_content_ref.current

    let frame_id = 0
    const report = (): void => {
        window.cancelAnimationFrame(frame_id)
        frame_id = window.requestAnimationFrame(() => {
            const titlebar_h = titlebar ? titlebar.getBoundingClientRect().height : 0
            const top_h = top ? top.getBoundingClientRect().height : 0
            // 关键:读"内容节点" scrollHeight,而不是滚动容器自身
            const results_h = results_content ? results_content.scrollHeight : 0
            const total = Math.ceil(titlebar_h + top_h + results_h)
            window.electronAPI.translate.reportContentHeight(total).catch(() => undefined)
        })
    }

    report()
    const observer = new ResizeObserver(report)
    if (titlebar) observer.observe(titlebar)
    if (top) observer.observe(top)
    // 关键:observe 内容节点,不是滚动容器 ── 滚动容器一旦被锁到 75vh,
    // 它自身的 borderBox 就不再变化,内层节点继续增长才能触发观察。
    if (results_content) observer.observe(results_content)

    return () => {
        window.cancelAnimationFrame(frame_id)
        observer.disconnect()
    }
}, [show_welcome_empty, showSource, hideLanguage, enabledServiceList.length, isTranslating, appFont, appFontSize, results])
```

(依赖里加 `results`,确保结果对象引用变化时重挂 observer 抓到新节点。)

- [ ] **Step 3: 类型检查**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: dev 手动验证(可选)**

Run: `npm run dev`(用户启动)
Expected: 翻译窗口打开 → 初始紧凑(输入区);触发翻译 → 卡片头部出现并随结果展开;粘超长文本 → 窗口锁定,**只**结果区滚动,输入区不动;拖宽生效,拖高被锁;清空 → 缩回。

- [ ] **建议 commit(可选):**

```bash
git add src/windows/translate/index.tsx
git commit -m "refactor(translate): 渲染端改用 translate.reportContentHeight + 观察内容节点"
```

---

## Task 9: `TargetArea` 接受 `hasAnyRequest`,无请求时不渲染卡片

**Files:**
- Modify: `src/windows/translate/target_area.tsx`

- [ ] **Step 1: 扩展 props**

在 `interface TargetAreaProps` 末尾追加:

```ts
    hasAnyRequest: boolean
```

- [ ] **Step 2: 解构并短路**

在 `export function TargetArea({ serviceList, ttsServiceList, onRetry }: ...)` 改为:

```tsx
export function TargetArea({ serviceList, ttsServiceList, hasAnyRequest, onRetry }: TargetAreaProps): React.ReactElement | null {
```

在函数体最顶部、所有 hook 之后(为了不破坏 hooks 调用顺序,把 hooks 全部保留,**仅**在 return 前判断),在 `return (` 之前插入:

```tsx
if (!hasAnyRequest) return null
```

(所有 `useState` / `useCallback` / `useMemo` / `useEffect` 必须放在 early-return 之前——确保 hooks 顺序稳定。)

- [ ] **Step 3: 容器去掉自身 overflow,卡片宽度 100%**

定位 `<div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>`,把 `overflow: 'auto'` 删掉:

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
```

SortableCard 内 `style` 加 `width: '100%'`:

```tsx
const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: '100%',
}
```

- [ ] **Step 4: 卡片 body 文本换行**

定位 `data-testid="result-body"` 的 div,合并 style:

```tsx
style={{ marginTop: 8, marginLeft: 22, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
```

- [ ] **Step 5: 类型检查**

Run: `npm run typecheck`
Expected: PASS(Task 7 里 `<TargetArea hasAnyRequest=... />` 现在已被支持)

- [ ] **建议 commit(可选):**

```bash
git add src/windows/translate/target_area.tsx
git commit -m "refactor(translate): TargetArea 增加 hasAnyRequest、去除自身 overflow、卡片随宽度重排"
```

---

## Task 10: 改写既有 e2e `translate_window_constraints.spec.ts`(保留覆盖,不删除)

**Files:**
- Modify: `tests/user_e2e/specs/translate_window_constraints.spec.ts`

review §7 指出:不缩窄回归覆盖。原 spec 的两个 case 都改写,不删除。

- [ ] **Step 1: 把 setContentHeight stub 改为 reportContentHeight stub**

文件内所有 `__orig_setContentHeight` / `api.window.setContentHeight` 替换为对 `api.translate.reportContentHeight` 的相同操作:

```ts
type TestElectronApi = Window['electronAPI'] & {
    __orig_report_content_height?: Window['electronAPI']['translate']['reportContentHeight']
}
const api = window.electronAPI as TestElectronApi
api.__orig_report_content_height = api.translate.reportContentHeight.bind(api.translate)
api.translate.reportContentHeight = () => Promise.resolve()
```

恢复:

```ts
if (api.__orig_report_content_height) {
    api.translate.reportContentHeight = api.__orig_report_content_height
}
```

- [ ] **Step 2: 改写"max height 容纳 3×8 行"用例**

原断言依赖固定 `maxHeight=960`。现在最大高度 = 75vh,因显示器而异。改为:

```ts
// 通过 omni.api 取主显示器 workArea(若 e2e_api 没有该方法,在该 task 内先把 helper 加上)
const display = await omni.api.primaryDisplay()
const expected_max = Math.floor(display.workArea.height * 0.75)
const min_required = 3 * 8 * 22  // 3 卡片 × 8 行 × 22px

// 75vh 上限必须 ≥ 内容下限,否则需求本身不成立
expect(expected_max, '75% of work area must accommodate 3×8 lines').toBeGreaterThanOrEqual(min_required)

// 实测窗口在 stub 关闭高度上报后,可被拖到 75vh
const bounds = (await omni.api.windowState('translate')).bounds
const max_observed = bounds?.height ?? 0
expect(max_observed).toBeGreaterThanOrEqual(min_required)
expect(Math.abs(max_observed - expected_max)).toBeLessThanOrEqual(4)
```

- [ ] **Step 3: 改写"window cannot stretch taller than content"用例**

原断言 `expect(final_bounds.height).toBeLessThanOrEqual(960)` 改为:

```ts
const display = await omni.api.primaryDisplay()
const expected_max = Math.floor(display.workArea.height * 0.75)
expect(final_bounds.height).toBeLessThan(2000)
expect(final_bounds.height).toBeLessThanOrEqual(expected_max + 4)
```

(尝试拖高到 2000 时,主进程会立刻把高度拽回 `target_h ≤ 75vh`。)

- [ ] **Step 4: 跑该 spec**

Run: `npm run test:e2e -- tests/user_e2e/specs/translate_window_constraints.spec.ts`
Expected: PASS

- [ ] **建议 commit(可选):**

```bash
git add tests/user_e2e/specs/translate_window_constraints.spec.ts
git commit -m "test(translate): 既有约束 e2e 改用新 IPC stub 与 75vh 语义(保留覆盖)"
```

---

## Task 11: 新增 e2e 套件 `translate_window_resize.spec.ts`

**Files:**
- Create: `tests/user_e2e/specs/translate_window_resize.spec.ts`
- (可能)Modify: `tests/user_e2e/fixtures/e2e_api.ts`、`tests/user_e2e/fixtures/app_fixture.ts` — 补 `primaryDisplay()` / `page` / `clearSource()` 等 helper

**初始高度的预期(对应 spec §1.3 与 review §1):**
- 初始窗口高度 = titlebar + LanguageArea + SourceArea(1 行) + ActionBar。
- **不含卡片头部**(因为 `hasAnyRequest=false` 时 TargetArea 返回 null)。

- [ ] **Step 1: 写测试**

新建 `tests/user_e2e/specs/translate_window_resize.spec.ts`:

```ts
// Covers docs/superpowers/specs/2026-05-24-translate-window-resize-design.md
//   §1.3 结果区状态机: 未触发翻译 → 不渲染卡片
//   §1.4 75vh 锁定 + 结果区独立滚动
//   §1.5 用户只能拖宽,不能拖高
//   §1.7 textarea 8 行封顶
//   §4   清空回缩 / 引擎依次到达分次扩张

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
    test('initial window height = input area only (no result cards)', async () => {
        const omni = await AppFixture.start({ config: single_service_config })
        try {
            await omni.translate()
            const bounds = (await omni.api.windowState('translate')).bounds
            if (!bounds) throw new Error('missing bounds')
            // 初始无翻译请求 → TargetArea 返回 null → 窗口只占输入区
            expect(bounds.height).toBeLessThanOrEqual(220)
            expect(bounds.height).toBeGreaterThan(80)
        } finally { await omni.stop() }
    })

    test('textarea grows to 8 lines max, window height tops out', async () => {
        const omni = await AppFixture.start({ config: single_service_config })
        try {
            const translate = await omni.translate()
            const initial = (await omni.api.windowState('translate')).bounds?.height ?? 0

            await translate.typeSource('line1\nline2\nline3')
            const h3 = (await omni.api.windowState('translate')).bounds?.height ?? 0
            expect(h3).toBeGreaterThan(initial)

            await translate.typeSource('1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12')
            const h12 = (await omni.api.windowState('translate')).bounds?.height ?? 0
            // 8 行 × ~24px 行高 = 192;加 chrome ≈ 80 → 上限 ≈ initial + 200
            expect(h12).toBeLessThanOrEqual(initial + 220)
        } finally { await omni.stop() }
    })

    test('two engines: window expands per arriving result', async () => {
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

    test('content exceeding 75vh locks window and triggers results-only scroll', async () => {
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
            const display = await omni.api.primaryDisplay()
            const expected_max = Math.floor(display.workArea.height * 0.75)
            if (!bounds) throw new Error('missing bounds')
            expect(Math.abs(bounds.height - expected_max)).toBeLessThanOrEqual(4)

            const page = translate.page
            const has_scroll = await page.evaluate(() => {
                const el = document.querySelector('[data-testid="translate-results-scroll"]')
                if (!el) return false
                return el.scrollHeight > el.clientHeight
            })
            expect(has_scroll).toBe(true)

            // 滚动时 SourceArea 视觉位置不动:取滚动前后 source-input 的 bounding rect.top
            const top_before = await page.evaluate(() => {
                return document.querySelector('[data-testid="source-input"]')?.getBoundingClientRect().top ?? 0
            })
            await page.evaluate(() => {
                document.querySelector('[data-testid="translate-results-scroll"]')?.scrollBy(0, 300)
            })
            const top_after = await page.evaluate(() => {
                return document.querySelector('[data-testid="source-input"]')?.getBoundingClientRect().top ?? 0
            })
            expect(Math.abs(top_after - top_before)).toBeLessThanOrEqual(1)
        } finally { await server.stop(); await omni.stop() }
    })

    test('user can resize width but not height', async () => {
        const omni = await AppFixture.start({ config: single_service_config })
        try {
            const translate = await omni.translate()
            const before = (await omni.api.windowState('translate')).bounds
            if (!before) throw new Error('missing bounds')

            await translate.resizeWindowTo(before.width + 200, before.height + 400)
            const after = (await omni.api.windowState('translate')).bounds
            if (!after) throw new Error('missing bounds')

            expect(after.width).toBeGreaterThan(before.width)
            expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(2)
        } finally { await omni.stop() }
    })

    test('clearing source after translation collapses window back to initial', async () => {
        const omni = await AppFixture.start({ config: single_service_config })
        const server = await omni.startTranslationTestServer()
        try {
            const translate = await omni.translate()
            const initial = (await omni.api.windowState('translate')).bounds?.height ?? 0

            server.set_mymemory_response({ translated_text: 'temp', status: 200 })
            await translate.typeSource('hi')
            await translate.clickTranslate()
            await translate.waitAllResults(30_000)

            await translate.clearSource()  // 清空输入并 clearResults
            await translate.page.waitForTimeout(200)

            const after = (await omni.api.windowState('translate')).bounds?.height ?? 0
            // hasAnyRequest=false → TargetArea null → 应恢复到 initial(允许 ±4px)
            expect(Math.abs(after - initial)).toBeLessThanOrEqual(4)
        } finally { await server.stop(); await omni.stop() }
    })

    test('window width has no upper bound up to MAX_W_SENTINEL', async () => {
        // 对应 spec §10:不限制最大宽度
        const omni = await AppFixture.start({ config: single_service_config })
        try {
            const translate = await omni.translate()
            const before = (await omni.api.windowState('translate')).bounds?.width ?? 0
            await translate.resizeWindowTo(2000, 0)  // 第二参数 0 表示保持高度
            const after = (await omni.api.windowState('translate')).bounds?.width ?? 0
            expect(after).toBeGreaterThanOrEqual(1800)  // 接近 2000(允许窗口装饰差)
            expect(after).toBeGreaterThan(before)
        } finally { await omni.stop() }
    })
})
```

- [ ] **Step 2: 补 fixture helper**

跑测试前确认下列 helper 存在,缺失就加:

- `omni.api.primaryDisplay(): Promise<{ workArea: { x: number; y: number; width: number; height: number } }>` — 主进程侧 expose `screen.getPrimaryDisplay().workArea`。
- `translate.page: Page` — `AppFixture.translate()` 返回的对象暴露 `page`(若现在已是 `as unknown as { page: Page }`,改成正式字段)。
- `translate.clearSource(): Promise<void>` — 在 textarea 上做 select-all + delete,同时确保 `clearResults` 被调用(可通过点击 SourceArea 的 trash 按钮 `data-testid="source-clear-btn"`,但还得在 store 端清结果——可加 helper 直接调用 `useTranslateStore.getState().clearResults()`,在 Window 上挂一个 `__e2e_clear_translate` 测试 hook)。

每补一个 helper 单独 commit(可选)。

- [ ] **Step 3: 跑新 spec**

Run: `npm run test:e2e -- tests/user_e2e/specs/translate_window_resize.spec.ts`
Expected: PASS(7/7)

- [ ] **建议 commit(可选):**

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

- [ ] **Step 4: 全部 e2e**

Run: `npm run test:e2e:core && npm run test:e2e:ui`
Expected: PASS

- [ ] **Step 5: 打包冒烟**

Run: `npm run dist:dir`
Expected: 构建成功并自动启动 unpacked。手动验证:翻译窗口高度锁定、宽度可拖、结果区独立滚动、清空回缩。

---

## Task 13: 文档同步

**Files:**
- Modify: `docs/spec.md`
- Modify: `TASKS.md`

- [ ] **Step 1: 在 `docs/spec.md` 翻译窗口章节补充**

Run: `grep -n "翻译窗口" docs/spec.md | head -10`
找到定位,追加段落:

```markdown
### 窗口尺寸与滚动

- 最小宽度 360px,无最大宽度上限(实现层用 MAX_W_SENTINEL=100000),用户可拖宽。
- 高度由主进程锁定,用户**不可**手动调整;实际高度 = clamp(内容自然高度, 初始高度, floor(workArea.height × 0.75))。
- 内容超出上限时,结果区(`ResultsScroll`)内部滚动,输入区与语言条固定在窗口顶部不滚动。
- 未触发翻译时不渲染任何卡片;触发后每个引擎卡片初始为折叠态(只显示 header 一行),结果返回后自动展开 body,窗口分次扩张。
- 输入框 textarea 自动增长,最多 8 行,>8 行时 textarea 内部滚动,窗口高度不再增加。
- 实现细节:专属 IPC `translate:reportContentHeight`;通用 `window:setContentHeight` 不参与本窗口。
```

- [ ] **Step 2: 在 `TASKS.md` 标记完成**

追加:

```markdown
- [x] 2026-05-24 翻译窗口尺寸/滚动改造:输入固定、结果区滚动、高度锁定、宽度可拖
      规格:docs/superpowers/specs/2026-05-24-translate-window-resize-design.md
      计划:docs/superpowers/plans/2026-05-24-translate-window-resize.md
```

- [ ] **建议 commit(可选):**

```bash
git add docs/spec.md TASKS.md
git commit -m "docs: 同步翻译窗口尺寸/滚动改造文档"
```

---

## Self-Review Notes

(对应 review.md 的 9 点修订:)

1. **结果区状态机** — Task 7+9 引入 `hasAnyRequest`,无翻译请求时 TargetArea 返回 null,初始窗口确实只含输入区;Task 11 第 1 个 case 验证。
2. **不读滚动容器 scrollHeight** — Task 7 新增 `results_content_ref` 内层节点;Task 8 reporter 与 ResizeObserver 都读/观察该内层节点。
3. **ResizeObserver 观察内容节点** — 同 §2。
4. **`setMaximumSize` 宽度参数** — Task 0 加入实测验证步骤;改用 `MAX_W_SENTINEL=100000` 代替 `0`(spec 也同步)。
5. **IPC 名称统一** — 改用 `translate:reportContentHeight`,spec 同步更新。
6. **CSS 路径** — Task 1 统一改为 `src/styles/globals.css`。
7. **不删除旧 e2e** — Task 10 改写两个既有 case(改 stub + 改 75vh 语义),保留覆盖。
8. **Commit 改可选** — 头部新增"Commit 约定"段;每个 Task 的 commit 步骤改为"建议 commit(可选)"。
9. **删除 Tech Stack** — 头部不再有 Tech Stack 段。
