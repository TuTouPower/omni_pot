# 外部服务依赖清单

> 更新日期：2026-05-18
>
> 代码以 [src/services/index.ts](../../src/services/index.ts)、[src/services/ocr/index.ts](../../src/services/ocr/index.ts)、[src/services/tts/index.ts](../../src/services/tts/index.ts)、[src/services/detect.ts](../../src/services/detect.ts) 为准。

本文档回答三个问题：Omni Pot 依赖哪些外部服务、哪些可以无密钥免费直接测试、哪些需要用户配置 key/token/本地服务。

---

## 真实外部健康检查覆盖范围

无密钥、免费、可公网直接调用的翻译/词典/TTS 服务，统一由 opt-in E2E 覆盖：

```bash
OMNI_POT_EXTERNAL_SERVICE_TESTS=1 npm run test:e2e -- specs/external_services.spec.ts
```

当前覆盖见 [tests/user_e2e/specs/external_services.spec.ts](../../tests/user_e2e/specs/external_services.spec.ts)：

| 服务 | 类型 | 是否无密钥公网直接测试 | 2026-05-18 当前环境结果 | 说明 |
|---|---|---:|---|---|
| Bing Translate | 翻译 | 是 | 通过 | 非官方网页接口，先抓 Bing 页面 token |
| Google Translate | 翻译 | 是 | 失败 | 非官方 `translate.googleapis.com` 接口，当前环境超时/失败 |
| DeepL free / DeepLX free | 翻译 | 是 | 通过 | 使用免费/兼容模式，不使用官方 auth key |
| Lingva Translate | 翻译 | 是 | 失败 | 默认第三方 Lingva 实例不可用/连接失败 |
| MyMemory | 翻译 | 是 | 通过 | 匿名免费额度有限 |
| Cambridge Dictionary | 词典 | 是 | 通过 | 抓取 Cambridge 公开网页 |
| Free Dictionary | 词典 | 是 | 通过 | dictionaryapi.dev 公开 API |
| Edge TTS | 语音合成 | 是 | 失败 | 微软 Edge TTS 非官方接口，当前环境 WebSocket 失败 |
| Lingva TTS | 语音合成 | 是 | 失败 | 默认第三方 Lingva 实例不可用/连接失败 |

结论：**服务注册表里无密钥、免费、可公网直接调用的翻译/词典/TTS 服务已经全部进入这套真实外部健康检查。当前这套检查中只有 Google Translate、Lingva Translate、Edge TTS、Lingva TTS 失败。**

---

## 不是公网外部健康检查的无密钥服务

这些服务不需要 API key，但不是“公网免费服务直接调用”这一类，所以不放进 `external_services.spec.ts` 的公网健康检查：

| 服务 | 类型 | 为什么不算公网直接测试 | 当前测试策略 |
|---|---|---|---|
| Tesseract | OCR | 本地 OCR 引擎，可能下载 tessdata 语言包，不是远端 API 服务 | 常规 OCR/E2E 路径覆盖 |
| System OCR | OCR | 调用系统 OCR 能力，不是统一公网 API | Windows/macOS/Linux 实机 smoke 更可信 |
| QR Code | OCR | 本地解析二维码 | 常规本地测试即可 |
| ECDICT | 词典 | 本地 SQLite 词典 | 常规词典/E2E 路径覆盖 |
| Chinese Dictionary | 词典 | 本地 SQLite 中文词典 | 常规词典/E2E 路径覆盖 |
| Ollama | 翻译 | 需要本机安装 Ollama 并下载模型 | 不适合默认公网健康检查；可用本地 opt-in smoke |
| Anki | 收藏 | 需要本机 AnkiConnect 监听 `localhost:8765` | 不适合默认公网健康检查；可用本地 opt-in smoke |

---

## 需要 key/token/账号配置的服务

这些服务可能有免费额度，但不是“无需密钥即可直接测试”。真实调用必须由用户提供凭证，不能在默认测试里硬编码或猜测。

### 翻译服务

| 服务 | 实现 | 需要配置 | 费用/额度性质 |
|---|---|---|---|
| Alibaba | [alibaba.ts](../../src/services/alibaba.ts) | AccessKey ID + Secret | 云服务，通常有免费额度/按量计费 |
| Baidu | [baidu.ts](../../src/services/baidu.ts) | appid + secret | 通常有免费额度/按量计费 |
| Baidu Field | [baidu_field.ts](../../src/services/baidu_field.ts) | appid + secret + domain | 通常有免费额度/按量计费 |
| Caiyun | [caiyun.ts](../../src/services/caiyun.ts) | token | 通常有免费额度/按量计费 |
| NiuTrans | [niutrans.ts](../../src/services/niutrans.ts) | apikey | 通常有免费额度/按量计费 |
| Youdao | [youdao.ts](../../src/services/youdao.ts) | appKey + key | 通常有免费额度/按量计费 |
| Volcengine | [volcengine.ts](../../src/services/volcengine.ts) | appid + secret | 通常有免费额度/按量计费 |
| Tencent | [tencent.ts](../../src/services/tencent.ts) | secret_id + secret_key | 通常有免费额度/按量计费 |
| TranSmart | [transmart.ts](../../src/services/transmart.ts) | username + token | 需要账号凭证 |
| OpenAI compatible | [openai.ts](../../src/services/openai.ts) | API key / Azure key | 按 token 计费或第三方自定义 |
| ChatGLM | [chatglm.ts](../../src/services/chatglm.ts) | API key | 按 token 计费/额度 |
| Gemini Pro | [geminipro.ts](../../src/services/geminipro.ts) | API key | 免费额度/按量计费 |
| DeepL official | [deepl.ts](../../src/services/deepl.ts) | authKey | 官方 Free/Pro API；区别于无密钥 free/DeepLX 模式 |

