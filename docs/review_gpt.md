# 全量代码审阅报告

审阅目标：当前工作区整个代码库（生产代码、测试、脚本、活跃文档），不限定最近提交。

范围：`electron/`、`src/`、`shared/`、`scripts/`、`tests/`、活跃 `docs/` / `TASKS.md`。排除 `out/`、`release/`、`node_modules/`；归档文档只在术语/文档一致性问题中提及。

说明：本报告按用户要求“不按置信度过滤”，保留所有审阅发现；同类重复问题已合并。

## 总览

- Critical：0
- High：31
- Medium：31
- Low：14

## High

### 1. 本地 HTTP API 无认证且允许任意网页跨域读取

证据：

- `electron/server/index.ts:65-68` 设置 `Access-Control-Allow-Origin: *`。
- `electron/server/index.ts:101-104` 暴露 `GET /config`。
- `electron/server/index.ts:112-120` 暴露 `GET /history`。
- `docs/api.md:3-5` 文档说明服务是 localhost，但 CORS 开放。

影响：任意网页可从用户浏览器读取 `http://127.0.0.1:20202/history` / `/config`，泄露翻译历史和配置元数据；也可 POST `/translate`、`/dict` 触发窗口和处理攻击者文本。

建议：所有本地 API 增加认证 token；不要使用 `Access-Control-Allow-Origin: *`；默认禁用或改为显式 opt-in。

### 2. `/history` 向任意本地进程或网页暴露完整翻译历史

证据：

- `electron/server/index.ts:112-120` 返回分页历史。
- `electron/history/index.ts:5-13`、`electron/history/index.ts:76-78` 历史记录包含完整 source/target 文本。

影响：翻译内容可能包含邮件、文档、凭据、聊天记录等敏感内容；结合开放 CORS 可被网页直接读取。

建议：该端点必须认证；考虑默认不暴露历史；如果用于自动化，应有用户可见开关和警告。

### 3. HTTP 请求体无大小限制，可能导致内存耗尽

证据：

- `electron/server/index.ts:84-89`
- `electron/server/index.ts:251-254`
- `electron/server/index.ts:274-278`
- `electron/server/index.ts:303-308`
- `electron/server/index.ts:355-359`
- `electron/server/index.ts:387-391`
- `electron/server/index.ts:419-423`
- `electron/server/index.ts:545-550`
- `electron/server/index.ts:641-647`
- `electron/server/index.ts:679-684`

影响：每个 handler 都把 chunks 全部存入数组再 `Buffer.concat`，恶意网页或本地进程可 POST 超大 body 导致主进程内存压力、卡死或崩溃。

建议：按端点限制 body 大小，超限立即 destroy request 并返回 `413 Payload Too Large`。

### 4. 翻译和 TTS 文本被写入持久日志

证据：

- `src/windows/translate/index.tsx:131-132` 记录 `textToTranslate.slice(0, 50)`。
- `src/services/tts/system_tts.ts:78-80` 记录 `text.slice(0, 50)`。
- `electron/log.ts:36-39`、`electron/log.ts:51-53` 日志持久化到磁盘。
- `electron/ipc/shell_handlers.ts:31-55` 支持导出日志。

影响：用户翻译/朗读的敏感内容会进入 `%APPDATA%/omni_pot/logs/main.log` 和导出日志包。

建议：不要记录用户原文；只记录长度、语言、服务数量、request id、耗时。

### 5. 凭据明文存储并进入明文备份

证据：

- `shared/types/config.ts:72-75` 定义 WebDAV 凭据。
- `shared/types/service.ts:3-7` service config 可保存 API key/secret。
- `electron/config/store.ts:192-193` 明文写入 `config.json`。
- `electron/backup/index.ts:22-31`、`electron/backup/index.ts:350` 备份包含 `config.json`。
- `electron/backup/index.ts:82-147` zip 未加密。

影响：本地用户/进程或被分享的备份 zip 可读取 WebDAV 密码和 provider API keys。

建议：凭据存 OS credential storage；备份默认排除或加密 secrets，并提供明确“包含凭据”选项。

### 6. 预加载 API 过宽，所有 renderer 都能访问敏感和破坏性操作

证据：

- `electron/preload.ts:34-47` 暴露 config get/set/getAll。
- `electron/preload.ts:117-125` 暴露 backup create/restore/import/delete/getPath。
- `electron/preload.ts:52-56` 暴露剪贴板写入。
- `electron/ipc/config_handlers.ts:14-26`、`electron/ipc/backup_handlers.ts:12-71`、`electron/ipc/text_handlers.ts:4-14` 未按 sender/window 校验权限。

影响：任意 renderer 被 XSS/逻辑漏洞影响后，可读写全部配置、恢复/删除备份、写剪贴板、发现用户目录。

建议：按窗口拆分 preload API；IPC handler 校验 sender window label；避免暴露 `config:getAll` 给不需要的窗口。

### 7. IPC config setter 无运行时 key/value 校验

证据：

- `electron/ipc/config_handlers.ts:15-24` 接收 `key: ConfigKey, value: unknown` 并直接写入。
- `electron/config/store.ts:179-183` 写入 persisted config。
- `electron/config/store.ts:186-188` 之后合并为 `AppConfig`。

影响：`ConfigKey` 只在 TS 编译期生效；renderer 可持久化错误类型，破坏端口、service_instances、窗口尺寸、布尔开关等关键配置。

建议：IPC 边界使用 schema 校验 key 和 value；拒绝未知 key/错误类型。

### 8. IPC history 分页和 mutation handler 信任 renderer 输入

证据：

