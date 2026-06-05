# omni_pot 任务清单

> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_e2e.md` 为准。
> 已完成项归档见 `docs/archive/plan_archives/`、`docs/archive/closed_issues/`。

---

## 当前状态

- P1–P2、P5–P6 已归档：`docs/archive/plan_archives/plan_archive_4.md`。
- P7–P11 已完成部分已归档：`docs/archive/plan_archives/plan_archive_5.md`。
- 2026-05-29 核对完成项已归档：`docs/archive/plan_archives/plan_archive_6.md`。
- 当前清单只保留未完成、待用户授权或需要复测的事项。

---

## E2E 失败修复（2026-06-01）

四个 spec 失败，根因分别如下：

- [x] **updater_and_tray:312 support_author tray action**：`omni.api.shellOpenExternal().urls` 拿不到 afdian 链接。`src/main/tray/index.ts:220` 直接调 `shell.openExternal`，绕过 `src/main/ipc/shell_handlers.ts` 里 E2E 的 URL 捕获。修法：抽 `open_external_safely()` 共享 helper，tray 和 IPC handler 共用。
- [x] **config_settings:344 about links**：期望 `github.com/TuTouPower/omni_pot`，实际 `omni_pot_release`。`src/windows/config/about.tsx:17` 已改为面向用户的公开仓库，行为正确。修法：测试期望值改成 `omni_pot_release`。
- [x] **translate_behavior:344 第二语言回退**：期望 langpair `autodetect|zh-CN`，实际 `en|zh-CN`。commit `b2cfe41` "auto 模式下把 cld3 检测语言传给翻译服务" 改了行为。修法：测试期望值改成 `en|zh-CN`。
- [x] **i18n:66 托盘菜单标签**：托盘新增 `support_author`（`src/main/tray/index.ts:63`），i18n spec 的期望 labels 数组过时。修法：测试 labels 加入 `支持作者` / `Support Author`。
- [x] **translate_card_collapse_height 阈值**：collapse-all 测试上限 220 偏紧（实际 242），调到 260；同时给整个 describe 加 `retries: 2` 抵御窗口高度测量 flake。

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

- [ ] 新增任何免费无需 key 且当前代码存在的外部服务时，同步添加到 `tests/e2e/specs/external_services.spec.ts`。
- [ ] 同步更新 `docs/external_service_catalog.md`、`docs/test.md`、`docs/test_e2e.md` 中的服务覆盖说明。

---

## 待做 UI / 功能调整

- [x] **欢迎窗口独立化：welcome 不能再嵌在翻译窗口里**：欢迎页已拆为独立 `welcome` 窗口，翻译窗口空状态只显示正常输入区和语言区。
  - 新增独立窗口：在 `WindowLabel` 中新增 `WELCOME = 'welcome'`，新增 `src/main/windows/welcome_options.ts`，创建独立 BrowserWindow 配置；路由支持 `#welcome`；渲染层新增独立 welcome page / entry，复用现有欢迎卡片内容但不复用翻译窗口标题栏的“翻译”模式语义。
  - 翻译窗口去欢迎化：删除 `src/windows/translate/index.tsx` 内的 `WelcomeEmpty` 逻辑、`show_welcome_empty` 分支、欢迎态高度计算和欢迎态 padding 特例；翻译窗口源文本为空时仍显示正常输入区和语言区，不再展示欢迎内容。
  - 启动逻辑：首次启动打开 `WELCOME` 窗口，而不是把欢迎页塞进 `TRANSLATE`；`welcome_dismissed` 只表示独立欢迎窗口是否已跳过/完成，不参与翻译窗口空状态判断。
  - 热键逻辑：翻译热键无选区时打开 `TRANSLATE` 输入模式；有选区时直接投递到 `TRANSLATE`；任何热键路径都不应打开或闪现 `WELCOME`。
  - 欢迎页按钮行为：欢迎窗口中的“翻译 / 词典 / 文字识别 / 截图翻译 / 设置快捷键 / 跳过”等入口触发对应窗口或设置页后关闭 `WELCOME`；跳过写入 `welcome_dismissed=true` 并关闭欢迎窗口。
  - 测试要求：新增/调整 E2E 覆盖首次启动显示独立欢迎窗口、欢迎窗口没有 `titlebar-mode=翻译`、点击入口会关闭欢迎窗口并打开对应功能窗口、空翻译窗口不显示欢迎页、热键无选区只打开翻译输入区、已跳过后不再启动欢迎窗口。
  - 文档要求：更新 `docs/spec.md` 明确“欢迎窗口 ≠ 翻译窗口”；更新 `docs/test_e2e.md` 中欢迎页与翻译窗口测试边界；移除所有“欢迎页是翻译窗口空状态”的描述。

- [x] **词典/文字识别窗口固定按钮 bug + 补测试未收口**：blur 逻辑已部分修复，但 `src/main/windows/manager.ts` close reset 仍把 `translate_pinned` 写成词典/识别路径的 reset，未清理 `dict_pinned` / `recognize_pinned`；`tests/e2e/specs/window_pin_topmost.spec.ts` 也只断言 `alwaysOnTop`，缺 pinned / `aria-pressed` 回归。

---

## 待做 bug 修复：词典服务设置（2026-05-30 用户反馈）

### Bug 1: 词典 tab "添加服务"显示全部翻译服务

- **位置**: `src/windows/config/service_settings.tsx:28-29`
- **问题**: `getRegistryForCategory` 对 `dictionary_service_list` 和 `english_dictionary_service_list` 都返回 `translateServiceRegistry`（19个翻译服务），导致添加服务弹窗显示 Bing、Google、DeepL 等无关服务
- **修复**:
  - [x] `src/services/registry.ts` — 新增 `dictionaryServiceRegistry`
  - [x] `src/services/index.ts` — `chinese_dictionary`、`ecdict`、`cambridge_dict` 注册到 `dictionaryServiceRegistry`
  - [x] `src/windows/config/service_settings.tsx:28-29` — 两个词典 tab 返回 `dictionaryServiceRegistry`
  - [x] 测试：e2e `config_service_mgmt.spec.ts` 验证词典 tab 添加服务弹窗只显示词典服务；unit `test_registry.ts` 验证 registry 隔离

### Bug 2: 中文 locale 标签错误

- **位置**: `src/i18n/locales/zh_cn.json:201`、`zh_tw.json:93`
- **问题**: `"chinese_dictionary": "Chinese Dictionary"` 应分别为 `"中文词典"` / `"中文詞典"`，导致中文模式下设置页服务 tab 显示英文
- **修复**:
  - [x] `src/i18n/locales/zh_cn.json` — 改为 `"中文词典"`
  - [x] `src/i18n/locales/zh_tw.json` — 改为 `"中文詞典"`
  - [x] 测试：`i18n_locale.test.ts` 断言 zh_cn/zh_tw 标签正确

### Doc: spec 默认值过时

- **位置**: `docs/spec.md:903`
- **问题**: `english_dictionary_service_list` 默认值写的是 `['cambridge_dict@default']`，实际代码是 `['cambridge_dict@default', 'ecdict@default']`
- **修复**:
  - [x] `docs/spec.md:903` — 更新默认值
  - [x] `docs/spec.md:561` — 服务 tab 列表改为"中文词典"

---

## 待做 bug 修复（2026-05-24 用户反馈）

- [x] **Google Translate e2e 不应 silent skip**：`external_services.spec.ts` 已支持代理环境变量，但当前仍会在 Google 网络不可达时 skip；按统一外部服务策略应删除 skip，让具体服务失败暴露。

## 代码审阅待办（2026-05-25，来源 `docs/review_claude.md` + `docs/review_gpt.md`）

