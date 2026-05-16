# Review: local capabilities design + plan

> 审阅日期：2026-05-17  
> 审阅模型：GPT-5.5  
> 范围：`docs/superpowers/specs/2026-05-17-local-capabilities-design.md` + `docs/superpowers/plans/2026-05-17-local-capabilities.md`

## 总评

方向正确：中文字典走 SQLite + 主进程 IPC，语言检测走 `cld3-asm` + regex fallback，主/渲染边界清楚。当前文档仍有多处 plan/spec 不一致，且示例代码里有几个会导致实现返工的问题。

结论：**APPROVED with HIGH/MEDIUM refinements**。无 CRITICAL。建议先修 HIGH，再进入实现。

## CRITICAL

无。

## HIGH

### H1. plan 的 Task 编号断档，执行流会出错

`Task 6` 后直接跳到 `Task 8`，但前文多处写“Task 7 after spike verification”。实际没有 Task 7。

建议：

- 把 cld3 依赖落地任务明确为 Task 7，或统一重编号。
- 确保 “do NOT add cld3-asm here / Task 7 after spike” 指向真实任务。

### H2. spec 和 plan 对 idiom 查询顺序互相矛盾

spec 写“词语：words 精确 → idioms 精确 → FTS”，但又写“words 表已包含 idiom，当前实现不做 words→idioms 二次查询，idioms 表仅作为独立查询入口”。plan 示例代码也是 `lookup_word()` 命中后直接返回，不会查询 idioms。

结果：用户输入成语若 words 表命中，将永远拿不到 idioms 表的出处/example 映射。

建议二选一：

- 若本期要展示 idiom richer fields：查询顺序改为 idioms exact → words exact → FTS，或 words 命中后再查 idioms 覆盖。
- 若本期不展示 idiom extra fields：删除“words 后查 idioms”的承诺，避免假测试。

### H3. package.json `build.extraResources` 可能不是真实配置入口

文档多处要求修改 `package.json build.extraResources`，但项目存在 `electron-builder.yml`。如果 electron-builder 实际读取 yml，则 package.json 修改无效。

建议：

- 实现前确认 builder 配置来源。
- spec/plan 只写真实配置文件。
- final dist 验证必须检查产物内 `resources/data/dict/chinese_dict.db` 和 `chinese-dictionary-LICENSE`。

## MEDIUM

### M1. plan 仍含直接 `npm install` / `npm install --no-save`，会改锁文件或依赖状态

spike 要求 `npm install --no-save cld3-asm`，后续又 `npm install`。这可能污染当前大量未提交修改和 lockfile。

建议：

- spike 放到临时 worktree 或明确“会修改 node_modules/package-lock，完成后清理”。
- 依赖落地单独一节，列出预期 package/lockfile 变更。

### M2. renderer 字典服务仍吞 IPC 异常为无结果

Task 5 的 `translate()` catch 返回 `''`。这会把 IPC channel broken、main handler throw、schema mismatch 包装成“无命中”。spec 又要求“不伪装为无命中”，两者冲突。

建议：

- IPC 返回 `{ ok, result, error_code }` 或 check 状态先行。
- renderer 至少记录日志并让 `testConfig()` 反映不可用。
- UI 能区分“无命中”和“服务不可用”。

### M3. SQLite open 后设置 WAL 与 readonly 模式冲突风险

`new Database(path, { readonly: true })` 后执行 `db.pragma('journal_mode = WAL')` 可能需要写入 journal state，在只读/打包资源环境不稳。

建议：

- build 阶段设置 WAL/优化。
- runtime readonly 只执行读安全 pragma，或不设置 journal_mode。
- dist smoke 覆盖只读 resources 路径。

### M4. FTS 测试示例绕过了实际清洗逻辑

`FTS fullwidth punctuation does not throw` 直接对 `words_fts MATCH '你好，世界！*'`，但实际代码会先 whitelist 清洗。这条测试可能因 SQLite FTS 语法失败，且不能验证实现。

建议：

- 测 `clean_for_fts()` 或 handler 层输入。
- 不直接把未清洗输入送进 FTS MATCH。

### M5. `it.skipIf(!existsSync(LICENSE_PATH))('LICENSE file exists')` 逻辑反了

如果 LICENSE 不存在，这个测试会 skip，永远不会失败。它无法保障合规资源存在。

建议：

- 对 release/dist 验证：LICENSE 缺失必须 fail。
- 单测可在 db 缺失时 skip，但 db 存在时 LICENSE 缺失不能 skip。

### M6. language detect 单测复制实现，无法防真实实现漂移

`tests/detect/cld3.test.ts` 复制 `detect_regex()`，不是 import 真实函数。实现改坏时测试仍可能过。

建议：

- 从 `electron/detect/index.ts` export/import `detect_regex`。
- 对 `detect_local_cld3()` 用可注入 fake cld3 instance 或小型 seam 测 fallback。

### M7. cld3 映射表与 spec 不一致

spec 表中 `sv/pl` 等项目不支持语言写 fallback `en`，plan 示例却把 `sv`、`pl` 映射为 `LanguageCode`。需确认 `shared/types/language` 是否真实支持。

建议：

- 以实际 `LanguageCode` 类型为准。
- 未支持语言不要硬映射。
- 测试覆盖 `sv`、`pl`、`id`、`tr`、未知码。

### M8. `reload` 与 service_state 状态语义不完整

`reload_db()` 只重置 `db_state/cached_path`，没有同步 `service_state`。构建失败后再 reload，`get_service_state()` 可能继续返回 failed/missing 的旧语义。

建议：

- reload 后按打开结果设置 `ready` 或 `failed/missing`。
- check 返回稳定枚举，不靠 `is_ready()` 副作用隐式改变状态。

## LOW

- spike 代码含 `console.log` 可以作为临时脚本，但最终代码不要保留调试输出。
- `get_entry_count()` 只统计 words，命名建议改为 `word_count` 或返回 words/chars/idioms 三项。
- `DictResult` 对 char 多音字分组没有显示 pinyin 归属，UI 可能难以对应读音与释义。
- spec 文件清单里 `package.json` 重复两行，可清理。
- “CI 验证 db 体积 ≤ 100MB”和构建脚本 “>100MB warn；>150MB fail”标准不一致。
- dev `fs.watch` 监听文件不存在时失败后不会重新 watch；若依赖 auto-build，热 reload 可能失效。

## 测试补充

建议补充或调整：

- packaged app 只读 resources 路径能打开 db。
- db 存在但 LICENSE 缺失时 release 验证失败。
- schema mismatch、损坏 db、SQL throw 能返回服务不可用。
- 成语输入明确验证到底返回 words 释义还是 idiom richer fields。
- FTS 特殊字符走 handler 层，不直接测未清洗 MATCH。
- `detect.cld3_enabled=false` 时不 import/load cld3。
- cld3 loading/failed 只 fallback，不阻塞翻译。
- 未支持 cld3 code 不默认覆盖 regex 非英文结果。

## 安全与合规

- IPC 不允许 renderer 传 db 路径，当前方向正确。
- SQL exact 查询参数化，方向正确；FTS 必须只拼接主进程清洗后的 query。
- 外部数据源必须固定 commit，并在 CI/release mismatch fail。
- MIT LICENSE 必须进入 release；Apache NOTICE 需要在第三方声明里处理，不只检查 node_modules 存在。

## 最终意见

可继续。先修 H1-H3、M2、M5、M6；否则实现时会出现任务断档、成语行为歧义、打包资源遗漏和测试假阳性。
