# omni_pot 代码审阅报告

**审阅日期**: 2026-06-22  
**审阅范围**: 全仓库源码 + 测试 + 配置 + 文档  
**审阅方式**: 8路并行SubAgent + 手动核心代码复查  
**代码总行数**: ~22,000行（含测试）  

---

## 一、总体评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构设计 | B+ | 服务注册表模式统一，主/渲染进程职责分离清晰，窗口管理器设计良好 |
| 类型安全 | B | TypeScript覆盖率较高，但多处使用 `as` 断言绕过检查；接口参数不一致 |
| 可维护性 | B | 组件拆分合理，但inline style泛滥，重复dropdown实现，部分文件过长(>500行) |
| 安全性 | B | CSP开启，IPC sender验证覆盖大部分通道，但存在sender验证缺失和token泄露风险 |
| 测试覆盖 | B | E2E核心路径覆盖充分，单元测试偏薄，部分服务缺错误分支测试 |
| SPEC一致性 | B+ | 核心功能与SPEC §5-§33对齐，部分SPEC标注细节未实现 |

---

## 二、按模块问题汇总

### 2.1 前端窗口（src/windows/）

#### translate/index.tsx — 核心逻辑过重
- **`handleTranslate` (L151-278) 闭包依赖膨胀**：依赖数组包含14项，函数体内又通过 `getState()` 重复读取，模式不统一。建议将 `handleTranslate` 拆分为 `detectLanguage + buildRequest + dispatchCalls` 三个阶段函数，依赖统一从参数注入。
- **`handleRetry` (L408-468) 重试时独立管理 `retryRequestRef`**：与主流程的 `requestId` 机制独立，重试完成后 `setIsTranslating(false)` 在 finally 中执行，但若其他服务仍在运行会错误清除全局 translating 状态。
- **`isActiveRequest` vs `isCurrentRetry` 守卫重复**：两个函数逻辑几乎相同，应提取为共享的 "requestSnapshotGuard" 工具。

#### translate/target_area.tsx — 性能与DnD
- **未使用 `React.memo` (L177)**：`TargetArea` 非 memo 化，导致任何 state 变化都触发全部 `SortableCard` 重渲染。应包裹 `React.memo`。
- **DnD reorder 逻辑丢失 disabled 服务顺序 (L177-337)**：`handleDragEnd` 修改 `translate_service_list`，但 `serviceList` prop 是 `enabledServiceList`。若列表中有 disabled 服务，reorder 后它们的位置会丢失。
- **TTS 竞争条件 (L222-269)**：`playingRequestRef` 与 `playingCleanupRef` 三重 ref 管理，快速点击两个卡片的 TTS 按钮可能导致状态混乱。

#### translate/use_source_tts.ts — 无意义ESLint禁用
- L1: `/* eslint-disable react-hooks/rules-of-hooks */` 无实际意义，文件内hook使用合法，应移除。
- `handleSourceTts` 在 `useCallback` 内读取 `getState().sourceText` 但 `sourceText` 不在依赖数组中，虽功能正确但 ESLint 会报错。

#### translate/language_area.tsx — Dropdown重复
- `LangPick` (L13-195) 与 recognize/pill_select.tsx 的 `PillSelect` 功能高度重复：portal dropdown、键盘导航、measure定位、scrollIntoView 逻辑几乎一致。**应统一为通用 `Dropdown` 组件**。

#### recognize/index.tsx — auto-translate依赖缺失
- **中 (L148-157) auto-translate effect 依赖设计意图明确但有隐患**: `useEffect` 依赖数组仅为 `[recognizeShowId]`，`recognizedText` 通过闭包/ref 读取，设计意图是在 showId 变化时触发一次翻译。但若 `recognizedText` 尚未通过 setState 更新（mode 切换异步），可能使用过期文本。**建议将 `recognizedText` 加入依赖数组，或确认 ref 时序无问题**。
- **OCR引擎串行执行 (L111-148)**：与翻译窗口并行策略不一致（翻译是并行调用所有服务，OCR是逐个尝试直到第一个成功），耗时累加。
- **截图窗口 `ready` 调用位置 (L69)**：在 `onScreenshotShow` listener 中调用 `window.electronAPI.ready('screenshot')`，应在 mount 时调用。