- `electron/ipc/history_handlers.ts:31-33` 直接传 `page` / `page_size`。
- `electron/history/index.ts:73-78` 作为 SQLite `LIMIT` / `OFFSET` 使用。
- `electron/ipc/history_handlers.ts:43-49` 未校验 `id`、`source_text`、`target_text`。

影响：IPC 可传 `page_size=-1` 或巨大值读取全部/大量历史；无效 id/text 可能造成静默错误。

建议：IPC 与 HTTP 一样 clamp page/page_size，并验证 mutation 参数。

### 9. 自动更新检查私有源码仓库，而不是公开 release 仓库

证据：

- `electron/updater/index.ts:15-16` 使用 `TuTouPower/omni_pot`。
- `electron/updater/index.ts:197` 请求 `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`。
- `src/windows/updater/index.tsx:27-28` 也硬编码 `omni_pot`。
- `CLAUDE.md:73-76` 说明源码仓库私有，release 在公开 `TuTouPower/omni_pot_release`。

影响：普通用户无法访问私有源码仓库 release，检查更新不可用。

建议：更新检查和 UI 链接使用 `TuTouPower/omni_pot_release` 或用户可访问的公开地址。

### 10. 更新下载 URL allowlist 绑定到错误仓库

证据：

- `electron/updater/index.ts:51-53` 只允许 `https://github.com/TuTouPower/omni_pot/releases/download/...`。
- `CLAUDE.md:73-76` 指明产物在 `omni_pot_release`。

影响：即使 discovery 改为公开 release 仓库，下载也会因 allowlist 不匹配被拒绝。

建议：allowlist 与公开 release 仓库一致，并由 main 进程持有 release metadata。

### 11. 更新下载后直接打开安装包，无签名/哈希校验

证据：

- `electron/updater/index.ts:197-205` 从 GitHub release 获取 metadata。
- `electron/updater/index.ts:51-67` 只校验 URL host/path。
- `electron/updater/index.ts:177-185` 下载后 `shell.openPath(output_path)`。

影响：如果 release 账号、发布流程或资产被污染，应用会下载并打开恶意安装包。

建议：校验 Authenticode/发布者证书或签名哈希；不要只依赖 URL allowlist。

### 12. updater IPC 允许任意 renderer 触发下载并打开 allowed asset

证据：

- `electron/preload.ts:136-143` 暴露 updater install。
- `electron/updater/index.ts:177-189` handler 不校验 sender window。
- `electron/updater/index.ts:51-67` 校验 renderer 提供的 asset URL。

影响：renderer compromise 可触发下载安装流程，扩大攻击面。

建议：只允许 updater window 调用；asset 由 main process 从 release metadata 绑定，不接受 renderer 任意对象。

### 13. macOS System OCR 打包后可能找不到 Swift 脚本

证据：

- `electron/ipc/ocr_handlers.ts:90-98` 使用 `join(__dirname, '..', '..', 'scripts', 'macos_ocr.swift')`。
- `package.json:60-63` app files 只包含 `out/**` 和 `package.json`。

影响：打包版 macOS 中 `scripts/macos_ocr.swift` 不在 app 内，System OCR 会运行失败。

建议：把脚本作为 extraResource 打包，或内联/改为可打包的 helper。

### 14. macOS 划词读取仍是 unsupported stub

证据：

- `electron/selection/index.ts:37-40` 调用 `readSelectedTextDarwin`。
- `electron/selection/darwin.ts:3-5` 永远返回 `unsupported-platform`。
- `electron/selection/permissions.ts:14-26` 有 accessibility permission 检查但未接入。
- `CLAUDE.md:5-6` 项目定义为跨平台翻译/OCR/词典工具。

影响：macOS 划词翻译/词典总是退化为空选择/输入模式，与跨平台产品目标不符。

建议：实现 macOS selection path，或在 spec/TASKS 明确该平台能力缺口。

### 15. 截图翻译模式切换识别语言不会重新识别/刷新翻译

证据：

- `src/windows/recognize/index.tsx:400-405` 自动重新识别 effect 在 `mode !== 'recognize'` 时直接返回。
- `src/windows/recognize/index.tsx:537-546` translate mode 自动翻译只依赖目标语言。
- `docs/spec.md:477-478` 要求识别语言变更时重新识别并刷新翻译。

影响：截图翻译模式下用户切换 OCR/source 语言后，结果仍是旧语言识别和旧翻译。

建议：translate mode 也监听 source/识别语言变化并重新 OCR + translate。

### 16. 截图翻译在 source 为 auto 时交换按钮无效

证据：

- `src/windows/recognize/index.tsx:594-599`
- `src/windows/recognize/index.tsx:767`

当前逻辑在 `selectedLanguage === 'auto'` 时把 target 设为原 target，source 不变。

影响：默认 auto source 下，用户点击交换语言没有效果。

建议：使用 `detectedSourceLang` 作为 auto 状态的实际 source 参与交换；无检测结果时禁用按钮或提示。

### 17. 旧 OCR/翻译请求可能清掉当前请求 loading 状态

证据：

- `src/windows/recognize/index.tsx:421-425`
- `src/windows/recognize/index.tsx:541-545`
- `src/windows/recognize/index.tsx:496-527`

`doTranslate` 内部能识别 stale request，但调用方 `finally` / await 后仍无条件 `setIsTranslating(false)`。

影响：快速切换语言或新截图时，旧请求完成会隐藏新请求 loading。

建议：设置 loading 前后都按 request id guard，只允许当前 request 修改 loading。

### 18. 截图选择 crop/OCR 失败被吞掉，窗口直接关闭无反馈

证据：

- `src/windows/screenshot/index.tsx:116`
- `src/windows/screenshot/index.tsx:164-168`

影响：截图裁剪、图片解码、OCR 失败时，用户只看到窗口关闭，没有错误、重试或诊断。

