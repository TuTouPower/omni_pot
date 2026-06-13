# HTTP API

Omni Pot includes a local HTTP API server for external scripts and tools.

## Basics

| Item | Value |
|---|---|
| Address | `http://127.0.0.1:20202` |
| Bind address | `127.0.0.1` only |
| Port | Default 20202 (configurable in Settings > Advanced, requires restart) |
| Authentication | Request header `X-Omni-Pot-Api-Token` (find and copy the token in Settings > About) |
| CORS | Only allows HTTP/HTTPS origins on `localhost` / `127.0.0.1`, with optional explicit ports |

## Configuration

| Key | Default | Description |
|---|---|---|
| `server_port` | `20202` | HTTP server port |
| `server_api_token` | Randomly generated on first launch | Token for public HTTP API requests via `X-Omni-Pot-Api-Token` |

## Endpoints

### POST `/` or POST `/translate`

Translate text from the request body. Omni Pot focuses or creates the translation window and starts translation. Empty bodies return 400.

```bash
curl -X POST http://127.0.0.1:20202/translate \
    -H "X-Omni-Pot-Api-Token: YOUR_TOKEN" \
    -d "hello world"
```

Success response: `{ "success": true }`.

### POST `/dict`

Look up a word in the dictionary. Omni Pot focuses or creates the dictionary window and starts lookup. The body can be plain text or JSON `{ "text": "hello" }`. Empty text returns 400.

```bash
curl -X POST http://127.0.0.1:20202/dict \
    -H "X-Omni-Pot-Api-Token: YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"text": "hello"}'
```

Success response: `{ "success": true }`.

### POST `/recognize`

Screenshot OCR. Without parameters, performs text recognition. With `{ "mode": "translate" }`, performs screenshot translation.

```bash
# Text recognition
curl -X POST http://127.0.0.1:20202/recognize \
    -H "X-Omni-Pot-Api-Token: YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}'

# Screenshot translation
curl -X POST http://127.0.0.1:20202/recognize \
    -H "X-Omni-Pot-Api-Token: YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"mode": "translate"}'
```

Success response: `{ "success": true, "mode": "recognize" }` or `{ "success": true, "mode": "translate" }`.

### GET `/config`

Returns public configuration. It excludes secret fields such as `server_api_token`, `webdav_url`, `webdav_username`, and `webdav_password`. Service instance config only exposes `enable` and `instanceName`.

```bash
curl http://127.0.0.1:20202/config \
    -H "X-Omni-Pot-Api-Token: YOUR_TOKEN"
```

### GET `/history`

Paginated translation history.

Query parameters:

| Parameter | Default | Description |
|---|---|---|
| `page` | `1` | Page number, starting from 1 |
| `page_size` | `20` | Items per page, max 200 |

```bash
curl "http://127.0.0.1:20202/history?page=1&page_size=10" \
    -H "X-Omni-Pot-Api-Token: YOUR_TOKEN"
```

Returns: `{ "success": true, "data": [...], "page": 1, "page_size": 10, "total": 42 }`.

The public API truncates `source_text` / `target_text` history fields to 50 characters. Full text is only available to internal E2E endpoints.

## Error Responses

All responses are JSON.

| Status | Response |
|---|---|
| 400 | `{ "success": false, "error": "empty body" }` or another request body error |
| 401 | `{ "success": false, "error": "unauthorized" }` |
| 403 | `{ "success": false, "error": "forbidden" }` |
| 404 | `{ "success": false, "error": "not found" }` |
| 500 | `{ "success": false, "error": "<reason>" }` |

## Internal E2E Endpoints

`/trigger-*`, `/e2e/*`, and related paths are enabled only when `OMNI_POT_E2E=1` and the `X-Omni-Pot-E2E-Token` request header matches `OMNI_POT_E2E_TOKEN`. These endpoints are for test infrastructure only. External scripts should not depend on them.

## Use Cases

- Automated translation scripts
- Third-party tool integration (Raycast, Alfred, etc.)
- Browser extension calls
- Command-line quick translation
