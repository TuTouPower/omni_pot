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

- [ ] 全量重审当前 Playwright/Vitest 测试，改掉按当前错误实现补断言的用例
- [ ] 为 `docs/issues/issues.md` 中的开放问题补失败测试或人工验收步骤
- [ ] 先解决规格冲突：欢迎页、OCR/TTS 默认服务（Wayland 默认提示、开发者模式、主题/主色入口、透明背景入口已处理）
- [ ] 修复通用窗口加载转圈、设置/识别窗口尺寸与拖动、下拉框裁剪等窗口基础问题
- [ ] 继续修复快捷键、OCR/TTS、服务管理、i18n 等功能闭环（托盘入口、主题/主色、透明背景已补齐）
- [ ] 完成打包后 Windows smoke 验收：首次启动、托盘、快捷键、截图、设置/识别窗口

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

- [X] 对齐新版 `docs/design/example/` UI 设计 — 以 example 主体原型为最高优先级，核对当前实现、`docs/spec.md` 与 Playwright E2E；已知 example 偏差只记录到 `docs/design/example_todo.md`，不修改 example 文件
- [X] CSP `connect-src` 放开 — 当前 `'self'` 阻止了所有外部翻译 API 请求，需改为允许外部连接
- [X] 命名统一 — 给用户看的显示名用 **Omni Pot**，代码/文件名/package name 一律用 **omni_pot**
- [X] 服务管理未实现功能：服务启停、编辑/测试保存、真实拖拽排序，并同步补规格与用户 E2E
- [ ] 重新修复已知产品缺陷 — 见 `docs/issues/issues.md` 当前开放问题
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
- [X] 文档审阅与清理 — 见 `docs/issues/closed/documentation_review.md`
