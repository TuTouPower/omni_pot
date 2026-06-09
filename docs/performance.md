# Omni Pot 性能优化建议

> 聚焦"窗口打开/弹出慢"与 renderer 渲染加速。仅为分析建议，未改动代码。
> 调查日期：2026-06-09。

---

## A. 主进程侧：窗口打开慢的根因

### A1. 窗口无预创建/复用（已修复 2026-06-09）

`src/main/windows/manager.ts`

- ~~`createWindow`（line 83）每次都 `new BrowserWindow` + `loadURL/loadFile`，从零加载 HTML、执行 bundle、渲染 React。~~
- ~~`win.on('closed')`（line 251-290）关闭即从 `byLabel` 删除并销毁，下次打开全部重建。~~
- ~~对比：只有 screenshot 有预创建（`preload_screenshot_window`，`src/main/screenshot/index.ts` line 48-62）。~~
- ~~translate / dict / recognize 走 `focusOrCreate`（`hotkey/index.ts` line 60、80），首次无现存窗口就现场新建——"第一次打开慢"的主因。~~

**已落地**：启动时预创建 translate/dict/recognize 隐藏窗口（`show: false, skipTaskbar: true, backgroundThrottling: false`），`close` 事件改为 `hide()` 不 `destroy()`，触发时 `focusOrCreate` 检查 `isVisible` 并自动 `show()+setPosition()+focus()`。关闭改为隐藏复用。

实现位置：
- `src/main/windows/manager.ts` — `PRELOAD_LABELS` 常量、`close` 事件拦截、`focusOrCreate` 隐藏窗口显示逻辑、`preloadWindow()` 方法
- `src/main/main.ts` — 启动时调用 `manager.preloadWindow()` 预创建 translate/dict/recognize
- `src/main/windows/types.ts` — `WindowOptions` 新增 `backgroundThrottling`

### A2. show:true 默认导致白屏

`translate_options.ts` 无 `show` 字段；`manager.ts` line 128 `show: opts.show ?? true`。窗口先可见再渲染，用户看到白屏。
**方案**：`show:false` + 监听 `ready-to-show` 再 `show()`（若做了 A1 预创建则自然消失）。**收益中。**

---

## B. Renderer 侧：渲染加速

### B1. 无 code splitting，每窗口加载整包（收益高）

`src/App.tsx` 静态 `import` 全部 9 个窗口组件；`electron.vite.config.ts`（line 48-51）renderer 单一 input、无 `manualChunks`。打开轻量翻译小窗也要解析/执行配置页、词典页等全部代码。

**方案**：`App.tsx` 用 `React.lazy` + `Suspense` 按 hash 路由动态 import 各窗口，vite 自动分包；或给每窗口建独立 HTML entry（多 input）。首屏只下载当前窗口代码。

### B2. i18n 全量打包 19 个语言（收益中高）

`src/i18n/index.ts` bootstrap 时同步 `import { resources }` 并 `i18n.init({ resources })`，把 `src/i18n/locales/` 下 19 个语言包（约 160KB JSON）全部打进 bundle 并初始化。用户只用一种语言，其余 18 个纯浪费下载+解析。

**方案**：改用 i18next 懒加载（`i18next-resources-to-backend` 或动态 import），只加载当前 `app_language`，切换语言时再按需取。

### B3. config 异步 IPC 阻塞首屏（收益中）

- `src/main.tsx`（line 57-77）bootstrap：`registerAllServices()` → `await loadConfig()` → 才 `render()`。
- `config_store.loadConfig` `await window.electronAPI.config.get()` 一次 IPC 往返。
- 各窗口（如 `translate/index.tsx`）在 `loaded` 为真前渲染 `null`。
- `preload.ts`（line 41-44）config 只有异步 `invoke`，无同步预注入。

**方案**：preload 阶段把初始 config 同步注入 `window`（主进程经 `additionalArguments` 或 `sendSync` 传入），renderer 首屏直接拿到，省掉首次 IPC 往返与 `null` 空窗期；或先渲染骨架再异步补 config。

### B4. translate 巨型组件 + 大量独立 selector（收益中）

`src/windows/translate/index.tsx`（258+ 行）：单组件含 17 个 `useConfigStore` + 19 个 `useTranslateStore` 独立订阅，外加多个 useEffect。任一 config 字段变化都要跑全部 selector 比较。

**方案**：用 `useShallow` 合并同源 selector（一次取多个字段）；把不影响渲染的逻辑下沉到 store action；拆分子组件用 `memo` 隔离重渲染范围。`translate_panel.tsx` 已用 `memo`，可推广。

### B5. 每渲染/每翻译大量日志（收益中，生产环境）

`translate/index.tsx` 有 `log.debug('render')` 及 `handleTranslate` 内十余条 `log.info`（含 `JSON.stringify` 预览）。即便 debug 不输出，参数求值（slice、stringify）仍执行。

**方案**：生产环境用 log level 短路，或把昂贵参数包进惰性闭包；移除热路径上的 `log.debug('render')`。

### B6. 死代码 / 重复 import（收益低，顺手）

`translate/index.tsx` 顶部有重复 import（`_useTranslateStore`、`_cl`）未使用；`src/services/index.ts` `registerAllTtsServices()` 调用 5 次（应 1 次）。清理零风险。

### B7. 碎片化模块图（收益低）

`src/components/dict/` 下有大量 `dict_focus_*` 微文件，模块数多会增加 vite transform 与 bundle 解析成本。可酌情合并相关小模块。

### B8. StrictMode 双渲染（仅 dev）

`src/main.tsx` `<React.StrictMode>` 在 dev 下双调用 effect/render，拖慢开发期体感；生产 build 无影响，确认即可。

---

## C. 落地优先级

| 优先级 | 改动 | 收益 | 风险 |
|---|---|---|---|
| 1 | ~~A1 预创建+hide 复用 translate/dict/recognize~~ | 极高 | ~~中~~ 已落地 |
| 2 | B6 清死代码 + 修 TTS 重复注册 | 中 | 极低 |
| 3 | B1 renderer code splitting（React.lazy） | 高 | 低 |
| 4 | B2 i18n 语言包懒加载 | 中高 | 低 |
| 5 | B3 config 注入 preload / 先渲染骨架 | 中 | 低 |
| 6 | B4 selector 合并（useShallow） | 中 | 低 |
| 7 | B5 热路径日志瘦身 | 中 | 低 |
| 8 | A2 show:false（若未做 A1） | 中 | 低 |

**建议**：先做 #2（顺手）+ #1（根治弹出慢），体感立刻改善；再按 #3、#4 减小每窗口加载量。
