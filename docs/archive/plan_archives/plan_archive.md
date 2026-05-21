# PLAN.md 归档 — 2026-05-18

> 以下为 PLAN.md 中已完成的工作，归档于此以保持 PLAN.md 聚焦当前待办。

---

## 已完成：P0 产品缺陷与测试重审

- [X] 全量重审 Playwright/Vitest 测试，改掉按当前错误实现补断言的用例
- [X] 为 `docs/issues.md` 中的开放问题补失败测试或人工验收步骤
- [X] 先解决规格冲突：欢迎页、OCR/TTS 默认服务
- [X] 修复通用窗口加载转圈、设置/识别窗口尺寸与拖动、下拉框裁剪等窗口基础问题
- [X] 继续修复快捷键、OCR/TTS、服务管理、i18n 等功能闭环

## 已完成：P0 用户验收 spec

- [X] `translate_result_states.spec.ts` — 翻译失败重试 + 卡片折叠+加载动效
- [X] `translate_input_rows.spec.ts` — 输入框动态行数限制
- [X] `translate_window_constraints.spec.ts` — 翻译窗口 max-height / min-height / min-width
- [X] `translate_pin_topmost.spec.ts` — 固定/置顶拆分
- [X] `translate_entry_merge.spec.ts` — 选中/输入翻译合并
- [X] `tray_layout.spec.ts` — 托盘 popover 布局
- [X] `terminology_settings.spec.ts` — UI 文案术语统一
- [X] `dict_issues.spec.ts` — 中文单字查询 + header 卡片不遮挡
- [X] `window_rounded_corner.spec.ts` — 窗口圆角
- [X] `screenshot_latency.spec.ts` — 截图 OCR 唤起卡顿

## 已完成：P0 Playwright E2E 基础设施

- [X] 安装 Playwright 依赖
- [X] 实现 `electron_app.ts`、`app_fixture.ts`、`e2e_api.ts`
- [X] 源码侧补齐 `data-testid`
- [X] 扩充全部 E2E HTTP 端点
- [X] 实现独立 userData 临时目录
- [X] 删除旧 Vitest + CDP E2E 文件

## 已完成：P1 旧已修复问题回归 spec

- [X] `translate_titlebar.spec.ts`、`translate_source_area.spec.ts`、`translate_language_area.spec.ts`、`translate_core.spec.ts`

## 已完成：P1 核心窗口 spec

- [X] `translate_result_cards.spec.ts`、`dict_window.spec.ts`、`recognize_window.spec.ts`、`config_settings.spec.ts`

## 已完成：P2 行为与管理类 spec

- [X] `translate_behavior.spec.ts`、`screenshot_window.spec.ts`、`app_lifecycle.spec.ts`、`config_service_mgmt.spec.ts`、`config_history_backup.spec.ts`、`updater_and_tray.spec.ts`、`i18n.spec.ts`

## 已完成：P2 其他

- [X] 对齐 UI 设计稿（已知偏差记录到 `docs/design/demo_todo.md`）
- [X] CSP `connect-src` 放开
- [X] 命名统一（Omni Pot / omni_pot）
- [X] 服务管理全功能实现
- [X] 重新修复已知产品缺陷
- [X] 本地语言检测（cld3-asm WASM）
- [X] 接入真实中文字典数据源（mapull/chinese-dictionary → SQLite）
- [X] 插件系统延期决策
- [X] 代码质量检查体系

## 历史已完成基础工作

- [X] 全部 UI 重写（翻译/词典/识别/截图/配置/更新器窗口）
- [X] Bing Translate 修复
- [X] 全部 22 个 API 测试
- [X] MyMemory 翻译服务
- [X] Free Dictionary 词典服务
- [X] CC-CEDICT 离线词典
- [X] 字典模式
- [X] OCR E2E 测试
- [X] 截图覆盖层修复
- [X] 国际化（19 种语言）
- [X] E2E 测试方向统一为 Playwright
- [X] 文档审阅与清理
