# 运行时问题记录

本文记录从本地运行日志中确认或定位中的运行时问题，用于后续修复和验证。

## 1. 中文词典与数据库相关窗口报 `better-sqlite3` ABI 不匹配

### 现象

词典、中文词典和部分依赖本地 SQLite 的页面在运行时可能报错，窗口可能表现为白屏、空结果或 IPC 调用失败。

运行日志中出现类似错误：

```text
Error invoking remote method 'dict:check': Error: The module '...\better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 140.
```

也曾出现 CC-CEDICT 自动导入失败：

```text
CC-CEDICT auto-import failed: Error: The module '...\better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 140.
```

### 影响范围

受影响的是主进程中直接加载 `better-sqlite3` 的功能，包括：

- CC-CEDICT 词典查询与自动导入
- 中文词典查询
- 翻译历史数据库
- 任何通过 IPC 间接访问这些数据库的渲染窗口

### 当前判断

这是 `better-sqlite3` 原生模块 ABI 与当前 Electron 运行时不匹配导致的问题，不是词典数据本身的问题。

当前项目同时存在两类运行时：

| 运行时 | ABI | 典型用途 |
|---|---:|---|
| Node.js | 127 | 单元测试、词典构建脚本、普通 Node 脚本 |
| Electron 39.8.10 | 140 | Electron 主进程、E2E、打包产物 |

同一个 `node_modules/better-sqlite3/build/Release/better_sqlite3.node` 会在 Node ABI 和 Electron ABI 之间被不同命令切换。如果运行 Electron 打包产物前该模块被 `npm rebuild better-sqlite3` 切回 Node ABI，就会在 Electron 主进程里报 `NODE_MODULE_VERSION 127` / `requires 140`。

### 已有说明

更完整的 ABI 说明见 `docs/better_sqlite3_abi.md`。

### 临时处理方式

- 运行打包产物或 Electron 侧测试前，确保执行过 Electron ABI 重建路径，例如 `npm run dist` 或 E2E 入口里的 `scripts/ensure_electron_abi.mjs`。
- 不要在启动打包产物前手动执行 `npm rebuild better-sqlite3`，否则会把模块切回 Node ABI。

### 后续验证

修复或恢复环境后，需要验证：

1. 打开词典窗口不再出现 `dict:check` IPC 错误。
2. 中文词典服务状态正常。
3. 历史记录相关页面不再因 `better-sqlite3` 加载失败而报错。
4. `%APPDATA%\omni_pot\logs\main.log` 中不再出现 `NODE_MODULE_VERSION 127` / `requires 140`。

## 2. 截图翻译偶发白屏

### 现象

截图翻译偶发出现一个全白窗口。用户反馈：不是只有识别文本为空，而是只出现一个窗口，窗口内容全白，截图图片本身也没有显示出来。

如果只是 OCR 没识别出文本，结果窗口左侧仍应显示裁剪后的截图。因此“全白窗口”不能仅用 OCR 空结果解释。

### 日志证据

发生问题前后的日志显示截图链路中的窗口可以创建并触发 renderer ready：

```text
createWindow: screenshot 2560x1440
renderer ready: screenshot
createWindow: recognize 860x520
renderer ready: recognize
```

同一段日志中没有看到最新这次截图翻译对应的 `ERR_FAILED` 页面加载失败，也没有明确的 renderer 崩溃记录。

日志中还出现多条 Tesseract 参数 warning，例如：

```text
[renderer:screenshot] Warning: Parameter not found: language_model_ngram_on
[renderer:screenshot] Warning: Parameter not found: segsearch_max_char_wh_ratio
```

这些 warning 说明 Tesseract 识别过程中有兼容性提示，但每次之后窗口仍能 ready，暂时不能把它当作白屏的直接根因。

### 当前最可能原因

`electron/screenshot/index.ts` 中 `start_screenshot_capture()` **修复前**的顺序是：

1. 创建或聚焦截图窗口。
2. 设置截图窗口 bounds。
3. `win.show()` 显示截图窗口。
4. `win.focus()` 聚焦截图窗口。
5. 等待 50ms。
6. 调用 `capture_screenshot()` 捕获桌面。
7. 发送 `screenshot:show` 给截图窗口。

