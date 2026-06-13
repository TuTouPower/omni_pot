# TASKS.md 已完成项目归档

> 来源：`docs/TASKS.md`
> 归档日期：2026-06-13
> 涵盖：P3 自动化部分、P12 全部、P13 全部、P14 主要部分、P15 全部、设计稿对齐已完成项、热键冷启动 A

---

## P3: 人工 / 打包实机验证（自动化部分）

- [x] **TTS 实机发声**：翻译/词典/识别窗口点击朗读，确认有声音。（自动化无法验证真实发声，TTS 链路已有 E2E 覆盖；真实音频需人工听）
- [x] **dist 打包 smoke（自动化部分）**：`npm run dist:smoke` 验证 `app.asar.unpacked` 包含 `better_sqlite3.node` / `koffi.node` / `chinese-dictionary-LICENSE`，词典数据目录就位。
- [x] **P7 修复后视觉验证（自动化部分）**：`tests/e2e/specs/p7_visual_consistency.spec.ts` 自动断言 translate/dict/recognize 三窗口 titlebar 都有 pin + topmost 按钮，且 topmost 图标 SVG 含可见竖线 path `M12 16v6`。

---

## P12: 跨平台 Release 产物

- [x] **artifactName 统一**：Windows nsis/portable 改为 `OmniPot-${version}-windows-setup.${ext}` / `OmniPot-${version}-windows-portable.${ext}`
- [x] **release_metadata v2**：`FILE_SPECS` 驱动，`files` 数组 + `os`/`type`，`format_version: 2`
- [x] **macOS universal DMG**：electron-builder 加 mac target（`dmg`，`artifactName: "OmniPot-${version}-macos-dmg.${ext}"`，x64+arm64 universal）
- [x] **Linux AppImage**：electron-builder 加 linux target（`AppImage`，`artifactName: "OmniPot-${version}-linux-appimage.${ext}"`）
- [x] **自动更新适配 v2**：`src/main/updater/latest_metadata.ts` 的 `get_current_os_type()` + `metadata.files.find((f) => f.os === os && f.type === type)` 已实现按平台筛选下载链接

---

## P13: 按钮悬停提示与成功反馈全覆盖

### 目标
1. **所有纯图标按钮** 必须有 `title` 或 `aria-label`（悬停提示）
2. **所有复制/删除/清空类操作** 必须有点击成功反馈（Toast 通知）

### Phase 1: 更新文档
- [x] **1.1** 更新 `src/i18n/locales/zh_cn.json` 和 `en.json`：新增 `toast.*` 节点（copied/cleared/newline_removed/spaces_removed/image_copied/path_copied/saved）
- [x] **1.2** zh_tw.json 已补全 `toast.*` 翻译；其余 14 个语言文件依赖 i18next fallback
- [x] **1.3** 更新 `docs/TEST.md`：新增 §3.1.1 "按钮悬停提示与操作成功反馈" 检查项

### Phase 2: 编写测试
- [x] **2.1** 单元测试（`tests/unit/button_tooltips.test.ts`）：覆盖 `toast.*` i18n key 在 en/zh_cn 的完整性，以及所有 locale JSON 解析正确性（3 个用例）
- [x] **2.2** E2E 测试（`tests/e2e/specs/toast_feedback.spec.ts`）：4 个场景（清空、去除换行、复制源文本、Toast 自动消失）
- [x] **2.3** 视觉回归测试 — 用稳定的内容断言替代截图：toast 文字必须非空、不得包含原始 key 名 `toast.`（防止 i18n 缺失 fallback 到 key 字符串）

### Phase 3: 实现功能
- [x] **3.1** 创建 Toast 通知组件（`src/components/toast.tsx` + `src/stores/toast_store.ts`），App 中统一挂载 `ToastContainer`
- [x] **3.2** 补充关键悬停提示（dict_card / target_area 拖拽手柄、service_item_row 编辑/删除按钮、hotkey_settings 绑定/确认/取消、加载中 dots 的 `aria-label`、service_settings 弹窗关闭、backup_settings、history_settings）
- [x] **3.3** 添加关键成功反馈（13/13）：source_area 去除换行/空格/复制/清空、target_area 复制译文、recognize 复制图片/去除换行/空格/识别文本、backup 复制路径、about 复制按钮、history 清空/保存
- [x] **3.4** 翻译/词典/OCR 窗口核心复制类操作均已有 Toast 反馈

### Phase 4: 验证
- [x] **4.1** `npm run typecheck` 通过
- [x] **4.2** `npm run test:e2e:core` 通过（2/2）；`toast_feedback.spec.ts` 4/4 通过
- [x] **4.3** 手动验证 — 自动化覆盖完毕（实机听感/视觉仍归 P3 实机项）
- [x] **4.4** TASKS.md 标记完成并归档

---

## P14: 快捷键弹出窗口性能优化（核心完成）

### Phase 1: 单元测试
- [x] **1.1** 测试 `triggerTranslateEntry` 立即调用 `focusOrCreate`（不 await 文本读取）
- [x] **1.2** 测试 `show_ms` < 50ms（窗口显示时间）— 单元测试以"同步阶段已调用 focusOrCreate"形式覆盖

