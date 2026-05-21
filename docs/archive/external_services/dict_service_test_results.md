# 词典服务实测报告

> 测试日期: 2026-05-19
> 测试环境: Windows 11, Node.js (better-sqlite3 本地库 + fetch 在线 API)
> 目的: 验证各词典服务可用性、调用格式、返回格式，以及中英文输入的分离效果

---

## 公共返回类型

所有词典服务最终返回统一的 `DictResult`（定义于 `shared/types/service.ts`）：

```typescript
interface DictResult {
    type: 'dict'
    pronunciations: Array<{ region: string; phonetic: string }>
    definitions: Array<{ partOfSpeech: string; meanings: string[] }>
    examples: Array<{ source: string; target: string }>
}
```

查询无结果时返回 `null` 或空字符串 `''`。

---

## 1. chinese_dictionary（中文词典）

| 属性     | 值                                                                          |
| -------- | --------------------------------------------------------------------------- |
| 实现文件 | `src/services/chinese_dictionary.ts` + `electron/chinese_dict/index.ts` |
| 数据库   | `resources/data/dict/chinese_dict.db`（86 MB，只读）                      |
| 词条规模 | 词语 320,349 / 单字 16,221 / 成语 49,635                                    |
| 调用方式 | IPC `chineseDict:lookup`                                                  |
| 状态     | ✅ 可用，纯中文释义                                                         |

### 调用格式

渲染进程 → 主进程 IPC：

```
channel: 'chineseDict:lookup'
args: (text: string)
```

主进程内部路由逻辑（`electron/ipc/chinese_dict_handlers.ts`）：

1. 检查 `dict_chinese_enabled` 配置，为 false 直接返回 null
2. 检查 `is_ready()`，数据库未就绪返回 null
3. `clean_for_exact(text)` — 去除非汉字/字母数字字符，长度 >100 返回空
4. `is_chinese(word)` — 必须包含 `\p{Script=Han}`，否则返回 null
5. 单字（`word.length === 1`）：`lookup_character` → 失败则 `lookup_word`
6. 多字：`lookup_word` → `lookup_idiom` → `fts_search`（前缀匹配，限 5 条）

### 数据库 schema

```sql
-- 词语
words(id, word TEXT, pinyin TEXT, explanation TEXT)
-- 单字（pinyin/explanation/words 为 JSON 字符串）
characters(id, char TEXT, pinyin TEXT, explanation TEXT, speech TEXT, words TEXT)
-- 成语
idioms(id, word TEXT, pinyin TEXT, explanation TEXT, source TEXT, example TEXT, similar TEXT, opposite TEXT)
-- 全文索引
words_fts(words)   -- FTS5
characters_fts(characters)  -- FTS5
```

### 转换过程

转换函数位于 `electron/ipc/chinese_dict_handlers.ts`，在主进程中完成，IPC 返回的已经是 `DictResult`。

**单字 → `to_dict_result_char()`**（第 33–78 行）

原始 SQLite 行（`characters` 表）：

```json
{
    "char": "你",
    "pinyin": "[\"nǐ\"]",
    "explanation": "[{\"pinyin\":\"nǐ\",\"speech\":\"\",\"content\":\"(形声。从人,尔声……)\"},{\"pinyin\":\"nǐ\",\"speech\":\"\",\"content\":\"同本义。\"}]",
    "speech": null,
    "words": "[{\"word\":\"你好\",\"text\":\"称对方……\"},{\"word\":\"你们\",\"text\":\"……\"}]"
}
```

转换逻辑：
1. `pinyin` 是 JSON 数组字符串 → `JSON.parse` 得到 `string[]`
2. `explanation` 是 JSON 数组字符串 → `JSON.parse` 得到 `{ pinyin, speech, content }[]`
3. 按 `pinyin` 分组，每组生成一个 definition，`speech` 拼接为 `partOfSpeech`（顿号连接）
4. `words` 是 JSON 数组 → 取前 3 条，拼成 examples（`"word：text"` 格式）