#### dict/index.tsx — reorder逻辑
- **DnD同时修改两个列表 (L248-275)**：`handleDragEnd` 同时更新 `dictionary_service_list` 和 `english_dictionary_service_list`，但只 reorder 当前 `activeList`。若中英文列表有重叠服务，reorder 可能导致不一致。
- **lookup词截断 (L87)**：`trimmed.split(' ')[0]` 只取第一个单词，多词查询如 "hello world" 只查 "hello"。

#### dict/dict_card.tsx
- **音频无引用管理 (L87-97)**：`new Audio(p.audio_url)` 直接播放，无引用保存，快速点击会导致多个音频重叠播放。
- **POS tag分组内联IIFE (L107-156)**：可读性差，应提取为独立函数。
- **双语例句只显示source (L159-173)**：`ex.source` 展示但 `ex.target` 不显示。

#### welcome/index.tsx
- **关闭窗口不标记完成**：点击 titlebar X 调用 `close_welcome()` 但不调用 `finish_welcome()`，下次启动仍显示欢迎页。若 SPEC 要求"关闭即跳过"需修复。
- **ResizeObserver过度观测**：同时观测 `main_ref` 及其每个子元素，开销大，观测祖先即可。

#### screenshot/index.tsx
- **OCR串行策略偏差 (L111-148)**：与SPEC并行策略不一致。
- **ready调用位置 (L69)**：应在mount时而非收到消息时调用。
- **小选区不关闭窗口 (L101-103)**：`rect.width < 5` 时 return 但不关闭，用户可能困惑。

#### config/hotkey_settings.tsx — Backspace修饰键误判
- **L79**: `if (e.key === 'Backspace')` 未检查 `e.ctrlKey/shiftKey/altKey`，导致 `Ctrl+Backspace` 被清空而非记录为快捷键。

#### config/service_settings.tsx — 过度订阅
- **L35-41**: `categoryCounts` 使用5个独立 `useConfigStore` selector，每次任何计数变化触发5次潜在重渲染。应合并为单个 selector。
- **未过滤已添加服务 (L44)**: `availableServices` 未排除列表中已存在的服务，用户可重复添加。

#### config/backup_settings.tsx
- **硬编码中文 (L37-40)**: `BACKUP_TYPES` 的 `label` 和 `sub` 为硬编码中文，应使用 `t()`。
- **WebDAV占位实现**："测试连接"按钮直接返回固定消息 "WebDAV同步功能即将推出"，应在 `PLAN.md` 标记。

#### config/history_settings.tsx — 拼写错误
- **L29**: `'sogai': 'SG'` 疑似拼写错误，应为 `'sogou': 'SG'` 或 `'sogou': 'SO'`。
- **L29**: `'translatetranslate': 'TT'` 疑似冗余或拼写错误。

#### config/general.tsx
- **受控/非受控混合 (L68)**: `serverPort` 使用 `defaultValue` 而非 `value` 传给 `ConfigField`，用户清空输入时状态不同步。
- **字体配置无UI入口**: `app_font`、`app_fallback_font`、`app_font_size` 在 `AppConfig` 中定义但设置窗口无对应控件。

#### updater/index.tsx
- **未按平台过滤asset (L某行)**: `release.assets[0]` 直接取第一个asset，release可能含多平台包，应结合 `process.platform/arch` 匹配。
- **changelog粗体丢失**: `format_changelog` 先用 `replace(/\*\*(.+?)\*\*/g, '$1')` 剥除 `**` 标记，粗体被删除。
- **时区硬编码**: `format_date` 直接 `+ 8 * 3600000` 转CST，若日期本身含时区信息则错误。

---

### 2.2 主进程（src/main/）

#### main.ts
- **startHttpServer retry逻辑缺陷**: 最后非 `EADDRINUSE` 错误只 `log.error` 不 throw，调用方误以为启动成功。
- ~~`will-quit` 未调用 `setQuitting()`~~: **误报** — `before-quit` 事件已在 `WindowManager` 构造函数（`manager.ts` L72）中设置 `_quitting = true`，无需在 main.ts 重复调用。

