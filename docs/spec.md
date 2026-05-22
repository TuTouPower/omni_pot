# omni_pot — 产品规格说明

> 版本: 1.0 | 更新日期: 2026-05-20
> 用途: omni_pot 桌面翻译/OCR/词典工具的权威功能规格。

本文档整合了以下来源，并作为产品实现的权威目标：

- `docs/design/omni-pot/` — UI 设计稿（HTML/JSX/CSS 原型，最高优先级）
- `TASKS.md` — 当前实机验收发现的问题、待办与测试覆盖缺口（合并自原 PLAN/review/issues）
- `docs/archive/old_pot/spec.md` — Pot Desktop 3.0.7 原始产品规格（功能蓝本）
- `docs/superpowers/specs/2026-05-06-pot-desktop-rewrite-design.md` — 重写技术方案
- `docs/superpowers/specs/2026-05-08-selection-text-extraction-design.md` — 跨平台选中文本提取设计

相关文档：

- `docs/design/demo_todo.md` — omni_pot 设计稿与 spec 的已知偏差
- `docs/test.md` — 测试规范与总则
- `docs/test_user_e2e.md` — 用户端到端测试设计

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [多窗口架构](#3-多窗口架构)
4. [设计系统](#4-设计系统)
5. [窗口: 翻译](#5-窗口-翻译)
6. [窗口: 词典](#6-窗口-词典)
7. [窗口: 截图](#7-窗口-截图)
8. [窗口: 识别 (OCR)](#8-窗口-识别-ocr)
9. [窗口: 设置](#9-窗口-设置)
10. [窗口: 更新器](#10-窗口-更新器)
11. [守护进程窗口](#11-守护进程窗口)
12. [服务系统](#12-服务系统)
13. [翻译服务清单](#13-翻译服务清单)
14. [OCR 服务清单](#14-ocr-服务清单)
15. [TTS 服务](#15-tts-服务)
16. [收藏服务](#16-收藏服务)
17. [语言检测](#17-语言检测)
18. [配置系统](#18-配置系统)
19. [IPC 通道](#19-ipc-通道)
20. [HTTP API 服务器](#20-http-api-服务器)
21. [系统托盘](#21-系统托盘)
22. [全局快捷键](#22-全局快捷键)
23. [剪贴板监听](#23-剪贴板监听)
24. [跨平台选中文本提取](#24-跨平台选中文本提取)
25. [翻译历史记录](#25-翻译历史记录)
26. [备份与恢复](#26-备份与恢复)
27. [自动更新](#27-自动更新)
28. [国际化](#28-国际化)
29. [平台特定行为](#29-平台特定行为)
30. [测试策略](#30-测试策略)
31. [状态细节](#31-状态细节)
32. [UI 验收标准](#32-ui-验收标准)
33. [分阶段交付计划](#33-分阶段交付计划)

---

## 1. 项目概述

omni_pot 是一款跨平台桌面翻译 / OCR / 词典工具，基于现代技术栈完整重写
[pot-app/pot-desktop](https://github.com/pot-app/pot-desktop)。原版使用 Tauri 1.x +
React 18 + NextUI，技术老旧；本项目从零实现 spec 中定义的全部功能。

### 核心能力（4 个用户面向功能）

- **翻译** — 有选中文本时翻译选中文本，否则弹出空输入窗口；剪贴板监听开启时自动翻译剪贴板新文本
- **词典** — 选中字词查询词典（英文走英文词典、中文走中文词典）
- **文字识别** — 区域截图 → 文字识别
- **截图翻译** — 截图 → 识别 → 自动翻译

附加能力：

- **多服务并行** — 一次翻译同时调用多个引擎，结果卡片并列展示
- **HTTP API** — 本地 HTTP 服务器供外部脚本调用

> 中文 UI 内**不出现 "OCR" 三个字母**，统一使用"文字识别 / 截图翻译"。

### 设计原则

- 多窗口架构：每个功能是独立的 BrowserWindow
- 插件式服务接口：翻译 / OCR / TTS / 收藏服务遵循统一接口
- 服务实例系统：同一服务可创建多个配置不同的实例
- 卡片式 UI：纯白外层 + 浅色调内卡，圆角，克制配色（5 主色克制使用）

### 命名规则

| 名称类型 | 形式 | 适用范围 |
|---|---|---|
| 面向用户的显示名（wordmark） | `Omni Pot`（首字母大写、含空格） | 窗口标题栏、托盘、关于页、用户文档、README 标题 |
| 项目代码命名 | `omni_pot`（snake_case 全小写） | package.json `name`、文件夹/文件名、变量名、CSS 类名、配置键、IPC 通道名、命名空间 |

代码中不允许散落 `Omni Pot` 字面量与 `omni_pot` 字面量混用；显示名通过常量或 i18n key 集中管理。

---

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 35+ |
| 前端 | React 19 + TypeScript |
| 构建 | electron-vite + electron-builder |
| 样式 | Tailwind CSS + 自定义 design tokens（CSS 变量） |
| 状态管理 | Zustand |
| 配置存储 | 自实现 JSON 文件读写；变更通过 IPC `config:changed` 主进程广播给所有 renderer |
| 数据库 | better-sqlite3（翻译历史、CC-CEDICT 词典；native 模块由 `electron-builder install-app-deps` rebuild，打包时仅将 `*.node` 解包） |
| IPC | Electron contextBridge + ipcMain / ipcRenderer |
| HTTP 服务器 | Node.js `http` 模块 |
| FFI | koffi（跨平台选中文本提取，调用系统动态库） |
| OCR | tesseract.js（renderer 端，本地 worker/core + 语言包下载）+ 系统 OCR（main 进程） |
| 测试 | Vitest（unit + integration）+ Playwright（e2e） |
| i18n | react-i18next |
| 拖拽 | `@dnd-kit/*`（服务排序） |

---

## 3. 多窗口架构

忠实复刻原版的多窗口架构。每个功能是独立的 `BrowserWindow`，由 `WindowManager` 统一管理。

### 3.1 窗口定义

```typescript
// electron/windows/types.ts
enum WindowLabel {
  DAEMON = 'daemon',
  TRANSLATE = 'translate',
  SCREENSHOT = 'screenshot',
  RECOGNIZE = 'recognize',
  DICT = 'dict',
  CONFIG = 'config',
  UPDATER = 'updater',
}
```

### 3.2 窗口配置

| 窗口 | Label | 默认尺寸 | 最小尺寸 | 特殊行为 |
|---|---|---|---|---|
| 守护进程 | `daemon` | 0×0（隐藏） | — | 后台 worker，不显示 |
| 翻译 | `translate` | 宽度记忆值或默认宽度；高度自适应内容 | 语言转换区自然宽度 + 少量留白 / 内容自然最小高度 | 未固定时失焦自动关闭、可固定、可置顶、frameless；宽度只能由用户调整并按配置记住，不允许内容、欢迎页或程序自动拉宽；高度随内容自适应 |
| 截图 | `screenshot` | 全屏 | — | 启动时隐藏预加载，触发后始终置顶显示，截图后自动关闭 |
| 识别 / 截图翻译 | `recognize` | 800×400 | — | 未固定时失焦自动关闭；文字识别与截图翻译共用同一个截图翻译窗口布局 |
| 词典 | `dict` | 400×500（快捷键）/ 350×420（HTTP） | — | 未固定时失焦自动关闭、可置顶 |
| 设置 | `config` | 720×740 | — | — |
| 更新器 | `updater` | 600×400 | — | — |

> 所有窗口均为 frameless（`frame: false`），使用自绘标题栏。

### 3.3 窗口管理器核心行为

`electron/windows/manager.ts` 的 `WindowManager`：

- **窗口复用**：同 label 已存在且未销毁 → `focus()` 而非重建
- **鼠标显示器检测**：新窗口在鼠标光标所在显示器的工作区居中创建
- **label 映射**：自维护 `Map<label, BrowserWindow>` 和 `Map<windowId, label>`
- **就绪守卫**：renderer 加载完成后发 `renderer:ready` 事件；`sendWhenReady()`
  在 renderer 未就绪时把消息排队，就绪后 flush，防止向空白窗口发送消息丢失
- **应用常驻**：`window-all-closed` 不退出应用；仅通过托盘菜单 Quit 退出

### 3.4 启动流程

`electron/main.ts`：

1. 单实例锁（E2E 模式下跳过）
2. 移除原生应用菜单
3. 初始化配置 store，检测首次运行
4. 创建 `WindowManager`，并预加载隐藏的截图窗口以降低截图 OCR 唤起延迟
5. 注册全部 IPC handlers（config / window / hotkey / text / ocr / history / backup / dict）
6. 创建系统托盘
7. 从配置注册全局快捷键
8. 启动 HTTP 服务器（端口占用时重试 5 次）
9. 如 `clipboard_monitor=true` 启动剪贴板监听
10. 创建 daemon 窗口（隐藏）
11. 创建翻译窗口
12. 首次运行时创建设置窗口
13. 检查更新
14. CC-CEDICT 词典数据库按需自动导入

CSP 保持默认同源限制，但 `connect-src` 允许 `https:` 外部连接与本机 HTTP 端点，以支持翻译、OCR、TTS、Ollama、DeepLX、Anki 等服务 API；`media-src` 允许 `blob:`，以支持本地合成音频播放；`worker-src` 允许 `blob:`，且 `script-src` 允许 WebAssembly 执行，以支持 Tesseract.js OCR worker/core。

---

## 4. 设计系统

### 4.1 整体风格

- **卡片式布局**：纯白窗口外层背景，浅色调内卡（接近外层颜色，略带色调）
- **圆角**：主卡片、主要按钮统一圆角 10px（固定值，不再暴露为用户可调项）；pill、圆形图标按钮、颜色圆点等小元素可保持 pill / 圆形语义
- **布局密度**：固定为"舒适"档（不再暴露为用户可调项）
- **Frameless 窗口**：跨平台无原生装饰，自绘标题栏

### 4.2 主题与主色

- **两种主题**：日间 / 夜间
- **五种主色**：
    - 陶土橙 `#c4623a`
    - 群青 `#3a6ea5`
    - 松绿 `#5c8a4f`
    - 芥末 `#b8902f`
    - 天蓝 `#5a9bbf`（默认）
- 主题与主色独立选择，共 2 × 5 = 10 种组合
- 主色**克制使用**，仅用于少数关键位置：置顶按钮（激活态）、检测到的语言名、翻译符号、其他需强调的关键状态

### 4.3 通用顶部栏

翻译窗口的顶部栏从左到右：**置顶按钮、固定按钮**、显示名 `Omni Pot`、当前模式标签（如 `翻译`）。

除设置窗口外，所有窗口顶部栏均有置顶按钮和固定按钮，从左到右：**置顶按钮、固定按钮**、显示名 `Omni Pot`、当前模式标签。

设置窗口与更新器窗口**不显示**置顶 / 固定按钮，右上角使用普通的最小化 / 最大化 / 关闭三件套。

以上整体左对齐；其余窗口（翻译 / 词典 / 文字识别 / 截图翻译）右上角只保留关闭按钮。

按钮视觉规则：未激活时只显示主色描边图标，无背景框；激活时填充主色，内部线条反色（白色或深色按主题反转）。所有非设置窗口的置顶按钮激活时自动联动开启固定。

翻译、词典、文字识别、截图翻译窗口的置顶状态各自独立，任何一个窗口切换置顶都不得污染其他窗口的置顶配置或运行时状态。

### 4.4 图标按钮

各类图标按钮的视觉大小应接近汉字大小，不能明显偏小。

---

## 5. 窗口: 翻译

**文件**: `src/windows/translate/index.tsx`

主翻译弹出窗口。只保留**一个默认翻译模式**（删除原版的"列表式"模式）。
由顶部栏 + 三个卡片式区域垂直组成。

### 5.0 翻译窗口尺寸规则

- **宽度下限**：以语言转换区的自然宽度为准，即中文 UI 下完整展示“自动检测 + 转换符号 + 简体中文”后再加少量左右留白
- 用户不能把翻译窗口缩到低于该宽度下限
- **宽度无上限要求**，但宽度只能由用户手动调整；程序、输入内容、翻译结果、欢迎页或内部自适应逻辑都不得自动拉宽窗口
- 开启窗口尺寸记忆时，只记住用户调整后的宽度和高度
- **高度需要自适应内容**；源文本、结果卡、欢迎页等内容变化可以驱动窗口高度变化，但不能影响窗口宽度
- 源文本超过 8 行时由输入框内部滚动消化；其他内容的自适应高度不能突破宽度规则

### 5.1 顶部栏

通用左对齐顶部栏（见 [4.3](#43-通用顶部栏)），模式标签为 `翻译`。

- **置顶按钮**：切换 `translate_always_on_top`，激活时图标填充主色；开启置顶会自动开启固定
- **固定按钮**：切换 `translate_pinned`，固定后失焦不自动关闭，但不改变系统置顶状态
- **关闭按钮**：关闭窗口

### 5.2 SourceArea — 源文本区域

**文件**: `src/windows/translate/source_area.tsx`

- 用小卡片样式框起来
- 输入文本框从 1 行起随内容自动增长，单行高度随用户字号计算，最多展示约 8 行
- 文本超过 8 行时只允许输入框内部滚动，旁边有滚动条
- 源文本换行或长文本只能影响输入框高度和内部滚动，不得撑宽翻译窗口
- 区域内的操作按钮**永久可见**，不被文本遮挡
- 检测到的语言标签：中文 UI 下显示"检测为 **English**"（空格 + 语言名为主色），语言名使用该语言自身文字（如"检测为 **English**"、"检测为 **简体中文**"），不显示"检测为 EN"
- 操作按钮：去除换行、去除空格、朗读、复制原文、清空
- 去除换行与去除空格的图标必须使用设计稿中的符号；实现前先对照 `docs/design/omni-pot/`，不得自造图标
- **翻译按钮**：只保留一个翻译符号（主色），不显示"翻译"文字，无独立突兀背景，融入卡片

**新文本处理**：

- 传入文本去除首尾空白
- `translate_delete_newline=true` 时用 `/-\s+/g → ''` 和 `/\s+/g → ' '` 规范化
- `incremental_translate=true` 时新文本以空格追加到现有源文本，否则替换
- `hide_source=true` 在划词 / API / 剪贴板翻译时隐藏 SourceArea；输入翻译时强制显示

**键盘快捷键**：

- `Enter` — 触发翻译
- `Shift+Enter` — 插入换行
- `Escape` — 关闭窗口
- IME 组合输入（`isComposing`）时跳过快捷键

### 5.3 LanguageArea — 语言转换区域

**文件**: `src/windows/translate/language_area.tsx`

- 用小卡片样式框起来
- 只展示三个元素，整体**居中**：源语言 → 转换符号 → 目标语言
- 语言显示使用中文可读文本：源语言显示"自动检测"（不显示 "auto"），
  目标语言显示"简体中文"（不显示前缀 "ZH"）
- 中间的转换符号需放大（接近正文字号）
- 点击语言可切换；转换符号可交换源↔目标语言

### 5.4 TargetArea — 翻译结果区域

**文件**: `src/windows/translate/target_area.tsx`

每个已启用的翻译服务实例渲染一张结果卡片，卡片可拖拽排序。

**卡片头部**：

- 服务图标 + 服务名
- 不显示 `stream` / 流式标签；流式能力属于实现细节，不暴露给用户
- 等待翻译结果时，结果卡片保持折叠状态，只露出卡片头部和轻量翻译中动效，避免静态空白或单纯文字占位
- 翻译结果返回后，结果卡片自动展开，窗口高度随展开后的结果内容自动变大
- 操作按钮**集中在卡片右上角同一行**，顺序为：朗读、复制、收藏、折叠
- 折叠符号需放大到接近汉字大小；用户手动折叠/展开后应保持当前交互状态，直到下一次新的翻译请求重置为等待态

**卡片主体**（可折叠）：

- **字符串结果**：正文文本不设最大高度限制，结果卡高度随译文内容自然增长
- 翻译结果可以驱动翻译窗口高度自适应，但不得撑宽翻译窗口
- **词典结果**（`DictResult`）：发音、释义（词性 + 释义）、例句
- **错误状态**：红色错误文本 + 重试按钮（仅出错后显示）

**翻译执行细节**：

- 源语言为 `auto` 时调用语言检测；中文长句（例如重复“我爱你”的文本）必须识别为简体中文，不得误判为日语；检测结果与目标语言相同时回退到 `translate_second_language`
- 多服务 `Promise.allSettled` 并行翻译
- 流式服务（OpenAI / Ollama / Gemini 等）通过 `translateStream` AsyncGenerator 增量更新卡片（节流 50ms）
- `requestId` 机制：旧请求 ID 的结果被忽略，防止旧异步结果覆盖新输出
- 翻译成功后写入历史记录，除非 `history_disable=true`；历史按**实例 key** 存储 `service_key`
- 重试：单卡片重试只重新调用该服务实例

**自动复制行为**（`translate_auto_copy`）：

- `true` — 复制成功的目标译文（多个以换行拼接）
- `false` — 不复制

### 5.5 欢迎空状态

- 源文本为空且本会话未跳过欢迎页时显示欢迎内容
- 欢迎内容宽度必须适配当前翻译窗口宽度，不得为了欢迎页内容拉宽窗口
- 欢迎页高度按实际内容刚好自适应，不预留大块空白
- 欢迎页中的快捷键提示按当前配置展示；未设置时显示未设置占位
- 快捷键提示必须按平台展示修饰键：Windows / Linux 显示 `Control`，macOS 显示 `Command`；不得把 `CommandOrControl` 原样展示给用户
- 点击“跳过”后直接关闭当前欢迎/翻译窗口，本会话内不再打开或保留空翻译窗口

---

## 6. 窗口: 词典

**文件**: `src/windows/dict/index.tsx`

词典窗口。选中文本后按词典快捷键弹出，按输入文字语言路由到对应词典列表，每个词典服务返回 `DictResult` 时渲染一张独立卡片：

- **英文输入** → 调用英文词典列表（默认 `cambridge_dict` + `ecdict`，`free_dictionary` 默认关闭）
- **中文输入** → 调用中文词典列表（默认 `chinese_dictionary` + `ecdict`）
- `free_dictionary` 在英文词典中默认关闭，用户可手动启用

### 6.1 顶部栏

通用左对齐顶部栏（见 [4.3](#43-通用顶部栏)），模式标签为 `词典`。有置顶按钮和固定按钮（除设置窗口外所有窗口均有）。

### 6.2 内容

- 每个词典服务返回 `DictResult`（`type='dict'`）时渲染一张卡片，卡片内分三段：**释义**（按 `partOfSpeech` 分组的编号义项）、**例句**（左侧细线 + 源/译双行）
- 卡片式布局，窗口高度自适应内容，不预留多余空白
- 每个词卡右上角放置**收藏按钮**，支持收藏单个词汇
- **不再渲染"词形变化"卡片**，也**不再渲染"来源" chips**

**顶部源词卡片**：

窗口顶部是一张源词卡片（`padding: 0`），分两个区域：

1. **查询词区域**（上方）：`contentEditable` div（`data-testid="dict-word"`），font-size 18，font-weight 600。用户可直接编辑文字，按 Enter 触发重新查询。
2. **操作栏**（下方）：
   - 左侧：语言检测标签（`data-testid="dict-detected-lang"`），显示 "检测为 {语言名}"，语言名使用品牌色。
   - 右侧四个 icon 按钮（从左到右）：朗读（Volume）、复制单词（Copy）、收藏（Heart，对第一个有结果的服务执行）、查询（Type，品牌色）。

源词卡片下方紧接一张**发音 + 词性卡片**，展示第一个有结果的服务的 `pronunciations` 和 POS 标签（chip 样式）。无发音/词性数据时不渲染。

### 6.3 数据流

```
按字典快捷键
  → electron/hotkey/index.ts: triggerSelectionDictionary()
    → readSelectedText()
    → focusOrCreate(DICT)
    → sendWhenReady('dict:lookup', text)
      → src/windows/dict/index.tsx: handleLookup()
        → 按输入语言选择中文或英文词典列表，并行查询
```

中文词典查询：

```
renderer: chinese_dictionary.translate(word)
  → window.electronAPI.chineseDict.lookup(word)
    → IPC → electron/ipc/chinese_dict_handlers.ts
      → 单字 → characters 表查询
      → 词语/成语 → words → idioms 表查询
      → FTS5 前缀搜索兜底
      → better-sqlite3 查询 chinese_dict.db → DictResult | null
```

数据源：mapull/chinese-dictionary JSON → `scripts/build_chinese_dict.ts` 构建 SQLite（320K 词、16K 字、50K 成语）。
配置项 `dict_chinese_enabled`（默认 `true`）可运行时禁用。

CC-CEDICT 离线词典查询：

```
renderer: ecdict.translate()
  → window.electronAPI.dict.lookup(text, from, to)
    → IPC → electron/dict/index.ts: lookup_chinese() / lookup_english()
      → better-sqlite3 查询 cc_cedict.db → DictResult | null
```

CC-CEDICT 首次启动：`electron/main.ts` 调用 `auto_import_if_needed()`，
检查数据库无数据 → 读取 `data/dict/cedict.txt.gz` → 解压解析 → 批量 INSERT → 重建 FTS5 索引。

---

## 7. 窗口: 截图

**文件**: `src/windows/screenshot/index.tsx`

用于截图捕获和区域选择的全屏覆盖层。

### 行为

1. 窗口全屏打开，始终置顶
2. 主进程启动时预加载隐藏截图窗口；触发截图时先显示覆盖层，再异步捕获屏幕并发送背景图
3. 主进程通过 `desktopCapturer` 捕获屏幕，渲染为全屏背景
4. **鼠标拖拽**创建选择矩形（主色描边 + 半透明遮罩，四角句柄，尺寸标签）
5. **Enter / 鼠标释放**：裁剪选区，返回 base64 图片，关闭窗口
6. **Esc / 右键**：取消，关闭窗口不执行操作
7. 顶部提示条：拖动选取区域 · Enter 确认 · Esc 取消
8. 主色仅用于选区描边与尺寸标签

### 平台差异

| 平台 | 截图方式 |
|---|---|
| Windows / Linux | Electron 全屏覆盖窗口 + 区域选择 |
| macOS | 可用系统 `screencapture -i -r` |

---

## 8. 窗口: 文字识别 / 截图翻译

**文件**: `src/windows/recognize/index.tsx`

文字识别入口与截图翻译入口共用同一个截图翻译窗口体系：用户在文字识别窗口点击“翻译”后，也进入同一个“截图翻译窗口”，不要拆成两个不同窗口概念。中文 UI 中窗口模式标签为 `文字识别` / `截图翻译`，不出现 "OCR" 三个字母。

### 8.1 第一排 — 顶部栏

通用左对齐顶部栏，模式标签分别为 `文字识别` / `截图翻译`。中文 UI 不出现 "OCR" 三个字母。

### 8.2 第二排 — 左图右文

- **左边**：一个大的截图原图卡片
- **右边**：纵向排列两个小卡片
  - 上方：文字识别内容卡片（可编辑、可滚动）
  - 下方：文字翻译内容卡片
- 截图翻译窗口必须按设计稿实现左侧大原图卡片 + 右侧两个纵向小卡片；具体间距、比例、标签和状态细节以 `docs/design/omni-pot/` 为准，修复前先对照 demo

### 8.3 第三排 — 操作区

所有图标按钮大小接近汉字；语言下拉用与翻译窗口一致的 pill 样式（带背景与边框，**不带 AUTO/ZH 等字母前缀，也不在语言项前添加网络图标**）。

**文字识别模式按钮顺序：**

左侧：`复制图片 → 选择识别引擎（系统 OCR 等）→ 自动检测`

右侧：`翻译 → 去除换行 → 去除空格 → 复制识别文本 → 导出`

**截图翻译模式按钮顺序：**

左侧：`复制图片 → 选择识别引擎 → 自动检测 → 转换符号 → 简体中文`

右侧：`去除换行 → 去除空格 → 复制识别文本 → 导出`

按钮说明：

- **重新识别 / 重新翻译**：不在底栏显示独立按钮；识别语言或目标语言变化时按 §8.5 自动触发对应流程
- **导出**：导出符号（非云符号），支持 md / txt / docx / doc
- **翻译**（仅文字识别模式）：翻译符号按钮（主色），调用 `ocr:send-to-translate` 切到截图翻译模式

### 8.4 信息精简

去掉以下弱价值信息：图片尺寸、图片类型、识别字数、识别耗时。复制图片按钮保留在底栏左起第一位。

### 8.5 OCR 执行细节

- 旧请求 ID 的 OCR 结果被忽略
- `recognize_delete_newline=true` 时最终文本用 `/-\s+/g → ''` 和 `/\s+/g → ' '` 规范化
- `recognize_auto_copy=true` 时最终 OCR 文本复制到剪贴板
- 可切换 OCR 服务；文字识别窗口中切换识别语言后必须自动重新识别，不要求用户再手动点击重新识别
- 截图翻译窗口中切换识别语言或翻译目标语言后必须自动重新执行对应流程：识别语言变化触发重新识别并刷新翻译，翻译目标语言变化触发重新翻译

---

## 9. 窗口: 设置

**文件**: `src/windows/config/index.tsx`

### 9.1 布局

- **左侧边栏**：固定窄宽度，顶部显示名 `Omni Pot`，下方 8 个导航按钮，底部版本号；**不显示置顶 / 固定按钮**
- **右侧内容区**：顶部标题栏（页面名 + 最小化 / 最大化 / 关闭三件套）+ 可滚动的卡片式内容区
- 激活导航项高亮，图标为主色

### 9.2 侧边栏导航

| 页面 | 文件 |
|---|---|
| 通用 | `src/windows/config/general.tsx` |
| 翻译 | `src/windows/config/translate_settings.tsx` |
| 文字识别 | `src/windows/config/recognize_settings.tsx` |
| 快捷键 | `src/windows/config/hotkey_settings.tsx` |
| 服务 | `src/windows/config/service_settings.tsx` |
| 历史 | `src/windows/config/history_settings.tsx` |
| 备份 | `src/windows/config/backup_settings.tsx` |
| 关于 | `src/windows/config/about.tsx` |

通用组件：`src/windows/config/config_components.tsx`（Card / Row / Switch / Select 等）。

### 9.3 设置页: 通用

- **应用卡片**：开机自启（`auto_start`）、启动时检查更新（`check_update`）、本地 API 端口（`server_port`，修改后需重启）、**界面语言**（`app_language`）
- 本地 API 端口标签右侧显示一个小圆圈问号按钮，点击打开官网 API 文档；问号按钮贴近“本地 API 端口”文字，不放到输入框右侧
- **外观卡片**：主题（`app_theme`：跟随系统 / 浅色 / 深色）使用 3 按钮分段控件，不使用下拉框；文字（`app_font` / `app_fallback_font`，与字号 `app_font_size` 同行展示，左侧字体下拉、右侧字号下拉），标签叫“文字”，不叫“字体”，且不显示预览块；主色调（`app_primary_color`，5 个圆形选色按钮）、透明背景（`transparent`）、托盘点击行为（`tray_click_event`）
- 不提供代理功能，不显示代理设置卡片，不保留代理入口或代理文案

### 9.4 设置页: 翻译

- **语言卡片**：源语言、目标语言、第二语言。语言下拉项**以该语言自身文字显示**（如 `English` / `日本語` / `한국어`），不统一翻译为当前界面语言；不带 AUTO/ZH 等字母前缀；下拉以 portal 渲染到 body，避免被卡片裁切。检测引擎不在此处暴露给用户（语言检测由 cld3-asm 本地完成，见 §17）
- **行为卡片**：自动复制（开关样式，与文字识别页保持一致）、增量翻译、动态翻译、自动去除换行、禁用历史记录
- **窗口卡片**：窗口位置（鼠标位置 / 上次位置）、记住窗口大小、失焦时关闭、始终置顶、隐藏源文本、隐藏语言选择、翻译后隐藏窗口

### 9.5 设置页: 文字识别

仅四项：

- **默认识别引擎**（`recognize_engine`）：从已注册 OCR 服务实例中选择
- **默认识别语言**（`recognize_language`）：默认 `'auto'`（自动检测）
- **自动去除换行**（`recognize_delete_newline`）：开关，**默认关闭**
- **自动复制**（`recognize_auto_copy`）：开关，默认开启（UI 标签为"自动复制"，不再叫"自动复制结果"）

「默认识别引擎」「默认识别语言」两个下拉控件宽度对齐（设计稿统一 220px）。
不实现动态识别、默认导出格式、截图后动作、提示条、选区描边颜色、失焦时关闭、识别后隐藏窗口、窗口卡片、截图卡片等扩展字段。

### 9.6 设置页: 快捷键

**四个**全局快捷键录入框，每个有绑定 / 解绑按钮（未绑定显示"绑定"，已绑定显示"解绑"，**不使用 × 清除**）。页面布局、分组、文案和交互必须按 `docs/design/omni-pot/` 设计稿对齐：

- **翻译**（单一用户入口）— 描述："选中文本时翻译该文本；未选中时弹出空翻译窗口；剪贴板监听开启时自动翻译剪贴板新文本"。UI、欢迎页和托盘都不得把“划词翻译”和“输入翻译”拆成两个入口
- **词典**（`hotkey_selection_dictionary`），不叫”查询字典”
- **文字识别**（`hotkey_ocr_recognize`）
- **截图翻译**（`hotkey_ocr_translate`）

录入行为：捕获组合键、Backspace 清除、绑定按钮在主进程注册、成功 / 失败提示；已被其他应用占用时在"状态细节"区域以红色提示，**不在快捷键设置页常驻展示**。快捷键展示必须按平台把 `CommandOrControl` 解析成用户可读修饰键，并使用简洁、带空格的格式：Windows / Linux 显示 `Ctrl + Alt + T`，macOS 显示 `Cmd + Opt + T`。Wayland 限制属于故障排查或文档说明，不放快捷键页。

**按键捕获规则**：使用 `KeyboardEvent.code`（物理按键）而非 `KeyboardEvent.key`（字符）来确定非修饰键。这确保 Shift+6 存储为 `Shift+6` 而非 `Shift+^`，用户看到的始终是物理按键标识（数字、字母、符号键名）。

### 9.7 设置页: 服务

Tabs 切换**六类服务**：翻译 / 中文词典 / 英文词典 / 文字识别 / 语音朗读 / 收藏。页面整体布局、服务卡片、字段展示和交互必须按 `docs/design/omni-pot/` 设计稿对齐。

- 每类显示**服务实例**列表，支持启停、上移/下移与拖拽排序（顶部优先）
- 每个实例项：拖拽手柄、服务图标、实例名、实例 key、启停开关、编辑按钮、上移按钮、下移按钮、删除按钮（编辑 / 删除使用**带文字的完整按钮**，不是小图标）
- 不显示 `stream` 标签；流式能力为实现细节
- 底部："添加内置服务"按钮（打开内置服务选择）；**不引入插件系统**，无 .potext 安装、无插件市场
- 添加实例后写入对应 `*_service_list` 与 `service_instances`
- 删除实例后从对应 `*_service_list` 移除，并同步删除 `service_instances` 项
- 编辑实例可修改显示名与 JSON 配置；测试按钮调用服务 `testConfig()` 并显示成功/失败，保存后持久化到 `service_instances`

### 9.8 设置页: 历史

- 翻译历史工具栏一行展示（`flexWrap: nowrap`，禁止换行）：`启用`标签 + 开关、搜索框（带搜索图标）、服务筛选下拉、时间筛选下拉、清空按钮
- 搜索框宽度自适应但不过长（`flex: 1 1 120px`），其余控件不收缩（`flexShrink: 0`）
- 时间筛选选项：全部时间 / 今天 / 本周 / 本月
- `启用`开关控制是否写入新的历史记录；关闭时搜索、筛选、清空等历史操作置灰或禁用
- 翻译历史表格：服务图标、源文本、源/目标语言、译文、时间戳
- 分页浏览
- 点击行打开详情，可编辑源文本 / 译文
- 清空按钮

### 9.9 设置页: 备份

- 备份目标（`backup_type`）：WebDAV / 本地
- WebDAV：服务器地址、用户名、密码
- 操作：立即备份、从备份恢复
- 备份内容：设置、历史记录数据库、CC-CEDICT 词典数据库
- 页面布局、文案、按钮和状态展示必须按 `docs/design/omni-pot/` 设计稿对齐
- 导出的备份 zip 必须可再次导入；恢复后需要验证配置、历史记录和随包数据库数据恢复正确

### 9.10 设置页: 关于

Omni Pot logo + 版本号、简介、官网 / 文档 / 反馈 / 检查更新链接、诊断信息（日志目录 / 设置目录 / 本机 API 地址）。

诊断卡片底部添加"导出日志"按钮，说明文案："最近 7 天的日志打包为 zip，可附在反馈中"。

版本号格式带平台后缀：`version {x.y.z} · {platform-arch}`，如 `version 3.1.0 · darwin-arm64` / `version 3.1.0 · win32-x64`。

### 9.11 设置数据流

```
renderer: useConfigStore
  → 读: useConfigStore(s => s.config[key])
  → 写: config:set IPC
    → electron/config/store.ts: setConfig(key, value)
      → 写入 userData/config.json
      → 广播 config:changed 到所有窗口
        → renderer: config.onChange() → zustand store 更新
```

**即时生效要求**：所有配置变更必须即时应用到已打开窗口。对于需要重建 `BrowserWindow` 才能生效的配置项（如 `transparent`，因为 Electron 不支持运行时修改 `transparent` 属性），主进程监听 `config:changed` 事件，检测到此类配置变化时自动关闭并重建受影响的窗口。

### 9.12 日志系统

**文件**: `electron/log.ts`

基于 `electron-log` v5，所有主进程日志写入文件，打包后无需终端即可排查问题。

| 项目 | 说明 |
|---|---|
| 日志文件 | `userData/logs/main.log`（Windows: `%APPDATA%/omni_pot/logs/main.log`） |
| 轮转策略 | 单文件最大 5MB，超限自动归档为 `main.old.log` |
| 全局异常 | `uncaughtException`、`unhandledRejection`、`render-process-gone` 自动捕获 |
| Renderer 日志 | 通过 `webContents.on('console-message')` 间接写入主进程日志 |
| 关于页面 | 显示真实日志目录路径（通过 `log:getDir` IPC 获取） |
| 隐私策略 | 翻译原文/OCR 图片可记录；API key 仅记录前 4 + 后 4 字符 |

各模块通过 `log.scope('模块名')` 创建带前缀的 logger（如 `[main]`、`[wm]`、`[server]`）。

---

## 10. 窗口: 更新器

**文件**: `src/windows/updater/index.tsx`

| 元素 | 行为 |
|---|---|
| 顶部栏 | 通用左对齐顶部栏，模式标签 `更新`；**不显示置顶 / 固定按钮**，右上角只保留关闭按钮 |
| 版本信息 | `当前版本 → 最新版本 · 发布日期 · 包大小`（如 `3.0.6 → 3.1.0 · 2026-05-09 · 12.4 MB`） |
| 更新日志 | 渲染 GitHub release notes 的 Markdown |
| 下载进度 | 下载中显示已下载/总大小 + 百分比 + 进度条（主色填充） |
| 操作按钮 | `稍后提醒`（关闭窗口）、`立即更新`（触发应用内下载安装；下载中按钮禁用并显示"下载中…"） |

状态：加载中 → 更新详情 / 检查失败 / 已是最新版本 / 下载中 / 下载完成待安装。
下载流程由 `electron/updater/index.ts` 实现，使用 GitHub release assets 作为下载源；生产环境只接受 `TuTouPower/omni_pot` 的 GitHub release asset URL 及 GitHub 返回的可信下载重定向，不能信任 renderer 传入的任意下载 URL。

---

## 11. 守护进程窗口

`daemon` 窗口（0×0，隐藏，`skipTaskbar`）作为后台 worker，承载不依赖可见 UI 的后台逻辑。应用常驻于系统托盘，关闭所有可见窗口不退出应用。

---

## 12. 服务系统

### 12.1 服务接口

所有内置服务遵循插件式统一接口；当前版本不实现外部插件系统，也不加载 `.potext` 插件包。

**翻译服务**（`shared/types/service.ts`）：

```typescript
interface TranslateService {
  readonly key: string
  readonly name: string
  readonly languages: LanguageCode[]
  translate(text, from, to, config): Promise<string | DictResult>
  translateStream?(text, from, to, config): AsyncGenerator<string>
  testConfig(config): Promise<boolean>
}
```

**OCR 服务**（`shared/types/ocr_service.ts`）、**TTS 服务**（`shared/types/tts_service.ts`）、
**收藏服务**（`shared/types/collection_service.ts`）遵循类似结构。

**词典结果**：

```typescript
interface DictResult {
  type: 'dict'
  pronunciations: { region: string; phonetic: string }[]
  partsOfSpeech?: string[]            // 词头标签，如 ['v.']
  definitions: { partOfSpeech: string; meanings: string[] }[]
  examples: { source: string; target: string }[]
  inflections?: string[]               // 词形变化，如 ['reconciled', 'reconciles', ...]
}
```

> "来源"不存放在 `DictResult` 内，由 renderer 根据实际渲染的服务列表展示。

### 12.2 服务注册表

`src/services/registry.ts` 定义泛型 `ServiceRegistry<T>`：

| 注册表 | 类型 |
|---|---|
| `translateServiceRegistry` | TranslateService |
| `ocrServiceRegistry` | OcrService |
| `ttsServiceRegistry` | TtsService |
| `collectionServiceRegistry` | CollectionService |

`registerAllServices()` 在启动时注册全部内置服务。

### 12.3 服务实例系统

- 每个服务实例有唯一键：`{serviceKey}@{randomId}`（如 `openai@abc123`）
- 用户可添加同一服务的多个实例，配置各不相同
- 首次启动为部分内置服务自动建默认实例（key 形如 `bing@default`）
- `service_instances` 配置项存 `instanceKey → { serviceKey, config }` 映射
- `config.instanceName` 覆盖列表显示名；`config.enable=false` 时该实例保留在列表中但不参与翻译、词典、OCR、TTS、收藏执行
- `translate_service_list` / `dictionary_service_list` / `recognize_service_list` /
  `tts_service_list` / `collection_service_list` 储存的是**实例 key**
- `getServiceKey(instanceKey)` 提取裸 serviceKey；`createServiceInstanceKey(serviceKey)` 生成新实例 key

**默认实例**（`DEFAULT_SERVICE_INSTANCES`）：
`bing@default`、`google@default`、`deepl@default`、`mymemory@default`、`tesseract@default`、
`free_dictionary@default`、`ecdict@default`、`chinese_dictionary@default`、`cambridge_dict@default`、`system_tts@default`。

---

## 13. 翻译服务清单

`src/services/` 注册 21 个翻译服务（`registerAllServices()`，**以代码为准**）：

| # | 服务 | Key | 认证 / 说明 |
|---|---|---|---|
| 1 | 必应 | `bing` | 免费 |
| 2 | 谷歌 | `google` | 免费（token） |
| 3 | DeepL | `deepl` | Free / API / DeepLX |
| 4 | 剑桥词典 | `cambridge_dict` | 免费（抓取），纯英文数据集，输出词典结果 |
| 5 | 阿里巴巴 | `alibaba` | AccessKey |
| 6 | 百度 | `baidu` | MD5 签名 |
| 7 | 百度领域 | `baidu_field` | MD5 + field |
| 8 | 彩云小译 | `caiyun` | Token |
| 9 | 牛翻译 | `niutrans` | API Key |
| 10 | 有道 | `youdao` | MD5 签名 |
| 11 | 火山引擎 | `volcengine` | AppID + Secret |
| 12 | TranSmart | `transmart` | Username + Token |
| 13 | 腾讯 | `tencent` | TC3-HMAC-SHA256 |
| 14 | OpenAI | `openai` | API Key，流式 |
| 15 | ChatGLM | `chatglm` | API Key，流式 |
| 16 | Gemini Pro | `geminipro` | API Key，流式 |
| 17 | Ollama | `ollama` | 本地，流式 |
| 18 | MyMemory | `mymemory` | 免费 |
| 19 | 中文词典 | `chinese_dictionary` | 离线（mapull SQLite，320K 词/16K 字/50K 成语），输出词典结果 |
| 20 | Free Dictionary | `free_dictionary` | 免费（dictionaryapi.dev），英文词典，输出词典结果 |
| 21 | ECDict | `ecdict` | 离线（CC-CEDICT SQLite），输出中英词典结果 |

> 与原 Pot Desktop 3.0.7 的差异：本项目用 `mymemory`、`free_dictionary` 替代了原版的
> `yandex`、`bing_dict`。

---

## 14. OCR 服务清单

`src/services/ocr/` 注册 16 个 OCR 服务（`registerAllOcrServices()`，**以代码为准**）：

| # | 服务 | Key | 说明 |
|---|---|---|---|
| 1 | Tesseract | `tesseract` | tesseract.js 客户端 OCR，本地加载 worker/core，按语言下载 traineddata |
| 2 | 百度 OCR | `baidu_ocr` | client_id + client_secret |
| 3 | 百度高精度 | `baidu_accurate_ocr` | client_id + client_secret |
| 4 | 百度图片 | `baidu_img_ocr` | appid + secret |
| 5 | 腾讯 OCR | `tencent_ocr` | secret_id + secret_key |
| 6 | 腾讯高精度 | `tencent_accurate_ocr` | secret_id + secret_key |
| 7 | 腾讯图片 | `tencent_img_ocr` | secret_id + secret_key |
| 8 | 火山引擎 OCR | `volcengine_ocr` | appid + secret |
| 9 | 火山多语言 OCR | `volcengine_multi_lang_ocr` | appid + secret |
| 10 | AI 视觉 OCR | `openai_vision` | OpenAI 兼容视觉 LLM，流式 |
| 11 | 讯飞 OCR | `iflytek_ocr` | appid + apisecret + apikey |
| 12 | 讯飞 IntSig | `iflytek_intsig_ocr` | 同讯飞 |
| 13 | 讯飞 LaTeX | `iflytek_latex_ocr` | 数学公式 → LaTeX |
| 14 | Simple LaTeX | `simple_latex_ocr` | SimpleTex API，公式 → LaTeX |
| 15 | 二维码 | `qrcode` | 二维码识别 |
| 16 | 系统 OCR | `system` | Windows WinRT / macOS 原生 / Linux tesseract CLI |

---

## 15. TTS 服务

`src/services/tts/` 注册 1 个 TTS 服务：

| 服务 | Key | 说明 |
|---|---|---|
| System TTS | `system_tts` | 调用渲染进程的 Web Speech API → Windows SAPI / macOS NSSpeechSynthesizer / Linux espeak。完全离线、零密钥、零配置 |

行为：点击播放，相同文本再次点击停止，不同文本替换。

### 15.1 音量

Web Speech API `SpeechSynthesisUtterance.volume` 范围 0–1，默认 1（最大）。该 API 不暴露音频流，无法通过 AudioContext GainNode 放大超过系统音量。

**已知限制**：System TTS 音量受限于操作系统语音合成输出音量，应用层无法放大。用户如需更大音量，应调整系统 TTS 音量设置（Windows: 设置 → 时间和语言 → 语音）。

**后续方案**：如需应用层音量控制，可集成 Edge TTS 服务（返回音频 buffer，可通过 AudioContext 放大），作为 P4 服务扩展的一部分。

---

## 16. 收藏服务

`src/services/collection/` 注册 2 个收藏服务：

| 服务 | Key | 说明 |
|---|---|---|
| Anki | `anki` | 通过 AnkiConnect 发送词组到 Anki |
| 欧路词典 | `eudic` | 发送词组到欧路词典 |

---

## 17. 语言检测

**文件**: `src/services/detect.ts`

源语言为 `auto` 时调用语言检测，决定实际源语言。检测引擎不暴露在设置页 UI，由项目固定为 cld3-asm 本地检测。

- 主路径：主进程 `electron/detect/index.ts` 预加载 cld3-asm WASM，renderer 通过 `detect.local` IPC 调用本地检测。
- 兜底路径：WASM 加载失败、检测不可靠、未映射语言或 IPC 不可用时回退到 Unicode 正则。
- 中文长句（例如重复“我爱你”的文本）必须识别为简体中文，不得误判为日语。

检测结果与目标语言相同时，实际目标回退到 `translate_second_language`。

---

## 18. 配置系统

### 18.1 存储

- **位置**：Electron `userData` 目录下的 `config.json`
- **机制**：`electron/config/store.ts` 自实现 JSON 读写
- **前端访问**：`src/stores/config_store.ts`（Zustand）+ `config:get/set/getAll` IPC
- **变更广播**：`setConfig()` 写文件后通过 `config:changed` 广播到所有 renderer
- **首次运行**：空 config 触发自动打开设置窗口

### 18.2 完整配置键参考

定义于 `shared/types/config.ts` 的 `AppConfig`。`DEFAULT_CONFIG` 为默认值。

#### 应用设置

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `app_language` | string | `'en'` | UI 语言 |
| `app_theme` | `'system'\|'light'\|'dark'` | `'system'` | 主题 |
| `app_primary_color` | string | `'#5a9bbf'` | 主色调，可选 5 种（见 §4.2） |
| `app_font` | string | `'default'` | 主字体族 |
| `app_fallback_font` | string | `'default'` | 回退字体族 |
| `app_font_size` | number | `16` | 基础字号 px |
| `transparent` | boolean | `false` | 窗口透明 |
| `check_update` | boolean | `true` | 启动时检查更新 |
| `server_port` | number | `20202` | HTTP API 端口，修改后需重启 |
| `clipboard_monitor` | boolean | `true` | 剪贴板监听 |
| `auto_start` | boolean | `false` | 开机自启 |
| `tray_click_event` | `'show_config'\|'show_translate'\|'none'` | `'show_config'` | 托盘左键点击行为 |
| `dict_chinese_enabled` | boolean | `true` | 中文字典（SQLite）开关，关闭后走在线词典 |

#### 翻译设置

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `translate_source_language` | string | `'auto'` | 默认源语言 |
| `translate_target_language` | string | `'zh_cn'` | 默认目标语言 |
| `translate_second_language` | string | `'en'` | 回退目标语言 |
| `translate_auto_copy` | boolean | `false` | 自动复制（开关；开 = 复制译文，关 = 不复制） |
| `incremental_translate` | boolean | `false` | 增量翻译 |
| `history_disable` | boolean | `false` | 禁用历史记录 |
| `dynamic_translate` | boolean | `false` | 输入时自动翻译（1s 防抖） |
| `translate_delete_newline` | boolean | `false` | 去除源文本换行 |
| `translate_window_position` | `'mouse'\|'pre_state'` | `'mouse'` | 窗口位置模式 |
| `translate_remember_window_size` | boolean | `true` | 记住窗口大小 |
| `translate_pinned` | boolean | `false` | 固定翻译窗口，防止失焦自动关闭 |
| `translate_always_on_top` | boolean | `false` | 始终置顶；开启后同时固定窗口 |
| `hide_source` | boolean | `false` | 隐藏源文本区域 |
| `hide_language` | boolean | `false` | 隐藏语言选择器 |
| `translate_hide_window` | boolean | `false` | 翻译后隐藏窗口 |

#### 窗口尺寸 / 位置

| 键 | 类型 | 默认值 |
|---|---|---|
| `translate_window_width` | number | `350` |
| `translate_window_height` | number | `420` |
| `translate_window_position_x` | number | `0` |
| `translate_window_position_y` | number | `0` |

#### 识别设置

| 键 | 类型 | 默认值 |
|---|---|---|
| `recognize_engine` | string | `'tesseract@default'` |
| `recognize_language` | string | `'auto'` |
| `recognize_delete_newline` | boolean | `false` |
| `recognize_auto_copy` | boolean | `true` |

#### 快捷键设置

| 键 | 类型 | 默认值 |
|---|---|---|
| `hotkey_translate` | string | `''` |
| `hotkey_ocr_recognize` | string | `''` |
| `hotkey_ocr_translate` | string | `''` |
| `hotkey_selection_dictionary` | string | `''` |

#### 服务列表

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `translate_service_list` | string[] | `['bing@default','deepl@default','mymemory@default']` | 翻译实例顺序 |
| `dictionary_service_list` | string[] | 见下方说明 | 词典实例顺序；中文词典列表默认 `['chinese_dictionary@default','ecdict@default']`，英文词典列表默认 `['cambridge_dict@default','ecdict@default']` |
| `recognize_service_list` | string[] | `['tesseract@default']` | OCR 实例顺序 |
| `tts_service_list` | string[] | `['system_tts@default']` | TTS 实例顺序 |
| `collection_service_list` | string[] | `[]` | 收藏实例顺序 |
| `service_instances` | ServiceInstancesMap | `DEFAULT_SERVICE_INSTANCES` | 实例配置；`config.instanceName` 为显示名，`config.enable=false` 表示停用 |

#### 备份设置

| 键 | 类型 | 默认值 |
|---|---|---|
| `backup_type` | string | `'webdav'` |
| `webdav_url` | string | `''` |
| `webdav_username` | string | `''` |
| `webdav_password` | string | `''` |

---

## 19. IPC 通道

`window.electronAPI` 通过 contextBridge 暴露结构化 API（`shared/types/ipc.ts` /
`electron/preload.ts`）：

| 命名空间 | 方法 / 事件 |
|---|---|
| `window` | `close` / `minimize` / `maximize` / `setAlwaysOnTop` / `getLabel` |
| `config` | `get` / `set` / `getAll` / `onChange`（`config:changed` 广播） |
| `hotkey` | `register` / `unregister` |
| `text` | `getSelection` / `writeClipboard` / `onTranslateFromSelection` / `onInputTranslate` / `onTranslateFromApi` / `onTranslateFromClipboard` / `onDictLookup` |
| `ocr` | `captureScreenshot` / `openRecognize` / `sendToTranslate` / `systemRecognize` / `onScreenshotShow` / `onRecognizeShow` |
| `history` | `add` / `list` / `count` / `update` / `delete` / `clear` |
| `backup` | `create` / `list` / `restore` |
| `dict` | `lookup` / `check` / `import` |
| `ready` | renderer 加载完成时调用 `ready(label)`，发 `renderer:ready` |

主进程 → renderer 事件通道：`translate:from-selection`、`translate:input-translate`、
`translate:from-api`、`translate:from-clipboard`、`dict:lookup`、`screenshot:show`、
`recognize:show`、`config:changed`。

---

## 20. HTTP API 服务器

**文件**: `electron/server/index.ts`

绑定 `127.0.0.1:{server_port}`（默认 20202），端口占用时启动重试 5 次。

| 方法 | 端点 | 说明 |
|---|---|---|
| POST | `/` | 翻译请求体文本 |
| POST | `/translate` | 翻译请求体文本 |
| POST | `/recognize` | 预留（当前为 stub） |
| GET | `/config` | 返回敏感字段脱敏后的公开配置 JSON |
| GET | `/history` | 预留（当前为 stub） |

E2E 测试专用端点（仅 `OMNI_POT_E2E` 环境变量启用）：
`POST /trigger-selection`、`POST /trigger-dict`、`POST /trigger-clipboard`、
`POST /trigger-clipboard-translate`、`GET /capture-clock`。

所有响应为 JSON，含 CORS 头。

---

## 21. 系统托盘

**文件**: `electron/tray/index.ts`

### 托盘菜单

中文 UI 下条目文案与显示，**每个功能项右侧显示当前绑定的快捷键全名**（使用 `Control / Alt / Shift` 完整单词，不使用 `Ctrl` 缩写或 ⌃⌥⇧ 简符）。修饰键必须按平台展示：Windows / Linux 显示 `Control`（如 `Control + Alt + T`），macOS 显示 `Command`（如 `Command + Alt + T`）；不得把 `CommandOrControl` 原样展示给用户：

| 项目 | 类型 | 操作 |
|---|---|---|
| 翻译 | 按钮 | 打开翻译窗口，右侧显示快捷键 |
| 词典 | 按钮 | 打开词典窗口，右侧显示快捷键 |
| 文字识别 | 按钮 | 启动文字识别，右侧显示快捷键 |
| 截图翻译 | 按钮 | 启动截图翻译，右侧显示快捷键 |
| — | 分隔线 | — |
| 剪贴板监听 | 复选框 | 切换剪贴板监听 |
| — | 分隔线 | — |
| 设置 | 按钮 | 打开设置窗口 |
| 检查更新 | 按钮 | 立即检查更新 |
| 查看日志 | 按钮 | 打开日志目录 |
| — | 分隔线 | — |
| 重启 | 按钮 | 重启应用 |
| 退出 | 按钮 | 退出应用 |

### 托盘弹窗尺寸

- 托盘弹窗宽度由内容自然决定：左侧功能汉字、右侧快捷键字符串、中间间距和少量左右留白共同决定宽度
- 不使用与内容无关的固定宽度；内容应刚好匹配弹窗宽度，只保留少量留白
- 托盘弹窗高度由菜单项数量和间距自然决定，不预留大块空白
- 弹窗必须在 renderer 内容和菜单文案就绪后显示，不允许先显示空白弹窗

### 托盘左键点击

由 `tray_click_event` 配置：`show_config`（默认，打开配置）/
`show_translate`（打开翻译）/ `none`（无操作）。

---

## 22. 全局快捷键

**文件**: `electron/hotkey/index.ts`

通过 Electron `globalShortcut` 注册。启动时从配置读取并注册全部已配置快捷键。

| 配置键 | 操作 |
|---|---|
| `hotkey_translate` | 翻译（单一用户入口；有选中文本时翻译选中文本，否则弹出空输入窗口；剪贴板监听开启时自动翻译剪贴板新文本；窗口可见时切换隐藏） |
| `hotkey_selection_dictionary` | 词典（窗口可见时切换隐藏） |
| `hotkey_ocr_recognize` | 文字识别 |
| `hotkey_ocr_translate` | 截图翻译 |

划词翻译 / 词典：**必须在 main 进程、翻译窗口聚焦/创建之前**读取选区
（否则焦点切走会读错目标）。快捷键显示必须按平台转换修饰键：Windows / Linux 显示 `Control`，macOS 显示 `Command`，不得显示 `CommandOrControl`。

---

## 23. 剪贴板监听

**文件**: `electron/clipboard/index.ts`

- 配置键：`clipboard_monitor`，默认 `true`
- 启动时如已开启则启动；托盘菜单可切换
- **关闭时不得监听**：`clipboard_monitor=false` 时，剪贴板轮询必须完全停止，不得触发任何翻译行为
- 轮询剪贴板文本，检测到新文本 → 聚焦/创建翻译窗口 → 发 `translate:from-clipboard`
- **抑制窗口**：`withClipboardMutationSuppressed()` 在划词翻译的 Ctrl+C 回退期间
  暂时抑制监听，避免回退复制被误识别为用户主动复制

---

## 24. 跨平台选中文本提取

**文件**: `electron/selection/`（详见 `docs/superpowers/specs/2026-05-08-selection-text-extraction-design.md`）

```
electron/selection/
├── index.ts          # 统一入口 readSelectedText() → 按平台分发
├── windows.ts        # UI Automation (koffi) → Ctrl+C 回退
├── darwin.ts         # Accessibility API (koffi) → Cmd+C 回退
├── clipboard.ts      # 剪贴板全格式备份/恢复 + sentinel 检测
└── permissions.ts    # macOS Accessibility 权限检查/引导
```

### 核心接口

```typescript
export type SelectionMethod = 'uia' | 'accessibility' | 'clipboard' | 'none'
export type SelectionFailureReason =
  | 'empty' | 'permission-denied' | 'unsupported-platform' | 'copy-failed' | 'error'

export interface SelectedTextResult {
  text: string
  method: SelectionMethod
  reason?: SelectionFailureReason
  error?: unknown
}

export async function readSelectedText(): Promise<SelectedTextResult>
export async function getSelectedText(): Promise<string>
```

### 实现策略

- **Windows**：主方案 UI Automation（koffi 加载 COM）；回退 `Ctrl+C` + 剪贴板 sentinel
- **macOS**：主方案 Accessibility API（koffi 调 ObjC runtime）；回退 AppleScript `Cmd+C` + 剪贴板
- **剪贴板回退**：备份全部格式 → 写 sentinel → 模拟复制 → 轮询变化 → `finally` 恢复
- 主入口不向业务抛错，保留 `reason` 供日志、权限引导、测试断言使用
- macOS 需 Accessibility 权限；无权限返回 `permission-denied` 并引导用户

依赖：`koffi`（纯 JS FFI，无需编译 native 模块）。

---

## 25. 翻译历史记录

**文件**: `electron/history/index.ts` + `electron/ipc/history_handlers.ts`

- better-sqlite3 数据库存储翻译历史
- 记录结构：`id`、`service_key`（实例 key）、`source_text`、`source_lang`、
  `target_text`、`target_lang`、`created_at`
- 翻译成功后自动写入，除非 `history_disable=true`
- 设置页历史子页支持分页浏览、编辑、清空

---

## 26. 备份与恢复

**文件**: `electron/backup/index.ts` + `electron/ipc/backup_handlers.ts`

- 备份类型（`backup_type`）：WebDAV / 本地
- `backup.create()` — 将 `config.json` + CC-CEDICT 数据库等打包为 zip，存本地或 WebDAV
- `backup.list()` — 列出可用备份
- `backup.restore(name)` — 下载/读取 zip 解压覆盖
- 导出的 zip 必须可作为恢复输入重新导入；恢复流程必须验证配置、历史记录和随包数据库恢复正确

---

## 27. 自动更新

**文件**: `electron/updater/index.ts`

- 配置键：`check_update`，默认 `true`
- 启动时 `checkForUpdate()` 请求 GitHub Releases API 获取最新版本
- 比较版本号，有更新则创建更新器窗口
- 更新器窗口显示版本对比（含包大小）、release notes、下载进度条
- 用户点击"立即更新"后从 `TuTouPower/omni_pot` GitHub release assets 下载安装包，下载完成后启动安装/替换流程
- 生产下载 URL 必须是本仓库 GitHub release asset 或 GitHub 返回的可信下载重定向；E2E 环境才允许 localhost HTTP 资产

---

## 28. 国际化

**文件**: `src/i18n/`

- react-i18next，多语言 JSON locale 文件
- `app_language` 变更时绑定 config store，调用 `i18n.changeLanguage()`，
  所有 `useTranslation()` 组件即时重渲染
- 语言名、检测标签、更新器操作和系统托盘菜单跟随当前界面语言；缺失的 locale key 必须显示明确 fallback，不允许把 `welcome.translate`、`Delete_spaces` 等原始翻译 key 展示给用户

---

## 29. 平台特定行为

| 方面 | Windows | macOS | Linux |
|---|---|---|---|
| 窗口装饰 | frameless + 自绘标题栏 | frameless + 自绘标题栏 | frameless + 自绘标题栏 |
| 截图 | Electron 全屏覆盖 | 可用 `screencapture -i -r` | Electron 全屏覆盖 |
| 系统 OCR | WinRT OcrEngine | 原生 API | tesseract CLI |
| 选中文本 | UI Automation → Ctrl+C 回退 | Accessibility → AppleScript 回退 | 剪贴板回退 |
| 全局快捷键 | 可靠 | 可靠 | Wayland 下可能不可靠，提供 HTTP API 备选 |
| native 模块 | better-sqlite3 需通过 electron-builder rebuild，打包时 `*.node` 位于 `app.asar.unpacked` | 同左 | 同左；WSL 产物不能直接在 Windows 跑 |

---

## 30. 测试策略

测试分层、运行命令、mock 准则与 E2E 设计详见 `docs/test.md` 与 `docs/test_user_e2e.md`。
原则：少 mock、多真实环境，覆盖本规格的所有功能与 UI，覆盖率目标 80%+。

---

## 31. 状态细节

各窗口需处理以下状态：

- **加载中**：翻译结果卡片保持折叠状态，只露出卡片头部、小型动效（如三点跳动、细条 shimmer 或轻量 spinner）和简短“翻译中…”状态；等待翻译结果时不得显示空白卡片，也不得显示 `stream` 等实现细节标签；结果返回后卡片自动展开
- **错误**：结果卡片显示红色错误信息与重试入口；对可定位到配置的错误可提供"打开设置"入口
- **空状态**：翻译窗口源文本为空且未被用户跳过时显示欢迎引导：标题"欢迎使用 Omni Pot"、副标题、**4 个快捷键提示卡（翻译 / 词典 / 文字识别 / 截图翻译，分别读取翻译单一快捷键 / `hotkey_selection_dictionary` / `hotkey_ocr_recognize` / `hotkey_ocr_translate`；未设置则显示"未设置"占位）**、"设置快捷键"按钮（打开设置窗口并跳到快捷键页）、"跳过"按钮（直接关闭当前窗口，并在本会话内不再显示欢迎页）。源文本一旦有内容欢迎区即消失，清空后若未跳过会再次出现。快捷键提示按平台显示 `Control` 或 `Command`，不得展示 `CommandOrControl`。
- **桌面通知**：`translate_hide_window` 等场景下，后台完成操作后以桌面通知告知

---

## 32. UI 验收标准

- 中文 UI 全程不出现 "OCR" 三个字母，统一使用"文字识别 / 截图翻译"
- 用户面向功能统一为 4 项：翻译 / 词典 / 文字识别 / 截图翻译
- 翻译窗口只有一个默认模式，不再出现"列表式"
- 翻译窗口宽度下限为“自动检测 + 转换符号 + 简体中文”自然宽度加少量留白；宽度无上限，但只能由用户调整并记住，程序和内容不得自动拉宽
- 翻译窗口高度随内容自适应；源文本输入框最多展示约 8 行，超过后仅输入框内部滚动；等待翻译结果时结果卡片折叠并显示动效，结果返回后自动展开；翻译结果不设最大高度限制
- 翻译窗口去除换行、去除空格图标必须来自设计稿；不得自造图标；用户界面不得出现 `Delete_spaces` 等原始翻译 key
- 欢迎页宽度匹配当前翻译窗口，不拉宽窗口；欢迎页高度刚好贴合内容；点击“跳过”后直接关闭窗口
- 语言显示全部使用中文可读文本：检测为英文、自动检测、简体中文；语言下拉项以**该语言自身文字**显示（English / 日本語 / ...），不带 AUTO/ZH 等字母前缀
- 翻译窗口语言转换区域居中，且只包含"自动检测 → 简体中文"的核心信息
- 翻译输入区、语言转换区、翻译结果区都采用小卡片样式
- 翻译结果卡片右上角集中放置朗读、复制、收藏、折叠按钮；卡片不显示 `stream` 标签；等待结果时显示轻量翻译中动效
- 文字识别 / 截图翻译窗口第二排为左侧大原图卡片 + 右侧纵向两个小卡片（识别内容、翻译内容）；具体视觉细节以 demo 为准
- 文字识别窗口切换识别语言后自动重新识别；截图翻译窗口切换识别语言后自动重新识别并刷新翻译，切换翻译目标语言后自动重新翻译
- 文字识别按钮顺序（左→右）：`复制图片 → 选择识别引擎 → 自动检测 | 翻译 → 去除换行 → 去除空格 → 复制 → 导出`
- 截图翻译按钮顺序（左→右）：`复制图片 → 选择识别引擎 → 自动检测 → 转换符号 → 简体中文 | 去除换行 → 去除空格 → 复制 → 导出`
- 文字识别 / 截图翻译窗口去掉图片尺寸、类型、识别字数、耗时等弱价值信息
- 词典窗口顶部为可编辑源词卡片（contentEditable div，Enter 重查），下方为发音+词性卡片，再下方为各服务结果卡片；支持单词级收藏；按检测语言路由到对应词典列表（英文→英文词典列表、中文→中文词典列表）；不再显示词形变化卡片与来源 chips
- 设置窗口为左导航 + 右卡片布局，覆盖 8 个页面；侧边栏无置顶 / 固定按钮，标题栏使用最小化 / 最大化 / 关闭三件套；快捷键、服务、备份页面必须与 demo 对齐
- 历史设置页顶部工具栏必须一行完整展示 `启用`、搜索、服务筛选、时间筛选、清空；搜索框不得挤占导致其他控件换行
- 更新器窗口标题栏无置顶 / 固定按钮，只保留关闭按钮
- 快捷键设置只有 4 项（翻译 / 词典 / 文字识别 / 截图翻译），翻译是单一入口，不拆”划词翻译 / 输入翻译”；已绑定显示”解绑”按钮，未绑定显示”绑定”按钮；快捷键被占用提示在状态细节区域显示，不在快捷键页常驻
- 服务设置 6 个 Tab：翻译 / 中文词典 / 英文词典 / 文字识别 / 语音朗读 / 收藏；编辑、删除使用带文字的完整按钮；无插件相关入口
- 设置 → 通用：界面语言归“应用”卡片；“本地 API 端口”标签旁有小圆圈问号按钮用于打开 API 文档；外观卡片含主题三按钮分段控件、文字（字体 + 字号，无预览块）、主色调、透明背景、托盘点击行为；不提供代理功能或代理设置
- 系统托盘菜单中文化为 4 个功能项 + 设置 / 更新 / 日志 / 重启 / 退出，每个功能项右侧显示完整快捷键（Windows / Linux 使用 `Control`，macOS 使用 `Command`，不得显示 `CommandOrControl`）；托盘弹窗宽度由汉字标签、快捷键文本、间距和少量留白自然决定，不使用无关固定宽度，且不得先显示空白弹窗
- 截图窗口主色仅用于选区描边与尺寸标签
- 所有图标按钮大小接近汉字大小
- 主题切换使用跟随系统 / 浅色 / 深色三按钮分段控件；主色仍支持 5 个圆形选色按钮，颜色使用克制
- 圆角与布局密度固定，不再暴露为用户可调项；Tweaks 仅保留主题与主色
- 翻译窗口通用顶部栏左对齐顺序：**置顶 → 固定 → 软件名 → 模式标签**；右上角只保留关闭按钮
- 除设置窗口外，所有窗口顶部栏顺序同翻译窗口：**置顶 → 固定 → 软件名 → 模式标签**；右上角只保留关闭按钮
- 除设置窗口外，所有非固定窗口失去焦点后应自动关闭
- 备份导出的 zip 必须可重新导入，恢复后配置、历史记录和随包数据库应一致

---

## 33. 分阶段交付计划

### P1: 应用壳 + 翻译核心

Electron 多窗口管理器、翻译窗口（SourceArea + LanguageArea + TargetArea）、
3 个默认启用翻译服务（Bing / DeepL / MyMemory）、设置窗口（通用 + 翻译 tab）、
系统托盘、全局快捷键（翻译合并键）、配置持久化 + 变更广播。

### P2: OCR + 截图

截图窗口（全屏覆盖 + 区域选择）、文字识别窗口（左图右文 + 操作区）、
系统 OCR / Tesseract / 百度 OCR、文字识别 → 翻译联动、设置「文字识别」tab、自动复制。

### P3: 服务生态

补全全部翻译 / OCR 服务、TTS 服务、收藏服务、语言检测引擎、
服务拖拽排序、服务实例管理（添加/编辑/删除/启用禁用）。

### P4: 高级功能

HTTP API 服务器、备份与恢复（WebDAV / 本地）、自动更新、完整 i18n、
剪贴板监听、翻译历史记录（SQLite）、词典 + CC-CEDICT 离线词典、设置页完整实现。

---

*规格说明结束。*