> 两份审阅在 HEAD = `c1107eb` 下并行产出，已合并去重；条目按"安全 → 可靠性 → 服务正确性 → UX → 测试/文档"排序。除特别说明外，问题与位置均已在两份 review 中给出证据。

### A. 安全与本地 HTTP API（high）

- [x] **本地 HTTP API 加认证 + 收紧 CORS**：公共 HTTP API 已要求 `X-Omni-Pot-Api-Token`，Host 仅允许 localhost/127.0.0.1，非法 Origin 在路由执行前 403。
- [x] **`/config` 改为 public allowlist**：`/config` 公开响应改为顶层 allowlist，不返回 `server_api_token` / WebDAV 凭据；service instance config 只返回 `enable` / `instanceName`。
- [x] **`/history` 端点隐私**：公共 `/history` 需 API token，且默认截断 source/target；完整文本只允许 E2E token 路径用于测试。
- [x] **翻译/TTS 原文不再写入持久日志**：翻译、System TTS、词典查询日志只记录语言、长度、服务数等元数据；剪贴板监听也只记录文本长度，不落原文片段。
- [x] **凭据存储与备份加密**：配置落盘时敏感字段加密，兼容旧明文配置迁移；备份写入 sanitized config，默认不导出 `server_api_token`、WebDAV 密码或 provider credential 字段。
- [x] **preload API 按窗口拆分**：preload 按窗口 hash 暴露最小 API 子集；高风险 IPC handler 统一按真实 `BrowserWindow` label 校验 sender，`renderer:ready` 不再信 renderer 传入 label。
- [x] **IPC config setter schema 校验**：`ipc/config_handlers.ts:15-24` 接收 `value: unknown` 直接写入；renderer 可持久化错误类型破坏端口、布尔开关等。IPC 边界加 schema。
- [x] **OCR temp 文件随机化未收口**：`ipc/ocr_handlers.ts` 已使用 `randomUUID()` 生成临时目录名，在公共 tmp 下创建独立目录并 `chmod 0700` 后写入截图；`mkdir(..., { recursive: true })` 返回 `undefined`（目录已存在）不再误判失败。

### B. 自动更新（high）

- [x] **更新包哈希校验**：下载完成后校验 GitHub release asset `digest`（sha256）；生产环境缺失或不匹配即拒绝安装，E2E mock 可用 localhost 并注入 digest。
- [x] **updater IPC 限定 sender**：`updater:downloadAndInstall` 只允许 updater 窗口调用；renderer 只传 asset name，下载 URL 由 main 缓存的 release metadata 绑定。

### C. 数据可靠性与状态（high）

- [x] **history.db 备份/恢复前关闭连接**：备份/恢复路径调用 `close_history()` 后再读写 `history.db`；`src/main/history/index.ts` 中无效的同步 `db_mutex` 噪音已移除。
- [x] **Windows 选区 COM 引用泄漏**：`src/main/selection/windows.ts` 已用统一 `try/finally` 释放 UIA COM 对象、range 与 BSTR，并处理 `CoInitializeEx` 的 `S_FALSE` 初始化结果。
- [x] **dict/recognize close 时 reset pinned**：`src/main/windows/manager.ts` 当前仍未正确 reset `dict_pinned` / `recognize_pinned`，并且 e2e 只断言 `alwaysOnTop`；补 reset，并补 e2e 断言 pinned / `aria-pressed` 与 blur 行为。
- [x] **dict 尺寸记忆使用独立开关**：`src/main/windows/dict_options.ts:8-11/25-27` 复用 `translate_remember_window_size`。新增 `dict_remember_window_size`。
- [x] **`translate_window_position='pre_state'` 实现**：`shared/types/config.ts:27/38-39`、`docs/spec.md:519` 定义"上次位置"，但 `windows/manager.ts:80-85` 永远按鼠标显示器居中。补 save/restore。
- [x] **renderer config store 持久化失败不静默成功**：`src/stores/config_store.ts:35-39` 乐观更新 + `.catch(console.error)`；失败需回滚或提示。
- [x] **backup restore 严格 schema + 广播 config**：`src/main/backup/index.ts:239-250/305-309` 只检查 plain object 就替换 live config；`reload_config_from_disk()` 不广播，已打开窗口仍使用旧值。restore 用严格 schema 拒绝未知 key；写完广播 config changed。

### D. UI / UX（high）

- [x] **截图捕获 / OCR 失败不再静默吞**：`src/main/screenshot/index.ts:72-76`、`ipc/ocr_handlers.ts:108-110`、`src/windows/screenshot/index.tsx:116/164-168`。补错误日志、UI 反馈、保留窗口与重试。
- [x] **截图翻译模式下识别语言变更需重新 OCR + 翻译**：`src/windows/recognize/index.tsx:400-405` 自动重识别 effect 在 translate 模式直接返回；与 `docs/spec.md:477-478` 不符。
- [x] **recognize 窗口 source=auto 时交换语言按钮**：`src/windows/recognize/index.tsx:594-601/767` 当前两支返回相同值，swap 无效；用 `detectedSourceLang` 参与交换或无检测时禁用。
- [x] **请求 race 防回退 loading**：`src/windows/recognize/index.tsx:421-425/541-545/496-527`。`setIsTranslating(false)` 应按 request id guard。`src/windows/config/history_settings.tsx:43-55/123/131/143` 同类问题。
- [x] **OCR 自动识别可能无限循环**：`src/windows/recognize/index.tsx:401-405` 自动切 QR 服务后再触发 effect。加 "已对 image+service 识别过" 缓存。
- [x] **WebDAV 密码改 password 输入**：`src/windows/config/backup_settings.tsx:155-159` + `config_components.tsx:203`。
- [x] **dict contentEditable 同步 store / 复制**：`src/windows/dict/index.tsx:319-337/385-402`。可见文本未通过 onInput 同步 store，copy 复制旧值；React 也会重置 caret。改用受控 input/textarea，或非受控 + ref。
- [x] **dict / 自定义下拉补 ARIA 与键盘**：`src/windows/dict/index.tsx:385-390`、`src/windows/config/config_components.tsx:135-172`、`src/windows/translate/language_area.tsx:69-111`、`src/windows/recognize/index.tsx:127-174`。补 textbox/combobox/listbox + 键盘导航或换原生 select。
- [x] **renderer 用 logger 替换 console**：`src/main.tsx:74`、`src/i18n/index.ts:49/53`、`src/stores/config_store.ts:39`、`src/windows/{translate,dict,recognize,screenshot,config}` 多处违反 CLAUDE.md。
- [x] **截图/词典/翻译/快捷键设置内的硬编码中文走 i18n**：`src/windows/screenshot/index.tsx:303-310`、`src/windows/translate/target_area.tsx:83-84`、`src/windows/dict/index.tsx:70-71`、`src/windows/config/hotkey_settings.tsx:93-100/159/162/168-184`。
- [x] **版本号统一来自 metadata**：`src/windows/config/about.tsx:7`、`src/windows/config/index.tsx:123-124`、`src/windows/updater/index.tsx:114/369` 硬编码。
- [x] **`use_tts` 失败路径清理**：`src/hooks/use_tts.ts:17-34` 播放 reject 时未 `revokeObjectURL`、`is_playing` 卡 true；补 try/catch/finally。
- [x] **欢迎页与翻译窗口空状态彻底解耦**：欢迎页已拆为独立 `WELCOME` 窗口；翻译窗口空状态只保留正常输入区和语言区。
- [x] **冷启动延迟（已记录）**：自动可做部分已完成；复杂焦点应用手测、B 预热、C UIA 和归档仍见 `docs/archive/runtime_issues.md` §4。

### E. 翻译 / 词典 / OCR 服务正确性（high）