建议：显示错误并保留窗口，或至少记录日志并给出重试路径。

### 19. WebDAV 密码用普通文本输入框显示

证据：

- `src/windows/config/backup_settings.tsx:155-159`
- `src/windows/config/config_components.tsx:203` `ConfigField` 渲染普通 `<input>`。

影响：密码在设置页明文展示，屏幕共享/截图时泄露。

建议：密码字段使用 `type="password"` 或带显式 reveal 控件的密码输入。

### 20. Renderer config store 在持久化失败时仍乐观显示成功

证据：

- `src/stores/config_store.ts:35-39`

先更新本地 state，再异步 `config.set(...).catch(console.error)`。

影响：主进程写入失败时，UI 显示的配置和实际持久配置/主进程状态不一致，重启后丢失。

建议：失败回滚或提示用户；关键设置等待 main 成功再更新。

### 21. 火山通用签名日期格式错误，火山翻译/OCR 可能鉴权失败

证据：

- `src/services/volcengine_sign.ts:20-30` 使用 `YYYY-MM-DD` 作为 `X-Date` 和 string-to-sign 日期。
- `src/services/volcengine.ts:66-74`、`src/services/ocr/volcengine_ocr.ts:26-34` 使用该签名。
- `src/services/ocr/volcengine_multi_lang_ocr.ts:41-64` 另一路实现使用 `YYYYMMDDTHHmmssZ` 和 `YYYYMMDD`。

影响：通用签名与火山 V4 格式不一致，相关服务可能稳定返回签名错误。

建议：统一到火山 V4 正确日期和 credential scope 格式，并加真实 API/签名单元测试。

### 22. iFlytek OCR URL 中 authorization 未 URL encode

证据：

- `src/services/ocr/iflytek_auth.ts:13-15` 返回 base64。
- `src/services/ocr/iflytek_ocr.ts:31-37`、`src/services/ocr/iflytek_latex_ocr.ts:31-33` 直接拼入 URL。

影响：base64 中 `+`、`/`、`=` 可破坏 query 参数，导致鉴权失败。

建议：对 `authorization` 使用 `encodeURIComponent` 或 `URLSearchParams`。

### 23. iFlytek IntSig 签名声明 digest，但请求未发送 Digest header

证据：

- `src/services/ocr/iflytek_auth.ts:26-32` 签名包含 `digest`。
- `src/services/ocr/iflytek_intsig_ocr.ts:37-46` headers 没有 `Digest`。

影响：服务端按签名 headers 校验时找不到 digest header，鉴权失败。

建议：发送正确 `Digest` header，或从签名 headers 中移除 digest。

### 24. Youdao API 混用新版截断签名和旧版 MD5 参数

证据：

- `src/services/youdao.ts:50-55` 对长文本使用新版 input 截断。
- `src/services/youdao.ts:76-83` 请求缺少 `curtime` / `signType=v3`，签名仍用 MD5。

影响：长文本尤其容易签名失败。

建议：选择旧版 MD5（完整 q）或新版 v3 SHA-256（curtime/signType/input 截断）之一。

### 25. DeepL official/API 路径未使用已有语言映射

证据：

- `src/services/deepl.ts:9-30` 定义 `zh_cn: 'ZH'` 等映射。
- `src/services/deepl.ts:212-218` official path 直接 `to.toUpperCase().replace('_', '-')`。

影响：`zh_cn` 变成 `ZH-CN`、`zh_tw` 变成 `ZH-TW`，DeepL official API 不接受。

建议：official/API 分支使用 `DEEPL_LANGUAGES` 映射。

### 26. OpenAI streaming parser 不处理 SSE chunk 边界

证据：

- `src/services/openai.ts:51-70`
- `src/services/openai.ts:174-176`

`translate_stream` 对每个 chunk 直接 split/parse，未维护跨 chunk buffer。

影响：合法 SSE JSON 行跨 TCP chunk 时 `JSON.parse` 失败，流式翻译失败。

建议：像 generator 路径一样维护 buffer，只解析完整行。

### 27. TranSmart service 协议与仓库验证脚本矛盾

证据：

- `src/services/transmart.ts:43-63` 使用 form-urlencoded + Bearer。
- `scripts/test_pot_plugins.cjs:29-45` 对同 endpoint 使用 JSON payload、Referer/User-Agent、无 Bearer。

影响：正式 provider 很可能 401/400 或解析失败。

建议：确认真实接口协议，统一 service 和验证脚本，并加入真实/契约测试。

### 28. `scripts/test_pot_plugins.cjs` 提交了硬编码 token/cookie/secret

证据示例：

- `scripts/test_pot_plugins.cjs:39`
- `scripts/test_pot_plugins.cjs:67`
- `scripts/test_pot_plugins.cjs:84`
- `scripts/test_pot_plugins.cjs:118-119`
- `scripts/test_pot_plugins.cjs:162`
- `scripts/test_pot_plugins.cjs:192`

影响：仓库包含 session-like/auth-like 固定值，可能过期、违反服务条款，也容易被误判为泄露凭据。

建议：移除或改为环境变量；把 reverse-engineered 常量的来源/用途明确标注并避免提交 cookie/token。

### 29. 全仓库命名规则未按 `snake_case` 执行

证据：

- 全局 `CLAUDE.md:46-49` 要求所有命名使用 `snake_case`。
- `src/App.tsx` 文件名不符合 snake_case。
- 扫描发现约 1001 处非 snake_case 声明/绑定；代表性例子：
  - `shared/types/service.ts:3` `ServiceConfig`
  - `shared/types/service.ts:57` `createServiceInstanceKey`
  - `src/stores/translate_store.ts:10` `sourceText`
  - `src/windows/translate/index.tsx:29` `TranslateWindow`
  - `src/windows/dict/index.tsx:263` `focusWordInput`
  - `tests/user_e2e/pages/dict_page.ts:118` `isWordFocused`

