# TASKS.md 归档 — 2026-05-22

> 以下为 `TASKS.md` 在 2026-05-22 已完成的章节，自当前 TASKS 中移除归档于此。
> 前序归档见 `plan_archive.md`、`plan_archive_2.md`、`plan_archive_3.md`。

---

## P1: 语言检测重构（cld3-asm 替换远程 API 回退链）✅

> 测试报告：`docs/archive/external_services/lang_detect_api_test_20260521.md`。
> 结论：5 个远程检测 API（Bing/Google/Baidu/Tencent/NiuTrans）在当前环境全部不可用；
> cld3-asm 15 种语言 30/30 全部正确，体积 6.3MB，初始化 7ms，速度最快。
> spec §17 / §5.4 的"回退链 + 中文不误判日语"要求改由 cld3-asm 单一引擎满足，远程回退链整体移除。

全部 8 项任务已完成。

---

## P1.2: 文字识别"自动去除换行"默认关闭 ✅

全部 5 项任务已完成。

---

## P1.3: 透明背景默认关闭 ✅

全部 4 项任务已完成。

---

## P1.4: 设置页面 UI 精简（基于 chat12 / chat13 设计决策）✅

全部 9 项任务已完成。

---

## P2: 单元 / 集成层薄弱项 ✅

全部 7 项任务已完成。

---

## P5: 测试覆盖缺口（2026-05-21 spec ↔ tests 审计）✅

P5.1（6/6）、P5.2（6/6）、P5.3（2/2）全部完成。

---

## P6: 测试文档与代码一致性 ✅

test.md / test_user_e2e.md 已同步。
