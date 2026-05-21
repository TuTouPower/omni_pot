# omni_pot 任务清单

> 合并自原 `PLAN.md`、`docs/review.md`、`docs/issues.md`。
> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_user_e2e.md` 为准。
> 已完成项归档见 `docs/archive/plan_archives/`、`docs/archive/closed_issues/`。

---

## 当前状态

- 第二轮代码修复 ✅ (6/6)、第二轮测试加固 ✅ (5/5)、第三轮测试整改 ✅ (9/9)、第四轮 review 覆盖加固 ✅ (10/10)。详见 `docs/archive/plan_archives/plan_archive_3.md`。
- 文档结构整理 ✅（2026-05-21）：`docs/external_services/` 全部历史研究归档到 `docs/archive/external_services/`（目录已移除）；`docs/archive/` 按 `handoffs/` / `reviews/` / `plan_archives/` 子目录组织。

---

## P1: 语言检测重构（cld3-asm 替换远程 API 回退链）

> 测试报告：`docs/archive/external_services/lang_detect_api_test_20260521.md`。
> 结论：5 个远程检测 API（Bing/Google/Baidu/Tencent/NiuTrans）在当前环境全部不可用；
> cld3-asm 15 种语言 30/30 全部正确，体积 6.3MB，初始化 7ms，速度最快。
> spec §17 / §5.4 的"回退链 + 中文不误判日语"要求改由 cld3-asm 单一引擎满足，远程回退链整体移除。

### 范围

- **安装 cld3-asm**：`npm install cld3-asm`，加入 dependencies
- **重写 `src/services/detect.ts`**：
  - 移除 `bing_detect`、`google_detect`、`baidu_detect`、`tencent_detect`、`niutrans_detect` 五个远程检测函数
  - 移除 `fetch_with_timeout`、`DETECT_REQUEST_TIMEOUT_MS`、`DETECT_FALLBACK_ORDER`
  - 移除所有 `*_LANG_MAP`（BING_LANG_MAP、GOOGLE_LANG_MAP、BAIDU_DETECT_LANG_MAP 等）
  - 移除 `RemoteDetectEngine` 类型、`DetectFallback` 类型、`detect_engine_order` 函数
  - 新增 `detect_cld3()`：使用 cld3-asm WASM 检测，返回 BCP-47 代码，映射到项目 `LanguageCode`
  - 新增 BCP-47 → 项目语言码映射表（复用 cld3 测试中验证的映射）
  - `detectLanguage(text, engine?)` 简化为：cld3 为主，regex 兜底（cld3 加载失败时）
  - engine 参数保留但仅支持 `'local'`（cld3+regex）一种模式，或考虑移除 engine 参数
- **重写 `electron/detect/index.ts`**：
  - IPC `detect.local` 的 regex 实现改为调用 cld3
  - 保留 regex 作为 cld3 WASM 加载失败的最终兜底
- **更新测试**：
  - 重写 `tests/unit/services/test_detect.test.ts`：移除远程引擎 mock 测试，新增 cld3 检测测试
  - 补 E2E："我爱你×N → 检测为中文"断言、检测引擎=目标语言时回退 `translate_second_language` 的强断言
- **更新文档**：
  - `docs/spec.md` §17：移除远程 API 回退链描述，改为 cld3 本地检测
  - `docs/external_service_catalog.md` §1.1：语言检测部分更新为 cld3-asm
  - `docs/external_services/lang_detect_api_test_20260521.md`：标记 cld3-asm 已采纳（注：该文件已归档到 `docs/archive/external_services/`）

### cld3-asm API 备忘

```ts
import { loadModule } from 'cld3-asm'
const factory = await loadModule()
const instance = factory.create(0)
const result = instance.findLanguage('你好世界')
// { language: 'zh', probability: 0.9999, is_reliable: true, proportion: 1, byte_ranges: [] }
```

- BCP-47 代码映射：`zh` → `zh_cn`、`pt` → `pt_pt`、`no` → `nb_no`、`zh-Hant` → `zh_tw` 等
- v4 API：返回 `is_reliable`（小写下划线），无 `.delete()` / `.destroy()` 方法

### 任务清单

- [ ] 安装 cld3-asm，加入 package.json dependencies
- [ ] 重写 src/services/detect.ts（移除远程 API，新增 cld3，保留 regex 兜底）
- [ ] 重写 electron/detect/index.ts（IPC 层改用 cld3）
- [ ] 重写 tests/unit/services/test_detect.test.ts
- [ ] 补 E2E："我爱你"中文断言、检测引擎=目标语言回退断言
- [ ] 更新 docs/spec.md §17
- [ ] 更新 docs/external_service_catalog.md §1.1
- [ ] 更新 docs/archive/external_services/lang_detect_api_test_20260521.md（标记已采纳）

---

## P1.2: 文字识别"自动去除换行"默认关闭

设置页 → 文字识别设置里的"自动去除换行"选项，当前默认开启，改为默认关闭。
当前无用户，无需迁移本地配置。

- [ ] 定位设置项默认值（推测在 `electron/config/` 或 `src/services/ocr/` 配置 schema）
- [ ] 改默认值为 `false`
- [ ] 更新 `docs/spec.md` 文字识别设置默认值描述
- [ ] 更新 `docs/design/omni-pot/` 相关设计稿（如有标注默认值）
- [ ] 单元/E2E 测试断言新默认值

---

## P2: 单元 / 集成层薄弱项

来源 `docs/review.md` §P2。

| 项 | spec 章节 | 现状 |
|---|---|---|
| HTTP API 端点 `POST /translate`、`GET /config`、`/recognize` stub 行为 | §20 | `tests/user_e2e/specs/external_http_api.spec.ts` 覆盖外部 HTTP 集成边界 |
| 选中文本 fallback 链（UIA → Ctrl+C → sentinel → restore） | §24 | `tests/unit/selection/windows.test.ts` 覆盖 UIA 不可用 → Ctrl+C 剪贴板回退，`tests/unit/selection/clipboard.test.ts` 覆盖 sentinel → restore；真实 OS 级 UIA/Ctrl+C E2E 需人工/实机验证 |
| CSP 策略（`connect-src` https、`media-src blob:`、`worker-src blob:`、WASM 执行） | §3.4 | `tests/unit/csp_policy.test.ts` 覆盖 packaged / development CSP 指令 |
| better-sqlite3 native rebuild + 打包 unpacked（issue #1） | §29 | `tests/unit/packaging/native_modules.test.ts` 静态覆盖 `better-sqlite3` 依赖、`electron-builder install-app-deps`、`npmRebuild=true`、`asarUnpack: **/*.node` 与 `run_dist.mjs` electron-builder 路径；真实 `app.asar.unpacked` 产物仍需 dist smoke 人工/实机确认 |
| 翻译历史按**实例 key** 存 `service_key`（同服务多实例） | §25 | `config_history_backup.spec.ts` 覆盖同服务多实例历史 `service_key` |
| 服务实例 `config.enable=false` 时**保留在列表中但不参与执行** | §12.3 | `config_service_mgmt.spec.ts` 覆盖启停后保留在服务列表、配置列表不变、结果卡片仅展示启用服务 |
| 剪贴板抑制窗口（划词翻译 Ctrl+C 回退期间不误触发监听） | §23 | `tests/unit/selection/windows.test.ts` 覆盖 Windows UIA 不可用时传入抑制包装，`tests/unit/selection/clipboard.test.ts` 覆盖 Ctrl+C fallback sentinel/restore 期间剪贴板监听不触发；真实 OS 级 Ctrl+C/剪贴板 E2E 不自动化，避免污染用户剪贴板和焦点 |

- [x] HTTP API 端点集成测试
- [x] 选中文本 fallback 链单元/集成覆盖（真实 OS 级 UIA/Ctrl+C E2E 不自动化，避免影响用户剪贴板和焦点）
- [x] CSP 策略验证
- [x] better-sqlite3 native rebuild 静态自动化（完整打包产物仍需 dist smoke 人工/实机验证）
- [x] 翻译历史实例 key 专门断言
- [x] 服务实例 enable=false 保留列表断言
- [x] 剪贴板抑制窗口单元/集成覆盖（真实 OS 级 Ctrl+C/剪贴板 E2E 不自动化，避免影响用户剪贴板和焦点）

---

## P3: 人工 / 打包实机验证

需在 Windows dist 产物中人工确认：

- [ ] **TTS 实机发声**：翻译/词典/识别窗口点击朗读，确认有声音
- [ ] **dist 打包 smoke**：`npm run dist` 后验证首次启动、托盘、快捷键、截图、设置、识别窗口，并确认 `better-sqlite3` 的 `*.node` 位于 `app.asar.unpacked` 且词典/历史数据库可正常打开
- [ ] **置顶按钮全窗口存在性视觉一致性**：E2E 已覆盖 dict/recognize titlebar `pin` 存在性与翻转，仍需 dist 实物视觉确认翻译、词典、文字识别、截图翻译四窗口样式一致
- [ ] **置顶按钮图钉竖线视觉**：当前路径 `M12 16v6` 已含竖线，用户反馈仍缺失；dist 实物确认，必要时调整 strokeWidth 或 path
- [ ] **去除换行 / 去除空格图标与 demo 一致**：`Icons.Newline` / `Icons.Space` 已按 demo 的 `MdSmartButton` / `CgSpaceBetween` 重绘，dist 实物确认一致性

---

## P4: 免费翻译 / 词典服务集成（待用户允许后再做）

来源：`docs/archive/external_services/pot_plugin_api_test_results.md`（2026-05-19 测试），分类详见 `docs/external_service_catalog.md` §1.2/§1.3。
将 pot-app 社区验证过的免费、无需 API key 的服务接入 omni_pot。
**未经用户明确允许，暂不主动开工**；先记录在此作为后续任务。

### 翻译服务（免费无 key，已验证可用）

- [ ] **火山翻译 (Volcengine)** — 最简单，纯 JSON POST，零签名
- [ ] **腾讯交互翻译 (Transmart)** — 稳定，固定 client_key
- [ ] **腾讯翻译君 (Tencent WeChat)** — 稳定，GET 请求，模拟微信小程序
- [ ] **彩云小译 (Caiyun)** — 稳定，内置 token（有失效风险）
- [ ] **Papago (Naver)** — 多语言，需动态 HMAC token 流程

### 词典服务（免费无 key，已验证可用）

- [ ] **Free Dictionary API** — 英文词义/音标/例句（当前项目已有集成，确认是否最新）
- [ ] **Tatoeba 例句查询** — 多语言例句搜索引擎，适合做辅助功能

---

## 已知环境问题（不修，仅跟踪）

- **谷歌翻译当前环境失败**：保留为已知问题，不用 mock 隐藏；需要在网络可达的环境复测，或更换默认免费引擎。

---

## P5: 测试覆盖缺口（2026-05-21 spec ↔ tests 审计）

来源：对照 `docs/spec.md` / `docs/test.md` / `docs/test_user_e2e.md` 与 `tests/` 下 62 个测试文件审计得出。
P1（cld3 重构）相关检测测试待 P1 完成后再补，本段不重复列。

### P5.1 spec 完全无覆盖（优先）

- [ ] **spec §5.4 结果卡片拖拽排序** — 拖拽后 `translate_service_list` 顺序更新；无 E2E/unit 覆盖。新增 `translate_result_cards.spec.ts` 用例
- [ ] **spec §5.4 翻译窗口 DictResult 渲染** — 翻译结果为词典型时渲染发音/释义/例句结构；`translate_result_cards.spec.ts` 目前只测字符串结果
- [ ] **spec §9.12 日志系统** — `electron-log` 轮转、renderer 日志转发、API key 脱敏；无 unit/integration 覆盖
- [ ] **spec §27 自动更新下载安装** — "立即更新"触发下载 + 进度条 + 安装；`updater_and_tray.spec.ts` 只覆盖渲染与"稍后提醒"
- [ ] **spec §6.2 词典源词卡片编辑重查** — `contentEditable` 编辑后 Enter 重查；`dict_window.spec.ts` 未覆盖
- [ ] **spec §21 托盘"重启"/"退出"动作** — `tray_layout.spec.ts` 只断言菜单项存在，未触发动作

### P5.2 有测试但断言不足

- [ ] **spec §5.2 源文本 TTS 状态机** — 朗读按钮忙碌/播放态、再次点击取消、清空原文停止；`translate_source_area.spec.ts` 缺 TTS 用例
- [ ] **spec §8.3 识别窗口"复制图片"** — 复制图片到剪贴板路径；`recognize_window.spec.ts` 只测复制文本
- [ ] **spec §8.5 切换识别目标语言自动重翻译** — `recognize_window.spec.ts` 测了切换引擎重识别，缺切换目标语言自动重翻译
- [ ] **spec §9.8 历史工具栏搜索/筛选** — 搜索框、服务筛选、时间筛选；`config_history_backup.spec.ts` 缺
- [ ] **spec §5.5 欢迎页跳转快捷键 tab** — `translate_welcome.spec.ts` 只验证设置窗口打开，未断言精确落在快捷键 tab
- [ ] **spec §10 更新器版本对比格式** — `updater_and_tray.spec.ts` 缺 `3.0.6 → 3.1.0 · 日期 · 包大小` 格式断言

### P5.3 设计文档未落地

- [ ] **test_user_e2e.md §5 `data/` 目录** — 设计了样例图片、OCR 语言包目录，`tests/user_e2e/` 下不存在；要么补建、要么从设计文档移除
- [ ] **test_user_e2e.md §5 `pages/tray.ts`** — 设计了托盘 Page Object，实际不存在（托盘测试直接走 API）；要么补建、要么从设计文档移除

> 备注：specs/ 目录有若干文件（`translate_welcome` / `translate_entry_merge` / `translate_input_rows` / `translate_pin_topmost` / `translate_result_states` / `translate_window_constraints` / `tray_layout` / `terminology_settings` / `window_rounded_corner` / `dict_card_height` / `dict_issues`）超出 test_user_e2e.md 原始规划，是后续 issue 衍生的正向扩展，不算缺口。
