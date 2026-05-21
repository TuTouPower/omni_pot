# 语言检测方案测试结果

> 测试日期：2026-05-21
>
> 测试环境：Windows 11，Node.js v22.13.0（electron-vite 项目上下文），当前网络环境为中国大陆。
>
> 采纳状态：已采用 cld3-asm 作为运行时唯一主检测引擎；5 个远程 detect API 回退链已移除，保留 Unicode 正则作为最终兜底。

## 测试文本

每种语言使用短文本（1-2 句）和长文本（3-4 句）两组：

| 语言 | 短文本 | 长文本 |
|---|---|---|
| 简体中文 | 你好世界，今天天气不错 | 中华人民共和国是一个伟大的国家，拥有悠久的历史和灿烂的文化。中国人民勤劳勇敢，创造了丰富多彩的中华文明。 |
| 英文 | Hello, how are you doing today? | The United States of America is a country in North America. It is the third largest country by total area and population. The capital is Washington, D.C., and the most populous city is New York City. |
| 法文 | Bonjour, comment allez-vous? | La République française est un État souverain dont le territoire métropolitain est situé en Europe de l'Ouest. Sa capitale est Paris. La France est une démocratie libérale. |
| 阿拉伯文 | مرحبا، كيف حالك؟ | الجمهورية العربية المتحدة هي دولة عربية تقع في شمال شرق أفريقيا وجنوب غرب آسيا. عاصمتها القاهرة وهي أكبر المدن العربية. |
| 日文 | こんにちは、お元気ですか？ | 日本国は東アジアに位置する島国です。首都は東京です。日本は独自の文化と伝統を持つ国として知られています。 |
| 西班牙文 | Hola, ¿cómo estás? | El Reino de España es un país soberano miembro de la Unión Europea. Su capital es Madrid. España es una monarquía parlamentaria. |
| 韩文 | 안녕하세요, 오늘 날씨가 좋습니다 | 대한민국은 동아시아에 위치한 나라입니다. 수도는 서울입니다. 한국은 독자적인 문화와 전통을 가진 나라로 알려져 있습니다. |
| 德文 | Guten Tag, wie geht es Ihnen? | Die Bundesrepublik Deutschland ist ein Bundesstaat in Mitteleuropa. Die Hauptstadt ist Berlin. Deutschland ist ein demokratischer und sozialer Bundesstaat. |
| 俄文 | Привет, как дела? | Российская Федерация — государство в Восточной Европе и Северной Азии. Столица — Москва. Россия является крупнейшей страной мира по площади. |
| 泰文 | สวัสดี สบายดีไหม | ราชอาณาจักรไทยเป็นประเทศในเอเชียตะวันออกเฉียงใต้ เมืองหลวงคือกรุงเทพมหานคร ประเทศไทยมีวัฒนธรรมและประเพณีที่เป็นเอกลักษณ์ |
| 越南文 | Xin chào, bạn khỏe không? | Cộng hòa Xã hội chủ nghĩa Việt Nam là một quốc gia nằm ở phía đông bán đảo Đông Dương. Thủ đô là Hà Nội. Việt Nam có nền văn hóa phong phú. |
| 印地文 | नमस्ते, आप कैसे हैं? | भारत गणराज्य दक्षिण एशिया में एक देश है। राजधानी नई दिल्ली है। भारत विश्व का सबसे बड़ा लोकतंत्र है। |
| 葡萄牙文 | Olá, como está? | A República Portuguesa é um país soberano unitário localizado no sudoeste da Europa. A sua capital é Lisboa. Portugal é uma república parlamentarista. |
| 意大利文 | Ciao, come stai? | La Repubblica Italiana è una repubblica parlamentare situata nell'Europa meridionale. La sua capitale è Roma. L'Italia è membro dell'Unione Europea. |
| 土耳其文 | Merhaba, nasılsınız? | Türkiye Cumhuriyeti, Avrupa ve Asya kıtalarının kesişim noktasında bulunan bir ülkedir. Başkenti Ankara'dır. Türkiye demokratik ve laik bir hukuk devletidir. |

## 1. 远程 API 连通性（5 个全部不可用）