影响：显式用户/项目约定未被执行；后续新增代码容易继续扩大不一致。

建议：决定 TS/React 是否真的全部执行 snake_case。若是，批量改名并加 lint；若否，在 `CLAUDE.md` 明确 React 组件、类型、第三方导入、常量等例外。

### 30. 4 空格缩进规则大量违反

证据：

- 全局 `CLAUDE.md:50` 要求 4 空格缩进、禁止 tab。
- 未发现 tab，但扫描到约 1183 行缩进空格数不是 4 的倍数。
- 代表性文件：
  - `shared/types/config.ts` 约 136 行
  - `electron/windows/manager.ts` 约 134 行
  - `src/services/deepl.ts` 约 127 行
  - `electron/tray/index.ts` 约 122 行
  - `electron/preload.ts` 约 74 行

影响：显式格式约定未被执行。

建议：配置 formatter 为 4 spaces 并加入 lint/format 检查。

### 31. Renderer 应用代码大量使用 `console.error`，违反日志约定

证据：

- 全局 `CLAUDE.md:51` 要求使用 logging 模块；项目 `CLAUDE.md:111-114` 只允许 `scripts/` 下使用 console。
- 代表性位置：
  - `src/main.tsx:74`
  - `src/i18n/index.ts:49,53`
  - `src/stores/config_store.ts:39`
  - `src/windows/translate/index.tsx:244,257,339,357,606,627,638,649,670`
  - `src/windows/dict/index.tsx:270,293,299,307,331,337`
  - `src/windows/recognize/index.tsx:279,354,404,413,425,545,574,586,743,788,800`
  - `src/windows/screenshot/index.tsx:94,188,200`
  - `src/windows/config/*` 多处

影响：错误进入 dev console 而不是统一日志通道，打包后排查不一致。

建议：renderer 使用 `src/utils/logger.ts` 或 preload log IPC。

## Medium

### 32. `/config` 虽 redacts service secrets，但仍无认证暴露配置和 WebDAV 元数据

证据：

- `electron/server/index.ts:101-104`
- `electron/server/index.ts:41-46` 只 redact `webdav_password`。
- `electron/server/index.ts:31-38` service instance config 仅保留 `enable` / `instanceName`。

影响：泄露 WebDAV URL/username、启用服务、hotkey、语言偏好等配置画像。

建议：认证端点；减少 public config 字段；`webdav_url`/`webdav_username` 默认也不暴露。

### 33. 备份 restore 接收任意 config shape/value

证据：

- `electron/backup/index.ts:239-250` 只检查 config 是 plain object。
- `electron/backup/index.ts:305-309` 直接替换 live config。
- 多个 service 支持可配置 URL/path，如 `src/services/openai.ts:21-31`、`src/services/deepl.ts:178-210`。

影响：恶意备份可污染 service URL、服务列表、本地 API 端口等，之后翻译可能发往攻击者 endpoint。

建议：restore 时用严格 schema，拒绝未知 key/错误类型；敏感字段显示 diff 并要求确认。

### 34. OCR 临时文件名可预测且并发可能碰撞

证据：

- `electron/ipc/ocr_handlers.ts:124-130` 使用 `omni_pot_ocr_${Date.now()}.png`。
- `electron/ipc/ocr_handlers.ts:140-142` finally unlink。

影响：同毫秒并发请求可能写/删同一路径；本地攻击者也可预测 temp 文件名干扰。

建议：使用 `mkdtemp` 私有目录和 exclusive write，处理后删除目录。

### 35. 截图捕获失败被吞掉且无日志

证据：

- `electron/screenshot/index.ts:72-76` catch 后 close 并返回 false，无日志。
- `electron/ipc/ocr_handlers.ts:108-110` 只把 boolean 返回 renderer。

影响：权限失败、desktopCapturer 失败、display mismatch 等生产问题不可诊断。

建议：记录错误和上下文，必要时给 UI 错误信息。

### 36. HTTP `/recognize` 是公开 API stub

证据：

- `electron/server/index.ts:83-98` 只解析 `{ mode }` 并返回 success。
- `docs/api.md:39-43` 说明是 placeholder。
- `docs/spec.md:921-934` 把 `/recognize` 列为 HTTP API endpoint。

影响：API 看起来支持识别，实际不触发截图或识别。

建议：实现或在 spec/TASKS 中明确未完成能力和限制。

### 37. `/config` redaction 对未来 top-level secret 不安全

证据：

- `electron/server/index.ts:31-38` allowlist service config。
- `electron/server/index.ts:41-53` top-level 只 redacts `webdav_password`。

影响：未来新增 top-level secret 若忘记更新 redaction，会被 unauthenticated `/config` 暴露。

建议：默认 denylist 改 allowlist，只暴露明确 public 字段。

### 38. 手动“检查更新”受启动检查开关影响

证据：

- `electron/tray/index.ts:215-218` 托盘手动检查调用 `checkForUpdate(windowManager, false)`。
- `electron/updater/index.ts:192-195` `check_update` false 时直接返回。
- `docs/spec.md:510` `check_update` 是“启动时检查更新”。

影响：关闭启动检查后，用户也无法手动检查更新。

建议：`silent=false` 的用户主动检查不应被启动检查开关拦截。

### 39. 更新窗口尺寸与 spec 不一致

证据：

- `docs/spec.md:147` updater 默认 `600×400`。
- `electron/updater/index.ts:221-225` 打开 `480×520`。
- `electron/server/index.ts:822-826` E2E mock update 也打开 `480×520`。

