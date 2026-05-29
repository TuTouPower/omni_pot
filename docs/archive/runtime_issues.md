# 运行时问题记录

本文记录从本地运行日志中确认或定位中的运行时问题，用于后续修复和验证。

## 4. 词典热键到窗口可见之间约有 1 秒延迟

### 状态

`hotkey_translate` 同类问题已修复并归档：`docs/archive/closed_issues/hotkey_translate_waits_for_selection.md`。

`hotkey_selection_dictionary` 已完成 A 解耦：先发起选区读取，再立即创建词典窗口；B 预热、C UIA 软超时和复杂焦点应用手测仍保留为后续项。

### 现象

修复前，用户按下 `hotkey_translate` / `hotkey_selection_dictionary` 等全局快捷键后，翻译窗口或词典窗口要等约 1 秒才弹出，体感明显卡顿；当前自动修复范围是 A 解耦与 timing/E2E 验证，复杂焦点应用手测尚未执行。

### 影响范围

- `hotkey_selection_dictionary`
- 任何首次冷启动的翻译 / 词典窗口路径（包括托盘菜单进入）

OCR 路径不受影响，因为已存在 `preload_screenshot_window`。

### 链路分析

热键按下后的代码路径（以翻译为例，词典同构）：

| 步骤 | 位置 | 典型耗时 |
|---|---|---:|
| 1. 全局热键触发 action | `electron/hotkey/index.ts:39` | ~0 ms |
| 2. **await readSelectedText()** | `electron/hotkey/index.ts:53` | **200–800 ms** |
| 2a. 加载 `./windows` 子模块（首次） | `electron/selection/index.ts:33` | 一次性 ~30 ms |
| 2b. `CoInitializeEx` + `IUIAutomation::GetFocusedElement` + `TextPattern` | `electron/selection/windows.ts:148-198` | 200–500 ms（焦点元素结构越复杂越慢） |
| 2c. UIA 拿不到选区 → fallback 模拟 Ctrl+C + 轮询剪贴板 | `electron/selection/clipboard.ts:65-99` | 最长 300 ms |
| 3. `focusOrCreate(TRANSLATE)` 冷启动 BrowserWindow | `electron/windows/manager.ts` | 100–300 ms |
| 4. 渲染进程加载 React + 首屏布局 | `src/windows/translate/index.tsx` | 100–300 ms |
| 5. `sendWhenReady` 等 `renderer:ready` 后投递文本 | `electron/windows/manager.ts:52` | 取决于 4 |

**关键观察**：A 解耦后，翻译和词典路径都会先启动选区读取 promise，再立即 `focusOrCreate`；UIA + clipboard fallback 仍影响文本到达时间，但不再阻塞窗口创建。

### 根因

1. **旧链路让选区读取阻塞窗口创建**：`triggerSelectionDictionary` 曾在 `focusOrCreate` 之前 `await readSelectedText()`，UIA 是绝大多数延迟来源。
2. **翻译 / 词典窗口没有预热**：只有截图窗口在 `electron/screenshot/index.ts:48` 有 `preload_screenshot_window`，translate / dict 走按需 `createBrowserWindow`，首次必然带冷启动开销。
3. **UIA 无软超时**：`getTextByUIAutomation`（`electron/selection/windows.ts:148`）调用同步 COM API（通过 koffi）。COM 自身没有可中断超时；遇到响应慢的应用（Office、复杂 Electron 应用）整体路径会卡到 UIA 自然返回为止。
4. **clipboard fallback 默认 300ms 轮询窗口**（`electron/selection/clipboard.ts:70`）是合理值，但叠加在 UIA 之后再次串行。

### 修复方案

按改动成本与收益排序，A 与 B 可独立或叠加生效，C 是兜底。

#### A. 解耦：先发起选区读取，再立即开窗（已对 `hotkey_translate` / `hotkey_selection_dictionary` 落地）

`triggerTranslateEntry` 先启动 `readSelectedText()`，不等待结果就 `focusOrCreate`；读取结果回来后再投递 IPC：

```ts
export async function triggerTranslateEntry(mgr, textOverride?) {
    const result_promise = textOverride === undefined
        ? readSelectedText()
        : Promise.resolve({ text: textOverride, reason: textOverride.trim() ? undefined : 'empty' })

    mgr.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())

    const result = await result_promise
    if (!result.text.trim()) {
        mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:input-translate')
        return
    }
    mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-selection', result.text)
}
```