| 服务 | 结果 | 错误类型 |
|---|---|---|
| Bing Detect | **不可用** | 首次 429 限流，后续 400 Bad Request 或超时 |
| Google Detect | **不可用**（直连）/ **可用（走代理 10808）** | 直连超时；走代理可达，详见第 6 节 |
| Baidu Detect | **不可用** | 错误码 1022（反爬），中文返回 undefined |
| Tencent Detect | **不可用** | HTTP 405 Method Not Allowed，接口疑似下线 |
| NiuTrans Detect | **不可用** | 错误码 13002，无 key 路径已失效 |

## 2. 本地检测方案准确率对比（15 种语言 × 短+长 = 30 组）

| 方案 | 短文本 | 长文本 | 总计 | 包体积 |
|---|---|---|---|---|
| **fasttext-wasm (echogarden)** | **15/15** | **15/15** | **30/30** | 2.10 MB + 模型 916 KB = **3.0 MB** |
| **fasttext-wasm (xushengfeng)** | **15/15** | **15/15** | **30/30** | **4.75 MB**（含模型） |
| **cld3-asm** | **15/15** | **15/15** | **30/30** | **6.30 MB** |
| franc-min | 10/15 | 13/15 | 23/30 | 124 KB |
| franc | 9/15 | 13/15 | 22/30 | 266 KB |
| franc-all | 9/15 | 12/15 | 21/30 | 592 KB |
| Local Regex | 8/15 | 8/15 | 16/30 | 0 |

### fasttext-wasm — 30/30 全部正确

两个 fasttext-wasm 包使用相同的 lid.176.ftz 模型，结果完全一致：

| 语言 | 短文本 | 长文本 | 置信度 |
|---|---|---|---|
| 简体中文 | ✅ zh | ✅ zh | 0.9660 |
| 英文 | ✅ en | ✅ en | 0.9321 |
| 法文 | ✅ fr | ✅ fr | 0.9579 |
| 阿拉伯文 | ✅ ar | ✅ ar | 0.9733 |
| 日文 | ✅ ja | ✅ ja | 1.0000 |
| 西班牙文 | ✅ es | ✅ es | 0.9931 |
| 韩文 | ✅ ko | ✅ ko | 0.9998 |
| 德文 | ✅ de | ✅ de | 0.9342 |
| 俄文 | ✅ ru | ✅ ru | 0.9600 |
| 泰文 | ✅ th | ✅ th | 1.0000 |
| 越南文 | ✅ vi | ✅ vi | 0.9947 |
| 印地文 | ✅ hi | ✅ hi | 0.9695 |
| 葡萄牙文 | ✅ pt | ✅ pt | 0.5391 |
| 意大利文 | ✅ it | ✅ it | 0.9922 |
| 土耳其文 | ✅ tr | ✅ tr | 0.9735 |

速度（500 次迭代）：

| 包 | 短文本(英文) | 长文本(英文) | 中文短文本 | 初始化 |
|---|---|---|---|---|
| echogarden | 0.075ms/次 | 0.447ms/次 | 0.079ms/次 | 285ms |
| xushengfeng | 0.061ms/次 | 0.417ms/次 | — | 238ms |
| cld3-asm | 0.046ms/次 | 0.116ms/次 | 0.031ms/次 | 7ms |

### cld3-asm — 30/30 全部正确

| 语言 | 短文本 | 长文本 | 置信度 |
|---|---|---|---|
| 简体中文 | ✅ zh | ✅ zh | 0.9999 |
| 英文 | ✅ en | ✅ en | 0.9996 |
| 法文 | ✅ fr | ✅ fr | 1.0000 |
| 阿拉伯文 | ✅ ar | ✅ ar | 0.9840 |
| 日文 | ✅ ja | ✅ ja | 1.0000 |
| 西班牙文 | ✅ es | ✅ es | 0.9960 |
| 韩文 | ✅ ko | ✅ ko | 0.9999 |
| 德文 | ✅ de | ✅ de | 1.0000 |
| 俄文 | ✅ ru | ✅ ru | 0.9771 |
| 泰文 | ✅ th | ✅ th | 1.0000 |
| 越南文 | ✅ vi | ✅ vi | 1.0000 |
| 印地文 | ✅ hi | ✅ hi | 0.9993 |
| 葡萄牙文 | ✅ pt | ✅ pt | 0.9928 |
| 意大利文 | ✅ it | ✅ it | 0.8802 |
| 土耳其文 | ✅ tr | ✅ tr | 0.9995 |

