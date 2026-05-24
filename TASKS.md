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

## 代码审阅待办（2026-05-25，来源 `docs/review_claude.md` + `docs/review_gpt.md`）

> 两份审阅在 HEAD = `c1107eb` 下并行产出，已合并去重；条目按"安全 → 可靠性 → 服务正确性 → UX → 测试/文档"排序。除特别说明外，问题与位置均已在两份 review 中给出证据。

### A. 安全与本地 HTTP API（high）

- [ ] **本地 HTTP API 加认证 + 收紧 CORS**：`electron/server/index.ts:65-68` 当前 `Access-Control-Allow-Origin: *`，任意网页可读 `/history` / `/config`、触发 `/translate` `/dict` `/recognize`。改为 Origin 白名单 + token；校验 `Host: 127.0.0.1`。
- [ ] **HTTP body 大小限制**：`electron/server/index.ts` 多处 handler（84-89、251-254、274-278、303-308、355-359、387-391、419-423、545-550、641-647、679-684）把 chunks 全部存数组再 `Buffer.concat`，无上限。按端点限制 body 大小，超限 destroy + 413。
- [ ] **`/config` 改为 public allowlist**：当前只手写 redact `webdav_password`（`electron/server/index.ts:41-53`），未来新增 top-level secret 易遗漏；改为只暴露明确 public 字段。
- [ ] **`/history` 端点隐私**：即便加 auth，也应默认不暴露完整 source/target；考虑显式开关 + 用户可见提示。
- [ ] **翻译/TTS 原文不再写入持久日志**：`src/windows/translate/index.tsx:131-132`、`src/services/tts/system_tts.ts:78-80` 记录 `text.slice(0, 50)`，落盘到 `%APPDATA%/omni_pot/logs/main.log` 并进入导出日志包。只记录长度/语言/服务数量/request id/耗时。
- [ ] **凭据存储与备份加密**：`config.json` 明文保存 WebDAV 密码与 provider API key；备份 zip 未加密（`electron/backup/index.ts:82-147`、`350`）。凭据迁到 OS credential storage；备份默认排除或加密 secrets。
- [ ] **preload API 按窗口拆分**：`electron/preload.ts:34-47/117-125/52-56` 把 config/backup/clipboard 全部暴露给所有 renderer；IPC handler（`config_handlers.ts`、`backup_handlers.ts`、`text_handlers.ts`）不校验 sender。按窗口拆分 preload；handler 校验 sender window label。
- [ ] **IPC config setter schema 校验**：`ipc/config_handlers.ts:15-24` 接收 `value: unknown` 直接写入；renderer 可持久化错误类型破坏端口、布尔开关等。IPC 边界加 schema。
- [ ] **IPC history 分页 clamp**：`ipc/history_handlers.ts:31-33` 把 `page` / `page_size` 直接拼到 SQLite `LIMIT/OFFSET`；按 HTTP 同等规则 clamp，验证 mutation 参数。
- [ ] **OCR temp 文件随机化**：`ipc/ocr_handlers.ts:124-130` 用 `Date.now()` 拼路径，并发可碰撞、本地可预测。改为 `mkdtemp` 私有目录 + exclusive write。

### B. 自动更新（high）

- [ ] **更新仓库改为公开 release 仓库**：`electron/updater/index.ts:15-16` 和 `src/windows/updater/index.tsx:27-28` 硬编码 `TuTouPower/omni_pot`（私有），普通用户无法访问。改为 `omni_pot_release`，allowlist（`updater/index.ts:51-53`）同步。
- [ ] **更新包签名/哈希校验**：`updater/index.ts:177-185` 下载后直接 `shell.openPath`，仅 URL allowlist。补 Authenticode/签名哈希校验。
- [ ] **updater IPC 限定 sender**：`updater/index.ts:177-189` handler 不校验 sender window，asset URL 来自 renderer。限制只允许 updater window 调用，asset 由 main 从 release metadata 绑定。
- [ ] **手动检查更新不应受启动开关阻断**：`electron/tray/index.ts:215-218` 调用 `checkForUpdate(silent=false)`，但 `updater/index.ts:192-195` 在 `check_update=false` 时直接返回。`silent=false` 应忽略该开关。
- [ ] **About / updater 仓库链接改为公开地址**：`src/windows/config/about.tsx:19,70,73,76,79`。

### C. 数据可靠性与状态（high）

