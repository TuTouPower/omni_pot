# 测试规范

> omni_pot 测试的总则与约定。
> 用户端到端测试的**详细设计**（基础设施、文件规划、每个 spec 测什么）见
> `docs/test_e2e.md`；本文只讲总则、分层职责与运行约定。

---

## 1. 测试分层

| 层级 | 目录 | 框架 | 职责 |
|---|---|---|---|
| 单元测试 | `tests/unit/` | Vitest | 服务接口、工具函数、状态管理逻辑、语言检测、默认配置边界 |
| 集成测试 | `tests/integration/` | Vitest | 能在 Node/Vitest 环境真实运行的主进程模块行为，例如配置读写、词典数据库构建产物 |
| 用户端到端测试 | `tests/e2e/` | Playwright | 真实 Electron 实例，**模拟真实用户操作** |

三层职责不重叠：

- 单元/集成测试验证**模块正确性**（函数返回值、可在 Vitest 中真实执行的主进程模块契约）。
- 原生 Electron ABI 依赖的数据库行为不在 Vitest 中复制 SQL 逻辑；通过用户 E2E 覆盖历史记录增删改查、分页、禁用历史和备份恢复。
- 用户端到端测试验证**功能正确性**：用户点了按钮、输入了文字，看到了预期结果。
  E2E 不直接调 `electronAPI` 绕过 UI，不写脱离用户视角的冒烟/接口测试。

> 两个测试文档的分工：
> **本文档（`TEST.md`）** = 测试总则与约定（分层、原则、快捷键策略、运行命令）。
> **`test_e2e.md`** = 用户端到端测试的设计方案（基础设施架构、Page Object、
> 27 个 spec 各测什么、实施路线）。

---

## 2. 通用原则

- **少 mock，多真实**（`CLAUDE.md` 要求）：本地能力真实测试；外部翻译/词典/文字识别服务默认使用本地可控桩，真实公网连通性只由 `external_services.spec.ts` 覆盖。
- **覆盖完整**：测试要覆盖 `docs/spec.md` 的所有功能、所有 UI。
- **E2E 全程真实用户视角**：每个用例都是“用户做了某操作 → 看到某结果”。
- **稳定可复现**：固定执行顺序，显式等待条件，稳定的 `data-testid` 选择器，
  每个用例独立且自带配置重置。
- **命名**：测试文件、helper、变量一律 `snake_case`（E2E spec 以 `.spec.ts` 结尾）。

---

## 2.0 测试编写原则

> 测试期望值必须从 spec/demo 推导，禁止从代码输出反推。

| 规则 | 说明 |
|---|---|
| **spec 优先** | 测试断言的期望值来源于 `docs/spec.md` 或 `docs/design/omni-pot/` 设计稿，不是"跑一遍代码看输出是什么然后写进去" |
| **禁止反推** | 如果代码输出与 spec 不一致，修代码而非改测试 |
| **UI 顺序从 spec 推导** | titlebar 按钮顺序、卡片标签格式、action bar 按钮顺序等，必须对照 spec §4.3 / §5.4 / §8 等章节 |
| **文案从 spec 推导** | 快捷键描述、模式标签、按钮 title 等文案必须与 spec 定义一致 |
| **新增测试前先查 spec** | 写测试前先确认 spec 对该行为的定义，避免锁定错误行为 |

---

## 2.1 mock / stub 使用准则

> 核心原则：E2E 测真实用户交互与真实应用 service adapter；除
> `tests/e2e/specs/external_services.spec.ts` 外，所有 spec 对外部翻译、词典、文字识别服务都必须使用本地可控桩，不能直接访问公网服务。任何 mock/stub 测试都不能冒充真实公网连通性测试。

### 外部服务边界

- 真实公网连通性只由 `external_services.spec.ts`（`@external`）负责；默认免费翻译服务是否能产出真实结果的期望也放在该 spec，不放在 `@core` / `@ui`。
- 其他 spec 可通过本地 HTTP stub、init script `fetch` override 或 `page.route().fulfill()` 模拟外部翻译/词典/文字识别服务响应。
- 本地能力继续真测：`chinese_dictionary`、Tesseract、System TTS 使用真实本地链路；自动化无法稳定验证真实发声时，Web Speech voice/playback 状态可用 stub 控制。

