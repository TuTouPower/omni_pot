# Cross-Platform Selected Text Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement OS-level selected text reading for selection translate. Windows uses UI Automation first, macOS uses Accessibility first, and both fall back to temporary Ctrl/Cmd+C with full clipboard restore.

**Architecture:** Add `electron/selection/` as the main-process selection boundary. Hotkey and E2E server flows must read selection while the foreground third-party app still owns focus, then create/focus the translate window and send the selected text as IPC payload.

**Tech Stack:** Electron main process, TypeScript, `koffi`, Electron clipboard API, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-08-selection-text-extraction-design.md`

---

## Non-Negotiable Invariants

- Selection text is read before calling `focusOrCreate(WindowLabel.TRANSLATE, ...)`.
- If the translate window is already visible, the selection hotkey hides it without reading selection or touching the clipboard.
- Clipboard fallback uses a random sentinel and never compares against the previous clipboard text to decide success.
- Clipboard fallback always restores the original clipboard in `finally`, including image/html/rtf/raw formats where Electron can represent them.
- Clipboard fallback is suppressed from `clipboard_monitor`.
- Platform modules are dynamically imported so Windows DLLs are not loaded on macOS/Linux and macOS frameworks are not loaded on Windows/Linux.
- Native FFI implementation is not accepted until a local smoke script proves the exact vtable/function signatures on the target OS.

---

## File Structure

**New files:**

- `electron/selection/index.ts` - unified `readSelectedText()` / `getSelectedText()` entry point.
- `electron/selection/clipboard.ts` - backup/restore, sentinel polling, clipboard fallback.
- `electron/selection/windows.ts` - Windows UI Automation + `SendInput` Ctrl+C fallback.
- `electron/selection/darwin.ts` - macOS Accessibility + AppleScript Cmd+C fallback.
- `electron/selection/permissions.ts` - macOS Accessibility permission helpers.
- `tests/unit/selection/test_clipboard.ts` - clipboard helper tests.
- `tests/unit/selection/test_index.ts` - platform dispatch tests.
- `tests/unit/selection/test_clipboard_monitor.ts` - monitor suppression tests.

**Modified files:**

- `package.json` / `package-lock.json` - add `koffi`.
- `electron/clipboard/index.ts` - add suppression and testable poll function.
- `electron/hotkey/index.ts` - read selection before focusing translate window.
- `electron/preload.ts` - receive selected text as IPC event argument.
- `electron/ipc/text_handlers.ts` - use `getSelectedText()`.
- `electron/server/index.ts` - update `/trigger-selection`.
- `shared/types/ipc.ts` - update `onTranslateFromSelection` signature.
- `src/windows/translate/index.tsx` - consume IPC text directly.
- `tests/user_e2e/01_selection_translate.test.ts` and helpers - deterministic E2E trigger.

---

## Task 1: Dependency and Public Types

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `electron/selection/index.ts`

- [ ] **Step 1: Install `koffi`**

```bash
cd /mnt/d/Kar/Code/omni_pot
npm install koffi
```

- [ ] **Step 2: Create the shared result types**

```typescript
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
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json electron/selection/index.ts
git commit -m "feat(selection): add koffi dependency and selection result types"
```

---

## Task 2: Clipboard Backup/Restore and Sentinel Fallback

**Files:**

- Create: `electron/selection/clipboard.ts`

- [ ] **Step 1: Implement clipboard backup and restore**

Implementation requirements:

- Import `randomUUID` from `crypto`; do not rely on a renderer/global `crypto` shape.
- Capture `availableFormats()`, `text`, `html`, `rtf`, `bookmark`, `image`, and `readBuffer(format)` for every format.
- Restore in `finally`.
- Use `clipboard.write()` for standard Electron payload first, then restore raw formats with `writeBuffer()` only when the raw data is non-empty.
- Keep `backupClipboard()` / `restoreClipboard()` exported or otherwise testable through `getSelectedTextViaClipboard()`.

- [ ] **Step 2: Implement sentinel polling**

`getSelectedTextViaClipboard(simulateCopy, withSuppression)` must:

- Call `withSuppression(async () => ...)`.
- Backup clipboard before writing the sentinel.
- Write sentinel text: `__OMNI_POT_COPY_SENTINEL_${randomUUID()}__`.
- Await `simulateCopy()`.
- Poll every 20ms for up to 300ms.
- Return `{ text: newText, method: 'clipboard' }` when current text differs from sentinel and is non-empty.
- Return `{ text: '', method: 'clipboard', reason: 'copy-failed' }` when text stays sentinel or becomes empty.
- Return `{ text: '', method: 'clipboard', reason: 'error', error }` if simulation or clipboard handling throws, after restoring clipboard.

Do not compare copied text with the original clipboard. The selected text may intentionally equal the old clipboard text.

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add electron/selection/clipboard.ts
git commit -m "feat(selection): add clipboard fallback with sentinel restore"
```

