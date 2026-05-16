# 外部服务依赖清单

> 更新日期: 2026-05-14
> 所有服务实现在 `src/services/` 目录下，以 `src/services/index.ts` 注册表为准。

---

## 翻译服务（21 个）

### 免费可用（无需 API key）

| 服务 | 实现文件 | 原理 | 风险 |
|------|----------|------|------|
| **Google** | `google.ts` | 调用 `translate.googleapis.com/translate_a/single?client=gtx`（Google 网页翻译内部接口） | 非官方，可能被限流/封禁 |
| **Bing** | `bing.ts` | 从 `bing.com/translator` 抓 token，调用 `ttranslatev3` | 非官方，token 格式可能变 |
| **Lingva** | `lingva.ts` | 调用 Lingva Translate 公开实例（默认 `lingva.lunar.icu`，可自建） | 依赖第三方实例可用性 |
| **MyMemory** | `mymemory.ts` | 调用 `api.mymemory.translated.net`，匿名 5000 字符/天 | 免费额度有限 |
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

### 特殊类型（输出词典结果）

| 服务 | 实现文件 | 说明 |
|------|----------|------|
| **Cambridge Dictionary** | `cambridge_dict.ts` | 抓取 Cambridge 词典网页，英文释义，输出 `DictResult` |
| **中文词典** | `chinese_dictionary.ts` | 内置中文单字/词语释义（当前仅少量样例词条，完整数据源接入延期并记录在 `PLAN.md`） |
| **Free Dictionary** | `free_dictionary.ts` | 调用 dictionaryapi.dev，英文词典，输出 `DictResult` |
| **ECDict（CC-CEDICT）** | `ecdict.ts` | 离线中英词典（CC-CEDICT SQLite），通过 IPC 调用主进程，输出 `DictResult` |

---

## 词典服务

词典查询通过 `dictionary_service_list` 配置，与翻译服务共用同一注册表。词典窗口按输入文字类型筛选服务：中文输入只查询中文词典/中文字典服务，英文输入查询英文词典服务。
以下服务返回 `DictResult`（`type='dict'`），适合在词典窗口使用：

| 服务 | Key | 费用 | 说明 |
|------|-----|------|------|
| **中文词典** | `chinese_dictionary` | 免费 | 内置中文单字/词语释义 |
| **Free Dictionary** | `free_dictionary` | 免费 | dictionaryapi.dev，英文发音/释义/例句 |
| **ECDict（CC-CEDICT）** | `ecdict` | 免费 | 离线中英词典，better-sqlite3 + FTS5 |
| **Cambridge Dictionary** | `cambridge_dict` | 免费 | HTML 抓取，英文释义 |

---

## OCR 服务（16 个）

| 服务 | 实现文件 | 需要什么 | 费用 |
|------|----------|----------|------|
| **Tesseract** | `ocr/tesseract.ts` | 无（本地 OCR 引擎） | 免费 |
| **系统 OCR** | `ocr/system.ts` | 无（WinRT / macOS 原生 / Linux tesseract CLI） | 免费 |
| **百度 OCR** | `ocr/baidu_ocr.ts` | 百度云 API key | 有免费额度 |
| **百度高精度** | `ocr/baidu_accurate_ocr.ts` | 百度云 API key | 有免费额度 |
| **百度图片** | `ocr/baidu_img_ocr.ts` | 百度云 appid + secret | 有免费额度 |
| **腾讯 OCR** | `ocr/tencent_ocr.ts` | 腾讯云 secret_id + secret_key | 有免费额度 |
| **腾讯高精度** | `ocr/tencent_accurate_ocr.ts` | 腾讯云 secret_id + secret_key | 有免费额度 |
| **腾讯图片** | `ocr/tencent_img_ocr.ts` | 腾讯云 secret_id + secret_key | 有免费额度 |
| **火山引擎 OCR** | `ocr/volcengine_ocr.ts` | 火山引擎 API key | 有免费额度 |
| **火山多语言 OCR** | `ocr/volcengine_multi_lang_ocr.ts` | 火山引擎 API key | 有免费额度 |
| **OpenAI Vision** | `ocr/openai_vision.ts` | OpenAI API key | 按 token 计费 |
| **讯飞 OCR** | `ocr/iflytek_ocr.ts` | 讯飞 appid + apisecret + apikey | 有免费额度 |
| **讯飞 IntSig** | `ocr/iflytek_intsig_ocr.ts` | 同讯飞 | 有免费额度 |
| **讯飞 LaTeX** | `ocr/iflytek_latex_ocr.ts` | 同讯飞 | 数学公式 → LaTeX |
| **Simple LaTeX** | `ocr/simple_latex_ocr.ts` | SimpleTex API | 公式 → LaTeX |
| **QR Code** | `ocr/qrcode.ts` | 无（本地解析） | 免费 |

---

## TTS 服务（2 个）

| 服务 | 实现文件 | 需要什么 | 费用 |
|------|----------|----------|------|
| **Edge TTS** | `tts/edge_tts.ts` | 无（调用微软 Edge 浏览器 TTS 接口） | 免费，非官方 |
| **Lingva TTS** | `tts/lingva_tts.ts` | 无（默认调用 `lingva.lunar.icu` 实例，可自建） | 免费 |

---

## 当前可用状态

**默认配置中的服务**（`translate_service_list`）：bing, google, deepl

**开箱即用（无需任何配置）**：
- ✅ Google — 免费，非官方接口
- ✅ Bing — 免费，非官方接口
- ✅ MyMemory — 免费，匿名 5000 字符/天
- ✅ 中文词典 — 免费，内置中文释义
- ✅ Free Dictionary — 免费（dictionaryapi.dev）
- ✅ ECDict（CC-CEDICT）— 免费，离线中英词典
- ✅ Cambridge Dictionary — 免费
- ✅ Lingva — 免费（依赖第三方实例）
- ✅ Tesseract — 免费，本地 OCR
- ✅ 系统 OCR — 免费，本地
- ✅ QR Code — 免费，本地解析
- ⚠️ Ollama — 免费但需本地安装 Ollama + 下载模型
- ⚠️ DeepL (DeepLX 模式) — 免费但依赖第三方 DeepLX 服务

**需要 API key 才能用**：其余 13 个翻译服务 + 13 个 OCR 服务

---

## 已移除的服务

以下服务因 API 停用已从代码中移除：

| 服务 | 原因 |
|------|------|
| **Yandex Translate** | 403，免费端点已关闭 |
| **Bing Dictionary** | 403，服务已停用 |
