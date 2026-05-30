# Code review

范围：`de9c6ac3b5f655c2289bc845b484029dead0df82..77bf37ad2addbc1178f6071c1651c5556823afef`

检查方式：

- 对主仓 `D:/Kar/Code/omni_pot` 复核，确认 `HEAD = 77bf37ad2addbc1178f6071c1651c5556823afef`，未采用 `.claude/worktrees/*` 的旧状态。
- 分安全/config/API/preload/IPC、窗口/热键/选区、外部服务、backup/history/updater/scripts 四块并行审阅。
- 核对 diff、当前代码、周边调用、git blame/history；未运行 build/typecheck。
- 本报告不按 80 分阈值过滤；低置信问题也保留并标明置信度。

## BUG

### 1. 服务密钥匹配规则漏掉真实凭据字段，导致明文落盘/进备份

置信度：100/100

`service_secret_key_pattern` 不匹配 `key`、`apisecret`、`secretKey`。但 Youdao 使用 `config.key` 作为签名密钥，iFlytek OCR 系列使用 `config.apisecret` 参与鉴权。`protect_config_secrets()` 和 `sanitize_config_secrets()` 都依赖该正则，所以这些凭据不会被加密，也不会从备份 config 中移除。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/config/secrets.ts#L16-L18

证据：

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/services/youdao.ts#L68-L73

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/services/ocr/iflytek_ocr.ts#L29-L31

---

### 2. `safeStorage` 不可用时，密钥迁移会删除已有凭据

置信度：75/100

`encrypt_secret()` 在 `safeStorage.isEncryptionAvailable()` 为 false 时返回 `undefined`。`protect_config_secrets()` 会把 top-level secret 和 service secret 写成 `undefined`；迁移路径随后写回磁盘，`JSON.stringify()` 会省略这些字段，等价于删除已有密钥。影响 Linux 无 secret service、headless、异常系统环境。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/config/secrets.ts#L55-L60

证据：

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/config/secrets.ts#L108-L120

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/config/store.ts#L147-L150

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/config/store.ts#L222-L229

---

### 3. 全局热键先聚焦 Omni Pot 再读取选区，破坏“翻译/词典查选中文本”

置信度：95/100

`triggerTranslateEntry()` / `triggerSelectionDictionary()` 先创建/聚焦窗口，再等待 `readSelectedTextLater()`。但 Windows 选区读取依赖当前焦点元素，fallback 还会对当前焦点发送 Ctrl+C。聚焦 Omni Pot 后再读，容易读到 Omni Pot 自己或空文本，而不是原应用选区。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/hotkey/index.ts#L53-L63

词典路径同样受影响：

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/hotkey/index.ts#L75-L83

选区读取依赖焦点/剪贴板快捷键：

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/selection/windows.ts#L173-L180

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/selection/windows.ts#L248-L257

---

### 4. About 页链接全部指向 release repo，但 `shell:openExternal` 只允许源码 repo

置信度：95/100

`is_allowed_external_url()` 只允许 `github.com/TuTouPower/omni_pot`，About 页 `REPO_URL` 是 `github.com/TuTouPower/omni_pot_release`。官网/文档/反馈/检查更新按钮都会被 handler 返回 `false`，用户点击无效果。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/ipc/shell_handlers.ts#L12-L18

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/windows/config/about.tsx#L17-L18

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/windows/config/about.tsx#L70-L80

---

### 5. 日志导出成功后打开 `file://` 被同一 allowlist 拦截

置信度：95/100

About 页导出日志成功后调用 `shell.openExternal(file://...)` 打开 zip；但主进程只允许 GitHub HTTPS URL，`file://` 一定被拒绝。导出文件存在，但“导出后打开”功能失效且 UI 吞掉错误。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/windows/config/about.tsx#L37-L43

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/ipc/shell_handlers.ts#L23-L29

---

### 6. `config:getAll` 仍向非设置窗口返回完整密钥配置

置信度：90/100

