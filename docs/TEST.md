# 测试规范

> Omni Pot 测试的单一权威文档：分层、mock/stub 边界、E2E 基础设施、运行命令与真实 smoke 约定。

---

## 1. 测试分层

| 层级 | 目录 | 框架 | 职责 |
|---|---|---|---|
| 单元测试 | `tests/unit/` | Vitest | 服务接口、工具函数、状态管理逻辑、语言检测、默认配置边界 |
| 集成测试 | `tests/integration/` | Vitest | 能在 Node/Vitest 环境真实运行的主进程模块行为，例如配置读写、词典数据库构建产物 |
| 用户端到端测试 | `tests/e2e/` | Playwright + Electron | 真实 Electron 实例，模拟真实用户操作 |

三层职责不重叠：

- 单元/集成测试验证模块正确性。
- 原生 Electron ABI 依赖的数据库行为不在 Vitest 中复制 SQL 逻辑；通过用户 E2E 覆盖历史记录增删改查、分页、禁用历史和备份恢复。
- 用户端到端测试验证功能正确性：用户点了按钮、输入了文字，看到了预期结果。E2E 不直接调 `electronAPI` 绕过 UI。

---

## 2. 通用原则

- **少 mock，多真实**：本地能力真实测试；外部翻译/词典/文字识别服务默认使用本地可控桩，真实公网连通性只由 `external_services.spec.ts` 覆盖。
- **覆盖完整**：测试要覆盖 `docs/SPEC.md` 的所有功能、所有 UI。
- **spec 优先**：测试断言的期望值来源于 `docs/SPEC.md` 或 `docs/design/omni-pot/`，不是从代码输出反推。
- **E2E 全程真实用户视角**：每个用例都是“用户做了某操作 → 看到某结果”。
- **稳定可复现**：固定执行顺序，显式等待条件，稳定的 `data-testid` 选择器，每个用例独立且自带配置重置。
- **命名**：测试文件、helper、变量一律 `snake_case`；E2E spec 以 `.spec.ts` 结尾。

---

## 3. mock / stub 使用准则

核心原则：E2E 测真实用户交互与真实应用 service adapter。除 `tests/e2e/specs/external_services.spec.ts` 外，所有 spec 对外部翻译、词典、文字识别服务都必须使用本地可控桩，不能直接访问公网服务。任何 mock/stub 测试都不能冒充真实公网连通性测试。

### 3.1 外部服务边界

- 真实公网连通性只由 `external_services.spec.ts`（`@external`）负责；默认免费翻译服务是否能产出真实结果的期望也放在该 spec，不放在 `@core` / `@ui`。
- 其他 spec 优先使用 `TranslationTestServer` 或本地 HTTP stub，让应用照常走真实 service adapter 和真实 HTTP 请求。
- init script `fetch` override、`page.route().fulfill()` 只用于局部 UI 状态；测试名或注释必须标注 `stubbed`，不能替代 service adapter 覆盖。
- 本地能力继续真测：`chinese_dictionary`、Tesseract、System TTS。自动化无法稳定验证真实发声时，Web Speech voice/playback 状态可用 stub 控制。

### 3.2 允许 mock / stub 的场景

| 场景 | 原因 |
|---|---|
| Electron API（`ipcRenderer`、`BrowserWindow` 等） | Vitest 不是真实 Electron 运行时，无法获得原生 API |
| 平台分发（macOS Accessibility 等） | Windows 环境无法真实运行 macOS 调用 |
| 外部 HTTP 成功/失败分支 | 公网服务不可控，非 `external_services.spec.ts` 必须本地可控 |
| updater 版本注入 | 避免依赖真实 GitHub release 和版本号 |
| Web Speech TTS voice 列表 | 自动化测试无法稳定验证 OS 真实发声 |

### 3.3 禁止 mock / stub 的场景

- `external_services.spec.ts` 不使用 route/mock；公共服务不可达时测试应失败并暴露具体服务。
- UI 状态测试（loading / retry / 卡片高度 / 动态翻译 / 历史写入）应优先使用本地可控 HTTP 服务控制响应，不能 mock 应用内部 service adapter。
- 本地 OCR 测试应使用真实图片 + 真实识别链路，不能 mock 识别结果。
- `expect(result.success).toBe(true)` 只能作为前置断言，后续必须验证用户可见状态、持久化结果或真实输出。