### 允许 mock / stub 的场景

| 场景 | 原因 |
|---|---|
| Electron API（`ipcRenderer`、`BrowserWindow` 等） | Vitest 不是真实 Electron 运行时，无法获得原生 API |
| 平台分发（macOS Accessibility 等） | Windows 环境无法真实运行 macOS 调用 |
| 外部 HTTP 成功/失败分支（成功响应、502 / 超时 / 乱码） | 公网服务不可控，非 `external_services.spec.ts` 必须本地可控 |
| updater 版本注入 | 避免依赖真实 GitHub release 和版本号 |
| Web Speech TTS voice 列表 | 自动化测试无法稳定验证 OS 真实发声 |

### 禁止 mock / stub 的场景

- `external_services.spec.ts` 不使用 route/mock；公共服务不可达时测试应失败并暴露具体服务。
- UI 状态测试（loading / retry / 卡片高度 / 动态翻译 / 历史写入）应优先使用**本地可控 HTTP 服务**控制响应，不能 mock 应用内部 service adapter。
- 本地 OCR 测试应使用真实图片 + 真实识别链路，不能 mock 识别结果。

### 命名与标注要求

- mock/stub 测试的 `describe` 或 `test` 名称必须包含原因标识（如 `stubbed`、`@electron-mock`），
  或在测试体内用注释说明 mock 的原因、未覆盖的真实能力。
- `expect(result.success).toBe(true)` 只能作为**前置断言**，后续必须验证用户可见状态、
  持久化结果或真实输出。不允许只有 `success` 断言的测试冒充功能覆盖。

### 标签约定

| 标签 | 含义 |
|---|---|
| `@core` / `@ui` | 不 mock 应用内部模块；外部服务走本地可控 stub，必须可离线通过 |
| `@external` | 真实外部服务连通性测试，依赖网络 |
| `@stubbed` | 包含 mock/stub，测试名称或注释必须说明原因 |

### 测试标签与 stub 策略矩阵

| spec 类型 / 标签 | 外部服务策略 | 适用场景 |
|---|---|---|
| `@core` 翻译/词典/识别路径 | 本地 HTTP stub（优先） | 需要真实 service adapter + 可控响应、loading、retry、长文本、历史写入 |
| `@ui` 渲染与交互 | 本地 HTTP stub 或 init script `fetch` override | 只验证 UI 状态、卡片文案、语言切换、错误态 |
| 单页网络边界 UI | Playwright `page.route().fulfill()` | 临时拦截单个页面请求；应标注 `@stubbed`，避免替代 service adapter 覆盖 |
| 本地能力测试 | 真实本地服务 | `chinese_dictionary`、Tesseract、System TTS |
| `@external` / `external_services.spec.ts` | 真实外部服务 | Bing、Google、DeepL 免费、MyMemory、Cambridge 等当前代码存在的公网连通性 |

---

## 3. 自动化测试与真实 smoke 边界

自动化测试必须优先守住能稳定复现的产品行为，但不能把自动化通过等同于真实打包产物验收通过。每个缺陷修复都应先判断属于哪一类，并在测试或 issue 中写清覆盖范围。

### 3.1 必须自动化覆盖

以下问题应补 Vitest、集成测试或 Playwright E2E，不能只靠人工检查：