影响：窗口行为与产品规格不一致。

建议：同步实现或 spec。

### 40. Backup WebDAV 配置存在，但实现只做本地 zip

证据：

- `shared/types/config.ts:72-75` 定义 `backup_type` 和 WebDAV 字段。
- `shared/types/config.ts:167-170` 默认 `backup_type: 'webdav'`。
- `docs/spec.md:571-576` 要求 WebDAV/local 备份恢复。
- `electron/backup/index.ts:338-356` 始终创建本地 zip。
- `electron/backup/index.ts:383-428` 只从本地备份名或本地 zip 恢复。

影响：默认/选择 WebDAV 都不会得到文档描述的 WebDAV 行为。

建议：实现 WebDAV，或默认改 local 并在 spec/TASKS 标明 WebDAV 未完成。

### 41. Backup restore reload config 但不通知已打开窗口/运行时组件

证据：

- `electron/backup/index.ts:290-315` 替换文件并 `reload_config_from_disk()`。
- `electron/config/store.ts:212-215` reload 内部数据。
- `electron/config/store.ts:232-240` 只有 `setConfig` 会 broadcast。

影响：restore 成功后已打开 renderer、tray、剪贴板监听等仍可能使用旧配置，直到重启。

建议：restore 后广播 config changed，或要求重启并清楚提示。

### 42. Dict/recognize close 时没有 reset pinned 状态

证据：

- `electron/windows/manager.ts:208-214` translate close reset pinned/topmost。
- `electron/windows/manager.ts:215-220` dict/recognize 只 reset always_on_top，不 reset pinned。
- `electron/windows/manager.ts:141-145` pinned 控制 blur auto-close。

影响：dict/recognize 关闭后下次打开可能继承 stale pinned，不再 blur 自动关闭。

建议：关闭时 reset `dict_pinned` / `recognize_pinned`，并补测试。

### 43. Dict 窗口尺寸记忆受 translate 设置控制

证据：

- `electron/windows/dict_options.ts:8-11` 用 `translate_remember_window_size` 控制 dict 初始尺寸。
- `electron/windows/dict_options.ts:25-27` 用同一设置控制 dict resize persistence。
- `shared/types/config.ts:41-44` 有 dict dimensions 但无 dict-specific remember flag。

影响：关闭翻译窗口尺寸记忆会连带关闭词典尺寸记忆。

建议：增加 dict 独立记忆设置，或文档明确共用行为。

### 44. `translate_window_position = 'pre_state'` 未实现

证据：

- `shared/types/config.ts:27` 定义 `'mouse' | 'pre_state'`。
- `shared/types/config.ts:38-39` 定义保存位置字段。
- `docs/spec.md:519` 说明“鼠标位置 / 上次位置”。
- `electron/windows/manager.ts:80-85` 始终按鼠标所在 display 居中。

影响：“上次位置”配置不可用。

建议：创建 translate window 时读取 saved position，并在移动/关闭时保存。

### 45. `recognize_always_on_top` 创建窗口时未应用

证据：

- `shared/types/config.ts:46` 定义 `recognize_always_on_top`。
- `electron/windows/recognize_options.ts:7-17` 没有 `alwaysOnTop`。
- `electron/windows/manager.ts:98` 只应用 `opts.alwaysOnTop`。

影响：识别/截图翻译窗口不能按持久配置恢复置顶状态。

建议：recognize options 读取并设置 `alwaysOnTop`。

### 46. 托盘 tooltip 仍显示 Pot Desktop

证据：

- `electron/tray/index.ts:246-247` `tray.setToolTip('Pot Desktop')`。
- `CLAUDE.md:8-9` 要求用户展示名是 Omni Pot。
- `docs/spec.md:90` 也定义 wordmark 为 Omni Pot。

影响：用户可见品牌名错误。

建议：改为 `Omni Pot`。

### 47. 托盘“查看日志”忽略 E2E/userData override

证据：

- `electron/tray/index.ts:220-222` 使用 `app.getPath('userData')`。
- `electron/config/store.ts:36-39` `getUserDataDir()` 支持 `OMNI_POT_USER_DATA`。
- `electron/shell_handlers.ts:27-29` 正确使用 `getLogDir(getUserDataDir())`。

影响：E2E 或 override user-data 模式下，托盘打开的日志目录不是实际使用目录。

建议：托盘也使用 `getUserDataDir()`。

### 48. text clipboard IPC 接收任意大小 base64 图片

证据：

- `electron/ipc/text_handlers.ts:9-12` 对 renderer base64 创建 nativeImage。
- `electron/preload.ts:54-55` 暴露给 renderer。

影响：renderer bug/compromise 可传超大 base64 造成主进程内存压力。

建议：限制 base64 长度和图片尺寸。

### 49. About 页面链接到私有源码仓库

证据：

- `src/windows/config/about.tsx:19` `REPO_URL = 'https://github.com/TuTouPower/omni_pot'`。
- `src/windows/config/about.tsx:70,73,76,79` 使用该 URL。
- `CLAUDE.md:73-76` 指明该 repo 私有，公开 release repo 是 `omni_pot_release`。

影响：普通用户点击官网/文档/反馈/更新会进入不可访问的私有仓库。

建议：使用公开用户可访问地址或 release repo。

### 50. 本地 API 端口输入可持久化无效数字/NaN

证据：

- `src/windows/config/general.tsx:66-69` `setServerPort(Number(v))`。

影响：空字符串变 0，非数字变 NaN，可能破坏本地 HTTP API 端口设置。

建议：输入层校验整数范围，保存前拒绝无效值。

### 51. 词典 contentEditable 可见内容和 store word 不同步，复制可能复制旧词

