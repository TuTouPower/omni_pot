# Pot Desktop 重写设计文档

> 日期: 2026-05-06
> 状态: 已批准
> 基于: `docs/spec.md` (Pot Desktop 3.0.7 完整产品规格)

## 1. 项目概述

完整重写 [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop)，基于新技术栈实现 spec 中定义的所有功能。原版使用 Tauri 1.x + React 18 + NextUI，技术老旧代码利用价值不大，本项目从零开始。

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 35+ |
| 前端 | React 19 + TypeScript |
| 构建 | electron-vite + electron-builder |
| UI 库 | HeroUI v2 (`@heroui/react`，原 NextUI 已改名) + Tailwind CSS |
| 状态管理 | Zustand (持久化用 zustand/middleware/persist) |
| 配置存储 | 自实现 JSON 文件读写；变更通过 IPC `config:changed` 主进程广播给所有 renderer |
| 数据库 | better-sqlite3（P4 历史记录用；native 模块，构建需 electron-rebuild 走通） |
| IPC | Electron contextBridge + ipcMain/ipcRenderer |
| 测试 | Vitest (unit + integration) + Playwright (e2e) |
| i18n | react-i18next |
| 拖拽 | `@dnd-kit/*`（P3 服务排序用；不用已废弃的 react-beautiful-dnd） |

## 3. 架构方案：多窗口 Electron

忠实复刻原版的多窗口架构。每个功能（翻译、截图、OCR、配置、更新器）是独立的 BrowserWindow。

### 3.1 窗口定义

```typescript
enum WindowLabel {
  DAEMON = 'daemon',
  TRANSLATE = 'translate',
  SCREENSHOT = 'screenshot',
  RECOGNIZE = 'recognize',
  CONFIG = 'config',
  UPDATER = 'updater',
}
```

### 3.2 窗口配置

| 窗口 | 默认尺寸 | 特殊行为 |
|---|---|---|
| daemon | 隐藏 | 后台 worker，不显示 |
| translate | 350×420（可配置） | 失焦可关闭、可置顶、跳过任务栏 |
| screenshot | 全屏 | 始终置顶，截图后自动关闭 |
| recognize | 800×400（可配置） | 可置顶 |
| config | 800×600 | 最小尺寸 800×400 |
| updater | 600×400 | 固定尺寸 |

### 3.3 窗口管理器核心行为

- 窗口复用：同标签已存在 → focus 而非重建
- 鼠标显示器检测：新窗口在鼠标所在显示器上创建（`electron` 包导出的 `screen` 模块）
- 窗口 label 由 manager 自维护 `Map<browserWindowId, label>`（Electron 没有 Tauri 的 `getLabel()` API）
- 窗口位置模式：`mouse`（光标位置）/ `pre_state`（记住位置）
- 阴影和透明：按平台配置

### 3.4 IPC 通信层

通过 contextBridge 暴露结构化 API：

```typescript
window.electronAPI = {
  window: { close, minimize, maximize, setAlwaysOnTop },
  text: { getSelectionText },
  config: { get, set, onChange },
  screenshot: { capture, cutImage, getBase64 },
  hotkey: { register, unregister },
  http: { streamFetch },
  clipboard: { startMonitoring, stopMonitoring },
  tts: { play, stop },
}
```

## 4. 项目目录结构

```
omni_pot/
├── electron/                  # Electron main process
│   ├── main.ts               # 入口
│   ├── windows/              # 窗口管理
│   │   ├── manager.ts
│   │   └── types.ts
│   ├── ipc/                  # IPC handlers
│   ├── services/             # 后端服务
│   ├── tray/                 # 系统托盘
│   ├── hotkey/               # 全局快捷键
│   ├── clipboard/            # 剪贴板监听
│   ├── server/               # HTTP API 服务器
│   └── config/               # 配置管理
├── src/                       # Renderer (React)
│   ├── windows/              # 按窗口组织
│   │   ├── translate/
│   │   ├── recognize/
│   │   ├── screenshot/
│   │   ├── config/
│   │   └── updater/
│   ├── services/             # 翻译、OCR、TTS API 调用
│   ├── stores/               # Zustand stores
│   ├── hooks/
│   ├── utils/
│   ├── i18n/
│   ├── types/
│   └── styles/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
└── resources/
```