这意味着截图窗口已经显示后才调用 `desktopCapturer.getSources()`。这是一个竞态条件：`win.show()` 之后截图窗口的渲染需要时间，`desktopCapturer.getSources()` 的调用时机不同，结果也不同——有时截图窗口还没完全渲染进桌面画面（得到正常截图），有时已经渲染进去（得到带遮罩的白图或部分遮挡的截图）。这就是白屏"偶发"而非必现的原因。

### 修复记录（2026-05-23）

调整 `start_screenshot_capture()` 顺序，改为先捕获桌面截图再显示窗口：

**修复后顺序：**

1. 获取主显示器尺寸。
2. `await capture_screenshot()` 捕获桌面截图（窗口不可见）。
3. 创建或聚焦截图窗口。
4. 设置 bounds。
5. `win.show()` + `win.focus()` 显示并聚焦。
6. 发送 `screenshot:show`，把预先捕获的 base64 作为背景。

**改动文件：**

- `electron/screenshot/index.ts`：重排 `start_screenshot_capture()`，移除无用的 50ms 等待，增加主进程诊断日志（capture 开始/完成、base64 长度、发送时机）。
- `src/windows/screenshot/index.tsx`：增加渲染进程诊断日志（收到 `screenshot:show` 时的 base64 长度和 mode）。

### 相关代码位置

- `electron/screenshot/index.ts`
  - `start_screenshot_capture()`：截图窗口显示和 `capture_screenshot()` 的顺序。
  - `capture_screenshot()`：通过 `desktopCapturer.getSources()` 捕获主显示器截图。
- `src/windows/screenshot/index.tsx`
  - 接收 `screenshot:show` 后设置 `background`。
  - `background` 为空或是白图时，截图选择窗口看起来就是全白。
  - `confirm_selection()` 中 crop / OCR 的异常目前被静默吞掉。
- `electron/ipc/ocr_handlers.ts`
  - `ocr:open-recognize` 打开 `recognize` 窗口并发送 `recognize:show`。
- `src/windows/recognize/index.tsx`
  - 接收 `recognize:show` 后显示裁剪图和识别/翻译结果。
- `electron/windows/manager.ts`
  - `sendWhenReady()` 负责窗口 ready 后发送 IPC，但当前日志没有记录每次实际发送的 `screenshot:show` / `recognize:show`。

### 建议修复方向

优先调整截图顺序：先捕获桌面截图，再显示截图选择窗口。

目标顺序：

1. 获取主显示器尺寸。
2. 在截图窗口不可见时调用 `capture_screenshot()`。
3. 创建或聚焦截图窗口。
4. 设置 bounds。
5. 显示并聚焦截图窗口。
6. 发送 `screenshot:show`，把预先捕获的 base64 作为背景。

这样可以避免把 Omni Pot 自己的截图遮罩窗口截进背景图。

注意：`desktopCapturer.getSources()` 本身有 100–300ms 延迟，实现时必须 `await` 捕获完成后再调用 `win.show()`，不能仅交换代码行顺序。

### 建议补充的最小诊断日志

如果调整顺序后仍复现，应补充以下日志以定位 IPC 或渲染阶段是否丢数据：

- 主进程：`capture_screenshot()` 开始和完成。
- 主进程：捕获到的 base64 长度。
- 主进程：发送 `screenshot:show` / `recognize:show` 的时机。
- 渲染进程截图窗口：收到 `screenshot:show` 时的 base64 长度和 mode。
- 渲染进程截图窗口：crop 后 base64 长度。
- 渲染进程截图窗口：每个 OCR 服务的开始、失败和结果长度。

### 后续验证

修复后至少验证：

1. 连续多次触发截图翻译，不再出现全白截图选择窗口。
2. 截图选择窗口背景始终是触发前的桌面画面，不包含 Omni Pot 自己的截图遮罩窗口。
3. OCR 为空时，结果窗口仍能显示裁剪后的截图。
4. `%APPDATA%\omni_pot\logs\main.log` 中窗口创建、renderer ready 和 IPC 发送顺序符合预期。
