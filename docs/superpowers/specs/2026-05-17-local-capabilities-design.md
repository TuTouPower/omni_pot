# 本地能力设计：中文字典 + 语言检测

> 日期: 2026-05-17
> 状态: 已确认（review 后修订）
> 关联: PLAN.md "接入真实中文字典数据源"、PLAN.md "本地语言检测替换"
> 评审: review_claude.md, review_gpt.md

---

## 一、中文字典数据导入与改造

### 目标

将 `chinese_dictionary.ts` 从 3 个硬编码样例词条改造为接入完整中文词典数据（32万+词语、2万+汉字、5万成语），提供简体中文释义。

## 数据源

**mapull/chinese-dictionary**（MIT License）
- GitHub: https://github.com/mapull/chinese-dictionary
- **Pinned commit**: 构建脚本中硬编码一个已验证的 commit hash（实现时从 clone 的 HEAD 取），
  构建时校验源目录 HEAD 与 pinned hash 一致：
  - 本地 dev：warn 不阻塞，记录 `expected_source_commit` 与 `actual_source_commit` 到 metadata
  - CI / release 构建：commit 不一致直接 fail（保证可复现性）
- 导入范围: `word.json`（61MB, 32万+词语）、`char_detail.json`（13MB, 2万+汉字）、`idiom.json`（24MB, 5万成语）
- **License 义务**: MIT 要求保留 LICENSE 文件。构建脚本需将源数据的 LICENSE 复制到 `resources/data/dict/chinese-dictionary-LICENSE`

### 源数据获取

构建脚本通过环境变量 `CHINESE_DICT_DATA_DIR` 指定源数据路径。
如果未设置，默认为项目根目录下的 `github_repo/chinese-dictionary`。
如果该目录不存在，脚本报错退出并提示用户克隆或设置环境变量。
不使用 git submodule（避免增加 clone 体积）。

**db 不提交 git**。开发者首次 `npm run dev` 前必须先运行 `npm run build:chinese-dict`。
为降低门槛，`npm run dev` 启动脚本中自动检测 `resources/data/dict/chinese_dict.db` 是否存在，
缺失则自动触发 `build:chinese-dict`。**不使用 `postinstall`**（源数据不随仓库提交，新环境 postinstall 会失败）。

主进程 db 状态机：`missing → building → ready | failed`。

| 状态 | 行为 |
|------|------|
| `missing` | dev 模式自动触发构建 → 进入 `building`；prod 模式直接进入 `failed` |
| `building` | IPC `check()` 返回 `{ ready: false, status: 'building' }`，UI 显示"正在构建中文词典" |
| `ready` | 正常查询 |
| `failed` | IPC `check()` 返回 `{ ready: false, status: 'failed' }`，UI 显示"未构建中文词典，请执行 `npm run build:chinese-dict`"（仅 prod 或构建失败时） |

dev 模式不应出现"未构建"提示——自动构建应覆盖绝大多数情况。

## 架构

独立模块、独立 SQLite，与现有 CC-CEDICT（ecdict）完全分离。

### 数据流

```
构建时（npm run build:chinese-dict）:
  $CHINESE_DICT_DATA_DIR/*.json
    → scripts/build_chinese_dict.ts
    → resources/data/dict/chinese_dict.db（直接输出到 resources，不提交 git）
    → 复制 LICENSE 到 resources/data/dict/chinese-dictionary-LICENSE

打包时（npm run dist）:
  electron-builder extraResources 直接包含 resources/data/dict/** → 打包到 resources/data/dict/

运行时:
  渲染进程 chinese_dictionary.ts
    → window.electronAPI.chineseDict.lookup(text)
    → IPC → 主进程 chinese_dict/index.ts
    → 查询 chinese_dict.db（双路径加载，见下文）
    → 返回 DictResult
```

### 路径契约

构建脚本**直接输出到 `resources/data/dict/chinese_dict.db`**，不经过中间的 `data/` 目录。
打包时 `electron-builder.yml` 配置 `extraResources` 直接包含该路径：

```yaml
extraResources:
  - from: "resources/data/dict/"
    to: "data/dict/"
```

运行时加载采用双路径策略（同 `find_bundled_cedict` 模式）：

