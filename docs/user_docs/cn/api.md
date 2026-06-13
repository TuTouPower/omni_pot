# HTTP API

Omni Pot 内置本地 HTTP API 服务器，供外部脚本和工具调用。

## 基础信息

| 项目 | 值 |
|---|---|
| 地址 | `http://127.0.0.1:20202` |
| 监听范围 | 仅 `127.0.0.1` |
| 端口 | 默认 20202（设置 → 高级中修改，需重启） |
| 认证 | 请求头 `X-Omni-Pot-Api-Token`（Token 在设置 → 关于页面查看和复制） |
| CORS | 仅允许 `localhost` / `127.0.0.1` 的 HTTP/HTTPS 来源，可带显式端口 |

## 配置项

| 配置 | 默认值 | 说明 |
|---|---|---|
| `server_port` | `20202` | HTTP 服务监听端口 |
| `server_api_token` | 首次启动随机生成 | 外部脚本调用公共 HTTP API 时放入 `X-Omni-Pot-Api-Token` 请求头 |

## 接口列表

### POST `/` 或 POST `/translate`

翻译请求体中的文本，聚焦或创建翻译窗口并触发翻译。请求体为空时返回 400。

```bash
curl -X POST http://127.0.0.1:20202/translate \
    -H "X-Omni-Pot-Api-Token: YOUR_TOKEN" \
    -d "hello world"
```

成功返回：`{ "success": true }`

### POST `/dict`

查询词典，聚焦或创建词典窗口并触发查询。请求体可以是纯文本，或 JSON `{ "text": "hello" }`。空文本返回 400。

```bash
curl -X POST http://127.0.0.1:20202/dict \
    -H "X-Omni-Pot-Api-Token: YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"text": "hello"}'
```

成功返回：`{ "success": true }`

### POST `/recognize`

截图识别。不带参数时执行文字识别，带 `{ "mode": "translate" }` 时执行截图翻译。

```bash
# 文字识别
curl -X POST http://127.0.0.1:20202/recognize \
    -H "X-Omni-Pot-Api-Token: YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}'

# 截图翻译
curl -X POST http://127.0.0.1:20202/recognize \
    -H "X-Omni-Pot-Api-Token: YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"mode": "translate"}'
```

成功返回：`{ "success": true, "mode": "recognize" }` 或 `{ "success": true, "mode": "translate" }`。

### GET `/config`

返回公开配置，不包含 `server_api_token`、`webdav_url`、`webdav_username`、`webdav_password` 等密钥字段。服务实例配置只公开 `enable`、`instanceName`。

```bash
curl http://127.0.0.1:20202/config \
    -H "X-Omni-Pot-Api-Token: YOUR_TOKEN"
```

### GET `/history`

翻译历史分页查询。

查询参数：

| 参数 | 默认值 | 说明 |
|---|---|---|
| `page` | `1` | 页码，从 1 开始 |
| `page_size` | `20` | 每页数量，上限 200 |

```bash
curl "http://127.0.0.1:20202/history?page=1&page_size=10" \
    -H "X-Omni-Pot-Api-Token: YOUR_TOKEN"
```

返回：`{ "success": true, "data": [...], "page": 1, "page_size": 10, "total": 42 }`。

公共 API 会截断历史中的 `source_text` / `target_text` 到 50 字符；完整文本只供 E2E 内部端点使用。

## 错误响应

所有响应为 JSON 格式。

| 状态码 | 响应 |
|---|---|
| 400 | `{ "success": false, "error": "empty body" }` 或其他请求体错误 |
| 401 | `{ "success": false, "error": "unauthorized" }` |
| 403 | `{ "success": false, "error": "forbidden" }` |
| 404 | `{ "success": false, "error": "not found" }` |
| 500 | `{ "success": false, "error": "<原因>" }` |

## 内部 E2E 端点

`/trigger-*`、`/e2e/*` 等路径仅在 `OMNI_POT_E2E=1` 且请求头 `X-Omni-Pot-E2E-Token` 匹配 `OMNI_POT_E2E_TOKEN` 时启用。这些端点只供测试基础设施使用，外部脚本不要依赖。

## 使用场景

- 自动化脚本调用翻译
- 第三方工具集成（Raycast、Alfred 等）
- 浏览器扩展调用
- 命令行快速翻译
