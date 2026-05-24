# 代码审阅报告 (review_claude.md)

- **审阅范围**：omni_pot 整库源码（HEAD = `c1107eb`），覆盖 `electron/`、`src/`、`shared/`、`tests/`、`scripts/`、`package.json`、文档一致性。
- **方法**：5 个并行 Sonnet 审查 agent 分别覆盖 (1) electron 主进程/窗口/IPC、(2) electron 服务层（config/history/backup/server/updater/selection/clipboard/detect/chinese_dict）、(3) 渲染进程 React UI、(4) src/services/* 外部服务适配器、(5) 测试/脚本/共享类型/CLAUDE.md 合规。
- **过滤**：剔除 lint/类型/格式类、纯风格、tsc 可捕获的问题、已知占位说明、agent 自行撤回的误报；保留 medium/high 置信度的真实问题。
- **基线**：root `CLAUDE.md`（用户全局约定）+ `D:\Kar\Code\omni_pot\CLAUDE.md`（项目约定）+ `docs/spec.md` + `docs/test.md`。

---

## 1. 必须优先处理（high confidence，影响功能或安全）

### 1.1 HTTP API 完全无 Origin/Auth 校验，CORS `*`
- **位置**：`electron/server/index.ts:66-67`、`101-104`、`83`
- **问题**：本机 HTTP 服务（`server_port`，默认 20202）对所有 endpoint 返回 `Access-Control-Allow-Origin: *`，浏览器中任意网页都能向 `http://127.0.0.1:20202/translate`、`/dict`、`/recognize`、`/history`、`/config` 发起请求；前三者会触发窗口弹出与外部服务调用（消耗用户配额），`/history` 泄漏翻译历史，`/config` 泄漏 WebDAV URL/用户名等敏感字段（密码已 redact，但其余配置裸露）。
- **修复**：白名单 Origin（开发期允许 `localhost` 子集）；对生产路径加 token；至少回 `Access-Control-Allow-Origin: null` 并验 `Host: 127.0.0.1`。
- **另外**：`/translate`、`/recognize`、`/dict` 接收请求体但未限制大小，可被大体积 POST 打爆内存。

### 1.2 `config.json` 写入非原子
- **位置**：`electron/config/store.ts:192-223`
- **问题**：300ms 防抖 + 直接 `writeFileSync(config_path, ...)`。进程在防抖期间 crash 或写到一半断电 → 丢失 ≤300ms 配置或留下半写文件。
- **修复**：写到 `config.json.tmp` 再 `renameSync`；崩溃前 `flush`。

### 1.3 history.db 恢复期间存在重开竞争
- **位置**：`electron/history/index.ts:17-39`、`electron/backup/index.ts:268-281`
- **问题**：`close_history()` 后任何并发请求（HTTP `/history`、热键触发的 `add_history`）都会重新 `get_db()` 重建空库或对临时路径打开连接，与 `replace_from_staging` 的 rename 竞争 → 恢复结果损坏。
- **修复**：恢复窗口期加全局 mutex/标志，所有 `get_db()` 调用先检查并抛 `restore in progress`。

### 1.4 Windows 选区 COM 引用泄漏
- **位置**：`electron/selection/windows.ts:148-152`、`230-247`
- **问题**：当 `CoInitializeEx` 返回 `RPC_E_CHANGED_MODE` 时直接 return，未配对 `CoUninitialize`（MSDN：`RPC_E_CHANGED_MODE` 仍计入引用），每次选区都泄 1 个 COM init；UI Automation `koffi.decode` 异常时 `pRange`、BSTR 未 `SysFreeString` → 长跑后 BSTR/ COM ref 累积。
- **修复**：所有 `CoInitializeEx` 成功路径（含 `RPC_E_CHANGED_MODE`）走统一 `try/finally`；循环体内 `try/finally` 释放 `pRange`/BSTR。

### 1.5 透明度切换会强行重置 pin / always-on-top 状态
- **位置**：`electron/windows/manager.ts:209-220`、`297-320`
- **问题**：`closed` handler 无条件 `setConfig('translate_pinned', false)` 与 `..._always_on_top = false`；`rebuildForTransparencyChange()` 内 `win.close()` 触发该 handler，从而把用户先前设置的 pin/always-on-top 静默清掉。
- **修复**：close handler 只在 `app.quitting` 时重置；rebuild 时设置一个 `isRebuilding` 标记跳过状态清理。

### 1.6 修改快捷键后旧绑定不清理
- **位置**：`electron/hotkey/index.ts:80-107`
- **问题**：`registered_hotkey_actions` 以 `name` 为键，但 `registered_hotkeys` 以 `shortcut` 为键。同 `name` 改新 `shortcut` 时旧 `shortcut` 未从 `globalShortcut` 注销 → OS 层残留陈旧绑定。
- **修复**：注册新 shortcut 前，先按 `name` 查旧 shortcut 并 `globalShortcut.unregister`。

### 1.7 dict 窗口尺寸记忆使用了 translate 的开关
- **位置**：`electron/windows/manager.ts:181-188`、`electron/windows/dict_options.ts:9,26`
- **问题**：dict 窗口的 `resize` 持久化判断 `getConfig('translate_remember_window_size')`——用户开启 translate 记忆才会持久化 dict 尺寸。
- **修复**：新增 `dict_remember_window_size` 配置；或直接将 dict 尺寸记忆设为默认开启。
- **同类问题**：`translate_remember_window_size` 仅在创建窗口时读一次，运行时切换不会即时生效（同源问题——bind listener 应基于配置变化重新订阅，或始终订阅、内部按当前配置决定是否写）。

### 1.8 7 个单元测试文件从未被 vitest 包含
- **位置**：`vitest.config.ts:7`（`include: ['tests/**/*.test.ts']`） vs 实际文件名
- **问题**：以下文件命名为 `test_*.ts` 而非 `*.test.ts`，被 vitest glob 完全忽略：
  `tests/unit/services/test_bing.ts`、`test_deepl.ts`、`test_google.ts`、`test_registry.ts`、`tests/unit/windows/test_manager.ts`、`tests/unit/stores/test_translate_store.ts`、`tests/unit/lib/test_crypto.ts`。
