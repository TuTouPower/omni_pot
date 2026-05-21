# 外部 API 测试结果

> 测试日期: 2026-05-08
> 测试范围: docs/external_services/test_candidates.md 中列出的 22 个 API + 已有实现验证
> 测试方法: 直接 curl 请求验证连通性 + 响应内容

---

## 翻译 API 测试结果

| # | 名称 | 状态 | 说明 |
|---|------|------|------|
| T1 | Google Translate (gtx) | ⚠️ 当前环境不可达 | `client=gtx` 非官方端点，无需 key；2026-05-18 在当前 Windows 测试环境连续连接超时，不再作为默认启用服务。已有实现 `src/services/google.ts` |
| T2 | MyMemory Translation | ✅ 可用 | `GET https://api.mymemory.translated.net/get?q={text}&langpair={from}|{to}`，无需 key，匿名 5000 字符/天。双向翻译正常 |
| T3 | LibreTranslate (公共实例) | ❌ 不可用 | 官方 `libretranslate.com` 需要 API key。自托管可免费但需服务器 |
| T4 | SimplyTranslate AI | ❌ 不可用 | 返回 403 "访问被拒绝：无效的来源" |
| T5 | DeepLX | ❌ 不可用 | `api.deeplx.org` 返回 200 但内容是 URL 而非翻译结果，伪装可用 |
| T6 | Apertium APy | ❌ 不可用 | `apertium.org/apy` 连接被拒，且仅支持少量欧洲语种，不支持中文 |
| T8 | FunTranslations | ❌ 不可用 | 返回 403。免费版 5 次/小时，且是趣味翻译（Yoda 等），非正式用途 |

**小结**: 免费翻译 API 中 Bing、DeepL 免费模式和 MyMemory 更适合作为默认启用服务；Google GTX 依赖 Google 侧可达性，当前环境不再把它当作默认强依赖。

---

## 词典/字典 API 测试结果

| # | 名称 | 状态 | 说明 |
|---|------|------|------|
| D1 | Free Dictionary (dictionaryapi.dev) | ✅ 可用 | `GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}`，完全免费无需 key。返回词性、释义、音标、发音音频、同义词 |
| D2 | FreeDictionaryAPI.com | ✅ 可用 | `GET https://freedictionaryapi.com/api/v1/entries/en/{word}?translations=true`，无需 key，1000 请求/小时/IP。数据比 D1 更丰富 |
| D3 | Datamuse | ✅ 可用 | `GET https://api.datamuse.com/words?rel_syn={word}&max=5`，无需 key，100000 请求/天。同义词/联想词 API，非完整词典 |
| D4 | Wiktionary (MediaWiki API) | ✅ 可用 | MediaWiki Action API 可用，但返回 wikitext 格式需额外解析 |
| D5 | Chinese Character Web (CCDB) | ❌ 不可用 | 服务器存活但所有数据查询端点返回 HTTP 500 空响应，仅 `/version` 可用。服务器半废 |
| D6 | Chinese Text Project (CText) | ❌ 不适用 | 仅 `gettext`（获取古籍全文）和 `getlink` 可用，无字典/翻译/搜索功能。是古籍数字化图书馆 |
| D7 | CC-CEDICT (离线词库) | ✅ 可用 | 非在线 API，是可下载的中英词典数据文件，适合本地离线使用 |
| D8 | Cambridge Dictionary | ✅ 可用 | `GET https://dictionary.cambridge.org/search/direct/?datasetsearch={dataset}&q={word}` HTML 抓取，所有关键元素（dpron/ddef_d/dtrans/examp）均存在。已有实现 `src/services/cambridge_dict.ts` |

**小结**: 在线免费词典 API 有 4 个可靠：dictionaryapi.dev、freedictionaryapi.com、Datamuse、Cambridge。CC-CEDICT 可离线使用。

---

## 已有实现验证结果

| # | 名称 | 实现文件 | 测试结果 | 说明 |
|---|------|----------|----------|------|
| E1 | Bing Translate | `src/services/bing.ts` | ✅ 已修复 | **问题**: token 正则匹配错误 + token/key 分开发送；后续又发现 `bing.com/translator` 会跳转到区域域名。**修复**: 正则改为 `\[(\d+),\s*"([^"]+)"`，`key` 字段传时间戳，并使用最终页面 origin 调用 `ttranslatev3` |
| E2 | Yandex Translate | `src/services/yandex.ts` | ❌ 已移除 | 403 "Session is invalid"，免费端点已关闭，代码已删除 |
| E3 | Bing Dictionary | `src/services/bing_dict.ts` | ❌ 已移除 | API 返回 403 "Access disabled"，服务已停用，代码已删除 |
| E4 | ECDICT | `src/services/ecdict.ts` | ✅ 已替换 | 已替换为 CC-CEDICT 离线方案（better-sqlite3 + FTS5），用于中英词典，不作为中文释义词典 |
| E5 | Cambridge Dictionary | `src/services/cambridge_dict.ts` | ✅ 可用 | HTML 抓取验证通过，所有 CSS 选择器匹配正常 |
| E6 | Google Translate | `src/services/google.ts` | ⚠️ 当前环境不可达 | 2026-05-18 当前测试环境连续连接超时；保留为可配置服务，不默认启用 |
| E8 | 中文词典 | `src/services/chinese_dictionary.ts` | ✅ 可用 | 内置中文单字/词语释义，用于中文输入的中文词典/中文字典结果 |

---

## 推荐方案

### 翻译服务（当前可用）
1. **Bing Translate** — 默认启用，已有实现
2. **DeepL 免费模式** — 默认启用，已有实现
3. **MyMemory** — 默认启用，独立免费引擎，已有实现 `src/services/mymemory.ts`
4. **Google GTX** — 质量好但当前环境连接超时，保留为可配置服务，不默认启用

### 词典服务（当前可用）
1. **中文词典** — 当前内置中文单字/词语释义，用于中文查询（`src/services/chinese_dictionary.ts`）
2. **dictionaryapi.dev** — 英文词典首选，完全免费，音标+释义+例句+发音
3. **Cambridge Dictionary** — 已有 HTML 抓取实现，英文释义
4. **freedictionaryapi.com** — 备选，数据更丰富
5. **Datamuse** — 同义词/联想词专用
6. **CC-CEDICT** — 中英词典离线方案，已替换 ECDICT（`src/services/ecdict.ts`）

### 需要处理（已完成）
- ~~`src/services/yandex.ts`~~ — 已移除
- ~~`src/services/bing_dict.ts`~~ — 已移除
- ~~`src/services/ecdict.ts`~~ — 已替换为 CC-CEDICT 离线方案
- ~~新增 MyMemory 翻译服务实现~~ — `src/services/mymemory.ts` ✅ 已完成
- 新增 Free Dictionary 词典服务 — `src/services/free_dictionary.ts` ✅ 已完成
- 新增中文词典服务 — `src/services/chinese_dictionary.ts` ✅ 已完成