### 3.4 标签与策略矩阵

| 标签 / 类型 | 外部服务策略 | 适用场景 |
|---|---|---|
| `@core` | 本地 HTTP stub（优先） | 关键用户路径，必须可离线通过 |
| `@ui` | 本地 HTTP stub 或 init script `fetch` override | UI 状态、卡片文案、语言切换、错误态 |
| `@stubbed` | 测试名或注释说明原因 | 局部 mock/stub 场景 |
| 本地能力测试 | 真实本地服务 | `chinese_dictionary`、Tesseract、System TTS |
| `@external` | 真实外部服务 | Bing、Google、DeepL 免费、MyMemory、Cambridge 等公网连通性 |

---

## 4. 自动化测试与真实 smoke 边界

自动化测试必须优先守住能稳定复现的产品行为，但不能把自动化通过等同于真实打包产物验收通过。

### 4.1 必须自动化覆盖

以下问题应补 Vitest、集成测试或 Playwright E2E，不能只靠人工检查：

- 按钮点击是否触发实际行为，例如朗读、语音相关按钮不能只断言“按钮存在”。
- 历史、配置、语言选择等状态是否持久化并能再次读取。
- 朗读按钮是否调用 TTS IPC/服务；服务不可用时是否显示明确 disabled 态或错误反馈。
- 源语言/目标语言下拉是否可点击、可选择，选择后是否更新方向并触发重新翻译。
- 自动检测后的目标语言、请求参数和 UI 显示方向是否一致。
- 中文输入是否走 Chinese Dictionary/中文字典并返回中文释义；英文输入是否走英文词典。
- 独立欢迎窗口、加载态、结果卡片数量、错误态、空态等 DOM 状态是否符合 `docs/SPEC.md`。
- 快捷键 action 链路是否能从“读取选区/剪贴板”走到目标窗口与目标功能。
- 默认配置、服务列表、fallback 语言、禁用态文案等产品规则。
- 语言下拉框选项列表完整性：不出现多余的“自动检测”、不出现 raw language code（`auto` / `zh_cn` / `EN`）。
- 语言标签文字正确性：断言具体文字，不能只断言 `toBeVisible()`。
- 快捷键录入互斥：同时只有一个字段处于录入态；点击另一个字段的“绑定”时，前一个自动退出。
- 词典服务分流：中文查询只出 Chinese Dictionary 卡片，英文查询只出英文词典卡片，通过 `data-result-key` 验证。
- 中文场景覆盖：测试数据不能只有 `hello world`，必须包含中文查询（如“经济”、“学习”）。

### 4.2 按钮悬停提示与操作成功反馈

- 纯图标按钮必须有 `title` 或 `aria-label`，不能用硬编码中文字符串，必须用 i18n key。
- 复制 / 删除 / 清空 / 去除换行 / 去除空格等一次性操作完成后，必须显示 Toast 通知（`useToastStore` → `ToastContainer`，`data-testid="toast"`）。
- Toast 文案必须使用 `t('toast.*')` 系列 key。
- 新增按钮时，自动化测试应至少覆盖按钮有 `title` 或 `aria-label`，触发操作后 `toast` 在 3s 内可见。

### 4.3 可半自动化覆盖

以下问题应尽量用 Playwright 的 DOM bounding box、窗口 bounds、截图快照或辅助断言覆盖，但仍要在必要时补真实 Windows smoke：

- 窗口最小宽度、最大高度、内容高度是否随文本和结果卡片变化。
- 下拉弹层、菜单、浮层是否被父容器裁剪。
- 识别窗口是否只让图片卡片和结果卡片参与伸缩，其他控件是否保持稳定。
- 加载动画、stream 标签隐藏、按钮排列、语言栏宽度等可通过截图或 DOM 尺寸判断的 UI 细节。

### 4.4 必须真实 Windows 打包 smoke

以下问题涉及操作系统、打包产物或硬件环境，自动化只能辅助，不能单独宣称已解决：

- `build/release/OmniPot{VERSION}.exe`、`build/release/OmniPot{VERSION}-portable.exe` 的首次启动和重新打开行为，其中 `{VERSION}` 来自 `package.json` 的 `version` 字段。
- Windows 系统托盘真实显示效果、托盘 popup 位置、失焦关闭、浅色主题和 example 对齐。
- 真实 `globalShortcut` 是否被 Windows 接收并触发应用 action。
- OCR 鼠标框选截图在 DPI 缩放、多显示器、窗口偏移下是否裁剪到用户实际框选区域。
- TTS 是否真的发声、系统音频设备不可用时是否有用户可见反馈。
- 原生窗口 resize、边框拖拽、最小/最大尺寸在真实桌面环境中的表现。

