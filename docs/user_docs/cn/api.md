# HTTP API

Omni Pot 内置本地 HTTP API 服务器，供外部脚本和工具调用。

## 基础信息

| 项目 | 值 |
|---|---|
| 地址 | `http://127.0.0.1:20202` |
| 端口 | 默认 20202（可在设置中修改，需重启） |
| 认证 | 请求头 `X-Omni-Pot-Api-Token`（Token 在设置 → 关于页面查看） |
| CORS | 仅允许 localhost / 127.0.0.1 来源 |

## 接口列表

### POST `/` 或 POST `/translate`

翻译请求体中的文本。

```bash
curl -X POST http://127.0.0.1:20202/translate \
  -H "X-Omni-Pot-Api-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!"}'
```

### POST `/dict`

查询词典。

```bash
curl -X POST http://127.0.0.1:20202/dict \
  -H "X-Omni-Pot-Api-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "hello"}'
```

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

### GET `/config`

返回公开配置（不包含 API Token 和密钥）。

```bash
curl http://127.0.0.1:20202/config \
  -H "X-Omni-Pot-Api-Token: YOUR_TOKEN"
```

### GET `/history`

翻译历史分页查询。

```bash
curl "http://127.0.0.1:20202/history?page=1&page_size=10" \
  -H "X-Omni-Pot-Api-Token: YOUR_TOKEN"
```

返回：`{ "success": true, "data": [...], "page": 1, "page_size": 10, "total": 42 }`

## 错误响应

所有响应为 JSON 格式。未携带有效 Token 时返回 401；非 localhost 来源返回 403。

## 使用场景

- 自动化脚本调用翻译
- 第三方工具集成（Raycast、Alfred 等）
- 浏览器扩展调用
- 命令行快速翻译
