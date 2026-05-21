# omni_pot 任务清单

> 合并自原 `PLAN.md`、`docs/review.md`、`docs/issues.md`。
> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_user_e2e.md` 为准。
> 已完成项归档见 `docs/archive/plan_archive.md`、`docs/archive/plan_archive_2.md`、`docs/archive/plan_archive_3.md`、`docs/archive/closed_issues/`。

---

## 当前状态

第二轮代码修复 ✅ (6/6)、第二轮测试加固 ✅ (5/5)、第三轮测试整改 ✅ (9/9)、第四轮 review 覆盖加固 ✅ (10/10)。
详见 `docs/archive/plan_archive_3.md`。

---

## P1: 自动化测试待办

### T1 语言检测回退链 + "我爱你"中文不误判日语

- spec §17：**失败回退链 `bing → google → baidu → tencent → niutrans → local`**
- spec §5.4：**中文长句不被误判为日语**（如重复 "我爱你"）
- spec §17：检测引擎与目标语言相同 → 回退到 `translate_second_language`
- 现状：`tests/detect/cld3.test.ts` 仅 cld3 单测；回退链未端到端覆盖

- [ ] 单元层 mock 模拟逐个引擎失败，断言回退顺序
- [ ] E2E 加 "我爱你×N → 检测为中文" 断言
- [ ] `translate_behavior.spec.ts` 中检测引擎=目标语言的强断言确认

---

## T2 语言检测替换为 cld3-asm，移除远程 API 回退链

> 测试报告见 `docs/external_services/lang_detect_api_test_20260521.md`。
> 结论：5 个远程检测 API（Bing/Google/Baidu/Tencent/NiuTrans）在当前环境全部不可用，
> cld3-asm 15 种语言 30/30 全部正确，体积 6.3MB，初始化 7ms，速度最快。

### 范围

- **安装 cld3-asm**：`npm install cld3-asm`，加入 dependencies
- **重写 `src/services/detect.ts`**：
  - 移除 `bing_detect`、`google_detect`、`baidu_detect`、`tencent_detect`、`niutrans_detect` 五个远程检测函数
  - 移除 `fetch_with_timeout`、`DETECT_REQUEST_TIMEOUT_MS`、`DETECT_FALLBACK_ORDER`
  - 移除所有 `*_LANG_MAP`（BING_LANG_MAP、GOOGLE_LANG_MAP、BAIDU_DETECT_LANG_MAP 等）
  - 移除 `RemoteDetectEngine` 类型、`DetectFallback` 类型
  - 移除 `detect_engine_order` 函数
  - 新增 `detect_cld3()` 函数：使用 cld3-asm WASM 检测，返回 BCP-47 代码，映射到项目 `LanguageCode`
  - 新增 BCP-47 → 项目语言码映射表（复用 cld3 测试中验证的映射）
  - `detectLanguage(text, engine?)` 简化为：cld3 为主，regex 兜底（cld3 加载失败时）
  - engine 参数保留但仅支持 `'local'`（cld3+regex）一种模式，或考虑移除 engine 参数
- **重写 `electron/detect/index.ts`**：
  - 移除 IPC `detect.local` 的 regex 实现，改为调用 cld3
  - 保留 regex 作为 cld3 WASM 加载失败的最终兜底
- **更新测试**：
  - 重写 `tests/unit/services/test_detect.test.ts`：移除远程引擎 mock 测试，新增 cld3 检测测试
  - 更新 E2E 检测相关断言
- **更新文档**：
  - `docs/spec.md` §17 语言检测：移除远程 API 回退链描述，改为 cld3 本地检测
  - `docs/external_service_catalog.md`：语言检测部分更新为 cld3-asm
  - `docs/external_services/lang_detect_api_test_20260521.md`：标记 cld3-asm 已采纳

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

- [ ] 安装 cld3-asm，加入 package.json dependencies
- [ ] 重写 src/services/detect.ts（移除远程 API，新增 cld3，保留 regex 兜底）
- [ ] 重写 electron/detect/index.ts（IPC 层改用 cld3）
- [ ] 重写 tests/unit/services/test_detect.test.ts
- [ ] 更新 E2E 检测相关测试
- [ ] 更新 docs/spec.md §17
- [ ] 更新 docs/external_service_catalog.md
- [ ] 更新 docs/external_services/lang_detect_api_test_20260521.md

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

## P5: 免费翻译 / 词典服务集成（待用户允许后再做）

来源：`docs/external_services/pot_plugin_api_test_results.md`（2026-05-19 测试）。
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

各服务 API 格式、请求/响应示例、注意事项详见 `docs/external_services/pot_plugin_api_test_results.md`。

---

## 已知环境问题（不修，仅跟踪）

- **谷歌翻译当前环境失败**：保留为已知问题，不用 mock 隐藏；需要在网络可达的环境复测，或更换默认免费引擎。
