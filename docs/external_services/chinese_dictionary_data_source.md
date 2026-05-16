# 中文词典（中文释义）数据源调研

> 调研日期: 2026-05-17
> 目标: 为 `chinese_dictionary.ts` 接入完整的中文单字/词语释义数据（简体中文，非中英对照）

---

## 背景

当前 `src/services/chinese_dictionary.ts` 只有 3 个硬编码样例词条（你、好、你好），其他查询返回"暂无内置释义"占位。
需要接入真实的中文词典数据，支持简体中文查询，返回中文释义（非英文翻译）。

---

## 调研的候选方案

### 一、免费 API 方案

| API | 简体支持 | 中文释义 | 免费额度 | 注册要求 | 实测状态 |
|-----|---------|---------|---------|---------|---------|
| **apihz.cn** 查词语（38万词库） | ✅ | ✅ 词语释义+拼音+词性 | 注册后免费，10次/分钟 | 需注册获取 id+key | 网络不通，未实测 |
| **mxnzp.com** 汉语字典 | ✅ | ✅ 单字释义+拼音+部首+笔画 | 1000次/天 | 需微信注册获取 app_id | 需注册，未实测 |
| **itapi.cn** 新华字典 | ✅ | ✅ 单字释义+拼音+部首+五笔 | 100次/天 | 需注册获取 key | 需注册，未实测 |
| **tianapi.com** 中文词典 | ✅ | ✅ 词语释义+出处+用法 | 100次/天 | 需注册获取 apiKey | 需注册，未实测 |
| **6api.net** 新华字典 | ✅ | ✅ 单字释义+英文 | 100次/天 | 需注册获取 appkey | 需注册，未实测 |
| **hanyuguide.com** | ✅ | ❌ 英文释义 | 免费，不需注册 | 不需 | 可用但不符合需求 |
| **萌典 moedict.tw** | ❌ 简体返回 Not Found | ✅ 教育部国语辞典 | 免费，不需注册 | 不需 | 简体不可用，繁体专用 |
| **百度汉语 hanyu.baidu.com** | ✅ | ✅ | 无官方 API | — | 内部接口有验证码，不可直接使用 |

**结论**：所有免费 API 均需注册获取 key，不存在无需注册的简体中文释义 API。
萌典（moedict.tw）是免费免注册的权威中文释义 API，但仅支持繁体中文，简体查询直接返回 `{"error":"Not Found"}`。

### 二、免费 API 详细信息

#### apihz.cn — 查词语字典（38万词库）

- 接口: `https://api.apihz.cn/api/zidian/cidian/chaciyu.php`
- 方法: GET/POST
- 参数: `id`（开发者ID）, `key`（开发者KEY）, `words`（词语）
- 返回: `content`（释义）, `zcpy`（拼音）, `cx`（词性）, `wljs`（网络解释）
- 限制: 注册用户 10次/分钟，每日无上限
- 注册: https://www.apihz.cn
- 返回示例:
```json
{
    "code": 200,
    "words": "接口",
    "content": "计算机中央处理机与外部设备之间的连接部分。泛指两个计算机系统或两种部件之间的连接设备。",
    "zcpy": "jiē kǒu",
    "cx": "名词",
    "wljs": "接口泛指实体把自己提供给外界的一种抽象化物..."
}
```

#### mxnzp.com — 汉语字典

- 接口: `https://www.mxnzp.com/api/convert/dictionary`
- 方法: GET
- 参数: `content`（汉字）, `app_id`, `app_secret`
- 返回: `word`（字）, `traditional`（繁体）, `pinyin`（拼音）, `radicals`（部首）, `explanation`（释义）, `strokes`（笔画）
- 限制: 1000次/天
- 注册: 微信公众号申请 app_id
- 返回示例:
```json
{
    "code": 1,
    "data": [{
        "word": "穆",
        "traditional": "穆",
        "pinyin": "mù",
        "radicals": "禾",
        "explanation": "穆 \n\n (形声。本义禾名) \n\n 同本义 \n\n 穆,禾也。--《说文》...",
        "strokes": 16
    }]
}
```

#### itapi.cn — 新华字典

- 接口: `https://api.itapi.cn/api/zidian`
- 方法: GET/POST
- 参数: `key`（请求密钥）, `word`（汉字，仅一个字）
- 返回: `hanzi`（字）, `py`（拼音）, `bushou`（部首）, `bihua`（笔画）, `wubi`（五笔）, `content`（释义）
- 限制: 100次/天
- 注册: https://api.itapi.cn

#### tianapi.com — 中文词典

- 接口: `https://apis.tianapi.com/lexicon/index`
- 方法: GET/POST
- 参数: `key`（ApiKey）, `word`（搜索词）
- 返回: `word`（词语）, `content`（释义）
- 限制: 普通会员 100次/天, QPS 3
- 注册: https://www.tianapi.com

