# 测试覆盖审查 — spec / PLAN / issues 对照

> 审查日期: 2026-05-21
> 对照基准: `docs/spec.md`、`PLAN.md`、`docs/issues.md`、`docs/test_user_e2e.md`
> 审查范围: `tests/user_e2e/specs/`、`tests/unit/`、`tests/integration/`、`tests/detect/`、`tests/chinese_dict/`

本文档列出 spec / PLAN / issues 中**测试没覆盖到或覆盖不充分**的项目。
已完成项的实施记录已归档至 `docs/archive/plan_archive_3.md` "第四轮 review.md 覆盖加固"。

---

## 仍未实施

### 1. 语言检测回退链 + "我爱你"中文不误判日语

- spec §17：**失败回退链 `bing → google → baidu → tencent → niutrans → local`**
- spec §5.4：**中文长句不被误判为日语**（如重复 "我爱你"）
- spec §17：检测引擎与目标语言相同 → 回退到 `translate_second_language`

**现状**: `tests/detect/cld3.test.ts` 仅 cld3 单测；回退链未端到端覆盖。
**建议**:
- 单元层 mock 模拟逐个引擎失败的回退顺序
- E2E 加 "我爱你×N → 检测为中文" 断言
- `translate_behavior.spec.ts` 已有相关用例，需确认强断言

### 2. 单元 / 集成层薄弱

| 项 | spec 章节 | 现状 |
|---|---|---|
| HTTP API 端点 `POST /translate`、`GET /config`、`/recognize` stub 行为 | §20 | 未见专门集成测；E2E 仅用 `/trigger-*` 路径 |
| 选中文本 fallback 链（UIA → Ctrl+C → sentinel → restore） | §24 | `tests/unit/selection/clipboard.test.ts` 覆盖局部 |
| CSP 策略（`connect-src` https、`media-src blob:`、`worker-src blob:`、WASM 执行） | §3.4 | 未见验证 |
| better-sqlite3 native rebuild + 打包 unpacked（issue #1） | §29 | 走 dist smoke，未自动化 |
| 翻译历史按**实例 key** 存 `service_key`（同服务多实例） | §25 | 未见专门断言 |
| 服务实例 `config.enable=false` 时**保留在列表中但不参与执行** | §12.3 | `config_service_mgmt.spec.ts` 有启停，需确认是否断言"保留在列表" |
| 剪贴板抑制窗口（划词翻译 Ctrl+C 回退期间不误触发监听） | §23 | 单测覆盖局部 |

### 3. 只能人工 / 打包验证

来自 `PLAN.md` 与 `issues.md`：

- TTS 实机发声（翻译/词典/识别窗口点击朗读真实有声音）
- dist 打包 smoke（首次启动、托盘、快捷键、截图、设置、识别）
- 谷歌翻译当前环境失败（环境问题，不修，仅跟踪）
- 置顶图钉竖线视觉确认
- 去除换行 / 去除空格图标与 demo 一致性