- [ ] **`config.json` 原子写入**：`electron/config/store.ts:192-223` 用 300ms 防抖 + `writeFileSync`，崩溃可留半写文件。改为写 `config.json.tmp` 再 `renameSync`。
- [ ] **history.db 恢复期间加全局 mutex**：`electron/history/index.ts:17-39` + `electron/backup/index.ts:268-281`。并发 `get_db()` 与 rename 竞态会损坏恢复结果。
- [ ] **Windows 选区 COM 引用泄漏**：`electron/selection/windows.ts:148-152`、`230-247`。`RPC_E_CHANGED_MODE` 路径未配对 `CoUninitialize`；异常路径未 `SysFreeString` 释放 BSTR / `pRange`。统一 try/finally。
- [ ] **修改快捷键时注销旧绑定**：`electron/hotkey/index.ts:80-107` 用 `name` 索引 actions 但用 `shortcut` 索引 OS 注册；改 shortcut 时旧绑定残留。注册新 shortcut 前按 name 找到旧值并 `globalShortcut.unregister`。
- [ ] **透明度切换不重置 pin/置顶**：`electron/windows/manager.ts:209-220`、`297-320`。`rebuildForTransparencyChange()` 触发的 close 当前会清掉 pinned 与 always-on-top。close handler 仅在 `app.quitting` 时重置，rebuild 阶段加跳过标记。
- [ ] **dict/recognize close 时 reset pinned**：`electron/windows/manager.ts:215-220` 只 reset `always_on_top`，pinned 残留；blur auto-close 被跳过。补 reset，并补 e2e 断言 pinned/`aria-pressed` 与 blur 行为。
- [ ] **dict 尺寸记忆使用独立开关**：`electron/windows/dict_options.ts:8-11/25-27` 复用 `translate_remember_window_size`。新增 `dict_remember_window_size`，或文档明确共用。
- [ ] **`translate_window_position='pre_state'` 实现**：`shared/types/config.ts:27/38-39`、`docs/spec.md:519` 定义"上次位置"，但 `windows/manager.ts:80-85` 永远按鼠标显示器居中。补 save/restore。
- [ ] **`recognize_always_on_top` 创建时生效**：`windows/recognize_options.ts:7-17` 未传 `alwaysOnTop`，配置无效。
- [ ] **renderer config store 持久化失败不静默成功**：`src/stores/config_store.ts:35-39` 乐观更新 + `.catch(console.error)`；失败需回滚或提示。
- [ ] **backup restore 严格 schema + 广播 config**：`electron/backup/index.ts:239-250/305-309` 只检查 plain object 就替换 live config；`reload_config_from_disk()` 不广播，已打开窗口仍使用旧值。restore 用严格 schema 拒绝未知 key；写完广播 config changed。

### D. UI / UX（high）

