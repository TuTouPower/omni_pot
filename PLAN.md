# omni_pot 开发待办

> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_user_e2e.md` 为准。
> 本文档记录当前阶段和下一步计划，可能滞后于实际代码状态。

---

## 当前阶段

功能与 UI 重写在代码层已基本完成。E2E 测试方向已统一为 Playwright，基础设施待落地。

---

## 下一步

按优先级排列：

### P0: Playwright E2E 基础设施落地

- [ ] 安装 Playwright 依赖（`npm install`）
- [ ] 实现 `tests/user_e2e/fixtures/electron_app.ts` — Electron 启动/停止 fixture
- [ ] 实现 `tests/user_e2e/fixtures/app_fixture.ts` — AppFixture（多窗口 Page Object 封装）
- [ ] 源码侧补齐 `data-testid`（见 `docs/test_user_e2e.md` 4.5 节清单）
- [ ] 扩充 E2E HTTP 端点（见 `docs/test_user_e2e.md` 4.5 节表格）
- [ ] 实现独立 userData 临时目录（环境变量传入 main 进程）
- [ ] 迁移旧 Vitest + CDP E2E（`tests/user_e2e/01_all_critical_paths.test.ts`）至 Playwright 或删除

### P1: P0 守护已知 bug 的 spec

- [ ] `translate_titlebar.spec.ts` — issues #4 #8
- [ ] `translate_source_area.spec.ts` — issue #5
- [ ] `translate_language_area.spec.ts` — issues #6 #7
- [ ] `translate_core.spec.ts` — issue #3（全部免费翻译服务）

### P1: 核心窗口 spec

- [ ] `translate_result_cards.spec.ts`
- [ ] `dict_window.spec.ts`
- [ ] `recognize_window.spec.ts`
- [ ] `config_settings.spec.ts`

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
- [ ] 插件系统（`.potext` 格式）
- [ ] 代码质量检查体系 — 见 `docs/code_quality_checks_plan.md`

---

## 已完成

- [x] 全部 UI 重写（翻译/词典/识别/截图/配置/更新器窗口）
- [x] Bing Translate 修复
- [x] 全部 22 个 API 测试完成 — 结果见 `docs/external_services/api_test_results.md`
- [x] MyMemory 翻译服务 — `src/services/mymemory.ts`
- [x] Free Dictionary 词典服务 — `src/services/free_dictionary.ts`
- [x] CC-CEDICT 离线词典 — 替换原 ECDICT，IPC bridge 架构
- [x] 字典模式（独立窗口 + 快捷键 + 服务列表）
- [x] OCR E2E 测试（真实 Tesseract.js + 真实翻译 API）
- [x] 截图覆盖层修复
- [x] 国际化（19 种语言）
- [x] E2E 测试方向统一为 Playwright
- [x] 文档审阅与清理 — 见 `docs/issues/documentation_review.md`
