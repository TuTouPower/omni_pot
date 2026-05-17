# 代码审查：当前工作区改动

**审查日期**：2026-05-17  
**审查范围**：当前工作区未提交改动（本地中文词典 + cld3 本地语言检测 + 第三轮反馈修正）  
**审查人**：GPT-5.5

## 概览

本轮复核当前工作区 diff：渲染端中文词典已迁移到主进程 SQLite，语言检测已接入 `cld3-asm` WASM + 正则回退；第三轮反馈中的 IPC 状态类型、`reload_db()` 状态覆盖、dev build 日志、db watcher 可观察性、FTS 清洗、lookup 异常处理和脚本 console 约定也已做过修正。

整体架构方向仍然成立：主进程负责本地资源、SQLite、WASM 和 IPC，渲染进程只依赖服务接口。本报告只保留当前仍然高置信、会影响合入质量或文档一致性的问题。

## 需要修复的问题

### 1. P0：`npm run dist` 仍依赖被 git 忽略的本地数据源，干净环境不可复现

**位置**：[package.json:12-13](../../package.json#L12-L13)、[scripts/build_chinese_dict.ts:8](../../scripts/build_chinese_dict.ts#L8)、[scripts/build_chinese_dict.ts:155-159](../../scripts/build_chinese_dict.ts#L155-L159)、[.gitignore:16-19](../../.gitignore#L16-L19)

`dist` / `dist:dir` 仍无条件先跑 `npm run build:chinese-dict`：

```json
"dist": "npm run dist:check-locks && npm run build:chinese-dict && npm run build && ..."
```

但构建脚本默认数据源是本地 ignored 目录：

```ts
const DATA_DIR = process.env['CHINESE_DICT_DATA_DIR'] || join(__dirname, '..', 'github_repo', 'chinese-dictionary')
```

如果 `github_repo/chinese-dictionary` 不存在，脚本会直接 `process.exit(1)`；同时 `.gitignore` 忽略了 `github_repo/` 和生成的 `resources/data/dict/chinese_dict.db`。因此当前机器可以打包不代表干净 checkout / CI / release 机器可复现，发布流程仍依赖未入库的本机隐藏状态。

影响：`PLAN.md` 已把“中文字典接入”和“`npm run dist` 通过”标为完成，但当前实现无法只靠仓库内容完成发布构建。

建议二选一：

- 让构建脚本自动获取 pinned 数据源并校验 commit；或
- 把 release/CI 的数据源准备步骤显式脚本化，并让 `dist` 在缺少数据源时给出可执行指引；或
- 不让默认 `dist` 无条件依赖 ignored source，改成明确的 release preparation step。

### 2. P1：`docs/issues.md` 仍保留两个已过期的延期项

**位置**：[docs/issues.md:15-16](../issues.md#L15-L16)、[PLAN.md:69-70](../../PLAN.md#L69-L70)

`PLAN.md` 已把本地语言检测替换和真实中文字典数据源接入标记为完成：

- `cld3-asm` WASM 已集成到主进程，并通过 IPC bridge 给渲染端使用；
- `mapull/chinese-dictionary` JSON → SQLite 构建脚本、IPC bridge、FTS5 前缀搜索已接入。

但 `docs/issues.md` 仍写：

- 本地语言检测仍是轻量字符系统判断；
- 中文词典仍只有少量样例词条和占位释义。

这会让项目文档互相矛盾，也违反项目约定里“文档必须与代码一致、关键限制不能用完整表述掩盖”的要求。

建议：删除这两条旧 issue，或改写为当前真实限制，例如：

- release/CI 仍需可复现地准备 pinned 中文词典数据源；
- cld3 加载失败后的手动重试入口尚未实现；
- 中文单字例词目前还不是按拼音分组展示。

## 建议但不阻塞

- [electron/detect/index.ts:62-67](../../electron/detect/index.ts#L62-L67)：`init_cld3()` 在 `wasm_state === 'failed'` 后没有显式重试入口。失败后当前只能继续 regex fallback，恢复 cld3 需要重启应用。可后续加 `reset_cld3()` / `init_cld3({ force: true })`，或在配置面板暴露“重试本地语言检测”。
- [electron/detect/index.ts:88](../../electron/detect/index.ts#L88)：`cld3_factory.create(0)` 的 `0` 是 `minBytes`，语义不直观。可以改为具名常量提高可读性。
- [scripts/build_chinese_dict.ts:104-110](../../scripts/build_chinese_dict.ts#L104-L110)：单字导入仍只取第一个义项的 `words`，多音字例词无法按拼音分组展示。当前可用，但词典质量会打折。

## 已复核通过的第三轮反馈项

- `chineseDict.check().status` 和 `chineseDict.onStateChanged()` 已改为共享 union 类型，不再是开放 `string`。
- `get_service_state()` 已不再调用 `is_ready()`，避免查询状态时隐式打开数据库。
- `reload_db()` 失败时不再无条件覆盖非 ready 状态为 `failed`。
- dev 自动构建已记录 stdout/stderr，db watcher 失败也会 warn。
- `chineseDict:lookup` 已包顶层 try/catch，SQLite 异常会记录日志并返回 `null`。
- FTS 清洗逻辑已收敛到 `fts_search()`，并加入 `bm25(words_fts), length(word)` 排序。
- 构建脚本对 comma-separated JSON 尾部逗号增加了容错。
- 项目 `CLAUDE.md` 已明确 `scripts/` CLI 构建脚本可以使用 console 输出用户可见进度。

## 测试与验证记录

本轮已跑：

- `npm run typecheck`：通过；
- `npm run lint`：通过；
- `npm test`：通过，9 个 test files / 82 tests；
- `npm run dist`：字典构建和 `electron-vite build` 已通过，进入 `electron-builder` packaging 阶段后本次会话被中断/退出 137，未确认最终完整成功。

## 结论

当前代码主线可以继续推进，但合入前建议至少修复 **P0-1 打包不可复现** 和 **P1-2 文档过期 issue**。其余建议项可作为后续质量收尾。