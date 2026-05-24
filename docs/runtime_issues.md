# 运行时问题记录

本文记录从本地运行日志中确认或定位中的运行时问题，用于后续修复和验证。

## 4. 全局热键到窗口可见之间约有 1 秒延迟

### 现象

用户按下 `hotkey_translate` / `hotkey_selection_dictionary` 等全局快捷键后，翻译窗口或词典窗口要等约 1 秒才弹出，体感明显卡顿；`hotkey_ocr_recognize` / `hotkey_ocr_translate` 因为有预热窗口，反应明显更快。

### 影响范围

- `hotkey_translate`（含 `hotkey_selection_translate`、`hotkey_input_translate` 别名）
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

**关键观察**：步骤 2、3、4 当前是**串行**的。即使选区是空（用户只想打开输入框），UIA + clipboard fallback 仍会全程跑完才开始建窗口。

### 根因

1. **选区读取阻塞了窗口创建**：`triggerTranslateEntry` / `triggerSelectionDictionary` 都在 `focusOrCreate` 之前 `await readSelectedText()`，UIA 是绝大多数延迟来源。
2. **翻译 / 词典窗口没有预热**：只有截图窗口在 `electron/screenshot/index.ts:48` 有 `preload_screenshot_window`，translate / dict 走按需 `createBrowserWindow`，首次必然带冷启动开销。
3. **UIA 无软超时**：`getTextByUIAutomation`（`electron/selection/windows.ts:148`）调用同步 COM API（通过 koffi）。COM 自身没有可中断超时；遇到响应慢的应用（Office、复杂 Electron 应用）整体路径会卡到 UIA 自然返回为止。
4. **clipboard fallback 默认 300ms 轮询窗口**（`electron/selection/clipboard.ts:70`）是合理值，但叠加在 UIA 之后再次串行。

### 修复方案

按改动成本与收益排序，A 与 B 可独立或叠加生效，C 是兜底。

#### A. 解耦：先开窗，选区并行读（推荐先做）

把 `focusOrCreate` 提前到 `readSelectedText()` 之前发起，两者并行：

```ts
// electron/hotkey/index.ts:51 triggerTranslateEntry
export async function triggerTranslateEntry(mgr, textOverride?) {
    mgr.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())  // 立即出窗
    const result = textOverride === undefined
        ? await readSelectedText()
        : { text: textOverride, reason: textOverride.trim() ? undefined : 'empty' }
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
- 词典路径同理修改 `triggerSelectionDictionary`（`electron/hotkey/index.ts:66`）。

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

推荐路径：**A 立即落地** → 观察用户反馈 → 决定是否做 B（必要时加 `preload_windows` 配置） → C 作为长尾优化保留。

### 后续验证

1. 在主进程加上 timing log：`log_hotkey.info('show=%dms total=%dms', show_ms, total_ms)`，分别记录"按下 → 窗口可见"、"按下 → 文本到达"两段，回归前后对比。
2. E2E 增加用例：触发翻译热键后断言窗口在 200ms 内 `isVisible()`，文本到达可放宽到 1.5s。
3. 在主显示器 + 复杂焦点应用（VS Code、Word）下手动验证体感，避免只在简单 Notepad 场景测试导致回归未被发现。
4. 修复后更新本节并归档到 `docs/archive/closed_issues/`。

### 相关代码与文档

- `electron/hotkey/index.ts:51-78`（trigger entry，A 改造点）
- `electron/selection/index.ts:24-46`、`electron/selection/windows.ts:148-247`（UIA 调用链）
- `electron/selection/clipboard.ts:65-99`（fallback 轮询）
- `electron/screenshot/index.ts:48-53`（B 的参考实现）
- `electron/windows/manager.ts`（`focusOrCreate` / `sendWhenReady`）
- `docs/review_claude.md §1.4 / §1.5`（COM 泄漏与 rebuild 状态丢失，B 落地前需修）
