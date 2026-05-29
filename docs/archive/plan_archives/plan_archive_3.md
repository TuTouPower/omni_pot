# PLAN.md 归档 — 2026-05-21

> 以下为 `PLAN.md` 在 2026-05-21 已完成且经测试验证的章节，自当前 PLAN 中移除归档于此。
> 前序归档见 `plan_archive.md`、`plan_archive_2.md`。

---

## 第二轮代码修复 ✅ (6/6)

### Fix-1: 识别窗口目标语言下拉框不应包含"自动检测"

**文件**: `src/windows/recognize/index.tsx`
**问题**: `LANGUAGE_CODES` 包含 `'auto'`，截图翻译模式下目标语言 PillSelect 直接遍历 `LANGUAGE_CODES`，导致下拉列表出现"自动检测"。同时源语言选项列表重复添加了 `'auto'`，出现两个"自动检测"。
**修复**: 构建 `lang_options` 时先手动添加 `'auto'`，再从 `LANGUAGE_CODES` 中 filter 掉 `'auto'`；构建 `target_lang_options` 时直接 filter 掉 `'auto'`。

### Fix-2: 识别窗口语言栏未显示实际使用的目标语言

**文件**: `src/windows/recognize/index.tsx`
**问题**: 语言栏始终显示用户配置的 `effectiveTarget`，但第二语言回退时不反映实际翻译目标。
**修复**: 添加 `effectiveTargetLang` 状态，`doTranslate` 中计算实际目标语言后更新；语言栏读取 `effectiveTargetLang ?? effectiveTarget`。新截图到达时重置。

### Fix-3: 识别/截图翻译窗口卡片标题缺少语言名称

**文件**: `src/windows/recognize/index.tsx`
**问题**: 截图翻译模式下卡片标题只显示"文字识别"/"翻译"，缺少语言名。
**修复**: 添加 `detectedSourceLang` 状态跟踪 文字识别到的语言。识别卡标题显示"`{语言名}的文字识别`"，翻译卡标题显示"`{目标语言}的翻译`"。新截图到达时重置。

### Fix-4: 快捷键设置"绑定成功"提示

**文件**: `src/windows/config/hotkey_settings.tsx`
**问题**: 绑定成功后显示 `setStatus('绑定成功')`，该提示留在行内导致布局错位。
**修复**: 绑定成功后 `setStatus('')` 清空。只有冲突和失败才显示提示。

### Fix-5: 快捷键设置一次只能录入一个

**文件**: `src/windows/config/hotkey_settings.tsx`
**问题**: 每个 `HotkeyField` 独立管理 `capturing` 状态。
**修复**: `HotkeySettings` 维护 `activeField` 状态，通过 `activeField` + `onStartCapture` props 传给每个 `HotkeyField`。字段失去焦点时自动退出录入态。

### Fix-6: 窗口宽度按类别记忆

**文件**: `shared/types/config.ts`、`electron/windows/manager.ts`、`electron/windows/dict_options.ts`、`electron/windows/recognize_options.ts`、`src/windows/config/recognize_settings.tsx`
**实现**:
- 翻译和词典共享 `translate_remember_window_size` / `translate_window_width` / `translate_window_height`
- 识别和截图翻译独立 `recognize_remember_window_size` / `recognize_window_width` / `recognize_window_height`
- `WindowManager.createWindow()` 中根据窗口标签自动挂载 resize 持久化
- 新建 `dict_options.ts` 使用翻译窗口配置键；`recognize_options.ts` 使用识别独立配置键
- 所有 DICT_OPTS 硬编码替换为 `get_dict_window_options()` 调用
- 识别设置页添加"记住窗口大小"开关

---

## 第二轮测试加固 ✅ (5/5)

### Test-1: 语言标签具体文字断言
**文件**: `tests/user_e2e/specs/translate_language_area.spec.ts`
- 源语言按钮文字 == "自动检测"（中文 locale），不出现 `auto` / `auto detect`
- 目标语言按钮文字 == "简体中文"，不出现 `zh_cn` / `ZH`
- 翻译后检测标签文字包含 "英文"（或 `native_language_name` 返回值），不出现 `EN` / `en`
- 交换后语言标签文字随之变化

### Test-2: 中文字词查词典
**文件**: `tests/user_e2e/specs/dict_window.spec.ts`
- 查"经济"/"自我"等常用中文词 → 断言 `chinese_dictionary` 卡片出现、`cambridge_dict` / `free_dictionary` 卡片不出现
- 查"hello" → 断言英文词典卡片出现、中文词典卡片不出现
- 验证每个词典卡片 `data-result-key` 的 service key 前缀

### Test-3: 快捷键连续交互
**文件**: `tests/user_e2e/specs/config_settings.spec.ts`
- 点击翻译快捷键的"绑定" → 进入录入态
- 点击词典快捷键的"绑定" → 词典进入录入态，翻译自动退出录入态
- 确认词典录入后 → 绑定成功，无"绑定成功"文字提示

### Test-4: 识别窗口语言栏
**文件**: `tests/user_e2e/specs/recognize_window.spec.ts`
- 截图翻译模式下，目标语言下拉选项**不包含** `auto` / "自动检测"
- 切换目标语言后语言栏文字更新

### Test-5: 服务路由断言
**文件**: `tests/user_e2e/specs/dict_window.spec.ts`
- 查英文词 → 断言 `data-result-key` 前缀为 `cambridge_dict` / `ecdict`，不出现 `chinese_dictionary`
- 查中文词 → 断言 `data-result-key` 前缀为 `chinese_dictionary` / `ecdict`，不出现 `cambridge_dict`