- **影响**：Bing/DeepL/Google 等核心翻译适配器实际没有任何执行中的单元测试；`docs/test.md §5.1` 明确将它们列为覆盖中的测试。
- **修复**：重命名为 `*.test.ts`，或调整 vitest `include` glob。

### 1.9 文档与代码不一致（违反项目 CLAUDE.md "保证文档时时刻刻与代码一致"）
- **位置**：`docs/test.md §5.1`
- **问题**：列出的 7 个测试文件实际未运行（与 1.8 同源），需同步修订。

### 1.10 外部服务测试网络门变量错配
- **位置**：`tests/unit/services/test_bing.ts:4`、`test_google.ts:4`
- **问题**：使用 `RUN_NETWORK_TESTS`，项目标准是 `OMNI_POT_EXTERNAL_SERVICE_TESTS`（见 `package.json:25` 与 `docs/test.md §2.1`），即便 1.8 修了文件名，这些用例也永远不被 `test:e2e:external` 触发。
- **修复**：统一为 `OMNI_POT_EXTERNAL_SERVICE_TESTS`。

### 1.11 external_services.spec 在公共服务不可达时 `test.skip(true,...)`
- **位置**：`tests/user_e2e/specs/external_services.spec.ts:121`
- **问题**：`docs/test.md §2.1` 明文规定该 spec 不允许 mock 也不允许 skip，公共服务不可达应当失败并暴露具体服务；当前实现以网络探测后 `skip(true,...)` 静默掩盖。
- **修复**：去掉 skip，让测试失败带具体服务名输出。

### 1.12 截图失败被静默吞掉
- **位置**：`electron/screenshot/index.ts:73-76`
- **问题**：`catch {}` 无日志、无返回原因，违反 CLAUDE.md "暴露权衡 / 暴露问题"。
- **修复**：`catch (e) { log_main.error('screenshot failed', e); throw e }` 或上层有 toast 提示。

### 1.13 OpenAI 流式解析单 chunk 异常会中断整条流
- **位置**：`src/services/openai.ts:63`、`124`
- **问题**：`JSON.parse(trimmed.slice(6))` 没有 try/catch；网络抖动产生半截 chunk 时整条 SSE 流崩溃。`ollama.ts` 已经用 try/catch，应保持一致。
- **修复**：参照 `ollama.ts` 包 try/catch，仅丢弃单 chunk。

