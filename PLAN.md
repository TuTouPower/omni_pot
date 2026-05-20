# omni_pot 开发待办

> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_user_e2e.md` 为准。
> 本文档综合了 `docs/frontend_spec_gap_analysis.md`、`docs/design/demo_vs_implementation_diff.md`、`docs/issues.md` 的待办项。
> 已完成项归档见 `docs/archive/plan_archive.md`、`docs/archive/plan_archive_2.md`。

---

## 当前阶段

2026-05-20 用户验收发现大量 UI/体验问题。核心矛盾：**测试只验证了"链路通"，没有验证"体验对"**。
第一轮 P0-P2 代码修复已完成并归档（`docs/archive/plan_archive_2.md`）。第二轮修复（本文件）解决 issues.md 剩余问题，同时加固测试断言。

**第二轮状态**: 代码修复 ✅ (6/6) · 测试加固 ✅ (5/5) · 人工验证待做

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
