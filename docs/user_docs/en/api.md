# HTTP API

Omni Pot includes a local HTTP API server for external scripts and tools.

## Basics

| Item | Value |
|---|---|
| Address | `http://127.0.0.1:20202` |
| Port | Default 20202 (configurable in settings, requires restart) |
| Authentication | Request header `X-Omni-Pot-Api-Token` (find the token in Settings > About) |
| CORS | Only allows localhost / 127.0.0.1 origins |

## Endpoints

### POST `/` or POST `/translate`

Translate text from the request body.

```bash
curl -X POST http://127.0.0.1:20202/translate \
  -H "X-Omni-Pot-Api-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!"}'
```

### POST `/dict`

Look up a word in the dictionary.

```bash
curl -X POST http://127.0.0.1:20202/dict \
  -H "X-Omni-Pot-Api-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "hello"}'
```

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

### GET `/config`

Returns public configuration (excludes API token and secrets).

```bash
curl http://127.0.0.1:20202/config \
  -H "X-Omni-Pot-Api-Token: YOUR_TOKEN"
```

### GET `/history`

Paginated translation history.

```bash
curl "http://127.0.0.1:20202/history?page=1&page_size=10" \
  -H "X-Omni-Pot-Api-Token: YOUR_TOKEN"
```

Returns: `{ "success": true, "data": [...], "page": 1, "page_size": 10, "total": 42 }`

## Error Responses

All responses are JSON. Missing or invalid token returns 401. Non-localhost origin returns 403.

## Use Cases

- Automated translation scripts
- Third-party tool integration (Raycast, Alfred, etc.)
- Browser extension calls
- Command-line quick translation