| 模式 | db 路径 |
|------|---------|
| dev（`npm run dev`） | `<project_root>/resources/data/dict/chinese_dict.db` |
| prod（打包后） | `process.resourcesPath + /data/dict/chinese_dict.db` |

`is_ready()` 首次调用时尝试两个路径，成功则缓存路径，后续不再重试。

## SQLite 表结构

数据库文件: `chinese_dict.db`

### metadata 表（版本与元信息）

```sql
CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
-- 写入:
--   schema_version = "1"        （表结构版本，变更时需重建）
--   data_version = "mapull-2026-05"  （数据源版本，便于追溯）
--   source = "mapull/chinese-dictionary"
--   source_commit = "<git hash>"     （源数据 commit，便于追溯）
--   build_time = ISO8601
```

`schema_version` 以 TEXT 存储（metadata.value 列为 TEXT），消费侧 `parseInt` 比较。
表结构变更时递增（如 `"1"` → `"2"`）。`data_version` 为语义化字符串。

### words 表（word.json，32万+条）

```sql
CREATE TABLE words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE,
    pinyin TEXT NOT NULL,
    explanation TEXT NOT NULL
);
CREATE INDEX idx_words_word ON words(word);
```

### characters 表（char_detail.json，2万+条）

```sql
CREATE TABLE characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    char TEXT NOT NULL UNIQUE,
    pinyin TEXT NOT NULL,        -- JSON 数组: ["yī","yí"] 或单元素 ["chē"]
    explanation TEXT NOT NULL,   -- JSON 数组: [{"pinyin":"háng","speech":"名","content":"行列；行业"}, ...]
    speech TEXT,                 -- JSON 数组: ["数","名"] 所有词性汇总
    words TEXT                   -- JSON: [{"word":"一样","text":"同样；没有差别"}]
);
CREATE INDEX idx_characters_char ON characters(char);
```

`explanation` 存 JSON 数组而非合并文本，保持多音字的读音→义项对应关系。
例如"行"：`[{"pinyin":"háng","speech":"名","content":"行列；行业"},{"pinyin":"xíng","speech":"动","content":"行走"}]`。
渲染层按读音分组展示。FTS 索引基于 explanation 的纯文本内容。

### idioms 表（idiom.json，5万条）

```sql
CREATE TABLE idioms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE,
    pinyin TEXT NOT NULL,
    explanation TEXT NOT NULL,
    source TEXT,       -- JSON: {"text":"...","book":"..."}
    example TEXT,
    similar TEXT,      -- JSON 数组
    opposite TEXT      -- JSON 数组
);
CREATE INDEX idx_idioms_word ON idioms(word);
```

### FTS5 全文搜索

```sql
CREATE VIRTUAL TABLE words_fts USING fts5(word, explanation, content=words, content_rowid=id, tokenize='unicode61');
CREATE VIRTUAL TABLE characters_fts USING fts5(char, explanation, content=characters, content_rowid=id, tokenize='unicode61');
```

使用 `unicode61` tokenizer（SQLite 默认）。对中文按 codepoint 切分为 unigram，
`MATCH '莫名其*'` 会匹配"莫名其妙"（前 3 个 unigram 匹配）。
`tokenize='trigram'`（SQLite 3.34+）对短前缀更友好，但对 32 万行的 words 表会增加索引体积。
选择 `unicode61` 并在测试中严格验证三个验收词的命中行为，不扩大承诺。
能力定义为"前缀 / FTS 辅助召回 + exact 优先"，不等价于中文子串搜索。
若验收词测试失败，fallback 方案：`LIKE '词%'` 或 `tokenize='trigram'`（需评估索引体积）。

构建脚本在所有数据插入完成后执行 FTS rebuild:
```sql
INSERT INTO words_fts(words_fts) VALUES('rebuild');
INSERT INTO characters_fts(characters_fts) VALUES('rebuild');
```

## 构建脚本

`scripts/build_chinese_dict.ts`:

