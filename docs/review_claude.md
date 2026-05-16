# Review: 2026-05-17-local-capabilities-design.md

> 审阅日期：2026-05-17
> 审阅模型：Claude Opus 4.7
> 范围：中文字典数据导入 + cld3-asm 语言检测替换

## 总评

设计整体扎实，路径契约、错误降级、热加载、回滚开关都覆盖到位。相比前轮 review，已修复 pinned commit、LICENSE 复制、FTS 转义、WASM 状态机、is_ready 失败缓存等关键点。剩余问题集中在开发者体验与边界一致性，无 BLOCK 级。

判定：**可进入实现**，按下列 HIGH 项在实现中收口。

---

## CRITICAL
无。

## HIGH

### H1. dev 自动构建 db 与 IPC 错误描述不一致
spec L33-35 同时写「dev 启动脚本缺失则自动触发 build」和「is_ready=false 返回结构化错误，UI 提示手动执行」。两条路径并存会导致自动构建中途 UI 已渲染错误提示。
- **建议**：明确选一条。推荐「postinstall + dev 启动 prebuild」为主，IPC 错误仅作 prod 兜底。dev 模式不应出现「未构建」提示。

### H2. schema_version 类型矛盾
L94 metadata 写入示例为字符串 `"1"`，L100 又声明「schema_version 为 INTEGER」。metadata.value 列为 TEXT。
- **建议**：统一为「TEXT 存储、消费侧 parseInt」并在 spec 删除「INTEGER」字样。

### H3. characters 表 → DictResult 映射不闭环
L120-126 explanation/speech/words 都是 JSON，L258-264 又说「主进程映射、渲染层不 parse」。但多音字时 partOfSpeech 取值、definition 数组形态未规约。
- **建议**：补一段映射伪代码，明确单音字 → 单 definition、多音字 → 按读音分组多 definition 的产出形态。

### H4. FTS 输入清洗规则模糊
L236-238「strip 或 quote 转义」二选一未定，且没说前缀 `*` 由谁追加、用户输入能否含 `*`。
- **建议**：固化为「strip 所有非白名单字符 → 主进程在末尾追加 `*` 形成前缀查询」，补一例「含全角标点」测试。

### H5. cld3 未映射 BCP-47 直接返 en 与「不退化」承诺冲突
L441 未映射语言一律返 en。若 cld3 把越南语准确识别为 vi，被映射为 en，反而比 regex 表现更差（regex 至少按字符系统判定）。
- **建议**：未映射时与 regex 结果比对取「不更差」者，或在 spec 显式声明「拉丁语系未映射一律 en，承认这部分回退」。

## MEDIUM

### M1. db 体积硬约束未挂到构建脚本步骤
L338 阈值放在「性能预期」节，构建脚本步骤 L168-179 没有引用。
- **建议**：构建脚本步骤补「11. 校验输出体积，超阈值 warn/fail」。

### M2. dev 模式 mtime 监听细节缺失
L279 未指明 watcher 类型、debounce 时长、enable 条件。
- **建议**：补「fs.watch / chokidar、debounce 500ms、仅 dev 且 chinese_enabled=true」。

### M3. cld3 短文本阈值未规定
划词翻译命中短文本（< 7 字符）是常态，cld3 多数 unreliable。
- **建议**：测试用例补「<= 5 字符」短输入，验证 regex fallback 不误判「Hi」。

### M4. 缺多平台打包冒烟入口
L463 仅在风险表点 better-sqlite3，测试计划未列三平台冒烟。
- **建议**：测试计划加「dist 后 Windows/macOS/Linux 各跑一次 dict.lookup + detect:local」。

### M5. metadata schema_migration 策略未定
prod 用户拿旧 db + 新 app 会直接服务降级。
- **建议**：补「dev 模式 schema_version 低于期望则自动 rebuild；prod 模式接受降级（db 为 bundled 资源）」。

## LOW

- **L1.** `.gitignore` 同时 ignore `*.db-shm`、`*.db-wal`（WAL 模式副产物）。
- **L2.** `extraResources` 加 `filter`，显式排除 `db-shm/db-wal`。
- **L3.** L156 unicode61 CJK unigram 前缀查询「莫名其*」语法需测试时实证而非理论推断。
- **L4.** L406/L378 表述重复，可精简。
- **L5.** cld3-asm Apache-2.0 要求保留 NOTICE，本 spec 加 TODO 引用，避免后续遗漏。

---

## 文件清单核查

- ✅ 构建脚本、主进程、IPC、preload、main 注册、electron-builder、package.json、.gitignore 全覆盖
- ⚠️ 缺 `shared/types/service.ts` 引用说明（本期若 DictResult 不变请显式声明「不动」）
- ⚠️ preload 中 `detect.local` bridge 的类型声明归属未明（shared/ vs preload 内部）

## 测试覆盖核查

- ✅ FTS 验收词、查询用例、IPC、性能、cld3 准确率均覆盖
- ⚠️ 缺「源 commit 与 pinned hash 不一致」warn 路径测试
- ⚠️ 缺 `dict:reload` 在 db 文件被替换后状态切换测试
- ⚠️ 缺 cld3-asm WASM 初始化耗时上限断言（防依赖升级回归）

---

## 结论

`APPROVED with HIGH-priority refinements`。建议实现 PR 同步修订 H1-H5 后合并。MEDIUM/LOW 可实现期或独立 follow-up 处理。
