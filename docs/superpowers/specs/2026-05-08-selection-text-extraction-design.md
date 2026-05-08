# 跨平台选中文本提取设计

> 日期: 2026-05-08
> 目标平台: Windows + macOS
> 实现方式: koffi FFI 调用系统 API + 剪贴板回退

---

## 1. 模块结构

```
electron/selection/
├── index.ts          # 统一入口：readSelectedText()/getSelectedText() → 按 platform 分发
├── windows.ts        # UI Automation COM (koffi) → Ctrl+C 回退
├── darwin.ts         # Accessibility API (koffi/objc) → Cmd+C 回退
├── clipboard.ts      # 剪贴板全格式备份/恢复 + sentinel 检测（两个平台回退共用）
└── permissions.ts    # macOS Accessibility 权限检查/引导
```

## 2. 核心接口

```typescript
// electron/selection/index.ts
export type SelectionMethod = 'uia' | 'accessibility' | 'clipboard' | 'none'
export type SelectionFailureReason =
  | 'empty'
  | 'permission-denied'
  | 'unsupported-platform'
  | 'copy-failed'
  | 'error'

export interface SelectedTextResult {
  text: string
  method: SelectionMethod
  reason?: SelectionFailureReason
  error?: unknown
}

export async function readSelectedText(): Promise<SelectedTextResult>
export async function getSelectedText(): Promise<string>
```

`readSelectedText()` 用于主流程，保留失败原因用于日志和权限提示；`getSelectedText()` 是兼容包装，只返回 `text`。

### 调用方和时序

**必须在 main 进程、翻译窗口聚焦/创建之前读取选区。**

原因：当前用户选区属于前台第三方应用。若先 `focusOrCreate(translate)`，焦点会切到翻译窗口，UI Automation / Accessibility / 模拟复制都会读错目标。

修改 `electron/hotkey/index.ts` 和 `electron/server/index.ts` 的划词翻译入口：

```typescript
import { readSelectedText } from '../selection'
import { WindowLabel } from '../windows/types'

const TRANSLATE_OPTS = { label: WindowLabel.TRANSLATE, width: 350, height: 420 }

export async function triggerSelectionTranslate(mgr: WindowManager): Promise<void> {
    // 1. 先在当前前台应用仍然有焦点时读取选区
    const result = await readSelectedText()

    if (!result.text.trim()) {
        logSelectionFailure(result)
        maybeShowPermissionGuide(result)
        return
    }

    // 2. 再创建/显示翻译窗口，把文本作为 payload 传给 renderer
    mgr.focusOrCreate(WindowLabel.TRANSLATE, TRANSLATE_OPTS)
    mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-selection', result.text)
}
```

修改 renderer/preload 事件契约：

```typescript
// electron/preload.ts
onTranslateFromSelection: (callback: (text: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, text: string) => callback(text)
    ipcRenderer.on('translate:from-selection', handler)
    return () => { ipcRenderer.off('translate:from-selection', handler) }
}
```

```typescript
// src/windows/translate/index.tsx
window.electronAPI.text.onTranslateFromSelection((text: string) => {
    if (!text.trim()) return
    const processed = deleteNewline ? text.replace(/-\s+/g, '').replace(/\s+/g, ' ') : text
    const currentText = useTranslateStore.getState().sourceText
    const nextText = incrementalTranslate && currentText ? currentText + ' ' + processed : processed
    setSourceText(nextText)
    setForceShowSource(false)
    setTimeout(() => handleTranslate(nextText), 0)
})
```

`electron/ipc/text_handlers.ts` 可以保留诊断/手动调用入口，但热键和 HTTP `/selection_translate` 不能依赖 renderer 再调用它：

```typescript
import { readSelectedText } from '../selection'

ipcMain.handle('text:getSelection', async (): Promise<string> => {
    return (await readSelectedText()).text
})
```

## 3. Windows 实现

### 3.1 主方案：UI Automation

用 `koffi` 加载 COM 组件：

