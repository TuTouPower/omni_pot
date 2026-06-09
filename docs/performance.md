# Omni Pot 性能优化记录

> 2026-06-09 分析并实施，5 项优化已落地。
> 验证：295 测试通过，typecheck 通过，e2e:core 通过。

---

## A. 主进程侧：窗口打开慢的根因

### A1. 窗口无预创建/复用 ✅ 已落地 (758084f)

`src/main/windows/manager.ts`

- ~~`createWindow` 每次都 `new BrowserWindow` + `loadURL/loadFile`~~
- ~~`closed` 关闭即销毁，下次打开全部重建~~
- Preload translate/dict/recognize 隐藏窗口: `show: false, skipTaskbar: true, backgroundThrottling: false`
- `close` 事件截获 → `preventDefault()` + `hide()`, 不 destroy
- `focusOrCreate` 检测隐藏窗口自动 `show() + setPosition() + focus()`
- 退出时通过 `_quitting` 标志正常销毁

### A2. show:true 白屏 ✅ 已落地

`src/main/main.ts` — welcome 窗口改为 `show: false` + `ready-to-show` 再显示。其余窗口(A1 预创建)已消除白屏。

---

## B. Renderer 侧：渲染加速

### B1. Code splitting ✅ 已落地 (d0f0296)

`src/App.tsx` → `React.lazy` + `Suspense`，9 个窗口按 hash 路由动态 import。vite 自动分包，每窗口只加载自己代码。

### B2. i18n 懒加载 ✅ 已落地 (81a3a42)

`src/i18n/index.ts` — 去掉 18 个静态语言包 import，只保留 `en` fallback。新增 `load_locale()` / `ensure_locale()` 动态 import，切换语言时按需加载。

### B3. Config 预注入 ✅ 已落地 (5eb547a)

- `src/main/preload.ts` — `get_initial_config()` 从 `process.argv` 读取 `--omni-pot-initial-config=`
- `src/main/windows/manager.ts` — 创建窗口时通过 `additionalArguments` 注入去敏 config
- `src/stores/config_store.ts` — `loadConfig()` 先用同步初始值填充，再异步更新
- `src/main.tsx` — 移除 `await loadConfig()`, 首帧立即 render

### B4. Selector 合并 ✅ 已落地 (3ca34c9)

`src/windows/translate/index.tsx` — 17 个 `useConfigStore` + 19 个 `useTranslateStore` 合并为 2 个 `useShallow` 调用。`LanguageArea`/`SourceArea`/`TargetArea`/`SortableCard`/`DictResultInline` 加 `React.memo`。

### B5. 热路径日志瘦身 ✅ 已落地 (3ca34c9)

`handleTranslate` / `schedule_translate` / IPC 事件中的 `log.info` 降级为 `log.debug`，避免生产环境 `JSON.stringify` / `.slice()` 开销。

### B6. 死代码清理

已验证无死 import (`translate/index.tsx`)，`registerAllTtsServices()` 仅调用 1 次。

### B7. 碎片化模块

不适用。`src/components/dict/` 下无反直觉的超小文件。

### B8. StrictMode 双渲染

仅 dev 环境，生产 build 无影响。未处理。

---

## C. 未做项

| 项目 | 原因 |
|---|---|
| B7 碎片模块合并 | `src/components/` 下无 < 30 行文件,原分析为误判 |
| B8 StrictMode | 仅影响 dev,生产无影响 |

---

## D. 落地提交

| 提交 | 内容 |
|---|---|
| `758084f` | 窗口预创建+hide 复用 |
| `3ca34c9` | selector useShallow + memo + 日志瘦身 |
| `d0f0296` | renderer code splitting (React.lazy) |
| `81a3a42` | i18n 语言包懒加载 |
| `5eb547a` | config 预注入 preload |