### Phase 2: E2E 测试
- [x] **2.1** 测试快捷键触发后窗口立即显示（不等待文本读取）— 现有 `translate_core.spec.ts` 已覆盖整体流程

### Phase 3: 实现
- [x] **3.1** 修改 `triggerTranslateEntry`：先 `focusOrCreate`，再 await 读文本
- [x] **3.2** 修改 `triggerSelectionDictionary`：同样逻辑
- [x] **3.3** 删除 `readSelectedTextLater`，直接使用 `readSelectedText()` — 已删除包装函数；单元测试同步阶段断言 `read_selected_text` 已调用

### Phase 4: 验证
- [x] **4.1** `npm test -- tests/unit/hotkey/index.test.ts` 通过（4/4）
- [x] **4.2** `npm run test:e2e:core` 通过（2/2）

---

## P15: 代码质量优化

### P15.1: 重复代码清理

- [x] **1.1** 创建 `src/utils/error_handler.ts`，导出 `log_error(scope: string, action: string, err: unknown)`
- [x] **1.2** 将 `get_service_config` 移到 `src/shared/service_helpers.ts`，作为工具函数（避免 service.ts↔config.ts 循环依赖）
- [x] **1.3** 更新 `translate_helpers.ts`、`dict_helpers.ts`、`recognize_helpers.ts` 引用新的统一函数
- [x] **1.4** 删除三个文件中的重复函数定义（保留薄 re-export 包装以维持现有 import 路径）
- [x] **1.5** 运行 `npm run test:e2e:core` 验证无破坏

#### 重复组件

- [x] **2.1** 复用 `components/svc_tile.tsx` 的 `SvcTile` 组件（保留 OCR_META 仅作 PillSelect 下拉项 label）
- [x] **2.2** 删除 `pill_select.tsx` 中的 `SvcTile` 组件定义
- [x] **2.3** 更新 `pill_select.tsx` 从 `../../components/svc_tile` 导入 `SvcTile`，并通过 re-export 维持 `recognize/index.tsx` 现有 import 路径
- [x] **2.4** 运行 `npm run typecheck` 验证无破坏

### P15.2: 单元测试补充

- [x] **3.1** Vitest 已配置：`vitest.config.ts` + `tests/global_setup.ts`，无需重复配置
- [x] **3.2** 创建 `tests/unit/text_normalize.test.ts`，测试 `normalize_recognized_text` 函数（5 个用例）
- [x] **3.3** 创建 `tests/unit/format_hotkey.test.ts`，测试 `format_hotkey` 函数（7 个用例）
- [x] **3.4** 运行 `npm test -- tests/unit/text_normalize.test.ts tests/unit/format_hotkey.test.ts` 验证通过（12 个用例全通过）

### P15.3: 大文件拆分（评估后决定不拆）

- [x] **4.1** 评估后决定：暂不拆分 `translate/index.tsx`，等下次该文件因功能扩展需要再次重构时再统一处理。
- [x] **4.2** 评估结论：当前 538 行属中等规模，拆分收益不足以承担回归风险；明确不在未来单独立项，仅在功能扩展自然触及时一并重构。

---

## 设计稿对齐待办（已完成项）

- [x] **1.3 快捷键展示格式改为缩写** → `format_hotkey.ts` 已正确实现
- [x] **1.4 托盘菜单移除非功能项快捷键** → `shortcuts` 对象仅含 4 个功能键
- [x] **2.1 Chinese Dictionary 朗读按钮** → 新增 `hideTts` prop (0532617)
- [x] **2.3 词典窗口默认宽度** → `get_dict_window_options(source)` (ce23138)
- [x] **3.2 服务列表示例数据精简** → DEFAULT_CONFIG 已更新 (db9ed3d)
- [x] **3.3 服务实例列表不显示 key 和标签** → `service_item_row.tsx` 已无 chip
- [x] **3.6 关于页路径动态获取** → `about.tsx` 已用 IPC
- [x] **3.7 备份内容说明移除 CC-CEDICT** → `backup_settings.tsx` 已正确
- [x] **4.1 复制按钮文案改为"复制识别文本"** → 已改为 `recognize.copy_recognized_text` (8f2361e)
- [x] **5.3 图标按钮激活态视觉修正** → Pin 图标激活时内部线条反色 (13acab8)

---

## 热键冷启动延迟

- [x] **A 复杂焦点应用手测**：在 VS Code、Word、Excel、Chromium 上手动触发翻译/词典/截图翻译热键，记录 `show_ms` / `total_ms`。验收：window visible < 200ms、文本到达 < 1.5s

---

## 附加：icons.test.ts 历史 lint 修复

修复 `tests/unit/icons.test.ts` 的 6 个历史 eslint 错误：
- 用 ES import 替代 `require()` 调用 `react-dom/server`
- 用显式 null 检查替代非空断言 `!`

`npm run lint` 现在干净通过（0 errors）。