1. 读取 `$CHINESE_DICT_DATA_DIR` 或默认 `github_repo/chinese-dictionary` 下的 JSON 文件
2. 校验源文件存在性（word.json、char_detail.json、idiom.json、LICENSE），任一缺失则 fail fast
3. 校验 JSON schema（必填字段存在、类型正确），异常字段记录并 fail fast
4. 只提取需要的字段，丢弃 story、spelling、detail 等冗余数据
5. 对 word、pinyin、explanation 设长度上限（如 word ≤ 100 字符，explanation ≤ 10000 字符），超限记录警告
6. 用 better-sqlite3 创建 SQLite，**所有写入使用 prepared statements**
7. 源 JSON 合计 ~100MB，直接 `JSON.parse` 内存峰值高。实现时分文件串行 parse → insert → GC，
   或使用流式 JSON 解析（如 `stream-json`）。WSL / CI 小内存环境需关注。
7. 执行 FTS rebuild
8. 写入 metadata（schema_version、data_version、source、source_commit、build_time）
9. 复制 LICENSE 到 `resources/data/dict/chinese-dictionary-LICENSE`
10. 输出到 `resources/data/dict/chinese_dict.db`
11. 校验输出 db 体积：> 100MB → warn；> 150MB → 构建失败

### char_detail.json 展平规则

- `pronunciations[].pinyin` → 存为 JSON 数组（如 `["chē","jū"]`），保持结构化
- `pronunciations[].explanations` → 每个义项保留 `{pinyin, speech, content}`，存为 JSON 数组
- `speech` 字段 → 所有读音的词性去重汇总为 JSON 数组（如 `["名","动"]`）
- `pronunciations[].explanations[].words` → 取第一个有 words 的义项，JSON 序列化
- 多音字信息完整保留，渲染层按读音分组展示

## 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `scripts/build_chinese_dict.ts` | 新增 | 构建脚本：JSON → SQLite |
| `electron/chinese_dict/index.ts` | 新增 | 主进程：SQLite 查询逻辑 |
| `electron/ipc/chinese_dict_handlers.ts` | 新增 | IPC handlers |
| `electron/preload.ts` | 修改 | 增加 `chineseDict` IPC bridge |
| `src/services/chinese_dictionary.ts` | 重写 | 从硬编码改为走 IPC |
| `electron/main.ts` | 修改 | 注册 IPC handlers |
| `electron-builder.yml` | 修改 | 添加 `extraResources` 配置 |
| `package.json` | 修改 | 增加 `build:chinese-dict` 脚本 |
| `.gitignore` | 修改 | 忽略 `resources/data/dict/chinese_dict.db`、`*.db-shm`、`*.db-wal` |

### extraResources 配置

```yaml
extraResources:
  - from: "resources/data/dict/"
    to: "data/dict/"
    filter:
      - "**/*.db"
      - "**/chinese-dictionary-LICENSE"
      - "!**/*.db-shm"
      - "!**/*.db-wal"
```

### shared 类型变更

`electron/preload.ts` 中增加:
```typescript
chineseDict: {
    lookup: (text: string) => Promise<DictResult | null>
    check: () => Promise<{ ready: boolean; entry_count: number }>
    reload: () => Promise<{ success: boolean }>
}
```

命名约定：主进程内部函数/变量用 `snake_case`（CLAUDE.md 规范），preload contextBridge 暴露用 `camelCase`（JavaScript API 惯例）。

### 文件清单补充

- `shared/types/service.ts`：本期 DictResult 类型**不修改**，idiom_meta 扩展留到 FUTURE
- `detect.local` bridge 类型声明在 `electron/preload.ts` 内部（contextBridge），不单独放 shared/
- `detect_local()` 返回值增加 `source: 'cld3' | 'regex'` 字段，便于测试和日志判断

### 安全约束

- IPC 不允许渲染进程传入 db 路径或源数据路径（路径由主进程硬编码）
- cld3-asm Apache-2.0 要求保留 NOTICE 文件，构建时需确认 `node_modules/cld3-asm/NOTICE` 存在

## 查询策略

### chinese_dictionary.ts 查询流程

```
输入文本 → 判断是否中文 → 非中文返回空

单字（1个字符）:
  1. 查 characters 表精确匹配
  2. 未找到 → 查 words 表精确匹配

词语（2+字符）:
  1. 查 words 表精确匹配（词语库 32万+ 覆盖最广）
  2. 未找到 → 查 idioms 表精确匹配（成语库有更丰富的出处/近反义词）
  3. 未找到 → 查 words_fts 模糊匹配（前缀），取 top 5
```