- 按钮点击是否触发实际行为，例如朗读、语音相关按钮不能只断言”按钮存在”。
- 历史、配置、语言选择等状态是否持久化并能再次读取。
- 朗读按钮是否调用 TTS IPC/服务；服务不可用时是否显示明确 disabled 态或错误反馈。
- 源语言/目标语言下拉是否可点击、可选择，选择后是否更新方向并触发重新翻译。
- 自动检测后的目标语言、请求参数和 UI 显示方向是否一致。
- 中文输入是否走Chinese Dictionary/中文字典并返回中文释义；英文输入是否走英文词典。
- 独立欢迎窗口、加载态、结果卡片数量、错误态、空态等 DOM 状态是否符合 `docs/spec.md`。
- 快捷键 action 链路是否能从“读取选区/剪贴板”走到目标窗口与目标功能。
- 默认配置、服务列表、fallback 语言、禁用态文案等产品规则。
- 语言下拉框选项列表完整性：不出现多余的"自动检测"、不出现 raw language code（`auto` / `zh_cn` / `EN`）。
- 语言标签文字正确性：断言具体文字（如 `native_language_name` 返回值），不能只断言 `toBeVisible()`。
- 快捷键录入互斥：同时只有一个字段处于录入态；点击另一个字段的"绑定"时，前一个自动退出。
- 词典服务分流：中文查询只出Chinese Dictionary卡片，英文查询只出英文词典卡片，通过 `data-result-key` 验证。
- 中文场景覆盖：测试数据不能只有 `hello world`，必须包含中文查询（如"经济"、"学习")。

### 3.1.1 按钮悬停提示与操作成功反馈

来自 P13（按钮提示与反馈全覆盖）：

- **纯图标按钮**必须有 `title` 或 `aria-label`（鼠标悬停可见提示），不能用硬编码中文字符串，必须用 i18n key。
- **复制 / 删除 / 清空 / 去除换行 / 去除空格** 等一次性操作完成后，必须显示 Toast 通知（`useToastStore` → `ToastContainer`，data-testid=`toast`）。
- Toast 文案必须使用 `t('toast.*')` 系列 key（已存在于 zh_cn/zh_tw/en，其他语言回退到 en）。
- 新增按钮时，自动化测试应至少覆盖：
  - 按钮有 `title` 或 `aria-label` 属性；
  - 触发操作后 `getByTestId('toast')` 在 3s 内可见。

### 3.2 可半自动化覆盖

以下问题应尽量用 Playwright 的 DOM bounding box、窗口 bounds、截图快照或辅助断言覆盖，但仍要在必要时补真实 Windows smoke：

- 窗口最小宽度、最大高度、内容高度是否随文本和结果卡片变化。
- 下拉弹层、菜单、浮层是否被父容器裁剪。
- 识别窗口是否只让图片卡片和结果卡片参与伸缩，其他控件是否保持稳定。
- 加载动画、stream 标签隐藏、按钮排列、语言栏宽度等可通过截图或 DOM 尺寸判断的 UI 细节。

### 3.3 必须真实 Windows 打包 smoke

以下问题涉及操作系统、打包产物或硬件环境，自动化只能辅助，不能单独宣称已解决：

- `build/release/OmniPot{VERSION}.exe`、`build/release/OmniPot{VERSION}-portable.exe` 的首次启动和重新打开行为，其中 `{VERSION}` 来自 `package.json` 的 `version` 字段。
- Windows 系统托盘真实显示效果、托盘 popup 位置、失焦关闭、浅色主题和 example 对齐。
- 真实 `globalShortcut` 是否被 Windows 接收并触发应用 action。
- OCR 鼠标框选截图在 DPI 缩放、多显示器、窗口偏移下是否裁剪到用户实际框选区域。
- TTS 是否真的发声、系统音频设备不可用时是否有用户可见反馈。
- 原生窗口 resize、边框拖拽、最小/最大尺寸在真实桌面环境中的表现。

修复这类问题时，完成报告必须分开说明：自动化测试结果、`npm run dist` 结果、真实打包产物 smoke 结果。没有真实 smoke 的，只能写“自动化路径通过，packaged 行为未验证”，不能写“已修复”。`npm run dist` 会在打包前检查既有 `build/release` exe 产物是否被 Omni Pot 或其他进程占用，若占用则直接报错，避免 electron-builder 长时间等待解锁。

---

## 4. 快捷键测试策略

`globalShortcut` 是 OS 级注册，Playwright 页面级键盘事件触发不了；用两层验证组合覆盖。

