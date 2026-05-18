# omni_pot 开发待办

> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_user_e2e.md` 为准。
> 本文档综合了 `docs/frontend_spec_gap_analysis.md`、`docs/design/demo_vs_implementation_diff.md`、`docs/issues.md` 的待办项。
> 已完成项归档见 `docs/archive/plan_archive_5.md`。

---

## 当前阶段

2026-05-18 用户验收发现大量 UI/体验问题。核心矛盾：**测试只验证了"链路通"，没有验证"体验对"**。
第一轮 P0 修复已完成（见下方"已完成功能"），剩余工作集中在：
1. 截图翻译窗口重做（最大工作量）
2. 翻译入口/i18n/快捷键等全局一致性修复
3. 设置页各子页与 SPEC/demo 对齐
4. 词典窗口细节补全

---

## 已完成功能

<details><summary>点击展开</summary>

- [x] 翻译结果卡片：初始折叠 + "翻译中…" → 结果到达自动展开、窗口变大
- [x] 翻译窗口最窄宽度 280、最大高度 960
- [x] 输入区默认/最大 8 行，溢出内部滚动，消除双滚动条
- [x] 输入翻译与划词翻译 hotkey 合并（主进程行为已统一）
- [x] 欢迎页窗口高度自适应，不改宽
- [x] "设置快捷键"后自动关闭窗口
- [x] 所有语言名称使用本地名称（`native_language_name()`）
- [x] 关闭窗口后重置 pin/alwaysOnTop
- [x] 词典卡片内容完整展示（不限制例句数量）
- [x] CC-CEDICT 词典编译 + 运行时自动 copy
- [x] Free Dictionary 聚合全部 entries
- [x] 设置服务页统计数字独立计算
- [x] 外部 API 端口（POST /dict, POST /recognize, GET /history）
- [x] E2E 测试断言加固（11 个 spec 文件通过）

</details>

---

## P1: 核心 UX 缺口

来源：`docs/issues.md`、`docs/frontend_spec_gap_analysis.md`（G1-G4, O1-O8, TR1-TR2, W1）、`docs/design/demo_vs_implementation_diff.md`（P0 #1-#4）。

### 1. 截图翻译窗口重做（最大单项）

当前 recognize 窗口只有"文字识别"模式，截图翻译会跳转到翻译窗口丢失原图上下文。需要重构成 SPEC 的截图翻译窗口体系。

- [ ] **窗口模式切换**：recognize 窗口支持"文字识别 / 截图翻译"两种模式，标题跟随切换（O3）
- [ ] **截图翻译右栏双卡片**：左侧大原图卡片不变；右侧改为纵向两个独立卡片——上方"识别结果"卡、下方"翻译结果"卡（O2, demo P0 #1）
- [ ] **截图翻译内联翻译**：截图翻译模式下识别完成后自动翻译，结果内联显示在下方翻译卡中，不再跳转翻译窗口（O1, demo P0 #1）
- [ ] **截图翻译独立 action bar**：截图翻译模式底部操作栏为 `复制图片 | OCR引擎 | 自动检测 | swap | 目标语言 | (spacer) | 去除换行 | 去除空格 | 复制文本 | 导出`（demo P0 #2）
- [ ] **语言切换自动重执行**：切换识别语言 → 自动重新识别；截图翻译模式切换目标语言 → 自动重新翻译（O4）
- [ ] **移除独立"重新识别"按钮**：SPEC 不允许单独重新识别按钮（O5）
- [ ] **添加"复制图片"按钮**：底栏左侧缺少（O5）
- [ ] **移除语言选择器前的 Globe 图标**（O6）
- [ ] **OCR 旧请求结果忽略**：添加 request ID guard，快速切换时旧请求不覆盖新状态（O7）
- [ ] **识别窗口添加固定(Lock)按钮**：设计稿有，当前缺失（demo diff 2.1）
- [ ] **导出 doc/docx 实际生成 Word 格式**：当前所有格式都写纯文本 Blob（O8）

### 2. 翻译入口完全合并

主进程 hotkey 已合并，但配置模型和 UI 仍暴露两个入口。

- [ ] **配置键合并**：`hotkey_selection_translate` + `hotkey_input_translate` → `hotkey_translate`（G1, M1）
- [ ] **快捷键设置页**：合并为一行"翻译"，附三行子描述说明（G1, C6）
- [ ] **欢迎页**：只显示一个"翻译"入口（已基本符合，验证配置键同步）
- [ ] **托盘**："翻译"项改为单一入口语义，尝试读取选中文本（TR2）
- [ ] **托盘添加"字典词典"菜单项**（TR1, demo P0 #4）

### 3. 快捷键展示平台化

所有显示快捷键的位置都不应出现原始 `CommandOrControl`。

- [ ] **全局工具函数**：实现 `formatHotkey(key)` — Windows/Linux 显示 `Control`，macOS 显示 `Command`（G3）
- [ ] **欢迎页快捷键提示**（G3）
- [ ] **快捷键设置页录入/展示**（G3）
- [ ] **托盘弹窗快捷键提示**（G3）

### 4. i18n 原始 key 暴露修复

- [ ] **全局排查 `t(key) || fallback`**：改为 `t(key, { defaultValue })` 或补齐 locale（G4）
- [ ] **`config.title`**：中文 locale 缺 key → 补齐或用 defaultValue（G4）
- [ ] **`delete_spaces`**：中文 locale 只有 `recognize.delete_spaces`，顶层缺失（G4）
- [ ] **设置页 `general.font_family`**：中文仍是"字体"，应改为"文字"（C4）
- [ ] **快捷键设置页按钮文案**：`ui.set` 中文是"设置"，应改为"解绑"（C6）

### 5. 欢迎页跳过关闭窗口

- [ ] **onSkip 应关闭窗口**：当前只 setWelcomeDismissed(true)，窗口仍留屏上（G2, issues）

### 6. 非固定窗口失焦自动关闭

- [ ] **统一行为**：除设置窗口外，所有非固定窗口失焦后自动关闭（W1）
- [ ] **移除旧配置**：删除 `translate_close_on_blur` / `recognize_close_on_blur` 配置项（W1, M1）

---

## P2: 设置页对齐

来源：`docs/issues.md`（设置/网络节）、`docs/frontend_spec_gap_analysis.md`（C1-C8）、`docs/design/demo_vs_implementation_diff.md`（4.3-4.9）。

### 7. 通用页

- [ ] **移除代理功能**：删除 proxy 配置项、UI 卡片、i18n 文案（C1, issues）
- [ ] **API 端口旁添加 "?" 文档按钮**：点击打开 API 文档链接（C2）
- [ ] **主题改为三按钮分段控件**：跟随系统 / 浅色 / 深色（C3, demo P1 #5）
- [ ] **移除字体预览块**：标签改"文字"，删除 Hello World 预览卡片（C4）

### 8. 快捷键页

- [ ] **4 项**：翻译、字典词典、文字识别、截图翻译（当前 5 项）（C6）
- [ ] **按钮文案**：已绑定显示"解绑"，未绑定显示"绑定"（C6）
- [ ] **翻译项附三行子描述**（demo diff 4.6）

### 9. 服务页

- [ ] **Tab 标签对齐**：`字典词典`、`文字识别`、`语音朗读`（当前用简称）（C7）
- [ ] **编辑/删除改为带文字按钮**：当前只有 icon（C7）
- [ ] **添加上移/下移按钮**：当前只有拖拽排序（C7）

### 10. 历史页

- [ ] **一行工具栏**：启用开关 + 搜索框 + 服务筛选 + 时间筛选 + 清空（C5, demo P1 #6）
- [ ] **关闭时其余操作置灰/禁用**（C5）

### 11. 备份页

- [ ] **添加外部 zip 导入入口**（C8）
- [ ] **添加恢复后校验结果 UI**（C8）

---

## P3: 词典窗口细节

来源：`docs/frontend_spec_gap_analysis.md`（D1-D4）、`docs/design/demo_vs_implementation_diff.md`（三）。

- [ ] **用户可见名称统一为"字典词典"**：窗口标题、快捷键页、托盘（D1）
- [ ] **英文输入只查英文词典（free_dictionary）**：当前还查 ecdict、cambridge_dict（D2）
- [ ] **移除"来源" chips**（D3）
- [ ] **收藏按钮移到每个词卡右上角**：当前在顶部 header card（D4）
- [ ] **单词头部添加朗读按钮**：英文/中文均需（demo diff 3.2）
- [ ] **添加 CEFR 等级标签**（demo diff 3.2）
- [ ] **结果卡片支持折叠**（demo diff 3.3, demo P2 #20）

---

## P4: 其他窗口 / 样式 / 翻译行为

### 翻译窗口

- [ ] **去除换行/空格图标对齐设计稿**：使用设计稿的 `MdSmartButton` / `CgSpaceBetween`（T1, issues）
- [ ] **Shimmer 加载骨架动画**：翻译结果加载时显示骨架屏（demo P0 #3）
- [ ] **中文长句语言检测纠偏**：纯汉字长句不应误判为日语，前端需加汉字优先逻辑（L1, issues）

### 更新窗口

- [ ] **移除 pin 按钮**：设计稿 noPin（demo P2 #15）
- [ ] **更新日志格式化**：当前用 pre-wrap 原始文本（demo diff 5）

### 托盘

- [ ] **分隔线分组对齐设计稿**（demo P2 #17）
- [ ] **行样式微调**：圆角 10px → 6px，padding/minHeight 对齐（demo P2 #18）

### 设置页补充

- [ ] **备份目标选择改为卡片按钮**（WebDAV/本地文件）（demo P2 #19）
- [ ] **WebDAV 添加"测试连接"按钮**（demo P1 #8）
- [ ] **最近备份列表添加大小/位置/复制/删除**（demo P1 #9）
- [ ] **服务页添加 OFFLINE/PLATFORM 等标签**（demo P1 #10）
- [ ] **界面语言扩展**：当前 2 种 → 设计稿 7 种（demo P1 #11）
- [ ] **侧边栏版本号对齐**（demo P2 #21）
- [ ] **历史页列顺序 + flag 标签 + 分页按钮**（demo diff 4.8）

---

## 人工验证

以下项需在 Windows dist 产物中人工确认：

- [ ] **TTS 实机发声**：翻译/词典/识别窗口点击朗读，确认有声音
- [ ] **打包后 smoke**：首次启动、托盘、快捷键、截图、设置窗口、识别窗口

---

## 已知环境问题（不修，仅跟踪）

- **谷歌翻译当前环境失败**：网络可达时复测，或更换默认免费引擎
