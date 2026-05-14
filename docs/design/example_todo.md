# example 设计稿待办

> 记录 `docs/design/example/` 设计稿与 `docs/spec.md` 不符之处及处理决定。
> 设计稿原型文件：`design-canvas.jsx`、`shared.jsx`、`windows/translate.jsx`、
> `windows/other.jsx`、`windows/config.jsx`、`styles.css`、`omni_pot Design.html`。

---

## A. 需要修改设计稿（与 spec 不符的笔误）

### A1. 服务清单错误

设计稿使用了项目中不存在的服务 `yandex`、`bing_dict`。实际服务（见 `docs/spec.md`
第 13 节）用 `mymemory`、`free_dictionary` 替代了它们。

需修改：
- `shared.jsx` — `SVC_META` 中删除 `yandex`、`bing_dict`，补 `mymemory`、`free_dictionary`
- `windows/config.jsx` — `PageHistory` 示例数据中的 `yandex`、`bing_dict`、`caiyun` 改为实际服务
- `windows/config.jsx` — `PageService` 翻译实例示例与 spec 服务清单对齐
- `windows/translate.jsx` — `DictWindow` 来源标签 `Cambridge / ECDict / Bing` 改为实际词典服务（`free_dictionary` / `ecdict` / `cambridge_dict`）

### A2. 本地 API 端口

`windows/config.jsx` — `PageGeneral` 显示 `60828`，应改为实际默认值 `20202`。

### A3. 快捷键页缺“划词字典”

`windows/config.jsx` — `PageHotkey` 只有 4 个快捷键，缺第 5 个“划词字典”
（`hotkey_selection_dictionary`），需补上。

### A4. 备份页去掉阿里云盘

`windows/config.jsx` — `PageBackup` 的备份目标三选项（WebDAV / 阿里云盘 / 本地）
去掉“阿里云盘”，只保留 WebDAV / 本地。

### A5. 代理设置去掉 no_proxy

`windows/config.jsx` — `PageGeneral` 代理卡片去掉“不代理的地址”（no_proxy）字段，
只保留启用代理 / 代理地址 / 代理端口。

---

## B. 保留为超前需求（设计稿不改，待代码与 spec 后续补齐）

### B1. 托盘菜单

`windows/other.jsx` — `TrayMenu` 含 OCR 识别、OCR 翻译、自动复制子菜单、检查更新、
查看日志等菜单项，比当前代码托盘（Input Translate / Clipboard Monitor / Config /
Restart / Quit）丰富。**作为超前设计需求保留**，代码与 `docs/spec.md` 第 21 节后续补齐。

### B2. 配置-历史页搜索与筛选

`windows/config.jsx` — `PageHistory` 含搜索框、服务筛选、时间范围筛选，当前代码与
spec 仅有分页浏览。**作为超前设计需求保留**，代码与 `docs/spec.md` 第 9.8 / 25 节后续补齐。
