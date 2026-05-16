# Pot Desktop - 完整产品规格说明

> 版本: 3.0.7 | 文档生成日期: 2026-05-06
> 用途: 作为闭源商业产品完全重写的详尽规格说明。

https://github.com/pot-app/pot-desktop
~/karson_ubuntu/new_pot
---

## 目录

1. [架构概览](#1-架构概览)
2. [多窗口系统](#2-多窗口系统)
3. [窗口: 翻译](#3-窗口-翻译)
4. [窗口: 截图](#4-窗口-截图)
5. [窗口: 识别](#5-窗口-识别)
6. [窗口: 配置](#6-窗口-配置)
7. [窗口: 更新器](#7-窗口-更新器)
8. [翻译服务 (21)](#8-翻译服务)
9. [OCR / 识别服务 (16)](#9-ocr--识别服务)
10. [TTS 服务 (2)](#10-tts-服务)
11. [收藏服务 (2)](#11-收藏服务)
12. [语言检测 (7 种引擎)](#12-语言检测)
13. [配置系统 (完整)](#13-配置系统)
14. [Rust 后端模块](#14-rust-后端模块)
15. [HTTP API 服务器](#15-http-api-服务器)
16. [系统托盘菜单](#16-系统托盘菜单)
17. [全局快捷键系统](#17-全局快捷键系统)
18. [剪贴板监听](#18-剪贴板监听)
19. [备份与恢复](#19-备份与恢复)
20. [插件系统](#20-插件系统)
21. [自动更新系统](#21-自动更新系统)
22. [国际化](#22-国际化)
23. [支持的语言](#23-支持的语言)
24. [依赖项](#24-依赖项)
25. [平台特定行为](#25-平台特定行为)
26. [前端 Hooks 与工具函数](#26-前端-hooks-与工具函数)
27. [状态管理 (Jotai Atoms)](#27-状态管理)

---

## 1. 架构概览

### 技术栈

| 层 | 技术 |
|-------|-----------|
| 桌面框架 | Tauri 1.x (Rust 后端 + WebView 前端) |
| 前端 | React 18 + Vite |
| UI 库 | NextUI + Tailwind CSS |
| 状态管理 | Jotai (atoms) + tauri-plugin-store (持久化) |
| 路由 | react-router-dom (仅配置窗口) |
| 国际化 | react-i18next (19 种语言) |
| 后端 | Rust (Tauri commands + HTTP 服务器) |
| 数据库 | SQLite via tauri-plugin-sql (历史记录) |
| 拖拽排序 | react-beautiful-dnd (服务排序) |
| 动画 | @react-spring/web + framer-motion |

### 多窗口架构

应用由 5 个独立的 Tauri 窗口组成，每个窗口渲染不同的顶级 React 组件。一个隐藏的"守护进程"窗口在后台运行系统级操作。

| 窗口标签 | HTML 入口 | React 组件 | 用途 |
|-------------|-----------|----------------|---------|
| `daemon` | `daemon.html` | 无 | 后台工作器，始终隐藏 |
| `translate` | `index.html` | `<Translate />` | 主翻译弹出窗口 |
| `screenshot` | `index.html` | `<Screenshot />` | 全屏截图覆盖层 |
| `recognize` | `index.html` | `<Recognize />` | OCR 结果展示 |
| `config` | `index.html` | `<Config />` | 设置/配置 |
| `updater` | `index.html` | `<Updater />` | 更新检查/下载 |

`App.jsx` 从 Tauri 读取 `appWindow.label` 来决定渲染哪个组件。除 daemon 外的所有窗口共享同一个 HTML 入口 (`index.html`)。

### 启动流程

1. `main.jsx` 初始化 store、环境变量，在 `NextUIProvider` + `NextThemesProvider` 内渲染 `<App />`
2. `App.jsx` 读取窗口标签并渲染匹配的组件
3. 首次运行时（空的 config store），自动打开配置窗口

### 全局前端行为

- 生产构建中，全局禁用浏览器上下文菜单。
- 所有窗口拦截 `Escape` 键并关闭当前 Tauri 窗口。
- 所有功能键 (`F1`-`F12`) 默认被阻止。当 `dev_mode=true` 时，`F12` 通过 `open_devtools` 命令切换开发者工具。
- `Ctrl+C`、`Ctrl+V`、`Ctrl+X`、`Ctrl+A`、`Ctrl+Z` 和 `Ctrl+Y` 保持可用；其他 `Ctrl+<key>` 组合在 webview 中被阻止。
- 主题、UI 语言、字体族、回退字体和基础字号由 `App.jsx` 全局应用。

### 核心触发工作流

#### 划词翻译

1. 由全局快捷键、托盘/API 操作或外部 HTTP 端点触发。
2. 后端读取当前选中的文本（方案见下方"选中文本提取"）。
3. 非空的选中文本存入 `StringWrapper`。
4. 后端创建/复用 `translate` 窗口并发射 `new_text` 事件携带选中文本。
5. 前端去除文本首尾空白，可选应用 `translate_delete_newline`，当 `incremental_translate=true` 时可选追加到之前的源文本，检测语言，然后翻译。
6. 切换变体：如果翻译窗口已经可见/聚焦或等待显示，则隐藏现有翻译窗口。

**选中文本提取方案（跨平台）：**

参考项目使用 `selection` crate（v1.2.0），本项目需在 Electron 中用等价方案实现：

| 平台 | 主方案 | 原理 | 回退方案 |
|------|--------|------|----------|
| Windows | UI Automation API（`IUIAutomation` COM） | 获取焦点元素 → 查询 `TextPattern` → 读取选中范围，不碰剪贴板 | 模拟 Ctrl+C + 读剪贴板（保存并恢复原内容） |
| macOS | Accessibility API | 查询 `kAXSelectedTextAttribute`，不碰剪贴板 | AppleScript 模拟 Cmd+C（保存并恢复原内容） |
| Linux/X11 | X11 PRIMARY selection | 选中即自动写入 PRIMARY buffer，无需 Ctrl+C | — |
| Linux/Wayland | `wl-clipboard` 读取 Primary | 读取 `ClipboardType::Primary` | 回退到 X11 兼容层 |

> 详见 `docs/selection_translate_mechanism.md`

#### 输入翻译

1. 后端将哨兵字符串 `[INPUT_TRANSLATE]` 写入 `StringWrapper`。
2. 后端创建/复用 `translate` 窗口，发射 `new_text` 事件，并显示窗口。
3. 如果 `translate_window_position="mouse"`，输入翻译会将翻译窗口居中而非定位到光标位置。
4. 前端清空源文本并强制显示源文本区域，即使 `hide_source=true`。
5. 切换变体：如果翻译窗口已经可见/聚焦或等待显示，则隐藏现有翻译窗口。

#### 文本翻译 (HTTP / 剪贴板监听)

1. HTTP `/` 和 `/translate` 读取请求体作为纯文本并调用 `text_translate`。
2. 剪贴板监听在剪贴板文本变化时调用 `text_translate`。
3. `text_translate` 将文本存入 `StringWrapper`，创建/复用翻译窗口，发射 `new_text` 事件，并显示窗口。

#### OCR 识别

1. 启用内部截图时，后端打开截图窗口 (Windows/Linux) 或运行 `screencapture -i -r` (macOS)。
2. 裁剪后的图像保存为 `pot_screenshot_cut.png` 到应用缓存目录。
3. 后端创建/复用 `recognize` 窗口并发射 `new_image` 事件。
4. 识别前端通过 `get_base64` 加载缓存的裁剪图像并运行选定的 OCR 服务。

#### OCR 翻译

1. 启用内部截图时，后端捕获/裁剪截图，与 OCR 识别完全相同。
2. 后端调用 `image_translate`，写入哨兵字符串 `[IMAGE_TRANSLATE]`，创建/复用翻译窗口，并发射 `new_text` 事件。
3. 翻译窗口的 `SourceArea` 处理 `[IMAGE_TRANSLATE]`，通过 `get_base64` 读取裁剪的截图。
4. 它使用 `recognize_service_list` 中第一个配置的识别服务实例来对图像进行 OCR。
5. OCR 文本经过 `translate_delete_newline` 和 `incremental_translate` 后处理，然后作为源文本插入并翻译。
6. OCR 服务/语言错误显示在源文本区域。

#### 翻译窗口就绪守卫

后端跟踪 `TRANSLATE_READY` 和 `TRANSLATE_SHOW_PENDING`。新创建的翻译窗口只在前端加载完插件元数据和服务实例配置并发射 `translate_ready` 后才立即显示。这防止了在服务就绪之前显示空白翻译窗口。

### 插件架构

翻译、OCR、TTS 和收藏服务遵循插件模式：
- 每个服务是一个目录，包含 `index.jsx` (逻辑)、`Config.jsx` (设置 UI)、`info.ts` (元数据)
- 服务以唯一键实例化：`{name}@{randomId}`
- 用户可以添加同一服务的多个实例，配置不同
- 外部插件使用 `.potext` 文件（ZIP 归档，包含 `info.json` + `main.js`）

---

## 2. 多窗口系统

### 窗口创建 (Rust 后端)

所有窗口通过 `window.rs` 中的 `build_window()` 创建。关键行为：

- **窗口复用**：如果具有相同标签的窗口已存在，则聚焦而非重新创建
- **鼠标-显示器检测**：新窗口在鼠标光标当前所在的显示器上创建
- **阴影**：在非 Linux 平台上应用 `window_shadows::set_shadow()`（截图窗口除外）
- **macOS**：覆盖式标题栏样式，隐藏标题
- **Windows/Linux**：透明背景，无装饰

### 窗口位置模式（翻译窗口）

| 模式 | 配置键 | 行为 |
|------|-----------|----------|
| `mouse` | `translate_window_position: "mouse"` | 窗口出现在光标位置，限制在显示器边缘内 |
| `pre_state` | `translate_window_position: "pre_state"` | 窗口出现在保存的 `translate_window_position_x/y` 位置，如果超出屏幕则回退到居中 |

**特殊情况**：输入翻译 (`[INPUT_TRANSLATE]`) 在 `translate_window_position="mouse"` 时将翻译窗口居中。

### 窗口尺寸

| 窗口 | 默认尺寸 | 最小尺寸 | 可配置 |
|--------|-------------|----------|-------------|
| 翻译 | 350 x 420 | 无 | 是（宽/高保存到配置） |
| 识别 | 800 x 400 | 无 | 是（宽/高保存到配置） |
| 配置 | 800 x 600 | 800 x 400 | 否 |
| 更新器 | 600 x 400 | 600 x 400 | 否 |
| 截图 | 全屏 | 不适用 | 否 |
| 守护进程 | 隐藏 | 不适用 | 否 |

### WindowControl 共享组件

出现在配置、识别窗口（macOS 上隐藏）：
- **最小化** 按钮 (`VscChromeMinimize`)
- **最大化/还原** 切换按钮 (`VscChromeMaximize` / `VscChromeRestore`)
- **关闭** 按钮 (`VscChromeClose`)，Linux 上有特殊圆角

### 全局窗口行为

| 行为 | 配置键 | 默认值 | 影响窗口 |
|----------|-----------|---------|-----------------|
| 失焦关闭 | `translate_close_on_blur` | `true` | 翻译 |
| 始终置顶 | `translate_always_on_top` | `false` | 翻译（通过图钉按钮切换） |
| 跳过任务栏 | -- | `true` | 翻译、截图 |
| 隐藏窗口 | `translate_hide_window` | `false` | 翻译 |
| 失焦关闭 (识别) | `recognize_close_on_blur` | `false` | 识别 |
| 隐藏窗口 (识别) | `recognize_hide_window` | `false` | 识别 |

**隐藏窗口行为**：
- `translate_hide_window=true`：翻译窗口在收到新任务后隐藏但仍处理翻译；适用时发送自动复制通知。
- `recognize_hide_window=true`：识别窗口在加载图像后隐藏但仍处理 OCR；适用时发送自动复制通知。

---

## 3. 窗口: 翻译

**文件**: `src/window/Translate/index.jsx`

主翻译弹出窗口。由 4 个垂直部分组成：

### 3.1 顶部栏

| 元素 | 图标 | 操作 |
|---------|------|--------|
| 图钉/取消图钉按钮 | `BsPinFill` | 切换 `always_on_top`。固定时图标变为主题色。 |
| 关闭按钮 | `AiFillCloseCircle` | 隐藏窗口。macOS 上隐藏。 |

### 3.2 SourceArea 组件

**文件**: `src/window/Translate/components/SourceArea/index.jsx`

| 元素 | 类型 | 行为 |
|---------|------|----------|
| 文本区域 | 自动增长的 textarea | 字号来自配置。可编辑的源文本。 |
| 检测到的语言标签 | 彩色圆点 + 语言代码 | 当语言被自动检测时显示 |
| 翻译按钮 | `HiTranslate` 图标按钮 | 触发所有已启用服务的翻译 |
| 朗读按钮 | `HiOutlineVolumeUp` | 源文本的 TTS 播放 |
| 复制按钮 | `MdContentCopy` | 复制源文本到剪贴板 |
| 删除换行按钮 | `MdSmartButton` | 去除源文本中的换行符 |
| 清空按钮 | `LuDelete` | 清空源文本（空时禁用） |

**新文本处理**：
- 传入文本在使用前会去除首尾空白。
- 当 `translate_delete_newline=true` 时，文本用 `/-\s+/g -> ""` 和 `\s+ -> " "` 规范化。
- 当 `incremental_translate=true` 时，传入文本以空格分隔追加到现有源文本；否则替换源文本。
- `hide_source=true` 在划词/图片翻译时隐藏 SourceArea，但对 `[INPUT_TRANSLATE]` 永不隐藏。
- `[IMAGE_TRANSLATE]` 不会字面显示；它启动[核心触发工作流](#核心触发工作流)中描述的先 OCR 再翻译的工作流。

**键盘快捷键**：
- `Enter` — 触发翻译
- `Shift+Enter` — 插入换行
- `Escape` — 关闭窗口

**变量名转换** (`Alt+Shift+U`)：
将选中文本循环转换：snake_case → SNAKE_CASE → kebab-case → dot.notation → 空格分隔 → Title Case → CamelCase → PascalCase → snake_case

**IME 处理**：跟踪输入法组合事件，防止 IME 输入与语言检测之间的竞态条件。

### 3.3 LanguageArea 组件

**文件**: `src/window/Translate/components/LanguageArea/index.jsx`

| 元素 | 类型 | 行为 |
|---------|------|----------|
| 源语言下拉框 | Select | "auto" + 所有 30 种配置的翻译 UI 语言。`hide_language=true` 时隐藏。 |
| 交换按钮 | `BiTransferAlt` | 交换源↔目标语言。如果文本是第二语言，则循环切换目标语言。 |
| 目标语言下拉框 | Select | 所有 30 种配置的翻译 UI 语言（无 "auto"）。`hide_language=true` 时隐藏。 |

### 3.4 TargetArea 组件

**文件**: `src/window/Translate/components/TargetArea/index.jsx`

每个已启用的翻译服务实例一张卡片。卡片可拖拽（可排序）。

**卡片头部**：
| 元素 | 类型 | 行为 |
|---------|------|----------|
| 服务下拉框 | 带图标的 Select | 在服务实例之间切换 |
| 加载动画 | PulseLoader | 翻译中显示 |
| 折叠/展开 | `BiExpandVertical`/`BiCollapseVertical` | 通过 spring 动画切换卡片主体可见性 |

**卡片主体**（可折叠）：
- **字符串结果**：只读 textarea
- **词典结果**（结构化对象）：
  - 发音：地区标签 + 音标 + 朗读图标
  - 释义：词性标签 + 粗体定义 + 附加定义
  - 联想：列表项
  - 例句：编号的源/目标对（可能包含 HTML）
- **错误状态**：红色错误文本

**卡片底部**：
| 元素 | 图标 | 行为 |
|---------|------|----------|
| 朗读 | `HiOutlineVolumeUp` | TTS 播放（非字符串结果时禁用） |
| 复制 | `MdContentCopy` | 复制结果到剪贴板 |
| 反向翻译 | `TbTransformFilled` | 将结果作为源文本发回进行反向翻译 |
| 重试 | `GiCycle` | 重新触发翻译（仅在出错后显示） |
| 收藏按钮 | 各服务图标 | 每个配置的收藏服务一个按钮 |

**翻译执行细节**：
- 如果源语言是 `auto` 且目标语言等于检测到的语言，则实际目标使用 `translate_second_language`。
- 属于旧请求 ID 的翻译结果会被忽略；这防止旧的异步结果替换较新的输出。
- 流式翻译服务通过 `setResult` 增量更新卡片。当前实现在部分输出后追加一个尾随 `_`，完成时移除。
- 翻译成功后写入历史记录，除非 `history_disable=true`。
- 当前历史行存储的是服务名称而非内置服务的完整服务实例键。

**自动复制行为**：
- `translate_auto_copy="source"` 翻译前复制源文本。
- `translate_auto_copy="target"` 复制第一个成功的目标结果。
- `translate_auto_copy="source_target"` 复制 `source + "\n\n" + target`。
- 当 `clipboard_monitor=true` 时抑制自动复制，以避免剪贴板触发循环。
- 当 `translate_hide_window=true` 时，成功的自动复制还会发送桌面通知。

---

## 4. 窗口: 截图

**文件**: `src/window/Screenshot/index.jsx`

用于截图捕获和区域选择的全屏覆盖层。无可见的 UI 控件。

### 行为

1. 窗口全屏打开，始终置顶
2. 后端通过 `screenshots` crate 捕获屏幕，保存为缓存目录中的 `pot_screenshot.png`
3. 图像渲染为全屏背景
4. **鼠标拖拽**创建选择矩形（蓝色边框，半透明蓝色填充）
5. **右键点击**关闭窗口不执行操作
6. **鼠标释放**：调用 `cut_image(left, top, width, height)` 裁剪，发射 `success` 事件，关闭窗口

### 平台差异

| 平台 | 截图方式 |
|----------|------------------|
| macOS | 系统 `screencapture -i -r` 命令 |
| Windows/Linux | 带选择功能的全屏覆盖窗口 |

### 外部截图约定

外部截图工具可以通过将裁剪后的图像直接写入应用缓存路径来绕过内部截图窗口：

`{system_cache_dir}/com.new-pot.desktop/pot_screenshot_cut.png`

写入该文件后，调用者可以触发：
- `GET /ocr_recognize?screenshot=false` 打开识别窗口并运行 OCR
- `GET /ocr_translate?screenshot=false` 通过第一个配置的识别服务运行 OCR 并翻译结果

此路径是 Wayland 环境下内部全局快捷键或截图捕获不可用时的支持解决方案。

---

## 5. 窗口: 识别

**文件**: `src/window/Recognize/index.jsx`

### 顶部栏

| 元素 | 图标 | 操作 |
|---------|------|--------|
| 图钉按钮 | `BsPinFill` | 切换始终置顶 |
| 窗口控制 | WindowControl 组件 | 最小化/最大化/关闭（macOS 上隐藏） |

### ImageArea 组件

**文件**: `src/window/Recognize/components/ImageArea/index.jsx`

| 元素 | 行为 |
|---------|----------|
| 图像显示 | 显示截图的 base64 编码 PNG |
| 复制图像按钮 | `MdContentCopy`，调用 `copy_img` Rust 命令 |

### TextArea 组件

**文件**: `src/window/Recognize/components/TextArea/index.jsx`

| 元素 | 类型 | 行为 |
|---------|------|----------|
| 加载骨架屏 | Skeleton | OCR 处理中显示 |
| 结果文本框 | 可编辑 | OCR 结果文本 |
| 错误文本框 | 只读，红色文本 | 错误消息 |
| 复制文本按钮 | `MdContentCopy` | 复制 OCR 文本 |
| 删除换行按钮 | `MdSmartButton` | 去除换行符 |
| 删除空格按钮 | `CgSpaceBetween` | 去除空格 |

**OCR 执行细节**：
- 属于旧请求 ID 的 OCR 结果会被忽略；这防止旧的异步结果替换较新的输出。
- 支持流式的 OCR 服务使用 `setResult`。部分输出通过追加尾随 `_` 标记；最终输出修剪后写入，不含标记。
- 当 `recognize_delete_newline=true` 时，最终文本用 `/-\s+/g -> ""` 和 `\s+ -> " "` 规范化。
- 当 `recognize_auto_copy=true` 时，最终 OCR 文本复制到剪贴板；如果 `recognize_hide_window=true`，发送桌面通知。

### ControlArea 组件

**文件**: `src/window/Recognize/components/ControlArea/index.jsx`

| 元素 | 类型 | 行为 |
|---------|------|----------|
| 服务下拉框 | 带图标的 Select | 在识别服务实例之间切换 |
| 语言下拉框 | Select | "auto" + 所有语言 |
| 重新识别 | `GiCycle` (紫色) | 重新运行 OCR |
| 翻译按钮 | `HiTranslate` (蓝色) | 通过 localhost HTTP 将文本发送到翻译窗口 |

---

## 6. 窗口: 配置

**文件**: `src/window/Config/index.jsx`

### 布局

- **左侧边栏**：固定 230px 宽度，pot logo + 8 个导航按钮
- **右侧内容**：标题栏 + 可滚动内容区域
- 背景透明度由 `transparent` 配置控制

### 侧边栏导航

| 路由 | 图标 | 标签 (i18n key) |
|-------|------|------------------|
| `/general` | `AiFillAppstore` | 通用 |
| `/translate` | `PiTranslateFill` | 翻译 |
| `/recognize` | `PiTextboxFill` | 识别 |
| `/hotkey` | `MdKeyboardAlt` | 快捷键 |
| `/service` | `MdExtension` | 服务 |
| `/history` | `FaHistory` | 历史记录 |
| `/backup` | `AiFillCloud` | 备份 |
| `/about` | `BsInfoSquareFill` | 关于 |

激活路由: `variant='flat'`。未激活: `variant='light'`。

---

### 6.1 配置页: 通用

**文件**: `src/window/Config/pages/General/index.jsx`

#### 卡片 1 - 应用设置

| UI 元素 | 类型 | 配置键 | 默认值 | 详情 |
|-----------|------|-----------|---------|---------|
| 自动启动 | Switch | -- (tauri-autostart) | `false` | 操作系统级开机自启 |
| 检查更新 | Switch | `check_update` | `true` | 启动时自动检查更新 |
| 服务器端口 | Input (number) | `server_port` | `20202` | 限制 0-65535，修改时弹出 toast |

修改 `server_port` 后配置立即更新，但运行中的 HTTP 服务器保持旧端口直到应用重启。

#### 卡片 2 - 外观设置

| UI 元素 | 类型 | 配置键 | 默认值 | 详情 |
|-----------|------|-----------|---------|---------|
| 应用语言 | Dropdown + 国旗图标 | `app_language` | `'en'` | 19 种语言，带本地名称和国旗 |
| 应用主题 | Dropdown | `app_theme` | `'system'` | 选项: system / light / dark |
| 应用字体 | Dropdown | `app_font` | `'default'` | 系统字体列表，下拉框中有预览 |
| 回退字体 | Dropdown | `app_fallback_font` | `'default'` | 同上 |
| 字号 | Dropdown | `app_font_size` | `16` | 选项: 10, 12, 14, 16, 18, 20, 24 |
| 托盘点击事件 | Dropdown | `tray_click_event` | `'config'` | 仅 Windows。选项: config / translate / ocr_recognize / ocr_translate / disable |
| 透明 | Switch | `transparent` | `true` | macOS 上隐藏 |
| 开发者模式 | Switch | `dev_mode` | `false` | 启用 F12 开发者工具 |

#### 卡片 3 - 代理设置

| UI 元素 | 类型 | 配置键 | 默认值 | 详情 |
|-----------|------|-----------|---------|---------|
| 启用代理 | Switch | `proxy_enable` | `false` | 启用前验证 host/port |
| 代理地址 | Input (url) | `proxy_host` | `''` | 自动添加 `http://` 前缀 |
| 代理端口 | Input (number) | `proxy_port` | `''` | 限制 0-65535 |
| 代理用户名 | Input (禁用) | `proxy_username` | `''` | 当前已禁用/未实现 |
| 代理密码 | Input (password, 禁用) | `proxy_password` | `''` | 当前已禁用/未实现 |
| 不代理 | Input | `no_proxy` | `'localhost,127.0.0.1'` | 逗号分隔的绕过列表 |

修改代理设置后配置立即更新，但需要应用重启后生效。启动时，如果 `proxy_enable=true` 且 `proxy_host` 非空，后端设置 `http_proxy`、`https_proxy`、`all_proxy` 和 `no_proxy` 环境变量。

---

### 6.2 配置页: 翻译

**文件**: `src/window/Config/pages/Translate/index.jsx`

#### 卡片 1 - 语言设置

| UI 元素 | 类型 | 配置键 | 默认值 | 详情 |
|-----------|------|-----------|---------|---------|
| 源语言 | Dropdown | `translate_source_language` | `'auto'` | "auto" + 所有 30 种配置的翻译 UI 语言 |
| 目标语言 | Dropdown | `translate_target_language` | `'zh_cn'` | 所有 30 种配置的翻译 UI 语言（无 auto） |
| 第二语言 | Dropdown | `translate_second_language` | `'en'` | 所有 30 种配置的翻译 UI 语言（无 auto） |
| 检测引擎 | Dropdown | `translate_detect_engine` | `'baidu'` | baidu / tencent / niutrans / google / bing / yandex / local |

#### 卡片 2 - 行为设置

| UI 元素 | 类型 | 配置键 | 默认值 |
|-----------|------|-----------|---------|
| 自动复制 | Dropdown | `translate_auto_copy` | `'disable'` |
| 禁用历史 | Switch | `history_disable` | `false` |
| 增量翻译 | Switch | `incremental_translate` | `false` |
| 动态翻译 | Switch | `dynamic_translate` | `false` |
| 删除换行 | Switch | `translate_delete_newline` | `false` |
| 记住语言 | Switch | `translate_remember_language` | `false` |

自动复制选项: `source` / `target` / `source_target` / `disable`

#### 卡片 3 - 窗口设置

| UI 元素 | 类型 | 配置键 | 默认值 |
|-----------|------|-----------|---------|
| 窗口位置 | Dropdown | `translate_window_position` | `'mouse'` |
| 记住窗口大小 | Switch | `translate_remember_window_size` | `false` |
| 失焦关闭 | Switch | `translate_close_on_blur` | `true` |
| 始终置顶 | Switch | `translate_always_on_top` | `false` |
| 隐藏源文本 | Switch | `hide_source` | `false` |
| 隐藏语言 | Switch | `hide_language` | `false` |
| 隐藏窗口 | Switch | `translate_hide_window` | `false` |

窗口位置选项: `mouse` / `pre_state`

---

### 6.3 配置页: 识别

**文件**: `src/window/Config/pages/Recognize/index.jsx`

| UI 元素 | 类型 | 配置键 | 默认值 |
|-----------|------|-----------|---------|
| 识别语言 | Dropdown | `recognize_language` | `'auto'` |
| 删除换行 | Switch | `recognize_delete_newline` | `false` |
| 自动复制 | Switch | `recognize_auto_copy` | `false` |
| 失焦关闭 | Switch | `recognize_close_on_blur` | `false` |
| 隐藏窗口 | Switch | `recognize_hide_window` | `false` |

---

### 6.4 配置页: 快捷键

**文件**: `src/window/Config/pages/Hotkey/index.jsx`

四个快捷键输入框，每个都有"确定"按钮：

| 标签 | 配置键 | 默认值 | 注册名称 |
|-------|-----------|---------|-------------------|
| 划词翻译 | `hotkey_selection_translate` | `''` | `hotkey_selection_translate` |
| 输入翻译 | `hotkey_input_translate` | `''` | `hotkey_input_translate` |
| OCR 识别 | `hotkey_ocr_recognize` | `''` | `hotkey_ocr_recognize` |
| OCR 翻译 | `hotkey_ocr_translate` | `''` | `hotkey_ocr_translate` |

**快捷键输入行为**：
- 捕获组合键 (Ctrl/Shift/Alt/Meta + key)
- Backspace 清除快捷键
- 确定按钮调用 `invoke('register_shortcut_by_frontend', ...)` 在操作系统级别注册
- 成功/失败时弹出 toast 通知
- 使用 `{ sync: false }` 推迟配置保存直到成功注册

---

### 6.5 配置页: 服务

**文件**: `src/window/Config/pages/Service/index.jsx`

使用 **Tabs** 组件，4 个标签页：翻译、识别、TTS、收藏。

#### 服务列表（每个标签页）

**结构**：`DragDropContext` 用于服务实例排序。每个实例是一个 `ServiceItem`。

#### ServiceItem 组件

| 元素 | 图标 | 行为 |
|---------|------|----------|
| 拖拽手柄 | `RxDragHandleHorizontal` | 通过拖放排序 |
| 服务图标 | Image | 服务 logo |
| 服务名称 | Text | 自定义实例名称或 i18n 默认名称 |
| 启用开关 | Small switch | 按实例启用/禁用 |
| 编辑按钮 | `BiSolidEdit` | 打开 ConfigModal |
| 删除按钮 | `MdDeleteOutline` (红色) | 移除实例。翻译/识别/TTS 至少需要 1 个。 |

如果是插件服务但插件未安装则隐藏。

#### 添加服务按钮

| 按钮 | 操作 |
|--------|--------|
| 添加内置服务 | 打开 SelectModal 列出所有可用的内置服务 |
| 添加外部服务 | 打开 SelectPluginModal 列出已安装的插件 |

#### SelectModal (内置服务)

列出所有可用内置服务及其图标的模态框。每个项目创建新的实例键并打开 ConfigModal。

#### SelectPluginModal (外部插件)

| 元素 | 行为 |
|---------|----------|
| 插件列表 | 显示已安装的插件，带图标和名称 |
| 删除按钮（每个插件） | 卸载插件 |
| 查看插件列表 | 打开外部插件目录 URL |
| 安装插件 | 打开 `.potext` 文件的文件对话框，调用 `install_plugin` |

#### ConfigModal

头部带服务图标 + 名称的模态框，主体渲染服务的 `Config` 组件，底部有取消按钮。

内置服务配置组件通常表现为**先测试后保存**的表单：
- 保存时提交一个小测试请求（根据服务类型：`hello` 翻译、示例 OCR 图像、示例 TTS 或收藏测试）。
- 成功时，配置被持久化，服务实例键被添加到对应的服务列表。
- 失败时，配置不提交，显示"测试失败" toast。
- 大多数需要凭据的服务包含一个"配置指南"帮助按钮，打开相应的文档 URL。
- 无需配置字段的服务显示 `services.no_need`，仅在点击保存时添加服务。一些旧的无需配置的服务可能仍然添加裸服务名（例如 `bing`）而不是生成的 `{name}@{randomId}` 键。

#### PluginConfig (通用插件配置表单)

| 元素 | 行为 |
|---------|----------|
| 主页按钮 | 打开插件主页 URL |
| 实例名称 | Text input |
| 动态字段 | 来自 `pluginList[name].needs` 数组: `input` → Input, `select` → Dropdown, 默认 → Input |
| 保存按钮 | 全宽，主题色 |

---

### 6.6 配置页: 历史记录

**文件**: `src/window/Config/pages/History/index.jsx`

| 元素 | 行为 |
|---------|----------|
| 表格 | 6 列（隐藏表头）：服务图标、源文本、源语言旗帜、目标语言旗帜、结果文本、时间戳 |
| 行选择 | 单选，点击打开详情模态框 |
| 分页 | 每页 20 条 |
| 清空按钮 | 删除并重建历史记录表 |

#### 历史详情模态框

| 元素 | 行为 |
|---------|----------|
| 服务图标 | 在模态框头部 |
| 源文本框 | 可编辑的源文本 |
| 结果文本框 | 可编辑的结果文本 |
| 保存按钮 | 更新历史记录 |
| 收藏按钮 | ButtonGroup，每个收藏服务一个图标按钮 |

---

### 6.7 配置页: 备份

**文件**: `src/window/Config/pages/Backup/index.jsx`

| UI 元素 | 类型 | 配置键 | 默认值 | 详情 |
|-----------|------|-----------|---------|---------|
| 备份类型 | Dropdown | `backup_type` | `'webdav'` | webdav / aliyun / local |

**WebDAV 部分**（当 type=webdav 时）：

| 元素 | 配置键 | 类型 |
|---------|-----------|------|
| URL 输入 | `webdav_url` | text |
| 用户名输入 | `webdav_username` | text |
| 密码输入 | `webdav_password` | password |

**阿里云盘部分**（当 type=aliyun 时）：

| 元素 | 配置键 | 详情 |
|---------|-----------|---------|
| 二维码图片 | -- | 用于扫码登录 |
| 用户头像 + 名称 | -- | 带 Tooltip "退出登录"按钮 |
| 访问令牌 | `aliyun_access_token` | QR 登录后存储 |

**本地部分**：无额外字段。

**操作按钮**：

| 按钮 | 颜色 | 操作 |
|--------|-------|--------|
| 备份 | 绿色, flat | 创建带时间戳的备份 ZIP |
| 恢复 | 紫色, flat | 打开恢复模态框 |

**恢复模态框** (WebDAV/阿里云盘)：列出备份文件，每个有下载按钮 + 删除按钮（红色图标）。

**备份内容**：`config.json`、`history.db`（如存在）、`plugins/` 目录（如存在）。ZIP 格式，Stored 压缩。

---

### 6.8 配置页: 关于

**文件**: `src/window/Config/pages/About/index.jsx`

| 元素 | 行为 |
|---------|----------|
| Pot logo | 图片 (icon.png) |
| 标题 + 版本 | "Pot" 文本 + 版本号 |
| 网站按钮 | 打开外部 URL |
| GitHub 按钮 | 打开 GitHub 仓库 |
| 反馈按钮 | Popover 包含 Issue 链接 + 邮箱 |
| 社区按钮 | Popover 包含 QQ 频道、QQ 群、Telegram、GitHub Discussions（各带 Tooltip） |
| 检查更新按钮 | 打开更新器窗口 |
| 查看日志按钮 | 打开日志目录 |
| 查看配置按钮 | 打开配置目录 |

---

## 7. 窗口: 更新器

**文件**: `src/window/Updater/index.jsx`

| 元素 | 行为 |
|---------|----------|
| 标题栏 | Pot 图标 + "更新器" 标题，可拖拽 |
| 更新日志 | 渲染为 ReactMarkdown（code、h2、h3、li 的自定义组件） |
| 加载骨架屏 | 获取发布信息时显示 |
| 进度条 | 粉色到黄色渐变，下载时显示 |
| 更新按钮 | 主题色，下载期间禁用。文本: "更新" → "下载中..." → "安装中..." |
| 取消按钮 | 危险色，关闭窗口 |

**状态**：空闲 → 下载中 → 安装中

---

## 8. 翻译服务

### 服务实例系统

每个服务实例有唯一键：`{service_name}@{random_id}`（例如 `openai@abc123`）。较早的实例可能仅使用 `{service_name}`。配置以该键存储在 `config.json` 中。

大多数实例配置包含：
- `instanceName` (string, 可选) — 自定义显示名称。缺失时回退到本地化的内置服务名称或插件显示名称。
- `enable` (boolean, 可选) — 此实例是否激活。缺失时视为启用。
- 服务特定字段（如下所列）

无需配置的旧版内置服务可能没有存储的配置对象，在服务列表中可能显示为裸服务名。

### 8.1 阿里巴巴

| 字段 | 值 |
|-------|-------|
| Key | `alibaba` |
| 配置 | `accesskey_id`, `accesskey_secret` |
| 认证 | 阿里云 AccessKey |
| 语言 (30) | auto, zh_cn, zh_tw, yue, ja, en, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, vi, id, th, ms, ar, hi, mn_mo, km, nb_no, nn_no, fa, sv, pl, nl, he |

### 8.2 百度

| 字段 | 值 |
|-------|-------|
| Key | `baidu` |
| 配置 | `appid`, `secret` |
| 认证 | MD5 签名 (appid + secret) |
| 语言 (32) | auto, zh_cn, zh_tw, yue, en, ja, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, vi, id, th, ms, ar, hi, km, nb_no, nn_no, fa, sv, pl, nl, uk, he |

### 8.3 百度领域翻译

| 字段 | 值 |
|-------|-------|
| Key | `baidu_field` |
| 配置 | `appid`, `secret`, `field` (dropdown) |
| 领域选项 | it, finance, machinery, senimed, novel, academic, aerospace, wiki, news, law, contract |
| 语言 | 同百度 (32) |

### 8.4 必应

| 字段 | 值 |
|-------|-------|
| Key | `bing` |
| 配置 | 无 (免费，无需 API key) |
| 语言 (27) | auto, zh_cn, zh_tw, yue, en, ja, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, vi, id, th, ms, ar, hi, mn_cy, mn_mo, km, nb_no, fa, sv, pl, nl, uk, he |

### 8.5 必应词典

| 字段 | 值 |
|-------|-------|
| Key | `bing_dict` |
| 配置 | 无 (免费) |
| 语言 (4) | auto, en, zh_cn, zh_tw |
| 输出 | 结构化词典结果（发音、释义、例句） |

### 8.6 彩云小译

| 字段 | 值 |
|-------|-------|
| Key | `caiyun` |
| 配置 | `token` |
| 语言 (4) | auto, zh_cn, zh_tw, en, ja |

### 8.7 剑桥词典

| 字段 | 值 |
|-------|-------|
| Key | `cambridge_dict` |
| 配置 | 无 (免费，网页抓取) |
| 语言 (4) | auto, en, zh_cn, zh_tw |
| 输出 | 结构化词典结果 |

### 8.8 ChatGLM

| 字段 | 值 |
|-------|-------|
| Key | `chatglm` |
| 配置 | `model` (dropdown), `apiKey`, `promptList` (可自定义) |
| 默认模型 | `chatglm_turbo` (旧版默认；下拉选项如下) |
| 模型 | glm-4.5, glm-4.5-x, glm-4.5-air, glm-4.5-airx, glm-4-plus, glm-4-air-250414, glm-4-long, glm-4-airx, glm-4-flashx-250414, glm-z1-air, glm-z1-airx, glm-z1-flashx, glm-4.5-flash, glm-4-flash-250414, glm-z1-flash |
| 语言 (auto + 31) | LLM 语言枚举：所有配置的标准目标语言加粤语 (`yue`)，带可读名称 |
| 特性 | 基于 LLM，可自定义 prompt |
| API | 智谱AI (bigmodel.cn) |

### 8.9 DeepL

| 字段 | 值 |
|-------|-------|
| Key | `deepl` |
| 配置 | `type` (free/api/deeplx dropdown), `authKey` (用于 API), `customUrl` (用于 DeepLX) |
| 语言 (14) | auto, zh_cn, zh_tw, ja, en, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, id, sv, pl, nl, uk |
| 模式 | Free (公共端点), API (官方 + auth key), DeepLX (自建代理) |

### 8.10 ECDict

| 字段 | 值 |
|-------|-------|
| Key | `ecdict` |
| 配置 | 无 (离线/本地词典) |
| 语言 (4) | auto, zh_cn, zh_tw, en |
| 输出 | 结构化词典结果（音标、释义、例句） |

### 8.11 Gemini Pro

| 字段 | 值 |
|-------|-------|
| Key | `geminipro` |
| 配置 | `stream` (boolean), `apiKey`, `requestPath`, `thinkingBudget`, `promptList` |
| 默认 URL | `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro` |
| 语言 (auto + 31) | LLM 语言枚举：所有配置的标准目标语言加粤语 (`yue`) |
| 特性 | 基于 LLM，流式输出，思考预算 |

### 8.12 谷歌

| 字段 | 值 |
|-------|-------|
| Key | `google` |
| 配置 | `custom_url` (默认: `https://translate.google.com`) |
| 语言 (26) | auto, zh_cn, zh_tw, ja, en, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, vi, id, th, ms, ar, hi, mn_cy, km, nb_no, nn_no, fa, sv, pl, nl, uk, he |
| 认证 | 基于 token（抓取） |

### 8.13 Lingva

| 字段 | 值 |
|-------|-------|
| Key | `lingva` |
| 配置 | `requestPath` (默认: `https://lingva.ml`) |
| 语言 | 同谷歌翻译 |
| 说明 | 通过 Lingva 代理谷歌翻译 |

### 8.14 牛翻译

| 字段 | 值 |
|-------|-------|
| Key | `niutrans` |
| 配置 | `https` (boolean, 默认 true), `apikey` |
| 语言 (30) | auto, zh_cn, zh_tw, yue, en, ja, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, vi, id, th, ms, ar, hi, mn_cy, mn_mo, km, nb_no, nn_no, fa, sv, pl, nl, uk, he |

### 8.15 Ollama

| 字段 | 值 |
|-------|-------|
| Key | `ollama` |
| 配置 | `stream` (boolean), `model` (默认: `gemma:2b`), `requestPath` (默认: `http://localhost:11434`), `promptList` |
| 语言 (auto + 31) | LLM 语言枚举：所有配置的标准目标语言加粤语 (`yue`) |
| 特性 | 本地 LLM，流式输出，从 UI 拉取模型，显示已安装模型状态 |

### 8.16 OpenAI

| 字段 | 值 |
|-------|-------|
| Key | `openai` |
| 配置 | `service` (openai/azure), `requestPath`, `model` (默认: `gpt-3.5-turbo`), `apiKey`, `stream` (boolean), `promptList`, `requestArguments` (JSON) |
| 默认 URL | `https://api.openai.com/v1/chat/completions` |
| 语言 (auto + 31) | LLM 语言枚举：所有配置的标准目标语言加粤语 (`yue`) |
| 特性 | OpenAI + Azure OpenAI 模式，流式输出，可自定义 prompt |
| 请求参数默认值 | `{"temperature":0.1,"top_p":0.99,"frequency_penalty":0,"presence_penalty":0}` |

### 8.17 腾讯

| 字段 | 值 |
|-------|-------|
| Key | `tencent` |
| 配置 | `secret_id`, `secret_key` |
| 认证 | TC3-HMAC-SHA256 签名 |
| 语言 (18) | auto, zh_cn, zh_tw, en, ja, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, vi, id, th, ms, ar, hi |

### 8.18 TranSmart

| 字段 | 值 |
|-------|-------|
| Key | `transmart` |
| 配置 | `username`, `token` |
| 语言 (21) | auto, zh_cn, zh_tw, en, ja, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, vi, id, th, ms, ar, km |
| 说明 | 腾讯 TranSmart (QQ 文档 API) |

### 8.19 火山引擎

| 字段 | 值 |
|-------|-------|
| Key | `volcengine` |
| 配置 | `appid`, `secret` |
| 语言 (26) | auto, zh_cn, zh_tw, ja, en, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, vi, id, th, ms, ar, hi, mn_cy, nb_no, nn_no, fa, sv, pl, nl, uk, he |
| 说明 | 字节跳动翻译服务 |

### 8.20 Yandex

| 字段 | 值 |
|-------|-------|
| Key | `yandex` |
| 配置 | 无 (免费，抓取端点) |
| 语言 (25) | auto, zh_cn, zh_tw, en, ja, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, vi, id, th, ms, ar, hi, nb_no, nn_no, fa, sv, pl, nl, uk, he |

### 8.21 有道

| 字段 | 值 |
|-------|-------|
| Key | `youdao` |
| 配置 | `appkey`, `key` |
| 认证 | MD5 签名 |
| 语言 (28) | auto, zh_cn, zh_tw, yue, en, ja, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, vi, id, th, ms, ar, hi, mn_mo, km, nb_no, nn_no, fa, sv, pl, nl, uk, he |

---

## 9. OCR / 识别服务

共有 16 个内置识别服务，由 `src/services/recognize/index.jsx` 导出。

### 9.1 系统 OCR

| 字段 | 值 |
|-------|-------|
| Key | `system` |
| 配置 | 无 |
| 语言 (18) | auto, zh_cn, zh_tw, en, ja, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, vi, id, th, ms, ar, hi, uk, he |
| 实现 | Windows: WinRT OcrEngine, macOS: 捆绑二进制文件, Linux: tesseract CLI |

### 9.2 Tesseract

| 字段 | 值 |
|-------|-------|
| Key | `tesseract` |
| 配置 | 无 (需要本地安装 tesseract) |
| 语言 (20) | auto, zh_cn, zh_tw, en, yue, ja, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, vi, id, th, ms, ar, hi, uk, he |
| 实现 | 使用 tesseract.js (客户端) |

### 9.3 百度 OCR

| 字段 | 值 |
|-------|-------|
| Key | `baidu_ocr` |
| 配置 | `client_id`, `client_secret` |
| 语言 (12) | auto, zh_cn, zh_tw, en, yue, ja, ko, fr, es, ru, de, it, pt_pt, pt_br |

### 9.4 百度高精度 OCR

| 字段 | 值 |
|-------|-------|
| Key | `baidu_accurate_ocr` |
| 配置 | `client_id`, `client_secret` |
| 语言 (18) | auto_detect, CHN_ENG, ENG, JAP, KOR, FRE, SPA, RUS, GER, ITA, TUR, POR, VIE, IND, THA, MAL, ARA, HIN |

### 9.5 百度图片 OCR

| 字段 | 值 |
|-------|-------|
| Key | `baidu_img_ocr` |
| 配置 | `appid`, `secret` |
| 语言 (18) | auto, zh, cht, yue, en, jp, kor, fra, spa, ru, de, it, tr, pt, pot, vie, id, th, may, ar, hi |

### 9.6 讯飞 OCR

| 字段 | 值 |
|-------|-------|
| Key | `iflytek_ocr` |
| 配置 | `appid`, `apisecret`, `apikey` |
| 语言 (4) | auto, zh_cn, zh_tw, en |

### 9.7 讯飞 IntSig OCR

| 字段 | 值 |
|-------|-------|
| Key | `iflytek_intsig_ocr` |
| 配置 | 同讯飞 |
| 语言 (18) | auto, zh_cn, zh_tw, en, ja, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, vi, id, th, ms, ar, hi |

### 9.8 讯飞 LaTeX OCR

| 字段 | 值 |
|-------|-------|
| Key | `iflytek_latex_ocr` |
| 配置 | 同讯飞 |
| 语言 (4) | auto, zh_cn, zh_tw, en |
| 特性 | 数学公式 → LaTeX |

### 9.9 腾讯 OCR

| 字段 | 值 |
|-------|-------|
| Key | `tencent_ocr` |
| 配置 | `secret_id`, `secret_key` |
| 语言 (16) | auto, zh, zh_rare, en, jap, kor, fre, spa, rus, ger, ita, por, vie, tha, may, ara, hi |

### 9.10 腾讯高精度 OCR

| 字段 | 值 |
|-------|-------|
| Key | `tencent_accurate_ocr` |
| 配置 | `secret_id`, `secret_key` |
| 语言 (5) | auto, zh, zh_rare, en |

### 9.11 腾讯图片 OCR

| 字段 | 值 |
|-------|-------|
| Key | `tencent_img_ocr` |
| 配置 | `secret_id`, `secret_key` |
| 语言 (14) | auto, zh, zh-TW, en, ja, ko, fr, es, ru, de, it, pt, vi, th, ms |

### 9.12 火山引擎 OCR

| 字段 | 值 |
|-------|-------|
| Key | `volcengine_ocr` |
| 配置 | `appid`, `secret` |
| 语言 (5) | auto, zh_cn, zh_tw, yue, en |

### 9.13 火山引擎多语言 OCR

| 字段 | 值 |
|-------|-------|
| Key | `volcengine_multi_lang_ocr` |
| 配置 | `appid`, `secret` |
| 语言 (19) | auto, zh_cn, zh_tw, en, ja, ko, fr, es, ru, de, it, tr, pt_pt, pt_br, vi, id, th, ms, ar, hi |

### 9.14 OpenAI 兼容视觉

| 字段 | 值 |
|-------|-------|
| Key | `openai_compatible` |
| 配置 | `baseUrl` (默认: `https://api.siliconflow.cn/v1`), `apiKey`, `model` (默认: `Pro/Qwen/Qwen2.5-VL-7B-Instruct`), `enableStream` (默认: `true`) |
| 语言 (auto + 31) | LLM 语言枚举：所有配置的标准目标语言加粤语 (`yue`) |
| 特性 | 基于视觉 LLM 的 OCR，流式输出 |

### 9.15 二维码

| 字段 | 值 |
|-------|-------|
| Key | `qrcode` |
| 配置 | 无 |
| 语言 | 不适用 (与语言无关) |
| 实现 | jsQR 库 |

### 9.16 Simple LaTeX

| 字段 | 值 |
|-------|-------|
| Key | `simple_latex_ocr` |
| 配置 | `token` |
| 语言 (4) | auto, zh_cn, zh_tw, en |
| 特性 | 数学公式 → LaTeX，通过 SimpleTex API |

---

## 10. TTS 服务

### 10.1 Edge TTS

| 字段 | 值 |
|-------|-------|
| Key | `edge_tts` |
| 配置 | `requestPath` (语音短 ID，默认: `auto`) |
| 语言 (27) | 所有标准语言 |
| 实现 | `msedge-tts` Rust crate 用于合成，`rodio` 用于播放 |
| 后端命令 | `get_edge_tts_voice_data`, `get_edge_tts_voice_data_and_play` |
| 行为 | 点击播放，相同文本再次点击停止，不同文本替换 |

### 10.2 Lingva TTS

| 字段 | 值 |
|-------|-------|
| Key | `lingva_tts` |
| 配置 | `requestPath` (默认: `lingva.pot-app.com`) |
| 语言 (27) | 所有标准语言 |
| 说明 | 通过 Lingva 代理谷歌翻译 TTS |

---

## 11. 收藏服务

### 11.1 Anki

| 字段 | 值 |
|-------|-------|
| Key | `anki` |
| 配置 | `port` (默认: 8765) |
| 行为 | 通过 AnkiConnect 插件发送词组到 Anki |
| API | HTTP POST 到 `http://localhost:{port}` |

### 11.2 欧路词典

| 字段 | 值 |
|-------|-------|
| Key | `eudic` |
| 配置 | `name` (默认: `pot`), `token` |
| 行为 | 发送词组到欧路词典应用 |

---

## 12. 语言检测

### 可用引擎

| 引擎 | 配置值 | 类型 | 语言 |
|--------|-------------|------|-----------|
| 百度 | `baidu` (默认) | 在线 API | 全部 |
| 腾讯 | `tencent` | 在线 API | 全部 |
| 牛翻译 | `niutrans` | 在线 API | 全部 |
| 谷歌 | `google` | 在线 API | 全部 |
| 必应 | `bing` | 在线 API | 全部 |
| Yandex | `yandex` | 在线 API | 全部 |
| 本地 (Lingua) | `local` | 离线 | 22 种语言 |

### 本地检测 (Lingua)

支持：中文、日语、英语、韩语、法语、西班牙语、德语、俄语、意大利语、葡萄牙语、土耳其语、阿拉伯语、越南语、泰语、印尼语、马来语、印地语、蒙古语、书面挪威语、新挪威语、波斯语、乌克兰语。

当 `translate_detect_engine` 设置为 `"local"` 时，在启动时预热。返回内部语言代码（如 `zh_cn`、`ja`），失败时默认为 `"en"`。

---

## 13. 配置系统

### 存储

- **位置**: `{system_config_dir}/com.new-pot.desktop/config.json`
- **机制**: JSON 键值存储，通过 `tauri-plugin-store`
- **前端访问**: `useConfig(key, defaultValue)` hook
- **后端访问**: `config::get(key)` / `config::set(key, value)`
- **文件监听**: 检测外部变更，重新加载前端和后端
- **数据库**: SQLite 位于 `{config_dir}/history.db` (通过 `tauri-plugin-sql`)
- **首次运行**: 空 store 触发自动打开配置窗口

### 完整配置键参考

#### 应用设置

| 键 | 类型 | 默认值 | 说明 |
|-----|------|---------|-------------|
| `app_language` | string | `'en'` | UI 语言 |
| `app_theme` | string | `'system'` | 主题: system / light / dark |
| `app_font` | string | `'default'` | 主字体族 |
| `app_fallback_font` | string | `'default'` | 回退字体族 |
| `app_font_size` | number | `16` | 基础字号 px (10/12/14/16/18/20/24) |
| `dev_mode` | boolean | `false` | 开发者模式 |
| `transparent` | boolean | `true` | 窗口透明度 |
| `check_update` | boolean | `true` | 启动时自动检查更新 |
| `server_port` | number | `20202` | HTTP API 服务器端口 (0-65535)；修改后需重启 |
| `tray_click_event` | string | `'config'` | Windows 托盘点击行为 |

#### 代理设置

| 键 | 类型 | 默认值 | 说明 |
|-----|------|---------|-------------|
| `proxy_enable` | boolean | `false` | 启用代理；修改后需重启 |
| `proxy_host` | string | `''` | 代理地址 |
| `proxy_port` | string | `''` | 代理端口 |
| `proxy_username` | string | `''` | 代理用户名 (未使用) |
| `proxy_password` | string | `''` | 代理密码 (未使用) |
| `no_proxy` | string | `'localhost,127.0.0.1'` | 代理绕过列表 |

#### 翻译设置

| 键 | 类型 | 默认值 | 说明 |
|-----|------|---------|-------------|
| `translate_source_language` | string | `'auto'` | 默认源语言 |
| `translate_target_language` | string | `'zh_cn'` | 默认目标语言 |
| `translate_second_language` | string | `'en'` | 回退目标语言 |
| `translate_detect_engine` | string | `'baidu'` | 语言检测引擎 |
| `translate_auto_copy` | string | `'disable'` | 自动复制: source / target / source_target / disable |
| `incremental_translate` | boolean | `false` | 追加新文本而非替换 |
| `history_disable` | boolean | `false` | 禁用历史记录 |
| `dynamic_translate` | boolean | `false` | 输入时自动翻译 (1s 防抖) |
| `translate_delete_newline` | boolean | `false` | 去除源文本换行符 |
| `translate_remember_language` | boolean | `false` | 记住语言选择 |
| `translate_window_position` | string | `'mouse'` | 位置: mouse / pre_state |
| `translate_remember_window_size` | boolean | `false` | 记住窗口大小 |
| `translate_close_on_blur` | boolean | `true` | 失焦时关闭 |
| `translate_always_on_top` | boolean | `false` | 始终置顶 |
| `hide_source` | boolean | `false` | 隐藏源文本区域 |
| `hide_language` | boolean | `false` | 隐藏语言选择器 |
| `translate_hide_window` | boolean | `false` | 翻译后隐藏窗口 |
| `clipboard_monitor` | boolean | `false` | 监听剪贴板文本 |

#### 窗口尺寸/位置

| 键 | 类型 | 默认值 | 说明 |
|-----|------|---------|-------------|
| `translate_window_width` | number | `350` | 翻译窗口宽度 (逻辑像素) |
| `translate_window_height` | number | `420` | 翻译窗口高度 (逻辑像素) |
| `translate_window_position_x` | number | `0` | 保存的 X 位置 (逻辑像素) |
| `translate_window_position_y` | number | `0` | 保存的 Y 位置 (逻辑像素) |
| `recognize_window_width` | number | `800` | 识别窗口宽度 |
| `recognize_window_height` | number | `400` | 识别窗口高度 |

#### 识别设置

| 键 | 类型 | 默认值 | 说明 |
|-----|------|---------|-------------|
| `recognize_language` | string | `'auto'` | 默认 OCR 语言 |
| `recognize_delete_newline` | boolean | `false` | 去除 OCR 结果中的换行符 |
| `recognize_auto_copy` | boolean | `false` | 自动复制 OCR 结果 |
| `recognize_hide_window` | boolean | `false` | OCR 后隐藏窗口 |
| `recognize_close_on_blur` | boolean | `false` | 失焦时关闭 |

#### 快捷键设置

| 键 | 类型 | 默认值 | 说明 |
|-----|------|---------|-------------|
| `hotkey_selection_translate` | string | `''` | 划词翻译快捷键 |
| `hotkey_input_translate` | string | `''` | 输入翻译快捷键 |
| `hotkey_ocr_recognize` | string | `''` | OCR 识别快捷键 |
| `hotkey_ocr_translate` | string | `''` | OCR 翻译快捷键 |

#### 服务列表

| 键 | 类型 | 默认值 | 说明 |
|-----|------|---------|-------------|
| `translate_service_list` | string[] | `['deepl','bing','lingva','yandex','google','ecdict']` | 活动的翻译实例 |
| `recognize_service_list` | string[] | `['system','tesseract']` | 活动的 OCR 实例 |
| `tts_service_list` | string[] | `['lingva_tts']` | 活动的 TTS 实例 |
| `collection_service_list` | string[] | `[]` | 活动的收藏实例 |

#### 备份设置

| 键 | 类型 | 默认值 | 说明 |
|-----|------|---------|-------------|
| `backup_type` | string | `'webdav'` | 备份类型: webdav / aliyun / local |
| `webdav_url` | string | `''` | WebDAV 服务器 URL |
| `webdav_username` | string | `''` | WebDAV 用户名 |
| `webdav_password` | string | `''` | WebDAV 密码 |
| `aliyun_access_token` | string | `''` | 阿里云盘 OAuth 令牌 |

---

## 14. Rust 后端模块

### 14.1 main.rs — 应用入口

**初始化序列**：
1. 单实例插件（防止重复启动）
2. 日志插件 (LogDir + Stdout)
3. 自启动插件 (macOS LaunchAgent)
4. SQL 插件 (SQLite 用于历史记录)
5. Store 插件 (JSON 配置持久化)
6. FS watch 插件
7. 系统托盘设置
8. 全局 AppHandle (OnceCell)
9. 配置初始化 + 首次运行检测
10. StringWrapper 状态 (共享文本缓冲区)
11. 托盘菜单初始化
12. HTTP 服务器启动
13. 全局快捷键注册
14. 代理设置 (如已配置)
15. 自动更新检查
16. 本地语言检测初始化 (如已配置)
17. 剪贴板监听启动
18. 窗口关闭防护 (ExitRequested → prevent_exit)

### 14.2 cmd.rs — Tauri 命令

| 命令 | 签名 | 说明 |
|---------|-----------|-------------|
| `stream_fetch` | `(url, method, headers?, body?, request_id)` | 流式 HTTP 请求；发射 chunk/error/end 事件 |
| `get_text` | `()` | 返回当前 StringWrapper 共享文本 |
| `reload_store` | `()` | 从磁盘重新加载配置 store |
| `cut_image` | `(left, top, width, height)` | 将截图裁剪为 `pot_screenshot_cut.png` |
| `get_base64` | `()` | 返回 base64 编码的裁剪截图 |
| `copy_img` | `(width, height)` | 复制裁剪图像到系统剪贴板 |
| `set_proxy` | `()` | 从配置设置 http/https/all_proxy 环境变量 |
| `unset_proxy` | `()` | 移除代理环境变量 |
| `install_plugin` | `(path_list)` | 安装 `.potext` 插件归档 |
| `run_binary` | `(plugin_type, plugin_name, cmd_name, args)` | 执行插件二进制文件 |
| `font_list` | `()` | 返回系统字体族列表 |
| `open_devtools` | `(window)` | 在窗口上切换开发者工具 |
| `get_edge_tts_voice_data` | `(voice_short_id, text)` | 通过 Edge TTS 合成语音，返回字节数据 |
| `get_edge_tts_voice_data_and_play` | `(voice_short_id, text)` | 合成并通过 rodio 播放音频 |

### 14.3 config.rs — 配置存储

| 函数 | 说明 |
|----------|-------------|
| `init_config(app)` | 初始化 store |
| `get(key) → Option<Value>` | 读取配置值 |
| `set(key, value)` | 写入配置值 (自动保存) |
| `is_first_run() → bool` | 检查 store 是否为空 |
| `check_service_available()` | 验证服务列表，移除无效条目 |
| `get_plugin_list(plugin_type)` | 列出某种类型的已安装插件 |

### 14.4 server.rs — HTTP API 服务器

绑定到 `127.0.0.1:{server_port}` (默认 20202)。参见[第 15 节](#15-http-api-服务器)。

### 14.5 tray.rs — 系统托盘

参见[第 16 节](#16-系统托盘菜单)。

### 14.6 hotkey.rs — 全局快捷键

参见[第 17 节](#17-全局快捷键系统)。

### 14.7 clipboard.rs — 剪贴板监听

参见[第 18 节](#18-剪贴板监听)。

### 14.8 window.rs — 窗口管理

参见[第 2 节](#2-多窗口系统)。

### 14.9 screenshot.rs — 屏幕捕获

| 函数 | 说明 |
|----------|-------------|
| `screenshot(x, y)` | 在指定位置捕获屏幕，保存为 `pot_screenshot.png` |

使用 `screenshots` crate。

### 14.10 system_ocr.rs — 平台 OCR

| 平台 | 实现 |
|----------|---------------|
| Windows | WinRT `OcrEngine` + `BitmapDecoder` |
| macOS | 捆绑二进制文件 `resources/ocr-{arch}-apple-darwin` |
| Linux | `tesseract {image_path} stdout -l {lang}` |

### 14.11 backup.rs — 备份与恢复

参见[第 19 节](#19-备份与恢复)。

### 14.12 lang_detect.rs — 本地语言检测

使用 `lingua` crate。支持 22 种语言。当引擎设置为 "local" 时启动时预热。

### 14.13 updater.rs — 自动更新

如果 `check_update` 为 true，启动时检查 Tauri 更新端点。有更新时打开更新器窗口。

### 14.14 error.rs — 错误类型

错误枚举包装：Io, generic Box<dyn Error>, Dav, DavRe (reqwest), Serde (JSON), Zip, WalkDir, Tauri, StripPrefix, Arboard (剪贴板), Image, Selection (font_kit), Reqwest, EdgeTts, AnyEdgeTts (anyhow), RodioPlay, RodioStream。

---

## 15. HTTP API 服务器

**绑定**: `127.0.0.1:{server_port}` (默认 20202，可配置)

| 方法 | 端点 | 说明 |
|--------|----------|-------------|
| GET/POST | `/` | 翻译请求体中的文本 |
| GET/POST | `/translate` | 翻译请求体中的文本 |
| GET | `/config` | 打开配置窗口 |
| GET | `/selection_translate` | 触发划词翻译 |
| GET | `/input_translate` | 打开输入翻译窗口 |
| GET | `/ocr_recognize` | OCR 识别（带截图） |
| GET | `/ocr_recognize?screenshot=false` | OCR 识别（来自剪贴板/文件，无截图） |
| GET | `/ocr_recognize?screenshot=true` | OCR 识别（带截图，显式形式） |
| GET | `/ocr_translate` | OCR 翻译（带截图） |
| GET | `/ocr_translate?screenshot=false` | OCR 翻译（无截图） |
| GET | `/ocr_translate?screenshot=true` | OCR 翻译（带截图，显式形式） |

### HTTP 行为说明

- 所有成功的处理器响应纯文本 `ok`。
- `/` 和 `/translate` 读取请求体作为待翻译文本。
- `screenshot=false` 端点不从请求体或剪贴板读取图像。它们期望在 `{system_cache_dir}/com.new-pot.desktop/pot_screenshot_cut.png` 有一个已有的 PNG 文件。
- `ocr_recognize?screenshot=false` 打开/重新加载识别窗口并发射 `new_image` 事件。
- `ocr_translate?screenshot=false` 调用 `image_translate`，通过第一个配置的识别服务运行 OCR，然后翻译 OCR 结果。
- 当前的 tiny_http 路由器精确匹配上面列出的 URL 字符串；不处理任意查询参数顺序或额外的查询参数。

---

## 16. 系统托盘菜单

### 菜单项（通用）

| 项目 | 类型 | 操作 |
|------|------|--------|
| 输入翻译 | 按钮 | 打开输入翻译窗口 |
| 剪贴板监听 | 复选框 | 切换剪贴板监听 |
| 自动复制 | 子菜单 | 源文本 / 目标文本 / 源+目标 / 禁用 |
| — | 分隔线 | — |
| OCR 识别 | 按钮 | 触发 OCR 识别 |
| OCR 翻译 | 按钮 | 触发 OCR 翻译 |
| — | 分隔线 | — |
| 配置 | 按钮 | 打开配置窗口 |
| 检查更新 | 按钮 | 打开更新器窗口 |
| 查看日志 | 按钮 | 打开日志目录 |
| — | 分隔线 | — |
| 重启 | 按钮 | 重启应用 |
| 退出 | 按钮 | 退出应用 |

### 托盘左键点击（仅 Windows）

通过 `tray_click_event` 配置：
- `config` — 打开配置窗口（默认）
- `translate` — 打开翻译窗口
- `ocr_recognize` — 触发 OCR 识别
- `ocr_translate` — 触发 OCR 翻译
- `disable` — 无操作

### 本地化

托盘菜单本地化支持 11 种语言：en, zh_cn, zh_tw, ja, ko, fr, de, ru, pt_br, fa, uk。

---

## 17. 全局快捷键系统

### 快捷键操作

| 配置键 | 操作 |
|-----------|--------|
| `hotkey_selection_translate` | 划词翻译（切换：显示/隐藏） |
| `hotkey_input_translate` | 输入翻译（切换：显示/隐藏） |
| `hotkey_ocr_recognize` | OCR 识别（带截图） |
| `hotkey_ocr_translate` | OCR 翻译（带截图） |

### 注册

- **启动时**：所有配置的快捷键通过 `register_shortcut(shortcut)` 注册
- **运行时**：前端调用 `register_shortcut_by_frontend(name, shortcut)` 重新绑定
- **防抖**：划词和输入翻译切换有 120ms 防抖，防止快速切换
- 格式：`Ctrl+Shift+S`、`Alt+Q`、`Command+Option+T` (macOS)

---

## 18. 剪贴板监听

| 属性 | 值 |
|----------|-------|
| 配置键 | `clipboard_monitor` |
| 默认值 | `false` |
| 轮询间隔 | 500ms |
| 行为 | 每 500ms 读取剪贴板文本；如果变化，用新文本打开翻译窗口 |

启用剪贴板监听时，翻译自动复制在 `TargetArea` 中被有意抑制，以防止复制的翻译结果重新触发剪贴板翻译。

---

## 19. 备份与恢复

### WebDAV

| 操作 | 说明 |
|-----------|-------------|
| `list` | 列出 WebDAV 服务器 `/pot-app/` 目录中的备份文件 |
| `put` | 上传带时间戳的 ZIP 备份 |
| `get` | 下载备份文件，解压到配置目录（通过临时目录） |
| `delete` | 从服务器删除备份文件 |

### 阿里云盘

| 操作 | 说明 |
|-----------|-------------|
| `put` | 上传到预签名 URL |
| `get` | 从 URL 下载 |

使用 OAuth 流程，通过扫码登录认证。

### 本地

| 操作 | 说明 |
|-----------|-------------|
| `put` | 将 ZIP 保存到指定本地路径 |
| `get` | 从路径读取 ZIP，解压到配置目录 |

### 备份归档内容

- `config.json` — 所有应用设置
- `history.db` — SQLite 翻译历史记录（如存在）
- `plugins/` — 所有已安装插件（如存在）

格式：ZIP，Stored (无) 压缩。

---

## 20. 插件系统

### 插件文件格式

- 扩展名：`.potext` (ZIP 归档)
- 文件名必须以 `plugin` 开头
- 必需文件：`info.json` (包含 `plugin_type`)、`main.js`

### 插件类型

`translate`、`recognize`、`tts`、`collection`

### 安装

1. 用户通过文件对话框选择 `.potext` 文件
2. `install_plugin` Rust 命令验证结构
3. 解压到 `{config_dir}/plugins/{plugin_type}/{plugin_name}/`
4. 发射 `reload_plugin_list` 事件刷新 UI

### 运行时

- `invoke_plugin(pluginType, pluginName)` 加载并执行 `main.js`
- 插件接收工具函数：`tauriFetch`、`readBinaryFile` 等
- `run_binary` 命令允许插件执行捆绑的二进制文件

### 插件配置

- 插件元数据 (`needs` 数组) 定义动态配置字段
- 每个 `needs` 条目：`{ name, type, placeholder, options? }`
- `type`：`input` → 输入框，`select` → 带 `options` 的下拉框
- 存储在 `config.json` 中的实例键下

---

## 21. 自动更新系统

| 属性 | 值 |
|----------|-------|
| 配置键 | `check_update` |
| 默认值 | `true` |
| 端点 | Tauri 更新 JSON 端点 |
| 行为 | 启动时检查新版本；如发现，打开更新器窗口 |
| 安装 | 下载新版本，然后重启应用 |

---

## 22. 国际化

### 支持的 UI 语言环境 (19)

| 代码 | 语言 |
|------|----------|
| `zh_CN` | 简体中文 |
| `zh_TW` | 繁体中文 |
| `en` | 英语 |
| `ru_RU` | 俄语 |
| `pt_BR` | 葡萄牙语 (巴西) |
| `de_DE` | 德语 |
| `es_ES` | 西班牙语 |
| `fr_FR` | 法语 |
| `it_IT` | 意大利语 |
| `ja_JP` | 日语 |
| `ko_KR` | 韩语 |
| `pt_PT` | 葡萄牙语 (葡萄牙) |
| `tr_TR` | 土耳其语 |
| `nb_NO` | 挪威书面语 |
| `nn_NO` | 挪威新挪威语 |
| `fa_IR` | 波斯语 |
| `uk_UA` | 乌克兰语 |
| `ar_AE` | 阿拉伯语 |
| `he_IL` | 希伯来语 |

### 回退链

- `zh_tw` ↔ `zh_cn`
- `pt_pt` ↔ `pt_br`
- `nb_no` ↔ `nn_no`
- 默认回退：`en`

### 语言环境文件

每个语言环境是 `src/i18n/locales/{code}.json` 中的 JSON 文件，包含按页面/组件组织的所有 UI 字符串。

仓库中还包含 `ta_IN.json` 和 `tk_TM.json`，但当前 `i18n/index.jsx` 未注册它们，通用页面的语言下拉框也未暴露它们。

---

## 23. 支持的语言

### 翻译 UI 语言 (30)

`zh_cn`, `zh_tw`, `mn_mo`, `en`, `ja`, `ko`, `fr`, `es`, `ru`, `de`, `it`, `tr`, `pt_pt`, `pt_br`, `vi`, `id`, `th`, `ms`, `ar`, `hi`, `km`, `mn_cy`, `nb_no`, `nn_no`, `fa`, `sv`, `pl`, `nl`, `uk`, `he`

每种语言有 `LanguageFlag` 枚举映射到 flag-icon CSS 类用于国旗显示。服务特定的语言枚举可能包含额外值，如 `auto` 和 `yue`。

---

## 24. 依赖项

### 前端 (package.json) — 运行时

| 包 | 用途 |
|---------|---------|
| `@nextui-org/react` + `@nextui-org/theme` | UI 组件库 |
| `@react-spring/web` | 动画 |
| `@tauri-apps/api` | Tauri JS API 桥接 |
| `crypto-js` | 加密工具 |
| `flag-icons` | 国旗 SVG 图标 |
| `framer-motion` | 动画 |
| `i18next` + `react-i18next` | 国际化 |
| `jose` | JWT/JWS (阿里云盘认证) |
| `jotai` | 原子状态管理 |
| `jsqr` | 二维码检测 |
| `md5` | MD5 哈希 (百度签名) |
| `nanoid` | 唯一 ID 生成 |
| `next-themes` | 深色/浅色主题 |
| `ollama` | Ollama API 客户端 |
| `react` + `react-dom` | React 框架 |
| `react-beautiful-dnd` | 拖放排序 |
| `react-hot-toast` | Toast 通知 |
| `react-icons` | 图标库 |
| `react-markdown` | Markdown 渲染 |
| `react-router-dom` | 客户端路由 |
| `react-spinners` | 加载动画 |
| `react-use-measure` | DOM 测量 |
| `tauri-plugin-autostart-api` | 操作系统自启动 |
| `tauri-plugin-fs-watch-api` | 文件系统监听 |
| `tauri-plugin-log-api` | 文件日志 |
| `tauri-plugin-sql-api` | SQLite 数据库 |
| `tauri-plugin-store-api` | 持久化配置 |
| `tesseract.js` | 客户端 OCR |
| `uuid` | UUID 生成 |

### 前端 — 开发

| 包 | 用途 |
|---------|---------|
| `@tauri-apps/cli` | Tauri 构建/开发工具链 |
| `@vitejs/plugin-react` | Vite React 插件 |
| `autoprefixer` | CSS 自动前缀 |
| `postcss` | CSS 处理 |
| `prettier` | 代码格式化 |
| `tailwindcss` | 实用工具 CSS |
| `typescript` | TypeScript 编译器 |
| `vite` | 前端构建 |
| `vitest` | 单元测试 |

### 后端 (Cargo.toml)

| Crate | 用途 |
|-------|---------|
| `tauri` (v1.8) | 桌面框架 (所有功能) |
| `tauri-plugin-single-instance` | 防止重复实例 |
| `tauri-plugin-autostart` | 开机自启动 |
| `tauri-plugin-store` | JSON 配置持久化 |
| `tauri-plugin-sql` (sqlite) | 历史记录数据库 |
| `tauri-plugin-log` | 文件日志 |
| `tauri-plugin-fs-watch` | 配置文件监听 |
| `selection` | 跨平台文本选择 |
| `tiny_http` | 内置 HTTP 服务器 |
| `screenshots` | 屏幕捕获 |
| `mouse_position` | 鼠标光标位置 |
| `lingua` | 离线语言检测 |
| `reqwest` + `reqwest_dav` | HTTP 客户端 + WebDAV |
| `msedge-tts` + `rodio` | Edge TTS + 音频播放 |
| `image` | 图像处理 (裁剪) |
| `base64` + `arboard` | 编码 + 剪贴板 |
| `font-kit` | 系统字体枚举 |
| `zip` + `walkdir` | ZIP 归档 + 目录遍历 |

---

## 25. 平台特定行为

### 窗口装饰

| 平台 | 行为 |
|----------|----------|
| macOS | 覆盖式标题栏，隐藏标题，无 WindowControl 组件 |
| Windows | 透明，无装饰，窗口阴影 |
| Linux | 透明，无装饰，窗口阴影 |

### 截图

| 平台 | 方式 |
|----------|--------|
| macOS | `screencapture -i -r` 系统命令 |
| Windows | 带鼠标选择的全屏覆盖 |
| Linux | 带鼠标选择的全屏覆盖 |

### 系统 OCR

| 平台 | 方式 |
|----------|--------|
| Windows | WinRT OcrEngine |
| macOS | 捆绑二进制文件 `resources/ocr-{arch}-apple-darwin` |
| Linux | `tesseract` CLI |

### 托盘

| 平台 | 左键点击行为 |
|----------|-------------------|
| Windows | 通过 `tray_click_event` 配置 |
| macOS/Linux | 默认系统托盘行为 |

### 自启动

| 平台 | 方式 |
|----------|--------|
| macOS | LaunchAgent |
| Windows/Linux | 标准自启动 |

### 隐藏设置

| 设置 | 隐藏平台 |
|---------|----------|
| `transparent` | macOS |
| `tray_click_event` | 非 Windows |
| WindowControl 按钮 | macOS |

### Wayland 说明

- Tauri 全局快捷键在 Wayland 上不可靠。用户可以配置系统快捷键，通过 `curl` 调用本地 HTTP API。
- 内部截图捕获在 Hyprland 等纯 Wayland 环境下可能不工作。支持的解决方案是使用外部截图工具（例如 `grim` + `slurp`）将 `pot_screenshot_cut.png` 写入应用缓存目录，然后调用 `/ocr_recognize?screenshot=false` 或 `/ocr_translate?screenshot=false`。
- 一些 Wayland 窗口管理器无法向应用提供正确的鼠标坐标。用户可能需要窗口规则来浮动和定位翻译/OCR/截图窗口。

---

## 26. 前端 Hooks 与工具函数

### Hooks (`src/hooks/`)

#### `useConfig(key, defaultValue, options)`

从持久化 store 读取/写入配置。通过 Tauri 事件在窗口间同步状态。

- 选项：`{ sync: true }` (默认) — 自动同步；`false` — 推迟到手动保存
- 返回 `[value, setter, getter]`
- 还导出 `deleteKey(key)`

#### `useGetState(initState)`

返回 `[state, setState, getState]`，其中 `getState` 返回当前 ref 值（避免闭包过期）。

#### `useSyncAtom(atom)`

用本地值 + 通过 `syncAtom()` 延迟同步包装 Jotai atom。

#### `useToastStyle()`

基于当前主题返回 react-hot-toast 的样式对象。

#### `useVoice()`

返回 `playOrStop(data)` 用于 TTS 音频播放。

### 工具函数 (`src/utils/`)

#### `debounce(fn, delay=500)`

简单防抖工具。

#### `initEnv()` (`env.js`)

导出 `osType`、`arch`、`osVersion`、`appVersion` 全局变量。

#### `invoke_plugin(pluginType, pluginName)` (`invoke_plugin.js`)

加载并执行插件 `main.js`，提供工具函数。

#### `detect(text)` (`lang_detect.js`)

语言检测调度器。读取引擎配置，委托给相应的 API。

#### `languageList` / `LanguageFlag` (`language.ts`)

30 个语言代码 + flag-icon CSS 类映射。

#### `ServiceType` / `ServiceSourceType` (`service_instance.ts`)

- `ServiceType`：translate / recognize / tts / collection
- `ServiceSourceType`：builtin / plugin
- `createServiceInstanceKey(name)`：创建 `name@randomId`
- `getServiceName(key)`：提取名称
- `getServiceSouceType(key)`：确定内置 vs 插件

#### `initStore()` (`store.js`)

在 `config.json` 处初始化 tauri-plugin-store，监听外部文件变更。

#### `streamFetch(url, options)` (`stream_fetch.js`)

通过 Rust 后端的流式 HTTP。事件：`stream-chunk-{id}`、`stream-end-{id}`、`stream-error-{id}`。

---

## 27. 状态管理

### Jotai Atoms (本地组件状态)

| Atom | 文件 | 用途 |
|------|------|---------|
| `sourceTextAtom` | Translate/SourceArea | 当前源文本 |
| `detectLanguageAtom` | Translate/SourceArea | 自动检测到的语言 |
| `autoCopyDoneAtom` | Translate/SourceArea | 自动复制已执行标志 |
| `sourceLanguageAtom` | Translate/LanguageArea | 活动的源语言 |
| `targetLanguageAtom` | Translate/LanguageArea | 活动的目标语言 |
| `pluginListAtom` | Recognize | 已加载的插件元数据 |
| `base64Atom` | Recognize/ImageArea | Base64 截图图像 |
| `textAtom` | Recognize/TextArea | OCR 结果文本 |
| `currentServiceInstanceKeyAtom` | Recognize/ControlArea | 选中的识别服务 |
| `languageAtom` | Recognize/ControlArea | 活动的 OCR 语言 |
| `recognizeFlagAtom` | Recognize/ControlArea | 重新识别触发器 (nanoid) |

### 共享状态 (Rust 后端)

| 状态 | 类型 | 用途 |
|-------|------|---------|
| `StringWrapper` | `Mutex<String>` | 窗口和后端之间的共享文本缓冲区 |
| `StoreWrapper` | `Mutex<Store>` | 配置 store 句柄 |
| `APP` | `OnceCell<AppHandle>` | 全局 Tauri 应用句柄 |
| `TRANSLATE_READY` | `Mutex<bool>` | 翻译前端是否已加载 |
| `TRANSLATE_SHOW_PENDING` | `Mutex<bool>` | 是否在等待就绪后显示 |
| `LAST_SELECTION_TOGGLE` | `Mutex<Option<Instant>>` | 防抖时间戳 |
| `LAST_INPUT_TOGGLE` | `Mutex<Option<Instant>>` | 防抖时间戳 |
| `EDGE_VOICE_ID_CACHE` | `OnceLock<RwLock<HashMap>>` | TTS 语音 ID 缓存 |
| `VOICE_CONNECTION_CACHE` | `Mutex<HashMap>` | TTS 连接池 |
| `CURRENT_SINK` | `Mutex<Option<(Sink, String)>>` | 当前音频播放 |

---

*规格说明结束。*