转换后：

```json
{
    "type": "dict",
    "pronunciations": [{ "region": "普通话", "phonetic": "nǐ" }],
    "definitions": [
        { "partOfSpeech": "", "meanings": ["(形声。从人,尔声……)。", "同本义。"] }
    ],
    "examples": []
}
```

丢失信息：
- `words` 字段原始条目可能超过 3 条，只取前 3 条
- `speech` 为空时 `partOfSpeech` 为空字符串

**多字词 → `to_dict_result_word()`**（第 24–31 行）

原始 SQLite 行（`words` 表）：

```json
{ "word": "学习", "pinyin": "xué xí", "explanation": "个体由经验或练习引起的在能力或倾向方面的变化……" }
```

转换逻辑：直接映射，`explanation` 整体作为唯一 meaning。

丢失信息：无（`words` 表只有这三个字段）。

**成语 → `to_dict_result_idiom()`**（第 80–102 行）

原始 SQLite 行（`idioms` 表）：

```json
{
    "word": "画蛇添足", "pinyin": "huà shé tiān zú",
    "explanation": "画蛇时给蛇添上脚。比喻……",
    "source": "{\"text\":\"楚有祠者……\",\"book\":\"《战国策·齐策二》\"}",
    "example": "将军功绩已成，威信大立，至今欲益求全，恐为画蛇添足。",
    "similar": "[\"多此一举\",\"弄巧成拙\"]",
    "opposite": "[\"画龙点睛\",\"恰到好处\"]"
}
```

转换逻辑：
1. `source` JSON 解析 → 拼成 `"【出处】text（book）"` 作为 example
2. `example` 直接作为 example
3. `similar`、`opposite` 字段**不转换**

丢失信息：
- **`similar`（近义成语）** — 丢弃，未写入 DictResult
- **`opposite`（反义成语）** — 丢弃，未写入 DictResult
- 代码第 101 行有注释 `// FUTURE: extend DictResult with idiom_meta`

### 返回格式示例（单字 "你"）

```json
{
    "type": "dict",
    "pronunciations": [{ "region": "普通话", "phonetic": "nǐ" }],
    "definitions": [
        {
            "partOfSpeech": "",
            "meanings": ["(形声。从人,尔声。本义:称说话的对方)。", "同本义。"]
        }
    ],
    "examples": []
}
```

**成语 "画蛇添足"** — 走 `lookup_idiom` → `to_dict_result_idiom`：

```json
{
    "type": "dict",
    "pronunciations": [{ "region": "普通话", "phonetic": "huà shé tiān zú" }],
    "definitions": [
        { "partOfSpeech": "成语", "meanings": ["画蛇时给蛇添上脚。比喻做了多余的事……"] }
    ],
    "examples": [
        { "source": "【出处】……", "target": "" },
        { "source": "你这样做就是画蛇添足。", "target": "" }
    ]
}
```

**多字词 "学习"** — 走 `lookup_word` → `to_dict_result_word`：

```json
{
    "type": "dict",
    "pronunciations": [{ "region": "普通话", "phonetic": "xué xí" }],
    "definitions": [
        { "partOfSpeech": "", "meanings": ["个体由经验或练习引起的在能力或倾向方面的变化……"] }
    ],
    "examples": []
}
```

**英文输入 "hello"** — 被 `is_chinese()` 拦截，返回 `null`。

### 实测结果

| 输入       | 结果                                |
| ---------- | ----------------------------------- |
| "你"       | ✅ 单字释义 + 多音字分组            |
| "你好"     | ❌ 未收录（打招呼用语，非语文词条） |
| "学习"     | ✅ 中文释义                         |
| "中国"     | ✅ 中文释义                         |
| "电脑"     | ✅ "指电子计算机。"                 |
| "手机"     | ✅ "手持式移动电话机的简称。"       |
| "画蛇添足" | ✅ 成语释义 + 出处 + 例句           |
| "hello"    | ✅ 正确拒绝（返回 null）            |

