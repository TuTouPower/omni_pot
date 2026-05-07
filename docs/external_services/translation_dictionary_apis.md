# Translation & Dictionary APIs 来自 PUBLIC APIS 这个项目

## Dictionary (Free, No Key Required)

| API | URL | Description | HTTPS | CORS |
|-----|-----|-------------|-------|------|
| Free Dictionary | https://dictionaryapi.dev/ | 英文定义、发音、词性、例句、同义词 | Yes | Unknown |
| Wiktionary | https://en.wiktionary.org/w/api.php | 协作式多语言字典 | Yes | Yes |
| Chinese Character Web | http://ccdb.hemiola.com/ | 汉字定义和发音 | No | No |
| Chinese Text Project | https://ctext.org/tools/api | 中国古籍文本 | Yes | Unknown |
| Indonesia Dictionary | https://new-kbbi-api.herokuapp.com/ | 印尼语字典 | Yes | Unknown |

## Dictionary (Requires API Key)

| API | URL | Description | HTTPS | CORS |
|-----|-----|-------------|-------|------|
| Collins | https://api.collinsdictionary.com/api/v1/documentation/html/ | 双语字典和同义词 | Yes | Unknown |
| Merriam-Webster | https://dictionaryapi.com/ | 字典和同义词 | Yes | Unknown |
| Oxford | https://developer.oxforddictionaries.com/ | 字典数据 | Yes | No |
| Wordnik | https://developer.wordnik.com | 字典数据 | Yes | Unknown |
| Lingua Robot | https://www.linguarobot.io | 释义、发音、同义词/反义词 | Yes | Yes |
| OwlBot | https://owlbot.info/ | 带例句和图片的释义 | Yes | Yes |
| Words | https://www.wordsapi.com/docs/ | 15万+词的释义和同义词 | Yes | Unknown |
| Synonyms | https://www.synonyms.com/synonyms_api.php | 同义词、反义词、近义词 | Yes | Unknown |

## Translation (Free, No Key Required)

| API | URL | Description | HTTPS | CORS |
|-----|-----|-------------|-------|------|
| LibreTranslate | https://libretranslate.com/docs | 17种语言互译，开源可自部署 | Yes | Unknown |
| FunTranslations | https://api.funtranslations.com/ | 趣味翻译（非正式用途） | Yes | Yes |

## Translation (Requires API Key)

| API | URL | Description | HTTPS | CORS |
|-----|-----|-------------|-------|------|
| Hirak Translation | https://translate.hirak.site/ | 21种常用语言互译 | Yes | Unknown |
| Lecto Translation | https://rapidapi.com/lecto-lecto-default/api/lecto-translation/ | 有免费额度 | Yes | Yes |
| languagelayer | https://languagelayer.com/ | 173种语言检测 (OAuth) | Yes | Unknown |
| Detect Language | https://detectlanguage.com/ | 语言检测 | Yes | Unknown |

## Recommended Combination

中英翻译 + 英文词典查询：

- **Free Dictionary** — 无需注册，`GET https://api.dictionaryapi.dev/api/v2/entries/en/<word>` 即可
- **LibreTranslate** — 无需注册，支持中英互译，也可自部署完全免费

# 以下是 ai 回答

下面这些是我会优先考虑的**无需 API key、免费可用**的翻译/词典 API。按可靠性和用途分：

## 翻译 API

| API                          | 适合场景                          | 无 key 情况与限制                                                                                                             |
| ---------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **MyMemory Translation API** | 小工具、低频翻译、快速 demo              | `key` 是可选参数；匿名免费额度是 **5,000 字符/天**，加 `de=email` 可到 **50,000 字符/天**；单次查询 `q` 最大 500 bytes。([mymemory.translated.net][1]) |
| **LibreTranslate（自托管）**      | 想要稳定、隐私、本地/服务器部署              | 开源、自托管、离线可用；本地启动后可直接请求 `/translate`，无需 key。官方托管版则需要 API key。([LibreTranslate][2])                                       |
| **Argos Translate**          | Python 本地翻译库，不一定要 HTTP API    | 开源离线翻译库，可作为 Python 库/CLI 使用；LibreTranslate 就是建在 Argos Translate 之上。([PyPI][3])                                          |
| **Apertium / Apertium APy**  | 规则翻译、形态分析、小语种/欧洲语种            | Apertium APy 是 HTTP 服务，公开示例不需要 key；但语种覆盖和翻译质量更偏规则系统。([wiki.apertium.org][4])                                            |
| **Lingva Translate**         | 临时使用、想走 Google Translate 替代前端 | 提供 REST/GraphQL API；但它本质是抓取 Google Translate，适合个人/实验，不建议生产强依赖。([GitHub][5])                                             |
| **SimplyTranslate AI**       | 可试的公网翻译 API                   | 文档显示匿名使用无需 key，并提供 `/translate` 示例；但文档页面有明显 i18n 文案渲染问题，生产前要实测稳定性。([SimplyTranslate AI][6])                             |

