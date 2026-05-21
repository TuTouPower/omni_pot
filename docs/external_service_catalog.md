# 外部服务清单

> 更新日期：2026-05-21（语言检测已改为 cld3-asm 本地检测）
>
> 本清单整理自历史调研与实测记录，并对照当前服务注册入口：`src/services/index.ts`、`src/services/ocr/index.ts`、`src/services/tts/index.ts`、`electron/detect/index.ts`。
>
> 这是一份事实清单，不代表最终采用决策。是否启用、替换、删除或新增服务，由后续产品/实现决策决定。

## 分类口径

| 分类 | 含义 |
|---|---|
| 免费无需 key | 用户不需要填写 key、token、账号或自定义 API URL；可能仍需要公网可达，且无官方 SLA。 |
| 需要本地数据库或本地后台服务 | 不依赖云端 key，但需要本地数据文件、系统能力、模型文件或用户额外启动本地服务。 |
| 需要 key 但可免费用 | 需要注册或填写 key/token；资料显示有免费额度、免费套餐、试用额度或可用免费层。 |
| 必须付费 key | 需要 key，且主要按量计费或未在现有资料中确认可长期免费使用。 |

## 1. 免费无需 key

### 1.1 语言检测

| 服务/端点 | 状态 | 备注 |
|---|---|---|
| cld3-asm | 当前代码采用 | 本地 WASM 检测，无需网络；WASM 加载失败、检测不可靠或 IPC 不可用时回退到 Unicode 正则。 |
| Unicode regex fallback | 当前代码采用 | 覆盖中/日/韩/俄乌/泰/阿波/希伯来/印地/越南等脚本；作为 cld3 失败时的最终兜底。 |
| Bing / Google / Baidu / Tencent / NiuTrans detect | 已移除 | 历史实测在当前环境不可用或不稳定，不再作为运行时回退链。 |

### 1.2 翻译

| 服务/端点 | 状态 | 备注 |
|---|---|---|
| Bing Translate | 当前代码存在，历史实测通过 | 无需用户 key；依赖网页/Edge Translator 非官方路径，可能被上游改接口。 |
| Google Translate gtx | 当前代码存在，当前环境历史实测不可达 | 无需 key；当前 Windows 测试环境曾连续超时，因此不应被当作强稳定依赖。 |
| DeepL free / DeepLX free | 当前代码存在，历史实测通过 | 无需 key；使用免费 JSON-RPC/DeepLX free 路径，非官方公开 API，长文本和语言码有已知上游风险。 |
| MyMemory | 当前代码存在，历史实测通过 | 无需 key；匿名额度约 5000 字符/天，低频可用。 |
| 火山翻译免配置接口 | 资料中实测通过 | pot-app 社区插件路径，`translate.volcengine.com/crx/translate/v1`，不同于当前代码里的官方 Volcengine key 服务。 |
| 腾讯交互翻译免配置接口 | 资料中实测通过 | pot-app 社区插件路径，需固定/模拟浏览器 header；不同于当前代码里的需要账号 token 的 TranSmart 服务。 |
| 彩云小译内置 token 接口 | 资料中实测通过 | pot-app 社区插件路径，内置 token 有失效风险；不同于当前代码里的用户配置 token 的 Caiyun 服务。 |
| 腾讯翻译君微信小程序接口 | 资料中实测通过 | pot-app 社区插件路径，模拟微信小程序 header；不同于当前代码里的腾讯云 key 服务。 |
| Papago 网页接口 | 资料中实测通过 | pot-app 社区插件路径，需动态版本号与 HMAC token；有反爬风险。 |
| LibreTranslate 公共主站 | 资料中实测不可用 | `libretranslate.com` 当前要求 API key；自部署见本地服务分类。 |
| SimplyTranslate AI | 资料中实测不可用 | 返回 403，无效来源。 |
| Apertium APy 公共端点 | 资料中实测不可用 | 连接被拒，且语种覆盖不适合中文主路径。 |
| FunTranslations | 资料中实测不可用 | 403；趣味翻译，不适合正式翻译。 |
| 有道网页免 key 插件路径 | 资料中实测不可用 | 返回乱文，疑似反爬/加密变化。 |
| 百度/沪江免 key 插件路径 | 资料中实测不可用 | 返回空内容，接口疑似下线或变更。 |

### 1.3 词典