### OCR 服务

| 服务 | 实现 | 需要配置 | 费用/额度性质 |
|---|---|---|---|
| Baidu OCR | [baidu_ocr.ts](../../src/services/ocr/baidu_ocr.ts) | client_id + client_secret | 通常有免费额度/按量计费 |
| Baidu Accurate OCR | [baidu_accurate_ocr.ts](../../src/services/ocr/baidu_accurate_ocr.ts) | client_id + client_secret | 通常有免费额度/按量计费 |
| Baidu Image OCR | [baidu_img_ocr.ts](../../src/services/ocr/baidu_img_ocr.ts) | appid + secret | 通常有免费额度/按量计费 |
| Tencent OCR | [tencent_ocr.ts](../../src/services/ocr/tencent_ocr.ts) | secret_id + secret_key | 通常有免费额度/按量计费 |
| Tencent Accurate OCR | [tencent_accurate_ocr.ts](../../src/services/ocr/tencent_accurate_ocr.ts) | secret_id + secret_key | 通常有免费额度/按量计费 |
| Tencent Image OCR | [tencent_img_ocr.ts](../../src/services/ocr/tencent_img_ocr.ts) | secret_id + secret_key | 通常有免费额度/按量计费 |
| Volcengine OCR | [volcengine_ocr.ts](../../src/services/ocr/volcengine_ocr.ts) | appid + secret | 通常有免费额度/按量计费 |
| Volcengine Multi-Lang OCR | [volcengine_multi_lang_ocr.ts](../../src/services/ocr/volcengine_multi_lang_ocr.ts) | appid + secret | 通常有免费额度/按量计费 |
| OpenAI Vision | [openai_vision.ts](../../src/services/ocr/openai_vision.ts) | API key | 按 token 计费或第三方兼容服务 |
| iFlytek OCR | [iflytek_ocr.ts](../../src/services/ocr/iflytek_ocr.ts) | appid + apisecret + apikey | 通常有免费额度/按量计费 |
| iFlytek IntSig OCR | [iflytek_intsig_ocr.ts](../../src/services/ocr/iflytek_intsig_ocr.ts) | appid + apisecret + apikey | 通常有免费额度/按量计费 |
| iFlytek LaTeX OCR | [iflytek_latex_ocr.ts](../../src/services/ocr/iflytek_latex_ocr.ts) | appid + apisecret + apikey | 通常有免费额度/按量计费 |
| Simple LaTeX OCR | [simple_latex_ocr.ts](../../src/services/ocr/simple_latex_ocr.ts) | token | 需要 SimpleTex token |

### 收藏服务

| 服务 | 实现 | 需要配置 | 说明 |
|---|---|---|---|
| Eudic | [eudic.ts](../../src/services/collection/eudic.ts) | token | 调用欧路词典开放 API |
| Anki | [anki.ts](../../src/services/collection/anki.ts) | 本地 AnkiConnect 服务 | 不需要云 API key，但依赖本机 Anki |

---

## 语言检测外部端点

语言检测不是服务管理里的独立服务，但代码里确实有无密钥外部端点，并且全部带本地回退，不应把失败当作翻译服务失败：

| 引擎 | 端点性质 | 是否需要 key | 失败行为 |
|---|---|---:|---|
| Bing detect | Edge/Microsoft Translator auth + detect | 否 | 回退本地检测 |
| Google detect | Google Translate gtx 接口 | 否 | 回退本地检测 |
| Baidu detect | 百度网页翻译 transapi | 否 | 回退本地检测 |
| Tencent detect | 腾讯网页翻译接口 | 否 | 回退本地检测 |
| NiuTrans detect | 小牛接口无 key 探测路径 | 否 | 回退本地检测 |
| local | 本地 cld3/正则 | 否 | 最终兜底 |

这些端点目前没有纳入 `external_services.spec.ts`，因为产品路径允许它们失败后静默回退本地检测；如果要审计“所有无密钥网络依赖是否仍可访问”，应另加 opt-in 的 `detect_external_services.spec.ts`，不能把它和翻译/词典/TTS 用户结果健康检查混在一起。

---

## 默认启用策略

当前默认翻译服务避开已知不稳定的 Google/Lingva：

- 默认翻译：Bing、DeepL free、MyMemory
- 默认词典：Chinese Dictionary、Free Dictionary、ECDICT
- 默认 OCR：Tesseract
- 默认 TTS：Edge TTS

默认服务不代表服务一定长期可用；无密钥公网服务都可能被上游限流、改接口或停服。真实失败必须通过 opt-in 外部健康检查暴露，不能用 Playwright route mock 隐藏。