1. `ole32.dll` → `CoInitializeEx` 初始化 COM（STA 模式）
2. `ole32.dll` → `CoCreateInstance(CLSID_CUIAutomation, null, CLSCTX_INPROC_SERVER, IID_IUIAutomation, out)` 创建 `IUIAutomation`
3. `IUIAutomation::GetFocusedElement` 获取焦点元素
4. `IUIAutomation::Element::GetCurrentPattern(UIA_TextPatternId)` 查询 TextPattern
5. `IUIAutomationTextPattern::GetSelection` 获取 `IUIAutomationTextRangeArray`
6. `IUIAutomationTextRangeArray::get_Length` / `GetElement(i)` 遍历所有选中范围
7. `IUIAutomationTextRange::GetText(-1, out BSTR)` 读取文本
8. 用 `SysFreeString` 释放 BSTR；所有 COM 指针按相反顺序 `Release`

关键 COM 接口 IID/CLSID（硬编码常量）：
- `CLSID_CUIAutomation`: `{ff48dba4-60ef-4201-aa87-54103eef594e}`
- `IID_IUIAutomation`: `{30cbe57d-d9d0-452a-ab13-7ac5ac4825ee}`
- `UIA_TextPatternId`: 10014

实现要求：
- 所有 HRESULT 必须检查；失败只降级到回退，不向调用方抛异常。
- 需要显式声明 COM vtable，并为每个接口封装 `Release`，避免主进程长期运行后泄漏。
- 多选范围按顺序用 `\n` 拼接。
- `CoUninitialize` 只在当前调用成功初始化 COM 时执行；若进程/线程已有不同 COM 模式，记录 warning 并继续尝试或降级。

### 3.2 回退方案：Ctrl+C + 剪贴板

1. 调 `withClipboardMutationSuppressed()`，让剪贴板监听忽略本次临时写入
2. `backupClipboard()` 备份 Electron 可见的全部格式（text/html/rtf/bookmark/image/raw formats）
3. 写入随机 sentinel 文本，例如 `__OMNI_POT_COPY_SENTINEL_${nanoid()}__`
4. 用 `user32.SendInput` 模拟 `Ctrl+C`（通过 koffi 调用，避免引入 native module）
5. 轮询剪贴板，直到文本不等于 sentinel 或超时（建议 300ms，间隔 20ms）
6. `finally` 恢复原剪贴板全部格式
7. 若最终文本仍是 sentinel，返回 `copy-failed`

不要用 `newText === backup` 判断复制失败；选中文本可能刚好等于原剪贴板文本。

### 3.3 调用链

```typescript
// windows.ts
async function readSelectedTextWindows(): Promise<SelectedTextResult> {
    // 主方案
    const text = await getTextByUIAutomation()
    if (text) return { text, method: 'uia' }

    // 回退
    return getSelectedTextViaClipboard(() => sendCtrlC())
}
```

## 4. macOS 实现

### 4.1 主方案：Accessibility API

用 `koffi` 调 Objective-C runtime：

1. `objc_getClass("NSWorkspace")` → `sharedWorkspace` → `frontmostApplication` → 获取 PID
2. `AXUIElementCreateApplication(pid)` 创建目标应用 AX 元素
3. 获取焦点元素：`AXUIElementCopyAttributeValue(app, kAXFocusedUIElementAttribute)`
4. 读取选中文字：`AXUIElementCopyAttributeValue(focused, kAXSelectedTextAttribute)`

需要通过 `koffi` 加载的符号（`/usr/lib/libobjc.A.dylib`）：
- `objc_getClass`
- `sel_registerName`
- `objc_msgSend`（及其变体 `objc_msgSend_stret` 等）

macOS Accessibility 需要权限：
- 应用需要在 Info.plist 声明 `NSAccessibilityUsageDescription`
- Electron 打包配置需要注入该字段；当前仓库尚无打包配置文件，接入打包时必须补齐
- 读取前调用 `AXIsProcessTrustedWithOptions` 检查权限，可在需要时触发系统授权提示
- 权限被拒绝时返回 `{ text: '', method: 'none', reason: 'permission-denied' }`，并引导用户到系统设置

