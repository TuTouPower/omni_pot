# 外部服务依赖清单

> 更新日期: 2026-05-07
> 所有服务实现在 `src/services/` 目录下，均为完整实现（非 stub）。

---

## 翻译服务（18 个）

### 免费可用（无需 API key）

| 服务 | 实现文件 | 原理 | 风险 |
|------|----------|------|------|
| **Google** | `google.ts` | 调用 `translate.googleapis.com/translate_a/single?client=gtx`（Google 网页翻译内部接口） | 非官方，可能被限流/封禁 |
| **Bing** | `bing.ts` | 从 `bing.com/translator` 抓 token，调用 `ttranslatev3` | 非官方，token 格式可能变 |
| **Yandex** | `yandex.ts` | 调用 Yandex 公开翻译接口 | 非官方，稳定性未知 |
| **Lingva** | `lingva.ts` | 调用 Lingva Translate 公开实例（可自建） | 依赖第三方实例可用性 |
| **Ollama** | `ollama.ts` | 调用本地 Ollama LLM 服务 | 需要本地安装 Ollama 且有模型 |

### 需要 API key

| 服务 | 实现文件 | 需要什么 | 费用 |
|------|----------|----------|------|
| **DeepL** | `deepl.ts` | DeepL API key（支持免费额度 + 付费版），也可用第三方 DeepLX（免费无 key） | 免费版 50万字符/月，付费按量 |
| **OpenAI** | `openai.ts` | OpenAI API key 或 Azure OpenAI key | 按 token 计费 |
| **ChatGLM** | `chatglm.ts` | 智谱 AI API key | 按 token 计费 |
| **Gemini Pro** | `geminipro.ts` | Google Gemini API key | 有免费额度，超量付费 |
| **Caiyun（彩云）** | `caiyun.ts` | 彩云小译 API token | 有免费额度 |
| **NiuTrans（小牛）** | `niutrans.ts` | 小牛翻译 API key | 有免费额度 |
| **TranSmart** | `transmart.ts` | 腾讯 TranSmart 用户名 + token | 免费 |
| **Alibaba（阿里）** | `alibaba.ts` | 阿里云 AccessKey ID + Secret | 有免费额度 |
| **Baidu（百度）** | `baidu.ts` | 百度翻译 appid + secret | 有免费额度，超量付费 |
| **Baidu Field（百度垂直领域）** | `baidu_field.ts` | 百度翻译 appid + secret（领域版） | 同上 |
| **Youdao（有道）** | `youdao.ts` | 有道翻译 appKey + key | 有免费额度 |
| **Tencent（腾讯）** | `tencent.ts` | 腾讯云 secret_id + secret_key | 有免费额度 |
| **Volcengine（火山）** | `volcengine.ts` | 火山翻译 appid + secret | 有免费额度 |

---

## 词典服务（3 个）

| 服务 | 实现文件 | 费用 | 说明 |
|------|----------|------|------|
| **Bing Dictionary** | `bing_dict.ts` | 免费 | 调用 Bing 词典公开 API，返回发音/释义/例句 |
| **ECDICT** | `ecdict.ts` | 免费 | 调用 pot-app.com API，英汉词典 |
| **Cambridge Dictionary** | `cambridge_dict.ts` | 免费 | 抓取 Cambridge 词典网页，英文释义 |

---

## OCR 服务（5 个）

| 服务 | 实现文件 | 需要什么 | 费用 |
|------|----------|----------|------|
| **Tesseract** | `ocr/tesseract.ts` | 无（本地 OCR 引擎） | 免费 |
| **Baidu OCR** | `ocr/baidu_ocr.ts` | 百度云 API key | 有免费额度 |
| **Tencent OCR** | `ocr/tencent_ocr.ts` | 腾讯云 secret_id + secret_key | 有免费额度 |
| **Volcengine OCR** | `ocr/volcengine_ocr.ts` | 火山引擎 API key | 有免费额度 |
| **OpenAI Vision** | `ocr/openai_vision.ts` | OpenAI API key | 按 token 计费 |
| **QR Code** | `ocr/qrcode.ts` | 无（本地解析） | 免费 |

---

## TTS 服务（2 个）

| 服务 | 实现文件 | 需要什么 | 费用 |
|------|----------|----------|------|
| **Edge TTS** | `tts/edge_tts.ts` | 无（调用微软 Edge 浏览器 TTS 接口） | 免费，非官方 |
| **Lingva TTS** | `tts/lingva_tts.ts` | 无（调用 Lingva 实例） | 免费 |

---

## 当前可用状态

**默认配置中的服务**（`translate_service_list`）：bing, google

**开箱即用（无需任何配置）**：
- ✅ Google — 免费，非官方接口
- ✅ Bing — 免费，非官方接口
- ✅ Bing Dictionary — 免费
- ✅ ECDICT — 免费
- ✅ Cambridge Dictionary — 免费
- ✅ Yandex — 免费
- ✅ Lingva — 免费（依赖第三方实例）
- ⚠️ Ollama — 免费但需本地安装 Ollama + 下载模型
- ⚠️ DeepL (DeepLX 模式) — 免费但依赖第三方 DeepLX 服务

**需要 API key 才能用**：其余 13 个翻译服务 + 4 个 OCR 服务 + 1 个 TTS 服务

