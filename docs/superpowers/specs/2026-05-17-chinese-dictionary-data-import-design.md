# 中文字典数据导入与改造设计

> 日期: 2026-05-17
> 状态: 已确认
> 关联: PLAN.md "接入真实中文字典数据源"

---

## 目标

将 `chinese_dictionary.ts` 从 3 个硬编码样例词条改造为接入完整中文词典数据（32万+词语、2万+汉字、5万成语），提供简体中文释义。

## 数据源

**mapull/chinese-dictionary**（MIT License）
- 已克隆至 WSL: `/home/karon/karson_ubuntu/github_repo/chinese-dictionary`
- 导入范围: `word.json`（61MB, 32万+词语）、`char_detail.json`（13MB, 2万+汉字）、`idiom.json`（24MB, 5万成语）

## 架构

独立模块、独立 SQLite，与现有 CC-CEDICT（ecdict）完全分离。

### 数据流

```
构建时:
  github_repo/chinese-dictionary/*.json
    → scripts/build_chinese_dict.ts
    → data/chinese_dict.db
    → 打包进 resources/data/dict/

运行时:
  渲染进程 chinese_dictionary.ts
    → window.electronAPI.chineseDict.lookup(text)
    → IPC → 主进程 chinese_dict/index.ts
    → 查询 chinese_dict.db
    → 返回 DictResult
```

## SQLite 表结构

数据库文件: `chinese_dict.db`（预期 30-40MB）

### words 表（word.json，32万+条）

```sql
CREATE TABLE words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    pinyin TEXT NOT NULL,
    abbr TEXT NOT NULL,
    explanation TEXT NOT NULL
);
CREATE INDEX idx_words_word ON words(word);
CREATE VIRTUAL TABLE words_fts USING fts5(word, explanation, content=words, content_rowid=id);
```

### characters 表（char_detail.json，2万+条）

```sql
CREATE TABLE characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    char TEXT NOT NULL,
    pinyin TEXT NOT NULL,
    explanation TEXT NOT NULL,
    speech TEXT,
    words TEXT
);
CREATE INDEX idx_characters_char ON characters(char);
CREATE VIRTUAL TABLE characters_fts USING fts5(char, explanation, content=characters, content_rowid=id);
```

### idioms 表（idiom.json，5万条）

```sql
CREATE TABLE idioms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    pinyin TEXT NOT NULL,
    abbr TEXT NOT NULL,
    explanation TEXT NOT NULL,
    source TEXT,
    example TEXT,
    similar TEXT,
    opposite TEXT
);
CREATE INDEX idx_idioms_word ON idioms(word);
```

## 构建脚本

`scripts/build_chinese_dict.ts`:

1. 读取 JSON 文件（路径通过参数或环境变量指定，默认 `github_repo/chinese-dictionary`）
2. 只提取需要的字段，丢弃 story、spelling、detail 等冗余数据
3. 用 better-sqlite3 创建 SQLite 并写入
4. 输出到 `data/chinese_dict.db`

char_detail.json 的嵌套结构需要展平：
- `pronunciations[].pinyin` → 拼音（多音字合并为 `yī/yí` 格式）
- `pronunciations[].explanations[].content` → 合并所有义项为一段文字
- `pronunciations[].explanations[].speech` → 词性（取第一个义项的）
- `pronunciations[].explanations[].words` → 相关组词（JSON 序列化）

## 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `scripts/build_chinese_dict.ts` | 新增 | 构建脚本：JSON → SQLite |
| `electron/chinese_dict/index.ts` | 新增 | 主进程：SQLite 查询逻辑 |
| `electron/ipc/chinese_dict_handlers.ts` | 新增 | IPC handlers |
| `electron/preload.ts` | 修改 | 增加 `chineseDict` IPC bridge |
| `src/services/chinese_dictionary.ts` | 重写 | 从硬编码改为走 IPC |
| `electron/main.ts` | 修改 | 注册 IPC handlers + 启动时加载 |
| `package.json` | 修改 | 增加 `build:chinese-dict` 脚本 |
| `.gitignore` | 修改 | 忽略 `data/chinese_dict.db`（构建产物） |

## 查询策略

### chinese_dictionary.ts 查询流程

```
输入文本 → 判断是否中文 → 非中文返回空

单字（1个字符）:
  1. 查 characters 表精确匹配
  2. 未找到 → 查 words 表精确匹配

词语（2+字符）:
  1. 查 idioms 表精确匹配（优先，成语数据更丰富）
  2. 未找到 → 查 words 表精确匹配
  3. 未找到 → 查 characters 表匹配首字（可选，作为回退）
```

### DictResult 映射

```
pronunciations: [{ region: '普通话', phonetic: pinyin }]
definitions: [{ partOfSpeech: speech, meanings: [explanation] }]
examples: [{ source: example, target: '' }]  // 如果有
```

idiom 表的额外数据（source、similar、opposite）暂不映射到 DictResult，
后续可扩展 DictResult 类型或在 UI 层直接展示。

## 预期效果

- 32万+ 词语可查（含成语）
- 2万+ 单字可查（含详细释义、古文引用、组词）
- 5万 成语可查（含出处、例句、近反义词）
- 查询速度：本地 SQLite 毫秒级
- 打包体积增加：约 30-40MB
