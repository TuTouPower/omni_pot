# 隐私/安全审计报告 — omni_pot 公开前扫描

**日期**：2026-06-12
**仓库**：D:\Kar\Code\omni_pot
**分支**：master
**提交数**：569

---

## 扫描范围

- 当前工作树全部文件
- 全部 git 历史（569 提交）
- 扫描模式：API key/token/密码/私钥、邮箱、个人路径、内部域名、敏感文档、二进制文件

---

## 结论总览

| 类别 | 结果 |
|------|------|
| 真实 API key / token | **未发现** |
| 密码 / 连接字符串 | **未发现** |
| 私钥 / SSH key / 证书 | **未发现** |
| 个人邮箱（非 noreply） | **未发现** |
| 个人文件路径 | **发现** — 需处理 |
| 个人域名 | **发现** — 需处理 |
| 内部敏感文档 | **发现** — 需处理 |
| Git 历史残留 | **全部敏感信息在历史中可恢复** |

---

## 1. 个人文件路径

暴露开发者本地机器路径和 WSL 路径（用户名 `karon`/`Karson`，目录 `karson_ubuntu`）。

### 当前文件

| 文件 | 行号 | 内容类别 |
|------|------|----------|
| `CLAUDE.md` | 39, 86, 120 | WSL 路径、个人 clone 路径 |
| `scripts/build_chinese_dictionary.ts` | 9 | WSL 回退路径 |
| `scripts/publish_release.mjs` | 14 | 个人 Cloudflare 服务路径 |
| `docs/superpowers/specs/2026-05-31-release-update-download-design.md` | 7, 140 | 个人网站 / Cloudflare 路径 |
| `docs/superpowers/plans/2026-05-31-release-update-download.md` | 644, 650, 655 | 个人网站路径 |
| `docs/superpowers/plans/2026-05-06-pot-desktop-p1.md` | 92 | 个人项目路径 |
| `docs/design/omni-pot/project/uploads/spec.md` | 7 | 个人 clone 路径 |
| `docs/archive/old_pot/spec.md` | 7 | 个人 clone 路径 |
| `docs/archive/closed_issues/issues0518.md` | 14, 95-98 | WSL/Git Bash 路径 |
| `docs/archive/reviews/review.md` | 7 | 本地项目路径 |
| `tests/unit/packaging/publish_release.test.ts` | 61 | 个人 Cloudflare 路径 |
| `.reasonix/truncated-results/1780150303947-c41a8f6f-wait_for_job.txt` | 1 | 测试失败日志含大量本地路径 |

### Git 历史

上述所有个人路径均存在于 git 历史中。删除当前文件**不能**清除历史。

---

## 2. 个人/内部域名

| 域名 | 出现位置 | 性质 |
|------|----------|------|
| `downloads.zzzkkkccc.site` | `scripts/release_metadata.mjs`、`scripts/publish_release.mjs`、`docs/superpowers/` | Cloudflare R2 发布下载域名 |

### 处理建议

- 如果此域名是个人基础设施、不打算公开维护：替换为占位符或移除相关脚本
- 如果打算公开提供下载：可保留，但需确认没有暴露其他敏感信息

---

## 3. 敏感内部文档

### docs/superpowers/ — 完整研发计划

| 文件 | 敏感内容 |
|------|----------|
| `specs/2026-05-31-release-update-download-design.md` | R2 存储桶布局、发布脚本流程、更新元数据选择逻辑、个人网站源码路径 |
| `plans/2026-05-31-release-update-download.md` | 具体构建命令、个人网站文件路径、Cloudflare 配置路径 |
| `plans/2026-05-06-pot-desktop-p1.md` | 个人项目路径 |

**建议**：公开前移除整个 `docs/superpowers/` 目录。

### docs/archive/ — 历史问题与 review

| 文件 | 敏感内容 |
|------|----------|
| `reviews/review.md` | 本地路径、历史安全漏洞（secret 未加密/脱敏） |
| `closed_issues/issues0518.md` | WSL 路径问题、本地环境细节 |
| `handoffs/handoff_2026_05_18_qrcode_followup.md` | 会话交接、内部讨论 |
| `old_pot/spec.md` | 个人 clone 路径 |
| `plan_archives/plan_archive_6.md` | 历史开发计划 |

**建议**：公开前移除整个 `docs/archive/` 目录。

### CLAUDE.md

包含项目内部约定、私有仓库拓扑、WSL 路径。不适合原样公开。

**建议**：重写为面向社区贡献者的 `CONTRIBUTING.md`，去除本地路径和私有仓库细节。

### docs/release.md

文档标记源仓库为"私有"，描述公开/私有仓库分离结构。

**建议**：重写为公开发布流程文档，去除私有仓库引用。

---

## 4. 不应公开的产物文件

