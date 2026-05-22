# omni_pot 任务清单

> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_user_e2e.md` 为准。
> 已完成项归档见 `docs/archive/plan_archives/`、`docs/archive/closed_issues/`。

---

## 当前状态

- P1–P2、P5–P6 全部完成 ✅，归档见 `docs/archive/plan_archives/plan_archive_4.md`。
- 2026-05-22 用户反馈 13 个问题（`docs/issues.md`），经 spec/test/code 三方对照分析，定位根因如下。

---

## P7: 用户反馈问题修复（2026-05-22）

### 诊断结论

| 根因类型 | 含义 | 涉及 issues |
|---|---|---|
| `TEST_WRONG` | 测试断言了错误行为，锁定了 bug | #4, #12 |
| `CODE_WRONG` | spec 清楚但代码写错 | #8, #10, #13 |
| `TEST_MISSING` | 功能对但 UI 文案/视觉/格式无断言 | #1, #3, #5, #11 |
| `TEST_WEAK` | 有测试但只覆盖 happy path | #6 |
| `SPEC_UNCLEAR` | spec 未定义或需更新 | #2, #7, #9 |

### P7.0 系统性改进：测试必须从 spec 推导

在修复具体 issue 之前，先建立规则防止同类问题再发生：

- [ ] 在 `docs/test.md` 中新增"测试编写原则"章节：测试期望值必须从 spec/demo 推导，禁止从代码输出反推
- [ ] 审计现有测试中 titlebar 顺序断言，确认全部与 spec §4.3 一致

### P7.1 Spec 补充（先定义再修代码）

以下 3 个 issue 需要先更新 spec，再写代码和测试：

- [ ] **Issue #2 剪贴板监听默认值** — spec §18.2 `clipboard_monitor` 默认值 `false` → `true`；补充"关闭时不得监听"的显式约束
- [ ] **Issue #7 TTS 音量** — spec §15 补充音量要求（Web Speech API volume=1 已是上限，需评估 AudioContext gain 方案或接受现状）
- [ ] **Issue #9 透明背景即时生效** — spec §9.11 补充"config 变更必须即时应用到已打开窗口，需要重建 BrowserWindow 的配置项（如 transparent）应自动重建"

### P7.2 代码修复：spec 清楚、代码错误

#### Issue #4 + #12: 文字识别/词典窗口缺少固定按钮（TEST_WRONG + CODE_WRONG）

spec §4.3 明确要求所有非设置窗口有置顶+固定两个按钮。

- [ ] `src/windows/recognize/index.tsx` — 添加独立的 topmost 按钮（`data-testid="titlebar-topmost"`），现有 pin 按钮改为固定按钮
- [ ] `src/windows/dict/index.tsx` — 同上，添加 topmost 按钮，pin 改为固定按钮，图标大小/样式与翻译窗口对齐
- [ ] 修正测试 `recognize_window.spec.ts` — titlebar 顺序改为 `['topmost', 'pin', 'wordmark', 'mode', 'close']`
- [ ] 修正测试 `dict_window.spec.ts` — titlebar 顺序改为 `['topmost', 'pin', 'wordmark', 'mode', 'close']`

#### Issue #8: 翻译快捷键说明文本（CODE_WRONG）

spec §9.6 明确定义描述文本为："选中文本时翻译该文本；未选中时弹出空翻译窗口；剪贴板监听开启时自动翻译剪贴板新文本"

- [ ] `src/windows/config/hotkey_settings.tsx` — 修正 `sub=` 文案为 spec 定义的文本
- [ ] 补测试断言快捷键描述文本与 spec 一致

#### Issue #10: 截图翻译结果卡片内容为空（CODE_WRONG）

spec §8.5 明确要求截图翻译 = 识别 + 自动翻译。

- [ ] `src/windows/recognize/index.tsx` — `onRecognizeShow` 收到 `mode='translate'` 且 `text` 非空时，自动触发 `doTranslate()`
- [ ] 补测试：截图翻译入口打开后，翻译卡片必须有内容（不为空）

#### Issue #13: 词典搜索结果不按服务顺序（CODE_WRONG）

spec §6 明确要求按输入语言路由到对应词典列表，渲染顺序 = 配置顺序。

- [ ] `src/windows/dict/index.tsx` — 渲染列表从 `enabledServiceList`（中英并集）改为 `activeList`（当前语言的服务列表）
- [ ] 修正测试 `dict_window.spec.ts` — 断言渲染的卡片顺序严格等于当前语言的配置服务顺序，不出现非当前语言的服务卡片

### P7.3 UI 文案/视觉对齐（TEST_MISSING）

#### Issue #1: 置顶按钮竖线填充时消失

- [ ] `src/components/icons.tsx` Pin 图标 — 激活时竖线 stroke 改为 `currentColor`（与填充头部同色），不用 `var(--bg)`
- [ ] 补测试：pin 激活时 SVG 第二个 path 的 stroke 不等于 `var(--bg)`

#### Issue #3: 去除空格/换行图标与 demo 不一致

- [ ] 对照 `docs/design/omni-pot/` 设计稿，重绘 `Icons.Newline` 和 `Icons.Space` 的 SVG path
- [ ] 补测试：断言图标 SVG path 的 `d` 属性与设计稿一致（或截图对比）

#### Issue #5: 文字识别标签格式错误

demo 格式：`识别 简体中文` / `翻译 简体中文`。当前代码：`简体中文的文字识别`。

- [ ] `src/windows/recognize/index.tsx` — 卡片标签改为 `${t('recognize.title')} ${native_language_name(...)}`（动作在前，语言在后）
- [ ] 补测试：断言识别卡片标签匹配 `/^识别 .+/`，翻译卡片标签匹配 `/^翻译 .+/`

#### Issue #11: 截图翻译与文字识别+翻译样式不一致

spec 明确要求两个入口共用同一窗口布局。

- [ ] 确认 Issue #10 修复后两条路径最终状态一致（同一组件、同一 mode、同一数据）
- [ ] 补测试：分别从截图翻译入口和文字识别→点翻译入口进入，断言 DOM 结构/卡片数量/标签一致

### P7.4 Spec 补充后的代码修复

#### Issue #2: 剪贴板监听行为

待 P7.1 spec 更新后：

- [ ] `shared/types/config.ts` — `clipboard_monitor` 默认值改 `true`
- [ ] 补测试：托盘关闭剪贴板监听后，剪贴板变化不触发翻译
- [ ] 更新 `tests/integration/test_config_defaults.test.ts` 默认值断言

#### Issue #9: 透明背景即时生效

待 P7.1 spec 更新后：

- [ ] `electron/windows/manager.ts` — 监听 `config:changed` 中 `transparent` 变化，关闭并重建已打开的窗口（Electron 不支持运行时改 transparent）
- [ ] 修正测试 `config_settings.spec.ts` — 断言切换透明后已打开窗口立即变为透明（无需手动重开）

#### Issue #7: TTS 音量

待 P7.1 spec 评估后：

- [ ] 如果决定用 AudioContext gain：重写 `src/services/tts/system_tts.ts`，通过 MediaStreamDestination + GainNode 放大
- [ ] 如果 Web Speech API 限制无法突破：在 spec 中标注为已知限制，关闭此 issue

### P7.5 窗口宽度持久化（Issue #6）

spec 已定义条件性持久化（`translate_remember_window_size=true` 时生效）。用户反馈可能是该设置未开启，或某些窗口创建路径未挂载 resize listener。

- [ ] 确认所有窗口创建路径（托盘/快捷键/API）都经过 `WindowManager.createWindow()` 的 resize persistence 逻辑
- [ ] 补测试：通过不同入口（托盘、快捷键、API）创建窗口后 resize，验证宽度都能持久化
- [ ] 如果用户期望"始终记住"而非条件性，则更新 spec 将 `translate_remember_window_size` 默认值改为 `true`

---

## P3: 人工 / 打包实机验证

需在 Windows dist 产物中人工确认：

- [ ] **TTS 实机发声**：翻译/词典/识别窗口点击朗读，确认有声音
- [ ] **dist 打包 smoke**：`npm run dist` 后验证首次启动、托盘、快捷键、截图、设置、识别窗口，并确认 `better-sqlite3` 的 `*.node` 位于 `app.asar.unpacked` 且词典/历史数据库可正常打开
- [ ] **P7 修复后视觉验证**：确认置顶/固定按钮四窗口一致、图钉竖线可见、去除换行/空格图标与 demo 一致

---

## P4: 免费翻译 / 词典服务集成（待用户允许后再做）

来源：`docs/archive/external_services/pot_plugin_api_test_results.md`（2026-05-19 测试），分类详见 `docs/external_service_catalog.md` §1.2/§1.3。
**未经用户明确允许，暂不主动开工**。

### 翻译服务（免费无 key，已验证可用）

- [ ] **火山翻译 (Volcengine)** — 最简单，纯 JSON POST，零签名
- [ ] **腾讯交互翻译 (Transmart)** — 稳定，固定 client_key
- [ ] **腾讯翻译君 (Tencent WeChat)** — 稳定，GET 请求，模拟微信小程序
- [ ] **彩云小译 (Caiyun)** — 稳定，内置 token（有失效风险）
- [ ] **Papago (Naver)** — 多语言，需动态 HMAC token 流程

### 词典服务（免费无 key，已验证可用）

- [ ] **Free Dictionary API** — 英文词义/音标/例句
- [ ] **Tatoeba 例句查询** — 多语言例句搜索引擎

---

## 已知环境问题（不修，仅跟踪）

- **谷歌翻译当前环境失败**：保留为已知问题，不用 mock 隐藏；需要在网络可达的环境复测，或更换默认免费引擎。