模糊匹配使用 FTS5 MATCH 前缀语法：`SELECT * FROM words_fts WHERE word MATCH '词*' LIMIT 5`。
不使用 LIKE（LIKE 无法利用 FTS5 索引，性能差）。

**FTS 查询转义**：用户输入直接拼接到 FTS MATCH 可能被特殊字符破坏语法。
清洗规则：
1. strip 所有非白名单字符（只保留中文、字母、数字、空白）
2. 主进程在末尾追加 `*` 形成前缀查询
3. 用户输入不含 `*`（已 strip），前缀 `*` 由主进程统一追加
4. 空输入、超长输入（>100 字符）直接返回空
5. exact 查询用普通参数绑定，不做 FTS 拼接

### idiom 二次查询说明

words 表已包含所有 idiom 词条（word.json 是超集）。idioms 表的价值在于额外字段（source、similar、opposite）。
**当前实现不做 words→idioms 二次查询**，因为 DictResult 暂不映射这些额外字段。
idioms 表仅作为独立查询入口（用户直接输入成语时命中）。
后续如需展示出处/近反义词，再扩展 DictResult 类型并添加二次查询。

> **FUTURE**: 扩展 `DictResult` 增加 `idiom_meta?: { source, similar, opposite }` 时，
> 再实现 words→idioms 二次查询。届时文件清单需增加 `shared/types/service.ts` 的 DictResult 修改。

### DictResult 映射

```
pronunciations: [{ region: '普通话', phonetic: pinyin }]
definitions: [{ partOfSpeech: speech, meanings: [explanation] }]
examples: [{ source: example, target: '' }]  // 仅当有 example 时
```

characters 表的 `explanation` 为 JSON 数组（含多音字分组），映射伪代码：

```typescript
// 主进程 chinese_dict_handlers.ts 中
function to_dict_result_char(row: CharacterRow): DictResult {
    const explanations = JSON.parse(row.explanation) as { pinyin: string; speech: string; content: string }[]
    const pinyins = JSON.parse(row.pinyin) as string[]

    // 单音字：一个 definition
    // 多音字：按 pinyin 分组，每个读音一个 definition
    const grouped = group_by(explanations, e => e.pinyin)
    const definitions = Object.entries(grouped).map(([py, items]) => ({
        partOfSpeech: items.map(i => i.speech).join('、'),
        meanings: items.map(i => i.content),
    }))

    return {
        type: 'dict',
        pronunciations: pinyins.map(p => ({ region: '普通话', phonetic: p })),
        definitions,
        examples: [],
    }
}
```

单音字产出 1 个 definition，多音字产出 N 个 definition（按读音分组）。

**映射归属：主进程 `chinese_dict_handlers.ts`**。
IPC 返回的已经是完整 `DictResult`，渲染层直接使用，不做 JSON.parse 或二次分组。
避免搜索框、悬浮窗、历史回放各自实现一遍分组逻辑。

## 错误处理

| 场景 | 处理 |
|------|------|
| db 文件缺失 | `is_ready()` 返回 false，`lookup()` 返回空，服务降级为不可用 |
| db 文件损坏（SQLite 打开失败） | 捕获异常，log.error，`is_ready()` 返回 false，缓存失败状态避免重复重试 |
| db schema 版本不匹配 | dev: 自动 rebuild（schema_version 低于期望时触发）；prod: log.error 服务降级（db 为 bundled 资源，用户无构建环境） |
| 查询异常（SQL/schema 错误） | 捕获异常，log.error，`is_ready()` 置 false，后续调用直接返回空（不伪装为"无命中"） |
| 查询无命中 | 返回空结果（正常业务） |

### 失败缓存与热加载

`is_ready()` 失败缓存为 in-memory 状态（进程级）。
提供 `dict:reload` IPC，用户重新构建 db 后可通过 UI 触发重新打开，无需重启应用。
开发模式下也可监听 `resources/data/dict/chinese_dict.db` 的文件 mtime 变化自动触发 reload。
使用 `fs.watch` + debounce 500ms，仅 dev 且 `dict.chinese_enabled=true` 时启用。
`dict:reload` IPC 关闭旧连接、清空 prepared statement、重开 db，无路径参数（避免路径滥用）。

