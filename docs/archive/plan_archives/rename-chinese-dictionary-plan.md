# 改动方案：Chinese Dictionary 重命名 + free_dictionary 清理

> 分支: rename-chinese-dictionary
> 目标: 统一 Chinese Dictionary 命名，清理废弃的 free_dictionary

---

## 命名规则

| 场景 | 格式 | 示例 |
|---|---|---|
| 文件名/目录名 | snake_case | `chinese_dictionary` |
| 代码标识符 | snake_case | `chinese_dictionary` |
| PascalCase 导出 | ChineseDictionary | `registerChineseDictionaryHandlers` |
| npm script | kebab-case | `build:chinese-dictionary` |
| DB 文件 | snake_case | `chinese_dictionary.db` |
| 日志 scope | kebab-case | `chinese-dictionary` |
| UI 展示名 | 英文 | `Chinese Dictionary` |
| 数据源（外部） | 不改 | `mapull/chinese-dictionary` |

---

## A. 清理 free_dictionary

### A1. 删除文件

| 文件 | 说明 |
|---|---|
| `src/services/free_dictionary.ts` | 服务文件整体删除 |

### A2. 编辑文件

| 文件 | 改动 |
|---|---|
| `src/services/index.ts` | 移除 `import { freeDictionaryService } from './free_dictionary'` 和 `registerAllServices` 中的注册 |
| `shared/types/config.ts` | 移除 `free_dictionary@default` 默认实例 |
| `tests/user_e2e/fixtures/stub_payloads.ts` | 移除所有 free_dictionary 相关导出（`free_dictionary_hello_payload`、`free_dictionary_run_payload`、`free_dictionary_reconcile_payload`、`create_free_dictionary_fetch`、`build_free_dictionary_init_script`） |
| `tests/user_e2e/fixtures/app_fixture.ts` | 移除 free_dictionary import 和 `startDictTestServer` 方法 |
| `tests/user_e2e/pages/translate_page.ts` | 移除 `fulfill_free_dictionary_once` 方法 |
| `tests/user_e2e/specs/dict_window.spec.ts` | 所有 free_dictionary 引用改为 cambridge_dict |
| `tests/user_e2e/specs/dict_card_height.spec.ts` | 同上 |
| `tests/user_e2e/specs/translate_result_cards.spec.ts` | 同上 |
| `tests/user_e2e/specs/external_services.spec.ts` | 移除 freeDictionaryService import |

---

## B. 重命名 chinese_dict → chinese_dictionary

### B1. 文件/目录重命名

| 现有 | 新 |
|---|---|
| `electron/chinese_dictionary/` | `electron/chinese_dictionary/` |
| `electron/chinese_dictionary/index.ts` | `electron/chinese_dictionary/index.ts` |
| `electron/ipc/chinese_dict_handlers.ts` | `electron/ipc/chinese_dictionary_handlers.ts` |
| `scripts/build_chinese_dictionary.ts` | `scripts/build_chinese_dictionary.ts` |
| `tests/integration/chinese_dictionary_build.test.ts` | `tests/integration/chinese_dictionary_build.test.ts` |
| 输出 `chinese_dictionary.db` | `chinese_dictionary.db` |

### B2. 代码标识符改动

| 文件 | 现有 | 新 |
|---|---|---|
| `electron/chinese_dictionary/index.ts` | `close_chinese_dictionary()` | `close_chinese_dictionary()` |
| `electron/chinese_dictionary/index.ts` | `log.scope('chinese-dictionary')` | `log.scope('chinese-dictionary')` |
| `electron/chinese_dictionary/index.ts` | 所有 `'chinese_dictionary.db'` 路径 | `'chinese_dictionary.db'` |
| `electron/ipc/chinese_dictionary_handlers.ts` | `registerChineseDictionaryHandlers` | `registerChineseDictionaryHandlers` |
| `electron/ipc/chinese_dictionary_handlers.ts` | `log.scope('chinese-dictionary-ipc')` | `log.scope('chinese-dictionary-ipc')` |
| `electron/ipc/cn_dict_handlers.ts` | import 路径 `'../chinese_dictionary'` | `'../chinese_dictionary'` |
| `electron/main.ts` | import 路径和函数名跟着改 |
| `electron/main.ts` | 日志 `'build:chinese-dictionary'` | `'build:chinese-dictionary'` |
| IPC channel | `chinese-dictionary:state-changed` | `chinese-dictionary:state-changed` |
| `scripts/build_chinese_dictionary.ts` | `CHINESE_DICTIONARY_DATA_DIR` | `CHINESE_DICTIONARY_DATA_DIR` |
| `scripts/build_chinese_dictionary.ts` | `OUTPUT_DB` 路径 `chinese_dictionary.db` | `chinese_dictionary.db` |
| `scripts/build_chinese_dictionary.ts` | 所有 `[build:chinese-dictionary]` | `[build:chinese-dictionary]` |
| `scripts/build_chinese_dictionary.ts` | `license_dest` 路径 `chinese-dictionary-LICENSE` | 不变 |