### 三、离线数据方案

| 数据源 | 简体 | 中文释义 | 格式 | 词条量 | 许可证 | GitHub |
|--------|------|---------|------|--------|--------|--------|
| **mapull/chinese-dictionary** | ✅ | ✅ 含释义、组词、例句、词性 | JSON | 汉字2万+、词语32万+、成语5万 | 开源 | https://github.com/mapull/chinese-dictionary |
| **pwxcoo/chinese-xinhua** | ✅ | ✅ 汉字+词语+成语+歇后语 | JSON | 汉字1.6万、词语26万、成语3万 | 开源 | https://github.com/pwxcoo/chinese-xinhua |

#### mapull/chinese-dictionary（推荐）

最全面的开源中文词典数据：

- **char_detail.json** — 2万+汉字详细释义（拼音、词性、解释、组词、例句）
- **word.json** — 32万+词语（含成语）
- **idiom.json** — 5万成语
- **polyphone.json** — 2495多音字
- 数据来源: CC-CEDICT、pinyin-data、chinese-xinhua、汉典等
- 格式示例（char_detail.json）:
```json
{
    "char": "一",
    "pronunciations": [
        {
            "pinyin": "yī",
            "explanations": [
                {
                    "content": "最小的正整数。",
                    "speech": "数",
                    "words": [{"word": "一样", "text": "同样；没有差别"}]
                }
            ]
        }
    ]
}
```

#### pwxcoo/chinese-xinhua

- **word.json** — 16142个汉字（拼音、部首、笔画、释义）
- **ci.json** — 264434个词语
- **idiom.json** — 31648个成语
- **xiehouyu.json** — 14032条歇后语
- 格式示例（word.json）:
```json
{
    "word": "嗄",
    "strokes": "13",
    "pinyin": "á",
    "radicals": "口",
    "explanation": "嗄〈叹〉\n\n 同啊”。表示省悟或惊奇..."
}
```

### 四、排除的方案

| 方案 | 排除原因 |
|------|---------|
| **萌典 moedict.tw** | 台湾教育部辞典，仅支持繁体中文，简体字查询返回 Not Found |
| **CNMan/XDHYCD7th**（现代汉语词典第7版） | 版权问题：商务印书馆商业出版物的 OCR 扫描，法律风险高 |
| **Dictionaryphile/All_Dictionaries** | 同上，版权不干净，且格式为 MDX/StarDict 需转换 |
| **hanyuguide.com** | 返回英文释义，不符合中文释义需求 |
| **百度汉语 hanyu.baidu.com** | 无官方 API，内部接口有验证码/反爬 |
| **极速数据 jisuapi.com** | 汉语词典接口已下架 |

---

## 推荐方案

### 方案 A：离线数据 + SQLite（推荐）

使用 **mapull/chinese-dictionary** 的 JSON 数据，导入 SQLite 本地查询。

优点:
- 不依赖网络，不怕 API 挂掉/收费/限流
- 查询速度快（本地 SQLite 毫秒级）
- 数据最全面（2万汉字 + 32万词语 + 5万成语）
- Electron 项目已有 better-sqlite3 依赖

缺点:
- 数据文件较大（JSON 约 200MB+，SQLite 压缩后约 50-100MB）
- 数据不是实时更新的
- 需要一次性导入脚本

实现思路:
1. 下载 mapull/chinese-dictionary JSON 数据到 `data/chinese_dict/`
2. 写构建脚本将 JSON 导入 SQLite（`data/chinese_dict.db`）
3. 改造 `chinese_dictionary.ts` 查 SQLite（通过 IPC 调用主进程，同 ecdict.ts 模式）
4. 先查词组匹配，再回退到单字查询

### 方案 B：免费 API

在 apihz.cn / tianapi.com / mxnzp.com 注册获取 key。

优点:
- 无需内置大数据文件
- 数据可能更权威（来源可能是新华字典/现代汉语词典）

缺点:
- 依赖外部服务可用性
- 免费额度有限（100-1000次/天）
- 需要用户自行注册获取 key
- 需要网络连接

实现思路:
1. 在配置中增加中文词典 API key 字段
2. `chinese_dictionary.ts` 发 HTTP 请求查询
3. 做本地缓存减少 API 调用

### 最终建议

**方案 A（离线数据）更适合桌面应用**。理由：
1. 桌面应用应优先保证离线可用
2. 项目已有 better-sqlite3 和 ecdict.ts 的 IPC 模式可复用
3. 数据量虽大但一次性打包，用户体验好
4. 38万词条覆盖足够日常使用

如果用户需要更权威的数据（如新华字典原文），可以在方案 A 基础上叠加方案 B 作为在线补充。