---

## Task 3: Clipboard Monitor Suppression

**Files:**

- Modify: `electron/clipboard/index.ts`

- [ ] **Step 1: Add suppression state**

Add a module-level timestamp and wrapper:

```typescript
let suppressUntil = 0

export async function withClipboardMutationSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  suppressUntil = Date.now() + 1000
  try {
    return await fn()
  } finally {
    suppressUntil = Date.now() + 200
  }
}
```

- [ ] **Step 2: Extract one poll tick for testing**

Refactor the interval callback into an exported function so tests can exercise it without waiting for a real timer:

```typescript
export function pollClipboardMonitorOnce(mgr: WindowManager): void {
  if (!enabled) return

  const current = clipboard.readText()
  if (Date.now() < suppressUntil) {
    last_text = current
    return
  }

  if (current !== last_text && current.trim()) {
    last_text = current
    mgr.focusOrCreate(WindowLabel.TRANSLATE, TRANSLATE_OPTS)
    mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-clipboard', current)
  }
}
```

`startClipboardMonitor()` should call `pollClipboardMonitorOnce(mgr)` from `setInterval`.

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add electron/clipboard/index.ts
git commit -m "feat(clipboard): suppress monitor during selection fallback"
```

---

## Task 4: Windows UI Automation and Ctrl+C Fallback

**Files:**

- Create: `electron/selection/windows.ts`

- [ ] **Step 1: Implement `SendInput` fallback first**

Implement `sendCtrlC()` with `user32.SendInput`. Requirements:

- Send exactly four keyboard inputs: Ctrl down, C down, C up, Ctrl up.
- Check the return value from `SendInput`; if it is not `4`, throw an error so clipboard fallback can return `error`.
- Keep the function async-compatible: `async function sendCtrlC(): Promise<void>`.
- Use `getSelectedTextViaClipboard(() => sendCtrlC(), withClipboardMutationSuppressed)` as fallback.

- [ ] **Step 2: Add UI Automation COM implementation**

Use `koffi` to call UI Automation COM, but do not copy unverified vtable offsets. The required offsets are:

| Interface | Method | Vtable index |
|---|---:|---:|
| `IUnknown` | `Release` | 2 |
| `IUIAutomation` | `GetFocusedElement` | 8 |
| `IUIAutomationElement` | `GetCurrentPattern` | 16 |
| `IUIAutomationTextPattern` | `GetSelection` | 5 |
| `IUIAutomationTextRangeArray` | `get_Length` | 3 |
| `IUIAutomationTextRangeArray` | `GetElement` | 4 |
| `IUIAutomationTextRange` | `GetText` | 12 |

Implementation requirements:

- Use `CoInitializeEx(null, COINIT_APARTMENTTHREADED)`.
- Treat `RPC_E_CHANGED_MODE` as a reason to skip UIA and fall back, unless the smoke test proves calls are safe in the current thread mode.
- Use proper GUID structs for `CLSID_CUIAutomation` and `IID_IUIAutomation`; do not pass ambiguous raw buffers without a verified koffi mapping.
- Check every HRESULT. UIA failure returns `null` and falls back to clipboard.
- Release every COM pointer in reverse order with `IUnknown::Release`.
- Free every BSTR returned by `GetText` with `SysFreeString`.
- Join multiple selected ranges with `\n`.
- Return trimmed-empty UIA text as no result and fall back.

- [ ] **Step 3: Add a Windows smoke gate**

Before marking this task done, run a small local smoke script or dev-only function on Windows that:

1. Opens Notepad with selected text.
2. Calls `readSelectedTextWindows()`.
3. Logs `{ method, text }`.
4. Confirms method is `uia` for Notepad.
5. Confirms Terminal or another non-TextPattern app falls back to `clipboard`.

If the smoke script fails, fix the koffi pointer/vtable definitions before proceeding. Do not rely on `electron-vite build` as proof that COM calls are correct.

- [ ] **Step 4: Verify**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add electron/selection/windows.ts
git commit -m "feat(selection): add Windows UI Automation selection reader"
```

