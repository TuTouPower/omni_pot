# TASKS.md 归档 — 2026-05-23

> 以下为 `TASKS.md` 在 2026-05-23 已完成的阶段性事项，自当前 TASKS 中移除归档于此。
> 前序归档见 `plan_archive.md`、`plan_archive_2.md`、`plan_archive_3.md`、`plan_archive_4.md`。

---

## P7: 用户反馈问题修复 ✅

2026-05-22 用户反馈 13 个问题已按 spec / test / code 三方对照完成修复。

完成范围：

- P7.0 测试必须从 spec 推导：`docs/test.md` 新增测试编写原则，titlebar 顺序断言完成审计。
- P7.1 spec 补充：剪贴板监听默认值、TTS 音量平台限制、透明背景即时生效。
- P7.2 代码修复：文字识别/词典窗口固定按钮、翻译快捷键说明、截图翻译结果卡片、词典服务顺序。
- P7.3 UI 文案/视觉对齐：置顶图标、去除空格/换行图标、文字识别标签、截图翻译样式。
- P7.4 spec 补充后的代码修复：剪贴板监听、透明背景重建、TTS 限制记录。
- P7.5 窗口宽度持久化：翻译/识别窗口尺寸记忆默认开启并补测试。

---

## P8: 测试覆盖补全已完成部分 ✅

完成范围：

- `external_services.spec.ts` 覆盖当前已存在的免费无需 key 外部服务：Bing、Google、DeepL free、MyMemory、Cambridge Dictionary、Free Dictionary。
- 本地服务覆盖：ECDICT、Chinese Dictionary、Tesseract OCR、System TTS。
- 翻译窗口与文字识别窗口已覆盖去除空格 / 去除换行按钮的精确行为。

未归档事项：P4 后新增免费服务时同步补 `external_services.spec.ts`，仍保留在当前 `TASKS.md`。

---

## P9: System OCR 跨平台适配 ✅

完成范围：

- macOS System OCR：新增 `scripts/macos_ocr.swift`，主进程通过 Swift CLI 调用 Vision 框架。
- 平台条件化可见性：Windows / macOS 注册 System OCR，Linux 跳过。
- 默认 OCR 服务列表更新为 `['tesseract@default', 'system@default', 'qrcode@default']`。
- 移除旧 Linux System OCR 路径，Linux 使用 Tesseract。
- `docs/spec.md` 与 `docs/external_service_catalog.md` 已同步平台限制。

---

## P10: 日志系统补全 ✅

完成范围：

- 渲染进程通过 `log:write` IPC 写入 `main.log`，scope 前缀为 `renderer:`。
- 翻译、词典、识别、TTS 关键路径已记录请求摘要、语言、服务数量、耗时和失败详情。
- 服务 catch 块不再吞掉错误信息。
- 配置变更记录 key，并依赖 electron-log redact hook 脱敏。
- 主进程补充快捷键触发与剪贴板监听触发日志。

---

## P11: 测试外部服务隔离重构已完成部分 ✅

完成范围：

- 文档同步：`docs/test.md`、`docs/test_user_e2e.md`、`CLAUDE.md` 明确外部服务 stub 边界。
- `external_services.spec.ts` 成为唯一真实公网服务健康检查入口，通过 `OMNI_POT_EXTERNAL_SERVICE_TESTS=1` opt-in。
- `@core` / `@ui` E2E 去外网化，改用 `TranslationTestServer`、init script fetch override、Playwright route 或真实本地能力。
- 扩展 `TranslationTestServer` 支持多 instance 响应。
- 新增 `tests/user_e2e/fixtures/stub_payloads.ts`，集中维护 Free Dictionary / Baidu OCR 等 stub payload。
- 新增 `npm run test:e2e:external`，并在 Playwright 中新增 `external` project。
- 重命名 `external_http_api.spec.ts` 为 `app_http_api.spec.ts`。
- 合并并删除重复 / 过细 spec：`dict_issues.spec.ts`、`screenshot_latency.spec.ts`、`tray_layout.spec.ts`。
- 非 E2E 测试目录收敛为 `tests/unit/` 与 `tests/integration/`：
  - `tests/unit/detect.test.ts`
  - `tests/unit/config_defaults.test.ts`
  - `tests/integration/config_store.test.ts`
  - `tests/integration/chinese_dict_build.test.ts`
- deadcode 清理：移除未使用的 `@heroui/react`，修正 Knip 配置。

验证记录：

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm run format:check` 通过。
- `npm run deadcode` 通过。
- `npm run security` 通过 high 阈值；仍有 `cld3-asm` 依赖链上的 moderate audit 提示，未使用 breaking `--force` 修复。
- `npm test` 通过：17 files / 117 tests。
- `npm run test:e2e:core` 通过。
- `npm run test:e2e:ui` 通过。
- `npm run test:e2e:external` 已执行但现网未全绿：6 passed / 3 failed / 1 skipped，详见 `docs/runtime_issues.md` §3。

未归档事项：真实外部服务现网失败复测、`i18n.spec.ts` 文案来源审计、`@core` 标签收敛、timeout 标准化，仍保留在当前 `TASKS.md`。