---

## 2. free_dictionary（Free Dictionary API）

| 属性     | 值                                                         |
| -------- | ---------------------------------------------------------- |
| 实现文件 | `src/services/free_dictionary.ts`                        |
| 端点     | `https://api.dictionaryapi.dev/api/v2/entries/en/{word}` |
| 认证     | 无需 key                                                   |
| 状态     | ✅ 可用，纯英文释义                                        |

### 调用格式

渲染进程直接 fetch（不经过 IPC）：

```
GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}
```

前端实现中 `word` 取输入第一个空格前的部分，且必须匹配 `/^[a-z]+$/i`（纯英文字母），否则直接返回空字符串。

### 转换过程

转换逻辑在渲染进程 `src/services/free_dictionary.ts` 第 48–90 行，前端直接构造 `DictResult`。

原始 API 返回（array of entries）：

```json
[{
    "word": "hello",
    "license": { "name": "CC BY-SA 4.0", "url": "..." },
    "sourceUrls": ["https://en.wiktionary.org/wiki/hello"],
    "phonetic": "/həˈloʊ/",
    "phonetics": [
        { "text": "/həˈloʊ/", "audio": "https://.../us/hello.mp3", "sourceUrl": "..." },
        { "text": "/həˈləʊ/", "audio": "https://.../uk/hello.mp3", "sourceUrl": "..." }
    ],
    "meanings": [{
        "partOfSpeech": "noun",
        "definitions": [
            { "definition": "\"Hello!\" or an equivalent greeting.", "synonyms": [], "antonyms": [] }
        ]
    }]
}]
```

转换逻辑：
1. 遍历所有 entries（API 可返回多条，如不同词源的同形词）
2. `phonetic` + `phonetics` → 去重后写入 `pronunciations`，region 从 audio URL 推断（含 `-us` → `US`，含 `-uk` → `UK`）
3. `meanings[].definitions[]` → 每条 definition 的 `definition` 字段追加到 `meanings[]`
4. 有 `example` 的 definition → 追加到 `examples`
5. 按 `partOfSpeech` 分组（同一个词性的所有定义归入一个 DictDefinition）

丢失信息：
- **`license`** — 丢弃
- **`sourceUrls`** — 丢弃
- **`phonetics[].audio` URL** — 丢弃（只提取了 region 标记和 phonetic text）
- **`phonetics[].sourceUrl`** — 丢弃
- **`definitions[].synonyms`** — 丢弃
- **`definitions[].antonyms`** — 丢弃

### 转换后 DictResult 示例

```json
{
    "type": "dict",
    "pronunciations": [{ "region": "US", "phonetic": "/həˈloʊ/" }],
    "definitions": [
        { "partOfSpeech": "noun", "meanings": ["\"Hello!\" or an equivalent greeting."] },
        { "partOfSpeech": "verb", "meanings": ["To greet with \"hello\"."] },
        { "partOfSpeech": "interjection", "meanings": ["A greeting said when meeting someone.", "A greeting used when answering the telephone."] }
    ],
    "examples": [{ "source": "Hello, how are you?", "target": "" }]
}
```

### 实测结果

| 输入    | 结果                                  |
| ------- | ------------------------------------- |
| "hello" | ✅ noun/verb/interjection 英文释义    |
| "good"  | ✅ /ɡʊ(d)/ + adjective/interjection |
| "你好"  | ✅ HTTP 404，正确拒绝                 |

---

## 3. ecdict（CC-CEDICT 双语词典）

| 属性     | 值                                                      |
| -------- | ------------------------------------------------------- |
| 实现文件 | `src/services/ecdict.ts` + `electron/dict/index.ts` |
| 数据库   | `resources/data/dict/cc_cedict.db`（24 MB）           |
| 调用方式 | IPC `dict:lookup`                                     |
| 状态     | ✅ 可用，中英双向（结果必然跨语言）                     |

