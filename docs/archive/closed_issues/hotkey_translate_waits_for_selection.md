# 翻译热键空按前等待选区读取

## 状态

已修复。

## 原问题

用户未选中文本时按 `hotkey_translate`，翻译窗口仍要等 UIA / 剪贴板回退读取选区失败后才创建，日志中可见按键触发到 `createWindow: translate` 延迟约 0.6–3.6 秒。

## 根因

`triggerTranslateEntry` 在 `focusOrCreate(TRANSLATE)` 前 `await readSelectedText()`；空选区也会先跑 UIA 与 clipboard fallback。冷路径还包含 `readSelectedText()` 内部动态加载平台选区模块，若直接并行开窗会在真正读取选区前丢失焦点。

## 修复

- 启动注册全局快捷键前调用 `prepareSelectedTextReader()`，预加载当前平台选区 reader。
- `triggerTranslateEntry` 先发起 `readSelectedText()`，立即创建 / 聚焦翻译窗口，再等待选区结果并投递 `translate:from-selection` 或 `translate:input-translate`。
- 增加单元测试覆盖：预加载后 Windows reader 在第一个 await 前启动；翻译热键会在选区 promise resolve 前开窗。