### 1.14 DeepL 付费路径绕过 lang map
- **位置**：`src/services/deepl.ts:214`、`217`
- **问题**：付费路径直接 `to.toUpperCase().replace('_','-')`，跳过 `DEEPL_LANG_MAP`；`zh_cn` 变 `ZH-CN`（DeepL 实际接受 `ZH` 或 `ZH-HANS`），`nb_no`/`mn_mo` 等非主流码静默送出非法值。
- **修复**：付费路径同样走 `DEEPL_LANG_MAP`。

### 1.15 火山引擎签名日期格式错误
- **位置**：`src/services/volcengine_sign.ts:21-30`
- **问题**：使用 `YYYY-MM-DD`；火山 V4 要求 `X-Date` 为 ISO8601 basic `YYYYMMDDTHHMMSSZ`，credential scope 日期为 `YYYYMMDD`。所有请求会被服务端拒签。
- **修复**：按规范输出 basic 格式。

### 1.16 所有 provider 无超时 / AbortController
- **位置**：全部 `src/services/*.ts`（baidu/alibaba/google/openai/deepl/youdao/niutrans/mymemory/caiyun/transmart/chatglm/geminipro/ollama/tencent/volcengine/cambridge_dict/free_dictionary 等）
- **问题**：单个 provider 挂起会无限阻塞翻译流水线，UI 永远在 loading。
- **修复**：统一封装 `fetchWithTimeout`，默认 15s + abort signal，handler 层超时归一报错。

### 1.17 contentEditable 词典输入位置被覆盖
- **位置**：`src/windows/dict/index.tsx:386-403`
- **问题**：以 `{word}` 作为 `contentEditable` 的 children；`setWord(...)` 在 `handleLookup` 中触发后，React 重新写入 DOM 会重置 caret 位置——React 官方文档明确指出该模式有问题，输入体验会闪烁/跳位。
- **修复**：用受控的 `<input>`，或改为非受控 + `useRef` 写入；若必须 contentEditable，使用 `dangerouslySetInnerHTML` 仅在外部数据流入时写。

### 1.18 截图窗口 / 词典 / 翻译 / 快捷键设置存在硬编码中文
- **位置**：
  - `src/windows/screenshot/index.tsx:303-310` — `拖动选取区域`/`确认`/`取消`
  - `src/windows/translate/target_area.tsx:83-84`、`src/windows/dict/index.tsx:70-71` — `翻译中` / `加载中` aria-label/title
  - `src/windows/config/hotkey_settings.tsx:93-100`、`159`、`162`、`168-184` — 状态文本与帮助文案
- **问题**：均应走 `t()`，否则切换 i18n 时露馅。CLAUDE.md / spec 要求多语言一致。
- **修复**：补 `zh_cn`/`en` 等 i18n key 并替换为 `t()`。

### 1.19 OCR 自动识别可能形成无限 re-OCR 循环
- **位置**：`src/windows/recognize/index.tsx:401-405`
- **问题**：`useEffect` 依赖 `effectiveService` 但通过 lint disable 排除了 `handleRecognize`；当 `qr_detected` 自动切换 service 时该 effect 再次触发，对同图重新识别又可能再次触发 QR 检测——若图像本身含 QR，会进入再识别链。
- **修复**：缓存"已对此 image+service 组合识别过"标志，或把 QR 切换与重识别解耦。

### 1.20 recognize 窗口的语言对调按钮在 source=auto 时是 no-op
- **位置**：`src/windows/recognize/index.tsx:594-601`
- **问题**：`src === 'auto' ? selectedLanguage : selectedLanguage`——两支返回同值，swap 实际什么都不做。
- **修复**：`auto` 时用上一次成功检测的语言或保留原行为并禁用按钮。

### 1.21 托盘 tooltip 仍叫 "Pot Desktop"
- **位置**：`electron/tray/index.ts:247`
- **问题**：硬编码 `Pot Desktop`，违反项目 CLAUDE.md "显示名 Omni Pot"。
- **修复**：改 `Omni Pot`，并考虑读 `app.getName()`。