### 两层验证

| 层级 | 方法 | 何时使用 |
|------|------|----------|
| **注册验证** | `globalShortcut.isRegistered(shortcut)` 返回 `true` | 所有环境 |
| **Action 流程验证** | 直接触发快捷键最终执行的 action（经 E2E HTTP 端点 → IPC → 目标窗口） | 所有环境 |
| **OS 级按键模拟** | PowerShell `SendKeys` / `nut.js` 发送真实系统快捷键 | **仅 CI/headless，且用户明确允许** |

### AI 开发时的规则

- **禁止**使用 OS 级按键模拟（PowerShell SendKeys、nut.js 等）。
- **禁止**在开发者机器上触发系统快捷键。
- 只用注册验证 + Action 流程验证覆盖快捷键路径。
- 快捷键 action 的最终效果：读选区/剪贴板 → 打开目标窗口 → 填入文本 → 触发翻译/识别/查词。
- 测试通过 E2E HTTP 端点直接触发这个 action 链路，不经过 `globalShortcut`。

### 用户手动测试时的规则

- 用户明确允许后，可开启 OS 级按键模拟，通过环境变量 `E2E_OS_SHORTCUT=1` 控制。
- 仅在 headless/CI 环境使用，不在开发机前台运行。

### 为什么这样拆

- `globalShortcut` 是 OS 级注册，Playwright 页面级键盘事件触发不了。
- PowerShell SendKeys 发送到当前焦点窗口，会干扰开发者正常操作。
- 注册验证确保快捷键绑定了，Action 验证确保按下后的完整流程跑通。
- 两层组合等价于端到端覆盖，且不影响开发环境。

---

## 5. 目录结构与文件说明

### 5.1 `tests/unit/` — 单元测试 (Vitest)

纯函数、模块逻辑，不依赖 Electron 运行时。

| 文件/目录 | 测试内容 |
|---|---|
| `detect.test.ts` | 语言检测逻辑 |
| `config_defaults.test.ts` | 所有配置项默认值与 spec 一致性 |
| `e2e_stub_payloads.test.ts` | E2E 本地 stub payload 与 init script helper |
| `services/bing.test.ts` | Bing 翻译服务适配器 |
| `services/deepl.test.ts` | DeepL 翻译服务适配器 |
| `services/test_google.ts` | Google 翻译服务适配器 |
| `services/test_registry.ts` | 服务注册表 |
| `services/test_detect.test.ts` | 语言检测逻辑 |
| `services/test_case_cycle.test.ts` | 大小写循环转换 |
| `selection/index.test.ts` | 选区读取入口 |
| `selection/clipboard.test.ts` | 剪贴板读取 |
| `selection/clipboard_monitor.test.ts` | 剪贴板监听 |
| `selection/windows.test.ts` | Windows 平台选区 |
| `windows/test_manager.ts` | 窗口管理器 |
| `windows/manager_log.test.ts` | 窗口管理器日志 |
| `windows/screenshot_crop.test.ts` | 截图裁剪算法 |
| `stores/test_translate_store.ts` | Zustand 翻译 store |
| `ipc/ocr_handlers.test.ts` | OCR IPC 处理器（mock Electron） |
| `packaging/native_modules.test.ts` | 打包产物结构校验 |
| `csp_policy.test.ts` | CSP 策略生成 |
| `log.test.ts` | 日志模块 |
| `lib/test_crypto.ts` | 加密工具函数 |

### 5.2 `tests/integration/` — 集成测试 (Vitest)

能在 Node 环境真实运行的主进程模块，不 mock 核心逻辑。

| 文件 | 测试内容 |
|---|---|
| `config_store.test.ts` | 配置读写、持久化 |
| `chinese_dictionary_build.test.ts` | `chinese_dictionary.db` 构建产物正确性 |

### 5.3 `tests/e2e/` — 用户端到端测试 (Playwright + 真实 Electron)

启动真实 Electron 实例，模拟用户操作。

#### 基础设施 (`fixtures/` + `pages/`)

