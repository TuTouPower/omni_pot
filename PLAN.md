# omni_pot 开发待办

> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_user_e2e.md` 为准。
> 本文档记录当前阶段和下一步计划，可能滞后于实际代码状态。

---

## 当前阶段

功能与 UI 重写已有基础实现，但按 example 和真实用户路径复核后，已重新打开一批产品缺陷与测试缺口。当前重点不是继续声明“已完成”，而是先重审测试，让测试按用户验收标准失败，再按模块修复实现。

---

## 下一步

按优先级排列：

### P0: 已知产品缺陷与测试重审（重新打开）

- [X] 全量重审当前 Playwright/Vitest 测试，改掉按当前错误实现补断言的用例（已重写源文本 TTS 按钮启用断言、收敛 OCR/TTS 默认期望、补 OCR 跨域 mock fetch override；再次审计并改写 daemon / `__initialized` / exact icon px / result-card key order / service key order 等内部实现断言，集成测试改为真实 config store 行为）
- [X] 为 `docs/issues.md` 中的开放问题补失败测试或人工验收步骤（剩余 2 条明确标为 Windows 实机 smoke）
- [X] 先解决规格冲突：欢迎页（决策维持配置窗作首运行入口）、OCR/TTS 默认服务（已补 tesseract / edge_tts 默认）
- [X] 修复通用窗口加载转圈（移除 React.lazy 改直接 import）、设置/识别窗口尺寸与拖动、下拉框裁剪等窗口基础问题
- [X] 继续修复快捷键、OCR/TTS、服务管理、i18n 等功能闭环（托盘入口、主题/主色、透明背景、OCR/TTS 默认均已补齐）
- [ ] 完成打包后 Windows smoke 验收：首次启动、托盘、快捷键、截图、设置/识别窗口（自动化与 `npm run dist` 通过后仍需人工执行真实系统路径）

### P0: 用户验收 issue 守护 spec（2026-05-18 新增，对应 `docs/issues.md` 当前清单）

写完即跑，下面这批 spec 设计为**用户验收标准**，因此在对应缺陷修复前会失败 —— 这是预期行为。按列表逐项修复源码并让 spec 转绿。

- [ ] `tests/user_e2e/specs/translate_result_states.spec.ts` —— 翻译失败重试 + 卡片折叠+加载动效（issues "翻译失败重试功能失效" "翻译结果卡片折叠与加载动效"）。修复目标：错误态新增 `result-retry` 触发重译；初始查询时卡片折叠 + 显示 `result-loading`，结果到达后自动展开。
- [ ] `tests/user_e2e/specs/translate_input_rows.spec.ts` —— 输入框 ≤8 行随内容增长、>8 行内部滚动（issue "输入框动态行数限制"）。修复目标：`source_area.tsx` 用真实可滚动容器替代 `rows={sourceRows}` 单一控制。
- [ ] `tests/user_e2e/specs/translate_window_constraints.spec.ts` —— 翻译窗口 max-height / min-height / min-width 约束（issues "翻译窗口垂直拉伸限制缺失" "翻译窗口最小宽度限制不准确"）。修复目标：在 `electron/windows/translate.ts` 设 setMinimumSize / setMaximumSize，并按内容动态计算 max-height。
- [ ] `tests/user_e2e/specs/translate_pin_topmost.spec.ts` —— 拆分"固定/置顶"为两按钮、补 `titlebar-topmost` testid、固定独立控制失焦关闭（issue "固定与置顶功能拆分与联动"）。修复目标：新增 `translate_pinned` 配置项与按钮，调整失焦关闭判定逻辑。
- [ ] `tests/user_e2e/specs/translate_entry_merge.spec.ts` —— 选中/输入翻译合并入口（issue "翻译功能合并（输入/选中）"）。修复目标：实现 `triggerHotkey('translate', selection?)` 统一 action，并按选中文本存在与否切换分支。
- [ ] `tests/user_e2e/specs/tray_layout.spec.ts` —— 托盘 popover 项目齐全、分隔线、无截断（issue "系统托盘菜单UI缺失与显示不全"）。修复目标：托盘自绘 popover 补 `check_update / view_log / restart / quit` 与 `tray-separator`，调整高度避免裁切，移除多余空白。
- [X] `tests/user_e2e/specs/terminology_settings.spec.ts` —— UI 文案禁用"配置"统一为"设置"（issue "术语统一：配置改为设置"）。修复目标：`src/i18n/locales/*.json` 与 React 组件文本审计；不要求改内部变量名，仅改用户可见字符串与 window title。
- [ ] `tests/user_e2e/specs/dict_issues.spec.ts` —— 中文单字（"我"）查询成功 + 词典 header 卡片不遮挡读音/词性（issues "中文词典查询失败" "词典卡片内容被遮挡"）。修复目标：CC-CEDICT / chinese-dictionary 单字查询路径修复；为 `dict-pronunciation` / `dict-pos-tag` 加 testid，并调整卡片 padding/overflow。
- [ ] `tests/user_e2e/specs/window_rounded_corner.spec.ts` —— 窗口圆角外不应有白色直角（issue "窗口圆角带白色背景瑕疵"）。修复目标：`<html>` / `<body>` 背景透明（与 `transparent: true` 配合），主窗口 React 根组件不设白色背景。
- [ ] 朗读 / TTS "按了没声"（issue "语音朗读（TTS）功能失效"）—— 自动化只能验 IPC 链路，发声本身归为 **Windows 实机 smoke**；在 issue.md 标记并在打包 smoke checklist 中加一条 "翻译/词典/识别窗口点朗读，能听到声音"。
- [ ] 截图 OCR 唤起卡顿（issue "截图 OCR 唤起卡顿"）—— 加 Playwright 计时断言（从 trigger 到 SCREENSHOT 窗口可见 < 300ms），写入新 spec `tests/user_e2e/specs/screenshot_latency.spec.ts`（占位，后续如有性能预算确认再补）。
- [ ] 谷歌翻译失效（issue "谷歌翻译失效"）—— 已被 `translate_core.spec.ts` "all free translation services" 用例覆盖；若该用例本地通过而 release 产物失败，需补一条"跑 `release/Omni Pot 0.1.0.exe` 的 smoke" 作业。

完成上述每条后，在 `docs/issues.md` 删除对应条目（解决后归档到 `docs/archive/closed_issues/`），并同步更新 `docs/design/demo_todo.md` 第 10–15 节中已经跟随实现落地的部分。

### P0: Playwright E2E 基础设施落地（已完成）

- [X] 安装 Playwright 依赖（`npm install`）
- [X] 实现 `tests/user_e2e/fixtures/electron_app.ts` — Electron 启动/停止 fixture
- [X] 实现 `tests/user_e2e/fixtures/app_fixture.ts` / `e2e_api.ts` — AppFixture 与 E2E HTTP 封装（基础版）
- [X] 源码侧补齐翻译 / 词典基础用例所需 `data-testid`
- [X] 继续补齐其余窗口 `data-testid`（已覆盖当前 UI 已实现控件；尚不存在的朗读/收藏/服务编辑控件不预埋假选择器）
- [X] 扩充全部 E2E HTTP 端点（`open-window` / `reset-config` / `clipboard` / `window-state` / `trigger-screenshot` / `trigger-input-translate` / `tray-action` / `mock-update`）
- [X] 实现独立 userData 临时目录（环境变量传入 main 进程）
- [X] 删除旧 Vitest + CDP E2E 文件与 legacy 脚本（剩余关键路径由 P1/P2 Playwright spec 继续补齐）

### P1: 旧已修复问题的回归 spec

- [X] `translate_titlebar.spec.ts` — 旧已修复问题：标题栏布局、模式标签样式、拖拽与按钮 no-drag
- [X] `translate_source_area.spec.ts` — 旧已修复问题：输入区键盘、IME、朗读、复制/清空、真实翻译
- [X] `translate_language_area.spec.ts` — 旧已修复问题：语言选择、检测语言反转与重译
- [X] `translate_core.spec.ts` — 旧已修复问题：全部免费翻译服务真实结果

### P1: 核心窗口 spec

- [X] `translate_result_cards.spec.ts`
- [X] `dict_window.spec.ts`
- [X] `recognize_window.spec.ts`
- [X] `config_settings.spec.ts`

### P2: 行为与管理类 spec

- [X] `translate_behavior.spec.ts`
- [X] `screenshot_window.spec.ts`
- [X] `app_lifecycle.spec.ts`
- [X] `config_service_mgmt.spec.ts`
- [X] `config_history_backup.spec.ts`
- [X] `updater_and_tray.spec.ts`
- [X] `i18n.spec.ts`

### P2: 其他

- [X] 对齐新版 `docs/design/omni_pot/` UI 设计 — 以 omni_pot 主体原型为最高优先级，核对当前实现、`docs/spec.md` 与 Playwright E2E；已知偏差只记录到 `docs/design/demo_todo.md`，不修改设计稿文件
- [X] CSP `connect-src` 放开 — 当前 `'self'` 阻止了所有外部翻译 API 请求，需改为允许外部连接
- [X] 命名统一 — 给用户看的显示名用 **Omni Pot**，代码/文件名/package name 一律用 **omni_pot**
- [X] 服务管理未实现功能：服务启停、编辑/测试保存、真实拖拽排序，并同步补规格与用户 E2E
- [X] 重新修复已知产品缺陷 — 托盘自绘浅色 popover、翻译欢迎态/窗口布局/语言下拉与重译、OCR 截图裁剪/识别窗口尺寸已完成；剩余真实 Windows smoke 与延期项见 `docs/issues.md`
- [X] 本地语言检测替换：cld3-asm WASM 已集成到主进程，IPC bridge 到渲染进程，配置项 `detect_cld3_enabled` 可运行时回退到正则；`npm run dist` 通过
- [X] 接入真实中文字典数据源：mapull/chinese-dictionary JSON → SQLite 构建脚本（320K 词、16K 字、50K 成语），IPC bridge 到渲染进程，FTS5 前缀搜索，配置项 `dict_chinese_enabled`；`npm run dist` 通过
- [X] 插件系统（`.potext` 格式）当前明确延期：本阶段不实现外部插件加载，仅保留内置服务接口
- [X] 代码质量检查体系 — 见 `docs/code_quality_checks_plan.md`

---

## 历史已完成基础工作

> 以下记录表示基础实现或历史修复已完成；最终用户验收覆盖正在上方重新打开的 P0 中复审。

- [X] 全部 UI 重写（翻译/词典/识别/截图/配置/更新器窗口）
- [X] Bing Translate 修复
- [X] 全部 22 个 API 测试完成 — 结果见 `docs/external_services/api_test_results.md`
- [X] MyMemory 翻译服务 — `src/services/mymemory.ts`
- [X] Free Dictionary 词典服务 — `src/services/free_dictionary.ts`
- [X] CC-CEDICT 离线词典 — 替换原 ECDICT，IPC bridge 架构
- [X] 字典模式（独立窗口 + 快捷键 + 服务列表）
- [X] OCR E2E 测试（真实 Tesseract.js + 真实翻译 API）
- [X] 截图覆盖层修复
- [X] 国际化（19 种语言）
- [X] E2E 测试方向统一为 Playwright
- [X] 文档审阅与清理 — 见 `docs/archive/closed_issues/documentation_review.md`