证据：

- `src/windows/dict/index.tsx:319-337` lookup 从 DOM `textContent` 读。
- `src/windows/dict/index.tsx:385-402` contentEditable 无 `onInput` 同步。
- copy 使用 store `word.trim()`。

影响：用户编辑词卡但未按 Enter 直接复制时，复制的是旧 store word，不是屏幕上的文字。

建议：onInput 同步 word，或 copy 也从 DOM 读取当前可见文本。

### 52. 词典 contentEditable 没有 textbox role/name

证据：

- `src/windows/dict/index.tsx:385-390`

影响：主要词典输入对屏幕阅读器/辅助技术不可作为文本框识别。

建议：使用原生 input/textarea，或加 `role="textbox"`、`aria-label`、键盘语义。

### 53. 自定义 select/dropdown 缺少键盘和 ARIA combobox/listbox 语义

证据：

- `src/windows/config/config_components.tsx:135-172`
- `src/windows/translate/language_area.tsx:69-111`
- `src/windows/recognize/index.tsx:127-174`

影响：配置、翻译语言、识别语言选择对键盘用户和辅助技术不可可靠操作。

建议：实现 combobox/listbox/option ARIA，键盘导航，或使用原生 select。

### 54. 历史页异步加载无 request id，可能显示过期结果

证据：

- `src/windows/config/history_settings.tsx:43-55`
- `src/windows/config/history_settings.tsx:123,131,143`

影响：快速搜索/筛选/翻页时，旧请求后返回可覆盖新请求结果。

建议：为 load_page 加 request id/cancel guard。

### 55. WebDAV“测试连接”只是 placeholder，但 spec 说 WebDAV 支持

证据：

- `src/windows/config/backup_settings.tsx:165-166` 显示“WebDAV 同步功能即将推出”。
- `docs/spec.md:571-576`、`docs/spec.md:1072-1073` 把 WebDAV 作为支持能力。
- `CLAUDE.md` 要求重要限制/未完成能力主动记录。

影响：UI 和 spec 对能力状态矛盾。

建议：实现真实测试连接，或在 active spec/TASKS 明确 WebDAV 未完成。

### 56. `use_tts` 在 `audio.play()` reject 时泄露 object URL 且 playing 状态卡住

证据：

- `src/hooks/use_tts.ts:17-34`

影响：播放失败时 `URL.revokeObjectURL` 不执行，`is_playing` 可能一直 true。

建议：try/catch/finally 清理 URL、reset ref 和 state。

### 57. UI/release 版本号硬编码

证据：

- `src/windows/config/about.tsx:7`
- `src/windows/config/index.tsx:123-124`
- `src/windows/updater/index.tsx:114,369`

影响：package version 变化后 About/配置/updater 显示和比较可能过期。

建议：从 app/package metadata 注入版本。

### 58. Baidu OCR token 请求未 encode credentials，且 secret 出现在 URL

证据：

- `src/services/ocr/baidu_common.ts:8`

影响：`clientSecret` 含 `+`、`&`、`=` 等会破坏 query；URL 更容易被日志/代理泄露。

建议：使用 `URLSearchParams` 或 form body，并避免把 secret 放 URL 字符串。

### 59. 中文词典 IPC/DB 错误被吞成空结果

证据：

- `src/services/chinese_dictionary.ts:15-20`

影响：DB 缺失、IPC 失败、SQL 错误与“词不存在”不可区分，隐藏打包/数据加载回归。

建议：记录错误并在 UI 显示服务失败状态。

### 60. OpenAI `requestArguments` JSON 无效时静默回退默认值

证据：

- `src/services/openai.ts:85-87`
- `src/services/openai.ts:140-146`

影响：用户高级配置拼写错误会被静默忽略，运行行为与用户预期不符。

建议：返回配置错误，不要静默替换。

### 61. Ollama streaming parser 静默丢弃 malformed JSON line

证据：

- `src/services/ollama.ts:62-67`

影响：provider error/protocol change/truncated JSON 会变成部分输出或空输出，没有可诊断错误。

建议：记录并抛出协议错误，或显示服务失败。

### 62. `build_chinese_dict.ts` 注释说单对象 JSON 必须 fail，但实现会接受

证据：

- `scripts/build_chinese_dict.ts:36-42`

影响：上游格式如果变成单对象，脚本可能构建一个极小/错误字典而不是 loud fail。

建议：显式判断 top-level array/sequence，单对象时报错。

### 63. `build_chinese_dict.ts` 启用 WAL，但打包只包含 `.db`

证据：

- `scripts/build_chinese_dict.ts:197-199` `journal_mode = WAL`。
- `package.json:72-78` 只 include `chinese_dict.db`。

影响：如果有已提交数据留在 `chinese_dict.db-wal`，打包产物可能缺数据。

建议：构建结束执行 checkpoint/truncate，或生成 DB 时不用 WAL。

### 64. DeepL free path 依赖私有 web/mobile JSON-RPC endpoint

证据：

- `src/services/deepl.ts:32-45`
- `src/services/deepl.ts:140-144`

影响：该 endpoint 不稳定、无版本保证，可能随时失效；当前表现像稳定 provider。

建议：在 UI/docs 标注 fragile/free-web backend，或改用稳定 API。

### 65. Google external service health check 与测试文档策略矛盾

证据：

- `tests/user_e2e/specs/external_services.spec.ts:120-122` 网络不可达时 skip Google。
- `docs/test.md:77-80` 说 public service 不可用应 fail。
- `docs/test_user_e2e.md:459-463` 同样要求暴露具体不可用服务。
- `TASKS.md:85,89` 记录 Google skip。

影响：真实外部服务回归可能被 skip 掩盖，文档策略不一致。

