# 外部 HTTP API

Omni Pot 主进程会在本机绑定一个 HTTP 端口（默认 `127.0.0.1:20202`，可在「设置 → 高级」中修改 `server_port`），供外部脚本/快捷工具调用。

> **范围**：仅监听 `127.0.0.1`，不对外网开放。所有路由都返回 JSON。CORS 仅允许 `http://localhost`、`http://127.0.0.1`、`https://localhost`、`https://127.0.0.1` 及这些来源的显式端口。公共端点必须携带 `X-Omni-Pot-Api-Token`，token 在「设置 → 关于」页面「本机 API」一栏可查看和复制。

## 配置

| 项 | 默认值 | 说明 |
|---|---|---|
| `server_port` | `20202` | HTTP 服务监听端口 |
| `server_api_token` | 首次启动随机生成 | 外部脚本调用公共 HTTP API 时放入 `X-Omni-Pot-Api-Token` 请求头 |

服务在 Omni Pot 启动时自动起；可通过 `setConfig('server_port', NEW)` 修改后重启应用生效。

---

## 公共端点

### `POST /` 或 `POST /translate` — 翻译文本

- 请求体：纯文本（要翻译的内容），`Content-Type` 任意。
- 行为：聚焦/创建翻译窗口，把文本作为输入并触发翻译。
- 响应：`{ "success": true }`

```bash
curl -X POST -H "X-Omni-Pot-Api-Token: $OMNI_POT_API_TOKEN" -d "hello world" http://127.0.0.1:20202/translate
```

### `POST /dict` — 词典查询

- 请求体：纯文本，或 JSON `{ "text": "australia" }`。
- 行为：聚焦/创建词典窗口并触发查询。
- 响应：`{ "success": true }`；空文本返回 `400 { "success": false, "error": "empty body" }`。

```bash
curl -X POST -H "X-Omni-Pot-Api-Token: $OMNI_POT_API_TOKEN" -d '{"text":"australia"}' -H 'Content-Type: application/json' http://127.0.0.1:20202/dict
```

### `POST /recognize` — 文字识别（占位）

- 当前为占位实现，读取可选 JSON `{ "mode": "recognize" | "translate" }`，默认 `recognize`。
- 响应：`{ "success": true, "mode": "recognize" }` 或 `{ "success": true, "mode": "translate" }`。
- 真实文字识别触发请使用全局快捷键或托盘菜单；后续会替换为实际实现。

### `GET /config` — 读取公开配置

- 响应：公开配置 allowlist JSON；`server_api_token`、`webdav_url`、`webdav_username`、`webdav_password` 不返回。服务实例配置只公开 `enable`、`instanceName`，其他字段（如 `apiKey`、`endpoint`）不返回。
- 用于外部工具读取当前快捷键、服务列表、窗口尺寸等非敏感设置。

```bash
curl -H "X-Omni-Pot-Api-Token: $OMNI_POT_API_TOKEN" http://127.0.0.1:20202/config | jq '.hotkey_translate'
```

### `GET /history` — 翻译历史分页

- 查询参数：
  - `page`（默认 `1`，从 1 开始）
  - `page_size`（默认 `20`，上限 `200`）
- 响应：
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 123,
        "service_key": "google",
        "source_text": "hello",
        "source_lang": "en",
        "target_text": "你好",
        "target_lang": "zh_cn",
        "created_at": "2026-05-18T10:23:45Z"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 387
  }
  ```

```bash
curl -H "X-Omni-Pot-Api-Token: $OMNI_POT_API_TOKEN" "http://127.0.0.1:20202/history?page=1&page_size=10"
```

---

## E2E 内部端点

`/trigger-*`、`/e2e/*` 等路径仅在设置了环境变量 `OMNI_POT_E2E=1` 且请求头携带 `X-Omni-Pot-E2E-Token` 匹配 `OMNI_POT_E2E_TOKEN` 时启用。这些端点为测试基础设施服务，不构成公共 API 的一部分，**外部脚本不要依赖**。

---

## 错误约定

- `401 { "success": false, "error": "unauthorized" }` — 缺少或传错 `X-Omni-Pot-Api-Token`
- `404 { "success": false, "error": "not found" }` — 路径未匹配
- `400 { "success": false, "error": "<原因>" }` — 请求体非法
- `500 { "success": false, "error": "<原因>" }` — 内部错误

---

## 与 IPC 的关系

外部 HTTP API 与 Electron 内部 IPC 通道分离：
- IPC 通道（`window:*`, `config:*`, `text:*` 等）只能在渲染进程内通过 `window.electronAPI.*` 使用。
- HTTP API 是给跨进程/跨语言脚本的"窄入口"，仅暴露常用动作（翻译、词典、读配置、读历史）。

如需更多端点，请在 [`electron/server/index.ts`](../electron/server/index.ts) 中新增 handler 并同步本文档。