### B3. npm script / 配置

| 文件 | 现有 | 新 |
|---|---|---|
| `package.json` scripts | `build:chinese-dictionary` | `build:chinese-dictionary` |
| `package.json` extraResources | `chinese_dictionary.db` | `chinese_dictionary.db` |
| `.gitignore` | `data/dict/chinese_dictionary.db` | `data/dict/chinese_dictionary.db` |
| `scripts/run_dist.mjs` | `build:chinese-dictionary` | `build:chinese-dictionary` |

---

## C. UI 展示名 → "Chinese Dictionary"

| 文件 | 现有 | 新 |
|---|---|---|
| `src/services/chinese_dictionary.ts` | `name: 'Chinese Dictionary'` | `name: 'Chinese Dictionary'` |
| `src/components/svc_tile.tsx` | `chinese_dictionary: { name: 'Chinese Dictionary', ... }` | `chinese_dictionary: { name: 'Chinese Dictionary', ... }` |
| `src/windows/config/service_settings.tsx` | `label: 'Chinese Dictionary'` | `label: 'Chinese Dictionary'` |
| `src/i18n/locales/zh_cn.json` | `service.chinese_dictionary: "Chinese Dictionary"` | `"Chinese Dictionary"` |
| `src/i18n/locales/zh_tw.json` | `service.chinese_dictionary: "Chinese Dictionary"` | `"Chinese Dictionary"` |
| `src/i18n/locales/en.json` | `service.chinese_dictionary: "Chinese Dict"` | `"Chinese Dictionary"` |
| `docs/design/omni-pot/project/shared.jsx` | `name: 'Chinese Dictionary'` | `name: 'Chinese Dictionary'` |
| `docs/design/omni-pot/project/windows/config.jsx` | `label:'Chinese Dictionary'` | `label:'Chinese Dictionary'` |
| `docs/design/omni-pot/project/windows/translate.jsx` | `label: 'Chinese Dictionary'` | `label: 'Chinese Dictionary'` |

---

## D. 补 spec.md

| 位置 | 改动 |
|---|---|
| §13 服务清单表 | 加一行：`\| 20 \| Chinese Dictionary \| chinese_dictionary \| 离线（mapull/chinese-dictionary → SQLite 86MB），输出Chinese Dictionary结果 \|` |
| §12.3 默认实例 | 加 `chinese_dictionary@default` |
| §12.3 默认实例 | 移除 `free_dictionary@default`（如果存在） |
| §6 词典窗口 | `chinese_dict_handlers.ts` → `chinese_dictionary_handlers.ts` |
| §6 词典窗口 | `chinese_dictionary.db` → `chinese_dictionary.db` |
| §6 词典窗口 | `build_chinese_dictionary.ts` → `build_chinese_dictionary.ts` |
| §6 词典窗口 | `mapull/chinese-dictionary` 保持不变 |
| §6 词典窗口 | `Chinese Dictionary查询` → `Chinese Dictionary 查询`（或保留中文描述，仅改代码路径） |
| §5 翻译窗口 | `Chinese Dictionary卡片` → `Chinese Dictionary 卡片` |
| §12.3 默认实例 | 注册数量 19 → 20（或按实际） |
| 全文 | `Chinese Dictionary` 描述性文字 → `Chinese Dictionary` |
| §9 | `chinese-dictionary:state-changed` → `chinese-dictionary:state-changed` |

---