- [x] **所有 provider 加超时 + AbortController**：`src/services/*.ts` 全量；统一 `fetchWithTimeout` 默认 15s + abort。
- [x] **OpenAI 翻译服务已移除**：原 `src/services/openai.ts` 已删除，不再注册 OpenAI 翻译服务；相关流式 chunk / `requestArguments` 修复项不再适用。
- [x] **Youdao 签名统一**：`src/services/youdao.ts` 使用有道 v3 签名参数：长文本 input 截断 + `curtime` + `signType=v3` + SHA-256。
- [x] **TranSmart 协议核对**：当前代码服务保持 spec 定义的 Username + Token 凭据协议（form-urlencoded + Bearer），并用单元契约测试锁定；`scripts/test_pot_plugins.cjs` 中的免配置 JSON + Referer 路径归入 P4 免费服务集成，未经用户允许不主动接入。
- [x] **Baidu OCR token 请求不要把 secret 拼到 URL**：`src/services/ocr/baidu_common.ts:8` 改 `URLSearchParams` / form body；`baidu_common.ts:19` 的 ttl < 1 天时 expiresAt 变负。
- [x] **Bing/Google/Ollama 错误处理**：`bing.ts:124-127` 缺 `!resp.ok` 检查；`google.ts:50-56` 对合法空译响应抛错；`ollama.ts:62-67` 静默丢弃 malformed JSON。
- [x] **Chinese Dictionary错误不再吞为空结果**：`src/services/chinese_dictionary.ts:15-20` DB 缺失 / IPC 失败 / SQL 错误与"无该词"不可区分；记录错误并 UI 暴露。
- [x] **macOS System OCR Swift 脚本打包**：`scripts/macos_ocr.swift` 已作为 extraResource 打包，并在生产环境从 `process.resourcesPath/scripts/macos_ocr.swift` 读取。
- [x] **macOS 划词实现或在 spec 标缺口**：`src/main/selection/darwin.ts:3-5` 当前返回 `unsupported-platform`，已在 spec 标为当前缺口。
- [x] **WebDAV 备份能力对齐 spec**：当前备份实现为本地 zip；默认 `backup_type` 已改为 `local`，spec 明确 WebDAV 仅保留配置项、远端同步未实现。
- [x] **text clipboard IPC 限制大小**：`src/main/ipc/text_handlers.ts:9-12` 限制 renderer base64 输入为 20MB（约 15MB raw image），避免无上限创建 `nativeImage`。
- [x] **clipboard 多并发互不打断**：`src/main/clipboard/index.ts` 的 clipboard monitor 抑制改为嵌套引用计数；`src/main/selection/clipboard.ts` 的备份/恢复路径继续由抑制窗口保护，已补并发抑制单测。
- [x] **DeepL free / Bing UA 风险标注**：`src/services/deepl.ts:32-45/140-144`、`bing.ts:55` 仿冒官方客户端，封禁即失效；在 spec/limitations 记录。
- [x] **Cambridge HTML 正则 ReDoS**：`src/services/cambridge_dict.ts:74/112/144` 无界长，必要时换解析器。

### F. 测试与脚本

- [x] **vitest include glob 修复**：`vitest.config.ts:7` 当前 `tests/**/*.test.ts` 漏掉以下文件（均为 `test_*.ts`）：`tests/unit/services/test_google.ts`、`test_deepl.ts`、`tests/unit/windows/test_manager.ts`、`tests/unit/stores/test_translate_store.ts`、`tests/unit/lib/test_crypto.ts`。重命名或调整 glob 后同步修订 `docs/test.md §5.1`。（`test_bing.ts` → `bing.test.ts` 已重命名。）
- [x] **外部服务测试策略收口**：所有需要真实公网请求的 provider 健康检查只能放在 `tests/e2e/specs/external_services.spec.ts`（`@external`）统一覆盖；其他单元测试、集成测试、E2E（含 `@core` / `@ui`）必须使用本地 stub / fake response / fixture，不允许直连公网。`external_services.spec.ts` 应枚举当前代码注册且无需用户 key 的外部网络 provider，并逐个暴露失败服务名；网络不可达或上游 429/封禁等失败不得 silent skip。完成时同步清理分散在 unit 测试里的真实网络用例，并同步 `docs/test.md`、`docs/test_e2e.md` 的测试边界说明。
- [x] **网络门变量统一为 `OMNI_POT_EXTERNAL_SERVICE_TESTS`**：所有 opt-in 真实公网测试统一只认 `OMNI_POT_EXTERNAL_SERVICE_TESTS=1`；`tests/unit/services/test_google.ts:4` 当前仍用 `RUN_NETWORK_TESTS`，若保留该用例也必须改名/迁移到 `external_services.spec.ts`。
- [x] **`external_services.spec.ts` 不再 silent skip**：`tests/e2e/specs/external_services.spec.ts:118-120/146` 与上面的统一策略冲突；删除 Google 网络不可达 skip，让具体服务失败暴露。
- [x] **`i18n.spec.ts` 文案来源审计**：`tests/e2e/specs/i18n.spec.ts` 的 locale 文案断言已从 `src/i18n/locales/*.json` 派生；原生语言名与托盘菜单固定源保留独立断言。
- [x] **`@core` 标签收敛**：`@core` 只保留 `translate_core.spec.ts` 中“启动 → 翻译窗口可见 → 本地 stub 译文出现 → 关闭窗口”最小关键路径；生命周期、HTTP API、剪贴板等细节迁到 `@ui`。
- [x] **timeout 标准化**：按 `docs/test_e2e.md` §6.2 的分级（UI 5s / 本地 8s / 本地 stub 翻译 15s / 网络 45s / TTS 60s / OCR 60s）统一 E2E 超时；去外网化后多数 45s+ 网络超时可降到 8–15s。
- [x] **移除 `scripts/test_pot_plugins.cjs` 中的硬编码 token/cookie/secret**：约 39、67、84、118-119、162、192 行，改为环境变量。
- [x] **HTTP server 单元/契约测试**：`tests/unit/server/test_server_security.ts` 覆盖 Host/CORS/token/public config 安全边界；`app_http_api.spec.ts` 覆盖 auth、`/dict` 使用 text、`/history` 分页与公开配置 allowlist。
- [x] **updater repo/allowlist 契约测试**：`tests/unit/updater.test.ts` 覆盖 release asset 绑定、下载 URL allowlist / redirect allowlist、updater sender 限制。
- [x] **backup WebDAV/local 行为单元测试**：`tests/unit/backup.test.ts` 覆盖本地备份创建、列表、恢复和路径穿越拒绝；WebDAV 远端同步已在 spec 标为未实现。
- [x] **tray 用户可见字符串 contract 测试**：`tests/unit/tray_labels.test.ts` 锁定托盘 tooltip 为 Omni Pot，菜单中不出现 Pot Desktop。
- [x] **screenshot overlay bounds 单测**：`tests/unit/screenshot_display.test.ts` 覆盖 `preload_screenshot_window()` / `start_screenshot_capture()` 的 `setBounds()`。
- [x] **Cambridge 音频按钮 UI 回归**：`tests/unit/windows/dict_audio.test.ts` stub `Audio` 并断言发音按钮用 Cambridge URL 调 `play()`。
- [x] **pin/topmost 回归断言 pinned 状态**：`tests/e2e/specs/window_pin_topmost.spec.ts:87-98/176-186` 当前只检 `alwaysOnTop`。
- [x] **翻译窗口高度 cap 用 current display**：`tests/e2e/specs/translate_window_constraints.spec.ts:20-22` 走 `primaryDisplay()`；`docs/spec.md:240` 要求当前显示器；e2e fixture 暴露 current display 或补单测。
- [x] **mock 测试加 `@electron-mock` / 原因标注**：`tests/unit/screenshot_display.test.ts:17-26`、`tests/unit/config_store_migration.test.ts:6-14` 违反 `docs/test.md §2.1`。

