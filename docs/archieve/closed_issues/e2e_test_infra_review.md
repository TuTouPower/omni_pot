# E2E 测试基础设施评审意见

> 日期: 2026-05-07
> 范围: `issues_e2e_test_infra.md`（已归档至本目录）与当前 E2E/主进程相关代码

## 总体结论

`issues_e2e_test_infra.md`（本目录）抓住了两个真实问题：

1. `ELECTRON_RUN_AS_NODE=1` 会让 Electron 以普通 Node 模式运行，导致主进程拿不到 Electron API。
2. HTTP server 当前缺少可靠的启动确认和错误日志，`[main] HTTP server started` 不能证明端口已经监听。

但文档中关于 `externalizeDepsPlugin` 的修复方向不建议继续推进。主进程打包后保留 `require("electron")` 是 Electron 应用的正常形态，问题不在于 `electron` 被 external，而在于启动 Electron 的环境变量被污染。

此外，代码里还有几个即使 HTTP server 修好也会继续影响 E2E 稳定性的缺口：renderer 事件丢失竞态、翻译触发 stale closure、`/history` 端点仍是 stub、E2E harness 需要手动启动应用且没有独立配置。

## 对现有 issue 的修正

### 1. `ELECTRON_RUN_AS_NODE=1` 判断基本正确

当前现象解释是合理的：在普通 Node 环境中，`require('electron')` 返回的是 npm 包导出的 Electron 可执行文件路径；只有在 Electron 运行时上下文中，`require('electron')` 才会解析为内置 Electron API。

相关位置：

- `out/main/index.js` 中保留了 `const electron = require("electron")`
- `electron/main.ts` 直接使用 `app.requestSingleInstanceLock()`

建议修复方向：

- 在 E2E 启动脚本中显式清理 `ELECTRON_RUN_AS_NODE`
- 不要依赖开发者手动 `unset`
- 可新增脚本，例如 `test:e2e:app` 或 E2E global setup，在启动 Electron 前删除该环境变量

示意：

```ts
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
```

### 2. 不建议把 `externalizeDepsPlugin` 当作根因

`electron.vite.config.ts` 中主进程使用 `externalizeDepsPlugin()`，打包输出里仍有 `require("electron")`。这本身不是异常。

`electron` 对主进程和 preload 来说应当由 Electron runtime 提供。强行尝试 bundle `electron` 不会解决 `ELECTRON_RUN_AS_NODE`，还可能引入更多构建问题。

建议把原 issue 中的问题 3 降级为背景说明，不作为修复项。

### 3. HTTP server 启动日志确实不可靠

当前 `electron/main.ts` 中：

```ts
debug('starting HTTP server...')
startServer(windowManager)
debug('HTTP server started')
```

`startServer()` 内部调用：

```ts
server.listen(port, '127.0.0.1')
```

`listen()` 是异步完成的。`startServer()` 返回时，只能说明开始尝试监听，不能说明端口已经绑定成功。

建议改造：

- `startServer()` 返回 `Promise<void>`
- 只在 `listening` 事件后打印成功
- 对所有 `error` 打日志并 reject
- `EADDRINUSE` 也要输出明确端口和错误码

示意：

```ts
export function startServer(mgr: WindowManager): Promise<void> {
  return new Promise((resolve, reject) => {
    server = http.createServer(...)
    server.once('listening', () => resolve())
    server.once('error', (err) => {
      server = null
      reject(err)
    })
    server.listen(port, '127.0.0.1')
  })
}
```

## 代码里额外发现的问题

### 1. `webContents.send()` 存在 renderer 未就绪竞态

多个路径会在窗口刚创建后立刻发送 IPC：

- HTTP `/translate` 创建翻译窗口后立刻 `send('translate:from-api', text)`
- OCR 创建识别窗口后立刻 `send('recognize:show', ...)`
- 截图窗口创建后立刻 `send('screenshot:show', ...)`
- 热键创建翻译窗口后立刻发送翻译事件
- 剪贴板监控创建翻译窗口后立刻发送文本

如果 renderer 还没有完成 preload、React bootstrap、`useEffect` listener 注册，事件会直接丢失。这会造成间歇性 E2E 失败，也会影响真实用户路径。

建议：

- 在 `WindowManager` 中封装 `sendWhenReady(label, channel, ...args)`
- 对新窗口等待 `did-finish-load` 或 `dom-ready`
- 或改成主进程保存 pending payload，renderer mount 后主动拉取

### 2. `translate:from-api` 触发翻译可能读到旧的 `sourceText`

`src/windows/translate/index.tsx` 中：

```ts
setSourceText(text)
setTimeout(() => handleTranslate(), 0)
```

`handleTranslate` 是 React callback，内部读取闭包里的 `sourceText`。这里存在读到旧值的风险，尤其是 E2E 中马上断言翻译结果时会放大该问题。

