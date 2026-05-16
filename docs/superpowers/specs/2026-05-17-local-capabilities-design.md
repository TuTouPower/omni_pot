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
- 导入范围: `word.json`（61MB, 32万+词语）、`char_detail.json`（13MB, 2万+汉字）、`idiom.json`（24MB, 5万成语）
- **License 义务**: MIT 要求保留 LICENSE 文件。构建脚本需将源数据的 LICENSE 复制到 `resources/data/dict/chinese-dictionary-LICENSE`

### 源数据获取

构建脚本通过环境变量 `CHINESE_DICT_DATA_DIR` 指定源数据路径。
如果未设置，默认为项目根目录下的 `github_repo/chinese-dictionary`。
如果该目录不存在，脚本报错退出并提示用户克隆或设置环境变量。
不使用 git submodule（避免增加 clone 体积）。

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

`schema_version` 为 INTEGER，表结构变更时递增。`data_version` 为语义化字符串。

### words 表（word.json，32万+条）

```sql
CREATE TABLE words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE,
    pinyin TEXT NOT NULL,
    abbr TEXT NOT NULL,
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
    abbr TEXT NOT NULL,
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
CREATE VIRTUAL TABLE words_fts USING fts5(word, explanation, content=words, content_rowid=id);
CREATE VIRTUAL TABLE characters_fts USING fts5(char, explanation, content=characters, content_rowid=id);
```

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
7. 执行 FTS rebuild
8. 写入 metadata（schema_version、data_version、source、source_commit、build_time）
9. 复制 LICENSE 到 `resources/data/dict/chinese-dictionary-LICENSE`
10. 输出到 `resources/data/dict/chinese_dict.db`

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
| `.gitignore` | 修改 | 忽略 `resources/data/dict/chinese_dict.db` 和 `resources/data/dict/chinese-dictionary-LICENSE` |

### shared 类型变更

`electron/preload.ts` 中增加:
```typescript
chineseDict: {
    lookup: (text: string) => Promise<DictResult | null>
    check: () => Promise<{ ready: boolean; entry_count: number }>
}
```

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

### idiom 二次查询说明

words 表已包含所有 idiom 词条（word.json 是超集）。idioms 表的价值在于额外字段（source、similar、opposite）。
**当前实现不做 words→idioms 二次查询**，因为 DictResult 暂不映射这些额外字段。
idioms 表仅作为独立查询入口（用户直接输入成语时命中）。
后续如需展示出处/近反义词，再扩展 DictResult 类型并添加二次查询。

### `abbr` 字段

words/idioms 表保留 `abbr` 字段（拼音缩写），可用于按首字母缩写搜索的扩展场景。
当前查询不使用，但保留以备后续 UI 搜索框的首字母筛选功能。

### DictResult 映射

```
pronunciations: [{ region: '普通话', phonetic: pinyin }]
definitions: [{ partOfSpeech: speech, meanings: [explanation] }]
examples: [{ source: example, target: '' }]  // 仅当有 example 时
```

characters 表的 `explanation` 为 JSON 数组（含多音字分组），映射时：
- 单音字：直接取 `content` 作为 meanings
- 多音字：按读音分组，每个读音一个 definition 条目

## 错误处理

| 场景 | 处理 |
|------|------|
| db 文件缺失 | `is_ready()` 返回 false，`lookup()` 返回空，服务降级为不可用 |
| db 文件损坏（SQLite 打开失败） | 捕获异常，log.error，`is_ready()` 返回 false，缓存失败状态避免重复重试 |
| db schema 版本不匹配 | dev: log.error 提示重跑 `build:chinese-dict`；prod: log.error 服务降级（db 是 bundled 资源，用户无构建环境） |
| 查询异常 | 捕获异常，返回空结果，不阻塞其他服务 |

## 测试计划

### 构建脚本测试

- 验证 JSON → SQLite 字段映射正确（抽样检查 10 个词条）
- 验证 UNIQUE 约束不报重复错误
- 验证 FTS rebuild 后可模糊查询（验收词见下表）
- 验证 metadata 写入正确（schema_version、data_version、source_commit）
- 验证 LICENSE 缺失时构建脚本 fail fast
- 验证源 JSON 字段缺失时构建脚本 fail fast
- 验证 `explanation` JSON 数组结构正确（多音字保持分组）

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

## 性能预期

- 查询延迟：精确匹配 < 1ms，FTS 前缀 < 5ms（本地 SSD）
- 首次加载：SQLite 文件打开 + WAL 模式设置 < 50ms
- 冷启动首次查询：含 db 初始化 < 100ms
- FTS 结果上限：`LIMIT 5`，避免大结果集
- 并发 lookup：SQLite WAL 模式支持并发读，不阻塞
- db 失败缓存：`is_ready()` 首次失败后缓存状态，后续 lookup 直接返回空，不重复打开
- 打包体积增加：需实际构建后测量（JSON 原始 98MB，去字段 + SQLite 压缩后预估 50-80MB）

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

### 置信度阈值

cld3 返回 `is_reliable`（布尔）和 `proportion`（0-1）。
- `is_reliable=true` → 采纳检测结果
- `is_reliable=false` → fallback 到 regex（短文本如 "Hi" 置信度低时不应硬采纳）

### 集成步骤

1. `npm install cld3-asm`
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

未映射的 BCP-47 代码：log.warn 记录，返回 `en`（不走 regex，因为 regex 只能区分字符系统，对 cld3 已识别的拉丁语言无意义）。

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
| WASM 在 Electron 主进程加载失败 | regex fallback，log.warn |
| `cld3-asm` 包较老（最后发版 2022 年） | 先在 dev 环境验证 Node/Electron 兼容性 |
| WASM 文件打包问题 | `emscripten-wasm-loader` 从 node_modules 自动加载，无需额外打包 |
| 首次加载延迟 | `app.whenReady()` 后异步预加载，不阻塞窗口创建 |
| zh-Hant 映射不精确 | 近似映射，可接受（项目无 zh_hk 区分） |

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
| 中文字典 | `dict.chinese_enabled` | true | 服务降级为不可用，UI 不显示中文词典结果 |
| cld3 语言检测 | `detect.cld3_enabled` | true | fallback 到 regex（当前行为） |

配置项通过现有 config 系统管理，用户可在设置界面切换。