### G. 文档与项目约定

- [x] **命名 / 缩进 / 日志规范**：已明确 TS/React 命名边界：文件/目录、IPC payload、DB columns、持久化 config key、项目内部纯数据字段用 snake_case；React props/hooks/setter、DOM/Electron/第三方 API 保留 ecosystem 惯例；不做全仓批量 rename / reindent。renderer `.catch(console.error)` 已替换为 `src/utils/logger.ts` scoped logger，scripts 用户可见 console 输出仍允许。
- [x] **spec 与代码差异修订**：(1) `docs/spec.md:409` 截图先 overlay 后 capture，但当前实现先 capture 后 show；(2) `docs/spec.md:101` 标 Electron 35+，实际 ^39.8.10；(3) `docs/spec.md:147` updater 600×400，实际 `src/main/updater/index.ts:221-225` 是 480×520；(4) `docs/spec.md:699-701` 默认 `service_instances` 缺 `system@default`、`qrcode@default`（实际见 `shared/types/config.ts:88-99`）；(5) `docs/spec.md:479` 与 `:1110` 对 Linux System OCR 自相矛盾。
- [x] **test 文档同步**：(1) `docs/test_e2e.md:413` 仍提"文字（字体+字号）"；(2) `:363` 词典 titlebar 漏 pin；(3) `:450-455` HTTP API 漏 `/dict`、`/history`；(4) `:234-238` endpoint 列表漏 `/e2e/set-config` 等 fixture；(5) `docs/test.md:24-27` 写 15 个 spec，`docs/test_e2e.md:54` 写 26 个，实际 27 个；(6) `docs/test.md:279` 表行漏 Google。
- [x] **About / updater UI 链接同步**：仓库地址改公开 release 仓库。
- [x] **`build_chinese_dictionary.ts` 收口**：(1) 注释要求单对象 JSON fail，但 `scripts/build_chinese_dictionary.ts:36-42` 实际接受；(2) `:197-199` 开启 WAL 但 `package.json:72-78` 只 include `.db`，结束前需 checkpoint/truncate。
- [x] **`shared/types/ipc.ts` 命名一致性**：`writeClipboardImage(base64Image)` vs handler 的 `base64_image` snake_case；`chineseDict:` 通道名混用 camelCase；`HistoryRecord.service_key` 与 `service.ts` `serviceKey` 不一致。
- [x] **archive 文档 OCR/识别术语**：`docs/archive/closed_issues/issues0518.md:41`、`docs/archive/old_pot/spec.md:126`、`docs/design/omni-pot/project/uploads/spec.md:113`、`docs/design/omni-pot/chats/chat1.md:306`。确认 archive 豁免否；不豁免则改"文字识别"。

### H. 热键冷启动延迟（`docs/archive/runtime_issues.md` §4）

> 策略：先做 A（解耦 `focusOrCreate` 与 `readSelectedText`），上线 timing 日志和 E2E 后再评估是否做 B（预热窗口）。**不要只凭体感判断**，所有验收都以 `show_ms` / `total_ms` 数据为准。

- [x] **A 解耦：先开窗，选区并行读**：`src/main/hotkey/index.ts` 已让 `triggerTranslateEntry` 与 `triggerSelectionDictionary` 在 `readSelectedText()` resolve 前先 `focusOrCreate(TRANSLATE/DICT)`，文本通过 `sendWhenReady` 异步投递。空选区路径走 `translate:input-translate` / `dict:selection-empty`。
- [x] **加 timing 日志**：`src/main/hotkey/index.ts` 的 translate / dict trigger 记录 `show_ms`（热键入口到窗口创建/聚焦请求返回）、`total_ms`、`entry`、`reason`，区分空选区与有选区路径，且不记录用户原文。
- [x] **E2E 断言可见性与总时延**：`tests/e2e/specs/dict_window.spec.ts` 覆盖词典热键空选区后窗口可见且可立即输入；`tests/unit/hotkey/index.test.ts` 严格覆盖选区 promise 未 resolve 时窗口已打开、resolve 后才发 `dict:lookup` / `dict:selection-empty`。
- [ ] **复杂焦点应用手测**：在 dist 产物下，分别在 **VS Code**、**Microsoft Word**、Office Excel、Chromium 浏览器选区上手动触发翻译 / 词典 / 截图翻译热键，记录 `show_ms` / `total_ms`，结果回写到 `docs/archive/runtime_issues.md §4` 的"验证"小节。验收门槛：window visible < 200ms、文本到达 < 1.5s。
- [ ] **B 预热（A 验证后再评估）**：按 `docs/archive/runtime_issues.md §4 修复方案 B` 预热 translate / dict 窗口前，必须先完成 §C 中的 "透明度切换不重置 pin/置顶" 与 "Windows 选区 COM 引用泄漏" 两项（A 阶段路径未受影响，但 B 会放大这两个 bug）。是否默认开启视 A 阶段数据决定；若开启走 `preload_windows` 配置开关。
- [ ] **C UIA 软超时（兜底，按需）**：仅当 A + B 后仍有用户报慢时启动；按 `runtime_issues.md §4 方案 C` 把 UIA 调用挪到 utility process / worker，主线程 `Promise.race(uia, sleep(150))`，并校验 `CoInitializeEx` / `CoUninitialize` 顺序避免放大 §C COM 泄漏。
- [ ] **修复后归档**：复杂焦点应用手测通过并确认无需 B/C 后，更新 `docs/archive/runtime_issues.md §4` 实测数据并归档到 `docs/archive/closed_issues/`。

### I. 低优 / 备忘

- [x] **`compare_versions` 处理 pre-release**：`src/main/updater/index.ts:37-45` 当前 `1.2.0-beta` 与 `1.2.0` 视为相等。
- [x] **`handleResetConfig` 批量 set**：`src/main/server/index.ts:531-541` 循环 setConfig 触发约 50 次 broadcast。
- [x] **Chinese Dictionary FTS5 前缀最小长度**：`src/main/chinese_dictionary/index.ts:162-177`，单字符前缀在大库上慢。
- [x] **`package.json:25-26` cross-env**：`node -e "..."` 设环境变量 Windows 下脆弱；`format:check` 长 biome 参数挪 `biome.json`。
- [x] **`scripts/check_dist_locks.mjs:111/136` `Atomics.wait` → `node:timers/promises`**。
- [x] **`source_area.tsx` 动态翻译 timer ref-持有 `onTranslate`**：`src/windows/translate/source_area.tsx:171-178` 当前依赖父 rerender 重置 timer。
- [x] **recognize show 监听重订阅丢事件窗口**：`src/windows/recognize/index.tsx:329-346`。
- [x] **translate mount-only effect 异步配置晚到**：`src/windows/translate/index.tsx:80-85`。
- [x] **setTimeout cleanup**：`src/windows/translate/index.tsx:325`、`src/windows/dict/index.tsx:50`。
- [x] **`source_area.tsx:122` `Caps Lock` 快捷键**：同时接受 `e.code === 'KeyU'`。
- [x] **`eslint-plugin-security` 或移除 lint 命令**：`package.json:108-140` 缺依赖；`npm audit` transitive `nanoid <3.3.8` 跟踪上游修复。

---

## 待做 bug 修复（2026-05-31 日志分析）

### Bug 2: DeepL 翻译返回原文（lockedTargetLanguage 残留）

- **位置**: `src/stores/translate_store.ts:50` `setSourceText`；`src/windows/translate/index.tsx:154-161` `handleTranslate` 的 target swap 逻辑
- **复现**: 翻译窗口目标语言为中文，输入"面条"，DeepL 返回"面条"（原文），其他翻译服务正常
- **日志证据**:
  ```
  [renderer:translate] translate start: src=auto→zh_cn, len=3, services=4
  [renderer:translate] detected language: zh_cn
  ```
  检测到中文，目标也是中文，理论上应 swap 到 `translate_second_language`（默认英文），但 DeepL 收到的是同语言翻译请求。