#### csp_policy.ts
- **生产环境 `connect-src https:` 通配符**: L3 允许任何 HTTPS 域连接，renderer 通常不需要直接连接外部 HTTPS（翻译/TTS走主进程代理）。**建议收紧为明确域名白名单**。

#### ipc/window_handlers.ts — 严重：缺失sender验证
- **Critical**: `window:close`, `window:minimize`, `window:maximize`, `window:setAlwaysOnTop`, `window:setContentSize`, `window:setContentHeight`, `window:getLabel`, `app:getVersion` **均无 sender 验证**。
- **尤其危险**: `window:openConfig` 无验证意味着**任何窗口都可打开配置窗口**，可能被恶意 renderer 滥用。

#### ipc/config_handlers.ts
- **config:set 验证失败返回 undefined (L64-68)**: 调用方无法区分成功/失败。建议返回 `false` 或 throw。

#### ipc/ocr_handlers.ts — PowerShell脚本拼接
- **中 (L27-48)**: `windows_ocr` 中 `image_path` 被直接拼接到 PowerShell 脚本字符串中。虽单引号做了 `''` 转义，且 `image_path` 来源为内部 `tmpdir() + randomUUID()`（可控），实际注入难度较高，但防御性不足。**建议改为调用外部 ps1 文件并传 `-File` 参数**。

#### ipc/chinese_dictionary_handlers.ts
- **超长查询截断 (L109-111)**: `stripped.length > 100` 时返回空字符串，长文本被静默拒绝。

#### ipc/dict_handlers.ts
- **语言判断粗糙 (L66)**: `from === 'auto'` 时仅基于 `\/^[a-zA-Z]/` 判断，纯数字或符号开头会被误判。

#### windows/manager.ts
- **`server_api_token` 暴露在命令行参数中**: `sanitize_config_for_renderer` 只删除 `webdav_password` 和 `service_instances`，但 `server_api_token` 仍通过 `additionalArguments` 暴露。**安全：命令行可见敏感token**。
- **rebuildForTransparencyChange时序**: `win.close()` 后立即 `createWindow()`，旧窗口可能未完全关闭导致 ID 冲突。
- **unresponsive事件无恢复动作**: 仅记录日志，长时间无响应窗口会僵死。

#### tray/index.ts
- **Survey URL指向编辑页而非填写页**: `SURVEY_URL` 指向 `wj.qq.com/edit?sid=...` 而非 `/fill`。用户打开会进入问卷编辑后台。

#### hotkey/index.ts
- **无toggle hide逻辑 (SPEC偏差)**: SPEC §21 要求热键在窗口可见时切换隐藏，当前实现只有 `focusOrCreate`，缺少 toggle hide。
- **`buildHotkeyAction` 静默丢弃未知action**: `default: return () => {}` 无日志记录。

#### server/index.ts
- **Host header解析可加固**: `is_host_allowed` 对 `host` 使用 `new URL("http://${host}")`，若传入 `localhost:20202@evil.com` 可能解析为 `evil.com`。
- **`/translate` 端点无文本长度限制**: `readBody` 默认10MB，大文本可能导致翻译窗口卡死。
- **CORS origin检查可能阻断file scheme请求**: `is_origin_allowed` 的正则无法匹配 `file://` origin。

#### selection/windows.ts — koffi COM调用
- **vtable索引为硬编码magic number**: 8, 16, 5, 3, 4, 12 等无注释说明来源，维护困难。
- **RPC_E_CHANGED_MODE时直接返回null**: 未尝试STA初始化或其他fallback。

#### config/store.ts
- **`getConfig` 环境变量override与 `setConfig` 不一致**: E2E场景下 `setConfig('server_port', ...)` 写入文件但 `getConfig` 仍返回环境变量值，可能导致逻辑不一致。
- **迁移逻辑频繁写盘**: 多个迁移分支均调用 `saveToDisk()`，虽然有300ms debounce，但多次调用可能仍触发多次写入。
- **broadcastAllConfig逐条IPC广播**: 启动时可能产生性能开销（但配置键数量有限，可接受）。

#### clipboard/index.ts
- **suppression后200ms窗口可能误捕获**: `cleanup_suppress_until` 后200ms内若用户真实复制了内容仍会被捕获。