## E. 文档同步

### E1. CLAUDE.md

| 行 | 改动 |
|---|---|
| 常用命令表 | `build:chinese-dictionary` → `build:chinese-dictionary` |
| 常用命令表 | `chinese_dictionary.db` → `chinese_dictionary.db` |
| 初始化说明 | `github_repo/chinese-dictionary` 保持（外部仓库名） |
| 编码约定 | `build_chinese_dictionary.ts` → `build_chinese_dictionary.ts` |

### E2. TASKS.md

| 行 | 改动 |
|---|---|
| `Chinese Dictionary` | → `Chinese Dictionary` |
| `chinese_dictionary` | 不变（已是完整形式） |
| `chinese_dict` | → `chinese_dictionary` |

### E3. docs/test.md

| 行 | 改动 |
|---|---|
| `chinese_dictionary` | 不变 |
| `chinese_dictionary_build.test.ts` | → `chinese_dictionary_build.test.ts` |
| `build:chinese-dictionary` | → `build:chinese-dictionary` |
| `chinese_dictionary.db` | → `chinese_dictionary.db` |
| `Chinese Dictionary` | → `Chinese Dictionary` |

### E4. docs/test_user_e2e.md

| 行 | 改动 |
|---|---|
| `chinese_dictionary` | 不变 |
| `Chinese Dictionary` | → `Chinese Dictionary` |

### E5. docs/runtime/better_sqlite3_abi.md

| 行 | 改动 |
|---|---|
| `build:chinese-dictionary` | → `build:chinese-dictionary` |
| `build_chinese_dictionary.ts` | → `build_chinese_dictionary.ts` |
| `chinese_dictionary_build.test.ts` | → `chinese_dictionary_build.test.ts` |
| `chinese_dictionary.db` | → `chinese_dictionary.db` |
| `electron/chinese_dictionary/index.ts` | → `electron/chinese_dictionary/index.ts` |
| `Chinese Dictionary` | → `Chinese Dictionary` |

### E6. docs/external_service_catalog.md

| 行 | 改动 |
|---|---|
| `Chinese Dictionary` 行 | 更新 DB 路径 `chinese_dictionary.db` |
| `mapull/chinese-dictionary` 行 | 保持不变 |
| `Chinese Dictionary` | → `Chinese Dictionary` |
| free_dictionary 相关条目 | 移除 |

### E7. docs/archive/reviews/spec_code.md

| 行 | 改动 |
|---|---|
| `chinese_dictionary` | 不变 |
| `Chinese Dictionary` | → `Chinese Dictionary` |

### E8. docs/archive/reviews/spec_demo.md

| 行 | 改动 |
|---|---|
| `chinese_dictionary` | 不变 |
| `Chinese Dictionary` | → `Chinese Dictionary` |

### E9. docs/design/demo_todo.md

| 行 | 改动 |
|---|---|
| `chinese_dictionary` | 不变 |
| `Chinese Dictionary` | → `Chinese Dictionary` |

### E10. docs/archive/ 相关文件

按需改 `chinese_dict` → `chinese_dictionary`、`Chinese Dictionary` → `Chinese Dictionary`。

---

## 不改的

| 项目 | 原因 |
|---|---|
| `src/services/chinese_dictionary.ts` 文件名 | 已是完整形式 |
| `shared/types/config.ts` key `'chinese_dictionary'` | 已是完整形式 |
| `mapull/chinese-dictionary` 外部仓库名 | 外部不改 |
| `github_repo/chinese-dictionary` clone 目录 | 与上游保持一致 |
| `chinese-dictionary-LICENSE` | 已是完整形式 |

---

## 执行顺序

1. 删除 `src/services/free_dictionary.ts`
2. 编辑 `src/services/index.ts`（移除 free_dictionary）
3. 编辑 `shared/types/config.ts`（移除 free_dictionary 默认实例）
4. 重命名文件/目录（git mv）
5. 编辑所有源码文件中的标识符
6. 编辑 package.json、.gitignore、run_dist.mjs
7. 编辑 UI 展示名
8. 编辑测试文件（含 free_dictionary → cambridge_dict 切换）
9. 编辑 spec.md
10. 编辑其他文档
11. typecheck + lint + test 验证