- [ ] **截图捕获 / OCR 失败不再静默吞**：`electron/screenshot/index.ts:72-76`、`ipc/ocr_handlers.ts:108-110`、`src/windows/screenshot/index.tsx:116/164-168`。补错误日志、UI 反馈、保留窗口与重试。
- [ ] **截图翻译模式下识别语言变更需重新 OCR + 翻译**：`src/windows/recognize/index.tsx:400-405` 自动重识别 effect 在 translate 模式直接返回；与 `docs/spec.md:477-478` 不符。
- [ ] **recognize 窗口 source=auto 时交换语言按钮**：`src/windows/recognize/index.tsx:594-601/767` 当前两支返回相同值，swap 无效；用 `detectedSourceLang` 参与交换或无检测时禁用。
- [ ] **请求 race 防回退 loading**：`src/windows/recognize/index.tsx:421-425/541-545/496-527`。`setIsTranslating(false)` 应按 request id guard。`src/windows/config/history_settings.tsx:43-55/123/131/143` 同类问题。
- [ ] **OCR 自动识别可能无限循环**：`src/windows/recognize/index.tsx:401-405` 自动切 QR 服务后再触发 effect。加 "已对 image+service 识别过" 缓存。
- [ ] **WebDAV 密码改 password 输入**：`src/windows/config/backup_settings.tsx:155-159` + `config_components.tsx:203`。
- [ ] **dict contentEditable 同步 store / 复制**：`src/windows/dict/index.tsx:319-337/385-402`。可见文本未通过 onInput 同步 store，copy 复制旧值；React 也会重置 caret。改用受控 input/textarea，或非受控 + ref。
- [ ] **dict / 自定义下拉补 ARIA 与键盘**：`src/windows/dict/index.tsx:385-390`、`src/windows/config/config_components.tsx:135-172`、`src/windows/translate/language_area.tsx:69-111`、`src/windows/recognize/index.tsx:127-174`。补 textbox/combobox/listbox + 键盘导航或换原生 select。
- [ ] **server_port 输入校验**：`src/windows/config/general.tsx:66-69` 当前 `Number(v)` 可得 NaN/0。
- [ ] **托盘 tooltip 改为 `Omni Pot`**：`electron/tray/index.ts:246-247`。
- [ ] **托盘"查看日志"走 `getUserDataDir()`**：`electron/tray/index.ts:220-222` 忽略 `OMNI_POT_USER_DATA` override。
- [ ] **renderer 用 logger 替换 console**：`src/main.tsx:74`、`src/i18n/index.ts:49/53`、`src/stores/config_store.ts:39`、`src/windows/{translate,dict,recognize,screenshot,config}` 多处违反 CLAUDE.md。
- [ ] **截图/词典/翻译/快捷键设置内的硬编码中文走 i18n**：`src/windows/screenshot/index.tsx:303-310`、`src/windows/translate/target_area.tsx:83-84`、`src/windows/dict/index.tsx:70-71`、`src/windows/config/hotkey_settings.tsx:93-100/159/162/168-184`。
- [ ] **版本号统一来自 metadata**：`src/windows/config/about.tsx:7`、`src/windows/config/index.tsx:123-124`、`src/windows/updater/index.tsx:114/369` 硬编码。
- [ ] **`use_tts` 失败路径清理**：`src/hooks/use_tts.ts:17-34` 播放 reject 时未 `revokeObjectURL`、`is_playing` 卡 true；补 try/catch/finally。
- [ ] **冷启动延迟（已记录）**：详见 `docs/runtime_issues.md` §4。本审阅不重复条目，仅作交叉引用。

### E. 翻译 / 词典 / OCR 服务正确性（high）

- [ ] **所有 provider 加超时 + AbortController**：`src/services/*.ts` 全量；统一 `fetchWithTimeout` 默认 15s + abort。
- [ ] **OpenAI 流式 chunk 跨边界 / 异常**：`src/services/openai.ts:51-70/174-176` 未维护跨 chunk buffer，`JSON.parse` 无 try/catch（参考 `ollama.ts`）。补 buffer + per-chunk catch。
- [ ] **DeepL 付费路径走 lang map**：`src/services/deepl.ts:212-218` 直接 `to.toUpperCase().replace('_','-')`，`zh_cn → ZH-CN` DeepL 拒收；改走 `DEEPL_LANGUAGES`。
- [ ] **火山引擎签名日期改为 V4 basic 格式**：`src/services/volcengine_sign.ts:20-30` 用了 `YYYY-MM-DD`，所有依赖 (`volcengine.ts`、`ocr/volcengine_ocr.ts`) 都会签名失败；与 `ocr/volcengine_multi_lang_ocr.ts:41-64` 已实现的正确格式对齐，并加签名单测。
- [ ] **iFlytek 鉴权修复**：`ocr/iflytek_auth.ts:13-15` 的 base64 拼到 URL 未 `encodeURIComponent`（`iflytek_ocr.ts:31-37`、`iflytek_latex_ocr.ts:31-33`）；`iflytek_intsig_ocr.ts:37-46` 签名声明 `digest` 但缺 `Digest` header。
- [ ] **Youdao 签名统一**：`src/services/youdao.ts:50-55/76-83` 混用新版 input 截断和旧版 MD5（无 curtime/signType）。
- [ ] **TranSmart 协议核对**：`src/services/transmart.ts:43-63`（form-urlencoded + Bearer）与 `scripts/test_pot_plugins.cjs:29-45`（JSON + Referer/UA、无 Bearer）冲突；统一并加契约测试。
- [ ] **Baidu OCR token 请求不要把 secret 拼到 URL**：`src/services/ocr/baidu_common.ts:8` 改 `URLSearchParams` / form body；`baidu_common.ts:19` 的 ttl < 1 天时 expiresAt 变负。
- [ ] **provider salt/nonce 改 `crypto.randomUUID()`**：`baidu.ts:57`、`baidu_field.ts:58`、`youdao.ts:71`、`alibaba.ts:88` 当前 `Math.random().toString(36).substring(2)` 可能产空串。
- [ ] **Bing/Google/Ollama 错误处理**：`bing.ts:124-127` 缺 `!resp.ok` 检查；`google.ts:50-56` 对合法空译响应抛错；`ollama.ts:62-67` 静默丢弃 malformed JSON。
- [ ] **OpenAI `requestArguments` JSON 解析失败显式报错**：`src/services/openai.ts:85-87/140-146` 当前静默回退默认值。
- [ ] **中文词典错误不再吞为空结果**：`src/services/chinese_dictionary.ts:15-20` DB 缺失 / IPC 失败 / SQL 错误与"无该词"不可区分；记录错误并 UI 暴露。
- [ ] **macOS System OCR Swift 脚本打包**：`ipc/ocr_handlers.ts:90-98` 指向 `scripts/macos_ocr.swift`，但 `package.json:60-63` 的 app files 不含该脚本。改 extraResource 或内联 helper。
- [ ] **macOS 划词实现或在 spec 标缺口**：`electron/selection/darwin.ts:3-5` 永远返回 `unsupported-platform`，与跨平台目标不符。
- [ ] **WebDAV 备份能力对齐 spec**：`electron/backup/index.ts:338-356/383-428` 始终用本地 zip；`shared/types/config.ts:167-170` 默认 `backup_type: 'webdav'`；`docs/spec.md:571-576` 要求 WebDAV。实现或改默认 + 标 spec。
- [ ] **text clipboard IPC 限制大小**：`electron/ipc/text_handlers.ts:9-12` 对 renderer base64 创建 nativeImage 无上限。
- [ ] **clipboard 多并发互不打断**：`electron/clipboard/index.ts:14-21` 单 `suppressUntil` 全局时间戳，改嵌套引用计数；`electron/selection/clipboard.ts:38-58` `restoreClipboard` 写顺序会覆盖前一步内容。
- [ ] **DeepL free / Bing UA 风险标注**：`src/services/deepl.ts:32-45/140-144`、`bing.ts:55` 仿冒官方客户端，封禁即失效；在 spec/limitations 记录。
- [ ] **Cambridge HTML 正则 ReDoS**：`src/services/cambridge_dict.ts:74/112/144` 无界长，必要时换解析器。