| 文件 | 大小 | 说明 |
|------|------|------|
| `.reasonix/truncated-results/` | 92 KB | 测试失败日志，含本地绝对路径 |
| `docs/design/omni_pot-handoff.tar.gz` | 678 KB | 设计交接存档，含 13 个 chat 文件 |
| `1048576` | 0 B（空文件） | 可疑临时文件 |

**建议**：全部移除。

---

## 5. 大型跟踪二进制

| 文件 | 大小 | 说明 |
|------|------|------|
| `data/dict/cc_cedict.db` | 24 MB | CC-CEDICT 词典数据库（SQLite） |
| `public/tesseract/core/*.wasm` | 2.8–4.7 MB × 多个 | Tesseract OCR WebAssembly 运行时 |

**建议**：确认许可协议（CC-CEDICT 为 CC BY-SA 4.0），如合规可保留。Tesseract 为 Apache 2.0，可保留。

---

## 6. package.json

| 字段 | 当前值 | 建议 |
|------|--------|------|
| `author` | `"TuTouPower"` | 可保留 |
| `private` | `true` | 公开后改为 `false` 或移除 |
| `repository` | 未设置 | 添加公开后的仓库 URL |

---

## 7. 占位测试密钥

以下为测试文件中的占位值，非真实密钥，但仍建议 review：

| 文件 | 示例值 |
|------|--------|
| `tests/unit/backup.test.ts` | `server_api_token: 'server-token-secret'` |
| `tests/integration/config_store.test.ts` | `server_api_token: 'plain-token'` |
| `tests/e2e/specs/app_http_api.spec.ts` | `api_key: 'mymemory-secret'` |
| `tests/unit/log.test.ts` | `api_key: 'abcd1234wxyz'` |
| `tests/unit/server/test_server_security.ts` | `server_api_token: 'secret-token'` |

这些值仅用于测试，不构成泄露。但建议全局搜索替换为更明显是测试占位符的值（如 `test-placeholder-key`）。

---

## 8. 未发现的安全问题

以下模式在所有扫描中**均未命中**：

- `sk-ant-` / `sk-or-` — Anthropic API key
- `sk-[A-Za-z0-9]{20,}` — OpenAI API key
- `ghp_` / `gho_` / `ghu_` / `ghs_` / `ghr_` — GitHub personal token
- `xox[baprs]-` — Slack token
- `hf_` — HuggingFace token
- `ya29.` — Google OAuth token
- `AKIA...` — AWS access key（当前文件中的匹配均在编译的 .wasm/.min.js 中，为 false positive）
- `-----BEGIN ...` — 私钥/证书标记
- `mongodb://` / `postgres://` / `mysql://` / `redis://` — 数据库连接串
- 真实个人邮箱地址

---

## 9. Git 历史问题

**这是最关键的问题。** 当前 569 个提交中包含本文档列出的所有敏感信息。即使清理当前文件并创建新提交，任何人 clone 仓库后仍可通过 `git log -p` 恢复全部敏感内容。

### 历史中确认存在

- 个人路径：`/home/karon/...`、`\\wsl.localhost\...`、`D:/Kar/Code/...`
- 内部文档：`CLAUDE.md`、`docs/release.md`、`docs/superpowers/*`、`docs/archive/*`
- 个人域名：`downloads.zzzkkkccc.site`
- 工具产物：`.reasonix/*`

### 处理方案

**方案 A：历史重写**
- 用 `git filter-repo` 清理历史中的敏感路径和域名
- 保留提交结构，但所有 commit hash 会变
- 需要 force push，所有协作者需要重新 clone
- 风险：可能遗漏某些敏感信息

**方案 B：新仓库（推荐）**
- 从清理后的当前树创建新仓库，单次初始 commit
- 完全干净，零残留
- 简单安全
- 代价：丢失 569 提交的历史

---

## 公开前检查清单

- [ ] 移除 / 重写 `CLAUDE.md`
- [ ] 移除 `docs/superpowers/` 整个目录
- [ ] 移除 `docs/archive/` 整个目录
- [ ] 移除 `docs/design/omni_pot-handoff.tar.gz`
- [ ] 移除 `.reasonix/` 整个目录
- [ ] 移除空文件 `1048576`
- [ ] 清理 `scripts/build_chinese_dictionary.ts` 中的 WSL 路径
- [ ] 清理 `scripts/publish_release.mjs` 中的个人路径
- [ ] 清理 `scripts/release_metadata.mjs` 中的个人域名
- [ ] 清理 `tests/unit/packaging/publish_release.test.ts` 中的个人路径
- [ ] 清理 `docs/design/omni-pot/project/uploads/spec.md` 中的个人路径
- [ ] 重写 `docs/release.md` 为公开版本
- [ ] 确认 `package.json` 的 `private` 和 `author` 字段
- [ ] 确认 `cc_cedict.db` 和 Tesseract 资源的许可分发
- [ ] 决定 Git 历史处理方案（重写 or 新仓库）
- [ ] 如选历史重写：验证清理后历史中无残留