常用示例：

```bash
# MyMemory
curl "https://api.mymemory.translated.net/get?q=Hello%20world&langpair=en|zh-CN"

# LibreTranslate 自托管
curl -X POST http://localhost:5000/translate \
  -d q="Hello" \
  -d source=en \
  -d target=zh

# SimplyTranslate AI
curl -X POST https://api.simplytranslate.ai/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","from":"en","to":"zh-cn"}'
```

## 词典 / 字典 API

| API / 数据源                      | 适合场景                                | 无 key 情况与限制                                                                                               |
| ------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **FreeDictionaryAPI.com**      | 多语言 Wiktionary 结构化词典、释义、词性、同义/反义、翻译 | 明确写了 **No API Key**，限制是 **1,000 requests/hour/IP**；数据来自 Wiktionary，需署名。([freedictionaryapi.com][7])       |
| **dictionaryapi.dev**          | 英文单词释义、音标、例句、发音音频                   | 官方示例直接 URL 调用，且声明会一直免费；主要是英文词典。([dictionaryapi.dev][8])                                                   |
| **Datamuse API**               | 同义词、押韵、联想词、means-like 查询、写作辅助       | 无需 API key，免费到 **100,000 requests/day**；它更像“词语搜索/联想 API”，不是完整词典。([datamuse.com][9])                       |
| **Wiktionary / MediaWiki API** | 直接抓 Wiktionary 页面内容                 | MediaWiki 有 Action API/REST API，但 Wiktionary 没有标准“纯词典数据 API”，通常要解析页面 HTML/wikitext，不太省事。([MediaWiki][10]) |
| **CC-CEDICT**                  | 中文 ↔ 英文词典、本地词库                      | 不是在线 API，而是可下载词典数据；适合自己封装成本地 API。数据支持商业/非商业使用但需署名、同协议分享；MDBG 页面禁止自动脚本访问网页本身。([mdbg.net][11])              |

词典示例：

```bash
# dictionaryapi.dev 英文词典
curl "https://api.dictionaryapi.dev/api/v2/entries/en/hello"

# FreeDictionaryAPI.com
curl "https://freedictionaryapi.com/api/v1/entries/en/hello?translations=true"

# Datamuse：找“耳鸣”这个意思相关的英文词
curl "https://api.datamuse.com/words?ml=ringing+in+the+ears&max=5"
```

## 我的建议

做 demo 或低频翻译：先用 **MyMemory**。
做生产或隐私要求高：自托管 **LibreTranslate / Argos Translate**。
做英文词典：用 **dictionaryapi.dev** 或 **FreeDictionaryAPI.com**。
做中文英文字典：下载 **CC-CEDICT**，自己封装查询接口更稳。
做同义词/联想词：用 **Datamuse**。

[1]: https://mymemory.translated.net/doc/spec.php "MyMemory API technical specifications"
[2]: https://docs.libretranslate.com/ "Documentation | LibreTranslate"
[3]: https://pypi.org/project/argostranslate/ "argostranslate · PyPI"
[4]: https://wiki.apertium.org/wiki/Apertium-apy "Apertium-apy - Apertium"
[5]: https://github.com/TheDavidDelta/lingva-translate "GitHub - thedaviddelta/lingva-translate: Alternative front-end for Google Translate · GitHub"
[6]: https://simplytranslate.ai/api-docs/ "SimplyTranslate AI - Free AI Translation Tool | 196+ Languages Supported"
[7]: https://freedictionaryapi.com/ "Free Dictionary API"
[8]: https://dictionaryapi.dev/ "Free Dictionary API"
[9]: https://www.datamuse.com/api/ "Datamuse API"
[10]: https://www.mediawiki.org/wiki/API "API - MediaWiki"
[11]: https://www.mdbg.net/chinese/dictionary?page=cedict "MDBG Chinese Dictionary"