### franc 系列 — 短文本准确率差

| 问题语言 | 短文本误判 | 长文本 |
|---|---|---|
| 英文 | → sot（南索托语）| ✅ |
| 阿拉伯文 | → urd/pnb | → arb（非 ar，需映射） |
| 印地文 | → bho（博杰普尔语）| → mag（摩揭陀语） |
| 西班牙文 | → epo（世界语）| ✅ |
| 意大利文 | → pt_pt | ✅（franc-all 长文本也误判 → mxi） |
| 土耳其文 | → sot/ilo | ✅ |

### Local Regex — 基准对照

拉丁系语言（法/西/德/葡/意/土）全部归英文，日文含汉字误判为中文。

## 3. 三个 30/30 方案对比

| 维度 | cld3-asm | fasttext (echogarden) | fasttext (xushengfeng) |
|---|---|---|---|
| 准确率 | 30/30 | 30/30 | 30/30 |
| 最低置信度 | 0.8802（意大利文） | 0.5391（葡萄牙文） | 0.5391（葡萄牙文） |
| 包体积 | 6.30 MB | 3.0 MB（包+模型） | 4.75 MB（含模型） |
| 初始化 | **7ms** | 285ms | 238ms |
| 短文本速度 | **0.046ms** | 0.075ms | 0.061ms |
| 长文本速度 | **0.116ms** | 0.447ms | 0.417ms |
| API 复杂度 | 简单 | 需手动加载 WASM | 需 await 多步初始化 |
| 模型文件 | 内置 | 包内附带 | 内置打包 |
| 包更新时间 | 较老 | 2023 | 2025 |
| 语言码 | BCP-47（zh/en/fr） | ISO 639-1（zh/en/fr） | ISO 639-1（zh/en/fr） |

- **cld3-asm**：速度最快、初始化最轻、API 最简单、置信度最高，但体积最大（6.3MB），包较老
- **fasttext (echogarden)**：体积最小（3MB），准确率与 cld3 相同，但初始化慢（285ms），需要手动加载 WASM 二进制
- **fasttext (xushengfeng)**：开箱即用（模型内置），2025 年更新，但 API 初始化步骤多，置信度略低

## 4. Chrome Language Detector API

你问得对，Electron 本质就是 Chromium。项目使用的 Electron 39 对应 Chromium 134。

Chrome 的 Language Detector API（`self.translation.createDetector()`）属于 Chrome 内置 AI API（Prompt API / Chrome Built-in AI），在 Chromium 131+ 中以实验性功能提供。但有以下限制：

1. **需要启用实验性标志**：`--enable-features=LanguageDetectionAPI` 或 `chrome://flags/#language-detection-api`
2. **Electron 中默认不暴露**：Chrome 的内置 AI API 不在 Electron 的标准 API 集中，需要通过 `app.commandLine.appendSwitch()` 启用
3. **平台依赖**：该 API 依赖 Chrome 内部的翻译模型（Compact Language Detector v3），可能需要联网下载模型
4. **稳定性**：截至 2026 年 5 月仍为实验性 API，接口可能变化

如果未来 Chrome Language Detector API 成为稳定标准，可以考虑在 Electron 的渲染进程中启用它作为额外检测源。但当前阶段，使用 cld3-asm 或 fasttext-wasm 更可靠。

## 6. Google Translate gtx API（lingva-scraper 底层）

> lingva-scraper 是 lingva-translate 的核心依赖，本质是抓取 Google Translate 网页/接口。
> 语言检测完全由 Google Translate 完成（`source=auto` 时返回 `detectedSource`），lingva-scraper 仅做解析透传。
>
> 测试方式：直接调用 `translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=...`，走 SOCKS5 代理 `127.0.0.1:10808`。

### 连通性