#### backup/index.ts
- **ZIP无压缩**: 手写ZIP使用STORED，对 `history.db`（可能达数百MB）备份体积大。
- **外部zip_path未校验**: `restore_from_zip_path` 接收外部传入路径，未做路径遍历校验（虽然入口由IPC控制）。

#### detect/index.ts
- **WASM失败后无退避重试**: `wasm_state = 'failed'` 但下次调用会重试，若WASM文件确实缺失，每次翻译都会触发一次超时等待。**应增加指数退避**。

#### chinese_dictionary/index.ts
- **窗口广播范围稍宽**: `set_service_state` 中 `BrowserWindow.getAllWindows()` 包含 daemon/screenshot 等不需要的窗口。

#### dict/index.ts
- **LIKE查询无索引**: `english LIKE ? LIMIT 20` 通配符在两侧，但词典数据量有限（~10万条），可接受。

---

### 2.3 服务层（src/services/）

#### deepl.ts — 严重：密钥泄露
- **L216: `log.info(... config=%j, config)` 将完整 `authKey` 写入日志**: SPEC §9.12 规定"API key 仅记录前4+后4字符"。**需脱敏**。
- **L17: `zh_tw_hant: 'ZH-Hant'` 为死映射**: `'zh_tw_hant'` 不是 `LanguageCode` 合法成员，永远不会命中。

#### alibaba.ts — 签名兼容性
- **L45-50: `percentEncode` 将 `~` 编码为 `%7E`**: RFC3986 中 `~` 是 unreserved character，不应编码。阿里云签名规范遵循 RFC3986，此偏差可能导致签名验证失败。

#### bing.ts — 接口不一致
- **`translate(text, from, to)` 只声明3参数**，但 `TranslateService` 接口要求4参数。运行时多余参数被忽略，属于隐式接口违约（不影响功能）。

#### chatglm.ts / geminipro.ts — SPEC未实现
- SPEC §13 标注这两个服务为**流式**（支持 `translateStream`），但代码中均未实现。Ollama 已正确实现流式。

#### baidu.ts / baidu_field.ts — 重复代码
- 盐值生成、MD5签名、请求构造、响应解析几乎完全相同，仅 endpoint 和 `domain` 参数不同。**应提取为共享函数**。

#### tencent_sign.ts / volcengine_sign.ts — 重复代码
- 两者均为 HMAC-SHA256 链式签名，日期处理、canonicalRequest构造、TC3/HMAC-SHA256推导逻辑高度重复。**应提取为通用 AWS Signature V4 工具**。

#### fetch_timeout.ts — SSRF防护不完整
- 仅阻止 `169.254.169.254`、`fd00:`、`fe80:`，未覆盖 `10.0.0.0/8`、`192.168.0.0/16`、`172.16.0.0/12`、`127.0.0.1`（非HTTP时）等内网段。`https:` 协议下可指向任意内网地址。

#### ollama.ts — 流式解析鲁棒性
- L64: `try { JSON.parse(line) } catch { /* skip */ }` 跳过非法JSON行不报错，可能导致无翻译输出但无错误提示。

#### cambridge_dict.ts — 已知风险
- HTML正则解析脆弱，SPEC §33 已列为外部风险。

#### detect.ts — 正确性良好
- Unicode正则兜底方案对中文长句和日韩区分正确，与SPEC §16一致。

#### tesseract.ts
- **依赖外网CDN (L38)**: `TESSERACT_LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0'`，离线环境不可用。
- **worker路径依赖window.location.href (L55-58)**: 若页面被XSS篡改href，可能加载恶意worker。
- **接口参数不一致**: `recognize` 只接受2参数，但 `OcrService` 接口要求3参数。

#### system.ts (OCR)
- `navigator.platform` 已废弃，未来不可靠。

#### qrcode.ts
- `recognize` 只接受1参数，接口要求3参数。

#### simple_latex_ocr.ts
- **正则过于激进 (L某行)**: `latex.replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{[^}]*\})?/g, '')` 会删除**所有**LaTeX命令（如 `\frac{}{}`），把公式变成无结构纯文本。这是设计意图还是bug需确认。

---

### 2.4 OCR/TTS服务（src/services/ocr/, src/services/tts/）