---

## 2. 中等优先（medium confidence，建议修但不紧急）

### 2.1 主进程 / 窗口
- `electron/main.ts:12` 早期 `log_main.info('starting...')` 早于 `initLog(getUserDataDir())`，首批日志落到默认 electron-log 路径而非 `%APPDATA%\omni_pot\logs\main.log`。建议把 log 初始化提到 `app.whenReady` 最前。
- `electron/windows/manager.ts:74` `focusOrCreate` 仅 `focus()`，未处理已最小化的窗口（应 `restore()`）。
- `electron/windows/manager.ts:251-258` `focusOrCreate` 返回已存在窗口时不再应用新的 `opts`，配置变化（alwaysOnTop 等）不会刷新。
- `electron/windows/manager.ts:52` `renderer:ready` 监听信任 `label` 参数，contextIsolation 已开启所以风险低，但建议校验 `event.sender` 与 label 对应窗口。
- `electron/main.ts:88` + `electron/screenshot/index.ts:48-53` 预热截图窗口未监听 `screen.on('display-added' | 'display-removed')`；实际 capture 路径会 setBounds，但预热路径仍可能在错误显示器闪现。

### 2.2 服务 / 数据
- `electron/updater/index.ts:177-189` 安装包仅依赖 HTTPS，没有 sha256 / 签名校验。
- `electron/updater/index.ts:62-67` 下载 URL 来自渲染层 IPC，渲染被攻陷可下载该仓库下任意 release 资产；URL 校验只看 `.githubusercontent.com` 后缀。
- `electron/updater/index.ts:37-45` `compare_versions` 不处理 pre-release tag（`1.2.0-beta` 与 `1.2.0` 视为相等）。
- `electron/clipboard/index.ts:14-21` `withClipboardMutationSuppressed` 用单全局 `suppressUntil` 时间戳，多并发会互相打断。建议改成"嵌套引用计数"。
- `electron/selection/clipboard.ts:38-58` `restoreClipboard` 先 `clipboard.write(payload)` 再为每种格式回写 raw buffer，会覆盖前一步的内容，非平凡剪贴板恢复有损。
- `src/services/baidu.ts:57`、`baidu_field.ts:58`、`youdao.ts:71`、`alibaba.ts:88` 使用 `Math.random().toString(36).substring(2)` 作为 salt/nonce，可能产生空串或异常短串，造成签名错误或 nonce 冲突。建议 `crypto.randomUUID()`。
- `src/services/youdao.ts:71` 仍用 v1 风格 MD5 签名（缺 `curtime`、不是 SHA-256），有道 v3 已要求 SHA-256 + `curtime`。
- `src/services/bing.ts:124-127` 没有 `if (!resp.ok)`，4xx/5xx 时 JSON parse 抛不透明错；`cachedConfig` 失败时不失效。
- `src/services/transmart.ts:60-61` 鉴权方式 `Bearer username:token` 与 TranSmart `imt` 实际签名差异较大，请求大概率失败。
- `src/services/google.ts:50-56` 对 `data[0]` 为 `null` 的合法空译响应抛错。

### 2.3 渲染 / React
- `src/windows/translate/source_area.tsx:171-178` 动态翻译 timer 的 `useEffect` 依赖包含 `onTranslate`，父组件每次 rerender 重新构造 → timer 反复重置。建议把 `onTranslate` 用 ref 持有。
- `src/windows/recognize/index.tsx:329-346` 主进程 `onRecognizeShow` 监听重订阅依赖 `handleNormalizeText` / `recognize_auto_copy`，每次变化都拆/装监听，存在极短窗口可能丢事件。
- `src/windows/translate/index.tsx:80-85` mount-only effect 在 config 异步晚到时不会再触发，可能让 store 维持错的默认语言。
- `src/windows/translate/index.tsx:325` `setTimeout(..., 50)` 聚焦输入框无 cleanup，建议 `requestAnimationFrame`。
- `src/windows/dict/index.tsx:50` `setTimeout(() => setCopied(false), 1500)` 无 cleanup。
- `src/windows/translate/source_area.tsx:122` 仅按 `e.key === 'U'` 判定快捷键，Caps Lock 等场景应同时接受 `e.code === 'KeyU'`。