### 调用格式

渲染进程 → 主进程 IPC：

```
channel: 'dict:lookup'
args: (text: string, from: LanguageCode, to: LanguageCode)
```

主进程方向判断（`electron/ipc/dict_handlers.ts`）：

```
is_en_to_zh = from === 'en' || (from === 'auto' && /^[a-zA-Z]/.test(word))
```

- 英→中：`lookup_english(word)` — `WHERE english LIKE '%word%' LIMIT 20`
- 中→英：`lookup_chinese(word)` — `WHERE simplified = ? OR traditional = ?`

### 数据库 schema

```sql
entries(id, simplified TEXT, traditional TEXT, pinyin TEXT, english TEXT)
entries_fts(simplified, traditional, english)  -- FTS5
```

`english` 字段格式：`hello; hi`（分号分隔的多个释义）

### 转换过程

转换函数位于 `electron/ipc/dict_handlers.ts` 第 22–58 行的 `to_dict_result(entries, is_en_to_zh)`，在主进程中完成。

原始 SQLite 行（`entries` 表）：

```json
{ "simplified": "学习", "traditional": "學習", "pinyin": "xue2 xi2", "english": "to learn/to study" }
```

**中→英方向**（`is_en_to_zh = false`）：
1. 每条 entry 的 `english` 按 `/` 拆分 → 去重后写入 `meanings`
2. 取第一条 entry 的 `pinyin` → 写入 `pronunciations`（region 为空字符串）
3. 上限 10 条 meanings

**英→中方向**（`is_en_to_zh = true`）：
1. 每条 entry → 拼成 `"simplified (pinyin)"` 格式作为 meaning
2. 不生成 pronunciations
3. 上限 10 条 meanings

丢失信息：
- **`traditional`** — 中→英方向不展示繁体；英→中方向只展示 simplified，繁体丢失
- **`pinyin` 数字声调格式** — 保留但未转为声调符号（如 `xue2 xi2` 而非 `xué xí`）
- **多义项拆分细节** — `english` 字段按 `/` 拆分，原数据中同一义项内若含 `/` 会被误拆
- **英→中方向** — 多条 entry 的 `simplified` 会混在一起（如 "hello" 匹配到 你好、凯蒂猫、午安、哈喽、哈啰出行等 10 条），没有按词频或相关度排序（仅 `LIMIT 20` 截断）

### 返回格式示例

**中文输入 "学习"** — `to_dict_result(entries, false)`（中→英）：

```json
{
    "type": "dict",
    "pronunciations": [{ "region": "", "phonetic": "xue2 xi2" }],
    "definitions": [
        { "partOfSpeech": "en", "meanings": ["to learn", "to study"] }
    ],
    "examples": []
}
```

**英文输入 "hello"** — `to_dict_result(entries, true)`（英→中）：

```json
{
    "type": "dict",
    "pronunciations": [],
    "definitions": [
        {
            "partOfSpeech": "zh",
            "meanings": [
                "你好 (ni3 hao3)",
                "凯蒂猫 (Kai3 di4 Mao1)",
                "午安 (wu3 an1)",
                "哈喽 (ha1 lou2)",
                "哈啰 (ha1 luo1)",
                "哈啰出行 (Ha1 luo1 Chu1 xing2)",
                "哈罗 (ha1 luo2)",
                "问好 (wen4 hao3)",
                "喂 (wei2)",
                "奥赛罗 (Ao4 sai4 luo2)"
            ]
        }
    ],
    "examples": []
}
```

**英文输入 "computer"** — LIKE 模糊匹配，结果混杂：

```
meanings: "3C (san1 C)", "七喜 (Qi1 xi4)", "中招 (zhong4 zhao1)", "串行 (chuan4 xing2)", ...
```

### 实测结果

