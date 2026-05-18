# 配置页面服务清单与功能修正

_Started 2026-05-15 21:25 UTC_

---

## User

### A1. 服务清单错误

设计稿使用了项目中不存在的服务 `yandex`、`bing_dict`。实际服务（见 `docs/spec.md`
第 13 节）用 `mymemory`、`free_dictionary` 替代了它们。

需修改:

- `shared.jsx` — `SVC_META` 中删除 `yandex`、`bing_dict`，补 `mymemory`、`free_dictionary`
- `windows/config.jsx` — `PageHistory` 示例数据中的 `yandex`、`bing_dict`、`caiyun` 改为实际服务
- `windows/config.jsx` — `PageService` 翻译实例示例与 spec 服务清单对齐
- `windows/translate.jsx` — `DictWindow` 来源标签 `Cambridge / ECDict / Bing` 改为实际词典服务（`free_dictionary` / `ecdict` / `cambridge_dict`）

### A2. 本地 API 端口

`windows/config.jsx` — `PageGeneral` 显示 `60828`，应改为实际默认值 `20202`。

### A3. 快捷键页缺"划词字典"

`windows/config.jsx` — `PageHotkey` 只有 4 个快捷键，缺第 5 个"划词字典"
（`hotkey_selection_dictionary`），需补上。

### A4. 备份页去掉阿里云盘

`windows/config.jsx` — `PageBackup` 的备份目标三选项（WebDAV / 阿里云盘 / 本地）
去掉"阿里云盘"，只保留 WebDAV / 本地。

### A5. 代理设置去掉 no_proxy

`windows/config.jsx` — `PageGeneral` 代理卡片去掉"不代理的地址"（no_proxy）字段，
只保留启用代理 / 代理地址 / 代理端口。

### A6. 服务页补"字典"Tab

`windows/config.jsx` — `PageService` 当前仅 4 类（翻译 / 识别 / 朗读 / 收藏），
按 spec §9.7 / §18.2（`dictionary_service_list` 存在）补一个 `字典` Tab，共 5 类。
字典 Tab 内容仿翻译 Tab，列出 `dictionary_service_list` 实例。

### A7. 删除插件相关元素（暂不做插件）

不引入插件系统，删除 example 中所有插件相关元素:

- `windows/config.jsx` — `PageService`：删除 `安装插件 (.potext)` 与 `浏览插件市场` 按钮，
  底部只保留 `添加内置服务`
- `windows/config.jsx` — `PageBackup` 操作卡片 hint：`备份内容：配置、历史记录数据库、已安装的插件`
  改为 `备份内容：配置、历史记录数据库、CC-CEDICT 词典数据库`
- `windows/config.jsx` — `PageAbout` 简介中若有"自定义插件"字样，整体改写为不含插件的描述

## Assistant

_[tool: list_files]_

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: update_todos]_

I'll check off what's already been fixed vs what still needs work, then make the edits.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: update_todos]_

_[tool: done]_

All project file hits are clear — remaining matches are in `uploads/spec.md` (read-only reference). Let me verify the design loads.All A-block fixes applied. Quick recap of what changed:

**A1 — service rosters**
- `shared.jsx`: deduped `mymemory` and `free_dictionary` entries (no `yandex` / `bing_dict` were present)
- `config.jsx` PageHistory: `caiyun` row → `lingva`
- `config.jsx` PageService translate tab: replaced with `deepl / bing / google / lingva / mymemory / openai@xb12 / geminipro@kk` (dict services moved to dict tab; count → 7)
- `translate.jsx` DictWindow source chips: `Cambridge / ECDict / Bing` → `Free Dictionary / ECDict / Cambridge`

**A6** — added 字典 Tab to PageService (between 翻译 and 识别) listing `free_dictionary / ecdict / cambridge_dict`.

**A7 — depluginized**
- PageService: removed `安装插件 (.potext)` and `浏览插件市场`; only `添加内置服务` remains
- PageBackup hint: `…已安装的插件` → `…CC-CEDICT 词典数据库`
- PageAbout 简介: rewritten without 插件 reference

**Already correct in the file** — A2 (port shows `20202`), A3 (划词字典 hotkey present), A4 (only WebDAV / 本地), A5 (no `no_proxy` field).

Note: `uploads/spec.md` itself still references `yandex` / `bing_dict` / `60828` / 插件 — left untouched as it's read-only reference material; if you want the spec updated too, let me know.