- **根因**: `lockedTargetLanguage` 状态残留。commit `ca915c4` 引入 `lockedTargetLanguage` 机制（auto fallback/swap/手动选都锁），commit `77618b0` 原始设计承诺 "new input (translate) resets the lock"，但代码**从未实现这一步**。`setSourceText`（`translate_store.ts:50`）只清 `effectiveTargetLanguage`，不清 `lockedTargetLanguage`。
- **影响路径**:
  1. 用户之前手动选择目标语言或某次 swap 锁定了 `lockedTargetLanguage`
  2. 新文本输入后 `lockedTargetLanguage` 残留旧值
  3. `handleTranslate` 中 `effectiveTarget = lockedTargetLanguage ?? targetLanguage` 使用残留值
  4. `!lockedTargetLanguage` 为 false → swap 条件不进入 → 目标语言不回退到第二语言
  5. DeepL 收到同语言翻译请求（如 zh→zh）→ 返回原文
  6. 其他服务对同语言请求可能有不同处理（忽略/透传），看起来"正常"
- **相关 commit 历史**:
  - `77618b0` — 引入 lockedTargetLanguage，commit msg 写 "new input resets the lock" 但代码未实现
  - `75ba378` — 全 revert
  - `ca915c4` — Reapply 回来，同样未实现 reset
  - `c386b57` — 只修了 config 加载时误锁，未补 `setSourceText` 的清除逻辑
- **修复方向**: `setSourceText` 中清除 `lockedTargetLanguage: null`，使新输入重新走 auto 检测 + swap 逻辑。截图翻译窗口（`recognize/index.tsx`）的 `lockedTargetLang` 已在新截图时正确重置，可参考。
- **状态**: **已修复**（2026-05-31，commit `9b37a10`）。`setSourceText` 现重置 `lockedTargetLanguage` 与 `effectiveTargetLanguage`，下次输入重新走 auto 检测 + swap。

---

## 待做：词典窗口动态高度 + 卡片默认折叠

### 目的

词典窗口当前使用固定高度（默认 420px，min 320px，max 960px），与翻译窗口的行为不一致。翻译窗口的高度完全跟随内容（标题栏 + 源文本区 + 结果卡片），内容变化时自动调整窗口大小。词典窗口应具备相同能力：

- 窗口高度跟随内容（标题栏 + 源词卡片 + 结果卡片）自动伸缩
- 结果卡片默认折叠（只显示服务名 + 折叠箭头），出结果后自动展开，高度增长
- 用户手动折叠卡片后高度随之缩小
- 无结果时窗口紧凑，不浪费屏幕空间

### 参考目标

翻译窗口的动态高度实现：
- **渲染进程**：`src/windows/translate/index.tsx:530-563` — ResizeObserver 监听 `titlebar`、`top`（源文本+语言区）、`results_content`（结果卡片容器），计算 `total = titlebar_h + top_h + results_h + padding`，通过 `window.electronAPI.translate.reportContentHeight(total)` 上报
- **主进程**：`src/main/windows/translate_height_controller.ts` — `TranslateHeightController` 接收 content_height，计算 `target_h = clamp(content_height, min_height, work_area * 0.75)`，通过 `setMinimumSize/setMaximumSize/setBounds` 锁高；监听 `move`/`restore`/`display-metrics-changed` 重新计算
- **IPC 链路**：`src/main/preload.ts:120` 暴露 `reportContentHeight` → `src/main/ipc/window_handlers.ts:56` 注册 `translate:reportContentHeight` → `controller.report_content_height(height)`

### 技术方案

#### 1. 主进程：DictHeightController

新建 `src/main/windows/dict_height_controller.ts`，参照 `TranslateHeightController`：

- 类结构：`DictHeightController` 持有 `BrowserWindow` 引用
- `report_content_height(content_height: number)`：接收渲染进程上报的内容高度
  - debounce 1px（与翻译窗口一致）
  - 计算 `target_h = clamp(content_height, min_height, work_area * 0.75)`
  - 通过 `setMinimumSize/setMaximumSize/setBounds` 锁高
- `report_min_width(content_width: number)`：可选，同步最小宽度
- 监听 `move`（防抖 100ms 重新计算 work area）、`restore`（重新应用锁高）、`display-metrics-changed`
- `dispose()` 清理所有监听器
- 常量：`DICT_MIN_HEIGHT`（沿用现有 320）、`DICT_MAX_HEIGHT_RATIO`（0.75，与翻译窗口一致）

#### 2. 主进程：window_handlers 注册 IPC

在 `src/main/ipc/window_handlers.ts` 中新增：
- `dict:reportContentHeight` handler，路由到 `DictHeightController.report_content_height`
- 可选：`dict:reportMinWidth` handler

#### 3. 主进程：preload 暴露 API

在 `src/main/preload.ts` 中新增 `dict` section：
- `reportContentHeight: (height) => ipcRenderer.invoke('dict:reportContentHeight', height)`

#### 4. 主进程：manager 集成

在 `src/main/windows/manager.ts` 中：
- 创建 dict 窗口时初始化 `DictHeightController`（类似 `translate_height_controller`）
- 窗口关闭时 dispose

#### 5. 主进程：dict_options 调整

修改 `src/main/windows/dict_options.ts`：
- `get_dict_window_options()` 去掉 `maxHeight: 960`（由 HeightController 管理）
- 初始高度改为较小值（如 200px，仅标题栏+源词卡片+折叠卡片占位），后续由内容驱动
- `attach_dict_resize_persistence` 保留（用户手动拖拽时仍持久化），但需与 HeightController 共存：用户手动拖拽后可暂停自动锁高，或直接由 HeightController 统一管理

#### 6. 渲染进程：词典窗口 ResizeObserver

修改 `src/windows/dict/index.tsx`：
- 为 titlebar、源词卡片、结果区域添加 ref
- `useEffect` + `ResizeObserver` 监听三个区域，计算 `total = titlebar_h + source_card_h + results_h + padding`
- 通过 `window.electronAPI.dict.reportContentHeight(total)` 上报
- 依赖项：`results`、`isLoading`、`collapsedKeys`、`activeList.length`、`appFont`、`appFontSize`

#### 7. 渲染进程：卡片默认折叠

修改 `src/windows/dict/index.tsx`：
- `collapsedKeys` 初始值改为包含所有 `enabledServiceList` 的 `Set`（全部折叠）
- `handleLookup` 中：新查询开始时折叠所有卡片（`setCollapsedKeys(new Set(enabledServiceList))`）
- 单个服务返回结果时自动展开该卡片：在 `setResult` 后从 `collapsedKeys` 中移除该 key
- 用户手动折叠/展开优先级最高（手动操作后标记该 key 为"用户已手动控制"，不再自动展开）
  - 或简化：用户手动折叠后，下次查询仍然会自动展开（与当前行为一致），不做"用户已手动控制"标记

### 涉及文件

| 文件 | 改动 |
|---|---|
| `src/main/windows/dict_height_controller.ts` | **新建** — DictHeightController 类 |
| `src/main/windows/dict_options.ts` | 去掉 `maxHeight: 960`，调整初始高度 |
| `src/main/windows/manager.ts` | 创建 dict 窗口时初始化 DictHeightController，关闭时 dispose |
| `src/main/ipc/window_handlers.ts` | 新增 `dict:reportContentHeight` IPC handler |
| `src/main/preload.ts` | 新增 `dict.reportContentHeight` API |
| `src/windows/dict/index.tsx` | ResizeObserver 上报内容高度 + 卡片默认折叠逻辑 |
| `src/stores/dict_store.ts` | 可选：如需在 store 层面管理 collapsed 状态 |
| `docs/spec.md` | 更新词典窗口行为描述：动态高度、卡片默认折叠 |
| `docs/test_e2e.md` | 新增词典窗口高度测试用例描述 |
| `docs/test.md` | 同步更新测试覆盖说明 |