## 5. 服务接口设计

所有服务遵循插件式统一接口：

### 5.1 翻译服务接口

```typescript
interface TranslateService {
  readonly key: string;
  readonly name: string;
  readonly languages: Language[];
  translate(text: string, from: string, to: string, config: ServiceConfig): Promise<string | DictResult>;
  testConfig(config: ServiceConfig): Promise<boolean>;
  ConfigComponent: React.ComponentType;
}
```

### 5.2 OCR 服务接口

```typescript
interface RecognizeService {
  readonly key: string;
  readonly name: string;
  readonly languages: Language[];
  recognize(imageBase64: string, language: string, config: ServiceConfig): Promise<string>;
  testConfig(config: ServiceConfig): Promise<boolean>;
  ConfigComponent: React.ComponentType;
}
```

### 5.3 服务实例系统

每个服务实例有唯一键：`{service_name}@{random_id}`（如 `openai@abc123`）。用户可以添加同一服务的多个实例，配置不同。

**默认实例**：首次启动每个内置服务自动建一个默认实例（key 形如 `bing@default`）。`translate_service_list` 储存的是**实例 key**，不是 service key——通过 `getServiceKey(instanceKey)` 才得到裸 key。

## 6. 分阶段交付计划

### P1: 应用壳 + 翻译核心

**目标：** 可用的翻译弹窗 + 基础配置

- Electron 多窗口管理器
- 翻译窗口（SourceArea + LanguageArea + TargetArea）
- 3 个翻译服务：Bing（免费）、Google（免费）、DeepL（Free/API/DeepLX）
- 配置窗口：通用 tab + 翻译 tab
- 系统托盘菜单（基础）
- 全局快捷键（划词翻译 + 输入翻译）
- 配置持久化（main 进程 JSON 文件读写）+ 配置变更广播（main → renderer，通过 `webContents.send('config:changed', key, value)`）。外部文件监听热更新延后到 P4。

### P2: OCR + 截图

**目标：** 截图识别 + OCR → 翻译联动

- 截图窗口（全屏覆盖 + 区域选择）
- OCR 识别窗口（ImageArea + TextArea + ControlArea）
- 3 个 OCR 服务：系统 OCR、Tesseract (tesseract.js)、百度 OCR
- OCR → 翻译联动（两条路径：识别后翻译 / 直接翻译）
- 配置页增加「识别」tab
- 自动复制行为

### P3: 服务生态

**目标：** 实现全部服务

- 补充 18 个翻译服务
- 补充 13 个 OCR 服务
- 2 个 TTS 服务（Edge TTS、Lingva TTS）
- 2 个收藏服务（Anki、欧路词典）
- 7 个语言检测引擎
- 服务拖拽排序
- 服务实例管理（添加/编辑/删除/启用禁用）

### P4: 插件 + 高级功能

**目标：** 功能完整

- 插件系统（.potext 格式兼容）
- HTTP API 服务器
- 备份与恢复（WebDAV / 阿里云盘 / 本地）
- 自动更新（electron-updater + GitHub Releases）
- 完整 i18n（19 种语言）
- 剪贴板监听
- 翻译历史记录（SQLite）
- 配置页完整实现（服务管理、历史、备份、关于）

## 7. 翻译服务完整清单