建议：确定策略：允许环境 skip 就更新 docs；否则移除 skip。

### 66. `/dict` HTTP API 测试不验证请求文本被使用

证据：

- `docs/spec.md:932` `/dict` 请求 body `{ text }`。
- `tests/user_e2e/specs/app_http_api.spec.ts:49-54` 只检查 success 和窗口可见。
- `tests/user_e2e/pages/dict_page.ts:30-32` 已有 `dict.word()` 可断言。

影响：endpoint 忽略 text 或显示旧词，测试仍通过。

建议：调用 `/dict` 后断言词典词卡等于请求文本。

### 67. `/history` HTTP API 测试不验证真实历史数据和分页

证据：

- `docs/spec.md:934` 定义分页历史返回。
- `tests/user_e2e/specs/app_http_api.spec.ts:56-64` 只检查 shape 和 page/page_size。

影响：endpoint 永远返回空数组也能通过。

建议：先 seed 多条历史，再断言 total、行数、字段。

### 68. pin/topmost reset 回归测试不验证 pinned 被 reset

证据：

- `tests/user_e2e/specs/window_pin_topmost.spec.ts:87-88` 先确认 dict pinned true。
- `tests/user_e2e/specs/window_pin_topmost.spec.ts:94-98` reopen 后只检查 alwaysOnTop false。
- `tests/user_e2e/specs/window_pin_topmost.spec.ts:176-186` recognize 同样只检查 alwaysOnTop。

影响：pinned stale 但 alwaysOnTop false 的回归能漏过；这也对应 `electron/windows/manager.ts` 的实际实现问题。

建议：reopen 后断言 `dict_pinned` / `recognize_pinned` false、pin button `aria-pressed=false`、blur 可关闭。

### 69. 截图显示器回归测试缺少 overlay bounds 覆盖

证据：

- `tests/unit/screenshot_display.test.ts:36-48` 只测 `get_screenshot_display()` 和 `capture_screenshot()`。
- `electron/screenshot/index.ts:48-52` preload 时设置 bounds。
- `electron/screenshot/index.ts:61-66` capture 时设置 bounds。
- `TASKS.md:80` 记录修复包括 screenshot source 和 overlay bounds。

影响：捕获源正确但遮罩仍显示在主屏的回归不会被该测试发现。

建议：mock `WindowManager` 测 `start_screenshot_capture()` / `preload_screenshot_window()` 的 `setBounds()`。

### 70. Cambridge 词典音频没有 UI 播放回归测试

证据：

- `TASKS.md:84` 记录 Cambridge 没声音 bug。
- `tests/user_e2e/specs/external_services.spec.ts:139-145` 只检查 `audioUrl`。
- `tests/unit/csp_policy.test.ts:18-20` 只检查 CSP media-src。
- `src/windows/dict/index.tsx:97-102` 才是实际按钮播放路径。

影响：renderer 按钮、selector、`Audio.play()` 路径回归不会被发现。

建议：stub `Audio`，断言音频按钮出现且 `play()` 使用正确 URL。

### 71. spec 默认 service_instances 缺少实际默认 OCR 实例

证据：

- `docs/spec.md:699-701` 默认实例列表未列 `system@default`、`qrcode@default`。
- `docs/spec.md:883` `recognize_service_list` 默认引用它们。
- `shared/types/config.ts:88-99` 实际包含它们。

影响：配置规格内部不一致。

建议：补充 `system@default`、`qrcode@default`。

### 72. spec 对 Linux System OCR 支持自相矛盾

证据：

- `docs/spec.md:479` 说 Linux 无 System OCR。
- `docs/spec.md:1110` 表格说 Linux System OCR 是 `tesseract CLI`。
- `src/services/ocr/index.ts:19-21` 仅 win/mac 注册 System OCR。

影响：平台能力文档不一致。

建议：表格改为 Linux 无 System OCR；Tesseract 是单独服务。

### 73. E2E 文档仍说 General 页有文字/字体控制

证据：

- `docs/test_user_e2e.md:413` 提到“文字（字体+字号）”。
- `tests/user_e2e/specs/config_settings.spec.ts:200-202` 断言相关控件不存在。
- `TASKS.md:69` 标记移除完成。

影响：测试设计文档过时。

建议：删除该描述。

### 74. E2E 文档词典 titlebar 计划漏掉固定按钮

证据：

- `docs/test_user_e2e.md:363` 只写“置顶 → wordmark → 模式标签”。
- `docs/spec.md:351` 词典有置顶和固定。
- `tests/user_e2e/specs/dict_window.spec.ts:42` 期望 `['topmost', 'pin', 'wordmark', 'mode', 'close']`。

影响：测试设计文档和实现/spec 不一致。

建议：补充 fixed/pin 按钮。

### 75. 翻译窗口高度 cap E2E 用 primary display，但 spec 说 current display

证据：

- `docs/spec.md:240` 按当前显示器 work area 75% 限制。
- `tests/user_e2e/specs/translate_window_constraints.spec.ts:20-22` 用 `primaryDisplay()`。
- `tests/user_e2e/fixtures/e2e_api.ts:155-162` 只暴露 primary display。
- `electron/windows/translate_height_controller.ts:87-89` 实现用 `screen.getDisplayMatching(win.getBounds())`。

影响：多显示器下主屏/副屏高度不同的回归可能漏过。

建议：E2E 暴露 current/window display 或补 unit 覆盖。

## Low

### 76. `/config` top-level future secret redaction 是脆弱边界

证据：`electron/server/index.ts:41-53` 只手写 redact 当前字段。

影响：未来新增 secret 容易忘记加入 redaction。

建议：改成 public allowlist。