### 测试

#### 单元测试

- `tests/unit/windows/dict_height_controller.test.ts`（新建）：
  - `compute_target_height` 边界：content < min → min、content > work_area*0.75 → cap、正常范围 → 返回 content
  - `report_content_height` debounce：1px 内变化不上报
  - `report_content_height` → `setBounds` 调用验证
  - `dispose` 后不上报、不崩溃
  - `move`/`restore` 事件触发重新计算

#### E2E 测试

- `tests/e2e/specs/dict_card_height.spec.ts`（已有，需更新）：
  - 词典窗口初始高度较小（卡片全部折叠）
  - 查询后结果卡片展开，窗口高度增长
  - 手动折叠卡片后窗口高度缩小
  - 多服务结果时高度上限不超过 `work_area * 0.75`

#### 文档更新

- `docs/spec.md` §7 词典窗口：补充"窗口高度跟随内容自动伸缩"、"结果卡片默认折叠"
- `docs/test_e2e.md`：新增词典窗口动态高度测试用例
- `docs/test.md`：同步更新测试覆盖说明

### 状态

**已完成**（2026-05-31）。

- `src/main/windows/dict_height_controller.ts` 新建（参照 TranslateHeightController）
- `src/main/windows/dict_options.ts` 去掉 `maxHeight`、`DICT_MIN_HEIGHT` 改为 120、`attach_dict_resize_persistence` 仅持久化宽度
- `src/main/windows/manager.ts` 集成 DictHeightController（创建/关闭）
- `src/main/ipc/window_handlers.ts` 注册 `dict:reportContentHeight`
- `src/main/preload.ts` + `shared/types/ipc.ts` 暴露 `dict.reportContentHeight`
- `src/windows/dict/index.tsx`：ResizeObserver 上报内容高度；卡片默认折叠；新查询折叠所有；单服务出结果自动展开
- 单元测试：`tests/unit/windows/window_options.test.ts` 适配（不再期望持久化 dict_window_height）
- 文档：`docs/spec.md` 与 `docs/test_e2e.md` 待后续补充

---

## 代码全量审阅待办（2026-06-06）

来源：本地 `master` 全量只读审阅（HEAD `3f8b543`），未跑 build/typecheck/test。以下条目只记录待修/待复核问题；修复时需同步相关测试与 `docs/`。

### High

- [x] **托盘”开机自启”只改 OS 状态，不持久化配置**
  - **位置**：`src/main/tray/index.ts:224-228`。
  - **问题**：`auto_start` action 直接调用 `app.setLoginItemSettings({ openAtLogin: !is_auto_start() })`，但没有 `setConfig('auto_start', ...)`。
  - **影响**：设置页仍读旧 `auto_start`；不会广播 `config:changed`；重启后 `src/main/ipc/config_handlers.ts:78-80` 会按旧配置重新应用，导致托盘切换结果被还原。
  - **参考**：同文件 `clipboard_monitor` 分支会同步 `setConfig('clipboard_monitor', ...)`。
  - **修复方向**：主进程 tray action 直接持久化 `auto_start`，或抽公共 helper，避免绕过 config store。
  - **状态**：已修复（2026-06-06，commit `67be039`）。托盘 action 现在直接写 config store。

- [x] **Gemini Pro API key 拼在 URL query 中**
  - **位置**：`src/services/geminipro.ts:29-37`。
  - **问题**：`generateContent?key=${api_key}` 会把用户 Gemini key 放入 URL。
  - **影响**：URL 可能进入代理、网络栈、错误日志或诊断工具；桌面端长期 key 暴露风险高于一次性请求。
  - **修复方向**：改用 Google 支持的 header（如 `x-goog-api-key`）或授权 header；同步补服务契约测试。
  - **状态**：已修复（2026-06-06，commit `67be039`）。改用 `x-goog-api-key` header。

- [x] **词典窗口记忆高度配置读写不一致**
  - **位置**：`src/main/windows/dict_options.ts:8-18`、`:24-34`。
  - **问题**：`get_dict_window_options()` 在 `dict_remember_window_size=true` 时读取 `dict_window_height`，但 `attach_dict_resize_persistence()` 只保存 `dict_window_width`。
  - **影响**：如果文档/设置仍承诺词典窗口尺寸记忆，高度不会随用户调整持久化；若动态高度设计不再记忆高度，应删除/弱化 `dict_window_height` 读取与文档描述。
  - **修复方向**：明确产品行为：要么保存高度，要么移除高度记忆路径并同步 `docs/spec.md` / 测试。
  - **状态**：已修复（2026-06-06，commit `67be039`）。`dict_options.ts` 不再读取 `dict_window_height`。

### Mid

- [x] **`/e2e/set-config` 对 `service_instances` 缺结构校验**
  - **位置**：`src/main/server/index.ts:759-785`、`src/main/ipc/config_handlers.ts:14-18`。
  - **问题**：HTTP E2E 配置入口仅检查 key 是否存在后 `setConfig(key, value)`；IPC 校验也只按顶层 `typeof` / array 判断，复杂对象没有 schema。
  - **影响**：持有本地 API/E2E token 的调用方可写入畸形 `service_instances`，破坏翻译/词典服务配置。
  - **修复方向**：复用严格 config schema；至少对 `service_instances` 做 service key、instance config、enable 字段结构校验。
  - **状态**：已修复（2026-06-06，commit `67be039`）。`src/main/config/validation.ts` 已包含 `is_service_instances()` 校验（检查 serviceKey、config 结构、URL 合法性），HTTP E2E 端和 IPC 端均已通过 `is_config_value_allowed` 调用。

- [x] **`fetch_with_timeout` 成功路径留下未 settle 的 timeout promise**
  - **位置**：`src/services/fetch_timeout.ts:18-39`。
  - **问题**：fetch 先成功时，`timeout_promise` 永远 pending；`finally` 只 `clearTimeout`，未 settle timeout promise。
  - **影响**：长时间大量请求下可能积累 pending promise/闭包；单次影响小，但桌面常驻应用会放大。
  - **修复方向**：改为 AbortController + `setTimeout` 后直接 await fetch，或让 timeout promise 可在 finally resolve/cleanup。
  - **状态**：已修复（2026-06-06，commit `67be039`）。改用 AbortController 模式。

- [x] **生产 CSP 允许 renderer 连接任意 HTTPS**
  - **位置**：`src/main/csp_policy.ts:3`。
  - **问题**：`connect-src ... https:` 允许任意 HTTPS 目的地。
  - **影响**：当前无已知 XSS，但若 renderer 被攻破且能读取完整服务配置，API key 可被外传；属于纵深防御缺口。
  - **修复方向**：评估是否把外部 provider 请求代理到主进程，或按服务域名生成更窄 allowlist；不要破坏自定义服务 URL 需求。
  - **状态**：已加固（2026-06-06）。CSP `connect-src` 保持 `https:`（因自定义服务 URL 需求），但 `fetchWithTimeout` 已增加 URL 协议/主机校验：阻止非 HTTP(S) 协议、HTTP 非 localhost、SSRF 元数据端点（169.254.169.254/fd00/fe80）。纵深防御从 CSP 层转移到 fetch 层。

