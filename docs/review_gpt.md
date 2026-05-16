# Review: 2026-05-17-local-capabilities-design.md

> 审阅日期：2026-05-17
> 审阅模型：GPT-5.5
> 范围：中文字典数据导入 + 本地语言检测替换

## 总评

设计方向正确，模块边界清晰：中文字典独立 SQLite + IPC，语言检测独立本地服务 + regex fallback。路径契约、LICENSE、schema metadata、运行时降级、FTS 验收、WASM 状态机都已有覆盖。

结论：**可进入实现**。无 CRITICAL 阻塞；建议先收口 HIGH 项，避免实现后返工。

## CRITICAL

无。

## HIGH

### H1. dev 自动构建与 UI 错误路径仍需定序

spec 同时描述：

- dev 启动时自动检测并触发 `build:chinese-dict`。
- `is_ready()=false` 时 IPC 返回结构化错误，UI 提示手动执行命令。

如果自动构建耗时较长，UI 可能先显示“未构建”错误，随后又恢复可用，体验混乱。

建议：明确状态机：`missing -> building -> ready | failed`。dev 自动构建中 UI 显示“正在构建中文词典”；只有 `failed` 才提示手动命令。prod 不自动构建，只降级并提示资源缺失。

### H2. `source_commit` 校验 warn 不阻塞，可能削弱可复现性

文档要求 pinned commit 不一致只 warn，并记录实际 `metadata.source_commit`。这能提高开发便利性，但构建产物不再严格可复现。

建议：

- 本地 dev：warn 不阻塞。
- CI / release 构建：commit 不一致直接 fail。
- metadata 同时记录 `expected_source_commit` 与 `actual_source_commit`。

### H3. FTS5 中文模糊查询能力可能被高估

`unicode61` 对中文分词能力有限，prefix 查询更适合英文 token，不等价于中文子串搜索。设计中验收词已列出，但查询策略若承诺“模糊”过宽，用户预期会偏高。

建议：把能力定义改成“前缀 / FTS 辅助召回 + exact 优先”，并在实现中保留 `LIKE ?` 或 trigram 方案作为验收失败时的 fallback 选项。不要只依赖 FTS5 证明中文模糊可用。

### H4. `lookup()` 查询异常返回空结果会掩盖损坏状态

设计写查询异常捕获后返回空结果，不阻塞其他服务。对 UI 友好，但如果 db 损坏或 SQL/schema 不匹配，用户看到的是“查不到”，不是“词典不可用”。

建议：区分：

- 输入无命中：返回空结果。
- db/schema/SQL 异常：返回结构化错误或 `service_unavailable`，并把 `is_ready()` 置 false。

### H5. `cld3` 未映射语言一律返回 `en` 有误判风险

未映射语言返回 `en` 会把越南语、印尼语等拉丁语系误判为英文。比 regex fallback 更差。

建议：未映射时返回 `unknown` 或使用 regex 结果；不要默认 `en`。如果业务必须给英文，需在 spec 明确这是产品取舍。

## MEDIUM

### M1. `postinstall` 自动构建不适合默认启用

词典源数据不随仓库提交，`postinstall` 很可能在新环境失败，影响普通依赖安装。

建议：优先用 `npm run dev` 的 preflight 检测；`postinstall` 只打印提示或不做构建。

### M2. `.gitignore` 不应忽略 LICENSE 产物

文件清单写忽略 `resources/data/dict/chinese-dictionary-LICENSE`。但 MIT LICENSE 是打包合规必需资源，若由构建脚本复制且不提交，release 构建必须保证它存在。

建议：二选一：

- LICENSE 复制产物不提交，但 release 构建前强校验存在。
- 或提交 LICENSE 文本，减少 release 漏包风险。

### M3. `is_ready()` 成功后缓存路径，db 被替换时一致性需定义

文档写成功后缓存路径，失败可 reload。若 dev 中 db 文件被重新构建，已打开连接与新文件替换的行为需要定义。

建议：`dict:reload` 明确关闭旧连接、清空 prepared statement、重开 db；mtime watcher 触发同一路径。

### M4. build 脚本内存峰值风险未写

源 JSON 合计接近 100MB，直接 `JSON.parse` 三个文件会有较高内存峰值。WSL / CI 小内存环境可能失败。

建议：实现前明确可接受内存上限；若超限，使用流式 JSON 解析或分文件串行 parse + insert + GC。

### M5. 语言检测包兼容性需先做 spike

`cld3-asm` 与 Electron 39 / Vite / 主进程 WASM 加载存在打包兼容风险。

建议：实现第一步先做最小 spike：dev + build + dist 环境各调用一次 `detect_local()`。

## LOW

- L1. `metadata.schema_version` 建议统一为 TEXT 存储，消费侧 parse，避免文档中类型不一致。
- L2. `resources/data/dict/*.db-wal`、`*.db-shm` 应加入 ignore 和 `extraResources.filter` 排除。
- L3. FTS 输入清洗规则应固定为白名单或 quote，不保留“strip 或 quote 二选一”。
- L4. `dict:reload` IPC 建议限制为内部 bridge，不暴露任意路径参数，避免路径滥用。
- L5. `detect_local()` 建议返回 `source: 'cld3' | 'regex' | 'unknown'`，便于测试与日志判断。

## 测试覆盖建议

已有测试计划较完整。建议补充：

- 源 commit 与 pinned commit 不一致：dev warn、release fail。
- FTS 特殊字符、全角标点、超长输入不抛异常。
- db 损坏 / schema mismatch 返回服务不可用，不伪装为空结果。
- `dict:reload` 后旧连接关闭，新 db 可查。
- `cld3` 初始化失败只记录一次 warning，并稳定 fallback。
- 未映射语言不默认 `en`。
- 打包后 Windows/macOS/Linux 各跑 `chineseDict.lookup()` 与 `detect.local()` 冒烟。

## 安全与合规

- IPC 不应允许渲染进程传入 db 路径或源数据路径。
- FTS 查询字符串必须清洗，不能直接拼接用户原文。
- 第三方 LICENSE 必须进入打包产物；后续 About 窗口再展示不应影响当前合规文件落盘。

## 最终意见

`APPROVED with HIGH-priority refinements`。实现前优先修 H1-H5；M 项可在实现 spike 和构建脚本阶段同步收口。