修复这类问题时，完成报告必须分开说明：自动化测试结果、`npm run dist` 结果、真实打包产物 smoke 结果。没有真实 smoke 的，只能写“自动化路径通过，packaged 行为未验证”，不能写“已修复”。

---

## 5. 快捷键测试策略

`globalShortcut` 是 OS 级注册，Playwright 页面级键盘事件触发不了；用两层验证组合覆盖。

| 层级 | 方法 | 何时使用 |
|---|---|---|
| 注册验证 | `globalShortcut.isRegistered(shortcut)` 返回 `true` | 所有环境 |
| Action 流程验证 | 直接触发快捷键最终执行的 action（经 E2E HTTP 端点 → IPC → 目标窗口） | 所有环境 |
| OS 级按键模拟 | PowerShell `SendKeys` / `nut.js` 发送真实系统快捷键 | 仅 CI/headless，且用户明确允许 |

AI 开发时禁止使用 OS 级按键模拟，禁止在开发者机器上触发系统快捷键。只用注册验证 + Action 流程验证覆盖快捷键路径。

---

## 6. 目录结构与文件说明

### 6.1 `tests/unit/` — 单元测试

纯函数、模块逻辑，不依赖 Electron 运行时。覆盖语言检测、配置默认值、服务 adapter、选区/剪贴板、窗口管理、截图裁剪、store、IPC handler、打包结构、CSP、日志、加密工具等。

### 6.2 `tests/integration/` — 集成测试

能在 Node 环境真实运行的主进程模块，不 mock 核心逻辑。

| 文件 | 测试内容 |
|---|---|
| `config_store.test.ts` | 配置读写、持久化 |
| `chinese_dictionary_build.test.ts` | `chinese_dictionary.db` 构建产物正确性 |

### 6.3 `tests/e2e/` — 用户端到端测试

启动真实 Electron 实例，模拟用户操作。

#### 基础设施

| 文件 | 作用 |
|---|---|
| `global_setup.ts` | Playwright 命令开始时执行一次 `electron-vite build` |
| `fixtures/electron_app.ts` | 启动/停止 Electron，独立端口与独立 userData |
| `fixtures/app_fixture.ts` | 封装 ElectronApplication、多窗口 Page、配置读写与重置 |
| `fixtures/e2e_api.ts` | E2E HTTP 端点封装 |
| `fixtures/translation_test_server.ts` | 本地可控翻译响应 HTTP 服务 |
| `fixtures/stub_payloads.ts` | stub payload 与 init script helper |
| `fixtures/timeout_constants.ts` | E2E 等待超时分级常量 |
| `fixtures/test.ts` | Playwright test fixture 定义 |
| `pages/translate_page.ts` | 翻译窗口 Page Object |
| `pages/dict_page.ts` | 词典窗口 Page Object |
| `pages/recognize_page.ts` | 文字识别窗口 Page Object |
| `pages/screenshot_page.ts` | 截图窗口 Page Object |
| `pages/config_page.ts` | 设置窗口 Page Object |
| `pages/updater_page.ts` | 更新窗口 Page Object |

托盘走 `/e2e/tray-action` 与 `/e2e/tray-menu` HTTP 端点，无需 Page Object。样例图片直接放在 `fixtures/`；后续若有大量 OCR 样图，再独立拆 `data/` 目录。

#### 实例生命周期

- `omni` fixture 为 test 级；每个用例独立 Electron 实例、独立端口、独立 userData；用例结束自动 stop 并清理。
- 需要纯净启动状态（`firstRun`、自定义 `userDataDir`、`init_script`、非默认 startup config）的用例直接 `AppFixture.start(...)` 拉独立实例。
- 窗口通过 URL hash 区分：`#welcome` / `#translate` / `#dict` / `#config` / `#recognize` 等。
- `core` / `ui-serial` project 跑 `workers: 1` 固定顺序；`ui-parallel` project 跑 `fullyParallel: true`，并行 worker 限于 OS 全局态隔离的安全 spec。
- `scripts/run_e2e.mjs` 是默认 e2e 入口：阶段一跑串行 project，阶段二以 `OMNI_POT_E2E_SKIP_BUILD=1` 复用 build 跑并行 project。本地迭代手动 `npx playwright test ...` 时也可设该变量跳过 `electron-vite build`。