| 输入       | 方向   | 结果内容                                                     |
| ---------- | ------ | ------------------------------------------------------------ |
| "你好"     | 中→英 | "hello; hi"（英文释义）                                      |
| "学习"     | 中→英 | "to learn, to study"（英文释义）                             |
| "hello"    | 英→中 | "你好", "哈喽", "问好" 等（中文翻译）                        |
| "good"     | 英→中 | "A货", "NG", "一分为二" 等（LIKE 模糊匹配，结果杂）          |
| "computer" | 英→中 | "3C", "七喜", "中招" 等（LIKE 匹配到含 computer 的释义条目） |

**注意**: CC-CEDICT 是双向词典，输入中文返回英文释义，输入英文返回中文翻译，结果必然跨语言。英文的 LIKE `%word%` 模糊匹配对常见词效果尚可，但对长词/冷门词会匹配到不相关条目。

---

## 4. cambridge_dict（Cambridge Dictionary 网页抓取）

| 属性     | 值                                                                                   |
| -------- | ------------------------------------------------------------------------------------ |
| 实现文件 | `src/services/cambridge_dict.ts`                                                   |
| 端点     | `https://dictionary.cambridge.org/search/direct/?datasetsearch={dataset}&q={word}` |
| 认证     | 无需 key（需 User-Agent 头）                                                         |
| 状态     | ✅ 可用，英文释义为主                                                                |

### 调用格式

渲染进程直接 fetch：

```
GET https://dictionary.cambridge.org/search/direct/?datasetsearch={dataset}&q={word}
Headers:
  Accept: text/html
  User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
```

`dataset` 映射（`CAMBRIDGE_LANG_MAP`）：

| from  | to      | dataset                         | 效果                         |
| ----- | ------- | ------------------------------- | ---------------------------- |
| en    | en/auto | `english`                     | ✅ 纯英文释义                |
| en    | zh_cn   | `english-chinese-simplified`  | ✅ 英文释义 + 中文翻译       |
| en    | zh_tw   | `english-chinese-traditional` | ✅ 英文释义 + 中文翻译       |
| zh_cn | any     | `chinese-simplified`          | ❌ 404，Cambridge 不支持     |
| zh_tw | any     | `chinese-traditional`         | ❌ 404，Cambridge 不支持     |

### 返回格式

返回 HTML 页面，通过正则提取：

- 发音：`class="dpron-i"` → `class="region"` + `class="pron"`
- 词条：`class="pr entry-body__el"`
- 词性：`class="posgram"`
- 释义：`class="def-block ddef_block"` → `class="def ddef_d db"`
- 翻译：`class="trans dtrans dtrans-se"`
- 例句：`class="examp"` → `class="eg"`

### 转换过程

转换逻辑在渲染进程 `src/services/cambridge_dict.ts` 第 78–157 行，用正则从 HTML 提取字段，构造 `DictResult`。

原始 HTML 片段示例（Cambridge 页面结构）：

```html
<div class="dpron-i">
    <span class="region">us</span>
    <span class="pron">həˈloʊ</span>
</div>
<div class="pr entry-body__el">
    <span class="posgram"><span class="pos">interjection</span></span>
    <div class="def-block ddef_block">
        <div><span class="def ddef_d db">used when meeting someone</span></div>
        <div><span class="trans dtrans dtrans-se">你好；喂</span></div>
        <div class="examp"><span class="eg">Hello, how are you?</span></div>
    </div>
</div>
```

转换逻辑：
1. 正则匹配 `dpron-i` 块 → 提取 `region` 和 `pron` 文本
2. 正则匹配 `entry-body__el` 块 → 提取 `posgram` 作为 partOfSpeech
3. 正则匹配 `def-block` 块 → 提取 `def ddef_d db`（英文释义）和 `trans dtrans dtrans-se`（中文翻译）
4. 英文释义 + 中文翻译（按 `;` 拆分）合并到同一个 definition 的 `meanings[]`
5. 提取 `examp` 块中的 `eg` 作为 examples
6. 跳过含 `data-wl-senseid` 且含 `panel` 的 def-block（子词条面板）

