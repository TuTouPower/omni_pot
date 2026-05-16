# Review: Local Capabilities (Chinese Dict + Language Detection)

**Reviewed**: 2026-05-17
**Files**:
- `docs/superpowers/plans/2026-05-17-local-capabilities.md`
- `docs/superpowers/specs/2026-05-17-local-capabilities-design.md`

**Decision**: REQUEST CHANGES — 多处 plan/spec 不一致与若干逻辑漏洞。无 CRITICAL 安全问题。

---

## Summary

整体方案扎实：分层清晰、spike-first、有回滚开关、覆盖 license/打包/状态机。但 plan 与 spec 存在事实性偏差，plan 内部有 Task 编号断档和命名漂移，会让执行者卡住或写出与 spec 不一致的代码。

---

## HIGH

### H1. Task 编号断档：缺失 Task 7
Plan 从 Task 6 直接跳到 Task 8。Task 0 注释写"`cld3-asm` goes in Task 7"，但 Task 7 不存在；Task 0 Step 4 已经把 cld3-asm 加进 dependencies。
**Fix**: 重新编号 Task 8→7、9→8、…，或显式说明 Task 7 已合并入 Task 0。

### H2. Spec vs Plan BCP-47 映射不一致：`pt`
- Spec line 517：`pt → pt`
- Plan `CLD3_LANG_MAP`：`'pt': 'pt_pt'`
- Plan BCP-47 测试表（line 1467）：`pt_pt`

必须以 `shared/types/language.ts` 的 `LanguageCode` 为权威，统一三处。

### H3. Spec 缺失若干 plan 实现的映射
Plan `CLD3_LANG_MAP` 含 `sv`、`pl`，spec line 524-528 把 `sv/da/fi/pl/cs` 全部 fallback 到 `en`。直接冲突。
**Fix**: 确认 `LanguageCode` 是否含 `sv/pl`；按真实值同步两文档。

### H4. 状态机语义错误：`set_service_state('missing')` 当作 "reset"
Plan Task 4 Step 1 用 `set_service_state('missing')` 重置状态，但 spec line 42 定义 `missing = db 文件不存在`，UI 会显示"未构建"。dev 自动构建完成后短暂窗口里 `check()` 会返回 `missing`，UI 闪一次错误提示。
**Fix**: build 成功后显式 `set_service_state('ready')`；或新增 `'idle'` 状态区分"未尝试" vs "确认缺失"。

### H5. `electron/main.ts` 的 `import` 写在函数调用之后
Plan Task 4 Step 1 在 `registerChineseDictHandlers()` 调用后嵌入 `import` 语句。ES module 必须顶部 import，会编译失败。
**Fix**: 明确"imports 放文件顶部 import 块；以下代码放 `app.whenReady()` 内"。

### H6. `fs.watch(file)` 在文件不存在时永久失效
Task 4 Step 2 try/catch 吞掉 watch 失败。但 dev 模式自动构建是 async（spawn），主线程立即进入 watch 块时 db 尚不存在，watcher 永远不会注册——后续构建完成也不会热重载。
**Fix**: 监听目录，或在 spawn `close` 回调（成功后）再注册 watcher。

### H7. Prepared statement 每次调用都重新 prepare
`electron/chinese_dict/index.ts` 每次 `lookup_word()` 都 `database.prepare(...)`。better-sqlite3 应缓存 statement，否则失去性能优势，与 spec "< 1ms" 性能预期冲突。
**Fix**: `open_db()` 时 prepare 常用 statement，模块级缓存；`reload_db()` 时清空。

### H8. Spec 文件清单内部有重复条目
Spec line 224 和 line 230 都列 extraResources；line 224-225 重复"增加 build:chinese-dict 脚本"两次。
**Fix**: 合并去重。

---

## MEDIUM

### M1. 多处路径解析层级不一致
- Task 2 `find_db_path()` dev：上溯 3 层 (`'..', '..', '..'`)
- Task 4 fs.watch fallback：上溯 2 层 (`'..', '..'`)
- Task 4 spawn cwd：上溯 2 层

electron-vite 编译后 `__dirname` 位置只有一种，至少有一处错。
**Fix**: 用 `app.getAppPath()` 或单一 helper 统一。