- **收益**：窗口可见时间从 500–1100ms → ~150ms（仅含 BrowserWindow create + 首屏）。文本到达窗口的总时延不变。
- **代价**：极少数情况下用户能看到一闪而过的空 loading；可在渲染端用 `translate:from-selection` 到达前显示骨架/占位。
- **兼容性**：`sendWhenReady` 队列机制已经支持窗口未 ready 时排队，改动无需触动 IPC 协议。
- **剩余问题**：B 预热与 C UIA 软超时未做；复杂焦点应用手测未做，不能把该问题归档为完全关闭。

#### B. 启动期预热翻译 / 词典窗口

模仿 `preload_screenshot_window`（`electron/screenshot/index.ts:48`）：应用 ready 时创建 translate / dict 窗口，`show: false`，渲染进程完成首屏后保持隐藏，热键时直接 `win.show()`。

- **收益**：步骤 3 + 4 完全消失，可见时间 < 50ms。
- **代价**：
  - 每个常驻 BrowserWindow 增加约 60–100 MB 内存（V8 + Blink）。
  - 应用启动时间额外 +200–500ms（可移到 idle queue 减轻）。
  - 需要处理"窗口已存在但配置变了（透明度、置顶、记住尺寸）"的同步重建——当前 `rebuildForTransparencyChange` 路径已存在状态丢失 bug（见 `docs/review_claude.md §1.5`），预热会放大这个问题，需要先修。
- **建议**：先做 A，B 作为后续优化项，并视用户内存反馈决定是否默认开启或做成配置开关 `preload_windows`。

#### C. UIA 软超时 + 提前 fallback

为 `getTextByUIAutomation` 套 100–150ms 软超时。由于 koffi 调用的是同步 COM API，主线程上无法真正中断；可行做法是把 UIA 调用移到 `utility process` / `worker_threads`，主线程用 `Promise.race(uia, sleep(150))`，超时则直接走 clipboard fallback，UIA worker 继续跑完释放资源。

- **收益**：极端慢 UIA（Office 大文档、慢的 Electron 应用）场景下从 800ms → 150ms。
- **代价**：worker 化改动较大；`CoInitializeEx` / `CoUninitialize` 顺序需要谨慎，否则放大 `docs/review_claude.md §1.4` 已记录的泄漏。
- **建议**：A + B 落地后若仍有用户报慢再做。

### 取舍

| 方案 | 改动量 | 内存代价 | 启动时间代价 | 体感收益 |
|---|---|---|---|---|
| A 解耦 | 小（约 10 行） | 0 | 0 | 高（首帧 < 200ms） |
| B 预热 | 中（参考 screenshot 实现） | +60–100 MB/窗口 | +200–500ms | 极高（首帧 < 50ms） |
| C UIA worker | 大 | 微增 | 0 | 中（仅长尾场景） |

推荐路径：**A 已对 `hotkey_translate` / `hotkey_selection_dictionary` 落地** → 观察 `show_ms` / `total_ms` 与用户反馈 → 决定是否做 B（必要时加 `preload_windows` 配置） → C 作为长尾优化保留。

### 后续验证

1. 已在主进程加上 timing log：`translate entry:` / `selection dictionary:` 记录 `show_ms`（热键入口到窗口创建/聚焦请求返回）、`total_ms`、`entry`、`reason`，不记录用户原文。
2. 已用自动测试覆盖：`tests/unit/hotkey/index.test.ts` 断言词典窗口在选区 promise resolve 前已打开；`tests/user_e2e/specs/dict_window.spec.ts` 断言词典热键后窗口可见且空选区可直接输入。
3. 待手测：在主显示器 + 复杂焦点应用（VS Code、Word、Excel、Chromium）下手动验证体感，避免只在简单 Notepad 场景测试导致回归未被发现。
4. 待归档：手测通过并确认无需 B/C 后，更新本节并归档到 `docs/archive/closed_issues/`。

### 相关代码与文档

- `electron/hotkey/index.ts:51-78`（trigger entry，A 改造点）
- `electron/selection/index.ts:24-46`、`electron/selection/windows.ts:148-247`（UIA 调用链）
- `electron/selection/clipboard.ts:65-99`（fallback 轮询）
- `electron/screenshot/index.ts:48-53`（B 的参考实现）
- `electron/windows/manager.ts`（`focusOrCreate` / `sendWhenReady`）
- `docs/review_claude.md §1.4 / §1.5`（COM 泄漏与 rebuild 状态丢失，B 落地前需修）