| 服务/端点 | 状态 | 备注 |
|---|---|---|
| Free Dictionary / dictionaryapi.dev | 当前代码存在，历史实测通过 | 英文词典，无需 key；返回词性、释义、音标、例句、发音等。 |
| Cambridge Dictionary 网页抓取 | 当前代码存在，历史实测通过 | 无需 key；英文词典/英汉词典 HTML 抓取，页面结构变化会导致失效。 |
| FreeDictionaryAPI.com | 资料中实测通过 | 无需 key，约 1000 请求/小时/IP；当前代码未实现。 |
| Datamuse | 资料中实测通过 | 无需 key，约 100000 请求/天；更适合同义词/联想词，不是完整词典。 |
| Wiktionary / MediaWiki API | 资料中可用 | 无需 key；返回 wikitext/页面结构，需要额外解析。 |
| Tatoeba 例句查询 | 资料中实测部分可用 | 无需 key；英文例句查询可用，中文查询可能慢或超时。 |
| Chinese Character Web / CCDB | 资料中实测不可用 | 查询端点 HTTP 500，仅 `/version` 可用。 |
| Chinese Text Project / CText | 资料中判定不适用 | 古籍数字化接口，不是字典/翻译/搜索服务。 |
| 萌典 moedict.tw | 资料中判定不适合简体中文 | 免费无需 key，但简体查询返回 Not Found，偏繁体国语辞典。 |
| hanyuguide.com | 资料中判定不符合需求 | 免费无需 key，但返回英文释义，不符合中文释义需求。 |
| 百度汉语网页接口 | 资料中判定不可直接使用 | 无官方 API，内部接口有验证码/反爬。 |

### 1.4 文字识别

| 服务/能力 | 状态 | 备注 |
|---|---|---|
| QR Code | 当前代码存在 | 本地二维码解析；无需 key、无需网络。 |
| System OCR | 当前代码存在 | 调用系统文字识别能力；无需 key，效果取决于操作系统支持。 |
| Tesseract | 当前代码存在 | 本地 OCR；无需 key，依赖本地训练数据/模型文件，详见本地服务分类。 |

### 1.5 朗读

| 服务/能力 | 状态 | 备注 |
|---|---|---|
| System TTS | 当前代码存在 | 调用浏览器 Web Speech API 和系统语音；无需 key、无需网络，语音质量取决于系统已安装 voice。 |

## 2. 需要本地数据库或本地后台服务

### 2.1 语言检测

| 服务/方案 | 状态 | 本地依赖 | 备注 |
|---|---|---|---|
| local regex / 本地检测 | 当前代码存在 | 无额外依赖 | 可离线；对拉丁字母系语言区分能力有限。 |
| cld3-asm | 调研方案 | WASM 包/模型 | 资料中作为本地检测候选；当前是否采用以代码为准。 |
| franc | 调研方案 | npm 数据包 | 纯 JS，准确率低于 cld3-asm。 |
| lingua-rs | 调研方案 | 自行编译 WASM，大模型文件 | 集成成本高，不适合作为当前低成本方案。 |

### 2.2 翻译

| 服务/方案 | 状态 | 本地依赖 | 备注 |
|---|---|---|---|
| Ollama | 当前代码存在 | 本机 Ollama 服务 + 模型 | 本地模型免费，但用户需要额外安装、拉取模型并启动服务。 |
| LibreTranslate 自部署 | 资料中候选 | 自托管 HTTP 服务 | 官方公共主站需要 key；自部署实例可无 key 使用。 |
| Argos Translate | 资料中候选 | 本地 Python 库/CLI/模型 | 可离线翻译；不是当前代码已注册服务。 |

### 2.3 词典

| 服务/数据源 | 状态 | 本地依赖 | 备注 |
|---|---|---|---|
| Chinese Dictionary | 当前代码存在 | `resources/data/dict/chinese_dict.db` | 本地中文单字/词语/成语释义数据库，约 86 MB。 |
| CC-CEDICT | 当前代码存在 | `resources/data/dict/cc_cedict.db` | 本地中英双向词典数据库，约 24 MB。 |
| ECDICT / GCIDE | 资料中离线候选 | 本地词典数据库 | pot-app 插件资料中提及，未作为当前已注册实现列入。 |
| mapull/chinese-dictionary | 资料中推荐数据源 | JSON 数据导入 SQLite | 中文词典数据源，不是在线服务。 |
| pwxcoo/chinese-xinhua | 资料中候选数据源 | JSON 数据导入 SQLite | 中文词典/成语/歇后语数据源。 |

### 2.4 文字识别

| 服务/方案 | 状态 | 本地依赖 | 备注 |
|---|---|---|---|
| Tesseract | 当前代码存在 | 本地 OCR 引擎/训练数据 | 无 key、无网络；属于本地模型能力。 |
| System OCR | 当前代码存在 | 操作系统 OCR 能力 | 无 key；依赖系统平台能力。 |
| Rapid OCR | 资料中离线候选 | 本地模型 | pot-app 插件资料中提及，未作为当前已注册实现列入。 |
| Paddle OCR | 资料中离线候选 | PaddlePaddle + 模型 | pot-app 插件资料中提及，未作为当前已注册实现列入。 |