（本区域已包含在2.3中，以下为补充）

#### tts/system_tts.ts
- **初始语音竞争 (L40-107)**: `wait_for_voices().then(...)` 内先 `cancel()` 再 `speak()`，等待期间用户点击其他文本可能导致新旧utterance竞争。`done` Promise只resolve一次，竞争状态下stop可能泄漏。
- **隐私**: `log.info('play: lang=%s, len=%d', language, text.length)` 记录用户文本长度，虽无内容但涉及行为数据。

#### tencent_sign.ts / volcengine_sign.ts
- **`.buffer as ArrayBuffer` 类型断言**: `hexToBytes(kDate).buffer as ArrayBuffer` 无运行时保护，若实现变更可能产生错误buffer。
- **时区硬编码**: `8 * 3600000` 硬编码东八区，虽符合腾讯云API要求但无注释说明。

#### baidu_img_ocr.ts
- **多次大内存转换**: base64 → Uint8Array → 逐字节binary_string → SparkMD5 → Blob，对大图片开销高。
- **空配置无前置校验**: `appid`/`secret` 为字符串空值时进入签名流程，返回模糊错误。

#### iflytek_ocr.ts / iflytek_latex_ocr.ts
- **`atob` + `JSON.parse` 无try/catch**: base64损坏或JSON非法会抛出未处理异常。
- **`atob` 同步阻塞**: 大结果会卡主线程。

#### openai_vision.ts
- **URL路径检测不安全**: `base_url.includes('/chat/completions')` 会匹配 `https://evil.com/api/chat/completions/malicious`。应解析 URL 路径。
- **空key仍发请求**: `api_key` 为空字符串时不带 Authorization 发送请求，浪费资源。

---

### 2.5 测试（tests/）

#### 单元测试偏薄
- `unit/services/test_google.ts`: 仅断言 key/name/languages，未测试翻译逻辑或请求格式。
- `unit/services/youdao.test.ts`: 仅测试签名参数生成，未覆盖 `errorCode !== '0'` 或网络错误分支。
- 所有翻译服务单元测试仅覆盖成功路径，应补充至少一个HTTP非200测试。

#### E2E测试
- `translate_page.ts`: 残留Lingva废弃helper（`hold_lingva_translation_once` 等），应清理。
- `dict_window.spec.ts`: 使用 `ocr_timeout_ms`（60s）作为词典等待超时，命名语义错误，应使用 `local_translation_timeout_ms`。
- `toast_feedback.spec.ts`: 硬编码 `timeout: 3000/4000`，应由 `timeout_constants.ts` 统一定义。
- `translate_behavior.spec.ts` (~480行) 和 `config_settings.spec.ts` (~520行) 混合过多场景，应按场景拆分。
- `app_fixture.ts`: `waitForWindow` 采用 200ms 轮询而非 Playwright 的 `waitForEvent('page')`。

#### Mock边界
- 严格遵守 `TEST.md` §3：外部服务用 `TranslationTestServer` stub，`external_services.spec.ts` 唯一走真实公网。Vitest中Electron API mock标注了 `@electron-mock` 原因。

---

### 2.6 配置与构建（scripts/, config/, package.json）

#### tsconfig.json
- **工程引用缺 `composite`**: `tsconfig.node.json` 和 `tsconfig.web.json` 均未设 `"composite": true`，TypeScript 工程引用规范要求被引用项目启用。

#### run_dist.mjs
- **ABI检查重复**: `build:chinese-dictionary` script本身已前缀 `ensure_node_abi`，`run_dist.mjs` 中又显式调用，重复执行。

#### ensure_electron_abi.mjs
- **进程kill过于激进**: Windows上强制kill包含 `omni_pot` 的 `electron.exe` 进程，若开发者同时开其他Electron项目且路径含 `omni_pot` 可能被误杀。

#### publish_release.mjs
- **WSL路径硬编码**: `wsl_cloudflare_service_dir = '/home/karon/karson_ubuntu/cloudflare_service'` 绑定特定WSL环境。

#### test_pot_plugins.cjs
- **硬编码多组API密钥/Token**: YOUDAO_SIGN_KEY、CAIYUN_TOKEN、WECHAT_GUID等。应添加文件头注释警告，提醒环境变量覆盖。