建议：

- 让 `handleTranslate` 支持显式文本参数
- 或在执行翻译时从 `useTranslateStore.getState().sourceText` 读取最新状态

优先建议：

```ts
const handleTranslate = useCallback(async (textOverride?: string) => {
  const textToTranslate = textOverride ?? useTranslateStore.getState().sourceText
  if (!textToTranslate.trim()) return
  ...
}, [...])
```

然后 API 触发路径使用：

```ts
setSourceText(text)
setTimeout(() => handleTranslate(text), 0)
```

### 3. `/history` 端点是 stub，相关 E2E 不可靠

HTTP server 中 `/history` 当前返回：

```ts
{ success: true, message: 'history stub', data: [] }
```

但 E2E 中 `translation is written to history` 会通过该端点查找刚写入的文本。即使 HTTP server 正常启动，这个测试也不会真正验证历史记录。

建议二选一：

- 实现 HTTP `/history`，接入真实 `get_history_page()`
- 或 E2E 直接通过 `window.electronAPI.history.list()` 验证历史

从职责清晰角度看，第二种更适合 E2E；HTTP server 的历史端点可以单独测试。

### 4. “通过 CDP 直接调用 `onTranslateFromApi`”这个替代方案不准确

`window.electronAPI.text.onTranslateFromApi` 是注册监听器，不是触发翻译的命令。CDP 里调用它只会新增 listener，不能向主进程发送 `translate:from-api`。

如果要绕开 HTTP server，应新增明确的命令式 API，例如：

```ts
window.electronAPI.text.translateFromApi(text)
```

然后 preload 通过 `ipcRenderer.invoke()` 或 `send()` 调主进程。测试里不建议复用 `ocr.sendToTranslate()`，因为它会把“划词/API 翻译”测试混到 OCR 语义里。

### 5. E2E harness 缺少自动启动和隔离

当前 E2E 文件注释要求手动启动：

```bash
npx electron-vite dev -- --remote-debugging-port=9225 &
npx vitest run tests/user_e2e/
```

这会带来几个问题：

- 环境变量清理依赖人手
- 残留 Electron 进程不容易统一回收
- `vitest.config.ts` include 了 `tests/**/*.ts`，普通 `npm test` 可能混入 E2E
- CDP 端口和 HTTP 端口没有 readiness check
- 测试之间共享真实 userData，配置和历史会互相污染

建议拆分：

- `test:unit`
- `test:integration`
- `test:e2e`

E2E global setup 应负责：

- 清理 `ELECTRON_RUN_AS_NODE`
- 指定独立 `userData` 或测试 profile
- 启动 Electron
- 轮询 CDP `/json`
- 轮询 HTTP `/config`
- 测试结束后关闭应用并清理进程

### 6. 真实翻译服务测试应分层

当前 E2E 文档强调“真实 API，无 mock”。这个方向可以保留，但不应让所有本地 E2E 都依赖外部翻译服务。

建议分层：

- 默认 E2E：验证窗口、IPC、状态流转、历史写入、DOM 渲染
- 网络 E2E：通过 `RUN_NETWORK_TESTS=1` 或类似开关启用
- 服务契约测试：单独验证 Bing、Google、DeepL 等 provider

这样 CI 和本地开发更稳定，同时仍能保留真实服务覆盖。

## 建议优先级

1. 修启动脚本和 E2E harness，确保 `ELECTRON_RUN_AS_NODE` 被清理。
2. 改造 `startServer()`，让 HTTP server 有真实 listening/error 反馈。
3. 修 `translate:from-api` 的 stale closure，确保 API 文本就是本次翻译输入。
4. 解决 `webContents.send()` 的 renderer readiness 竞态。
5. 修 `/history` stub 或改测试走真实 history IPC。
6. 拆分 Vitest 配置，避免普通测试混入 E2E。
7. 将真实网络翻译测试改为 opt-in。

## 验证建议

修复后建议按这个顺序验证：

```bash
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
```

如果 `typecheck` 暂时存在与 E2E 无关的大量历史错误，可以先为 E2E infra 修复单独跑：

```bash
npx vitest run tests/user_e2e/01_selection_translate.test.ts
```

但长期看，类型检查应恢复为提交前硬门槛。

## 当前额外状态

本次评审中运行过 `npm run typecheck`，当前失败点较多，主要集中在：

- HeroUI 组件 API 与当前代码用法不匹配
- 翻译服务返回类型 `string | DictResult` 未正确收窄
- CSS side-effect import 类型声明缺失
- 部分 config 值从 `string` 传入更窄的联合类型

这些问题不全属于 E2E 基础设施，但会影响后续验证链路，建议另起一轮集中修复。
