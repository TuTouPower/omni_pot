# omni_pot 开发待办

> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_user_e2e.md` 为准。
> 本文档综合了 `docs/frontend_spec_gap_analysis.md`、`docs/design/demo_vs_implementation_diff.md`、`docs/issues.md` 的待办项。
> 已完成项归档见 `docs/archive/plan_archive.md`、`docs/archive/plan_archive_2.md`。

---

## 当前阶段

2026-05-20 用户验收发现大量 UI/体验问题。核心矛盾：**测试只验证了"链路通"，没有验证"体验对"**。
第一轮 P0-P2 代码修复已完成并归档（`docs/archive/plan_archive_2.md`）。第二轮修复（本文件）解决 issues.md 剩余问题，同时加固测试断言。

**第二轮状态**: 代码修复 ✅ (6/6) · 测试加固 ✅ (5/5) · 人工验证待做

**第三轮重点**: 测试质量整改 — 尽量少 mock，删除假通过/条件 skip，关键用户链路改为真实 Electron/E2E/本地可控 HTTP 服务验证。

---

## 第三轮测试整改计划

> **目标**: 测试默认真测；mock/stub 只能用于当前测试层无法真实触达、不可稳定触发或会产生外部副作用的边界。任何 mock/stub 测试都不能冒充真实链路测试。

### Test-Q1: 建立 mock 使用准则与标签 ✅

**文件**: `docs/test.md`、`docs/test_user_e2e.md`
**问题**: 现有测试没有明确区分真实链路、mock UI 状态测试、外部服务健康测试，容易把 stubbed 测试误认为真实覆盖。
**整改**:
- [x] 在 `docs/test.md` 增加测试分层规则：`@core` / `@ui` 默认不 mock 应用内部模块；`@external` 代表真实外部服务；mock/stub 测试必须在 test/describe 名称或注释里说明原因。
- [x] 明确禁止把 `expect(result.success).toBe(true)` 作为最终断言；它只能作为前置断言，后续必须验证用户可见状态、持久化结果或真实输出。
- [x] 在 `docs/test_user_e2e.md` 记录本地可控 HTTP 服务策略：UI loading/retry/长文本布局可以使用真实 HTTP test server 控制响应，而不是 mock fetch 或 mock 应用内部服务。

**验证**:
- [x] 搜索测试文档，确认包含”mock/stub 必须说明原因””success 不能作为最终断言””本地可控 HTTP 服务优先于 fetch mock”。

### Test-Q2: 删除中文词典 DB 的假通过和条件 skip ✅

**文件**: `tests/chinese_dict/build.test.ts`
**问题**: 当前 `it.skipIf(!db_exists)` 会在本地 DB 不存在时跳过大量真实校验；`if (!db_exists) return` 会造成无断言假通过。
**整改**:
- [x] 删除所有 `it.skipIf(!db_exists)`。
- [x] 删除 `if (!db_exists) return` 形式的无断言测试。
- [x] 在 `beforeAll` 中若 `resources/data/dict/chinese_dict.db` 不存在，直接抛出带操作指引的错误：运行 `npm run build:chinese-dict` 后再测。
- [x] LICENSE 测试始终断言 `resources/data/dict/chinese-dictionary-LICENSE` 存在，不再依赖 `db_exists` 静默返回。
- [x] 保留 metadata、words、characters、idioms、FTS、DB size 的真实 SQLite 查询断言。

**验证**:
- [x] 临时移走 `resources/data/dict/chinese_dict.db` 时，该测试必须失败并提示构建命令。
- [x] DB 存在时，`npm test -- tests/chinese_dict/build.test.ts` 通过。

### Test-Q3: 把翻译 UI 状态 stub 升级为本地可控 HTTP 服务 ✅

**文件**: `tests/user_e2e/pages/translate_page.ts`、`tests/user_e2e/specs/translate_result_states.spec.ts`、`tests/user_e2e/specs/translate_window_constraints.spec.ts`、`tests/user_e2e/specs/translate_behavior.spec.ts`
**问题**: loading、retry、卡片高度、动态翻译、历史写入等测试现在通过 `fulfill_*_translation_once` 控制结果；这稳定但不够真实，容易被误读为服务真实链路。
**整改**:
- [x] 新增或复用 E2E fixture 启动本地 HTTP test server，提供 Lingva/MyMemory 兼容响应。
- [x] 让应用照常走真实 service adapter 和真实 HTTP 请求，只把服务 base URL 指向本地 test server。
- [x] loading 测试：本地服务保持请求挂起，断言 loading UI；释放响应后断言结果展开。
- [x] retry 测试：本地服务第一次返回 500，第二次返回 200，断言 retry 后真实重新请求并渲染成功结果。
- [x] 长文本/卡片高度测试：本地服务返回固定长文本，断言布局高度、滚动和折叠行为。
- [x] 动态翻译 debounce 测试：本地服务记录请求次数和请求 body，断言停止输入后只发一次最终文本请求。
- [x] 历史写入测试：本地服务返回固定译文，真实点击翻译后打开历史页验证记录。
- [x] 删除或降级旧的 `fulfill_*_translation_once` 使用；如暂时保留，测试名称必须包含 `stubbed` 或注释说明只测 UI 状态。

**验证**:
- [x] 搜索 `fulfill_lingva_translation_once`、`fulfill_mymemory_translation_once`，确认只剩必要的 stubbed 测试，且名称/注释清楚。
- [x] `npm run test:e2e -- --project=full tests/user_e2e/specs/translate_result_states.spec.ts` 通过。
- [x] `npm run test:e2e -- --project=full tests/user_e2e/specs/translate_behavior.spec.ts` 通过。

### Test-Q4: 补真实翻译链路覆盖，避免只靠本地服务 ✅

**文件**: `tests/user_e2e/specs/translate_core.spec.ts`、`tests/user_e2e/specs/external_services.spec.ts`
**问题**: 本地 test server 可以让 UI 状态稳定，但不能证明真实外部服务适配器可用。
**整改**:
- [x] 保留 `external_services.spec.ts` 的真实外部服务请求，继续断言 Bing/Google/DeepL/Lingva/MyMemory/词典服务返回非空且不同于源文。
- [x] 在 `translate_core.spec.ts` 保留或补强 default free services UI roundtrip，断言真实外部服务结果进入结果卡，不只是服务函数返回。
- [x] 对真实服务失败风险高的 case 使用 `@external` 标记和 retries，而不是 mock 替代。
- [x] 外部服务测试失败时应暴露具体服务名和返回状态，方便判断是代码问题还是网络/上游问题。

**验证**:
- [x] `npm run test:e2e -- --project=full tests/user_e2e/specs/external_services.spec.ts` 在网络可用时通过。
- [x] `npm run test:e2e -- --project=full tests/user_e2e/specs/translate_core.spec.ts` 在网络可用时通过。

### Test-Q5: 补真实 OCR / 截图识别兜底 ✅

**文件**: `tests/user_e2e/specs/recognize_window.spec.ts`、`tests/user_e2e/specs/screenshot_window.spec.ts`、`tests/user_e2e/fixtures/`
**问题**: 识别窗口目前有 `fulfill_baidu_ocr_services` 形式的可控响应，能测 UI 服务启停，但不能证明 OCR 真链路可用。
**整改**:
- [x] 保留百度 OCR stub 用于”启用服务显示、停用服务不显示”的 UI 路由测试，因为真实百度 OCR 需要凭据且不适合默认 CI。
- [x] 新增本地 OCR fixture 图片测试：使用项目自带或测试内生成的图片，走真实截图/识别窗口结果渲染链路。
- [x] 若 Tesseract 数据缺失，测试必须明确失败并提示初始化方式；不能静默 skip。
- [x] 百度 OCR 真实服务可作为可选 `@external` 测试，只有存在凭据时运行；默认套件不依赖外部付费/密钥服务。

**验证**:
- [x] 真实本地 OCR fixture 测试能断言识别结果包含预期文本。
- [x] 搜索 `fulfill_baidu_ocr_services`，确认其只用于 UI 路由测试，测试名/注释不声称真实 OCR。

### Test-Q6: 补真实 Electron 剪贴板与窗口行为 E2E ✅

**文件**: `tests/unit/selection/clipboard.test.ts`、`tests/unit/selection/clipboard_monitor.test.ts`、`tests/user_e2e/specs/translate_behavior.spec.ts`、`tests/user_e2e/specs/updater_and_tray.spec.ts`
**问题**: Vitest 中 Electron clipboard/window manager mock 必须保留，但不能作为唯一证明。
**整改**:
- [x] 保留 Vitest 单测中的 Electron mock，用于验证剪贴板恢复、异常恢复、监听抑制等细分逻辑。
- [x] 在 E2E 中增加真实 Electron 剪贴板测试：通过 E2E API 写入系统剪贴板，开启剪贴板监听，断言翻译窗口真实收到剪贴板文本。
- [x] 增加真实窗口行为断言：托盘动作、窗口打开/关闭、置顶、焦点和配置持久化必须通过 E2E API + Playwright 观察真实 BrowserWindow 状态。
- [x] 单元测试文件注释中说明 mock 只覆盖 Node/Vitest 层逻辑，不代表真实 Electron 集成。

**验证**:
- [x] `npm test -- tests/unit/selection/clipboard.test.ts tests/unit/selection/clipboard_monitor.test.ts` 通过。
- [x] 对应 E2E 测试通过，并且断言真实剪贴板文本进入 UI。

### Test-Q7: 清理只靠 success 的弱断言 ✅

**文件**: `tests/user_e2e/specs/*.spec.ts`
**问题**: 多个 E2E 使用 `expect(result.success).toBe(true)`；虽然不少后续已有 UI 断言，但仍需逐条确认没有只测”链路通”的假测。
**整改**:
- [x] 全量搜索 `expect(.*success.*).toBe(true)`。
- [x] 对每个命中点确认后续至少有一个强断言：用户可见文本、窗口状态、结果卡内容、配置持久化、历史记录、剪贴板内容或服务 key 路由。
- [x] 如果没有强断言，补上对应用户可见/持久化断言。
- [x] 对确实只需要 API health 的测试，改名为 health/smoke，并说明不覆盖用户体验。

**验证**:
- [x] 搜索结果中不存在”只有 success 断言”的 E2E test。
- [x] 关键 UI 流程失败时，测试失败信息能指出具体用户可见差异，而不是只显示 success false。

### Test-Q8: 标清必须保留的 mock，不让它们冒充真测 ✅

**文件**: `tests/integration/test_config.test.ts`、`tests/unit/selection/*.test.ts`、`tests/unit/services/lingva.test.ts`、`tests/user_e2e/specs/i18n.spec.ts`、`tests/user_e2e/specs/updater_and_tray.spec.ts`、`tests/user_e2e/specs/translate_source_area.spec.ts`、`tests/user_e2e/specs/translate_result_cards.spec.ts`
**问题**: 有些 mock 必须保留，但需要明确边界。
**整改**:
- [x] Electron API mock：保留，因为 Vitest 不是真实 Electron 运行时。
- [x] 平台分发 mock：保留，因为 Windows 环境不能真实跑 macOS Accessibility。
- [x] fetch 失败分支 mock：保留，用于制造 HTTP 502/异常等真实服务不可控失败。
- [x] updater mock：保留，用于固定版本号、日期和 changelog，不依赖真实 GitHub release。
- [x] Web Speech fake voice：保留，因为自动化测试无法稳定验证 OS 真实发声。
- [x] 给上述测试添加清晰命名或注释：mock 的原因、未覆盖的真实能力、对应真实 E2E/人工验证位置。

**验证**:
- [x] 搜索 `vi.mock`、`stubGlobal`、`mockUpdate`、`Fake-`，每个保留项都有原因或测试名标识。
- [x] [PLAN.md](PLAN.md) 的人工验证继续保留 TTS 实机发声。

### Test-Q9: 更新验收命令与分层执行说明 ✅

**文件**: `docs/test.md`、`docs/test_user_e2e.md`、`PLAN.md`
**问题**: 测试整改后需要明确哪些测试默认跑、哪些依赖网络、哪些依赖本地资源或凭据。
**整改**:
- [x] 记录默认验证命令：`npm test`、`npm run test:e2e:core`、`npm run test:e2e`。
- [x] 记录真实外部服务验证：`OMNI_POT_EXTERNAL_SERVICE_TESTS=1 npx playwright test tests/user_e2e/specs/external_services.spec.ts`。
- [x] 记录词典 DB 前置条件：`npm run build:chinese-dict`、`npm run build:cc-cedict`。
- [x] 记录可选外部凭据测试的跳过/运行条件，避免默认 CI 因缺少密钥失败。

**验证**:
- [x] 新同事只看测试文档即可区分默认测试、本地资源测试、真实外部服务测试和人工验证。

---

## 第二轮代码修复

### Fix-1: 识别窗口目标语言下拉框不应包含"自动检测" ✅

**文件**: `src/windows/recognize/index.tsx`
**问题**: `LANGUAGE_CODES` 包含 `'auto'`，截图翻译模式下目标语言 PillSelect 直接遍历 `LANGUAGE_CODES`，导致下拉列表出现"自动检测"。同时源语言选项列表重复添加了 `'auto'`，出现两个"自动检测"。
**修复**: 构建 `lang_options` 时先手动添加 `'auto'`，再从 `LANGUAGE_CODES` 中 filter 掉 `'auto'`；构建 `target_lang_options` 时直接 filter 掉 `'auto'`。

### Fix-2: 识别窗口语言栏未显示实际使用的目标语言 ✅

**文件**: `src/windows/recognize/index.tsx`
**问题**: 语言栏始终显示用户配置的 `effectiveTarget`，但第二语言回退时不反映实际翻译目标。
**修复**: 添加 `effectiveTargetLang` 状态，`doTranslate` 中计算实际目标语言后更新；语言栏读取 `effectiveTargetLang ?? effectiveTarget`。新截图到达时重置。

### Fix-3: 识别/截图翻译窗口卡片标题缺少语言名称 ✅

**文件**: `src/windows/recognize/index.tsx`
**问题**: 截图翻译模式下卡片标题只显示"文字识别"/"翻译"，缺少语言名。
**修复**: 添加 `detectedSourceLang` 状态跟踪 OCR 识别到的语言。识别卡标题显示"`{语言名}的文字识别`"，翻译卡标题显示"`{目标语言}的翻译`"。新截图到达时重置。

### Fix-4: 快捷键设置"绑定成功"提示 ✅

**文件**: `src/windows/config/hotkey_settings.tsx`
**问题**: 绑定成功后显示 `setStatus('绑定成功')`，该提示留在行内导致布局错位。
**修复**: 绑定成功后 `setStatus('')` 清空。只有冲突和失败才显示提示。

### Fix-5: 快捷键设置一次只能录入一个 ✅

**文件**: `src/windows/config/hotkey_settings.tsx`
**问题**: 每个 `HotkeyField` 独立管理 `capturing` 状态。
**修复**: `HotkeySettings` 维护 `activeField` 状态，通过 `activeField` + `onStartCapture` props 传给每个 `HotkeyField`。字段失去焦点时自动退出录入态。

### Fix-6: 窗口宽度按类别记忆 ✅

**文件**: `shared/types/config.ts`、`electron/windows/manager.ts`、`electron/windows/dict_options.ts`、`electron/windows/recognize_options.ts`、`src/windows/config/recognize_settings.tsx`
**实现**:
- 翻译和词典共享 `translate_remember_window_size` / `translate_window_width` / `translate_window_height`
- 识别和截图翻译独立 `recognize_remember_window_size` / `recognize_window_width` / `recognize_window_height`
- `WindowManager.createWindow()` 中根据窗口标签自动挂载 resize 持久化
- 新建 `dict_options.ts` 使用翻译窗口配置键；`recognize_options.ts` 使用识别独立配置键
- 所有 DICT_OPTS 硬编码替换为 `get_dict_window_options()` 调用
- 识别设置页添加"记住窗口大小"开关

---

## 第二轮测试加固

### Test-1: 语言标签具体文字断言 ✅

**文件**: `tests/user_e2e/specs/translate_language_area.spec.ts`
**当前缺失**: 只断言 `toBeVisible()`，不断言具体文字。
**加固**:
- 源语言按钮文字 == "自动检测"（中文 locale），不出现 `auto` / `auto detect`
- 目标语言按钮文字 == "简体中文"，不出现 `zh_cn` / `ZH`
- 翻译后检测标签文字包含 "英文"（或 `native_language_name` 返回值），不出现 `EN` / `en`
- 交换后语言标签文字随之变化

### Test-2: 中文字词查词典 ✅

**文件**: `tests/user_e2e/specs/dict_window.spec.ts`
**当前缺失**: 所有测试数据都是英文。
**加固**:
- 查"经济"/"自我"等常用中文词 → 断言 `chinese_dictionary` 卡片出现、`cambridge_dict` / `free_dictionary` 卡片不出现
- 查"hello" → 断言英文词典卡片出现、中文词典卡片不出现
- 验证每个词典卡片 `data-result-key` 的 service key 前缀

### Test-3: 快捷键连续交互 ✅

**文件**: `tests/user_e2e/specs/config_settings.spec.ts`
**当前缺失**: 不测连续点击两个绑定按钮。
**加固**:
- 点击翻译快捷键的"绑定" → 进入录入态
- 点击词典快捷键的"绑定" → 词典进入录入态，翻译自动退出录入态
- 确认词典录入后 → 绑定成功，无"绑定成功"文字提示

### Test-4: 识别窗口语言栏 ✅

**文件**: `tests/user_e2e/specs/recognize_window.spec.ts`
**当前缺失**: 不断言语言栏文字、目标语言下拉选项。
**加固**:
- 截图翻译模式下，目标语言下拉选项**不包含** `auto` / "自动检测"
- 切换目标语言后语言栏文字更新

### Test-5: 服务路由断言 ✅

**文件**: `tests/user_e2e/specs/dict_window.spec.ts`
**当前缺失**: 断言"出了结果"但不断言"哪些服务出了结果"。
**加固**:
- 查英文词 → 断言 `data-result-key` 前缀为 `cambridge_dict` / `ecdict`，不出现 `chinese_dictionary`
- 查中文词 → 断言 `data-result-key` 前缀为 `chinese_dictionary` / `ecdict`，不出现 `cambridge_dict`

---

## 测试文档更新

### docs/test.md

在第 3.1 节"必须自动化覆盖"中补充：
- 语言下拉框选项列表完整性（不出现多余的"自动检测"、不出现 raw code）
- 语言标签文字正确性（断言具体文字，非仅 visible）
- 快捷键录入互斥（同时只有一个字段处于录入态）

### docs/test_user_e2e.md

在对应 spec 描述中补充新增的断言点。

---

## 人工验证

以下项需在 Windows dist 产物中人工确认：

- [ ] **TTS 实机发声**：翻译/词典/识别窗口点击朗读，确认有声音
- [ ] **打包后 smoke**：首次启动、托盘、快捷键、截图、设置窗口、识别窗口

---

## P5: 集成免费翻译/词典服务（不做，仅记录）

来源：`docs/external_services/pot_plugin_api_test_results.md`（2026-05-19 测试）。

将 pot-app 社区验证过的免费、无需 API key 的服务接入 omni_pot，扩充翻译和词典引擎。

### 翻译服务（免费无 key，已验证可用）

- [ ] **火山翻译 (Volcengine)** — 最简单，纯 JSON POST，零签名
- [ ] **腾讯交互翻译 (Transmart)** — 稳定，固定 client_key
- [ ] **腾讯翻译君 (Tencent WeChat)** — 稳定，GET 请求，模拟微信小程序
- [ ] **彩云小译 (Caiyun)** — 稳定，内置 token（有失效风险）
- [ ] **Papago (Naver)** — 多语言，需动态 HMAC token 流程

### 词典服务（免费无 key，已验证可用）

- [ ] **Free Dictionary API** — 英文词义/音标/例句（当前项目已有集成，确认是否最新）
- [ ] **Tatoeba 例句查询** — 多语言例句搜索引擎，适合做辅助功能

### 参考

各服务 API 格式、请求/响应示例、注意事项详见 `docs/external_services/pot_plugin_api_test_results.md`。

---

## 已知环境问题（不修，仅跟踪）

- **谷歌翻译当前环境失败**：网络可达时复测，或更换默认免费引擎