---

### 2.7 文档（docs/）

#### SPEC.md
- **§17 子节编号跳跃**: §17 标题为"配置系统"，子节标为 `## 18.1`、`## 18.2`，应统一为 `## 17.1`、`## 17.2`。
- **目标语言锁定规则引用错乱**: §5.4 提到"适用于翻译窗口（§7）和截图翻译窗口（§8）"，实际§7是"截图"§8是"截图翻译"，应修正为准确的章节号。

#### RELEASE.md
- **macOS/Linux状态不一致**: 标为"待实现"，但 `package.json` 的 `build` 配置中已完整配置了 mac（dmg, x64/arm64）和 linux（AppImage）目标。应改为"已配置，待实机验证"。

#### better_sqlite3_abi.md
- **未记录进程kill行为**: 文档§实施方案中 `ensure_electron_abi.mjs` 的示例代码不含kill electron进程和ping等待逻辑，但真实脚本有。应补充说明。

---

## 三、最高优先级修复（Top 10）

| # | 优先级 | 文件 | 问题 | 风险 | 状态 |
|---|--------|------|------|------|------|
| 1 | **Crít** | `src/services/deepl.ts` L216 | 完整 `authKey` 写入日志，违反SPEC §9.12 | API密钥泄露 | ✅ 已修复 |
| 2 | **Crít** | `src/main/ipc/window_handlers.ts` | 多个window操作handler无sender验证，`window:openConfig`尤为危险 | IPC滥用 | ✅ 已修复 |
| 3 | **Crít** | `src/main/windows/manager.ts` | `server_api_token` 通过 `additionalArguments` 暴露在命令行参数中 | Token泄露 | ✅ 已修复 |
| 4 | **High** | `src/main/ipc/ocr_handlers.ts` L27-48 | PowerShell脚本拼接 `image_path`，防御性不足（来源可控，实际注入难度较高） | 代码注入 | ✅ 已修复 |
| 5 | **High** | `src/windows/recognize/index.tsx` L148-157 | auto-translate effect依赖设计意图明确但有隐患，mode切换时可能使用过期文本 | 功能错误 | ✅ 已修复 |
| 6 | **High** | `src/windows/translate/target_area.tsx` L177 | `TargetArea` 未使用 `React.memo`，导致全量重渲染 | 性能退化 | ✅ 已修复 |
| 7 | **High** | `src/services/alibaba.ts` L45-50 | `~` 编码为 `%7E`，RFC3986不兼容，签名失败风险 | 服务不可用 | ❌ 假阳性，符合阿里云签名规范 |
| 8 | **High** | `src/main/csp_policy.ts` L3 | 生产环境 `connect-src https:` 通配符，过于宽松 | XSS绕过 | ✅ 已修复 |
| 9 | **High** | `src/windows/config/hotkey_settings.tsx` L79 | Backspace未检查修饰键，`Ctrl+Backspace` 被清空 | 快捷键捕获错误 | ✅ 已修复 |

---

## 四、中等优先级修复（Next 20）

