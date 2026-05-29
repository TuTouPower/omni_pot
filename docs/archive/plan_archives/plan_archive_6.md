# TASKS.md 归档 — 2026-05-29

> 以下为 `TASKS.md` 在 2026-05-29 经当前代码核对后确认完成的事项，自当前 TASKS 中移除归档于此。
> 前序归档见 `plan_archive.md`、`plan_archive_2.md`、`plan_archive_3.md`、`plan_archive_4.md`、`plan_archive_5.md`。

---

## UI / 功能调整已完成项

- **删除收藏功能**：收藏功能已从代码、文档、测试中移除。
- **关闭 ECDICT / 词典去掉 ECDICT（历史项，已反转）**：相关移除工作曾完成；当前产品已重新启用 ECDict (CC-CEDICT)，不再作为当前待办保留。
- **Chinese Dictionary 不显示朗读按钮**：Chinese Dictionary 卡片隐藏 TTS/朗读按钮。
- **英文词典保留已有 audio**：英文词典结果保留发音链接。
- **中英文词典 DictResult 规范化**：中文/英文词典结果结构已统一，英文词典保留 audio 字段。
- **设置页服务项精简**：服务列表不再显示实例 key 小字或标签 chip。
- **设置页文字识别引擎数据源统一**：设置页与文字识别窗口共用识别引擎数据源。
- **设置通用去掉文字选项**：设置 → 通用里的字体/字号选项已移除。
- **设置文字识别开关改名**：相关开关文案已改为“自动去除换行”和“自动复制结果”。
- **设置页“关于”和“日志”样式对齐 demo**：关于 / 日志页面样式已按 demo 对齐。
- **服务器 API 测试补全**：`POST /dict` 和 `GET /history` 已补 HTTP API 测试。
- **翻译窗口高度自适应与结果区滚动**：高度自适应、结果区滚动、清空回缩已完成。
- **清理废弃快捷键配置键**：`hotkey_selection_translate` / `hotkey_input_translate` 已从配置和运行时移除。

---

## 2026-05-24 用户反馈已完成项

- **文字识别 / 截图翻译截屏显示器选择错误**：已按鼠标当前显示器选择截图源和遮罩 bounds，并补单测。
- **词典无选中文本时输入框未自动聚焦**：无选区打开词典时清空旧词条/结果并聚焦输入框，已补 e2e。
- **Chinese Dictionary 查找失败**：已验证词典 DB 样例查询并补旧配置迁移与中文真实查询 e2e。
- **Cambridge 词典没有声音**：已允许 CSP `media-src https:` 并补 CSP 单测。

---

## 审阅待办已完成项

### 安全与本地 HTTP API

- **HTTP body 大小限制**：HTTP handler 已按端点限制 body size，超限返回 413。
- **IPC history 分页 clamp**：history IPC 分页参数已按 HTTP 同等规则 clamp。

### 自动更新

- **更新仓库改为公开 release 仓库**：更新检查已改用 `TuTouPower/omni_pot_release`。
- **手动检查更新不应受启动开关阻断**：手动检查更新已忽略自动检查开关。
- **About / updater 仓库链接改为公开地址**：UI 链接已改为公开 release 仓库。

### 数据可靠性与状态

- **`config.json` 原子写入**：配置写入已改为临时文件 + rename。
- **修改快捷键时注销旧绑定**：修改快捷键前已按 name 注销旧 globalShortcut。
- **透明度切换不重置 pin/置顶**：透明度重建 close 已跳过 pin / topmost reset。
- **`recognize_always_on_top` 创建时生效**：识别窗口创建参数已读取该配置。

### UI / UX

- **server_port 输入校验**：server port 输入已校验非法值。
- **托盘 tooltip 改为 `Omni Pot`**：托盘 tooltip 已更新。
- **托盘“查看日志”走 `getUserDataDir()`**：日志入口已尊重 userData override。

### 翻译 / 词典 / OCR 服务正确性

- **DeepL 付费路径走 lang map**：DeepL 付费语言映射已改用 `DEEPL_LANGUAGES`。
- **火山引擎签名日期改为 V4 basic 格式**：签名日期格式已修复并补单测。
- **iFlytek 鉴权修复**：鉴权 URL encode / Digest header 问题已修复。
- **provider salt/nonce 改 `crypto.randomUUID()`**：相关 provider nonce 已改为 `crypto.randomUUID()`。

---

## 翻译服务改进已完成项

- **Bing 翻译超长文本无错误提示**：Bing 超长文本错误路径已返回用户可读错误。
- **新增 Google Translate 翻译服务**：Google Translate 服务、注册、默认关闭、测试和文档已完成。
- **相关文档与测试同步**：Bing / Google Translate 相关文档与测试已同步。
