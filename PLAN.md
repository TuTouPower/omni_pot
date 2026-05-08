# API 测试结果待办

## 已完成

- [x] Bing Translate 修复 — `src/services/bing.ts` token 正则 + key 字段已修复
- [x] 全部 22 个 API 测试完成 — 结果见 `docs/external_services/api_test_results.md`
- [x] **MyMemory 翻译服务** — `src/services/mymemory.ts` ✅ 已验证连通
- [x] **dictionaryapi.dev 词典服务** — `src/services/free_dictionary.ts` ✅ 已验证连通
- [x] **Yandex Translate** — 已不存在，无需移除
- [x] **Bing Dictionary** — 已不存在，无需移除

## 待实现

- [ ] **CC-CEDICT 离线词典** — 需要架构调整
  - `nodeIntegration: false`，renderer 无法使用 `better-sqlite3`
  - 方案：需要 IPC bridge 让 main process 管理 SQLite 查询
  - 或改用 sql.js（WASM SQLite）在 renderer 中运行
  - 约 30MB 磁盘，< 5MB 内存，微秒级查询
  - 查英文→中文释义，查中文→英文释义

- [ ] **选中文本查字典功能** — 字典与翻译分离
  - 用户选中文本后可调用字典 API 查词
  - 字典服务（Cambridge Dict、Free Dictionary、CC-CEDICT）与翻译服务分开配置
  - 需要独立的 `dictionary_service_list` 配置项
  - 需要独立的字典窗口或面板展示 DictResult（音标、词性、释义、例句）
  - 独立快捷键触发字典查询
