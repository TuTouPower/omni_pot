# omni_pot 任务清单

> **权威来源**: 功能定义以 `docs/SPEC.md` 为准，测试设计以 `docs/test_e2e.md` 为准。
> 已完成项归档见 `docs/archive/plan_archives/`、`docs/archive/closed_issues/`。
> 最近归档：2026-06-12 → `docs/archive/plan_archives/tasks_completed_2026_06_12.md`

---

## 当前状态

- P1–P2、P5–P6 已归档：`docs/archive/plan_archives/plan_archive_4.md`
- P7–P11 已完成部分已归档：`docs/archive/plan_archives/plan_archive_5.md`
- 2026-05-29 核对完成项已归档：`docs/archive/plan_archives/plan_archive_6.md`
- 2026-06-12 批量归档：`docs/archive/plan_archives/tasks_completed_2026_06_12.md`

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

- [ ] **火山翻译 (Volcengine)** — 最简单，纯 JSON POST，零签名
- [ ] **腾讯交互翻译 (Transmart)** — 稳定，固定 client_key
- [ ] **腾讯翻译君 (Tencent WeChat)** — 稳定，GET 请求，模拟微信小程序
- [ ] **彩云小译 (Caiyun)** — 稳定，内置 token（有失效风险）
- [ ] **Papago (Naver)** — 多语言，需动态 HMAC token 流程

---

## 热键冷启动延迟（`docs/archive/runtime_issues.md` §4）

> A 解耦、timing 日志、E2E 断言已完成。以下为待手测或按需启动项。

- [ ] **复杂焦点应用手测**：在 VS Code、Word、Excel、Chromium 上手动触发翻译/词典/截图翻译热键，记录 `show_ms` / `total_ms`。验收：window visible < 200ms、文本到达 < 1.5s
- [ ] **B 预热（A 验证后再评估）**：预热 translate/dict 窗口，需先完成透明度切换不重置 pin/置顶
- [ ] **C UIA 软超时（兜底，按需）**：仅当 A+B 后仍有用户报慢时启动

---

## 设计稿对齐待办

> 来自 `docs/demo_todo.md`，2026-06-12 拆分。已完成项见 `docs/archive/closed_issues/demo_todo_completed.md`。

- [x] **1.3 快捷键展示格式改为缩写**：统一 `Ctrl + Alt + T`（Win）/ `Cmd + Alt + T`（Mac）→ `format_hotkey.ts` 已正确实现
- [x] **1.4 托盘菜单移除非功能项快捷键**：仅翻译/词典/文字识别/截图翻译 4 项显示 → `shortcuts` 对象仅含 4 个功能键
- [x] **2.1 Chinese Dictionary 朗读按钮**：中文词典卡片隐藏朗读按钮（POS tag 已隐藏）→ 新增 `hideTts` prop (0532617)
- [x] **2.3 词典窗口默认宽度**：快捷键 400×500，HTTP 350×420 → `get_dict_window_options(source)` (ce23138)
- [x] **3.2 服务列表示例数据精简**：翻译只保留 bing/google/deepl/mymemory；中文词典 cc-cedict；英文词典 cambridge_dict/cc-cedict → DEFAULT_CONFIG 已更新 (db9ed3d)
- [x] **3.3 服务实例列表不显示 key 和标签**：移除实例 key 副文本和 PLATFORM/OFFLINE chip → `service_item_row.tsx` 已无 chip
- [x] **3.6 关于页路径动态获取**：通过 IPC 获取实际 userData 路径 → `about.tsx` 已用 IPC
- [x] **3.7 备份内容说明移除 CC-CEDICT**：改为"备份内容：设置、历史记录数据库" → `backup_settings.tsx` 已正确
- [x] **4.1 复制按钮文案改为"复制识别文本"**：当前 `t('copy')` = "复制" → 已改为 `recognize.copy_recognized_text` (8f2361e)
- [ ] **5.1 shared.jsx 冗余 Titlebar 组件清理** → 目标文件在 `docs/design/`，不可修改
- [ ] **5.2 Titlebar 区分仅关闭/三件套** → 目标文件在 `docs/design/`，不可修改
- [x] **5.3 图标按钮激活态视觉修正** → Pin 图标激活时内部线条反色 (13acab8)
- [ ] **6 Tweaks 面板移除 density/fontSize 默认值** → 目标文件在 `docs/design/`，不可修改

---

## 已知问题（不修，仅跟踪）

- **CLD3 短文本语言误判**：极短 CJK 文本（如"馄饨"）`is_reliable: true` 但实际误判，regex 能正确识别。涉及检测策略变更，暂不修。
- **DeepL free 当前环境限流**：`test:e2e:external` 长文本/葡语变体 429，不影响 `@core`/`@ui`。
- **`cld3-asm` 依赖链 moderate audit**：`npm audit --audit-level=high` 通过，`--force` 修复会引入 breaking change，暂不自动修。