寻找**完全免费且不需要申请 API Key** 的翻译和字典接口，通常意味着我们需要依赖开源项目、公益节点或者一些通过网页端“逆向”封装的接口。

以下是目前开发者群体中最常用、最稳定的免 Key API 和工具库：

---

### 一、免费免 Key 的【翻译 API】

#### 1. Lingva Translate API (强烈推荐)
这是一个开源的 Google Translate 替代前端。它的原理是直接抓取谷歌翻译的网页结果，从而绕过官方 API 的限制和追踪。**完全免费，无需注册，无需 Key。**
*   **支持语言**：与谷歌翻译完全一致（100+ 种语言）。
*   **请求方式**：`GET`
*   **接口格式**：`/api/v1/:source/:target/:query`
*   **测试示例**：
    `GET [https://lingva.ml/api/v1/auto/zh/hello](https://lingva.ml/api/v1/auto/zh/hello)`
    *(将自动识别的语言翻译为中文 zh)*
*   **项目地址**：[GitHub - lingva-translate](https://github.com/thedaviddelta/lingva-translate)

#### 2. LibreTranslate (公共实例节点)
LibreTranslate 是一款完全开源的机器翻译引擎。虽然它的官方主站限制了免费调用，但社区在全球各地搭建了**大量的公共节点（Instances）**，这些节点大多不需要 API Key 就可以直接调用。
*   **优点**：纯开源引擎，隐私性极高。
*   **缺点**：翻译质量比起谷歌/DeepL 略显生硬；公共节点有时会限制请求频率。
*   **节点列表**：你可以在 GitHub 搜索 LibreTranslate mirrors 找到免 Key 的公共服务地址进行调用。

#### 3. 免 Key 翻译聚合库（适合 Python 开发者）
如果你是在写 Python 脚本或后端服务，可以直接使用以下两个开源库，它们在底层帮你自动处理了网页端接口的请求，不需要配置任何 Key：
*   **`deep-translator`**：极力推荐！它集成了 Google, MyMemory, Pons, Linguee 等多个翻译源的免费网页端接口，开箱即用。
*   **`googletrans`**：老牌的谷歌翻译免 Key 库，直接调用谷歌翻译的 Ajax 接口。

---

### 二、免费免 Key 的【字典 API】

#### 1. Free Dictionary API (英文词典首选)
这是目前全球最知名、最好用的免 Key 英语词典 API。它的数据来源于维基词典（Wiktionary）。**100% 免费，没有调用限制，不需要任何鉴权。**
*   **提供内容**：词性、释义、例句、同义词，甚至还提供**发音的音频文件链接 (mp3)** 和音标。
*   **请求方式**：`GET`
*   **测试示例**：
    `GET [https://api.dictionaryapi.dev/api/v2/entries/en/hello](https://api.dictionaryapi.dev/api/v2/entries/en/hello)`
*   **官网文档**：[dictionaryapi.dev](https://dictionaryapi.dev/)

#### 2. 必应 (Bing) / 有道等非官方 Web 接口 (适合中文/双语查词)
国内的大厂词典（如有道、百度、金山）官方 API 都是按量收费且需要 Key 的。但是，很多开发者会直接 GET 请求它们的**公开网页版接口**来获取 JSON 数据。
*   **必应词典 (Bing Dict)** Web 接口相对宽松，常被用于获取中英双语的释义和例句。
*   **注意**：这类接口属于“灰色地带”，官方随时可能修改数据结构或增加反爬策略验证（比如请求头校验）。如果你只是做个人小工具或毕设，直接在 GitHub 上搜索“有道词典 api 破解”或“必应词典 web api”就能找到很多现成的请求 URL 格式。

### 💡 总结建议：
*   如果你的项目需要**翻译句子**，直接用 **Lingva API**。
*   如果你的项目需要**查询英文单词释义/发音**，直接用 **Free Dictionary API**。
*   如果你在使用 **Python**，直接 `pip install deep-translator` 最省事。