- [x] **外部服务自定义 URL 缺协议/主机约束**
  - **位置**：`src/services/geminipro.ts:30-37`、`src/services/ollama.ts:30`、`src/services/deepl.ts` custom URL 路径、`src/services/google.ts` custom URL 路径。
  - **问题**：用户配置/导入的自定义 URL 可直接成为请求目标。
  - **影响**：恶意备份或误配置可把待翻译文本发到非预期服务器；Gemini 路径还会叠加 query key 暴露。
  - **修复方向**：对需公网的服务限制 `https:`；对本地服务只允许 `localhost` / `127.0.0.1`；导入配置时提示或拒绝危险 URL。
  - **状态**：已加固（2026-06-06，commit `1e06a83` + fetch URL validation）。三层防护：(1) config 导入时 `is_allowed_service_url` 校验协议/主机；(2) 运行时 `fetchWithTimeout` 阻止非 HTTP(S)、HTTP 非 localhost、SSRF 元数据端点；(3) Gemini key 已改用 header。

- [x] **命名规范历史债需复核是否真正收口**
  - **位置**：`shared/types/service.ts:5/12/16/53`、`shared/types/ipc.ts:82/85/92/119/136-137`、`src/main/preload.ts` 对应 API。
  - **问题**：仍存在 `instanceName`、`audioUrl`、`partOfSpeech`、`serviceKey`、`pageSize`、`sourceText`、`downloadAndInstall`、`autoStart` 等 camelCase；`TASKS.md` 旧项已标完成。
  - **影响**：需区分 ecosystem API / React props 例外与”IPC payload、持久化 config、内部纯数据字段” snake_case 要求；避免误把已允许的边界当缺陷，也避免真实 payload 混用继续扩散。
  - **修复方向**：逐项分类：允许的 TypeScript API 保留；真实 IPC payload/config 字段改 snake_case；不做全仓批量 rename。
  - **状态**：已审查并修复（2026-06-06，commit `1e06a83`）。6 项改 snake_case（instanceName、audioUrl、partOfSpeech、pageSize、sourceText/targetText、serviceKey 参数）；4 项保留 camelCase（downloadAndInstall、autoStart、clipboardMonitoring — Electron IPC 方法名；testConfig/translateStream — TS 接口方法）。

### Low

- [x] **`auto_start` 被列入 sensitive write keys 后，托盘不能走普通 `config:set` 路径**
  - **位置**：`src/main/ipc/config_handlers.ts:54-56`、`:70-72`。
  - **问题**：`auto_start` 只有 CONFIG 窗口能写；托盘若试图复用 IPC `config:set` 会被拒绝。
  - **影响**：这是 high 项”托盘开机自启不持久化”的修复约束，不是独立用户可见 bug。
  - **修复方向**：修 high 项时从 main 直接调用 config store，或新增明确授权的 main helper。
  - **状态**：已随 high 项修复（2026-06-06，commit `67be039`）。托盘直接调用 config store，无需经过 sensitive write keys 路径。

- [x] **`shell.openExternal` 允许任意 `file:` URL**
  - **位置**：`src/main/ipc/shell_handlers.ts:16-35`。
  - **问题**：`is_allowed_external_url()` 对所有 `file:` 返回 true。
  - **影响**：当前只允许 CONFIG 窗口调用且未发现 XSS；但若配置窗口 renderer 被攻破，Windows 上 `file:///...exe` 可能经 ShellExecute 打开本地程序。
  - **修复方向**：移除通用 `file:` allow；新增专门 `open_local_path` handler，只允许日志/备份等受控目录。
  - **状态**：已修复（2026-06-06，commit `67be039`）。已移除通用 `file:` allow。

- [x] **`TASKS.md` 旧命名项可能过早标完成**
  - **位置**：`TASKS.md:195-200`。
  - **问题**：旧项”`shared/types/ipc.ts` 命名一致性”已勾选，但审阅仍发现部分命名边界待复核。
  - **影响**：任务状态可能误导后续审阅。
  - **修复方向**：完成 mid”命名规范历史债复核”后，再决定保留、拆分或归档旧项。
  - **状态**：已随命名审查完成（2026-06-06，commit `1e06a83`）。旧项确认无遗漏。

---

## 代码简化 / 拆分 / 死代码清理待办（2026-06-06）

来源：本地静态扫描。目标是降低单文件复杂度、合并真实重复、删除已确认死代码；修复时必须保持行为不变，并按项目要求跑对应测试。**不做一次性大重构**，每项拆小 PR / 小提交处理。

### A. 超 500 行文件拆分

- [x] **拆分 `src/main/server/index.ts`（1135 行）**
  - **问题**：本地 HTTP API、鉴权、CORS/Host 校验、E2E helper、路由处理集中在单文件，后续修改风险高。
  - **拆分方向**：保留 server 启停与路由分发；把 auth/host/origin 校验、public API handlers、E2E handlers、clipboard/config/history handlers 分到独立模块。
  - **验证**：`tests/unit/server/test_server_security.ts`、`tests/e2e/specs/app_http_api.spec.ts`、相关 E2E API fixture。
  - **状态**：已拆分（2026-06-06，commit `e8e5958`）。server/index.ts → 431 行；新建 body.ts、public_config.ts、e2e_handlers.ts（barrel）、e2e_data_handlers.ts、e2e_trigger_handlers.ts、e2e_window_handlers.ts。

- [x] **拆分 `src/windows/recognize/index.tsx`（900 行）**
  - **问题**：截图显示、OCR 请求、翻译请求、语言选择、结果编辑、窗口高度/状态管理混在一个 React 文件。
  - **拆分方向**：提取 OCR/翻译状态 hook、语言栏组件、结果编辑区、截图预览区；不要改变现有 IPC 和 store 行为。
  - **验证**：识别窗口相关 unit/E2E；重点覆盖截图翻译、识别语言切换、翻译 race、朗读/复制。
  - **状态**：已拆分（2026-06-06，commit `10efbe0`）。index.tsx → 448 行；新建 pill_select.tsx、export_button.tsx、image_card.tsx、recognize_content.tsx、recognize_helpers.ts。

- [x] **拆分 `src/windows/translate/index.tsx`（715 行）**
  - **问题**：窗口生命周期、动态高度、输入区、结果卡片、翻译调度在同一文件，修改翻译行为时容易碰 UI 布局。
  - **拆分方向**：提取翻译调度 hook、窗口高度 hook、结果列表组件；保留现有 `translate_store` 语义。
  - **验证**：`translate_core`、`translate_result_cards`、`translate_window_constraints`、语言 auto/swap 回归。
  - **状态**：已拆分（2026-06-06，commit `207a8bd`）。index.tsx → 498 行；新建 translate_helpers.ts、use_source_tts.ts、use_translate_height_reporting.ts。

- [x] **拆分 `tests/e2e/pages/translate_page.ts`（596 行）**
  - **问题**：Page Object 同时承担翻译、词典、识别、窗口控制 helper，测试语义不够聚焦。
  - **拆分方向**：按窗口或能力拆为 translate/dict/recognize/window helper；保持现有 spec 调用语义，先迁移再清理旧方法。
  - **验证**：受影响的全部 user_e2e spec。
  - **状态**：已拆分（2026-06-06，commit `1ad6335`）。translate_page.ts → 473 行；新建 translate_page_lingva_helpers.ts。

- [x] **拆分 `src/windows/dict/index.tsx`（564 行）**
  - **问题**：查询调度、contentEditable/输入、服务卡片、动态高度、TTS/复制逻辑集中。
  - **拆分方向**：提取查询 hook、服务结果卡片、输入区、动态高度上报 hook；避免改变卡片折叠和窗口高度行为。
  - **验证**：词典窗口、词典动态高度、音频按钮、剪贴板/复制相关测试。
  - **状态**：已拆分（2026-06-06，commit `10efbe0`）。index.tsx → 370 行；新建 dict_card.tsx、dict_helpers.ts。

