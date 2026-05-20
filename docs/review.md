# 测试覆盖审查 — spec / PLAN / issues 对照

> 审查日期: 2026-05-21
> 对照基准: `docs/spec.md`、`PLAN.md`、`docs/issues.md`、`docs/test_user_e2e.md`
> 审查范围: `tests/user_e2e/specs/`、`tests/unit/`、`tests/integration/`、`tests/detect/`、`tests/chinese_dict/`

本文档列出 spec / PLAN / issues 中**测试没覆盖到或覆盖不充分**的项目，按优先级和类别分组。
已完成的覆盖项见 `docs/test_user_e2e.md` §8 issues 映射表。

---

## P0 — issues.md 仍开放但测试未覆盖

| 项 | 来源 | 现状 | 建议 |
|---|---|---|---|
| 置顶按钮在所有非设置窗口都应存在且样式一致（翻译/词典/识别/截图翻译） | `issues.md` §置顶按钮 | `translate_pin_topmost` 只测翻译窗口；缺词典/识别/截图翻译窗口的存在性与样式一致性断言 | 在 `dict_window` / `recognize_window` spec 中补 `titlebar-pin` 选择器存在与点击翻转断言；视觉一致性以共享组件单测覆盖 |
| 简单中文字词查询无结果（"经济"、"自我"、"佛"） | `issues.md` §词典服务分流 | `dict_window` 用了 "经济" 但**未断言中文词典数据库真能返回非空结果**；缺"自我"/"佛"等覆盖 | 在 `dict_window` 加 dataset 表驱断言：每个常用词均渲染 `chinese_dictionary@` 卡片且 `data-result-content` 非空 |
| 中文字词应只调用中文词典 + ecdict | `issues.md` §词典服务分流 | `dict_window.spec.ts` 已有 `data-result-key` 前缀断言，但需确认 negative assertion（不出现 `cambridge_dict` / `free_dictionary`） | 强化 negative assertion |
| 英文字词应只调用 Free Dictionary / Cambridge | `issues.md` | 同上 | 同上 |
| 去除换行 / 去除空格图标与 demo 一致 | `issues.md` | 视觉项，自动化难 | 断言 SVG `path d` 等于常量，捕捉图标回退 |

---

## P1 — spec.md 明确要求但测试规划遗漏

### 1. 平台化快捷键展示
- spec §9.6、§21、§22、§28、§32：`CommandOrControl` 必须按平台解析为 `Control + Alt + T` / `Cmd + Opt + T`，**不得展示原始 `CommandOrControl`**。
- 涉及：欢迎页快捷键卡、托盘菜单右侧、快捷键设置页显示。
- 现状：`i18n.spec.ts` / `tray_layout.spec.ts` / `translate_welcome.spec.ts` 有部分涉及，但缺**对 `CommandOrControl` 字面量的 negative assertion**。
- 建议：每个相关 spec 加 `expect(page.locator('body')).not.toContainText('CommandOrControl')`。

### 2. 设置 → 通用页
- spec §9.3 要求项：
  - 本地 API 端口标签右侧的**问号按钮**贴近标签、点击打开 API 文档。
  - **不提供代理功能**（无代理卡片、无代理文案）。
  - 字体/字号同行展示，标签叫"文字"不叫"字体"，且**无预览块**。
  - 主题用**三按钮分段控件**（非下拉）。
- 现状：`config_settings.spec.ts` 未见对应断言。
- 建议：补 4 条断言。

### 3. 设置 → 历史页工具栏
- spec §9.8：
  - 启用开关 + 搜索 + 服务筛选 + 时间筛选 + 清空**一行完整展示**，不允许换行/挤占。
  - 启用关闭时其余控件**置灰禁用**。
- 现状：`config_history_backup.spec.ts` 未断言一行布局与置灰联动。
- 建议：用 bounding box 比较 y 坐标，加置灰联动断言。

### 4. 设置 → 关于页
- spec §9.10：
  - **导出日志按钮**（最近 7 天打包为 zip）。
  - **版本号格式**：`version x.y.z · platform-arch`。
  - 真实日志目录路径（来自 `log:getDir` IPC）。
- 现状：完全未覆盖。
- 建议：新增 `config_about.spec.ts` 或合入 `config_settings.spec.ts`。

### 5. 识别 / 截图翻译窗口
- spec §8.5：
  - **切换识别语言后自动重新识别**，无需手动点击。
  - **截图翻译模式切换目标语言后自动重新翻译**。
  - 文字识别窗口和截图翻译窗口**共用同一窗口体系**（不拆两个窗口概念）。
- 现状：`recognize_window.spec.ts` 涉及切换但未明确断言"切换语言→自动触发"链路。
- 建议：补"切换识别语言→断言 OCR 重跑（请求计数/结果文本变化）"以及"切换目标语言→断言翻译重跑"。