#### E2E HTTP 端点

E2E-only 端点仅在 `OMNI_POT_E2E=1` 且 `X-Omni-Pot-E2E-Token` 匹配 `OMNI_POT_E2E_TOKEN` 时启用。

| 端点 | 用途 |
|---|---|
| `POST /trigger-selection` | 触发划词翻译 |
| `POST /trigger-dict` | 触发划词词典 |
| `POST /trigger-clipboard` | 写入/读取剪贴板路径 |
| `POST /trigger-clipboard-translate` | 触发剪贴板翻译 |
| `GET /capture-clock` | 读取测试时钟 |
| `POST /e2e/open-window` | 打开指定窗口 |
| `POST /e2e/reset-config` | 重置配置 |
| `POST /e2e/set-config` | 写入配置 |
| `GET /e2e/clipboard` / `GET /e2e/clipboard-image` | 读取剪贴板文本/图片 |
| `GET /e2e/window-state` | 查询窗口存在、可见、聚焦、置顶与 bounds 状态 |
| `GET /e2e/window-display` / `GET /e2e/primary-display` | 查询显示器工作区 |
| `POST /e2e/trigger-screenshot` | 触发截图（`recognize` / `translate`） |
| `POST /e2e/open-recognize` | 直接打开识别窗口并注入图片/文本 |
| `POST /e2e/add-history` | 注入历史记录 |
| `POST /e2e/trigger-input-translate` | 触发输入翻译入口 |
| `POST /e2e/trigger-hotkey` | 触发快捷键 action 链路 |
| `POST /e2e/hotkey-system-failures` | 注入快捷键系统失败 |
| `POST /e2e/tray-action` | 触发托盘动作 |
| `GET /e2e/tray-menu` | 读取原生托盘菜单文案 |
| `POST /e2e/mock-update` | 注入假的“有新版本” |
| `GET /e2e/shell-open-external` / `POST /e2e/shell-open-external/reset` | 读取/重置外链打开记录 |

#### 本地可控 HTTP 服务策略

用于需要控制服务响应时序或内容的 UI 状态测试（loading、retry、长文本布局、动态翻译 debounce、历史写入等）。不用于替代真实外部服务连通性测试。

- 启动本地 HTTP test server，提供 provider 兼容响应格式。
- 通过 E2E config 或环境变量将服务 base URL 指向本地 test server，让应用照常走真实 service adapter 和真实 HTTP 请求。
- loading 测试：本地服务保持请求挂起，断言 loading UI；释放响应后断言结果展开。
- retry 测试：本地服务第一次返回 500，第二次返回 200，断言 retry 后真实重新请求并渲染成功结果。
- 长文本 / 卡片高度测试：本地服务返回固定长文本，断言布局高度、滚动和折叠行为。
- 动态翻译 debounce 测试：本地服务记录请求次数和请求 body，断言停止输入后只发一次最终文本请求。
- 历史写入测试：本地服务返回固定译文，真实点击翻译后打开历史页验证记录。

#### 等待与超时

- 禁止裸 `setTimeout` 当“等渲染”。一律用 locator assertion 或显式等待条件。
- 超时分级统一从 `tests/e2e/fixtures/timeout_constants.ts` 引用：UI 渲染、本地操作、应用窗口启动、本地 stub 翻译、网络翻译、TTS、OCR 分级管理。
- flaky 来源（截图、OCR、网络服务）可用 retry 包装，并打印每次失败原因。

#### Spec 文件

