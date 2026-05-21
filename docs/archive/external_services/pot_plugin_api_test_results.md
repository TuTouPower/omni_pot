# pot-app 社区插件 API 可用性测试结果

**测试日期：** 2026-05-19
**测试目的：** 确认 pot-app 社区插件中，哪些免费、无需 API key、当前仍然可用。
**插件来源：** https://pot-app.com/plugin.html
**测试脚本：** `scripts/test_pot_plugins.cjs`

---

## 总结

| 状态 | 插件数量 |
|------|----------|
| 可用（免费无 key） | 7 |
| 不可用 | 5 |

---

## 可用插件（免费，无需 API key）

### 1. 火山翻译 (Volcengine) — 翻译

- **仓库：** [TechDecryptor/pot-app-translate-plugin-volcengine](https://github.com/TechDecryptor/pot-app-translate-plugin-volcengine)
- **标签：** 免配置
- **API 端点：** `POST https://translate.volcengine.com/crx/translate/v1`
- **请求格式：** JSON

```json
{
    "source_language": "en",
    "target_language": "zh",
    "text": "hello"
}
```

- **响应格式：** JSON，翻译结果在 `translation` 字段

```json
{
    "translation": "你好"
}
```

- **测试结果：**
  - EN→ZH "hello" → "你好" ✅
  - ZH→EN "你好" → "Hello" ✅
- **稳定性：** 稳定，无反爬

---

### 2. 腾讯交互翻译 (Transmart) — 翻译

- **仓库：** [TechDecryptor/pot-app-translate-plugin-transmart](https://github.com/TechDecryptor/pot-app-translate-plugin-transmart)
- **标签：** 免配置
- **API 端点：** `POST https://transmart.qq.com/api/imt`
- **请求格式：** JSON，需 `User-Agent` 和 `Referer` header

```json
{
    "header": {
        "fn": "auto_translation",
        "client_key": "browser-chrome-120.0.0-Windows-df4bd4c5-a65d-44b2-a40f-42f34f3535f2-1677486696487"
    },
    "type": "plain",
    "model_category": "normal",
    "source": { "lang": "en", "text_list": ["hello"] },
    "target": { "lang": "zh" }
}
```

- **响应格式：** JSON，翻译结果在 `auto_translation` 数组

```json
{
    "header": { "type": "auto_translation", "ret_code": "succ", ... },
    "auto_translation": ["你好"]
}
```

- **测试结果：**
  - EN→ZH "hello" → "你好" ✅
  - ZH→EN "你好" → "hello" ✅
- **稳定性：** 稳定

---

### 3. 彩云小译 (Caiyun) — 翻译

- **仓库：** [TechDecryptor/pot-app-translate-plugin-caiyun](https://github.com/TechDecryptor/pot-app-translate-plugin-caiyun)
- **标签：** 免配置，内置 token
- **API 端点：** `POST https://interpreter.cyapi.cn/v1/translator`
- **请求格式：** JSON，需内置 `x-authorization` header

```json
{
    "source": "hello",
    "detect": true,
    "os_type": "ios",
    "device_id": "F1F902F7-1780-4C88-848D-71F35D88A602",
    "trans_type": "en2zh",
    "media": "text",
    "request_id": 123456789,
    "user_id": "",
    "dict": true
}
```

- **Header：** `x-authorization: token ssdj273ksdiwi923bsd9`
- **响应格式：** JSON，翻译结果在 `target` 字段

```json
{
    "target": "你好"
}
```

- **测试结果：**
  - EN→ZH "hello" → "你好" ✅
  - ZH→EN "你好" → "Hello" ✅
- **稳定性：** 较稳定，但内置 token 有失效风险

---

### 4. 腾讯翻译君 (Tencent WeChat) — 翻译

- **仓库：** [TechDecryptor/pot-app-translate-plugin-tencent](https://github.com/TechDecryptor/pot-app-translate-plugin-tencent)
- **标签：** 免配置，模拟微信小程序
- **API 端点：** `GET https://wxapp.translator.qq.com/api/translate`
- **请求格式：** URL query parameters

```
?source=auto&target=auto&sourceText=hello&platform=WeChat_APP
  &guid=oqdgX0SIwhvM0TmqzTHghWBvfk22&candidateLangs=en|zh
```

- **Header：** 需要模拟微信小程序 User-Agent 和 Referer
- **响应格式：** JSON，翻译结果在 `targetText` 字段

```json
{
    "targetText": "你好",
    "type": "1"
}
```

- **测试结果：**
  - EN→ZH "hello" → "你好" ✅
  - ZH→EN "你好" → "Hello" ✅
- **稳定性：** 稳定

---

### 5. Papago (Naver) — 翻译

- **仓库：** [TechDecryptor/pot-app-translate-plugin-papago](https://github.com/TechDecryptor/pot-app-translate-plugin-papago)
- **标签：** 免配置，需动态 HMAC token
- **API 端点：** `POST https://papago.naver.com/apis/n2mt/translate`
- **认证方式：** 动态获取版本号 → HMAC-MD5 签名 → `PPG {uuid}:{token}` header
- **请求格式：** form-urlencoded

```
deviceId={uuid}&locale=zh-CN&source=en&target=zh-CN&text=hello&...
```

- **支持语言：** ko, en, ja, zh-CN, zh-TW, vi, id, th, de, ru, es, it, fr, pt, ar, fa, mm, hi
- **响应格式：** JSON，翻译结果在 `translatedText` 字段

```json
{
    "translatedText": "你好",
    "srcLangType": "en",
    "tarLangType": "zh-CN"
}
```

- **测试结果：**
  - EN→ZH "hello" → "你好" ✅（需使用 `zh-CN` 而非 `zh`）
- **稳定性：** 需要先请求主页获取版本号，有被反爬风险
- **注意：** 插件原始语言代码映射 `zh` 会报错，需改成 `zh-CN`

---

### 6. Tatoeba 例句查询 — 词典

- **仓库：** [pot-app/pot-app-translate-plugin-tatoeba](https://github.com/pot-app/pot-app-translate-plugin-tatoeba)
- **标签：** 免配置，例句搜索引擎
- **API 端点：** `GET https://tatoeba.org/eng/api_v0/search`
- **请求格式：** URL query parameters

```
?query=hello&from=en&to=zh&has_audio=no&sort=relevance
```

- **响应格式：** JSON，`results` 数组中每个元素包含 `text`（源句）和 `translations`（目标句）
- **测试结果：**
  - EN→ZH "hello" → 返回例句 "Hello", "Hello.", "Hello?" ✅
  - ZH→EN "你好" → 超时（15s+）⚠️
- **稳定性：** 响应较慢，中文查询可能超时
- **适用场景：** 适合查英文例句，不太适合做主要翻译引擎

---

### 7. Free Dictionary API — 英英词典

- **仓库：** [Integral-Tech/pot-app-translate-plugin-freedict](https://github.com/Integral-Tech/pot-app-translate-plugin-freedict)
- **标签：** 免费，无需 key，仅英文
- **API 端点：** `GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}`
- **请求格式：** 纯 GET，无需 header
- **响应格式：** JSON 数组，包含词义、音标、例句等

```json
[{
    "word": "hello",
    "meanings": [{
        "partOfSpeech": "noun",
        "definitions": [{ "definition": "\"Hello!\" or an equivalent greeting." }]
    }]
}]
```

- **测试结果：**
  - EN "hello" → 词义 ✅
  - ZH "你好" → 404（仅支持英文）✅（符合预期）
- **稳定性：** 稳定
- **适用场景：** 英文词典查询

---

## 不可用插件

### 8. 有道翻译 (Youdao) — 已失效

- **仓库：** [TechDecryptor/pot-app-translate-plugin-youdao](https://github.com/TechDecryptor/pot-app-translate-plugin-youdao)
- **API 端点：** `POST https://dict.youdao.com/webtranslate`
- **问题：** API 仍在响应，解密流程正常，但返回的翻译结果是**乱文**（随机无关句子）
- **原因：** 有道升级了反爬机制，签名 key 或加密方式已变
- **结论：** 当前不可用

---

### 9. 百度翻译 (Baidu / Hujiang) — 已失效

- **仓库：** [TechDecryptor/pot-app-translate-plugin-baidu](https://github.com/TechDecryptor/pot-app-translate-plugin-baidu)
- **API 端点：** `POST http://res.d.hjfile.cn/v10/dict/translation/{from}/{to}`
- **问题：** 实际调用的是沪江（Hujiang）API，响应中 `content` 字段为空字符串
- **原因：** 沪江翻译 API 已下线或改变
- **结论：** 当前不可用

---

### 10. LibreTranslate — 需 API key

- **仓库：** [Integral-Tech/pot-app-translate-plugin-libre](https://github.com/Integral-Tech/pot-app-translate-plugin-libre)
- **API 端点：** `POST https://libretranslate.com/translate`
- **问题：** 主站已要求 API key（`portal.libretranslate.com`）
- **替代方案：** 自部署 LibreTranslate 实例可免费使用
- **结论：** 公共实例不可用

---

## 离线/需要额外数据的插件（未测试）

| 插件 | 说明 |
|------|------|
| ECDICT | 离线英汉词典，需要本地数据库文件 |
| GCIDE | 离线英英词典，基于 GCIDE 数据 |
| Rapid OCR | 离线文字识别，需要本地模型 |
| Paddle OCR | 离线文字识别，需要 PaddlePaddle |

---

## 对 omni_pot 的建议

如果要在 omni_pot 中集成这些免费翻译服务，最可靠的选择是：

1. **火山翻译** — 最简单，纯 JSON POST，无任何签名
2. **腾讯交互翻译** — 稳定，只需一个固定的 client_key
3. **腾讯翻译君** — 稳定，GET 请求，模拟微信小程序
4. **彩云小译** — 稳定，但内置 token 有失效风险
5. **Papago** — 功能最强（多语言），但需动态 token 流程
6. **Free Dictionary API** — 英文词典最佳选择
7. **Tatoeba** — 例句查询补充，适合做辅助功能