### F. 测试与脚本

- [ ] **vitest include glob 修复**：`vitest.config.ts:7` 当前 `tests/**/*.test.ts` 漏掉以下文件（均为 `test_*.ts`）：`tests/unit/services/test_bing.ts`、`test_deepl.ts`、`test_google.ts`、`test_registry.ts`、`tests/unit/windows/test_manager.ts`、`tests/unit/stores/test_translate_store.ts`、`tests/unit/lib/test_crypto.ts`。重命名或调整 glob 后同步修订 `docs/test.md §5.1`。
- [ ] **网络门变量统一为 `OMNI_POT_EXTERNAL_SERVICE_TESTS`**：`tests/unit/services/test_bing.ts:4`、`test_google.ts:4` 当前用 `RUN_NETWORK_TESTS`。
- [ ] **`external_services.spec.ts` 不再 silent skip**：`tests/user_e2e/specs/external_services.spec.ts:121/157` 与 `docs/test.md §2.1` 冲突；删除 skip，让具体服务失败暴露，或更新策略文档。
- [ ] **移除 `scripts/test_pot_plugins.cjs` 中的硬编码 token/cookie/secret**：约 39、67、84、118-119、162、192 行，改为环境变量。
- [ ] **HTTP server 单元/契约测试**：当前 `tests/` 无 server-focused 测试；覆盖 CORS、auth、body limit、redaction、history privacy、`/dict` 真正使用 text、`/history` seed 多条断言分页（`docs/spec.md:927-934`，对比 `tests/user_e2e/specs/app_http_api.spec.ts:49-64`）。
- [ ] **updater repo/allowlist 契约测试**：`electron/updater/index.ts` 无对应测试。
- [ ] **backup WebDAV/local 行为单元测试**：`electron/backup/index.ts` 无对应测试。
- [ ] **tray 用户可见字符串 contract 测试**：捕获 `Pot Desktop` 类回归。
- [ ] **screenshot overlay bounds 单测**：`tests/unit/screenshot_display.test.ts:36-48` 只测 capture，不覆盖 `preload_screenshot_window()` / `start_screenshot_capture()` 中的 `setBounds()`。
- [ ] **Cambridge 音频按钮 UI 回归**：`src/windows/dict/index.tsx:97-102` 真实播放路径无 e2e；stub `Audio` 断言 `play()` URL。
- [ ] **pin/topmost 回归断言 pinned 状态**：`tests/user_e2e/specs/window_pin_topmost.spec.ts:87-98/176-186` 当前只检 `alwaysOnTop`。
- [ ] **翻译窗口高度 cap 用 current display**：`tests/user_e2e/specs/translate_window_constraints.spec.ts:20-22` 走 `primaryDisplay()`；`docs/spec.md:240` 要求当前显示器；e2e fixture 暴露 current display 或补单测。
- [ ] **mock 测试加 `@electron-mock` / 原因标注**：`tests/unit/screenshot_display.test.ts:17-26`、`tests/unit/config_store_migration.test.ts:6-14` 违反 `docs/test.md §2.1`。

