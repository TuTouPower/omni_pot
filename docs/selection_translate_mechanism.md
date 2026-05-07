# 划词翻译机制分析

## 触发流程

```
用户在任意应用选中文字
        │
        ▼
用户按下全局快捷键（或发送 HTTP 请求）
        │
        ▼
hotkey.rs: GlobalShortcutManager 触发 selection_translate_toggle
        │
        ▼
window.rs: selection_translate_toggle() — 防抖 (120ms) + 切换检查
        │
        ▼ (窗口未显示时)
window.rs: translate_window() — 创建/显示翻译窗口
        │
        ▼ (在新线程中)
selection crate: get_text() — 按平台提取选中文本
        │
        ▼
window.rs: 将文本存入 StringWrapper 状态，emit "new_text" 事件
        │
        ▼
前端 Translate/index.jsx: 加载完成后 emit "translate_ready"
        │
        ▼
前端 SourceArea/index.jsx: 监听 "new_text"，接收文本，开始翻译
```

## 触发入口

| 入口 | 文件 | 说明 |
|------|------|------|
| 全局快捷键 | `hotkey.rs` | 用户按配置的热键触发 |
| HTTP GET `/selection_translate` | `server.rs` | 外部工具/脚本调用 |
| HTTP POST `/` 或 `/translate` | `server.rs` | 直接传入文本翻译 |
| 剪贴板监听 | `clipboard.rs` | 每 500ms 轮询剪贴板变化（独立功能） |

## 文本提取方案（按平台）

核心实现在 `selection` crate（v1.2.0，作者 Pylogmon），声明于 `src-tauri/Cargo.toml`。

### Linux / X11

- **方案**：直接读取 X11 PRIMARY selection
- **实现**：`x11-clipboard` crate，读取 `clipboard.getter.atoms.primary`
- **关键点**：X11 下选中文字会自动写入 PRIMARY buffer，无需 Ctrl+C
- **不依赖**：xdotool、xclip、xsel 等外部命令

### Linux / Wayland

- **主方案**：`wl-clipboard-rs` crate 读取 `ClipboardType::Primary`
- **回退**：设置 `XDG_SESSION_TYPE=x11` + `GDK_BACKEND=x11` 回退到 X11 兼容层

### Windows

- **主方案**：UI Automation API（`IUIAutomation` COM 接口）
    - 获取焦点元素 → 查询 `TextPattern` → 读取选中范围
    - 完全不碰剪贴板，用户无感知
    - 适用于 Edge、Chrome、UWP 等应用
- **回退方案**：模拟 Ctrl+C + 读剪贴板
    - 用 `enigo` crate 发送按键
    - 提前保存原剪贴板内容（文本或图片），操作后恢复

### macOS

- **主方案**：Accessibility API
    - 通过 `accessibility-ng` crate 查询 `kAXSelectedTextAttribute`
    - 不碰剪贴板
- **回退方案**：AppleScript 模拟 Cmd+C
    - 保存原剪贴板 → 模拟复制 → 读取 → 恢复
    - 静音系统提示音避免干扰

## 方案对比

| 方案 | 原理 | 优劣 | 本项目是否使用 |
|------|------|------|----------------|
| X11 PRIMARY selection | 选中即自动填入 | 仅 X11 有效，Wayland 支持不完整 | 是（Linux 主方案） |
| Accessibility API | 系统无障碍接口读取选中文字 | 不碰剪贴板，但不是所有 app 都支持 | 是（Windows/macOS 主方案） |
| 模拟 Ctrl+C + 读剪贴板 | 模拟键盘事件复制 | 干扰用户剪贴板，体验差 | 仅作 fallback |
| DBus / AT-SPI | Linux 无障碍总线 | 可靠但实现复杂 | 否 |
| Input Method 协议 | IBus/Fcitx 层面拦截 | 权限高，但耦合输入法 | 否 |
| 屏幕 OCR | 截图识别文字 | 不依赖选中，但精度和速度差 | 否（另有截图翻译功能） |
| X11 XFIXES 选区监听 | 监听选区变化事件 | 可做"选中即翻译"，但仅 X11 | 否 |

## 窗口显示机制

翻译窗口使用 ready/pending 状态机，避免显示未渲染的空白窗口：

1. `translate_window()` 创建窗口时设置 `TRANSLATE_READY = false`
2. 前端加载完成后 emit `translate_ready` 事件
3. 收到事件后设置 `TRANSLATE_READY = true`，如果 `TRANSLATE_SHOW_PENDING` 为 true 则立即显示窗口
4. 后续 emit `new_text` 事件传递待翻译文本

相关文件：
- Rust 侧：`src-tauri/src/window.rs`
- 前端侧：`src/window/Translate/index.jsx`、`src/window/Translate/components/SourceArea/index.jsx`