丢失信息：
- **发音音频 URL** — 页面有 `<source src="...mp3">` 标签，未提取
- **词频/CEFR 等级** — 页面有 `belong-to` class 标记，未提取
- **词形变化表** — 页面有 `inflection` 区块，未提取
- **同义词/反义词面板** — 子词条被跳过（`data-wl-senseid` + `panel` 判断）
- **词源（etymology）** — 未提取
- **语法标签**（grammar box，如 [C]、[U]、[T]、[I]）— 未提取
- **英文释义与中文翻译被混入同一个 meanings 数组** — 使用 `english-chinese-simplified` 数据集时，一条 definition 里既有英文释义又有中文翻译（如 `["used when meeting someone", "你好；喂"]`）；使用 `english` 数据集则只有英文释义，无此问题

### 转换后 DictResult 示例（`english-chinese-simplified` 数据集）

```json
{
    "type": "dict",
    "pronunciations": [{ "region": "us", "phonetic": "həˈloʊ" }],
    "definitions": [
        {
            "partOfSpeech": "interjection",
            "meanings": ["used when meeting or greeting someone", "你好；喂"]
        }
    ],
    "examples": [{ "source": "Hello, nice to meet you.", "target": "" }]
}
```

### 实测结果

| 输入    | dataset                          | 结果                                                        |
| ------- | -------------------------------- | ----------------------------------------------------------- |
| "hello" | `english`                        | ✅ 纯英文释义（英英词典）                                   |
| "hello" | `english-chinese-simplified`     | ✅ 英文释义 + 中文翻译（英汉词典），302 重定向到 `/dictionary/english-chinese-simplified/hello` |
| "你好"  | `chinese-simplified`             | ❌ 404，Cambridge 不支持独立中文查询入口                    |
| "学习"  | `chinese-simplified`             | ❌ 404                                                      |
| "你好"  | `english-chinese-simplified`     | ✅ HTTP 200，但无 `entry-body`（该词无独立词条，返回搜索结果页） |
| "hello" | `english-chinese-simplified`     | ✅ HTTP 200，有完整 entry-body                              |

**结论**: Cambridge 通过 `dataset` 参数控制语言方向：`english` = 纯英文，`english-chinese-simplified` = 英文+中文。不支持纯中文输入查询。

---

## free_dictionary vs cambridge_dict 纯英文对比

> 测试条件：12 个英文单词，`dataset=english`（纯英文模式），统计释义条数。

### 数据量对比

| 单词                          | free_dictionary | cambridge | 多的一方       |
| ----------------------------- | --------------- | --------- | -------------- |
| hello                         | 7               | 8         | cambridge      |
| good                          | 20              | 40        | cambridge      |
| run                           | 63              | 80        | cambridge      |
| set                           | 91              | 62        | free_dictionary |
| serendipity                   | 2               | 1         | free_dictionary |
| ubiquitous                    | 3               | 2         | free_dictionary |
| ephemeral                     | 4               | 2         | free_dictionary |
| pneumonia                     | 1               | 3         | cambridge      |
| algorithm                     | 2               | 4         | cambridge      |
| photosynthesis                | 1               | 2         | cambridge      |
| antidisestablishmentarianism  | 1               | 1         | 持平           |
| nonexistentxyzword            | 404             | 无词条    | 持平           |

### 音标对比

| 服务           | 音标来源                   | 实测状态                                                                 |
| -------------- | -------------------------- | ------------------------------------------------------------------------ |
| free_dictionary | API 原始字段 `phonetic` + `phonetics[]` | ✅ 正常，如 `/ɡʊ(d)/`、`/əˈfɛ.mə.ɹəl/`；且有发音音频 URL                |
| cambridge_dict  | HTML 正则提取 `class="pron"`         | ✅ 已修复 — 两处正则更新（见下方）                                              |