| 条件 | 结果 |
|---|---|
| 无代理 | **不可达**（超时），当前网络环境无法直连 Google |
| 走代理 10808 | **可用**，延迟约 1-3 秒/请求 |

### 准确率（15 种语言 × 短+长 = 30 组）

| 语言 | 短文本 | 长文本 | 备注 |
|---|---|---|---|
| 简体中文 | ✅ zh-CN | ✅ zh-CN | 返回 `zh-CN` 而非 `zh`，语言本身正确 |
| 英文 | ✅ en | ✅ en | |
| 法文 | ✅ fr | ✅ fr | |
| 阿拉伯文 | ✅ ar | ✅ ar | |
| 日文 | ✅ ja | ✅ ja | |
| 西班牙文 | ✅ es | ✅ es | |
| 韩文 | ✅ ko | ✅ ko | |
| 德文 | ✅ de | ✅ de | |
| 俄文 | ✅ ru | ✅ ru | |
| 泰文 | ✅ th | ✅ th | |
| 越南文 | ✅ vi | ✅ vi | |
| 印地文 | ✅ hi | ✅ hi | |
| 葡萄牙文 | ✅ pt | ✅ pt-PT | 长文本返回 `pt-PT`（欧洲葡语），语言正确 |
| 意大利文 | ✅ it | ✅ it | |
| 土耳其文 | ✅ tr | ✅ tr | |

语言判断准确率 **30/30**。3 个返回了更精确的 locale 码（`zh-CN`、`pt-PT`），不影响实际使用（做 locale→LanguageCode 映射即可）。

### 速度

| 指标 | 值 |
|---|---|
| 短文本延迟 | 约 1000-1100ms（含代理+网络） |
| 长文本延迟 | 约 1200-3100ms（含代理+网络） |
| 限流风险 | 高频调用可能被 Google 限流 |

### 与本地方案对比

| 维度 | Google gtx (lingva-scraper) | cld3-asm | fasttext-wasm |
|---|---|---|---|
| 准确率 | 30/30 | 30/30 | 30/30 |
| 延迟 | 1000-3100ms（需代理+网络） | **0.03-0.12ms**（本地） | 0.06-0.45ms（本地） |
| 初始化 | 无 | 7ms | 238-285ms |
| 离线可用 | 否 | 是 | 是 |
| 代理依赖 | 是（中国大陆需代理访问 Google） | 否 | 否 |
| 包体积 | 0（远程 API） | 6.3 MB | 3.0-4.75 MB |

### 结论

Google Translate gtx 语言检测准确率与本地 cld3-asm / fasttext-wasm 相当（30/30），但：
- 延迟高 3-4 个数量级（秒级 vs 微秒级）
- 中国大陆必须走代理，增加复杂度和不确定性
- 高频使用可能被 Google 限流
- 不支持离线场景

**不适合作为 omni_pot 的主要语言检测方案**，但可作为翻译 API 调用时的附带检测结果使用（调用翻译时 `source=auto`，Google 返回的 `detectedSource` 可直接复用，零额外开销）。

## 7. 结论

### 推荐排序

| 优先级 | 方案 | 理由 |
|---|---|---|
| 1 | **cld3-asm** | 速度最快、初始化最轻（7ms）、API 最简单、置信度最高。6.3MB 体积对 Electron 可接受 |
| 2 | **@echogarden/fasttext-wasm** | 体积最小（3MB）、准确率与 cld3 相同。285ms 初始化比 cld3 慢但可接受 |
| 3 | **@xushengfeng/fasttext_wasm** | 开箱即用、2025 年更新。但 API 复杂、置信度略低 |

### 不推荐

| 方案 | 原因 |
|---|---|
| franc 全系列 | 短文本准确率极差，阿拉伯文/印地文长短文本均误判 |
| 远程 API（Bing/Google/Baidu/Tencent/NiuTrans） | 当前环境全部不可用，即使可用也不稳定 |
| Google gtx / lingva-scraper | 准确率 30/30 但延迟秒级、需代理、有限流风险；仅适合翻译调用时附带复用 detectedSource，不适合独立检测 |
| Chrome Language Detector API | 实验性 API，需要 Chromium flag，不稳定 |
