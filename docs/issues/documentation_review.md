# 文档审阅意见

> 日期: 2026-05-14
> 范围: 当前 `docs/`、`CLAUDE.md`、`PLAN.md`、`package.json` 与测试/服务相关源码状态
> 目的: 只记录当前仍需要处理的文档问题；已经解决的旧问题单独归档在“已解决”中，避免重复误判。

---

## 已确认决策

1. `docs/critical_paths.md` 已彻底删除。
   - 原因: 关键路径内容已经由 `docs/test_user_e2e.md` 承接，原文档不再作为权威资料。
   - 当前主文档中的引用已基本清理，不应恢复该文件。

2. E2E 测试方向统一改为 Playwright。
   - 原因: Playwright 的 locator、自动等待、trace、截图、视频和报告能力更适合长期维护完整用户端到端测试。
   - 后续: `docs/spec.md`、`docs/test.md`、`docs/test_user_e2e.md`、`package.json` 和测试目录结构都应围绕 Playwright 统一。
   - Vitest + CDP 只作为现有遗留实现和迁移参考，不再作为 E2E 主路线扩展。

3. Bing 与 OCR E2E 状态以 `docs/test_user_e2e.md` 为准。
   - `PLAN.md` 已过时，不应再作为当前状态依据。

---

## 已解决 / 不再作为问题追踪

### 1. `critical_paths.md` 主文档断链

此前记录的以下主文档断链已经解决或不再成立：

- `CLAUDE.md` 不再索引 `docs/critical_paths.md`。
- `docs/spec.md` 不再把 `docs/critical_paths.md` 作为相关文档。
- `docs/test_user_e2e.md` 开头不再引用 `docs/critical_paths.md`。

剩余的 `critical_paths.md` 字样只出现在历史设计/计划文档中，可按历史参考处理，不作为当前主文档断链阻塞项。

### 2. `docs/issues/issues/` 重复目录

此前的 `docs/issues/issues/` 命名错误已经整理为：

- `docs/issues/issues.md` — 当前已知问题记录
- `docs/issues/closed/` — 已关闭/历史问题记录
- `docs/issues/documentation_review.md` — 当前文档审阅记录

不再追踪 `docs/issues/issues/` 目录本身。

### 3. 外部服务总览文档过时

`docs/external_services/external_services.md` 已更新为以 `src/services/index.ts` 注册表为准，并已移除 Yandex / Bing Dictionary 当前可用服务描述。

该问题不再针对 `external_services.md` 追踪；剩余问题只在 `api_test_results.md` 的局部旧措辞中。

### 4. E2E 技术栈描述冲突

`docs/test.md` 和 `docs/test_user_e2e.md` 已统一为 Playwright。

### 5. `test:e2e:core` / `test:e2e:ui` 脚本缺失

`package.json` 已补齐 Playwright 依赖和分组脚本（`--project=core` / `--project=ui`）。

### 6. `docs/test_user_e2e.md` 中 `example_todo.md` 路径

已改为 `docs/design/example_todo.md`。

### 7. `docs/external_services/api_test_results.md` 推荐方案措辞

MyMemory 和 CC-CEDICT 推荐方案已与"需要处理（已完成）"段落一致。

### 8. 归档文档旧路径

`docs/issues/closed/e2e_test_infra_review.md` 已改为相对路径引用。

### 9. `docs/test_user_e2e.md` 实施路线旧 CDP 术语

实施路线中的 `launcher` / `cdp_client` / `window_handle` 旧表述已改为 Playwright 配置、Electron fixture、AppFixture、E2E API 与多窗口 Page Object 路线，并修正到第 4.5 节。

### 10. `docs/test.md` 快捷键策略旧 CDP 表述

快捷键策略中“CDP 键盘事件触发不了”的旧表述已改为“Playwright 页面级键盘事件触发不了”，与当前 E2E 主路线一致。

---

## 当前仍需修复的问题

> **2026-05-15 更新**: 以下问题已全部解决，归档至上方”已解决”章节。
> Playwright 依赖、配置文件和分组脚本已补入 `package.json`；
> `PLAN.md` 已重写；其余文档路径/措辞问题已修正。
> 剩余待办仅为 Playwright spec 文件继续落地与关键路径覆盖补齐，
> 见 `PLAN.md` P1/P2 阶段。

---

## 建议后续修复顺序

> 以下修复项均已完成（2026-05-15）。

1. ~~先补 `package.json` / Playwright 配置 / E2E 脚本~~ ✅ 已完成
2. ~~修 `docs/test_user_e2e.md` 中 `docs/design/example_todo.md` 的路径~~ ✅ 已完成
3. ~~修 `docs/issues/closed/e2e_test_infra_review.md` 中归档文档旧路径~~ ✅ 已完成
4. ~~修 `docs/external_services/api_test_results.md` 推荐方案旧措辞~~ ✅ 已完成
5. ~~重写过时的 `PLAN.md`~~ ✅ 已完成