### 4.2 回退方案：AppleScript + 剪贴板

剪贴板备份、sentinel、恢复全部由 `clipboard.ts` 统一处理；AppleScript 只负责发送 Cmd+C：

```bash
osascript -e 'tell application "System Events" to keystroke "c" using command down'
```

注意：
- AppleScript/System Events 也可能需要 Accessibility/Automation 权限，不应被视为无权限兜底。
- 静音处理若实现，必须在 `try/finally` 中恢复系统音量/提示音状态；默认不建议为了复制改全局系统设置。

### 4.3 调用链

```typescript
// darwin.ts
async function readSelectedTextDarwin(): Promise<SelectedTextResult> {
    const permission = await checkAccessibilityPermission()
    if (!permission.trusted) {
        return { text: '', method: 'none', reason: 'permission-denied' }
    }

    // 主方案
    const text = await getTextByAccessibility()
    if (text) return { text, method: 'accessibility' }

    // 回退
    return getSelectedTextViaClipboard(() => sendCommandCByAppleScript())
}
```

## 5. 剪贴板备份/恢复（共用）

```typescript
// clipboard.ts
import { clipboard, type NativeImage } from 'electron'

interface ClipboardBackup {
    formats: string[]
    text?: string
    html?: string
    rtf?: string
    bookmark?: { title: string; url: string }
    image?: NativeImage
    raw: Array<{ format: string; data: Buffer }>
}

function backupClipboard(): ClipboardBackup {
    const formats = clipboard.availableFormats()
    return {
        formats,
        text: clipboard.readText(),
        html: clipboard.readHTML(),
        rtf: clipboard.readRTF(),
        bookmark: clipboard.readBookmark(),
        image: clipboard.readImage(),
        raw: formats.map((format) => ({ format, data: clipboard.readBuffer(format) }))
    }
}

function restoreClipboard(backup: ClipboardBackup): void {
    const payload: Electron.Data = {}
    if (backup.text) payload.text = backup.text
    if (backup.html) payload.html = backup.html
    if (backup.rtf) payload.rtf = backup.rtf
    if (backup.bookmark?.title || backup.bookmark?.url) {
        payload.text = backup.bookmark.url || payload.text
        payload.bookmark = backup.bookmark.title
    }
    if (backup.image && !backup.image.isEmpty()) payload.image = backup.image

    clipboard.clear()
    if (Object.keys(payload).length > 0) {
        clipboard.write(payload)
    }

    // 对 Electron 标准 payload 未覆盖的格式做 best-effort 恢复；需要按平台验证 writeBuffer 不会破坏标准 payload。
    for (const { format, data } of backup.raw) {
        if (data.length > 0) clipboard.writeBuffer(format, data)
    }
}

export async function getSelectedTextViaClipboard(
    simulateCopy: () => Promise<void>
): Promise<SelectedTextResult> {
    return withClipboardMutationSuppressed(async () => {
        const backup = backupClipboard()
        const sentinel = `__OMNI_POT_COPY_SENTINEL_${crypto.randomUUID()}__`

        try {
            clipboard.writeText(sentinel)
            await simulateCopy()

            const newText = await waitForClipboardTextChange(sentinel, {
                timeoutMs: 300,
                intervalMs: 20
            })

            if (!newText || newText === sentinel) {
                return { text: '', method: 'clipboard', reason: 'copy-failed' }
            }

            return { text: newText, method: 'clipboard' }
        } finally {
            restoreClipboard(backup)
        }
    })
}
```

### 剪贴板监听隔离

`electron/clipboard/index.ts` 增加抑制窗口：

```typescript
let clipboardMutationSuppressUntil = 0

export async function withClipboardMutationSuppressed<T>(fn: () => Promise<T>): Promise<T> {
    clipboardMutationSuppressUntil = Date.now() + 1000
    try {
        return await fn()
    } finally {
        clipboardMutationSuppressUntil = Date.now() + 200
    }
}

// 监听轮询中：
if (Date.now() < clipboardMutationSuppressUntil) {
    last_text = clipboard.readText()
    return
}
```