### 77. OCR temp 文件路径可预测带本地竞态风险

证据：`electron/ipc/ocr_handlers.ts:127-130`。

影响：本地攻击者可能 race/干扰临时文件；严重性低于远程问题。

建议：`mkdtemp` + exclusive write。

### 78. Updater 下载路径按 asset name 可预测

证据：`electron/updater/index.ts:71-80`。

影响：本地攻击者可预创建/监控 temp path 干扰下载。

建议：每次下载使用随机临时目录和 exclusive write。

### 79. 安全 lint 命令不可用，缺少 `eslint-plugin-security`

证据：审阅代理运行 `npx eslint . --plugin security` 报缺少依赖；`package.json:108-140` 未包含该依赖。

影响：如果团队期望安全 lint，该检查实际不可运行。

建议：安装并配置插件，或移除无效命令。

### 80. `npm audit` 报 transitive `nanoid <3.3.8`

证据：`package-lock.json:6574-6582`、`package-lock.json:6588-6592` 依赖链涉及 `emscripten-wasm-loader` / `cld3-asm`。

影响：moderate 漏洞；是否可利用取决于该 transitive 用法。

建议：跟踪上游修复；不要未经测试强制升级破坏性版本。

### 81. 当前没有明显的 HTTP server 单元安全/契约测试

证据：`electron/server/index.ts` 是核心 HTTP surface，但 `tests/` 未见 server-focused unit test。

影响：CORS/auth、body limit、redaction、history privacy 等容易回归。

建议：增加 server 单元/集成测试。

### 82. 当前没有明显 updater repo/URL allowlist 单元测试

证据：`electron/updater/index.ts` 无对应 tests 文件。

影响：私有/公开 repo mismatch 和 allowlist mismatch 不易被捕获。

建议：增加 updater URL/repo 契约测试。

### 83. 当前没有明显 backup WebDAV/local 行为单元测试

证据：`electron/backup/index.ts` 无对应 tests 文件。

影响：`backup_type`、restore broadcast、import validation 缺少固定行为。

建议：增加 backup 单元/集成测试。

### 84. 当前没有明显 tray 用户可见字符串测试

证据：`electron/tray/index.ts:246-247` tooltip 错误未被测试发现。

影响：品牌名回归容易漏掉。

建议：增加 tray display-name 契约测试。

### 85. test docs 的 E2E spec 数量过时

证据：

- `docs/test.md:24-27` 说 15 个 spec。
- `docs/test_user_e2e.md:54` 说 26 个 specs。
- 当前 `tests/user_e2e/specs/` 有 27 个 `.spec.ts`。

影响：文档维护负担和可信度下降。

建议：移除精确数量或更新为 27。

### 86. E2E HTTP API 文档漏 `/dict` 和 `/history`

证据：

- `docs/test_user_e2e.md:450-455` 只列 `/translate`、`/config`、`/recognize`。
- `docs/spec.md:927-934` 包含 `/dict`、`/history`。
- `tests/user_e2e/specs/app_http_api.spec.ts:49-64` 已测试 `/dict`、`/history`。

建议：同步文档。

### 87. E2E endpoint 文档漏实际 fixture endpoint

证据：

- `docs/test_user_e2e.md:234-238` endpoint list 不完整。
- `tests/user_e2e/fixtures/e2e_api.ts:117-130` 使用 `/e2e/set-config`、`/e2e/clipboard-image`。
- `tests/user_e2e/fixtures/e2e_api.ts:173-178` 使用 `/e2e/trigger-hotkey`、`/e2e/hotkey-system-failures`。

建议：同步 endpoint 列表。

### 88. `docs/test.md` external-services 表漏 Google

证据：

- `docs/test.md:279` 表行未列 Google。
- `docs/test.md:332-334` prose 包含 Google。
- `tests/user_e2e/specs/external_services.spec.ts:23` 包含 `Google Translate`。

建议：补 Google 或移除表里的具体服务枚举。

### 89. mock/stub 命名规则未被所有 mock 测试遵守

证据：

- `docs/test.md:83-88` 要求 mock/stub 测试带 reason marker/comment。
- `tests/unit/screenshot_display.test.ts:17-26` mock Electron/log，但 suite/test 名无 `@electron-mock`/`stubbed`，无原因注释。
- `tests/unit/config_store_migration.test.ts:6-14` mock Electron 同样无 marker/reason。

建议：补 `@electron-mock` 或注释，或调整规则。

### 90. spec 技术栈 Electron 版本过时

证据：

- `docs/spec.md:101` 写 Electron 35+。
- `package.json:122` 使用 Electron `^39.8.10`。

建议：更新为 Electron 39。

### 91. active docs 仍有截图顺序过时描述

证据：

- `docs/spec.md:409` 写“触发截图时先显示覆盖层，再异步捕获屏幕”。
- `electron/screenshot/index.ts:61-71` 当前是先 capture 后 show。
- `docs/runtime_issues.md:114-123` 也记录修复后顺序是 capture-before-show。

影响：spec 可能误导未来改回已修复的白屏/自截图问题。

建议：更新 spec 截图行为顺序。

### 92. archived/design reference docs 中仍有“识别”术语旧用法

证据示例：

- `docs/archive/closed_issues/issues0518.md:41`
- `docs/archive/old_pot/spec.md:126`
- `docs/design/omni-pot/project/uploads/spec.md:113`
- `docs/design/omni-pot/chats/chat1.md:306`

影响：如果术语规则也适用于 archive/design reference，这些文档不符合“中文 UI 和用户文档避免使用 OCR 识别”的约定；如果 archive exempt，应在 `CLAUDE.md` 明确。

建议：确认 archive 是否豁免；若不豁免则替换为“文字识别”。
