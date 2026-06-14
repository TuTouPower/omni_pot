# omni_pot 任务清单

> **权威来源**: 功能定义以 `docs/SPEC.md` 为准，测试设计以 `docs/TEST.md` 为准。
> 已完成项归档见 `docs/archive/plan_archives/`、`docs/archive/closed_issues/`。
> 最近归档：2026-06-13 → `docs/archive/plan_archives/tasks_completed_2026_06_13.md`

---

## 当前状态

- P1–P2、P5–P6 已归档：`docs/archive/plan_archives/plan_archive_4.md`
- P7–P11 已完成部分已归档：`docs/archive/plan_archives/plan_archive_5.md`
- 2026-05-29 核对完成项已归档：`docs/archive/plan_archives/plan_archive_6.md`
- 2026-06-12 批量归档：`docs/archive/plan_archives/tasks_completed_2026_06_12.md`
- 2026-06-13 批量归档：`docs/archive/plan_archives/tasks_completed_2026_06_13.md`（P3 自动化 / P12 / P13 / P14 核心 / P15 / 设计稿对齐 / 热键 A）

---

## P3: 人工 / 打包实机验证（剩余实机项）

自动化部分（dist:smoke / P7 视觉一致性 E2E）已归档。剩余必须在真实 Windows dist 产物上人工确认：

- [ ] **首次启动 smoke**：`npm run dist` 后实机验证首次启动、托盘、快捷键、截图、设置、识别窗口的端到端流程
- [ ] **去除换行/空格图标视觉对比**：与 `docs/design/omni-pot/` demo 对照确认图标一致

---

## P4: 免费翻译 / 词典服务集成（用户已确认不做）

来源：`docs/archive/external_services/pot_plugin_api_test_results.md`（2026-05-19 测试），分类详见 `docs/external_service_catalog.md` §1.2/§1.3。
**2026-06-13 用户确认：保持原状，不集成**。

- [ ] **火山翻译 (Volcengine)** — 最简单，纯 JSON POST，零签名
- [ ] **腾讯交互翻译 (Transmart)** — 稳定，固定 client_key
- [ ] **腾讯翻译君 (Tencent WeChat)** — 稳定，GET 请求，模拟微信小程序
- [ ] **彩云小译 (Caiyun)** — 稳定，内置 token（有失效风险）
- [ ] **Papago (Naver)** — 多语言，需动态 HMAC token 流程

---

## 热键冷启动延迟（`docs/archive/runtime_issues.md` §4）

A 实机已通过，自动化与 timing 日志已就位。B/C 用户已确认不做（详见 2026-06-13 对话）：

- [ ] **B 预热**：预热 translate/dict 窗口。前置（透明度切换不重置 pin/置顶）已完成，但用户权衡内存占用后决定不做
- [ ] **C UIA 软超时（兜底）**：仅当 A+B 后仍有用户报慢时启动；当前无报慢数据，不做

---

## P14: 快捷键弹出窗口性能优化（剩余实机项）

核心 P0 优化与单元/E2E 测试已归档。剩余项需在真键盘上测：

- [ ] **2.2** `show_ms` 日志值 < 100ms 实机断言 — Playwright 无法触发 OS 级 globalShortcut，需打包后实机
- [ ] **4.3** 手动按快捷键观察窗口立即弹出

---

## 设计稿对齐待办（app/frontend）

来源：`docs/design/omni-pot/chats/chat1.md`、`docs/design/omni-pot/project/windows/config.jsx`、`docs/design/omni-pot/project/windows/other.jsx`、`docs/design/omni-pot/project/omni_pot Design.html`。

- [x] **设置窗口整体框架对齐 demo（设置 / 通用等全部子页）**：将当前设置窗口收窄到 demo 比例，减少左侧导航与内容区留白，侧栏宽度、窗口总宽与内边距按 `cfg-general` / `cfg-translate` artboard 对齐（demo 为 `width={720}`、sidebar `132px`、内容区左侧贴边布局；当前 `src/windows/config/index.tsx` 仍是 sidebar `184px` + `width: 100vw`）。验证：启动设置窗口，对照 `docs/design/omni-pot/project/windows/config.jsx` 的 `ConfigWindow` 和 `docs/design/omni-pot/project/omni_pot Design.html` 的 `cfg-general` artboard 做视觉比对，确认导航更窄、内容留白收紧且不再铺满整屏宽度。
- [x] **设置 → 关于 页改为 hero + action tiles 布局**：按 demo 重做关于页，上半区改为左侧产品 hero + 右侧 2 列 action tiles（检查更新 / 官网 / 文档与帮助 / 反馈与联系 / 支持作者 / 开源许可），下半区保留诊断卡片；当前 `src/windows/config/about.tsx` 仍是居中 logo + 一排按钮，缺少 tile 栅格与开源许可入口。验证：打开设置→关于，对照 `docs/design/omni-pot/project/windows/config.jsx` 的 `PageAbout` 与 `cfg-about` artboard，确认 hero、tile 数量/分组、诊断区层级一致。

---

## 设计稿对齐待办（涉及 `docs/design/` 不可修改）

> 已完成项已归档至 `docs/archive/plan_archives/tasks_completed_2026_06_13.md`。剩余项因目标文件在 `docs/design/` 下，仓库策略禁止修改，**永久搁置**。

- [ ] **5.1 shared.jsx 冗余 Titlebar 组件清理** → `docs/design/` 不可修改
- [ ] **5.2 Titlebar 区分仅关闭/三件套** → `docs/design/` 不可修改
- [ ] **6 Tweaks 面板移除 density/fontSize 默认值** → `docs/design/` 不可修改

---

## 已知问题（不修，仅跟踪）

- **CLD3 短文本语言误判**：极短 CJK 文本（如"馄饨"）`is_reliable: true` 但实际误判，regex 能正确识别。涉及检测策略变更，暂不修。
- **DeepL free 当前环境限流**：`test:e2e:external` 长文本/葡语变体 429，不影响 `@core`/`@ui`。
- **`cld3-asm` 依赖链 moderate audit**：`npm audit --audit-level=high` 通过，`--force` 修复会引入 breaking change，暂不自动修。

---

## 归档索引

| 日期 | 归档文件 | 涵盖 |
|---|---|---|
| 历史 | `plan_archive_4.md` | P1–P2、P5–P6 |
| 历史 | `plan_archive_5.md` | P7–P11 已完成部分 |
| 2026-05-29 | `plan_archive_6.md` | 核对完成项 |
| 2026-06-12 | `tasks_completed_2026_06_12.md` | E2E 修复 / UI / bug / 审阅 / 拆分 |
| 2026-06-13 | `tasks_completed_2026_06_13.md` | P3 自动化 / P12 / P13 / P14 核心 / P15 / 设计稿对齐 / 热键 A / icons.test lint |
