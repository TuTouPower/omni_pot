# API 测试结果待办

## 已完成

- [x] Bing Translate 修复 — `src/services/bing.ts` token 正则 + key 字段已修复
- [x] 全部 22 个 API 测试完成 — 结果见 `docs/external_services/api_test_results.md`

## 需要新增

- [ ] **MyMemory 翻译服务** — `src/services/mymemory.ts`
  - 免费无需 key，独立翻译引擎，5000 字符/天
  - `GET https://api.mymemory.translated.net/get?q={text}&langpair={from}|{to}`
  - 返回 `responseData.translatedText`

- [ ] **dictionaryapi.dev 词典服务** — `src/services/free_dictionary.ts`
  - 免费无需 key，英文词典首选
  - `GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}`
  - 返回音标、词性、释义、例句、发音音频

- [ ] **CC-CEDICT 离线词典** — 替换 `src/services/ecdict.ts`
  - 下载 CC-CEDICT 数据导入 SQLite（better-sqlite3）
  - 约 30MB 磁盘，< 5MB 内存，微秒级查询
  - 查英文→中文释义，查中文→英文释义

## 需要移除/标记不可用

- [ ] **Yandex Translate** — `src/services/yandex.ts` — 403 免费端点已关闭
- [ ] **Bing Dictionary** — `src/services/bing_dict.ts` — API 403 服务已停用

## 验证方式

- 每个 API 新增后运行对应服务的 `testConfig()` 验证连通性
- CC-CEDICT 验证：查 "hello" 返回中文释义，查 "你好" 返回英文释义