---

## Task 5: macOS Accessibility and AppleScript Fallback

**Files:**

- Create: `electron/selection/permissions.ts`
- Create: `electron/selection/darwin.ts`

- [ ] **Step 1: Implement Accessibility permission helpers**

Requirements:

- Use `AXIsProcessTrusted()` for a silent check.
- If prompting is needed, call `AXIsProcessTrustedWithOptions()` with a real `CFDictionary` containing `kAXTrustedCheckOptionPrompt: kCFBooleanTrue`; passing `null` does not request a prompt.
- Return `{ trusted: boolean }`.
- Document that final packaging must include `NSAccessibilityUsageDescription`.

- [ ] **Step 2: Implement Accessibility selected text**

Use ApplicationServices/CoreFoundation functions directly. Requirements:

- Get the frontmost app PID via Objective-C runtime or another verified system API.
- Create target app AX element with `AXUIElementCreateApplication(pid)`.
- Create AX attribute names as `CFStringRef` values, for example via `CFStringCreateWithCString(...)`.
- Pass `CFStringRef` attributes to `AXUIElementCopyAttributeValue`; do not pass Objective-C selectors.
- Read `kAXFocusedUIElementAttribute`, then `kAXSelectedTextAttribute`.
- Convert returned `CFStringRef` with `CFStringGetCString` into a buffer. `CFStringGetCStringPtr` may return null and is not sufficient as the only path.
- `CFRelease` all retained CoreFoundation/AX objects.
- Return `null` for empty selected text so fallback can run.

- [ ] **Step 3: Implement AppleScript Cmd+C fallback**

Use `execFile('osascript', ['-e', 'tell application "System Events" to keystroke "c" using command down'], { timeout: 5000 }, ...)`.

Do not use `execSync`. If Accessibility is not trusted, return `{ text: '', method: 'none', reason: 'permission-denied' }`; AppleScript key simulation generally needs the same permission class and should not be treated as a real no-permission fallback.

- [ ] **Step 4: Add a macOS smoke gate**

On macOS, verify:

1. Untrusted Accessibility returns `permission-denied`.
2. TextEdit selected text returns `{ method: 'accessibility' }`.
3. Terminal or another unsupported focused element falls back to `{ method: 'clipboard' }`.
4. Original clipboard is restored after fallback.

- [ ] **Step 5: Verify**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add electron/selection/permissions.ts electron/selection/darwin.ts
git commit -m "feat(selection): add macOS Accessibility selection reader"
```

---

## Task 6: Unified Selection Entry

**Files:**

- Modify: `electron/selection/index.ts`

- [ ] **Step 1: Add dynamic platform dispatch**

```typescript
export async function readSelectedText(): Promise<SelectedTextResult> {
  try {
    if (process.platform === 'win32') {
      const { readSelectedTextWindows } = await import('./windows')
      return await readSelectedTextWindows()
    }

    if (process.platform === 'darwin') {
      const { readSelectedTextDarwin } = await import('./darwin')
      return await readSelectedTextDarwin()
    }

    return { text: '', method: 'none', reason: 'unsupported-platform' }
  } catch (error: unknown) {
    return { text: '', method: 'none', reason: 'error', error }
  }
}

