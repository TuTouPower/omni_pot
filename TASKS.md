# omni_pot 任务清单

> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_user_e2e.md` 为准。
> 已完成项归档见 `docs/archive/plan_archives/`、`docs/archive/closed_issues/`。

---

## 当前状态

- P1–P2、P5–P6 已归档：`docs/archive/plan_archives/plan_archive_4.md`。
- P7–P11 已完成部分已归档：`docs/archive/plan_archives/plan_archive_5.md`。
- 当前清单只保留未完成、待用户授权或需要复测的事项。

---

## P3: 人工 / 打包实机验证

需在 Windows dist 产物中人工确认：

- [ ] **TTS 实机发声**：翻译/词典/识别窗口点击朗读，确认有声音。
- [ ] **dist 打包 smoke**：`npm run dist` 后验证首次启动、托盘、快捷键、截图、设置、识别窗口，并确认 `better-sqlite3` 的 `*.node` 位于 `app.asar.unpacked` 且词典/历史数据库可正常打开。
- [ ] **P7 修复后视觉验证**：确认置顶/固定按钮四窗口一致、图钉竖线可见、去除换行/空格图标与 demo 一致。

---

## P4: 免费翻译 / 词典服务集成（待用户允许后再做）

来源：`docs/archive/external_services/pot_plugin_api_test_results.md`（2026-05-19 测试），分类详见 `docs/external_service_catalog.md` §1.2/§1.3。
**未经用户明确允许，暂不主动开工**。

### 翻译服务（免费无 key，已验证可用）

- [ ] **火山翻译 (Volcengine)** — 最简单，纯 JSON POST，零签名。
- [ ] **腾讯交互翻译 (Transmart)** — 稳定，固定 client_key。
- [ ] **腾讯翻译君 (Tencent WeChat)** — 稳定，GET 请求，模拟微信小程序。
- [ ] **彩云小译 (Caiyun)** — 稳定，内置 token（有失效风险）。
- [ ] **Papago (Naver)** — 多语言，需动态 HMAC token 流程。

### P4 后续测试要求

- [ ] 新增任何免费无需 key 且当前代码存在的外部服务时，同步添加到 `tests/user_e2e/specs/external_services.spec.ts`。
- [ ] 同步更新 `docs/external_service_catalog.md`、`docs/test.md`、`docs/test_user_e2e.md` 中的服务覆盖说明。

---

## P11 后续测试整理

P11 主体已完成并归档；以下是后续仍有效的清理 / 复测项。

- [ ] **外部服务 opt-in 复测**：联网环境重新运行 `npm run test:e2e:external`，确认真实外部服务健康检查是否恢复全绿。
  - 2026-05-23 运行结果：6 passed / 3 failed / 1 skipped。
  - 失败项：Google Translate；DeepL free long single paragraph；DeepL free Portuguese variant（429）。
  - 详情见 `docs/runtime_issues.md` §3。
- [ ] **`i18n.spec.ts` 文案来源审计**：复核所有断言文案是否从 `src/locales/*.json` 单一来源推导，避免硬编码字符串与 locale 文件漂移。
- [ ] **`@core` 标签收敛**：`@core` 只保留最小关键路径（启动 → 翻译窗口可见 → 本地 stub 译文出现 → 关闭），其他 UI 细节迁到 `@ui`。
- [ ] **timeout 标准化**：按 `docs/test_user_e2e.md` §6.2 的分级（UI 5s / 本地 8s / 网络 45s / TTS 60s / OCR 60s）统一 E2E 超时；去外网化后多数 45s+ 网络超时可降到 8–15s。

---

## 已知环境问题（不修，仅跟踪）

- **谷歌翻译当前环境失败**：保留为已知问题，不用 mock 隐藏；需要在网络可达的环境复测，或更换默认免费引擎。
- **DeepL free 当前环境限流**：`npm run test:e2e:external` 中长文本和葡语变体用例出现 429；只影响 opt-in 外部服务健康检查，不影响 `@core` / `@ui`。
- **`cld3-asm` 依赖链 moderate audit 提示**：`npm audit --audit-level=high` 通过；npm 给出的 `--force` 修复会引入 breaking change，暂不自动修。