10. ✅ `src/main/ipc/config_handlers.ts`: `config:set` 验证失败返回 undefined，调用方无法区分 → 返回 `false`
11. ✅ `src/windows/translate/index.tsx`: `handleTranslate` 过重（120+行），拆分为服务调用器和请求协调器
12. ✅ `src/windows/translate/use_source_tts.ts` / `use_translate_height_reporting.ts`: eslint-disable 添加注释说明原因（snake_case hook 名触发规则，非误用）
13. ✅ `src/windows/translate/language_area.tsx` + `src/windows/recognize/pill_select.tsx`: 统一为通用 `Dropdown` 组件
14. `src/windows/dict/index.tsx` L248-275: DnD同时修改中英文列表导致不一致 → reorder前检查列表差异
15. ✅ `src/windows/dict/dict_card.tsx` L87-97: 音频无引用管理导致重叠播放 → 保存Audio实例引用  
16. `src/windows/translate/source_area.tsx`: `resize_source_area` 中 `getComputedStyle` 每次render调用 → useRef缓存lineHeight
17. `src/windows/screenshot/index.tsx`: OCR串行改为并行，或至少首服务超时后切换
18. ✅ `src/windows/welcome/index.tsx`: 关闭窗口时调用 `finish_welcome()`
19. `src/windows/config/service_settings.tsx`: 合并5个selector为1个，减少重渲染
20. `src/windows/config/service_settings.tsx`: 添加已存在服务过滤，防止重复添加
21. ✅ `src/windows/config/history_settings.tsx`: 修正 `sogai` / `translatetranslate` 为真实服务key
22. ✅ `src/windows/config/backup_settings.tsx`: 硬编码中文改用 `t()` i18n；WebDAV占位保留
23. ✅ `src/windows/config/general.tsx`: `serverPort` 改为受控模式（`value` 替代 `defaultValue`）
24. ✅ `src/windows/updater/index.tsx`: 按 `process.platform` 匹配下载asset + 修复 `##` changelog粗体
25. ✅ `src/services/baidu.ts` + `baidu_field.ts`: 提取共享签名逻辑到 `baidu_common.ts`
26. ✅ `src/services/tencent_sign.ts` + `volcengine_sign.ts`: 提取通用AWS Signature V4工具到 `aws_sig_v4.ts`
27. ✅ `src/main/selection/windows.ts`: 为koffi COM vtable magic number添加注释
28. ✅ `src/main/server/index.ts`: `/translate` 端点添加100KB文本长度限制
29. `src/main/tray/index.ts`: Survey URL改为填写页（⚠️ 无法确认正确URL，已添加TODO）  

---

## 五、SPEC一致性偏差

| SPEC节 | 当前状态 | 偏差说明 |
|--------|----------|----------|
| §5.4 | 翻译窗口已实现，截图翻译/识别窗口已标偏差 | 目标语言锁定规则引用编号有误（§5.4应为源引用节） |
| §13 | ChatGLM/Gemini Pro未实现流式 | SPEC标注为流式，代码无 `translateStream` |
| §14/§15 | OCR引擎串行执行 | SPEC要求与翻译窗口一致的并行策略（实际串行逐个尝试） |
| §21 | 热键无toggle hide | SPEC要求窗口可见时切换隐藏，当前只有focusOrCreate |
| §22 | 剪贴板监听suppression后200ms窗口 | 低概率误捕获（业务可接受） |
| §23 | macOS划词未实现 | `darwin.ts` 返回 unsupported-platform，与SPEC一致（不得宣称支持） |

---

## 六、正面发现

1. **服务注册表模式统一**: `ServiceRegistry<T>` 泛型设计简洁，各服务注册流程清晰。
2. **fetch_with_timeout统一出口**: 所有服务均通过 `fetch_with_timeout` 获得15秒默认超时与SSRF基础防护。
3. **配置secret加密脱敏完善**: `protect_config_secrets` + `unprotect_config_secrets` 使用 `safeStorage`，自动加密/解密。
4. **E2E测试基础设施扎实**: `AppFixture` 每个测试独立Electron实例，并行/串行分区合理，`TranslationTestServer` stub策略清晰。
5. **窗口高度控制器设计良好**: `TranslateHeightController` / `DictHeightController` debounce、display move处理合理。
6. **请求ID去重机制**: translate/dict/recognize窗口均使用requestId/ref计数器防护竞态。
7. **配置迁移系统完善**: `store.ts` 中instanceName→instance_name、DeepL stale config、openai@过滤等迁移齐全。
8. **sender验证覆盖率较高**: 绝大多数敏感IPC通道（config:set、history:add、ocr:capture-screenshot等）均有 `assert_sender_label`。

---

## 七、结论

omni_pot 整体代码质量**良好**，架构设计清晰，核心功能与SPEC对齐度高，测试设施扎实。主要风险集中在：

1. **安全性**: 2处高危（密钥泄露、命令行token暴露）+ 2处中高（CSP过宽、IPC sender缺失验证）+ 1处中（PowerShell拼接防御性不足）
2. **性能**: 翻译结果区域未memo化、OCR串行执行、多处inline style
3. **可维护性**: handleTranslate过重、Dropdown实现重复、多处无意义类型断言

修复Top 10后，项目可达到生产级安全标准。