## 测试计划

### 构建脚本测试

- 验证 JSON → SQLite 字段映射正确（抽样检查 10 个词条）
- 验证 UNIQUE 约束不报重复错误
- 验证 FTS rebuild 后可模糊查询（验收词见下表）
- 验证 metadata 写入正确（schema_version、data_version、source_commit）
- 验证 LICENSE 缺失时构建脚本 fail fast
- 验证源 JSON 字段缺失时构建脚本 fail fast
- 验证 `explanation` JSON 数组结构正确（多音字保持分组）
- 验证源 commit 与 pinned hash 不一致时：dev warn + CI fail
- 验证 `dict:reload` 后旧连接关闭，新 db 可查

### FTS 模糊查询验收词

| 输入 | 期望结果 |
|------|----------|
| "莫名其" | 命中"莫名其妙" |
| "一帆风" | 命中"一帆风顺" |
| "学而" | 命中"学而时习之"等相关 |

### 查询测试

| 用例 | 输入 | 期望 |
|------|------|------|
| 常用词语 | "学习" | words 表命中，返回拼音+释义 |
| 成语 | "一帆风顺" | idioms 表命中，返回拼音+释义 |
| 单字 | "车" | characters 表命中，返回拼音+释义+组词 |
| 多音字 | "行" | characters 表命中，explanation JSON 含 háng/xíng 两个分组 |
| 非中文 | "asdkjh" | 返回空 |
| 未命中 | "䶮䶮䶮" | 中文但不在数据库，返回空 |
| 模糊匹配 | "莫名其" | words_fts MATCH 返回"莫名其妙" |
| 边界：超长输入 | "学" × 200 | 截断或返回空（>100 字符不做查询） |
| 边界：含标点 | "你好，世界" | 正常查询"你好"（去除标点） |
| 边界：空字符串 | "" | 返回空 |
| 边界：纯空白 | "   " | 返回空 |

### IPC 测试

- 验证 `chineseDict.lookup` 正确传递到主进程并返回 DictResult
- 验证 `chineseDict.check` 返回正确状态
- 验证 db 不可用时 lookup 返回 null
- 验证 dev 与 packaged 两种资源路径都能正确加载 db
- 验证 db 重新构建后通过 `dict:reload` IPC 热加载，无需重启
- 验证 `dict.chinese_enabled=false` 时 IPC 短路返回 null
- 验证 FTS 查询特殊字符输入不抛异常
- 验证 FTS 中文分词：`MATCH '莫名其*'` 命中"莫名其妙"（需实证，非理论推断）
- 验证 FTS 全角标点输入（如"你好，世界！"）不抛异常
- 验证 cld3 初始化耗时 < 500ms（防依赖升级回归）
- CI 验证 db 体积 ≤ 100MB
- 三平台冒烟：dist 后 Windows/macOS/Linux 各跑 `chineseDict.lookup()` + `detect.local()`

## 性能预期

- 查询延迟：精确匹配 < 1ms，FTS 前缀 < 5ms（本地 SSD）
- 首次加载：SQLite 文件打开 + WAL 模式设置 < 50ms
- 冷启动首次查询：含 db 初始化 < 100ms
- FTS 结果上限：`LIMIT 5`，避免大结果集
- 并发 lookup：SQLite WAL 模式支持并发读，不阻塞
- db 失败缓存：`is_ready()` 首次失败后缓存状态，后续 lookup 直接返回空，不重复打开
- 打包体积增加：需实际构建后测量（JSON 原始 98MB，去字段 + SQLite 压缩后预估 50-80MB）
- **体积硬约束**：构建脚本输出 db 体积 > 100MB → warn；> 150MB → 构建失败
- `package.json` 增 `analyze:bundle-size` 任务，CI 跑一次验证
- 构建脚本对 `explanation` 文本压缩：剥离冗余空白、合并重复内容

---

## 二、本地语言检测替换

> 关联: PLAN.md "本地语言检测替换"
> 对比文档: `docs/external_services/language_detection_comparison.md`

### 目标

将 `src/services/detect.ts` 的 `detect_local()` 从 Unicode 正则匹配替换为 cld3-asm（Google Compact Language Detector v3 WASM），提升拉丁字母系语言的识别准确率。

### 现状问题