### G. 文档与项目约定

- [ ] **命名 / 缩进 / 日志规范**：`CLAUDE.md` 要求 `snake_case` + 4 空格 + logger，扫描出约 1001 处非 snake_case、约 1183 行缩进异常、renderer 大量 `console.*`。决定 React/TS 例外范围并写入 CLAUDE.md，否则批量改名 + lint enforcement。
- [ ] **spec 与代码差异修订**：(1) `docs/spec.md:409` 截图先 overlay 后 capture，但当前实现先 capture 后 show；(2) `docs/spec.md:101` 标 Electron 35+，实际 ^39.8.10；(3) `docs/spec.md:147` updater 600×400，实际 `electron/updater/index.ts:221-225` 是 480×520；(4) `docs/spec.md:699-701` 默认 `service_instances` 缺 `system@default`、`qrcode@default`（实际见 `shared/types/config.ts:88-99`）；(5) `docs/spec.md:479` 与 `:1110` 对 Linux System OCR 自相矛盾。
- [ ] **test 文档同步**：(1) `docs/test_user_e2e.md:413` 仍提"文字（字体+字号）"；(2) `:363` 词典 titlebar 漏 pin；(3) `:450-455` HTTP API 漏 `/dict`、`/history`；(4) `:234-238` endpoint 列表漏 `/e2e/set-config` 等 fixture；(5) `docs/test.md:24-27` 写 15 个 spec，`docs/test_user_e2e.md:54` 写 26 个，实际 27 个；(6) `docs/test.md:279` 表行漏 Google。
- [ ] **About / updater UI 链接同步**：仓库地址改公开 release 仓库。
- [ ] **`build_chinese_dict.ts` 收口**：(1) 注释要求单对象 JSON fail，但 `scripts/build_chinese_dict.ts:36-42` 实际接受；(2) `:197-199` 开启 WAL 但 `package.json:72-78` 只 include `.db`，结束前需 checkpoint/truncate。
- [ ] **`shared/types/ipc.ts` 命名一致性**：`writeClipboardImage(base64Image)` vs handler 的 `base64_image` snake_case；`chineseDict:` 通道名混用 camelCase；`HistoryRecord.service_key` 与 `service.ts` `serviceKey` 不一致。
- [ ] **archive 文档 OCR/识别术语**：`docs/archive/closed_issues/issues0518.md:41`、`docs/archive/old_pot/spec.md:126`、`docs/design/omni-pot/project/uploads/spec.md:113`、`docs/design/omni-pot/chats/chat1.md:306`。确认 archive 豁免否；不豁免则改"文字识别"。

### H. 热键冷启动延迟（`docs/runtime_issues.md` §4）

> 策略：先做 A（解耦 `focusOrCreate` 与 `readSelectedText`），上线 timing 日志和 E2E 后再评估是否做 B（预热窗口）。**不要只凭体感判断**，所有验收都以 `show_ms` / `total_ms` 数据为准。

- [ ] **A 解耦：先开窗，选区并行读**：按 `docs/runtime_issues.md §4 修复方案 A`，调整 `electron/hotkey/index.ts:51-78` 的 `triggerTranslateEntry` 与 `triggerSelectionDictionary`，让 `focusOrCreate(TRANSLATE/DICT)` 在 `readSelectedText()` 之前发起，文本通过 `sendWhenReady` 异步投递。空选区路径走 `translate:input-translate`；渲染端在 `translate:from-selection` 到达前显示骨架/占位避免空 loading 闪烁。
- [ ] **加 timing 日志**：在 `electron/hotkey/index.ts` 的 trigger 入口起记两段计时：
  - `show_ms` = 按下热键 → 窗口 `isVisible()` 第一次为 true
  - `total_ms` = 按下热键 → 文本（`translate:from-selection` / `dict:lookup` 等）到达渲染层
  - 落日志格式 `log_hotkey.info('show=%dms total=%dms entry=%s', show_ms, total_ms, entry)`；区分 translate / dict / 空选区 / textOverride 路径。