### 2.5 朗读

| 服务/方案 | 状态 | 本地依赖 | 备注 |
|---|---|---|---|
| System TTS | 当前代码存在 | 系统语音引擎/voice | Windows 使用 SAPI，macOS 使用系统语音，Linux 取决于系统语音环境。 |

### 2.6 收藏/同步

| 服务/方案 | 状态 | 本地依赖 | 备注 |
|---|---|---|---|
| Anki | 当前代码存在 | 本地 Anki + AnkiConnect 服务 | 不需要云 key，但需要用户启动本地 AnkiConnect。 |

## 3. 需要 key 但可免费用

> 这一类表示“需要用户申请/填写 key、token 或账号凭证，但资料中显示有免费额度、免费套餐或免费层”。具体额度会随服务商政策变化，需要以服务商当前控制台/文档为准。

### 3.1 翻译

| 服务 | 状态 | 需要配置 | 免费性质 |
|---|---|---|---|
| DeepL official Free API | 当前代码存在 | `authKey` | 官方 Free/Pro API 路径；Free 需要 key，区别于无 key 的 free/DeepLX 模式。 |
| Gemini Pro | 当前代码存在 | API key | 资料归类为免费额度/按量计费。 |
| Alibaba | 当前代码存在 | AccessKey ID + Secret | 云服务，通常有免费额度/试用额度，超出后按量计费。 |
| Baidu | 当前代码存在 | appid + secret | 通常有免费额度/按量计费。 |
| Baidu Field | 当前代码存在 | appid + secret + domain | 通常有免费额度/按量计费。 |
| Caiyun | 当前代码存在 | token | 通常有免费额度/按量计费。 |
| NiuTrans | 当前代码存在 | apikey | 通常有免费额度/按量计费。 |
| Youdao | 当前代码存在 | appKey + key | 通常有免费额度/按量计费。 |
| Volcengine | 当前代码存在 | appid + secret | 通常有免费额度/按量计费。 |
| Tencent | 当前代码存在 | secret_id + secret_key | 通常有免费额度/按量计费。 |
| TranSmart | 当前代码存在 | username + token | 需要账号凭证；资料未给出明确免费额度，但不是无配置服务。 |
| Lecto Translation | 资料中候选 | API key/RapidAPI | 资料显示有免费额度。 |
| Detect Language | 资料中候选 | API key | 语言检测服务，资料未纳入当前实现。 |
| languagelayer | 资料中候选 | OAuth/API key | 语言检测服务，资料未纳入当前实现。 |

### 3.2 词典

| 服务 | 状态 | 需要配置 | 免费性质 |
|---|---|---|---|
| apihz.cn 查词语 | 资料中候选 | id + key | 注册后免费，资料记录 10 次/分钟。 |
| mxnzp.com 汉语字典 | 资料中候选 | app_id + app_secret | 资料记录 1000 次/天。 |
| itapi.cn 新华字典 | 资料中候选 | key | 资料记录 100 次/天。 |
| tianapi.com 中文词典 | 资料中候选 | apiKey | 资料记录普通会员 100 次/天。 |
| 6api.net 新华字典 | 资料中候选 | appkey | 资料记录 100 次/天。 |
| Merriam-Webster | 资料中候选 | API key | 字典/同义词 API；是否满足免费额度需以当前官网为准。 |
| Wordnik | 资料中候选 | API key | 字典数据 API；是否满足免费额度需以当前官网为准。 |
| Lingua Robot | 资料中候选 | API key | 释义、发音、同义/反义；是否满足免费额度需以当前官网为准。 |
| OwlBot | 资料中候选 | API key | 带例句和图片的释义；是否满足免费额度需以当前官网为准。 |
| Synonyms.com | 资料中候选 | API key | 同义词/反义词 API；是否满足免费额度需以当前官网为准。 |

### 3.3 文字识别

