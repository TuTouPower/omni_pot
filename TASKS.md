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

## 待做 UI / 功能调整

- [x] **删除收藏功能**：收藏功能未实现完整（默认无服务实例，按钮永远禁用），从代码、文档、测试中彻底移除。涉及文件：`shared/types/config.ts`、`shared/types/collection_service.ts`、`src/services/collection/`（三个文件）、`src/services/index.ts`、`src/windows/dict/index.tsx`、`src/windows/translate/target_area.tsx`、`src/windows/config/service_settings.tsx`、`src/i18n/locales/zh_cn.json`、`src/i18n/locales/zh_tw.json`、`tests/user_e2e/pages/dict_page.ts`、`tests/user_e2e/pages/translate_page.ts`、`tests/user_e2e/specs/config_service_mgmt.spec.ts`、`tests/user_e2e/specs/dict_window.spec.ts`、`tests/user_e2e/specs/translate_result_cards.spec.ts`、`tests/unit/config_defaults.test.ts`、`docs/spec.md`、`docs/test.md`、`docs/test_user_e2e.md`、`docs/external_service_catalog.md`。
- [x] **关闭 ECDICT**：暂时不要启用 ECDICT 词典源。
- [x] **中文词典不显示朗读按钮**：中文词典卡片隐藏 TTS/朗读按钮。
- [x] **英文词典保留已有 audio**：英文词典结果中的发音链接不要丢掉。
- [x] **中英文词典 DictResult 规范化**：重新整理 `DictResult` 类型和转换方法，确保中文/英文词典结果结构清晰统一，英文词典不丢失 audio 字段。
- [x] **设置页服务项精简**：服务列表既不要显示小字（如 `google@default`、`cambridge_dict@default`），也不要显示标签 chip（如 `PLATFORM`、`OFFLINE`）。
- [x] **设置页文字识别引擎数据源统一**：设置里的"默认识别引擎"选项与文字识别窗口底部的引擎选项应共用同一个数据源，当前设置页缺少"系统识别"选项，说明数据源是分开的。
- [x] **设置通用去掉文字选项**：设置 → 通用里的"文字"（字体/字号）选项去掉。
- [x] **设置文字识别开关改名**：把"删除换行"改成"自动去除换行"，把"复制"改成"自动复制结果"。
- [x] **设置页"关于"和"日志"样式对齐 demo**：当前实现与设计稿 `docs/design/omni-pot/project/windows/config.jsx`（PageAbout）不一致。
- [x] **服务器 API 测试补全**：`POST /dict` 和 `GET /history` 两个端点缺少 HTTP API 测试（已有 `POST /translate`、`POST /recognize`、`GET /config` 的覆盖）。
- [x] **词典/文字识别窗口固定按钮 bug + 补测试**：主进程 `manager.ts` 的 blur 失焦关闭只检查了 `translate_pinned`，遗漏 `dict_pinned` 和 `recognize_pinned`，导致词典和文字识别窗口点固定后失焦仍然关闭。修 blur 逻辑并为词典、文字识别（含截图翻译）窗口补固定/置顶 e2e 测试（对齐 `translate_pin_topmost.spec.ts` 覆盖范围）。
- [x] **翻译窗口高度自适应与结果区滚动**：翻译窗口高度由主进程按内容高度和当前显示器 75% 工作区上限锁定；宽度仍可由用户拖拽并记忆，最小宽度以 280px 为硬保底并按语言转换区自然宽度实时更新；长结果只滚动结果区，清空源文本同步清空结果并回缩窗口。

---

## 待做 bug 修复（2026-05-24 用户反馈）

- [x] **文字识别 / 截图翻译截屏显示器选择错误**：已改为按鼠标当前所在显示器选择截图源和截图遮罩 bounds；文字识别、截图翻译共用同一 `start_screenshot_capture` 路径，并补充显示器选择单测。
- [x] **词典无选中文本时输入框未自动聚焦**：用户没有选中词汇却打开词典窗口时，自动清空旧词条/结果并聚焦词典输入框，等待用户直接输入查询内容；已补 e2e 回归。
- [x] **词典去掉 ECDICT**：已从服务注册、默认实例、UI tile、词典 e2e 依赖、CC-CEDICT IPC/自动导入/构建/备份路径和当前文档中移除；配置迁移会清理旧用户配置里的 `ecdict@default`。
- [x] **中文词典查找失败**：已验证 `resources/data/dict/chinese_dict.db` 样例词查询正常，并增加旧 ECDICT 配置迁移，确保旧配置恢复为 `chinese_dictionary@default`；词典 e2e 覆盖中文真实查询。
- [x] **Cambridge 词典没有声音**：audioUrl 提取仍命中 Cambridge 当前 HTML；根因是打包 CSP 的 `media-src` 未允许 `https:`，导致远程 mp3 被拦截。已允许 `media-src https:` 并补充 CSP 单测，外部 Cambridge audioUrl 测试通过。
- [x] **Google Translate e2e 测试失败**：`external_services.spec.ts` 已读取 `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY`（含小写）并用 undici `ProxyAgent` 配置 Node fetch；若 Node 测试进程仍网络不可达，仅 skip Google 用例，不影响其他外部服务健康检查。

## 已知环境问题（不修，仅跟踪）

- **谷歌翻译测试环境网络不可达**：`external_services.spec.ts` 已支持代理环境变量；若 Node 测试进程仍不可达，Google 用例会 skip。运行时正常。
- **DeepL free 当前环境限流**：`npm run test:e2e:external` 中长文本和葡语变体用例出现 429；只影响 opt-in 外部服务健康检查，不影响 `@core` / `@ui`。
- **`cld3-asm` 依赖链 moderate audit 提示**：`npm audit --audit-level=high` 通过；npm 给出的 `--force` 修复会引入 breaking change，暂不自动修。