Cambridge 音标正则修复说明（`src/services/cambridge_dict.ts`）：

页面 HTML 结构已变更，旧正则全部匹配失败：

```html
<!-- 旧结构（代码预期） -->
<span class="dpron-i">...<span class="region">uk</span>...<span class="pron">heˈləʊ</span>...</div></div>

<!-- 新结构（实际页面） -->
<span class="uk dpron-i ">...<span class="region dreg">uk</span>...<span class="pron dpron">/<span class="ipa dipa">heˈləʊ</span>/</span>...</span></span>
```

修复内容（2 处）：

| 正则位置 | 旧值 | 新值 | 原因 |
|----------|------|------|------|
| 外层（匹配 dpron-i 块） | `class="dpron-i"[^>]*>(…)<\/div>\s*<\/div>` | `class="[^"]*dpron-i[^>]*>(…)<\/span>\s*<\/span>` | 元素从 `<div>` 变为 `<span>`；class 前可能有其他类名 |
| 内层-地区 | `class="region"` | `class="region[^"]*"` | class 从 `region` 变为 `region dreg` |
| 内层-音标 | `class="pron"[^>]*>([^<]*)` | 优先匹配 `class="[^"]*\bipa\b[^"]*"[^>]*>([^<]*)`；fallback `class="pron[^"]*"[^>]*>\/([^<]*)` | 音标文本从 `pron` 直接子文本变为嵌套在 `ipa dipa` 子标签内 |

### 结论

| 维度       | free_dictionary                               | cambridge_dict                                    |
| ---------- | --------------------------------------------- | ------------------------------------------------- |
| 稳定性     | ✅ 稳定，无超时/服务器错误                     | ✅ 稳定，无超时/服务器错误                         |
| 常用多义词 | 释义较多（含所有 entries 聚合）               | 更多（含短语动词、习语、idiom）                    |
| 冷门/专业词 | 与 cambridge 持平或略多                       | 与 free_dictionary 持平或略少                      |
| 音标       | ✅ 正常，有 US/UK 区分 + 音频 URL              | ✅ 已修复（2026-05-19），有 US/UK 区分；多义词会有重复发音块（同一词多 entry 各带发音） |
| 数据源     | dictionaryapi.dev（Wiktionary 衍生）          | Cambridge 官方页面抓取                             |
| 风险       | 第三方免费 API，无 SLA                        | 网页抓取，页面结构变动即失效（已发生）             |

---

## 语言路由与分离性总结

前端路由逻辑位于 `src/windows/dict/index.tsx` 的 `service_supports_dictionary_query()`：

```typescript
function service_supports_dictionary_query(service_key: string, source_language: LanguageCode): boolean {
    if (source_language === 'en') {
        return ['free_dictionary', 'ecdict', 'cambridge_dict'].includes(service_key)
    }
    return service_key === 'chinese_dictionary' || service_key === 'ecdict'
}
```

### 各服务的输入/输出语言

| 服务               | 中文输入 → 返回                  | 英文输入 → 返回                 |
| ------------------ | --------------------------------- | -------------------------------- |
| chinese_dictionary | 中文释义（普通话拼音 + 中文解释） | 正确拒绝（null）                 |
| free_dictionary    | 正确拒绝（404）                   | 英文释义（英文定义 + 例句）      |
| ecdict (CC-CEDICT) | **英文释义**（中→英翻译）  | **中文翻译**（英→中翻译） |
| cambridge_dict     | 404（不支持纯中文查询）           | 纯英文（`english`）或英文+中文翻译（`english-chinese-simplified`），由 dataset 参数控制 |

### 默认词典列表

```typescript
dictionary_service_list: ['chinese_dictionary@default', 'free_dictionary@default', 'ecdict@default']
```

中文查询时实际走 `chinese_dictionary` + `ecdict`，结果卡片会出现一个中文释义 + 一个英文释义，造成"混着"的感觉。ecdict 作为双语词典无法避免此问题。