### 6. 翻译结果卡片
- spec §5.4：
  - `stream` 标签不显示 ✓（`translate_result_cards.spec.ts` 已覆盖）
  - 等待时折叠 + 轻量动效；返回后自动展开 ✓（`translate_result_states.spec.ts` 已覆盖）
  - **用户手动折叠/展开后保持状态，直到下一次新翻译请求重置** — 未见明确断言。
  - **重试只重新调用该服务实例**（不重跑全部服务）— 未见明确断言。
- 建议：补 2 条断言。

### 7. 语言检测
- spec §17：
  - **失败回退链 `bing → google → baidu → tencent → niutrans → local`**。
  - **中文长句不被误判为日语**（如重复 "我爱你"）— spec §5.4 显式约束。
  - 检测引擎与目标语言相同 → 回退到 `translate_second_language`（`translate_behavior.spec.ts` 有相关用例，需确认强断言）。
- 现状：`tests/detect/cld3.test.ts` 仅 cld3 单测；回退链未端到端覆盖。
- 建议：单元层加 mock 模拟逐个引擎失败的回退顺序；E2E 加 "我爱你×N → 检测为中文" 断言。

### 8. 备份与恢复
- spec §26、§32：**导出的 zip 必须可作为恢复输入重新导入**；恢复后配置 / 历史记录 / 随包 CC-CEDICT DB 数据一致。
- 现状：`config_history_backup.spec.ts` 有 restore 测试，但需要确认是否走"导出 → 重新导入 → 三类数据回验"完整闭环。
- 建议：明确加上"备份创建后 close→relaunch→restore→比对配置 + 历史条目 + 词典查询"闭环断言。

### 9. i18n 缺失 key 处理
- spec §28、§32：缺失 key 必须显示明确 fallback，**不展示 `welcome.translate` / `Delete_spaces` 等原始翻译 key**。
- 现状：`i18n.spec.ts` 有 fallback 测试，需确认 negative assertion（搜索"原始 key 字面量不出现"）。
- 建议：补 negative assertion，覆盖去除换行/空格按钮、欢迎页、托盘菜单等高风险点。

### 10. 托盘弹窗
- spec §21：
  - **宽度由内容自然决定**，不使用固定宽度，不预留大块空白。
  - **不允许先显示空白弹窗**（renderer 内容和菜单文案就绪后才显示）。
- 现状：`tray_layout.spec.ts` 应覆盖布局；"先空白后填充"难自动化。
- 建议：能做的至少是断言菜单首次出现时所有项文案非空。

---

## P2 — 单元 / 集成层薄弱

| 项 | spec 章节 | 现状 |
|---|---|---|
| HTTP API 端点 `POST /translate`、`GET /config`、`/recognize` stub 行为 | §20 | 未见专门集成测；E2E 仅用 `/trigger-*` 路径 |
| 选中文本 fallback 链（UIA → Ctrl+C → sentinel → restore） | §24 | `tests/unit/selection/clipboard.test.ts` 覆盖局部 |
| CSP 策略（`connect-src` https、`media-src blob:`、`worker-src blob:`、WASM 执行） | §3.4 | 未见验证 |
| better-sqlite3 native rebuild + 打包 unpacked（issue #1） | §29 | 走 dist smoke，未自动化 |
| 翻译历史按**实例 key** 存 `service_key`（同服务多实例） | §25 | 未见专门断言 |
| 服务实例 `config.enable=false` 时**保留在列表中但不参与执行** | §12.3 | `config_service_mgmt.spec.ts` 有启停，需确认是否断言"保留在列表" |
| 剪贴板抑制窗口（划词翻译 Ctrl+C 回退期间不误触发监听） | §23 | 单测覆盖局部 |

---

## P3 — 已记录但只能人工 / 打包验证

来自 `PLAN.md` 与 `issues.md`：

- TTS 实机发声（翻译/词典/识别窗口点击朗读真实有声音）
- dist 打包 smoke（首次启动、托盘、快捷键、截图、设置、识别）
- 谷歌翻译当前环境失败（环境问题，不修，仅跟踪）
- 置顶图钉竖线视觉确认

---

## 建议下一步（按收益高低）

1. **词典服务分流强断言 + 中文常用词真实返回非空** — 直接关闭 3 条 issues。
2. **平台化快捷键展示 negative assertion**：全局搜 `CommandOrControl` 字面量在 UI 中不出现，托盘/欢迎页/快捷键页/欢迎页快捷键卡均覆盖。
3. **置顶按钮全窗口存在性**：词典/识别/截图翻译 spec 加 `titlebar-pin` 选择器存在与点击翻转断言。
4. **识别/截图翻译切换语言自动重跑**：补 `recognize_window` 用例。
5. **历史工具栏单行布局 + 启用开关置灰联动**。
6. **关于页"导出日志"按钮 + 版本号格式**。
7. **备份导出 zip 再导入回环测试**。
8. **设置 → 通用页 4 项**：API 端口问号、无代理、文字一行、主题三按钮。
9. **结果卡片"手动折叠保持态"和"重试只重跑当前实例"**。
10. **语言检测回退链 + "我爱你"中文不误判日语**。