本次新增 sender label 校验，但 `config:getAll` 对 welcome/translate/dict/recognize/screenshot/tray/updater 等窗口仍返回完整 `getAllConfig()`。完整配置包含 `server_api_token`、`webdav_password`、`service_instances` 里的 provider key。非设置窗口一旦有 XSS/渲染层注入，就能读取全部凭据，削弱本次 preload/IPC 拆分和凭据保护目标。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/ipc/config_handlers.ts#L27-L36

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/ipc/config_handlers.ts#L65-L68

配置中确有敏感字段：

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/shared/types/config.ts#L15-L17

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/shared/types/config.ts#L70-L75

---

### 7. 非设置窗口可写任意配置 key，包括 API token、服务实例和自启动

置信度：88/100

`config:set` 对 welcome/translate/dict/recognize 开放，且只按默认值做粗粒度类型校验，没有按窗口限制 key。非设置窗口被注入后可写 `server_api_token`、`service_instances`、`auto_start` 等全局敏感配置。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/ipc/config_handlers.ts#L37-L43

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/ipc/config_handlers.ts#L50-L64

对象类配置只验证 `typeof object`，无法阻止任意 service config 写入：

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/ipc/config_handlers.ts#L13-L17

---

### 8. HTTP API token 被加密后，文档中的外部脚本获取路径失效

置信度：82/100

HTTP API 新增 `X-Omni-Pot-Api-Token`，文档说 token 保存在 `config.json`，外部脚本读取后放入请求头。但 `server_api_token` 被列为 top-level secret，写盘会变成加密 marker；About 页也只展示/复制 API URL，不显示 token。普通外部脚本无法按文档拿到明文 token，公共 HTTP API 实际不可用。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/docs/api.md#L3-L12

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/config/secrets.ts#L16-L18

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/config/store.ts#L200-L203

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/windows/config/about.tsx#L99-L103

---

### 9. OCR 引擎选项为空时，设置页直接抛错

置信度：85/100

`ConfigSelect` 渲染时无条件 `require_select_option(options, active_index)`。文字识别设置的 `engineOpts` 会过滤掉禁用/缺失服务，用户禁用所有 OCR 服务或配置列表为空时 options 为 `[]`，打开设置页会抛 `select requires options`，无法进入页面恢复配置。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/windows/config/config_components.tsx#L76-L98

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/windows/config/recognize_settings.tsx#L21-L35

---

### 10. 下拉菜单按 Escape 会继续冒泡，关闭整个窗口

置信度：90/100

键盘支持新增后，下拉的 Escape 分支只 `preventDefault()` + `setOpen(false)`，没有 `stopPropagation()`。翻译/识别窗口有全局 Escape 关闭窗口监听。用户想关闭下拉时，会关闭整个窗口。

翻译语言下拉：

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/windows/translate/language_area.tsx#L63-L80

翻译窗口全局关闭：

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/windows/translate/index.tsx#L336-L342

识别窗口 pill 下拉同样存在：

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/windows/recognize/index.tsx#L141-L158

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/windows/recognize/index.tsx#L431-L437

---

### 11. `translate_window_position: pre_state` 不能恢复合法的 0 或负坐标

置信度：85/100

恢复上次窗口位置时要求 `saved_x > 0 && saved_y > 0`。但合法坐标可以是 `0`，多显示器在主屏左/上方时还可能是负数。保存时没有这种限制，恢复时却丢弃，导致“上次位置”在边缘/副屏失效。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/windows/manager.ts#L99-L110

---

### 12. 备份恢复新增未知 key 拦截，会拒绝旧备份的可迁移配置

置信度：92/100

`validate_backup_config()` 只允许 `DEFAULT_CONFIG` + `__initialized`。但 config store 仍包含旧键迁移逻辑，例如删除旧 `dev_mode`。带旧键的历史备份在进入迁移逻辑前就被拒绝，导致旧备份无法恢复。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/backup/index.ts#L254-L267

旧键迁移仍存在：

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/config/store.ts#L119-L122

---

### 13. Cambridge entry 正则从 lookahead 改成消费边界，可能只解析第一个 entry

置信度：70/100