| 文件 | 覆盖内容 |
|---|---|
| `app_lifecycle.spec.ts` | 启动、欢迎页、窗口复用、托盘常驻、多窗口并存 |
| `translate_core.spec.ts` | 翻译核心路径（输入/划词 → 翻译 → 结果） |
| `translate_source_area.spec.ts` | 源文本区操作：去空格、去换行、复制、清空、TTS、键盘 |
| `translate_behavior.spec.ts` | 配置联动：失焦关闭、隐藏源文、增量、动态、自动复制、历史等 |
| `translate_language_area.spec.ts` | 语言选择、自动检测、方向切换、文案本地化 |
| `translate_result_cards.spec.ts` | 结果卡片：复制、TTS、重试、折叠、排序、词典型结果 |
| `translate_result_states.spec.ts` | 加载态、错误态、空态 |
| `translate_welcome.spec.ts` | 独立欢迎窗口、入口、跳过持久化 |
| `translate_titlebar.spec.ts` | 标题栏按钮、wordmark、模式标签、拖拽区 |
| `translate_pin_topmost.spec.ts` | 翻译窗口固定/置顶独立状态 |
| `window_pin_topmost.spec.ts` | 词典/文字识别窗口固定/置顶独立状态 |
| `translate_window_constraints.spec.ts` | 翻译窗口尺寸、滚动、自适应高度 |
| `translate_input_rows.spec.ts` | 输入框行数增长与上限 |
| `translate_entry_merge.spec.ts` | 多次触发翻译的合并行为 |
| `translate_card_collapse_height.spec.ts` | 翻译卡片折叠高度 |
| `dict_window.spec.ts` | 词典窗口完整流程、中英服务分流、标题栏 |
| `dict_card_height.spec.ts` | 词典卡片高度自适应 |
| `dict_card_collapse_height.spec.ts` | 词典卡片折叠高度 |
| `recognize_window.spec.ts` | 文字识别/截图翻译窗口、引擎、语言、按钮、配置联动 |
| `screenshot_window.spec.ts` | 截图框选、取消、截图延迟、截图后衔接识别/翻译 |
| `config_settings.spec.ts` | 设置页面各项配置与持久化 |
| `config_service_mgmt.spec.ts` | 服务管理：添加、删除、启停、编辑、排序 |
| `config_history_backup.spec.ts` | 历史记录、分页、搜索、筛选、备份恢复 |
| `terminology_settings.spec.ts` | 设置术语一致性 |
| `external_services.spec.ts` | 真实外部服务连通性 |
| `app_http_api.spec.ts` | 公开 HTTP API 端点 |
| `i18n.spec.ts` | 多语言切换、翻译完整性 |
| `updater_and_tray.spec.ts` | 更新检查、托盘弹窗、托盘布局 |
| `restart.spec.ts` | 重启进程生命周期 |
| `window_rounded_corner.spec.ts` | 窗口圆角和透明背景 |
| `p7_visual_consistency.spec.ts` | 设计稿视觉一致性回归 |
| `toast_feedback.spec.ts` | Toast 成功反馈与按钮提示 |

---

## 7. 运行命令

### 前置准备

```bash
npm install
npm run build:chinese-dictionary   # 生成 chinese_dictionary.db（词典相关测试依赖）
```

Chinese Dictionary DB 不提交到仓库（gitignored）。`npm run dist` 会自动运行上述构建；纯本地 `dev` / `test` 路径需手动运行一次。词典相关测试在 DB 缺失时会直接报错并提示运行生成命令。

### 验收命令

```bash
# 单元 + 集成测试
npm test

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

### 分层执行说明

| 场景 | 命令 | 覆盖范围 |
|---|---|---|
| PR 快速门禁 | `npm run test:e2e:core` | `@core` 标签：生命周期 + 翻译核心路径；必须可离线通过 |
| PR UI 回归 | `npm run test:e2e:ui` | `@ui` 标签：翻译 UI + 词典 + 识别 + 截图 + 设置；必须可离线通过 |
| 外部服务连通性 | `npm run test:e2e:external` | `@external` 标签 / `external_services.spec.ts`；需要真实网络访问 |
| 完整回归 | `npm run test:e2e` | 全部 spec；默认仍跳过需 `OMNI_POT_EXTERNAL_SERVICE_TESTS=1` 的真实外部服务用例 |
| 完整回归 + 外部 | `npm run test:e2e:all` | 全部 spec + 真实外部服务；需要网络 |
| 单文件调试 | `npm run test:e2e -- tests/e2e/specs/<file>.spec.ts` | 指定文件 |
| 单元 + 集成 | `npm test` | 模块正确性、配置读写、服务逻辑、语言检测、词典数据构建产物 |

`test:e2e:external` 通常由脚本设置 `OMNI_POT_EXTERNAL_SERVICE_TESTS=1` 后运行真实公共服务检查。覆盖所有“免费无需 key”且“当前代码存在”的外部服务；CI nightly 跑此项，PR 不跑。新增免费服务时必须同步添加到该 spec。