export async function getSelectedText(): Promise<string> {
  return (await readSelectedText()).text
}
```

- [ ] **Step 2: Verify**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add electron/selection/index.ts
git commit -m "feat(selection): add platform selection dispatch"
```

---

## Task 7: Hotkey Integration

**Files:**

- Modify: `electron/hotkey/index.ts`

- [ ] **Step 1: Update selection hotkey action**

Replace only the `hotkey_selection_translate` behavior. Preserve input translate and OCR behavior.

Critical ordering:

```typescript
case 'hotkey_selection_translate':
  return () => { void triggerSelectionTranslate(mgr) }
```

```typescript
async function triggerSelectionTranslate(mgr: WindowManager): Promise<void> {
  const existing = mgr.getWindow(WindowLabel.TRANSLATE)
  if (existing && !existing.isDestroyed() && existing.isVisible()) {
    existing.hide()
    return
  }

  const { readSelectedText } = await import('../selection')
  const result = await readSelectedText()

  if (!result.text.trim()) {
    console.log('[hotkey] selection translate: no text, reason=%s', result.reason ?? 'empty')
    return
  }

  mgr.focusOrCreate(WindowLabel.TRANSLATE, TRANSLATE_OPTS)
  mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-selection', result.text)
}
```

The visible-window toggle check must happen before `readSelectedText()` so hiding the window never triggers Ctrl/Cmd+C fallback.

- [ ] **Step 2: Verify**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add electron/hotkey/index.ts
git commit -m "feat(hotkey): read selected text before showing translate window"
```

---

## Task 8: IPC and Renderer Integration

**Files:**

- Modify: `shared/types/ipc.ts`
- Modify: `electron/preload.ts`
- Modify: `src/windows/translate/index.tsx`
- Modify: `electron/ipc/text_handlers.ts`

- [ ] **Step 1: Change IPC type**

```typescript
onTranslateFromSelection(callback: (text: string) => void): () => void
```

- [ ] **Step 2: Pass event payload through preload**

```typescript
onTranslateFromSelection: (callback) => {
  const handler = (_event: Electron.IpcRendererEvent, text: string) => callback(text)
  ipcRenderer.on('translate:from-selection', handler)
  return () => { ipcRenderer.off('translate:from-selection', handler) }
}
```

- [ ] **Step 3: Consume selected text directly in renderer**

Update the selection listener so it does not call `text:getSelection` after the translate window receives focus.

```typescript
useEffect(() => {
  const unsub = window.electronAPI.text.onTranslateFromSelection((text: string) => {
    if (!text.trim()) return

    const processed = deleteNewline ? text.replace(/-\s+/g, '').replace(/\s+/g, ' ') : text
    const currentText = useTranslateStore.getState().sourceText
    const nextText = incrementalTranslate && currentText ? `${currentText} ${processed}` : processed

    setSourceText(nextText)
    setForceShowSource(false)
    setTimeout(() => handleTranslate(nextText), 0)
  })
  return unsub
}, [deleteNewline, incrementalTranslate, setSourceText, handleTranslate])
```

Passing `nextText` to `handleTranslate()` avoids stale Zustand/React state after `setSourceText()`.

- [ ] **Step 4: Keep diagnostic IPC aligned**

```typescript
import { ipcMain } from 'electron'
import { getSelectedText } from '../selection'

export function registerTextHandlers(): void {
  ipcMain.handle('text:getSelection', async (): Promise<string> => getSelectedText())
}
```

- [ ] **Step 5: Verify**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add shared/types/ipc.ts electron/preload.ts src/windows/translate/index.tsx electron/ipc/text_handlers.ts
git commit -m "feat(selection): pass selected text from main to renderer"
```

---

## Task 9: Server Endpoint and Deterministic E2E Hook

**Files:**

- Modify: `electron/server/index.ts`