当前 `detect_local()` 使用 Unicode 字符范围正则，只能区分不同字符系统（中日韩俄泰阿拉伯等），拉丁字母系语言（英法德西意葡土等）全部 fallback 到 `en`。基准测试准确率仅 46.7%。

### 方案选择

| 方案 | 准确率 | 速度（短/长） | 体积 | 依赖 |
|------|--------|---------------|------|------|
| 当前 regex | 46.7% | ~0ms | 0 | 无 |
| franc（trigram） | 66.7% | 0.24ms / 3.6ms | ~236KB | 纯 JS |
| **cld3-asm（推荐）** | **73.3%** | **0.10ms / 0.44ms** | ~2MB WASM | WASM |
| lingua-rs | ~99.7% | 最慢 | ~288MB | 需自行编译 |

**选择 cld3-asm**：准确率最高、速度最快、有现成 npm 包。不引入 franc，保持依赖简单：cld3 不可用时直接 fallback 到 regex。

### 架构

```
detect_local(text) →
  1. 尝试 cld3-asm 检测（主进程加载 WASM，通过 IPC 调用）
  2. cld3 不可用（WASM 未加载）→ fallback 到 regex
  3. cld3 返回 BCP-47 代码 → 映射到 LanguageCode
  4. cld3 返回 isReliable=false → fallback 到 regex
```

WASM 在**主进程**加载（Node 环境，无 CSP 限制），渲染进程通过 IPC 调用。
不放在渲染进程：避免 2MB WASM 影响首屏加载、避免渲染进程沙盒对 WASM 的限制。

### WASM 状态机

主进程维护 `wasm_state: 'loading' | 'ready' | 'failed'`。

```
app.whenReady() → 异步 loadModule()
  成功 → state = 'ready'
  失败 → state = 'failed'，log.error（仅记录一次，后续不重复刷日志）

detect:local IPC 收到请求:
  state = 'ready'   → 调用 cld3 检测
  state = 'loading' → 直接走 regex fallback（不阻塞翻译热路径）
  state = 'failed'  → 直接走 regex fallback
```

loading 期间不阻塞、不等待。翻译热路径优先级高于检测精度。

### 置信度阈值

cld3 返回 `is_reliable`（布尔）和 `proportion`（0-1）。
- `is_reliable=true` → 采纳检测结果
- `is_reliable=false` → fallback 到 regex（短文本如 "Hi" 置信度低时不应硬采纳）

### 集成步骤

1. **Spike 验证**：先做最小集成——dev + build + dist 环境各调用一次 `detect_local()`，确认 cld3-asm 与 Electron 39 / Vite 兼容
2. `npm install cld3-asm`
2. 在主进程添加 `detect_cld3()` 函数，使用 `loadModule()` 初始化 WASM
3. `app.whenReady()` 后异步预加载 WASM factory，失败不阻塞应用启动（log.error + 标记不可用）
4. 添加 BCP-47 → 项目 `LanguageCode` 映射表
5. 修改 `detect_local()` 优先使用 cld3，regex 作为 fallback
6. IPC：新增 `detect:local` handler，渲染进程 `detect.ts` 通过 IPC 调用主进程检测

### 映射表

覆盖项目 `LanguageCode` 支持的所有语言。cld3 支持 100+ 语言，以下为项目已支持的映射：

| BCP-47 | LanguageCode | 说明 |
|--------|-------------|------|
| zh | zh_cn | 简体中文（默认） |
| zh-Hant | zh_tw | 繁体中文（近似映射：cld3 仅基于字符集判定，可能是港台繁体） |
| ja | ja | 日语 |
| ko | ko | 韩语 |
| en | en | 英语 |
| fr | fr | 法语 |
| de | de | 德语 |
| es | es | 西班牙语 |
| it | it | 意大利语 |
| pt | pt | 葡萄牙语 |
| nl | nl | 荷兰语 |
| tr | tr | 土耳其语 |
| ru | ru | 俄语 |
| ar | ar | 阿拉伯语 |
| hi | hi | 印地语 |
| th | th | 泰语 |
| sv | en | 瑞典语（项目不支持，fallback en） |
| da | en | 丹麦语（同上） |
| fi | en | 芬兰语（同上） |
| pl | en | 波兰语（同上） |
| cs | en | 捷克语（同上） |