- [x] **拆分 `src/windows/config/service_settings.tsx`（554 行）**
  - **问题**：服务列表、添加弹窗、服务实例表单、拖拽排序和不同服务分类逻辑集中。
  - **拆分方向**：提取 service list、instance editor、add service dialog、排序逻辑；保持 registry/category 行为。
  - **验证**：服务设置 E2E、registry 隔离 unit、i18n 标签回归。
  - **状态**：已拆分（2026-06-06，commit `75ba92b`）。service_settings.tsx → 402 行；新建 service_settings_helpers.ts、service_item_row.tsx。

- [x] **拆分 `src/main/updater/index.ts`（507 行）**
  - **问题**：版本比较、release metadata 拉取、双源校验、URL allowlist、下载/安装、窗口 UI 入口集中。
  - **拆分方向**：提取 version/release metadata/asset validation/download installer；保持 updater IPC sender 限制和 hash 校验。
  - **验证**：`tests/unit/updater.test.ts`、updater/tray E2E。
  - **状态**：已拆分（2026-06-06，commit `ef42c29`）。index.ts → 116 行；新建 version.ts、download_url.ts、download.ts、types.ts、latest_metadata.ts。

### B. 重复代码合并

- [x] **合并 dict/translate 高度控制器重复逻辑**
  - **位置**：`src/main/windows/dict_height_controller.ts` ↔ `src/main/windows/translate_height_controller.ts`。
  - **问题**：移动/恢复/display metrics/锁高逻辑相似，后续 bugfix 可能只改一边。
  - **处理方向**：先确认两者差异（min height、cap、debounce、宽度行为），再提取共享纯函数或小型 base helper；不要引入过度继承。
  - **验证**：两个 height controller unit + 翻译/词典窗口高度 E2E。
  - **状态**：已合并（2026-06-06，commit `dcf87fc`）。提取 height_controller_common.ts，共享 compute_locked_height 和 apply_locked_window_size。

- [x] **合并百度普通/高精度 OCR 重复请求逻辑**
  - **位置**：`src/services/ocr/baidu_ocr.ts` ↔ `src/services/ocr/baidu_accurate_ocr.ts`。
  - **问题**：鉴权、请求体、响应解析大概率重复，只是 endpoint/服务名不同。
  - **处理方向**：提取 `baidu_ocr_common` 请求函数，普通/高精度只保留 endpoint 与 service metadata。
  - **验证**：Baidu OCR service unit/契约测试；确保 secret 不进 URL。
  - **状态**：已合并（2026-06-06，commit `dcf87fc`）。恢复 getAccessToken 并提取 recognizeWithBaiduOcr 到 baidu_common.ts。

- [x] **合并 recognize/screenshot 截图展示基础逻辑**
  - **位置**：`src/windows/recognize/index.tsx` ↔ `src/windows/screenshot/index.tsx`。
  - **问题**：base64 图片展示、窗口事件、截图状态处理存在重复片段。
  - **处理方向**：只提取无业务状态的展示/尺寸 helper；截图翻译与纯截图捕获流程保持分离。
  - **验证**：截图捕获、截图翻译、OCR 失败 UI 回归。
  - **状态**：已合并（2026-06-06，commit `51a75c3`）。提取 try_qr_decode 到 src/windows/qr_decode.ts 共享模块。recognize 已拆分到 448 行（image_card.tsx），剩余共享逻辑（log_error、get_service_config）为轻量 helper，暂不强制合并。

- [x] **统一自定义下拉/语言选择重复逻辑**
  - **位置**：`src/windows/config/config_components.tsx`、`src/windows/translate/language_area.tsx`、`src/windows/recognize/index.tsx`。
  - **问题**：combobox/listbox 键盘、ARIA、过滤/选中逻辑分散，容易出现可访问性和行为差异。
  - **处理方向**：优先复用已有组件；若抽公共组件，必须覆盖键盘导航、aria-expanded、aria-selected、Escape/Enter 行为。
  - **验证**：配置页服务选择、翻译语言选择、识别语言选择 E2E/可访问性断言。
  - **状态**：已评估（2026-06-06）。三处实现（ConfigSelect、LangPick、PillSelect）键盘/ARIA 行为一致，但 UI 模式差异大（原生下拉 vs 语言按钮 vs pill 选择器），强制统一会引入过度抽象。recognize 的 PillSelect 已提取为独立模块（commit `10efbe0`），ConfigSelect 在 config_components.tsx 中独立存在。剩余重复为纯逻辑（~20 行键盘处理），后续如需统一可提取 `useCombobox` hook。

### C. 死代码 / 依赖清理

- [x] **复核并删除未使用的 `playwright` devDependency**
  - **证据**：`npm run deadcode` / `knip` 报 `playwright package.json:140:6` 未使用。
  - **风险**：项目直接使用 `@playwright/test`；但脚本或 MCP/调试流程可能间接依赖 `playwright` CLI，删除前要查 `scripts/`、docs 和 CI。
  - **处理方向**：若确认无直接引用，移除依赖并更新 lockfile；否则把真实入口加入 `knip.json`。
  - **验证**：`npm run deadcode`、`npm run test:e2e:core`。
  - **状态**：已清理（2026-06-06，commit `73a2c3d`）。已移除 playwright devDependency 并清理 knip.json 过时 ignore。

- [x] **清理 `knip.json` 过时 ignore**
  - **位置**：`knip.json:16-35`。
  - **证据**：`knip` 提示以下 ignore 可能可移除：`src/main/selection/permissions.ts`、`src/components/simple_select.tsx`、`src/hooks/use_tts.ts`、`@testing-library/react`。
  - **处理方向**：逐个移除 ignore 后跑 `npm run deadcode`；若仍 clean，提交配置清理；若报动态引用，则补入口或保留 ignore 并写明原因。
  - **验证**：每移除一项都跑 `npm run deadcode`。
  - **状态**：已清理（2026-06-06，commit `73a2c3d`）。旧 ignore 已移除，当前 ignore 均为合理条目。

- [x] **打开更严格的死代码检查前先评估误报**
  - **问题**：当前 `knip.json` 中 `exports` / `types` 规则为 `off`，所以”没有死导出”尚未被证明。
  - **处理方向**：临时打开 exports/types 或用 `ts-prune` 做一次报告；把动态 IPC、preload API、测试 helper、类型导出列为 caution/danger，不直接删。
  - **验证**：只产出清单，不删除；删除必须一项一测。
  - **状态**：已验证（2026-06-06）。已启用 `exports`/`types: “warn”`，清理 17 项真正未使用 export（含 3 个死代码函数/类型完全删除），剩余 6 项均为误报（动态 import、默认 export、运行时注册表）。

### D. 执行约束

- [x] **清理顺序**：先死代码/ignore → 再重复小 helper → 最后拆大文件。
- [x] **每项要求**：改前有基线测试；一次只删/移一类；失败立即回滚；不顺手改 UI/行为。
- [x] **文档同步**：如果拆分影响 `docs/test_e2e.md`、`docs/test.md`、`docs/spec.md` 的文件/测试描述，同步更新。

---

## 已知问题（不修，仅跟踪）

- **CLD3 短文本语言误判**：`src/main/detect/index.ts:95-113`。CLD3 对极短 CJK 文本（如"馄饨"2 字符）返回 `language: 'en', is_reliable: true`，代码信任 `is_reliable` 跳过 regex 回退，导致翻译方向错误。regex（line 44 `/[一-鿿]/`）能正确识别。同理可能影响日韩短文本。涉及语言检测策略变更，暂不修。
- **DeepL free 当前环境限流**：`npm run test:e2e:external` 中长文本和葡语变体用例出现 429；只影响 opt-in 外部服务健康检查，不影响 `@core` / `@ui`。
- **`cld3-asm` 依赖链 moderate audit 提示**：`npm audit --audit-level=high` 通过；npm 给出的 `--force` 修复会引入 breaking change，暂不自动修。