### 2.4 IPC / 类型
- `shared/types/ipc.ts:60` `writeClipboardImage(base64Image: string)` 用 camelCase，对应 handler 用 `base64_image` snake_case，违反项目 CLAUDE.md "所有命名一律使用下划线命名法"。
- `shared/types/ipc.ts:96` `chineseDict:` 通道名混用 camelCase（其它通道是 snake_case 或 kebab）；不致命但易混。
- `shared/types/ipc.ts:11` HistoryRecord 字段 `service_key` vs `shared/types/service.ts:52` `serviceKey`，跨层 mapping 易写错。

### 2.5 测试 / 脚本
- `tests/user_e2e/specs/external_services.spec.ts:157` 永久 `test.skip` 占位用例。要么实现要么删除（违反 CLAUDE.md "不为不可能发生的场景写错误处理"）。
- `tests/unit/screenshot_display.test.ts:17-23` mock 了 `desktopCapturer`/`screen` 但 `describe` 未按 `docs/test.md §2.1` 命名标注 `[stubbed]` / `@electron-mock`。

---

## 3. 低优先 / 备忘（low confidence 或风格类）

- `electron/server/index.ts:531-541` `handleResetConfig` 在循环里逐键 `setConfig`，触发 ~50 次 broadcast，可能 UI 闪烁；改为批量 setter 更佳。
- `electron/chinese_dict/index.ts:162-177` FTS5 `prefix-*` 查询无最小长度限制，单字符前缀查询在大库上耗时显著。
- `package.json:17` `format:check` 内嵌长 biome 参数，建议挪 `biome.json`。
- `package.json:25-26` 通过 `node -e "..."` 设置环境变量，Windows 下脆弱；用 `cross-env` 或独立 `.mjs`。
- `scripts/check_dist_locks.mjs:111`、`136` 用 `Atomics.wait` 实现 sleep，可读性差；用 `node:timers/promises.setTimeout`。
- `src/services/ocr/baidu_common.ts:19` `expiresAt: Date.now() + ttl - 86400000` 对 ttl < 1 天的返回值会产出负 expiry，看似无功能影响但 cache 永远未命中；同时 cache key 含 secret，hot heap dump 时小风险。
- `src/services/deepl.ts:32-45`、`bing.ts:55` 硬编码 UA/版本仿冒官方客户端，未来 provider 端封禁时会整体失效，建议在 spec/limitations 中列出。
- `src/services/cambridge_dict.ts:74`、`112`、`144` 多个不带界长的 HTML 正则，存在 ReDoS 风险（攻击者控制 HTML 较低，但若 Cambridge 改版插入超长属性则放大）。
- `electron/windows/manager.ts:13-19` `debounce` 关闭 timer 复位顺序存在极小竞态，影响很小。

---

## 4. 已撤回 / 误报（仅记录避免重复）

- 备份恢复部分回滚顺序检查后属正确（先收集 rollback_paths 再写新文件）—— **withdrawn**。
- 腾讯签名 `tc3_request` 与 spec 一致 —— **withdrawn**。
- `scripts/build_chinese_dict.ts:9` 硬编码 WSL 路径在项目 CLAUDE.md 中明文允许，**非缺陷**。

---

## 5. 建议处理顺序

1. **§1.1 / §1.2 / §1.3 / §1.4** — 安全 + 数据可靠性，立刻修。
2. **§1.5 / §1.6 / §1.7** — 用户感知的状态丢失/快捷键残留。
3. **§1.8 / §1.9 / §1.10 / §1.11** — 测试可信度，先恢复 vitest include 才能继续开发新功能。
4. **§1.13 / §1.14 / §1.15 / §1.16** — provider 稳定性 / 正确性。
5. **§1.12 / §1.17 / §1.18 / §1.19 / §1.20 / §1.21** — UX 与 i18n。
6. §2 / §3 按贡献者节奏批量推进。

---

## 6. 元信息

- 审阅 HEAD：`c1107eb`
- agent 用时：services 154s / windows 271s / renderer 291s / providers 196s / tests 261s（并行）
- 报告生成时间：2026-05-25
