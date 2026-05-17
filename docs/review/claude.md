# 代码审查：本地中文词典 + cld3 本地语言检测（第三轮）

**审查日期**：2026-05-17
**审查范围**：当前工作区未提交的修改
**审查人**：Claude (Opus 4.7)

## 概览

第三轮审查。第二轮 9 条发现里 #1/#2/#3/#4/#5/#7/#8 已修，剩 #6/#9 未动；另发现若干新问题，主要集中在主进程类型契约、build 子进程可观察性、reload 副作用、构建脚本健壮性。整体架构没有问题，是细节收尾轮。

## 上一轮（第二轮）复核

| # | 问题 | 状态 |
|---|------|------|
| 1 | `afterAll` 在 db 缺失时 NPE | ✅ 已修：[tests/chinese_dict/build.test.ts:17-19](../../tests/chinese_dict/build.test.ts#L17-L19) `if (db) db.close()` |
| 2 | BCP-47 映射测试 no-op | ✅ 已修：[tests/detect/cld3.test.ts:81-83](../../tests/detect/cld3.test.ts#L81-L83) 已断言 `CLD3_LANG_MAP[bcp47]` |
| 3 | cld3 加载/降级路径缺测 | ✅ 已修：[tests/detect/cld3.test.ts:86-94](../../tests/detect/cld3.test.ts#L86-L94) 加了 pre-init fallback 用例 |
| 4 | `detect_local_cld3` catch 静默 | ✅ 已修：[electron/detect/index.ts:117-122](../../electron/detect/index.ts#L117-L122) 加 `runtime_failed_logged` |
| 5 | 渲染端只收到 ready | ✅ 已修：[electron/main.ts:130-153](../../electron/main.ts#L130-L153) building/failed 都 broadcast |
| 6 | `get_service_state` 调 `is_ready` 有副作用 | ❌ 未改：[electron/chinese_dict/index.ts:103-111](../../electron/chinese_dict/index.ts#L103-L111) 仍走 open_db |
| 7 | `init_promise` 成功后未清理 | ✅ 已修：[electron/detect/index.ts:90](../../electron/detect/index.ts#L90) `load_cld3_internal` 末尾置 undefined |
| 8 | 单字 fall-through 到 word 无说明 | ✅ 已修：[electron/ipc/chinese_dict_handlers.ts:130](../../electron/ipc/chinese_dict_handlers.ts#L130) 加注释 |
| 9 | 构建脚本 `console.log` 与全局 CLAUDE.md 冲突 | ❌ 未改：仍保留 console，CLAUDE.md 未给 `scripts/` 豁免 |

## 本轮新发现

### 1. `chineseDict:state-changed` 的类型契约太松

**位置**：[shared/types/ipc.ts:88](../../shared/types/ipc.ts#L88)、[electron/preload.ts:117](../../electron/preload.ts#L117)

```ts
onStateChanged(callback: (state: string) => void): () => void
```

主进程实际 send 的 payload 只可能是 `'building' | 'ready' | 'failed'`（`ServiceState` 还多一个 `'missing'`，但目前没 broadcast 它），渲染端却拿到一个开放 `string`。建议把 `ServiceState` 从 `electron/chinese_dict/index.ts` 提到 `shared/types/`，让 IPC 两端共享同一个 union，避免渲染端写 `switch(state)` 时漏分支或拼错。同样 `chineseDict.check()` 返回的 `status: string` 也应是 `ServiceState`。

### 2. `reload_db()` 在失败时把 service_state 改成 'failed'，覆盖 'building'

**位置**：[electron/chinese_dict/index.ts:156-167](../../electron/chinese_dict/index.ts#L156-L167)

```ts
export function reload_db(): boolean {
    ...
    const success = is_ready()
    service_state = success ? 'ready' : 'failed'
    return success
}
```

dev 自动 build 成功分支会先 `set_service_state('ready')` 再 `reload_db()`（[main.ts:140-141](../../electron/main.ts#L140-L141)）；如果文件刚好被并发 watcher 又触发了一次 reload，state 已经是 ready 时无问题。但 `chineseDict:reload` IPC 暴露给前端：若用户在 'building' 中点击重新加载（理论上不该），会把 'building' 直接覆写成 'failed'。建议 reload 失败时只在 state 已是 'ready' 时降级为 'failed'，否则保留原状态。或者更简单——`reload_db` 不再写 `service_state`，由调用方决定。

### 3. dev 自动 build 子进程 stdout 完全丢失

**位置**：[electron/main.ts:141-142](../../electron/main.ts#L141-L142)

```ts
const build = spawn(npm_cmd, ['run', 'build:chinese-dict'], { cwd: app.getAppPath(), shell: false })
build.stderr.on('data', (data: Buffer) => { log_main.error('build:chinese-dict stderr: %s', data.toString()) })
```

只接了 stderr，stdout 完全丢弃。脚本里 9 处 `console.log`（`Loading...`、`Inserting N words...`、`Done: ...`、`Output: ... MB`）全部消失。首次 dev 启动构建耗时数十秒到几分钟，期间日志窗口除了一行 `building` 啥都没有，定位「卡在哪一步」全靠盲猜。建议把 stdout 也接到 `log_main.info`：

```ts
build.stdout.on('data', (data: Buffer) => { log_main.info('build:chinese-dict: %s', data.toString().trimEnd()) })
```

### 4. db_watcher 在文件被替换后会失效（Windows）

**位置**：[electron/main.ts:114-124](../../electron/main.ts#L114-L124)

`fs.watch(file)` 在 Windows 上监视的是 inode 句柄，当 build 脚本 `unlinkSync(OUTPUT_DB)` + 新建（[scripts/build_chinese_dict.ts:178-180](../../scripts/build_chinese_dict.ts#L178-L180)）后，旧句柄已失效，后续修改不会再触发 reload。当前 dev 自动 build 路径在 close 回调里手动 `register_db_watch(new_path)` 是对的；但**已存在 db 的路径**注册的 watcher 在用户后续手动 `npm run build:chinese-dict` 后会静默失效，再改 db 不 reload，需要重启应用。建议：watch 时同时监听父目录（`watch(dirname, { persistent: false })`）并 filter `eventType === 'rename' && fname === 'chinese_dict.db'`，可以更鲁棒地捕获替换。

### 5. `register_db_watch` 静默吞 watch 失败

**位置**：[electron/main.ts:118-122](../../electron/main.ts#L118-L122)

```ts
try {
    db_watcher = watch(db_path, () => { ... })
} catch {
    // watch failed — non-critical
}
```

注释说 non-critical，没问题，但**一句 log 都没有**。后续如果用户在 dev 改了 db 却没自动 reload，排查时不知道是 watcher 根本没起来还是触发了没生效。建议至少 `log_main.warn('db watch failed: %s', e)`。

### 6. `clean_for_fts` 与 `fts_search` 重复 sanitize 但不一致

**位置**：[electron/ipc/chinese_dict_handlers.ts:102-104](../../electron/ipc/chinese_dict_handlers.ts#L102-L104)、[electron/chinese_dict/index.ts:149](../../electron/chinese_dict/index.ts#L149)

handler 里 `clean_for_fts` 保留 `\s`，传给 `fts_search`，后者又用 `[^\p{Script=Han}a-zA-Z0-9]` 把空格删掉。意思是输入 `"莫名 其妙"` 会被合并成 `"莫名其妙*"`，搜出的可能与用户意图不符。两层 sanitize 也容易让人改一处忘另一处。建议留一份（推荐放 `fts_search` 里，handler 只判空），并明确空格是否保留。

### 7. `fts_search` 结果未 `bm25()` 排序（第二轮非阻塞重申）

**位置**：[electron/ipc/chinese_dict_handlers.ts:147](../../electron/ipc/chinese_dict_handlers.ts#L147)

`fts_results[0]` 是 FTS 默认 docid 顺序，跟相关度无关。短词查询时第一个返回的可能是冷门词。建议 `ORDER BY bm25(words_fts)` 或至少 `ORDER BY length(word)`（短匹配优先）。仍不阻塞。

### 8. 构建脚本：comma-separated JSON 解析不防尾部逗号

**位置**：[scripts/build_chinese_dict.ts:30-36](../../scripts/build_chinese_dict.ts#L30-L36)

```ts
if (trimmed.startsWith('[')) {
    return JSON.parse(raw)
}
return JSON.parse('[' + raw + ']')
```

如果 mapull 上游 word.json 哪天末尾多个 `,\n` 或 BOM，`JSON.parse` 直接 fail，fail 信息只有 `Failed to parse word/word.json: SyntaxError: Expected double-quoted property name in JSON at position N`，定位耗时。建议在拼接前 trimEnd + 去尾逗号：

```ts
const body = raw.trimEnd().replace(/,\s*$/, '')
return JSON.parse('[' + body + ']')
```

同时 PINNED_COMMIT 检查能挡住源版本漂移，但**只在 CI 里 fail**，本地是 warn——一旦本地用了新版上游而格式悄悄改了，pre-commit/单测可能挂不出来。可以考虑本地也 fail，加 `--allow-mismatch` flag 显式覆盖。

### 9. `import_chars` 只取 `first_words`，丢掉其余义项的 words

**位置**：[scripts/build_chinese_dict.ts:104-110](../../scripts/build_chinese_dict.ts#L104-L110)

```ts
if (!first_words && e['words'] && Array.isArray(e['words'])) {
    ...
    first_words = JSON.stringify(normalized.slice(0, 5))
}
```

某些字（如「行」xíng / háng）每个读音都有自己的常用词，目前只取第一个义项的前 5 个。handler 端 `to_dict_result_char` 又把它当作单一 examples 列出，无法体现「不同读音→不同例词」。如果 db 体积允许，建议保留 per-pinyin 的 examples 数组（按 pinyin 分组）。当前实现可工作，但词典质量打折——SPEC 写「输出词典结果」时这是用户能直观看到的差距。

### 10. `chineseDict:lookup` 没有 try/catch，better-sqlite3 throw 会让 IPC reject

**位置**：[electron/ipc/chinese_dict_handlers.ts:117-150](../../electron/ipc/chinese_dict_handlers.ts#L117-L150)

handler 里所有 `lookup_*` 在 db 异常（磁盘损坏、schema 漂移到一半）时可能 throw。当前 IPC handle 没包 try/catch，会以 reject 抛回渲染端；渲染端 `chinese_dictionary.translate` 的 catch 会吞掉返回空串，**用户看不到错误，前端也无从 retry**。建议 handler 顶层 try/catch，记 log 再返回 null，与 IPC 契约（`Promise<DictResult | null>`）一致。

### 11. `init_cld3` 失败后无重试入口

**位置**：[electron/detect/index.ts:62-67](../../electron/detect/index.ts#L62-L67)

`wasm_state === 'failed'` 之后 `init_cld3()` 直接 return（因为没 ready 且没 init_promise），永远不会再试。如果失败原因是临时的（首次启动磁盘繁忙、WASM 加载偶发竞争），重启才能恢复。建议加一个 `reset_cld3()` 或允许 `init_cld3({ force: true })` 主动重试，并在配置面板/设置里暴露一个「重试」按钮，配合现有 `detect_cld3_enabled` 配置。优先级低，可后续 PR。

### 12. `cld3_factory.create(0)` 的 0 含义不直观（第二轮非阻塞重申）

**位置**：[electron/detect/index.ts:88](../../electron/detect/index.ts#L88)

```ts
cld3_instance = cld3_factory.create(0)
```

`0` 是 `minBytes`，但读代码完全猜不到。一行常量：

```ts
const MIN_BYTES = 0  // accept any input length; we trust upstream length checks
const MAX_BYTES = undefined
cld3_instance = cld3_factory.create(MIN_BYTES, MAX_BYTES)
```

## 建议（非阻塞）

- [electron/main.ts:140-145](../../electron/main.ts#L140-L145) 加 `chineseDict:rebuild` IPC（第二轮已提）；当前 dev 构建失败后无法在不重启 app 的前提下重试。
- [scripts/build_chinese_dict.ts:178](../../scripts/build_chinese_dict.ts#L178) `unlinkSync(OUTPUT_DB)` 没清理同名 `.db-shm` / `.db-wal`，重建后会留旧 WAL 文件。功能无害（新 db 不读旧 WAL），美化建议清掉。
- [package.json:73-76](../../package.json#L73-L76) `extraResources.filter` 里 `**/*.db` 不会匹配 `.db-shm` / `.db-wal`，所以 `!**/*.db-shm` 这两条排除是 no-op。可保留作意图说明，但加一行注释。
- [shared/types/ipc.ts:108](../../shared/types/ipc.ts#L108) `detect.local` 返回 `{ lang; source: 'cld3' | 'regex' }`——渲染端 `src/services/detect.ts:5-7` 拿到后丢掉了 `source` 字段。如果未来要在 UI 显示「使用了离线/在线引擎」，source 是有用的信号；当前丢弃合理但值得在 PLAN 记一笔。
- [electron/chinese_dict/index.ts:120](../../electron/chinese_dict/index.ts#L120) `stmt_cache.get(key) ?? database.prepare(...)` 兜底 `prepare` 每次新建，绕过 cache。但 `open_db` 已保证 cache 命中，兜底实际死代码。可以 `stmt_cache.get(key)!`（已知非空）或抽辅助函数 `get_stmt(key)` 强校验。
- [docs/spec.md:732-735](../../docs/spec.md#L732-L735) cld3 段写了 19 种语言；`CLD3_LANG_MAP` 实际 19 条 + `zh-Hant` 一条 = 20 条。措辞与代码不完全对齐。

## 测试覆盖

- ✅ chinese_dict build 流程覆盖度高。
- ✅ cld3 regex 兜底、BCP-47 映射、pre-init 降级三块新增/修复。
- ⚠️ [electron/ipc/chinese_dict_handlers.ts](../../electron/ipc/chinese_dict_handlers.ts) 仍无单测：`to_dict_result_char` 的 grouped explanations、`to_dict_result_idiom` 的 source/example 合并、`clean_for_fts` 与 `clean_for_exact` 边界（长度=0、长度=101、emoji、全宽符号）都是纯函数，提取出来加单测成本低、收益高。
- ⚠️ `detect_local_cld3` ready 路径（WASM 加载成功后的 reliable / unreliable / unmapped 分支）目前无法在 vitest 里轻量覆盖（需要真 WASM），建议至少加一个集成测：spawn 一个临时 `init_cld3()` + `detect_local_cld3('Hello world this is English text')` 期望 `source === 'cld3'`。如果 CI WASM 加载不稳，可以 `it.skipIf(process.env.CI_SKIP_WASM)`。

## 风险

- 二进制 db 不进 git；`extraResources` 依赖 dev 已跑过 `build:chinese-dict`。CI workflow 是否已加该 step——上一轮提过，本轮代码里 `npm run dist` 已在脚本前置 `npm run build:chinese-dict`（[package.json:12-13](../../package.json#L12-L13)），✅ 本地打包能保证；但 GitHub Actions 还要确保 `github_repo/chinese-dictionary` 也存在，否则 `DATA_DIR` fail。建议 CI 加一步 `git clone --depth 1 mapull/chinese-dictionary github_repo/chinese-dictionary && (cd github_repo/chinese-dictionary && git checkout <PINNED_COMMIT>)`。
- WASM 体积（`cld3-asm` ≈ 数 MB）首次启动加载耗时；当前 `init_cld3()` 非阻塞挂在 ready 后，影响小，但 PLAN 仍可记一笔冷启动指标。

## 结论

第二轮 9 条已修 7 条（剩 #6 状态机副作用、#9 console 豁免）。本轮新增 12 条，**建议合入前修 #1 / #2 / #3 / #10**（类型契约、reload 状态覆盖、构建 stdout 丢失、handler 缺 try/catch），其余可后续 PR 跟进。
