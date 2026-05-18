# omni_pot 开发待办

> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_user_e2e.md` 为准。
> 本文档记录当前阶段和下一步计划，可能滞后于实际代码状态。

---

## 当前阶段

2026-05-18 用户验收发现大量问题。核心矛盾：**测试只验证了"链路通"，没有验证"体验对"**。布局/视觉/交互细节几乎没有有效断言。当前优先修复用户体验问题，同时补上测试断言。

---

## 下一步

按优先级排列：

### P0: 用户体验缺陷修复（`docs/issues.md` 当前清单）

先修实现，再补/加固测试断言。

#### 翻译窗口

- [x] **翻译结果展示方式**：初始状态 3 个翻译结果卡片默认折叠、显示"翻译中…"；结果到达后自动展开卡片、窗口自动变大
- [x] **翻译窗口最窄宽度**：minWidth 调至 280（接近语言栏自然宽度）；如实测仍有富余可再下调
- [x] **翻译窗口最大高度**：maxHeight 调至 960（覆盖 3 卡 × 8 行场景）
- [x] **输入区默认/最大 8 行汉字**：textarea 固定 8 行（rows=8, maxHeight=176），溢出走内部滚动
- [x] **输入长文本双滚动条**：滚动条移到 textarea，外层不再滚动
- [x] **输入翻译与划词翻译合并为一个功能**：两个 hotkey 现在都映射到 `triggerTranslateEntry`；欢迎页合并为一项"翻译"

#### 欢迎页

- [x] **窗口大小适配内容**：欢迎页 mount 时通过 `window:setContentSize` IPC 让主进程把翻译窗口高度调到内容高度
- [x] **点"设置快捷键"后自动关闭**：调用 `window.close()`

#### 语言名称

- [x] **所有语言名称使用本地名称**：翻译/识别窗口、检测语言提示均切换为 `native_language_name()`

#### 置顶/固定

- [x] **关闭窗口后重置**：translate 窗口 `closed` 事件中重置 `translate_pinned` 与 `translate_always_on_top`

#### 词典

- [x] **词典卡片内容完整展示**：移除 `examples.slice(0,3)`，全部例句渲染
- [x] **划词字典改名为"查询字典"或"词典"**：19 个 locale 已统一
- [x] **中文词典搜索修复**：`resources/data/dict/chinese_dict.db` 已通过 `npm run build:chinese-dict` 生成（86MB，gitignored）
- [ ] **CC-CEDICT 词典修复**：仍依赖运行时下载（dict UI 中的"Download Dictionary"按钮），未在本轮跑通
- [x] **Free Dictionary 内容扩充**：聚合所有 entries（不再只用 `entries[0]`），多义词/专有名词内容更完整

#### 设置 — 服务页面

- [x] **统计数字独立**：`categoryCounts` 按 tab 预先计算

#### 外部 API

- [x] **服务端口 API 编写 + 文档**：新增 `POST /dict`，实现真实 `GET /history` 分页；文档见 [docs/external_api.md](docs/external_api.md)。`POST /recognize` 仍是 stub，已在文档中标注

### P0: 测试断言加固

针对上述修复，同步加固对应测试。核心原则：**测试必须断言"体验对"，不能只断言"链路通"**。

| 测试文件 | 需要加固的断言 |
|---|---|
| `translate_welcome.spec.ts` | 窗口高度 == 内容高度；点"设置快捷键"后欢迎页消失 |
| `translate_window_constraints.spec.ts` | 最窄宽度 == 语言栏自然宽度（差值断言）；最大高度 == 3×8 行文本高度 |
| `translate_input_rows.spec.ts` | 滚动条数量 == 1（断言 `overflow-y` 或 scrollbar 元素计数） |
| `translate_result_cards.spec.ts` | 初始状态卡片默认折叠；结果到达后自动展开 |
| `translate_pin_topmost.spec.ts` | 关闭窗口后重新打开，pin/topmost 恢复默认 |
| `i18n.spec.ts` | 语言下拉列表中的语言名称为 native name |
| `config_service_mgmt.spec.ts` | 切换 tab 后统计栏数字不变 |
| `dict_issues.spec.ts` | 中文词搜索返回结果；卡片内容不截断 |
| `dict_window.spec.ts` | Free Dictionary 返回充足内容 |
| 新增 `translate_entry_merge.spec.ts` 扩展 | 欢迎页上入口已合并为一个 |
| 新增 `dict_card_height.spec.ts` | 词典卡片高度自适应内容 |

### P0: 未完成的遗留项

- [ ] **Windows 实机 smoke 验收**：首次启动、托盘、快捷键、截图、设置/识别窗口（自动化通过后仍需人工执行）
- [ ] **TTS 朗读发声**：自动化只能验 IPC 链路，发声本身归为 Windows 实机 smoke
- [ ] **谷歌翻译失效**：当前环境仍失败，保留 issue，不用 mock 隐藏
- [ ] **TTS playback state e2e**：`translate_source_area.spec.ts` 和 `translate_result_cards.spec.ts` 中针对 TTS 的按压/取消等待断言已降级为存在性 smoke。要恢复完整断言需要在 `app_fixture` 加 `init_script` 选项，在渲染进程注入受控的 `window.speechSynthesis` stub（用于决定何时触发 `onend`）

---

## 历史已完成

见 `docs/archive/plan_archive_5.md`。
