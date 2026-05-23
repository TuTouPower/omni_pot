# 外部服务依赖清单

> 更新日期：2026-05-18（QR Code 覆盖补全）
>
> 代码以 [src/services/index.ts](../../src/services/index.ts)、[src/services/ocr/index.ts](../../src/services/ocr/index.ts)、[src/services/tts/index.ts](../../src/services/tts/index.ts)、[src/services/detect.ts](../../src/services/detect.ts) 为准。

本文档回答三个问题：Omni Pot 依赖哪些服务、哪些不需要用户填写 key/token/API URL/额外本地服务即可测试、哪些需要用户配置。

---

## 无需用户配置的服务测试覆盖

“无需用户配置”指用户不用填 key、token、API URL，也不用额外启动 Ollama/AnkiConnect 这类本地服务。按这个口径，System OCR、Tesseract、本地词典、二维码解析都算；Ollama、Anki 不算。

| 服务 | 类型 | 是否需要网络 | 测试覆盖 | 2026-05-18 当前结果 |
|---|---|---:|---|---|
| Bing Translate | 翻译 | 是 | [external_services.spec.ts](../../tests/user_e2e/specs/external_services.spec.ts) | 通过 |
| Google Translate | 翻译 | 是 | [external_services.spec.ts](../../tests/user_e2e/specs/external_services.spec.ts) | 失败 |
| DeepL free / DeepLX free | 翻译 | 是 | [external_services.spec.ts](../../tests/user_e2e/specs/external_services.spec.ts) | 通过 |
| MyMemory | 翻译 | 是 | [external_services.spec.ts](../../tests/user_e2e/specs/external_services.spec.ts) | 通过 |
| Cambridge Dictionary | 词典 | 是 | [external_services.spec.ts](../../tests/user_e2e/specs/external_services.spec.ts)、[dict_window.spec.ts](../../tests/user_e2e/specs/dict_window.spec.ts) | 通过 |
| Free Dictionary | 词典 | 是 | [external_services.spec.ts](../../tests/user_e2e/specs/external_services.spec.ts)、[dict_window.spec.ts](../../tests/user_e2e/specs/dict_window.spec.ts) | 通过 |
| Chinese Dictionary | 词典 | 否 | [dict_window.spec.ts](../../tests/user_e2e/specs/dict_window.spec.ts) | 通过 |
| ECDICT | 词典 | 否 | [dict_window.spec.ts](../../tests/user_e2e/specs/dict_window.spec.ts) | 通过 |
| Tesseract | OCR | 否 | [recognize_window.spec.ts](../../tests/user_e2e/specs/recognize_window.spec.ts) | 通过 |
| System OCR | OCR | 否 | [recognize_window.spec.ts](../../tests/user_e2e/specs/recognize_window.spec.ts) | 通过 |
| QR Code | OCR | 否 | [recognize_window.spec.ts](../../tests/user_e2e/specs/recognize_window.spec.ts) | 通过 |
| Edge TTS | 语音合成 | 是 | [external_services.spec.ts](../../tests/user_e2e/specs/external_services.spec.ts) | 失败 |

结论：**按”无需用户配置”的口径，所有服务均已有真实路径测试覆盖。已经覆盖的服务里，当前失败的是 Google Translate、Edge TTS。**

---

## 真实公网健康检查

公网服务统一由 opt-in E2E 覆盖，避免常规测试被上游波动拖垮：

```bash
OMNI_POT_EXTERNAL_SERVICE_TESTS=1 npm run test:e2e -- specs/external_services.spec.ts
```

这套测试只覆盖无需用户配置的公网服务：Bing、Google、DeepL free、MyMemory、Cambridge Dictionary、Free Dictionary、Edge TTS。真实失败必须暴露，不能用 Playwright route mock 隐藏。

---

## 需要用户配置或额外本地服务的服务

这些服务可能有免费额度，但不是开箱可测；真实调用必须由用户提供凭证、URL 或本地服务。

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
| OpenAI compatible | [openai.ts](../../src/services/openai.ts) | API key / Azure key / 自定义 URL | 按 token 计费或第三方自定义 |
| ChatGLM | [chatglm.ts](../../src/services/chatglm.ts) | API key | 按 token 计费/额度 |
| Gemini Pro | [geminipro.ts](../../src/services/geminipro.ts) | API key | 免费额度/按量计费 |
| DeepL official | [deepl.ts](../../src/services/deepl.ts) | authKey | 官方 Free/Pro API；区别于无密钥 free/DeepLX 模式 |
| Ollama | [ollama.ts](../../src/services/ollama.ts) | 本机 Ollama 服务 + 模型 | 本地模型免费，但需要用户额外安装/启动 |

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
| OpenAI Vision | [openai_vision.ts](../../src/services/ocr/openai_vision.ts) | API key / 自定义 URL | 按 token 计费或第三方兼容服务 |
| iFlytek OCR | [iflytek_ocr.ts](../../src/services/ocr/iflytek_ocr.ts) | appid + apisecret + apikey | 通常有免费额度/按量计费 |
| iFlytek IntSig OCR | [iflytek_intsig_ocr.ts](../../src/services/ocr/iflytek_intsig_ocr.ts) | appid + apisecret + apikey | 通常有免费额度/按量计费 |
| iFlytek LaTeX OCR | [iflytek_latex_ocr.ts](../../src/services/ocr/iflytek_latex_ocr.ts) | appid + apisecret + apikey | 通常有免费额度/按量计费 |
| Simple LaTeX OCR | [simple_latex_ocr.ts](../../src/services/ocr/simple_latex_ocr.ts) | token | 需要 SimpleTex token |

### 收藏服务

| 服务 | 实现 | 需要配置 | 说明 |
|---|---|---|---|
| Eudic | [eudic.ts](../../src/services/collection/eudic.ts) | token | 调用欧路词典开放 API |
| Anki | [anki.ts](../../src/services/collection/anki.ts) | 本地 AnkiConnect 服务 | 不需要云 API key，但需要用户额外启动本地服务 |

---

## 语言检测外部端点

语言检测不是服务管理里的独立服务，但代码里确实有无密钥外部端点，并且全部带本地回退，不应把失败当作翻译服务失败：

| 引擎 | 端点性质 | 是否需要用户配置 | 失败行为 |
|---|---|---:|---|
| Bing detect | Edge/Microsoft Translator auth + detect | 否 | 回退本地检测 |
| Google detect | Google Translate gtx 接口 | 否 | 回退本地检测 |
| Baidu detect | 百度网页翻译 transapi | 否 | 回退本地检测 |
| Tencent detect | 腾讯网页翻译接口 | 否 | 回退本地检测 |
| NiuTrans detect | 小牛接口无 key 探测路径 | 否 | 回退本地检测 |
| local | 本地 cld3/正则 | 否 | 最终兜底 |

这些端点目前没有纳入 `external_services.spec.ts`，因为产品路径允许它们失败后静默回退本地检测；如果要审计“所有无配置网络依赖是否仍可访问”，应另加 opt-in 的 `detect_external_services.spec.ts`，不能把它和翻译/词典/TTS 用户结果健康检查混在一起。

---

## 默认启用策略

当前默认翻译服务避开已知不稳定的 Google：

- 默认翻译：Bing、DeepL free、MyMemory
- 默认词典：Chinese Dictionary、Free Dictionary、ECDICT
- 默认 OCR：Tesseract
- 默认 TTS：Edge TTS

默认服务不代表服务一定长期可用；无配置公网服务都可能被上游限流、改接口或停服。真实失败必须通过 opt-in 外部健康检查暴露，不能用 Playwright route mock 隐藏。