旧正则使用 `(?=class="pr entry-body__el|$)` 不消耗下一个 entry 起点；新正则用 `(?:class="pr entry-body__el|$)`，匹配第一个 entry 时会吃掉下一个 entry 的 `class="pr entry-body__el` 前缀，`lastIndex` 前移后后续 entry 不再能从完整 class 起点匹配。多词性/多 entry 结果可能丢失后续释义。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/services/cambridge_dict.ts#L75-L80

---

### 14. Cambridge `def_pattern` 对嵌套 `div` 结构过硬，可能漏解析释义

置信度：65/100

新 `def_pattern` 用 `[^<]*(?:<(?!\/div\b)[^<]*)*` 禁止遇到任何 `</div>`，再硬要求三个 `</div>`。如果 Cambridge 的 `def-block` 内部有嵌套 div 或层级变化，会整条释义匹配失败。旧实现更宽松。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/services/cambridge_dict.ts#L113-L130

---

## WARN / 兼容风险

### 15. 备份现在脱敏凭据，但规格仍承诺“设置恢复正确”

置信度：86/100

本地备份写入的是 `sanitize_config_secrets(getAllConfig())`，会移除 `server_api_token`、WebDAV 密码和服务密钥。恢复后设置项看似恢复，但外部 API、WebDAV、翻译/OCR/TTS 服务凭据丢失。规格仍写“备份内容：设置、历史记录数据库”“恢复后需要验证配置和历史记录恢复正确”，没有说明凭据不恢复。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/backup/index.ts#L63-L65

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/config/secrets.ts#L140-L149

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/docs/spec.md#L580-L587

---

### 16. 删除 OpenAI 翻译服务没有迁移旧用户配置

置信度：65/100

`openaiService` 被删除且不再注册。已有用户如果配置过 `openai@...` 翻译实例，`translateServiceRegistry.get('openai')` 返回空，翻译卡会被置为 `null`。如果这是有意删除，也需要迁移/清理旧 `translate_service_list` 和 `service_instances`，否则升级后表现为服务静默失败。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/services/index.ts#L24-L43

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/windows/translate/index.tsx#L160-L168

---

### 17. 统一 15s provider timeout 可能误杀慢 OCR / 本地 LLM 首次请求

置信度：60/100

`fetch_with_timeout()` 默认 15s，所有 provider 直接套用。OCR、大图视觉识别、Ollama 首次加载模型可能超过 15s 才返回响应头。新 timeout 是好方向，但没有 per-service override，可能把原本可用的慢服务变成失败。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/services/fetch_timeout.ts#L1-L7

Ollama 使用默认值：

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/services/ollama.ts#L36-L47

OpenAI Vision OCR 也使用默认值：

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/services/ocr/openai_vision.ts#L59-L63

---

### 18. updater digest 校验失败后，已下载文件不会清理

置信度：60/100

`download_asset()` 完整写出文件后才调用 `verify_download_digest()`。校验失败时 handler 返回失败，但不删除已写出的 `output_path`；`remove_partial()` 只覆盖下载过程中失败。风险较低，因为不会自动打开，但会在 temp 目录残留不可信安装包。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/updater/index.ts#L281-L295

清理只在下载内部 fail 路径：

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/updater/index.ts#L129-L150

---

### 19. prerelease 版本比较用字符串序，非 SemVer 规则

置信度：50/100

`compare_versions()` 对两个 prerelease 直接 `lat.pre_release > cur.pre_release`。SemVer 中 `beta.10` 应大于 `beta.2`，字符串序会反过来。若项目只发稳定版影响低；若用多段 prerelease，更新提示可能错。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/electron/updater/index.ts#L84-L92

---

### 20. Google 异常响应从 throw 改为返回空字符串，可能隐藏真实故障

置信度：45/100

Google 返回空/异常结构时现在返回 `''`。如果是限流、验证码页、协议变化，UI 可能显示“成功但空结果”，而不是错误状态。影响诊断，不一定是功能破坏。

https://github.com/TuTouPower/omni_pot/blob/77bf37ad2addbc1178f6071c1651c5556823afef/src/services/google.ts#L45-L52