| 文件 | 作用 |
|---|---|
| `fixtures/app_fixture.ts` | 启动/停止 Electron 实例、提供 API |
| `fixtures/e2e_api.ts` | E2E HTTP 端点封装 |
| `fixtures/electron_app.ts` | Electron 进程管理 |
| `fixtures/translation_test_server.ts` | 本地可控翻译响应 HTTP 服务 |
| `fixtures/stub_payloads.ts` | 本地可控服务 stub payload 与 init script helper |
| `fixtures/test.ts` | Playwright test fixture 定义 |
| `pages/translate_page.ts` | 翻译窗口 Page Object |
| `pages/dict_page.ts` | 词典窗口 Page Object |
| `pages/recognize_page.ts` | 文字识别窗口 Page Object |
| `pages/screenshot_page.ts` | 截图窗口 Page Object |
| `pages/config_page.ts` | 设置窗口 Page Object |
| `pages/updater_page.ts` | 更新窗口 Page Object |
| `global_setup.ts` | 测试前自动 `electron-vite build` |

#### Spec 文件 (`specs/`)

| 文件 | 覆盖内容 |
|---|---|
| `app_lifecycle.spec.ts` | 启动、托盘、退出、多实例 |
| `translate_core.spec.ts` | 翻译核心路径（输入→翻译→结果） |
| `translate_source_area.spec.ts` | 源文本区操作（去空格、去换行、复制、清空、TTS） |
| `translate_behavior.spec.ts` | 动态翻译、快捷键触发、剪贴板翻译 |
| `translate_language_area.spec.ts` | 语言选择、自动检测、方向切换 |
| `translate_result_cards.spec.ts` | 结果卡片（复制、TTS、重试） |
| `translate_result_states.spec.ts` | 加载态、错误态、空态 |
| `translate_welcome.spec.ts` | 独立欢迎窗口（启动、入口、跳过持久化） |
| `translate_titlebar.spec.ts` | 标题栏按钮（置顶、固定、关闭） |
| `translate_pin_topmost.spec.ts` | 固定/置顶独立状态 |
| `window_pin_topmost.spec.ts` | 词典/文字识别窗口固定/置顶独立状态 |
| `translate_window_constraints.spec.ts` | 窗口尺寸、滚动、自适应高度 |
| `translate_input_rows.spec.ts` | 输入框行数增长/上限 |
| `translate_entry_merge.spec.ts` | 多次触发翻译的合并行为 |
| `dict_window.spec.ts` | 词典窗口完整流程（查词、中英分流、已知问题回归） |
| `dict_card_height.spec.ts` | 词典卡片高度自适应 |
| `recognize_window.spec.ts` | 文字识别窗口（OCR 引擎切换、语言、翻译模式） |
| `screenshot_window.spec.ts` | 截图框选、截图延迟 |
| `config_settings.spec.ts` | 设置页面各项配置 |
| `config_service_mgmt.spec.ts` | 服务管理（添加/删除/排序实例） |
| `config_history_backup.spec.ts` | 历史记录、备份恢复 |
| `terminology_settings.spec.ts` | 术语表设置 |
| `external_services.spec.ts` | 真实外部服务连通性（Bing、Google、DeepL、MyMemory、Cambridge） |
| `app_http_api.spec.ts` | 主进程 HTTP API 端点 |
| `i18n.spec.ts` | 多语言切换、翻译完整性 |
| `updater_and_tray.spec.ts` | 更新检查、托盘弹窗、托盘布局 |
| `window_rounded_corner.spec.ts` | 窗口圆角 |

---

## 6. 运行命令

### 前置准备

```bash
npm install
npm run build:chinese-dictionary   # 生成 chinese_dictionary.db（词典相关单元/E2E 测试依赖）
```

> Chinese Dictionary DB 不提交到仓库（gitignored）。`npm run dist` 会自动运行上述构建；
> 纯本地 `dev`/`test` 路径需手动运行一次。词典相关测试（`tests/integration/chinese_dictionary_build.test.ts`、
> 词典 E2E spec）在 DB 缺失时会直接报错并提示运行生成命令。