未映射的 BCP-47 代码：log.warn 记录，**与 regex 结果比对取更优者**。
- regex 能区分字符系统（如越南语用拉丁扩展字符，regex 可能识别为非 en）→ 用 regex 结果
- regex 也无法区分（纯 ASCII 拉丁文）→ 返回 `en` 并记录，承认这部分回退
- 不默认 `en`，避免把 cld3 已准确识别的越南语/印尼语等误判为英文

### 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/detect.ts` | 修改 | `detect_local()` 改为通过 IPC 调用主进程 cld3 |
| `electron/detect/index.ts` | 新增 | 主进程：cld3 WASM 加载 + 检测逻辑 |
| `electron/ipc/detect_handlers.ts` | 新增 | IPC handler: `detect:local` |
| `electron/preload.ts` | 修改 | 增加 `detect.local` IPC bridge |
| `electron/main.ts` | 修改 | 注册 detect IPC handlers，`whenReady()` 后预加载 WASM |
| `package.json` | 修改 | 增加 `cld3-asm` 依赖 |

### 风险

| 风险 | 缓解 |
|------|------|
| WASM 在 Electron 主进程加载失败 | regex fallback，log.warn（仅记录一次） |
| `cld3-asm` 包较老（最后发版 2022 年） | 先在 dev 环境验证 Node/Electron 兼容性；Electron 39 + Node 22 的 WASM ABI 兼容性需实测 |
| WASM 文件打包问题 | `emscripten-wasm-loader` 从 node_modules 自动加载，无需额外打包 |
| 首次加载延迟 | `app.whenReady()` 后异步预加载，不阻塞窗口创建 |
| zh-Hant 映射不精确 | 近似映射，可接受（项目无 zh_hk 区分） |
| better-sqlite3 native rebuild 失败 | 复用已验证的 ecdict 打包路径，同版本 prebuilt binary |

### 测试计划

使用 `docs/external_services/language_detection_comparison.md` 中的 15 种语言 × 2 种长度（短/长）共 30 个用例：

- 验证 cld3 准确率 ≥ 73.3%
- 验证 regex fallback 正常工作（模拟 WASM 加载失败）
- 验证 fallback 时整体准确率不低于当前 46.7%（不退化）
- 验证 `is_reliable=false` 时正确 fallback 到 regex
- 验证 BCP-47 映射表覆盖所有目标语言
- 验证 app 启动时 WASM 预加载不阻塞 UI
- 验证非拉丁语言（中日韩俄泰阿）检测不受影响
- 验证 IPC `detect:local` 端到端调用正确
- 验证 WASM 加载中（state=loading）触发翻译时走 regex，不阻塞
- 验证 cld3 初始化失败时 warning 只记录一次
- 验证 `detect.cld3_enabled=false` 时 IPC 直接走 regex
- 验证短文本（≤ 5 字符，如 "Hi"）`is_reliable=false` 时正确 fallback 到 regex
- 三平台冒烟：dist 后 Windows/macOS/Linux 各跑 `detect.local()` 一次

---

## 三、跨节事项

### 第三方依赖与 LICENSE 披露

| 依赖 | License | 披露方式 |
|------|---------|----------|
| mapull/chinese-dictionary | MIT | 构建脚本复制 LICENSE 到 `resources/data/dict/`，应用"关于"窗口展示 |
| cld3-asm | Apache-2.0 | `package.json` 依赖，npm 自动管理 |

应用"关于"窗口需展示第三方 LICENSE 信息（后续 UI 任务，不在本 spec 范围）。

### 回滚方案

两个功能均通过配置项可运行时关闭，不需重新发版：

| 功能 | 配置项 | 默认值 | 关闭行为 |
|------|--------|--------|----------|
| 中文字典 | `dict.chinese_enabled` | true | IPC 短路返回 null，UI 不渲染该来源；db 文件仍在磁盘，不删除；重新打开无需重启（热生效） |
| cld3 语言检测 | `detect.cld3_enabled` | true | `detect:local` IPC 直接走 regex，不尝试 cld3；WASM 若已加载则保持，不主动卸载 |

配置项通过现有 config 系统管理，用户可在设置界面切换。切换立即生效，无需重启。
