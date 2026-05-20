# 测试与 spec.md 对照审查

> 审查日期: 2026-05-20
> 审查范围: `tests/unit/`、`tests/integration/`、`tests/detect/`、`tests/chinese_dict/`、`tests/user_e2e/specs/`
> 对照基准: `docs/spec.md`（v1.0, 2026-05-20）

---

## 翻译窗口

### 1. 输入框行数 — translate_input_rows.spec.ts

- **文件**: `tests/user_e2e/specs/translate_input_rows.spec.ts`
- **问题**: 断言 textarea 始终是 8 行高度，即使只输入 1 行内容
- **spec §5.0**: 文本输入从 1 行起，随内容增长到最多约 8 行，超过后内部滚动

### ~~2. 检测语言标签格式 — translate_language_area.spec.ts~~ ✅ 已修正 spec

- **文件**: `tests/user_e2e/specs/translate_language_area.spec.ts`
- **原判断**: 断言 `'检测为 英文'`（为和英文之间有空格），与 spec 不符
- **结论**: spec 已更新为"检测为 **English**"格式（空格 + 语言自身文字）。测试行为正确。

### 3. 顶部栏按钮顺序 — translate_titlebar.spec.ts

- **文件**: `tests/user_e2e/specs/translate_titlebar.spec.ts`
- **问题**: 顺序为 `[pin, topmost, wordmark, mode, close]`，即 pin（translate_pinned）在 topmost（translate_always_on_top）前面
- **spec §4.3 / §5.1**: 左对齐顺序为**置顶按钮 → 固定按钮 → Omni Pot → 模式标签**，即 always-on-top 在 pinned 前面

### 4. 固定按钮行为矛盾 — translate_pin_topmost.spec.ts

- **文件**: `tests/user_e2e/specs/translate_pin_topmost.spec.ts`
- **问题**: 第 81 行断言点击"固定"后 `alwaysOnTop` 变为 `true`
- **spec §5.1**: 固定按钮只 toggle `translate_pinned`，不改变置顶状态

### 5. 欢迎页快捷键提示数量 — translate_welcome.spec.ts

- **文件**: `tests/user_e2e/specs/translate_welcome.spec.ts`
- **问题**: 只测试了 3 个快捷键提示卡（translate / OCR / screenshot translate），缺少"词典"
- **spec §5.5 / §31**: 4 个提示卡（翻译 / 词典 / 文字识别 / 截图翻译）

### ~~6. "设置快捷键"按钮行为 — translate_welcome.spec.ts~~ ✅ 测试合理

- **文件**: `tests/user_e2e/specs/translate_welcome.spec.ts`
- **原判断**: 断言点击"设置快捷键"后翻译窗口关闭，与 spec 不符
- **结论**: 欢迎页是翻译窗口的空状态，点击"设置快捷键"导航到设置后关闭翻译窗口是合理行为。测试正确。

---

## 托盘与 i18n

### 7. 托盘菜单中文文案 — i18n.spec.ts

- **文件**: `tests/user_e2e/specs/i18n.spec.ts`
- **问题**: 断言中文标签含 `'输入翻译'`、`'OCR 识别'`，缺少 `'词典'`
- **spec §21 / §32**: 中文 UI 禁止出现 "OCR"；4 个功能项为**翻译 / 词典 / 文字识别 / 截图翻译**

### 8. 托盘菜单英文文案 — i18n.spec.ts

- **文件**: `tests/user_e2e/specs/i18n.spec.ts`
- **问题**: 缺少 Dictionary 功能项
- **spec §21**: 英文也应有 Dictionary 对应功能项

### 9. 托盘菜单项列表 — tray_layout.spec.ts

- **文件**: `tests/user_e2e/specs/tray_layout.spec.ts`
- **问题**: `REQUIRED_ACTIONS` 包含 `clipboard_monitor` 作为功能项，缺少词典项
- **spec §21**: 4 个功能项为翻译 / 词典 / 文字识别 / 截图翻译；剪贴板监听是单独的分隔线后复选框

---

## 设置窗口

### 10. 快捷键页面拆分翻译入口 — config_settings.spec.ts

- **文件**: `tests/user_e2e/specs/config_settings.spec.ts`
- **问题**: 使用了 `hotkey_selection_translate` 和 `hotkey_input_translate` 两个独立快捷键条目
- **spec §9.6**: 翻译是**单一入口**，不拆分为"划词翻译"和"输入翻译"

### 11. 关于页版本号格式 — config_settings.spec.ts

- **文件**: `tests/user_e2e/specs/config_settings.spec.ts`
- **问题**: 只断言 `version X.Y.Z`，未验证 platform-arch 后缀；未验证"导出日志"按钮
- **spec §9.10**: 版本号格式为 `version {x.y.z} · {platform-arch}`；必须有"导出日志"按钮

### 12. 配置默认值测试不完整 — test_config_defaults.test.ts

- **文件**: `tests/integration/test_config_defaults.test.ts`
- **问题**: `server_port` 只验证范围 0–65535，未断言默认值 20202；缺少大量配置键的默认值断言（`app_font_size:16`、`clipboard_monitor:false`、`recognize_delete_newline:true` 等）
- **spec §18.2**: 每个配置键都有明确的默认值

---

## 窗口通用行为

### 13. 圆角半径 — window_rounded_corner.spec.ts

- **文件**: `tests/user_e2e/specs/window_rounded_corner.spec.ts`
- **问题**: 断言 `radius > 0`
- **spec §4.3 / §32**: 圆角固定 **10px**

### ~~14. 词典窗口标题栏按钮 — dict_window.spec.ts~~ ✅ 已修正 spec

- **文件**: `tests/user_e2e/specs/dict_window.spec.ts`
- **原判断**: 断言有 `pin` 按钮（translate_pinned 行为），与 spec "只有置顶按钮" 不符
- **结论**: spec 已更新——除设置窗口外，所有窗口均有置顶按钮和固定按钮。测试行为正确。

### 15. 文字识别窗口切换语言 — recognize_window.spec.ts

- **文件**: `tests/user_e2e/specs/recognize_window.spec.ts`
- **问题**: 切换识别语言后只验证下拉更新，未断言 OCR 自动重新执行
- **spec §8.5**: 文字识别模式切换识别语言后必须自动重新识别

### 16. OCR handler 测试缺失 — ocr_handlers.test.ts

- **文件**: `tests/unit/ipc/ocr_handlers.test.ts`
- **问题**: 只测试了语言标签规范化，缺少核心行为测试
- **spec §8.5**:
  - 旧请求 ID 结果被忽略（requestId 机制）
  - `recognize_delete_newline=true` 时文本用 `/-\s+/g → ''` 和 `/\s+/g → ' '` 规范化
  - `recognize_auto_copy=true` 时最终 OCR 文本复制到剪贴板

---

## 统计

| 类别 | 数量 |
|---|---|
| 测试行为与 spec 矛盾 | 8 |
| 测试覆盖缺失 | 4 |
| 测试断言不精确 | 2 |
| 已修正 spec / 测试正确（排除） | 3 |
| **待修复** | **13** |

涉及测试文件：11 个
