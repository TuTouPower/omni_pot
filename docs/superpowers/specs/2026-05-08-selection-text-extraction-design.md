# 跨平台选中文本提取设计

> 日期: 2026-05-08
> 目标平台: Windows + macOS
> 实现方式: koffi FFI 调用系统 API + 剪贴板回退

---

## 1. 模块结构

```
electron/selection/
├── index.ts          # 统一入口：getSelectedText() → 按 platform 分发
├── windows.ts        # UI Automation COM (koffi) → Ctrl+C 回退
├── darwin.ts         # Accessibility API (koffi/objc) → AppleScript 回退
└── clipboard.ts      # 剪贴板备份/恢复（两个平台回退共用）
```

## 2. 核心接口

```typescript
// electron/selection/index.ts
export async function getSelectedText(): Promise<string>
```

一个函数，隐藏所有平台细节。

### 调用方

修改 `electron/ipc/text_handlers.ts`：

```typescript
import { getSelectedText } from '../selection'

ipcMain.handle('text:getSelection', async (): Promise<string> => {
    return getSelectedText()
})
```

## 3. Windows 实现

### 3.1 主方案：UI Automation

用 `koffi` 加载 COM 组件：

1. `ole32.dll` → `CoInitializeEx` 初始化 COM（STA 模式）
2. `uiautomationcore.dll` → `CUIAutomation` 创建 `IUIAutomation` 实例
3. `IUIAutomation::GetFocusedElement` 获取焦点元素
4. `IUIAutomation::Element::GetCurrentPattern(UIA_TextPatternId)` 查询 TextPattern
5. `ITextPattern::GetSelection` 获取选中范围
6. `ITextRange::GetText` 读取文本

关键 COM 接口 IID/CLSID（硬编码常量）：
- `CLSID_CUIAutomation`: `{ff48dba4-60ef-4201-aa87-54103eef594e}`
- `IID_IUIAutomation`: `{30cbe57d-d9d0-452a-ab13-7ac5ac4825ee}`
- `UIA_TextPatternId`: 10014

### 3.2 回退方案：Ctrl+C + 剪贴板

1. `clipboard.readText()` 备份当前剪贴板
2. `robotjs.keyTap('c', ['control'])` 模拟 Ctrl+C
3. 等待 100ms
4. 读取新剪贴板内容
5. 恢复原剪贴板

### 3.3 调用链

```typescript
// windows.ts
async function getSelectedTextWindows(): Promise<string> {
    // 主方案
    const text = await getTextByUIAutomation()
    if (text) return text

    // 回退
    return getTextByClipboard()
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
- Electron 打包时通过 `electron-builder` 的 `extendInfo` 配置
- 首次使用时系统弹窗请求辅助功能权限

### 4.2 回退方案：AppleScript + 剪贴板

```bash
osascript -e 'set saved to the clipboard as text' \
          -e 'tell application "System Events" to keystroke "c" using command down' \
          -e 'delay 0.1' \
          -e 'set selectedText to the clipboard as text' \
          -e 'set the clipboard to saved' \
          -e 'return selectedText'
```

静音处理：模拟复制前关闭系统提示音，复制后恢复。

### 4.3 调用链

```typescript
// darwin.ts
async function getSelectedTextDarwin(): Promise<string> {
    // 主方案
    const text = await getTextByAccessibility()
    if (text) return text

    // 回退
    return getTextByAppleScript()
}
```

## 5. 剪贴板备份/恢复（共用）

```typescript
// clipboard.ts
import { clipboard } from 'electron'

export async function getSelectedTextViaClipboard(
    simulateCopy: () => Promise<void>
): Promise<string> {
    const backup = clipboard.readText()

    await simulateCopy()
    await sleep(100)

    const newText = clipboard.readText()

    // 恢复原内容
    if (backup && backup.length > 0) {
        clipboard.writeText(backup)
    } else {
        clipboard.clear()
    }

    // 新旧相同说明复制失败
    return newText === backup ? '' : (newText ?? '')
}
```

## 6. 错误处理策略

```
getSelectedText()
├── 主方案成功且非空 → 返回文本
├── 主方案成功但为空 → 走回退
├── 主方案抛异常 → log warning + 走回退
├── 回退成功且非空 → 返回文本
├── 回退成功但为空 → 返回 ''
└── 回退抛异常 → log warning + 返回 ''
```

永远不抛错，调用方无需 try/catch。

## 7. 依赖

| 包 | 用途 | 平台 | 备注 |
|---|---|---|---|
| `koffi` | FFI 调用系统动态库 | 全平台 | 纯 JS，无编译 |
| `robotjs` | 模拟键盘按键 | Windows | 需 node-gyp 编译 |

macOS 回退用 `child_process.execSync` 调 `osascript`，无需额外依赖。

## 8. 权限与注意事项

### Windows
- UI Automation 无需特殊权限
- 模拟 Ctrl+C 在 UAC 提权的应用中可能无效

### macOS
- Accessibility API 需要在系统偏好设置中授权
- 需要在 `electron-builder.yml` 的 `extendInfo` 中添加 `NSAccessibilityUsageDescription`
- 首次使用时需引导用户授权

## 9. 测试策略

- 单元测试：mock koffi 调用，验证主方案和回退的切换逻辑
- 集成测试：在真实 Electron 环境中打开记事本/文本编辑器，选中文字，调用 `getSelectedText()` 验证
- 手动测试矩阵：

| 应用 | Windows UI Automation | Windows Ctrl+C 回退 | macOS Accessibility | macOS AppleScript 回退 |
|------|----------------------|---------------------|---------------------|----------------------|
| 记事本 / TextEdit | ✅ | ✅ | ✅ | ✅ |
| Chrome / Edge | ✅ | ✅ | ✅ | ✅ |
| Word / Pages | ✅ | ✅ | ✅ | ✅ |
| VS Code | ✅ | ✅ | ✅ | ✅ |
| 终端 / Terminal | ❌ (无 TextPattern) | ✅ | ⚠️ (部分) | ✅ |