这样 Ctrl+C/Cmd+C 回退不会被 `clipboard_monitor` 误识别成用户主动复制。

## 6. 错误处理策略

```
readSelectedText()
├── 主方案成功且非空 → 返回 { text, method }
├── 主方案成功但为空 → 走回退
├── 主方案抛异常 → log warning + 走回退
├── 回退成功且非空 → 返回 { text, method: 'clipboard' }
├── 回退成功但为空 → 返回 { text: '', method: 'clipboard', reason: 'copy-failed' }
├── 权限不足 → 返回 { text: '', method: 'none', reason: 'permission-denied' }
└── 回退抛异常 → log warning + 返回 { text: '', method: 'none', reason: 'error', error }
```

主入口不向业务调用方抛错，但必须保留 `reason` 供日志、权限引导和测试断言使用。

## 7. 依赖

| 包 | 用途 | 平台 | 备注 |
|---|---|---|---|
| `koffi` | FFI 调用系统动态库 | 全平台 | 纯 JS，无编译 |

Windows 模拟按键通过 `koffi` 调 `user32.SendInput`，不引入 `robotjs`，避免 Electron native module rebuild 风险。

macOS 回退用 `child_process.execFile` 调 `osascript`，无需额外 npm 依赖。不要使用 `execSync` 阻塞主进程；需要设置超时并捕获 stderr。

## 8. 权限与注意事项

### Windows
- UI Automation 无需特殊权限
- 模拟 Ctrl+C 在 UAC 提权的应用中可能无效

### macOS
- Accessibility API 需要在系统偏好设置中授权
- 需要在最终打包配置中添加 `NSAccessibilityUsageDescription`
- 首次使用前主动检查权限；无权限时给用户明确引导，不要静默返回空文本
- AppleScript fallback 也可能需要 Accessibility/Automation 权限

### 当前仓库接入注意
- 当前 `package.json` 尚未包含 `koffi`，接入实现时需同步更新 `package.json` 和 `package-lock.json`
- 当前仓库未看到 `electron-builder.yml`，macOS Info.plist 注入应随打包配置一并补齐
- 若后续引入 asar 打包，需要确认 `koffi` 能加载系统动态库且自身文件未被错误打包到不可加载位置

## 9. 测试策略

- 单元测试：mock koffi 调用，验证主方案和回退的切换逻辑、失败 reason、异常降级
- 单元测试：剪贴板 helper 必须覆盖 text/html/rtf/image/raw format 备份恢复、`finally` 恢复、选中文本等于原剪贴板文本、复制失败 sentinel 未变化
- 单元测试：`withClipboardMutationSuppressed` 期间剪贴板监听不触发翻译
- 集成测试：在真实 Electron 环境中打开记事本/文本编辑器，选中文字，通过 main 进程 `triggerSelectionTranslate()` 验证取到的是外部应用选区，而不是翻译窗口文本
- 权限测试：macOS 未授权 Accessibility 时返回 `permission-denied`，并能触发/展示授权引导
- 手动测试矩阵：

| 应用 | Windows UI Automation | Windows Ctrl+C 回退 | macOS Accessibility | macOS AppleScript 回退 |
|------|----------------------|---------------------|---------------------|----------------------|
| 记事本 / TextEdit | ✅ | ✅ | ✅ | ✅ |
| Chrome / Edge | ✅ | ✅ | ✅ | ✅ |
| Word / Pages | ✅ | ✅ | ✅ | ✅ |
| VS Code | ✅ | ✅ | ✅ | ✅ |
| 终端 / Terminal | ❌ (无 TextPattern) | ✅ | ⚠️ (部分) | ✅ |

额外手动场景：
- 启用 `clipboard_monitor=true` 后触发划词翻译，不应额外触发剪贴板翻译
- 原剪贴板为图片、HTML 富文本、文件路径/自定义格式时，划词翻译后应恢复原剪贴板
- 原剪贴板文本与选中文本相同，也应成功翻译
- 翻译窗口原本关闭、正在加载、已打开但失焦三种状态下，均应先取外部选区再显示/更新窗口