### 验收命令

```bash
# 单元 + 集成测试
npx vitest run tests/unit tests/integration

# 用户端到端测试（Playwright）
npm run test:e2e            # 全部 spec（full project），跳过外部服务
npm run test:e2e:core       # 核心用户路径（@core 标签），PR 快速门禁，必须可离线通过
npm run test:e2e:ui         # UI 回归（@ui 标签），必须可离线通过
npm run test:e2e:external   # 外部服务连通性（@external 标签），需要真实网络访问
npm run test:e2e:all        # 全部 e2e + 外部服务，需要真实网络访问
npm run test:e2e -- <file>  # 单文件调试

# 类型检查
npm run typecheck

# Lint
npm run lint

# 完整构建（开发验证）
npm run build
```

### 可选：外部服务连通性测试

```bash
# 运行 external_services.spec.ts（需真实网络访问）
npm run test:e2e:external
```

> `test:e2e:external` 需要真实网络访问，通常由脚本设置 `OMNI_POT_EXTERNAL_SERVICE_TESTS=1` 后运行真实公共服务检查。
> 覆盖所有"免费无需 key"且"当前代码存在"的外部服务（对照 `docs/external_service_catalog.md`）：
> Bing、Google、DeepL 免费（含长文本/葡语变体）、MyMemory、Cambridge Dictionary。
> 本地服务（Chinese Dictionary、Tesseract）通过 E2E 环境覆盖。
> CI nightly 跑此项；PR 不跑。新增免费服务时必须同步添加到此 spec。

### 分层执行说明

| 场景 | 命令 | 覆盖范围 |
|---|---|---|
| PR 快速门禁 | `npm run test:e2e:core` | `@core` 标签：生命周期 + 翻译核心路径；必须可离线通过 |
| PR UI 回归 | `npm run test:e2e:ui` | `@ui` 标签：翻译 UI + 词典 + 识别 + 截图 + 设置；必须可离线通过 |
| 外部服务连通性 | `npm run test:e2e:external` | `@external` 标签 / `external_services.spec.ts`；需要真实网络访问 |
| 完整回归 | `npm run test:e2e` | 全部 spec；默认仍跳过需 `OMNI_POT_EXTERNAL_SERVICE_TESTS=1` 的真实外部服务用例 |
| 完整回归 + 外部 | `npm run test:e2e:all` | 全部 spec + 真实外部服务；需要网络 |
| 单文件调试 | `npm run test:e2e -- tests/e2e/specs/<file>.spec.ts` | 指定文件 |
| 单元 + 集成 | `npx vitest run tests/unit tests/integration` | 模块正确性、配置读写、服务逻辑、语言检测、词典数据构建产物 |

> **注意**: `test:e2e:core` 和 `test:e2e:ui` 分别指定 Playwright `core` / `ui`
> project；对应 project 通过 `@core` / `@ui` 标签分组，spec 文件中需用
> `test.describe('@core', ...)` 或 `test('@ui ...', ...)` 标注。

- `omni` fixture 为 test 级，每个用例独立 Electron 实例、独立端口、独立 userData；用例结束自动 stop 并清理。需要纯净启动状态（`firstRun`、自定义 `userDataDir`、`init_script`、非默认 startup config）的用例直接 `AppFixture.start(...)` 拉独立实例。
- `core` / `ui-serial` project 跑 `workers: 1` 固定顺序；`ui-parallel` project 跑 `fullyParallel: true`，并行 worker 限于 OS 全局态隔离的安全 spec。
- `scripts/run_e2e.mjs` 是默认 e2e 入口：阶段一跑串行 project，阶段二以 `OMNI_POT_E2E_SKIP_BUILD=1` 复用 build 跑并行 project。本地迭代手动 `npx playwright test ...` 时也可设该变量跳过 `electron-vite build`。
- 详细的实例生命周期、Page Object、E2E HTTP 端点见 `docs/test_e2e.md`。
