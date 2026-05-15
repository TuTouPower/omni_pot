# omni_pot 开发待办

> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_user_e2e.md` 为准。
> 本文档记录当前阶段和下一步计划，可能滞后于实际代码状态。

---

## 当前阶段

功能与 UI 重写在代码层已基本完成。E2E 测试方向已统一为 Playwright，基础设施已初步落地，后续继续补齐完整用户路径 spec。

---

## 下一步

按优先级排列：

### P0: Playwright E2E 基础设施落地

- [X] 安装 Playwright 依赖（`npm install`）
- [X] 实现 `tests/user_e2e/fixtures/electron_app.ts` — Electron 启动/停止 fixture
- [X] 实现 `tests/user_e2e/fixtures/app_fixture.ts` / `e2e_api.ts` — AppFixture 与 E2E HTTP 封装（基础版）
- [X] 源码侧补齐翻译 / 词典基础用例所需 `data-testid`
- [X] 继续补齐其余窗口 `data-testid`（已覆盖当前 UI 已实现控件；尚不存在的朗读/收藏/服务编辑控件不预埋假选择器）
- [X] 扩充全部 E2E HTTP 端点（`open-window` / `reset-config` / `clipboard` / `window-state` / `trigger-screenshot` / `trigger-input-translate` / `tray-action` / `mock-update`）
- [X] 实现独立 userData 临时目录（环境变量传入 main 进程）
- [X] 删除旧 Vitest + CDP E2E 文件与 legacy 脚本（剩余关键路径由 P1/P2 Playwright spec 继续补齐）

### P1: P0 守护已知 bug 的 spec

- [X] `translate_titlebar.spec.ts` — issues #4 #8（补齐布局顺序、模式标签样式、拖拽/按钮 no-drag 断言）
- [X] `translate_source_area.spec.ts` — issue #5（补齐键盘、IME、朗读、复制/清空、真实翻译断言）
- [X] `translate_language_area.spec.ts` — issues #6 #7（补齐语言选择、检测语言反转与重译断言）
- [X] `translate_core.spec.ts` — issue #3（补齐全部免费翻译服务真实结果用例）

### P1: 核心窗口 spec

- [X] `translate_result_cards.spec.ts`
- [X] `dict_window.spec.ts`
- [X] `recognize_window.spec.ts`
- [X] `config_settings.spec.ts`

### P2: 行为与管理类 spec

- [ ] `translate_behavior.spec.ts`
- [ ] `screenshot_window.spec.ts`
- [ ] `app_lifecycle.spec.ts`
- [ ] `config_service_mgmt.spec.ts`
- [ ] `config_history_backup.spec.ts`
- [ ] `updater_and_tray.spec.ts`
- [ ] `i18n.spec.ts`

### P2: 其他

- [ ] 修复已知 bug — 见 `docs/issues/issues.md`
- [ ] 插件系统（`.potext` 格式，暂时不做）
- [ ] 代码质量检查体系 — 见 `docs/code_quality_checks_plan.md`

---

## 已完成

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
- [X] 文档审阅与清理 — 见 `docs/issues/documentation_review.md`
