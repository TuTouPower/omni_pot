# E2E 测试基础设施问题清单

> 日期: 2026-05-07
> 状态: 未解决

---

## 问题 1: `ELECTRON_RUN_AS_NODE=1` 导致 Electron API 不可用

**现象**: 运行 `npx electron-vite dev` 时，主进程报错：

```
TypeError: Cannot read properties of undefined (reading 'requestSingleInstanceLock')
```

**根因**: 当前 shell 环境中 `ELECTRON_RUN_AS_NODE=1` 被全局设置。该环境变量让 `electron.exe` 以普通 Node.js 模式运行，`require('electron')` 返回 npm 包的路径字符串而非 Electron API 对象。

**验证**:
```bash
echo $ELECTRON_RUN_AS_NODE  # 输出: 1
node_modules/electron/dist/electron.exe -e "console.log(typeof require('electron'))"  # 输出: string
```

**临时修复**:
```bash
# 方法 1: env -u 删除环境变量
env -u ELECTRON_RUN_AS_NODE npx electron-vite dev -- --remote-debugging-port=9225

# 方法 2: unset（仅在当前 shell 有效）
unset ELECTRON_RUN_AS_NODE && npx electron-vite dev -- --remote-debugging-port=9225
```

**需要的永久修复**: 在项目的启动脚本或 CLAUDE.md 中明确 `unset ELECTRON_RUN_AS_NODE`，或在 `electron.vite.config.ts` 中处理。

---

## 问题 2: HTTP API Server (端口 20202) 未启动

**现象**: Electron 应用正常启动，CDP 连接正常，`[main] HTTP server started` 日志输出，但端口 20202 没有任何进程监听。

**验证**:
```bash
netstat -ano | grep 20202  # 无输出
curl http://127.0.0.1:20202/config  # 连接拒绝
```

**受影响的功能**:
- E2E 测试中的 `triggerTranslateViaApi()` 函数依赖此 HTTP 端点
- 所有 12 个翻译触发测试全部失败（`Error: connect ECONNREFUSED 127.0.0.1:20202`）

**可能原因**:
1. `server.listen(port, '127.0.0.1')` 是异步调用，`listen` 返回后日志已打印，但实际绑定可能失败
2. `server.on('error')` 仅处理 `EADDRINUSE`，其他错误被忽略
3. `ELECTRON_RUN_AS_NODE` 问题修复后重新构建的 `out/main/index.js` 可能存在模块解析问题（`externalizeDepsPlugin` 将 `electron` 外部化导致 `require('electron')` 解析到 npm 包）

**需要排查**:
- 在 `startServer` 中添加 `server.on('listening', ...)` 回调确认端口确实绑定成功
- 检查 `server.on('error')` 是否捕获了非 `EADDRINUSE` 的错误
- 验证 `http` 模块在打包后的 `out/main/index.js` 中是否正确解析

---

## 问题 3: `externalizeDepsPlugin` 将 `electron` 外部化

**现象**: `electron.vite.config.ts` 中 `externalizeDepsPlugin()` 将 `package.json` 的所有 `dependencies` 标记为 Rollup external，包括 `electron`。打包后的 `out/main/index.js` 第 24 行：

```js
const electron = require("electron");
```

在 `ELECTRON_RUN_AS_NODE=1` 环境下，此 `require` 解析到 `node_modules/electron/index.js`（返回路径字符串），而非 Electron 内置模块。

**已尝试的修复**:
```ts
// electron.vite.config.ts
plugins: [externalizeDepsPlugin({ exclude: ['electron'] })]
```

**结果**: 打包输出未变化，`require("electron")` 仍然存在。可能是 Rollup 将 `electron` 视为 Node.js 内置模块而始终外部化。

---

## 问题 4: 多个 Electron 进程残留

**现象**: 每次启动失败后 Electron 进程不完全退出，残留 6 个 `electron.exe` 进程，占用资源并可能导致端口冲突。

**清理方法**:
```bash
taskkill //F //IM electron.exe
```

---

## 测试运行现状

| 测试项 | 状态 | 原因 |
|--------|------|------|
| has translation services configured | PASS | 仅读取配置，不依赖 HTTP server |
| result cards appear in DOM order | PASS | 仅检查 DOM 结构 |
| result card headers show service names | PASS | 仅检查 DOM 结构 |
| English text: trigger via API | FAIL | HTTP server 未启动 |
| Chinese text: trigger via API | FAIL | HTTP server 未启动 |
| mixed language text: trigger via API | FAIL | HTTP server 未启动 |
| English→Chinese: real translation results | FAIL | HTTP server 未启动 |
| Chinese→English: auto-detect fallback | FAIL | HTTP server 未启动 |
| English→Chinese: auto-detect | FAIL | HTTP server 未启动 |
| readonly textarea with content | FAIL | HTTP server 未启动 |
| history written | FAIL | HTTP server 未启动 |
| sequential translations | FAIL | HTTP server 未启动 |
| short text translates | FAIL | HTTP server 未启动 |
| long text translates | FAIL | HTTP server 未启动 |
| special characters | FAIL | HTTP server 未启动 |

**总结**: 3 个只读 DOM 检查的测试通过，12 个需要触发翻译的测试全部因 HTTP server 未启动而失败。

---

## 下一步

1. **修复 HTTP server 启动问题** — 添加 listening/error 回调日志，定位为什么日志显示 "started" 但端口未监听
2. **修复 `ELECTRON_RUN_AS_NODE` 问题** — 写入项目启动脚本或 `.env` 文件
3. **考虑替代 `triggerTranslateViaApi`** — 如果 HTTP server 持续有问题，可通过 CDP 直接调用 `window.electronAPI.text.onTranslateFromApi` 的 IPC 通道来触发翻译
