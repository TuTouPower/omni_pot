# omni_pot 任务清单

> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_user_e2e.md` 为准。
> 已完成项归档见 `docs/archive/plan_archives/`、`docs/archive/closed_issues/`。

---

## 当前状态

- P1–P2、P5–P6 全部完成 ✅，归档见 `docs/archive/plan_archives/plan_archive_4.md`。
- 2026-05-22 用户反馈 13 个问题（`docs/issues.md`），经 spec/test/code 三方对照分析，定位根因如下。

---

## P7: 用户反馈问题修复（2026-05-22）

### 诊断结论

| 根因类型 | 含义 | 涉及 issues |
|---|---|---|
| `TEST_WRONG` | 测试断言了错误行为，锁定了 bug | #4, #12 |
| `CODE_WRONG` | spec 清楚但代码写错 | #8, #10, #13 |
| `TEST_MISSING` | 功能对但 UI 文案/视觉/格式无断言 | #1, #3, #5, #11 |
| `TEST_WEAK` | 有测试但只覆盖 happy path | #6 |
| `SPEC_UNCLEAR` | spec 未定义或需更新 | #2, #7, #9 |

### P7.0 系统性改进：测试必须从 spec 推导 ✅

- [x] 在 `docs/test.md` 中新增"测试编写原则"章节：测试期望值必须从 spec/demo 推导，禁止从代码输出反推
- [x] 审计现有测试中 titlebar 顺序断言，确认全部与 spec §4.3 一致

### P7.1 Spec 补充（先定义再修代码） ✅

- [x] **Issue #2 剪贴板监听默认值** — spec §23 `clipboard_monitor` 默认值改为 `false`；补充"关闭时不得监听"的显式约束
- [x] **Issue #7 TTS 音量** — spec §15.1 记录为已知平台限制（Web Speech API volume=1 已是上限，无法通过 AudioContext 放大；后续可通过 Edge TTS 服务解决）
- [x] **Issue #9 透明背景即时生效** — spec §9.11 补充即时生效要求，需要重建 BrowserWindow 的配置项自动重建

### P7.2 代码修复：spec 清楚、代码错误 ✅

#### Issue #4 + #12: 文字识别/词典窗口缺少固定按钮（TEST_WRONG + CODE_WRONG）

- [x] `src/windows/recognize/index.tsx` — 添加独立的 topmost 按钮，pin 改为固定按钮
- [x] `src/windows/dict/index.tsx` — 同上
- [x] 修正测试 `recognize_window.spec.ts` — titlebar 顺序 `['topmost', 'pin', 'wordmark', 'mode', 'close']`
- [x] 修正测试 `dict_window.spec.ts` — titlebar 顺序 `['topmost', 'pin', 'wordmark', 'mode', 'close']`

#### Issue #8: 翻译快捷键说明文本（CODE_WRONG）

- [x] `src/windows/config/hotkey_settings.tsx` — 修正 `sub=` 文案为 spec 定义的文本

#### Issue #10: 截图翻译结果卡片内容为空（CODE_WRONG）

- [x] `src/windows/recognize/index.tsx` — `onRecognizeShow` 收到 `mode='translate'` 且 `text` 非空时，自动触发 `doTranslate()`

#### Issue #13: 词典搜索结果不按服务顺序（CODE_WRONG）

- [x] `src/windows/dict/index.tsx` — 渲染列表从 `enabledServiceList` 改为 `activeList`（当前语言的服务列表）

### P7.3 UI 文案/视觉对齐（TEST_MISSING） ✅

#### Issue #1: 置顶按钮竖线填充时消失

- [x] `src/components/icons.tsx` Pin 图标 — 激活时竖线 stroke 改为 `currentColor`

#### Issue #3: 去除空格/换行图标与 demo 不一致

- [x] 使用 react-icons 替换自定义 SVG（`MdSmartButton` + `CgSpaceBetween`）

#### Issue #5: 文字识别标签格式错误

- [x] `src/windows/recognize/index.tsx` — 卡片标签改为 `${t('recognize.title')} ${native_language_name(...)}`

#### Issue #11: 截图翻译与文字识别+翻译样式不一致

- [x] Issue #10 修复后两条路径共用同一组件、同一 mode、同一数据

### P7.4 Spec 补充后的代码修复 ✅

#### Issue #2: 剪贴板监听行为

- [x] `shared/types/config.ts` — `clipboard_monitor` 默认值改 `true`
- [x] 更新 `tests/integration/test_config_defaults.test.ts` 默认值断言

#### Issue #9: 透明背景即时生效

- [x] `electron/config/store.ts` — 添加 `onConfigChanged` 回调机制
- [x] `electron/windows/manager.ts` — 添加 `rebuildForTransparencyChange()` 方法，关闭并重建受影响窗口
- [x] `electron/main.ts` — 注册 transparent 变化监听，触发窗口重建

#### Issue #7: TTS 音量

- [x] Web Speech API 限制无法突破，spec §15.1 标注为已知限制；后续通过 Edge TTS 服务解决（P4）

### P7.5 窗口宽度持久化（Issue #6） ✅

- [x] 确认所有窗口创建路径都经过 `WindowManager.createWindow()` 的 resize persistence 逻辑
- [x] 更新 spec 和代码：`translate_remember_window_size` 默认值改为 `true`
- [x] 更新 `recognize_remember_window_size` 默认值改为 `true`
- [x] 更新集成测试断言

---

## P8: 测试覆盖补全

### P8.1 外部服务全覆盖 ✅

`tests/user_e2e/specs/external_services.spec.ts` 必须覆盖所有"免费无需 key"且"当前代码存在"的外部服务。
对照 `docs/external_service_catalog.md` §1.2–§1.5，当前已覆盖与待补：

| 服务 | 类型 | 状态 |
|---|---|---|
| Bing Translate | 翻译 | ✅ 已覆盖 |
| Google Translate | 翻译 | ✅ 已覆盖 |
| DeepL free | 翻译 | ✅ 已覆盖（含长文本、葡语变体） |
| MyMemory | 翻译 | ✅ 已覆盖 |
| Cambridge Dictionary | 词典 | ✅ 已覆盖 |
| Free Dictionary | 词典 | ✅ 已覆盖 |
| ECDICT | 词典（本地） | ✅ 已通过 dict_window.spec.ts E2E 覆盖 |
| Chinese Dictionary | 词典（本地） | ✅ 已通过 dict_window.spec.ts E2E 覆盖 |
| Tesseract OCR | OCR（本地） | ✅ 已通过 recognize_window.spec.ts E2E 覆盖 |
| System TTS | TTS（本地） | ✅ 已通过 Web Speech stub 覆盖 |

- [x] ECDICT 本地词典 — dict_window.spec.ts 已覆盖真实查询
- [x] Chinese Dictionary 本地词典 — dict_window.spec.ts 已覆盖真实查询
- [x] Tesseract OCR 本地识别 — recognize_window.spec.ts 已覆盖真实识别
- [ ] 确认所有新增免费服务（P4 完成后）同步添加到 external_services.spec.ts

### P8.2 翻译窗口源文本区操作按钮测试 ✅

`translate_source_area.spec.ts` 和 `recognize_window.spec.ts` 已覆盖去除空格/去除换行按钮的精确行为：

- [x] **去除空格**：含换行的多行文本点击去除空格 → 空格被移除、换行符保留
- [x] **去除换行**：含换行的多行文本点击去除换行 → 换行被规范化为空格、连字符断行被合并

---

## P3: 人工 / 打包实机验证

需在 Windows dist 产物中人工确认：

- [ ] **TTS 实机发声**：翻译/词典/识别窗口点击朗读，确认有声音
- [ ] **dist 打包 smoke**：`npm run dist` 后验证首次启动、托盘、快捷键、截图、设置、识别窗口，并确认 `better-sqlite3` 的 `*.node` 位于 `app.asar.unpacked` 且词典/历史数据库可正常打开
- [ ] **P7 修复后视觉验证**：确认置顶/固定按钮四窗口一致、图钉竖线可见、去除换行/空格图标与 demo 一致

---

## P4: 免费翻译 / 词典服务集成（待用户允许后再做）

来源：`docs/archive/external_services/pot_plugin_api_test_results.md`（2026-05-19 测试），分类详见 `docs/external_service_catalog.md` §1.2/§1.3。
**未经用户明确允许，暂不主动开工**。

### 翻译服务（免费无 key，已验证可用）

- [ ] **火山翻译 (Volcengine)** — 最简单，纯 JSON POST，零签名
- [ ] **腾讯交互翻译 (Transmart)** — 稳定，固定 client_key
- [ ] **腾讯翻译君 (Tencent WeChat)** — 稳定，GET 请求，模拟微信小程序
- [ ] **彩云小译 (Caiyun)** — 稳定，内置 token（有失效风险）
- [ ] **Papago (Naver)** — 多语言，需动态 HMAC token 流程


## P9: System OCR 跨平台适配

**目标**：根据平台决定是否提供 System OCR 选项，Tesseract 保持默认 OCR 引擎。

### P9.1 macOS System OCR 实现

macOS 10.15+ 内置 Vision 框架（`VNRecognizeTextRequest`），识别质量优秀。

- [ ] `electron/ipc/ocr_handlers.ts` — 新增 `macos_ocr()` 函数，通过 Swift CLI 工具或 Python pyobjc 调用 Vision 框架
  - 方案 A（推荐）：编译一个轻量 Swift CLI（`scripts/` 下），通过 `execFile` 调用
  - 方案 B：通过 `python3 -c "..."` + pyobjc 调用（macOS 自带 Python 可能无 pyobjc，需额外判断）
- [ ] `electron/ipc/ocr_handlers.ts` — `registerOcrHandlers` 中 `platform === 'darwin'` 分支调用 `macos_ocr()`
- [ ] macOS 支持的语言列表与 Windows 不同（Vision 框架支持的语言集），需单独定义

### P9.2 平台条件化 System OCR 可见性

- [ ] `src/services/ocr/system.ts` — 根据 `navigator.platform` 或 IPC 查询当前平台，Linux 时不导出/注册该服务
- [ ] `src/services/ocr/index.ts` — `registerAllOcrServices()` 中条件注册：Windows + macOS 注册 System OCR，Linux 跳过
- [ ] `shared/types/config.ts` — `recognize_service_list` 默认值保持 `['tesseract@default']`（不变，Tesseract 作为默认）

### P9.3 Linux 路径处理

当前 `linux_ocr()` 直接调外部 `tesseract` 命令行，不是真正的系统能力：

- [ ] 移除 `ocr_handlers.ts` 中的 `linux_ocr()` 函数（Tesseract 已通过 tesseract.js 在渲染进程独立实现）
- [ ] Linux 下 System OCR 选项完全不出现，用户使用默认的 Tesseract 即可

### P9.4 文档同步

- [ ] `docs/spec.md` §14 OCR 服务清单 — 标注 System OCR 仅 Windows + macOS 可用，Linux 不提供
- [ ] `docs/spec.md` §8.2 文字识别模式按钮 — 确认"选择识别引擎"下拉框的平台行为描述
- [ ] `docs/external_service_catalog.md` — System OCR 条目补充平台限制说明
- [ ] `docs/spec.md` §8.5 OCR 执行细节 — 补充 macOS Vision 框架路径说明

---

## P10: 日志系统补全

### 现状

主进程有 electron-log 日志（`%APPDATA%/omni_pot/logs/main.log`），覆盖：启动流程、窗口创建/关闭/ready、快捷键注册、HTTP server、词典 DB 加载。

**渲染进程完全没有日志系统**——翻译/词典/识别窗口的服务调用、语言检测、错误全部是 `console.error` 吞掉，不写文件、不上报主进程。无法通过日志排查用户反馈的功能问题。

主进程也有盲区：翻译请求/响应、配置变更、服务错误详情均无记录。

### 需要补的内容

#### P10.1 渲染进程关键路径日志（通过 IPC 写入 main.log）

- [ ] 翻译流程：请求发起（源文本摘要、源/目标语言）、语言检测结果、每个服务的成功/失败/耗时
- [ ] 词典流程：查询词、检测语言、选用的服务列表、每个服务的成功/失败/耗时
- [ ] 识别流程：使用的 OCR 引擎、识别语言、耗时、结果长度
- [ ] TTS 流程：朗读文本摘要、使用的 voice、成功/失败

#### P10.2 服务错误详情

- [ ] 所有 `catch` 块记录错误信息（HTTP status、error message、超时），不只是吞掉
- [ ] 网络错误区分：超时 / 429 限流 / DNS 失败 / 其他

#### P10.3 配置变更日志

- [ ] `useConfigStore.set()` 调用时记录 key + old value → new value（敏感字段如 API key 脱敏）

#### P10.4 主进程补盲

- [ ] 快捷键触发时记录 action name + 读取的文本摘要
- [ ] 剪贴板监听触发时记录文本摘要

---

## 已知环境问题（不修，仅跟踪）

- **谷歌翻译当前环境失败**：保留为已知问题，不用 mock 隐藏；需要在网络可达的环境复测，或更换默认免费引擎。