---

## 第三轮测试整改 ✅ (9/9)

### Test-Q1: 建立 mock 使用准则与标签
- `docs/test.md` 增加测试分层规则
- 禁止把 `expect(result.success).toBe(true)` 作为最终断言
- 本地可控 HTTP 服务策略记录在 `docs/test_user_e2e.md`

### Test-Q2: 删除中文词典 DB 的假通过和条件 skip
**文件**: `tests/chinese_dict/build.test.ts`
- 删除所有 `it.skipIf(!db_exists)` 与 `if (!db_exists) return`
- DB 不存在时 `beforeAll` 直接抛出带操作指引的错误
- LICENSE / metadata / words / characters / idioms / FTS / DB size 全部走真实 SQLite 查询

### Test-Q3: 翻译 UI 状态升级为本地可控 HTTP 服务
**文件**: `tests/user_e2e/pages/translate_page.ts`、`translate_result_states.spec.ts`、`translate_window_constraints.spec.ts`、`translate_behavior.spec.ts`
- 新增 `TranslationTestServer` fixture
- loading / retry / 长文本 / debounce / 历史写入全部走真实 service adapter + 本地 HTTP server
- 旧 `fulfill_*_translation_once` 仅保留必要的 stubbed 测试并标注

### Test-Q4: 补真实翻译链路覆盖
**文件**: `tests/user_e2e/specs/translate_core.spec.ts`、`external_services.spec.ts`
- 保留真实 Bing/Google/DeepL/MyMemory/词典服务请求
- `@external` 标记 + retries
- 失败信息暴露具体服务名和返回状态

### Test-Q5: 真实 OCR / 截图识别兜底
**文件**: `recognize_window.spec.ts`、`screenshot_window.spec.ts`、fixtures
- 百度 OCR stub 仅用于"启用/停用 UI 路由"测试
- 新增本地 OCR fixture 图片测试走真实链路
- Tesseract 数据缺失明确失败不静默 skip
- 百度真实 OCR 作为可选 `@external`

### Test-Q6: 真实 Electron 剪贴板与窗口行为 E2E
- Vitest 中 Electron mock 仅覆盖 Node 层逻辑
- E2E 通过 E2E API 写入系统剪贴板验证真实链路
- 托盘/窗口/置顶/焦点/持久化均通过 Playwright 观察真实 BrowserWindow 状态

### Test-Q7: 清理只靠 success 的弱断言
- 全量搜索 `expect(.*success.*).toBe(true)`
- 每个命中点确认后续有强断言（UI 可见文本/窗口状态/持久化/历史记录/剪贴板）
- health/smoke 测试改名说明

### Test-Q8: 标清必须保留的 mock
- Electron API mock / 平台分发 mock / fetch 失败分支 / updater mock / Web Speech fake voice 全部加注释说明保留原因

### Test-Q9: 验收命令与分层执行说明
- 默认验证命令、外部服务验证、词典 DB 前置条件、可选凭据测试条件全部记录在 `docs/test.md` / `docs/test_user_e2e.md`

---

## 第四轮 review.md 覆盖加固 ✅ (10/10)

按 `docs/review.md` 2026-05-21 审查清单完成 10 项。

| 项 | 改动文件 | 说明 |
|---|---|---|
| 词典服务分流强断言 | `dict_window.spec.ts` | 英文/中文 negative assertion；"经济"/"自我"/"佛" 常用词非空结果断言 |
| 平台化快捷键 negative assertion | `tray_layout.spec.ts`、`translate_welcome.spec.ts`、`config_settings.spec.ts` | 不出现 `CommandOrControl` 字面量 |
| 识别/截图翻译切换语言自动重跑 | `recognize_window.spec.ts` | 截图翻译模式切换目标语言后 `ocr-translation` 内容更新 |
| 翻译结果卡片手动折叠保持态 | `translate_result_cards.spec.ts` | 手动折叠 aria-expanded=false；新请求后重置为 true |
| 翻译结果重试只重跑当前实例 | `translate_result_cards.spec.ts` | 两服务一成一败，retry 失败服务后成功服务 request_count=0 |
| 设置通用页 4 项断言 | `config_settings.spec.ts` | API 端口问号按钮 href、无代理控件、文字标签同行、主题三按钮分段 |
| 历史工具栏单行布局 + 置灰联动 | `config_history_backup.spec.ts` | bounding box y 坐标差 <30；disable 后搜索/时间筛选/清空 disabled，re-enable 恢复 |
| 关于页版本号格式 | `about.tsx`（代码修复）、`config_settings.spec.ts` | 版本显示 `version x.y.z · platform-arch` |
| 托盘弹窗文案非空 | `tray_layout.spec.ts` | 首次渲染时逐项断言 innerText.trim() 非空 |
| i18n 缺失 key negative assertion | `i18n.spec.ts` | nb_no 回退下不出现 `welcome.translate` 等原始 key |
| ecdict 源标签 / 备份恢复 app_theme | `dict_window.spec.ts`、`config_history_backup.spec.ts` | 源标签按 spec §32 显示 ECDict；备份默认 app_theme=system，恢复后回到 system |
| 服务实例禁用保留断言 | `config_service_mgmt.spec.ts` | `config.enable=false` 后服务仍在列表和 `translate_service_list` 中，但结果卡片仅展示启用服务 |
