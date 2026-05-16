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
    → data/chinese_dict.db（构建产物，不提交 git）
    → 复制 LICENSE 到 resources/data/dict/

打包时（npm run dist）:
  data/chinese_dict.db → 复制到 resources/data/dict/chinese_dict.db
  （由 electron-builder extraResources 或 electron-vite copy 配置完成）

运行时:
  渲染进程 chinese_dictionary.ts
    → window.electronAPI.chineseDict.lookup(text)
    → IPC → 主进程 chinese_dict/index.ts
    → 查询 chinese_dict.db（从 process.resourcesPath/data/dict/ 加载）
    → 返回 DictResult
```

### 打包链路

`electron-vite` 的 `resolve.alias` 或 `electron-builder` 的 `extraResources` 配置中，
将 `data/chinese_dict.db` 复制到打包产物的 `resources/data/dict/` 目录。
主进程启动时从 `process.resourcesPath` 读取（同 CC-CEDICT 的 `find_bundled_cedict` 模式）。

## SQLite 表结构

数据库文件: `chinese_dict.db`

### metadata 表（版本与元信息）

```sql
CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
-- 写入: version=1, source=mapull/chinese-dictionary, build_time=ISO8601
```

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
    explanation TEXT NOT NULL,   -- 所有义项合并
    speech TEXT,                 -- JSON 数组: ["数","名"] 按读音分组
    words TEXT                   -- JSON: [{"word":"一样","text":"同样；没有差别"}]
);
CREATE INDEX idx_characters_char ON characters(char);
```

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
2. 只提取需要的字段，丢弃 story、spelling、detail 等冗余数据
3. 用 better-sqlite3 创建 SQLite 并写入
4. 执行 FTS rebuild
5. 写入 metadata（version、source、build_time）
6. 输出到 `data/chinese_dict.db`

### char_detail.json 展平规则

- `pronunciations[].pinyin` → 存为 JSON 数组（如 `["chē","jū"]`），保持结构化
- `pronunciations[].explanations[].content` → 合并所有读音、所有义项为一段文字，用分号分隔
- `pronunciations[].explanations[].speech` → 存为 JSON 数组，按读音分组（如 `["名","动"]`）
- `pronunciations[].explanations[].words` → 取第一个有 words 的义项，JSON 序列化
- 多音字信息完整保留，渲染层决定如何展示

## 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `scripts/build_chinese_dict.ts` | 新增 | 构建脚本：JSON → SQLite |
| `electron/chinese_dict/index.ts` | 新增 | 主进程：SQLite 查询逻辑 |
| `electron/ipc/chinese_dict_handlers.ts` | 新增 | IPC handlers |
| `electron/preload.ts` | 修改 | 增加 `chineseDict` IPC bridge |
| `src/services/chinese_dictionary.ts` | 重写 | 从硬编码改为走 IPC |
| `electron/main.ts` | 修改 | 注册 IPC handlers |
| `electron/vite.config.ts` 或 `electron-builder.yml` | 修改 | 添加 db 文件复制到 resources 的配置 |
| `package.json` | 修改 | 增加 `build:chinese-dict` 脚本 |
| `.gitignore` | 修改 | 忽略 `data/chinese_dict.db`（构建产物） |

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
  1. 查 words 表精确匹配（词语库 32万+ 覆盖最广，包含成语）
  2. 未找到 → 查 idioms 表精确匹配（成语库有更丰富的出处/故事/近反义词）
  3. 未找到 → 查 words_fts 模糊匹配（前缀或 LIKE），取 top 5