- [ ] **E2E 断言可见性与总时延**：在 `tests/user_e2e/specs/` 新增（或扩展现有热键 spec）用例：
  - 触发翻译 / 词典热键后断言对应窗口在 **200ms 内 `isVisible()`**
  - 文本到达放宽到 **1.5s 内**（含 stub 选区，避免外部网络）
  - 同时覆盖"空选区→输入模式"与"带选区→直接翻译"两条路径
- [ ] **复杂焦点应用手测**：在 dist 产物下，分别在 **VS Code**、**Microsoft Word**、Office Excel、Chromium 浏览器选区上手动触发翻译 / 词典 / 截图翻译热键，记录 `show_ms` / `total_ms`，结果回写到 `docs/runtime_issues.md §4` 的"验证"小节。验收门槛：window visible < 200ms、文本到达 < 1.5s。
- [ ] **B 预热（A 验证后再评估）**：按 `docs/runtime_issues.md §4 修复方案 B` 预热 translate / dict 窗口前，必须先完成 §C 中的 "透明度切换不重置 pin/置顶" 与 "Windows 选区 COM 引用泄漏" 两项（A 阶段路径未受影响，但 B 会放大这两个 bug）。是否默认开启视 A 阶段数据决定；若开启走 `preload_windows` 配置开关。
- [ ] **C UIA 软超时（兜底，按需）**：仅当 A + B 后仍有用户报慢时启动；按 `runtime_issues.md §4 方案 C` 把 UIA 调用挪到 utility process / worker，主线程 `Promise.race(uia, sleep(150))`，并校验 `CoInitializeEx` / `CoUninitialize` 顺序避免放大 §C COM 泄漏。
- [ ] **修复后归档**：A 验证通过且 timing/E2E 落地后，更新 `docs/runtime_issues.md §4` 实测数据并归档到 `docs/archive/closed_issues/`。

### I. 低优 / 备忘

- [ ] **`compare_versions` 处理 pre-release**：`electron/updater/index.ts:37-45` 当前 `1.2.0-beta` 与 `1.2.0` 视为相等。
- [ ] **`handleResetConfig` 批量 set**：`electron/server/index.ts:531-541` 循环 setConfig 触发约 50 次 broadcast。
- [ ] **chinese_dict FTS5 前缀最小长度**：`electron/chinese_dict/index.ts:162-177`，单字符前缀在大库上慢。
- [ ] **`package.json:25-26` cross-env**：`node -e "..."` 设环境变量 Windows 下脆弱；`format:check` 长 biome 参数挪 `biome.json`。
- [ ] **`scripts/check_dist_locks.mjs:111/136` `Atomics.wait` → `node:timers/promises`**。
- [ ] **`source_area.tsx` 动态翻译 timer ref-持有 `onTranslate`**：`src/windows/translate/source_area.tsx:171-178` 当前依赖父 rerender 重置 timer。
- [ ] **recognize show 监听重订阅丢事件窗口**：`src/windows/recognize/index.tsx:329-346`。
- [ ] **translate mount-only effect 异步配置晚到**：`src/windows/translate/index.tsx:80-85`。
- [ ] **setTimeout cleanup**：`src/windows/translate/index.tsx:325`、`src/windows/dict/index.tsx:50`。
- [ ] **`source_area.tsx:122` `Caps Lock` 快捷键**：同时接受 `e.code === 'KeyU'`。
- [ ] **`eslint-plugin-security` 或移除 lint 命令**：`package.json:108-140` 缺依赖；`npm audit` transitive `nanoid <3.3.8` 跟踪上游修复。

---

## 已知环境问题（不修，仅跟踪）

- **谷歌翻译测试环境网络不可达**：`external_services.spec.ts` 已支持代理环境变量；若 Node 测试进程仍不可达，Google 用例会 skip。运行时正常。
- **DeepL free 当前环境限流**：`npm run test:e2e:external` 中长文本和葡语变体用例出现 429；只影响 opt-in 外部服务健康检查，不影响 `@core` / `@ui`。
- **`cld3-asm` 依赖链 moderate audit 提示**：`npm audit --audit-level=high` 通过；npm 给出的 `--force` 修复会引入 breaking change，暂不自动修。