### M2. `to_dict_result_char` 的 `words` 字段映射与 build 不一致
Build 直接序列化 `e['words'].slice(0, 5)`（结构未严格化），IPC handler `as Array<{word: string; text: string}>`。若 mapull 真实字段名不同，渲染拿空串。
**Fix**: build 显式 normalize 成 `{word, text}`；spec 写明字段约定。

### M3. `chineseDict:check` 返回字段不一致
- Spec line 252: `{ ready, entry_count }`
- Plan handler 返回 `{ ready, status, entry_count }`
- Plan ElectronAPI 类型: `{ ready, status, entry_count }`

**Fix**: 更新 spec 类型签名补 `status`。

### M4. `SELECT *` 强转类型
`lookup_idiom`/`lookup_character` 用 `SELECT *` 强转。schema 升级时类型静默漂移。
**Fix**: 显式列名。

### M5. FTS 前缀清洗保留空格导致多 token 问题
`clean_for_fts` 保留 `\s`，`${cleaned}*` 直接拼。输入 "学 习" → "学 习*"，FTS5 只在最后 token 加 `*`，前 token 变 exact，反直觉。
**Fix**: 决定压缩空格 vs 每 token 加 `*`，在 spec 写明。

### M6. 同步 `getConfig` 在 hot path
每次 lookup 都调用。确认 config 为内存读，否则缓存 + 监听。

### M7. `detect_local` IPC fallback 复制了 regex 子集
Spec 强调"映射归属：主进程"，但渲染 catch 又搬回一小段 regex。Plan 已注明"最小冗余，不要扩展"——spec 需要同步该说明。

### M8. `it.skipIf(!db_exists)` 会让 CI 默认全部 skip 还显示绿
若 CI 未构建 db，测试全 skip = 全绿，等于无验证。
**Fix**: CI workflow 强制先 build；或在测试里设 sentinel "CI 必须有 db"。

### M9. `init_cld3()` 无超时
WASM 加载若卡住，`wasm_state` 永停 `loading`（虽然走 regex 不阻塞，但 promise 悬挂）。建议 timeout。

### M10. "是否中文" 阈值未定义
Spec line 277 没说"含一个汉字算中文吗？混合文本？"。Plan 用 `/\p{Script=Han}/u.test`（任意一个就算）。需在 spec 写死。

---

## LOW

- **L1**: Spec line 199 连续两个 "7." 编号。
- **L2**: schema_version 比较用 `parseInt`，build 写字符串 `'1'`——直接 `=== '1'` 更安全（避免 `parseInt('1abc')` 通过）。
- **L3**: Task 0 spike 文件 (`scripts/spike_cld3.ts`) 在 master 上创建后删除，会留在 git 历史；建议 spike 分支做。
- **L4**: `to_dict_result_idiom` 丢弃 `similar/opposite`，handler 内未加 TODO 注释指向 FUTURE 扩展。
- **L5**: `to_dict_result_char` examples 硬编码 `slice(0, 3)`，未在 spec 提及上限。
- **L6**: Plan 用 `log.error('... %s', e)` printf 风格——确认 electron-log 是否支持，否则会变字面量。
- **L7**: `chineseDict` 无点 vs `detect.local` 带点——文档加一句说明 preload 命名空间结构。

---

## Validation

| Check | Result |
|---|---|
| Type check | Skipped (review-only) |
| Lint | Skipped |
| Tests | Skipped |
| Build | Skipped |

仅文档审阅。

---

## Required Fixes Before Implementation

1. **H1** Task 编号断档
2. **H2/H3** BCP-47 映射对齐（以 `LanguageCode` 为准）
3. **H4** state machine 重置语义
4. **H5** import 位置
5. **H6** fs.watch 永久失效
6. **H7** 缓存 prepared statements
7. **H8** spec 文件清单去重

---

## Strengths

- Spike-first 降低 WASM 集成风险。
- 双路径 + extraResources 复用 ecdict 模式。
- 回滚开关 + 热重载 + 失败缓存覆盖 ops 场景。
- FTS5 有验收词，避免理论翻车。
- License 义务显式处理。
- 异步预加载不阻塞 UI。