| 服务 | 状态 | 需要配置 | 免费性质 |
|---|---|---|---|
| Baidu OCR | 当前代码存在 | client_id + client_secret | 通常有免费额度/按量计费。 |
| Baidu Accurate OCR | 当前代码存在 | client_id + client_secret | 通常有免费额度/按量计费。 |
| Baidu Image OCR | 当前代码存在 | appid + secret | 通常有免费额度/按量计费。 |
| Tencent OCR | 当前代码存在 | secret_id + secret_key | 通常有免费额度/按量计费。 |
| Tencent Accurate OCR | 当前代码存在 | secret_id + secret_key | 通常有免费额度/按量计费。 |
| Tencent Image OCR | 当前代码存在 | secret_id + secret_key | 通常有免费额度/按量计费。 |
| Volcengine OCR | 当前代码存在 | appid + secret | 通常有免费额度/按量计费。 |
| Volcengine Multi-Lang OCR | 当前代码存在 | appid + secret | 通常有免费额度/按量计费。 |
| iFlytek OCR | 当前代码存在 | appid + apisecret + apikey | 通常有免费额度/按量计费。 |
| iFlytek IntSig OCR | 当前代码存在 | appid + apisecret + apikey | 通常有免费额度/按量计费。 |
| iFlytek LaTeX OCR | 当前代码存在 | appid + apisecret + apikey | 通常有免费额度/按量计费。 |
| Simple LaTeX OCR | 当前代码存在 | token | 需要 SimpleTex token；免费额度需以服务方当前规则为准。 |

### 3.4 收藏/同步

| 服务 | 状态 | 需要配置 | 免费性质 |
|---|---|---|---|
| Eudic | 当前代码存在 | token | 调用欧路词典开放 API；免费/付费限制需以欧路当前规则为准。 |

## 4. 必须付费 key

> 这一类表示当前资料没有确认稳定免费额度，或服务形态主要是按量付费。兼容接口可能由用户自建或第三方提供，实际费用取决于用户填入的 endpoint。

### 4.1 翻译

| 服务 | 状态 | 需要配置 | 备注 |
|---|---|---|---|
| OpenAI compatible | 当前代码存在 | API key / Azure key / 自定义 URL | 通常按 token 计费；如果用户填自建兼容服务，费用由该服务决定。 |
| ChatGLM | 当前代码存在 | API key | 资料归类为按 token 计费/额度，未确认长期免费层。 |
| Hirak Translation | 资料中候选 | API key | 资料列为 Requires API Key，未确认免费额度。 |

### 4.2 词典

| 服务 | 状态 | 需要配置 | 备注 |
|---|---|---|---|
| Collins | 资料中候选 | API key | 商业词典 API。 |
| Oxford | 资料中候选 | API key | 商业词典 API。 |
| WordsAPI | 资料中候选 | API key | 15 万+词数据 API，资料未确认免费层。 |

### 4.3 文字识别

| 服务 | 状态 | 需要配置 | 备注 |
|---|---|---|---|
| OpenAI Vision | 当前代码存在 | API key / 自定义 URL | 通常按 token/图片处理计费；兼容 endpoint 费用取决于用户配置。 |

## 5. 已知不可用或不适用项

| 类型 | 服务 | 结论 |
|---|---|---|
| 翻译 | Yandex 免费端点 | 历史实现已移除；403 Session is invalid。 |
| 词典 | Bing Dictionary | 历史实现已移除；API 返回 403 Access disabled。 |
| 翻译 | DeepLX `api.deeplx.org` | 资料中返回内容不是翻译结果，判定伪可用。 |
| 翻译 | LibreTranslate 官方公共主站 | 需要 API key；不能算免费免 key。 |
| 翻译 | SimplyTranslate AI | 当前资料中实测 403。 |
| 翻译 | Apertium APy 公共端点 | 当前资料中连接被拒，且不适合中文主路径。 |
| 翻译 | FunTranslations | 当前资料中 403，且用途偏趣味翻译。 |
| 翻译/TTS | Lingva Translate 公共实例 | 2026-05-21 实测：官方 `lingva.ml` 被 Cloudflare 拦截（HTTP 403，需浏览器 JS 验证），其余社区实例（`translate.igna.wtf`、`lingva.thedaviddelta.com`、`lingva.garudalinux.org`、`lingva.pawan857.me`、`lingva.darkness.services`、`lingva.lunar.icu` 等）均超时或已暂停部署；历史代码已在 `3149728` 中移除。免费无需 key，但当前无可用公共端点；若需使用需自行部署。 |
| 中文词典 | 百度汉语网页接口 | 无官方 API，验证码/反爬，不适合作为直接依赖。 |
| 中文词典 | CNMan/XDHYCD7th、Dictionaryphile/All_Dictionaries | 版权风险高，不适合纳入。 |

## 6. 资料来源

历史研究/测试快照（全部归档于 `docs/archive/external_services/`，作 catalog 溯源）：

- `lang_detect_api_test_20260521.md`（2026-05-21 远程检测 API + cld3-asm 实测）
- `external_services.md`
- `api_test_results.md`
- `pot_plugin_api_test_results.md`
- `dict_service_test_results.md`
- `chinese_dictionary_data_source.md`
- `language_detection_comparison.md`
- `deepl_free_jsonrpc_limits.md`
- `translation_dictionary_apis.md`