- [ ] **Step 1: Update `/trigger-selection` to match hotkey ordering**

For normal runtime, the endpoint must call `readSelectedText()` before focusing the translate window.

- [ ] **Step 2: Add E2E-only text injection**

When `IS_E2E` is true, allow `/trigger-selection` to accept JSON body `{ "text": "..." }`. If provided, use that text instead of OS selection and return `{ success: true, method: 'e2e' }`.

This makes automated E2E deterministic while manual smoke tests still cover real OS selection.

- [ ] **Step 3: Response behavior**

- Empty real OS selection: HTTP 200 with `{ success: false, reason }`.
- E2E injected text: send `translate:from-selection` with injected text.
- Real OS success: send `translate:from-selection` with selected text.
- Unexpected exception: HTTP 500 with `{ success: false, error }`.

- [ ] **Step 4: Verify**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add electron/server/index.ts
git commit -m "feat(server): trigger selection translate from main process"
```

---

## Task 10: Unit Tests for Clipboard Helpers

**Files:**

- Create: `tests/unit/selection/test_clipboard.ts`

- [ ] **Step 1: Mock Electron safely**

Use `vi.hoisted()` for mock state referenced by `vi.mock('electron', ...)`, matching Vitest hoisting semantics.

- [ ] **Step 2: Required test cases**

- Success: `simulateCopy()` changes mock clipboard text from the actual sentinel to selected text.
- Copy failed: mock clipboard remains exactly the sentinel written by `writeText()`.
- Selected text equals original clipboard text: original text is `"same"`, `simulateCopy()` also sets `"same"`, and result is success because sentinel changed.
- Restore after success: verify text/html/rtf/image/raw restore calls.
- Restore after `simulateCopy()` throws: verify result reason is `error` and restore still ran.

Do not hardcode a fake sentinel string. Capture the sentinel passed to `clipboard.writeText()`.

- [ ] **Step 3: Run**

```bash
npx vitest run tests/unit/selection/test_clipboard.ts
```

- [ ] **Step 4: Commit**

```bash
git add tests/unit/selection/test_clipboard.ts
git commit -m "test(selection): cover clipboard fallback and restore"
```

---

## Task 11: Unit Tests for Platform Dispatch

**Files:**

- Create: `tests/unit/selection/test_index.ts`

- [ ] **Step 1: Required imports**

Import every Vitest helper used:

```typescript
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
```

- [ ] **Step 2: Required test cases**

- Linux returns `{ method: 'none', reason: 'unsupported-platform' }`.
- `getSelectedText()` returns only the text string.
- Windows dispatch imports `./windows` via `vi.doMock()` and returns the mocked result without loading real `koffi`.
- macOS dispatch imports `./darwin` via `vi.doMock()` and returns the mocked result without loading real frameworks.
- A mocked platform module throw is caught and returned as `{ method: 'none', reason: 'error' }`.

Do not run the real Windows/macOS native modules in unit tests.

- [ ] **Step 3: Run**

```bash
npx vitest run tests/unit/selection/test_index.ts
```

- [ ] **Step 4: Commit**

```bash
git add tests/unit/selection/test_index.ts
git commit -m "test(selection): cover platform dispatch"
```

---

## Task 12: Unit Tests for Clipboard Monitor Suppression

**Files:**

- Create: `tests/unit/selection/test_clipboard_monitor.ts`

- [ ] **Step 1: Test through `pollClipboardMonitorOnce()`**

Required cases:

- Without suppression, changed non-empty clipboard text triggers `focusOrCreate()` and `sendWhenReady()`.
- During `withClipboardMutationSuppressed()`, changed clipboard text updates `last_text` but does not trigger translation.
- After suppression expires, a later different clipboard text triggers translation exactly once.
- The wrapper returns the inner result.
- The wrapper leaves a cleanup suppression window when the inner function throws.

Use fake timers or stub `Date.now()` deterministically. The test must assert calls, not just execute code.

- [ ] **Step 2: Run**

```bash
npx vitest run tests/unit/selection/test_clipboard_monitor.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/unit/selection/test_clipboard_monitor.ts
git commit -m "test(selection): cover clipboard monitor suppression"
```

---

## Task 13: E2E Test Update

**Files:**

- Modify: `tests/user_e2e/helpers/test_utils.ts`
- Modify: `tests/user_e2e/01_selection_translate.test.ts`

- [ ] **Step 1: Add deterministic helper**

`triggerSelectionTranslate(text?: string)` should POST to `/trigger-selection`. When `text` is passed, send JSON `{ text }`.

- [ ] **Step 2: Add assertion that text reaches renderer**

In E2E mode:

1. Call `triggerSelectionTranslate('e2e selected text')`.
2. Assert response is `{ success: true }`.
3. Assert the translate source area/store contains `e2e selected text`.
4. Assert translation starts or result cards update as existing tests already do.

The test should not depend on a real foreground Notepad selection.

- [ ] **Step 3: Run**

```bash
npx vitest run --config vitest.e2e.config.ts tests/user_e2e/01_selection_translate.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add tests/user_e2e/helpers/test_utils.ts tests/user_e2e/01_selection_translate.test.ts
git commit -m "test(e2e): cover selection trigger IPC payload"
```

---

## Task 14: Manual OS Integration Test Matrix

This task is mandatory because unit tests cannot validate native UIA/AX behavior.

- [ ] **Windows: UIA success**

1. Start app with dev server.
2. Open Notepad, type and select text.
3. Press selection translate hotkey.
4. Confirm selected text appears and logs/reporting show method `uia`.

- [ ] **Windows: Ctrl+C fallback**

1. Put image or rich content on clipboard.
2. Select text in Windows Terminal or another app without reliable TextPattern.
3. Press hotkey.
4. Confirm selected text appears and original clipboard content still pastes afterward.

- [ ] **macOS: Accessibility success**

1. Grant Accessibility permission.
2. Select text in TextEdit.
3. Press hotkey.
4. Confirm selected text appears and method is `accessibility`.

- [ ] **macOS: permission denied**

1. Remove Accessibility permission.
2. Press hotkey with selected text.
3. Confirm no clipboard mutation and result reason is `permission-denied`.

- [ ] **Clipboard monitor isolation**

1. Enable `clipboard_monitor`.
2. Trigger selection translate through fallback.
3. Confirm only one translation occurs and no clipboard-monitor translation is queued.

- [ ] **Toggle behavior**

1. Press hotkey with selected text to show the window.
2. Press hotkey again while the window is visible.
3. Confirm the window hides and clipboard is not touched.

---

## Task 15: Final Verification and Docs

- [ ] **Step 1: Full typecheck and build**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 2: Unit tests**

```bash
npm test
```

- [ ] **Step 3: E2E tests**

```bash
npm run test:e2e
```

- [ ] **Step 4: Documentation**

Update these docs if the implementation differs from existing descriptions:

- `docs/critical_paths.md`
- `docs/selection_translate_mechanism.md`
- `docs/spec.md`

- [ ] **Step 5: Final commit**

```bash
git add docs/critical_paths.md docs/selection_translate_mechanism.md docs/spec.md
git commit -m "docs: update selection translate mechanism"
```

---

## Self-Review Checklist

- [ ] Windows UIA vtable indices match the table in Task 4.
- [ ] macOS AX attributes are `CFStringRef`, not Objective-C selectors.
- [ ] Every COM/CF retained object is released.
- [ ] `readSelectedText()` dynamically imports platform modules.
- [ ] Visible-window hotkey toggle happens before selection reading.
- [ ] Renderer calls `handleTranslate(nextText)`, not `handleTranslate()` after setting state.
- [ ] Clipboard tests capture the real sentinel from `writeText()`.
- [ ] Platform dispatch tests mock native modules instead of importing real `koffi`.
- [ ] Clipboard monitor tests contain real assertions around trigger/no-trigger behavior.
- [ ] E2E selection test is deterministic and does not require a real foreground app.