```

先查 words 再查 idioms 的原因：word.json 已包含所有 idioms，words 精确匹配更快且覆盖更广。
idioms 表的价值在于其额外字段（source、story、similar、opposite），只在 words 命中后做二次查询获取丰富数据。

### DictResult 映射

```
pronunciations: [{ region: '普通话', phonetic: pinyin }]
definitions: [{ partOfSpeech: speech, meanings: [explanation] }]
examples: [{ source: example, target: '' }]  // 仅当有 example 时
```

idiom 表的额外数据（source、similar、opposite）暂不映射到 DictResult，
后续可扩展 DictResult 类型或在 UI 层直接展示。

## 错误处理

| 场景 | 处理 |
|------|------|
| db 文件缺失 | `is_ready()` 返回 false，`lookup()` 返回空，服务降级为不可用 |
| db 文件损坏（SQLite 打开失败） | 捕获异常，log.error，`is_ready()` 返回 false |
| db 版本不匹配（metadata.version 变化） | 删除旧 db，提示用户重新构建 |
| 查询超时/异常 | 捕获异常，返回空结果，不阻塞其他服务 |

## 测试计划

### 构建脚本测试

- 验证 JSON → SQLite 字段映射正确（抽样检查 10 个词条）
- 验证 UNIQUE 约束不报重复错误
- 验证 FTS rebuild 后可模糊查询
- 验证 metadata 写入正确

### 查询测试

| 用例 | 输入 | 期望 |
|------|------|------|
| 常用词语 | "学习" | words 表命中，返回拼音+释义 |
| 成语 | "一帆风顺" | words 命中 → idioms 二次查询获取出处 |
| 单字 | "车" | characters 表命中，返回拼音+释义+组词 |
| 多音字 | "行" | characters 表命中，pinyin 包含 ["háng","xíng"] |
| 未命中 | "asdkjh" | 非中文，返回空 |
| 未命中 | "䶮䶮䶮" | 中文但不在数据库，返回空 |
| 模糊匹配 | "莫名其" | words_fts 返回"莫名其妙"等相关词 |

### IPC 测试

- 验证 `chineseDict.lookup` 正确传递到主进程并返回 DictResult
- 验证 `chineseDict.check` 返回正确状态
- 验证 db 不可用时 lookup 返回 null

## 性能预期

- 查询延迟：精确匹配 < 1ms，FTS 模糊 < 5ms（本地 SSD）
- 首次加载：SQLite 文件打开 + WAL 模式设置 < 50ms
- 打包体积增加：需实际构建后测量（预估 30-40MB，待验证）

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

**选择 cld3-asm**：准确率最高、速度最快、有现成 npm 包。franc 作为 WASM 加载失败时的 fallback。

### 架构

```
detect_local(text) →
  1. 尝试 cld3-asm 检测
  2. cld3 不可用（WASM 未加载）→ fallback 到 regex
  3. cld3 返回 BCP-47 代码 → 映射到 LanguageCode
```

### 集成步骤

1. `npm install cld3-asm`
2. 添加 `detect_cld3()` 函数，使用 `loadModule()` 初始化 WASM
3. 添加 BCP-47 → 项目 `LanguageCode` 映射表（如 `zh` → `zh_cn`、`zh-Hant` → `zh_tw`、`ja` → `ja`、`ko` → `ko`）
4. 修改 `detect_local()` 优先使用 cld3，regex 作为 fallback
5. 处理 WASM 初始化：在 app 启动时预加载 factory，避免首次检测延迟

### 映射表

| BCP-47 | LanguageCode | 说明 |
|--------|-------------|------|
| zh | zh_cn | 简体中文（默认） |
| zh-Hant | zh_tw | 繁体中文 |
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

未匹配的 BCP-47 代码 fallback 到 regex 结果。

### 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/detect.ts` | 修改 | 添加 `detect_cld3()`，修改 `detect_local()` 优先级 |
| `package.json` | 修改 | 增加 `cld3-asm` 依赖 |

### 风险

| 风险 | 缓解 |
|------|------|
| WASM 在 Electron 中加载失败 | regex fallback，日志警告 |
| `cld3-asm` 包较老，Node/Electron 兼容性 | 先在 dev 环境验证 |
| WASM 文件打包问题 | `emscripten-wasm-loader` 自动处理 |
| 首次加载延迟 | app 启动时异步预加载 |

### 测试计划

使用 `docs/external_services/language_detection_comparison.md` 中的 15 种语言 × 2 种长度（短/长）共 30 个用例：

- 验证 cld3 准确率 ≥ 73.3%
- 验证 regex fallback 正常工作（模拟 WASM 加载失败）
- 验证 BCP-47 映射表覆盖所有目标语言
- 验证 app 启动时 WASM 预加载不阻塞 UI
- 验证非拉丁语言（中日韩俄泰阿）检测不受影响