| # | 服务 | Key | 认证 | 特殊说明 |
|---|---|---|---|---|
| 1 | 必应 | `bing` | 免费 | P1 |
| 2 | 谷歌 | `google` | 免费（token） | P1 |
| 3 | DeepL | `deepl` | Free/API/DeepLX | P1 |
| 4 | 阿里巴巴 | `alibaba` | AccessKey | P3 |
| 5 | 百度 | `baidu` | MD5 签名 | P3 |
| 6 | 百度领域 | `baidu_field` | MD5 + field | P3 |
| 7 | 必应词典 | `bing_dict` | 免费 | P3 |
| 8 | 彩云小译 | `caiyun` | Token | P3 |
| 9 | 剑桥词典 | `cambridge_dict` | 免费（抓取） | P3 |
| 10 | ChatGLM | `chatglm` | API Key | P3 |
| 11 | ECDict | `ecdict` | 离线 | P3 |
| 12 | Gemini Pro | `geminipro` | API Key | P3 |
| 13 | Lingva | `lingva` | 自定义 URL | P3 |
| 14 | 牛翻译 | `niutrans` | API Key | P3 |
| 15 | Ollama | `ollama` | 本地 | P3 |
| 16 | OpenAI | `openai` | API Key | P3 |
| 17 | 腾讯 | `tencent` | TC3-HMAC-SHA256 | P3 |
| 18 | TranSmart | `transmart` | Username + Token | P3 |
| 19 | 火山引擎 | `volcengine` | AppID + Secret | P3 |
| 20 | Yandex | `yandex` | 免费 | P3 |
| 21 | 有道 | `youdao` | MD5 签名 | P3 |

## 8. OCR 服务完整清单

| # | 服务 | Key | P 阶段 |
|---|---|---|---|
| 1 | 系统 OCR | `system` | P2 |
| 2 | Tesseract | `tesseract` | P2 |
| 3 | 百度 OCR | `baidu_ocr` | P2 |
| 4 | 百度高精度 | `baidu_accurate_ocr` | P3 |
| 5 | 百度图片 | `baidu_img_ocr` | P3 |
| 6 | 讯飞 | `iflytek_ocr` | P3 |
| 7 | 讯飞 IntSig | `iflytek_intsig_ocr` | P3 |
| 8 | 讯飞 LaTeX | `iflytek_latex_ocr` | P3 |
| 9 | 腾讯 | `tencent_ocr` | P3 |
| 10 | 腾讯高精度 | `tencent_accurate_ocr` | P3 |
| 11 | 腾讯图片 | `tencent_img_ocr` | P3 |
| 12 | 火山引擎 | `volcengine_ocr` | P3 |
| 13 | 火山多语言 | `volcengine_multi_lang_ocr` | P3 |
| 14 | OpenAI 兼容 | `openai_compatible` | P3 |
| 15 | 二维码 | `qrcode` | P3 |
| 16 | Simple LaTeX | `simple_latex_ocr` | P3 |

## 9. 测试策略

遵循 CLAUDE.md 要求：完好的单元测试、集成测试、端到端测试，尽量少用 mock，多用真实环境。

- **单元测试 (Vitest)**：服务接口、工具函数、状态管理逻辑
- **集成测试 (Vitest)**：IPC 通信、配置读写、数据库操作
- **E2E 测试 (Playwright)**：窗口行为、翻译流程、OCR 流程
- 覆盖率目标：80%+
- 服务测试：对免费服务（Bing、Google、系统 OCR）使用真实 API 调用；对付费服务使用 mock

## 10. 目标平台

| 平台 | 开发/构建 | 说明 |
|---|---|---|
| Linux | WSL2 + WSLg 开发，原生 Linux 构建 | 优先支持。开发期需 WSLg（Windows 11 / WSL ≥ 0.65）才能弹出 Electron GUI。 |
| Windows | Windows 构建 | 需额外处理窗口装饰、托盘 |
| macOS | macOS 构建 | 需 Mac 硬件或 CI |

### 平台差异处理

- **窗口装饰**：macOS 用 overlay 标题栏；Windows/Linux 透明无装饰 + 窗口阴影
- **截图**：macOS 可用 `screencapture -i -r`；Windows/Linux 用 Electron overlay
- **系统 OCR**：Windows 用 WinRT OcrEngine；macOS 用原生 API；Linux 用 tesseract CLI
- **全局快捷键**：Wayland 下可能不可靠，通过 HTTP API 作为备选方案
- **托盘**：Windows 左键点击行为可配置；macOS/Linux 用系统默认
- **WSL 限制**：WSL 内不可用 Docker 代理；native module（better-sqlite3）必须在目标平台上 rebuild，不能依赖 WSL 产物在 Windows 上跑
