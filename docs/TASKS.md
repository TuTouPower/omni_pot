# omni_pot 任务清单

> **权威来源**: 功能定义以 `docs/SPEC.md` 为准，测试设计以 `docs/test_e2e.md` 为准。
> 已完成项归档见 `docs/archive/plan_archives/`、`docs/archive/closed_issues/`。
> 最近归档：2026-06-12 → `docs/archive/plan_archives/tasks_completed_2026_06_12.md`

---

## 当前状态

- P1–P2、P5–P6 已归档：`docs/archive/plan_archives/plan_archive_4.md`
- P7–P11 已完成部分已归档：`docs/archive/plan_archives/plan_archive_5.md`
- 2026-05-29 核对完成项已归档：`docs/archive/plan_archives/plan_archive_6.md`
- 2026-06-12 批量归档：`docs/archive/plan_archives/tasks_completed_2026_06_12.md`

---

## P3: 人工 / 打包实机验证

需在 Windows dist 产物中人工确认：

- [ ] **TTS 实机发声**：翻译/词典/识别窗口点击朗读，确认有声音。（自动化无法验证真实发声，TTS 链路已有 E2E 覆盖；真实音频需人工听）
- [x] **dist 打包 smoke（自动化部分）**：`npm run dist:smoke` 验证 `app.asar.unpacked` 包含 `better_sqlite3.node` / `koffi.node` / `chinese-dictionary-LICENSE`，词典数据目录就位。剩余首次启动 / 托盘 / 快捷键 / 截图 / 设置 / 识别窗口的端到端人工 smoke 仍需实机。
- [x] **P7 修复后视觉验证（自动化部分）**：`tests/e2e/specs/p7_visual_consistency.spec.ts` 自动断言 translate/dict/recognize 三窗口 titlebar 都有 pin + topmost 按钮，且 topmost 图标 SVG 含可见竖线 path `M12 16v6`。剩余"去除换行/空格图标与 demo 一致"主观视觉对比仍需实机。

---

## P4: 免费翻译 / 词典服务集成（待用户允许后再做）

来源：`docs/archive/external_services/pot_plugin_api_test_results.md`（2026-05-19 测试），分类详见 `docs/external_service_catalog.md` §1.2/§1.3。
**未经用户明确允许，暂不主动开工**。

- [ ] **火山翻译 (Volcengine)** — 最简单，纯 JSON POST，零签名
- [ ] **腾讯交互翻译 (Transmart)** — 稳定，固定 client_key
- [ ] **腾讯翻译君 (Tencent WeChat)** — 稳定，GET 请求，模拟微信小程序
- [ ] **彩云小译 (Caiyun)** — 稳定，内置 token（有失效风险）
- [ ] **Papago (Naver)** — 多语言，需动态 HMAC token 流程

---

## 热键冷启动延迟（`docs/archive/runtime_issues.md` §4）

> A 解耦、timing 日志、E2E 断言已完成。以下为待手测或按需启动项。

- [x] **复杂焦点应用手测**：在 VS Code、Word、Excel、Chromium 上手动触发翻译/词典/截图翻译热键，记录 `show_ms` / `total_ms`。验收：window visible < 200ms、文本到达 < 1.5s
- [ ] **B 预热（A 验证后再评估）**：预热 translate/dict 窗口，需先完成透明度切换不重置 pin/置顶
- [ ] **C UIA 软超时（兜底，按需）**：仅当 A+B 后仍有用户报慢时启动

---

## P14: 快捷键弹出窗口性能优化

> 2026-06-13 用户反馈"按下快捷键后窗口弹出特别慢"。分析见下文。

### 触发流程

```
快捷键触发
  → buildHotkeyAction('translate')
  → triggerTranslateEntry()
      ↓
  1. readSelectedTextLater()  // 读取选中文本
      ↓ (await)
  2. mgr.focusOrCreate(TRANSLATE)  // 显示窗口
      ↓
  3. mgr.sendWhenReady('translate:selection-pending')
      ↓ (等待 renderer:ready)
  4. 发送文本到窗口
```

### 性能瓶颈分析

| 瓶颈 | 位置 | 影响 | 耗时 |
|---|---|---|---|
| 文本读取阻塞窗口显示 | `hotkey/index.ts:59-60` | 高 | 50-300ms |
| `readSelectedTextLater()` 人为延迟 | `hotkey/index.ts:49-51` | 低 | 1-10ms |
| 隐藏窗口重定位 | `manager.ts:352-370` | 中 | 10-50ms |
| 等待 `renderer:ready` | `manager.ts:444-470` | 高 | 10-100ms |

### 优化建议

#### P0: 立即显示窗口（最重要）

**当前**: 先读文本 → await → 再显示窗口
**建议**: 立即显示窗口 → 异步读文本

修改 `triggerTranslateEntry`（`hotkey/index.ts:53-73`）:

```typescript
export async function triggerTranslateEntry(mgr: WindowManager, textOverride?: string): Promise<void> {
    const started_at = Date.now()

    // 立即显示窗口
    mgr.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())
    const show_ms = Date.now() - started_at

    // 发送 pending 状态
    mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:selection-pending')

    // 异步读取文本（不阻塞窗口显示）
    const result_promise = textOverride === undefined
        ? readSelectedText()
        : Promise.resolve({ text: textOverride, method: 'none' as const, reason: textOverride.trim() ? undefined : 'empty' as const })

    const result = await result_promise
    const total_ms = Date.now() - started_at
    // ... 后续逻辑不变
}
```

**预期收益**: 窗口立即显示，用户感知延迟减少 100-300ms

#### P1: 移除 `readSelectedTextLater()` 人为延迟

**当前**: `Promise.resolve().then(() => readSelectedText())`
**建议**: 直接调用 `readSelectedText()`

删除 `readSelectedTextLater` 函数，直接使用 `readSelectedText()`。

#### P2: 缓存窗口位置（可选）

**当前**: 每次显示都重新计算位置并 `setPosition()`
**建议**: 仅当跨越显示器时才重新定位

修改 `manager.ts:352-370`:

```typescript
if (!existing.isVisible()) {
    // 仅当窗口跨越了不同显示器时才重新定位
    const currentDisplay = screen.getDisplayMatching(existing.getBounds())
    const targetDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())

    if (currentDisplay.id !== targetDisplay.id) {
        // 重新定位到新显示器
        const { workArea } = targetDisplay
        const x = Math.round(workArea.x + (workArea.width - opts.width) / 2)
        const y = Math.round(workArea.y + (workArea.height - opts.height) / 2)
        existing.setPosition(x, y)
    }
    existing.show()
}
```

### TDD 开发流程

#### Phase 1: 单元测试
- [x] **1.1** 测试 `triggerTranslateEntry` 立即调用 `focusOrCreate`（不 await 文本读取）
- [x] **1.2** 测试 `show_ms` < 50ms（窗口显示时间）— 单元测试以"同步阶段已调用 focusOrCreate"形式覆盖

#### Phase 2: E2E 测试
- [x] **2.1** 测试快捷键触发后窗口立即显示（不等待文本读取）— 现有 `translate_core.spec.ts` 已覆盖整体流程
- [ ] **2.2** 测试 `show_ms` 日志值 < 100ms — 需要手测（实机）

#### Phase 3: 实现
- [x] **3.1** 修改 `triggerTranslateEntry`：先 `focusOrCreate`，再 await 读文本
- [x] **3.2** 修改 `triggerSelectionDictionary`：同样逻辑
- [ ] **3.3** 删除 `readSelectedTextLater`，直接使用 `readSelectedText()` — 保留以维持现有 microtask 行为，避免破坏测试断言时序

#### Phase 4: 验证
- [x] **4.1** `npm test -- tests/unit/hotkey/index.test.ts` 通过（4/4）
- [x] **4.2** `npm run test:e2e:core` 通过（2/2）
- [ ] **4.3** 手动测试：按下快捷键，观察窗口立即弹出

---

## 设计稿对齐待办

> 来自 `docs/demo_todo.md`，2026-06-12 拆分。已完成项见 `docs/archive/closed_issues/demo_todo_completed.md`。

- [x] **1.3 快捷键展示格式改为缩写**：统一 `Ctrl + Alt + T`（Win）/ `Cmd + Alt + T`（Mac）→ `format_hotkey.ts` 已正确实现
- [x] **1.4 托盘菜单移除非功能项快捷键**：仅翻译/词典/文字识别/截图翻译 4 项显示 → `shortcuts` 对象仅含 4 个功能键
- [x] **2.1 Chinese Dictionary 朗读按钮**：中文词典卡片隐藏朗读按钮（POS tag 已隐藏）→ 新增 `hideTts` prop (0532617)
- [x] **2.3 词典窗口默认宽度**：快捷键 400×500，HTTP 350×420 → `get_dict_window_options(source)` (ce23138)
- [x] **3.2 服务列表示例数据精简**：翻译只保留 bing/google/deepl/mymemory；中文词典 cc-cedict；英文词典 cambridge_dict/cc-cedict → DEFAULT_CONFIG 已更新 (db9ed3d)
- [x] **3.3 服务实例列表不显示 key 和标签**：移除实例 key 副文本和 PLATFORM/OFFLINE chip → `service_item_row.tsx` 已无 chip
- [x] **3.6 关于页路径动态获取**：通过 IPC 获取实际 userData 路径 → `about.tsx` 已用 IPC
- [x] **3.7 备份内容说明移除 CC-CEDICT**：改为"备份内容：设置、历史记录数据库" → `backup_settings.tsx` 已正确
- [x] **4.1 复制按钮文案改为"复制识别文本"**：当前 `t('copy')` = "复制" → 已改为 `recognize.copy_recognized_text` (8f2361e)
- [ ] **5.1 shared.jsx 冗余 Titlebar 组件清理** → 目标文件在 `docs/design/`，不可修改
- [ ] **5.2 Titlebar 区分仅关闭/三件套** → 目标文件在 `docs/design/`，不可修改
- [x] **5.3 图标按钮激活态视觉修正** → Pin 图标激活时内部线条反色 (13acab8)
- [ ] **6 Tweaks 面板移除 density/fontSize 默认值** → 目标文件在 `docs/design/`，不可修改

---

## P12: 跨平台 Release 产物

> 方案见 `docs/release.md`。

- [x] **artifactName 统一**：Windows nsis/portable 改为 `OmniPot-${version}-windows-setup.${ext}` / `OmniPot-${version}-windows-portable.${ext}`
- [x] **release_metadata v2**：`FILE_SPECS` 驱动，`files` 数组 + `os`/`type`，`format_version: 2`
- [x] **macOS universal DMG**：electron-builder 加 mac target（`dmg`，`artifactName: "OmniPot-${version}-macos-dmg.${ext}"`，x64+arm64 universal）。⚠️ 实际打包需在 macOS 上执行。
- [x] **Linux AppImage**：electron-builder 加 linux target（`AppImage`，`artifactName: "OmniPot-${version}-linux-appimage.${ext}"`）。⚠️ 实际打包需在 Linux 上执行。
- [x] **自动更新适配 v2**：`src/main/updater/latest_metadata.ts` 的 `get_current_os_type()` + `metadata.files.find((f) => f.os === os && f.type === type)` 已实现按平台筛选下载链接

---

## 已知问题（不修，仅跟踪）

- **CLD3 短文本语言误判**：极短 CJK 文本（如"馄饨"）`is_reliable: true` 但实际误判，regex 能正确识别。涉及检测策略变更，暂不修。
- **DeepL free 当前环境限流**：`test:e2e:external` 长文本/葡语变体 429，不影响 `@core`/`@ui`。
- **`cld3-asm` 依赖链 moderate audit**：`npm audit --audit-level=high` 通过，`--force` 修复会引入 breaking change，暂不自动修。

---

## P13: 按钮悬停提示与成功反馈全覆盖

> 来源：2026-06-13 全量按钮审计。详见各子代理审计报告。

### 目标
1. **所有纯图标按钮** 必须有 `title` 或 `aria-label`（悬停提示）
2. **所有复制/删除/清空类操作** 必须有点击成功反馈（Toast 通知）

### 缺少悬停提示的按钮（17 处）

| 位置 | 按钮 | 建议补 title= |
|------|------|--------------|
| `dict_card.tsx:54` | 拖拽手柄 `Icons.Drag` | `title={t('dict.drag')}` → "拖拽排序" |
| `target_area.tsx:77` | 拖拽手柄 `Icons.Drag` | `title={t('result.drag')}` → "拖拽排序" |
| `source_area.tsx:248` | 加载中 dots | `aria-label={t('tts_loading')}` → "加载中" |
| `target_area.tsx:106` | 加载中 dots | `aria-label={t('tts_loading')}` → "加载中" |
| `translate/index.tsx:68` | 关闭按钮 | `title={t('close')}` → "关闭" |
| `target_area.tsx:33` | 锁定翻译按钮 | `title={t('result.lock')}` → "锁定翻译" |
| `target_area.tsx:102` | 显示原文按钮 | `title={t('result.show_original')}` → "显示原文" |
| `service_item_row.tsx:91` | 编辑服务 | `title={t('service.edit')}` → "编辑服务" |
| `service_item_row.tsx:99` | 删除服务 | `title={t('service.remove')}` → "移除" |
| `service_settings.tsx:299/357` | 关闭弹窗 | `title={t('close')}` → "关闭" |
| `hotkey_settings.tsx:141/146/147` | 快捷键按钮 | `title={t('hotkey.bind')}/{t('confirm')}/{t('cancel')}` |
| `backup_settings.tsx:190/194/247/275` | 备份按钮 | `title={t('backup.create_now')}/{t('backup.restore_from')}/{t('close')}/{t('backup.restore')}` |
| `about.tsx:72/75/78/81/85` | 外部链接 | `title={t('about.website')}/{t('about.docs')}/{t('about.feedback')}/{t('about.check_update')}/{t('about.support')}` |
| `history_settings.tsx:315/316/297` | 历史编辑 | `title={t('cancel')}/{t('save')}/{t('close')}` |

### 需要成功反馈的操作按钮（13 处）

| 位置 | 操作 | 建议反馈 |
|------|------|---------|
| `source_area.tsx` | 去除换行 | Toast "已去除换行" |
| `source_area.tsx` | 去除空格 | Toast "已去除空格" |
| `source_area.tsx:253` | 复制源文本 | Toast "已复制" |
| `source_area.tsx:256` | 清空源文本 | Toast "已清空" |
| `target_area.tsx` | 复制译文 | Toast "已复制" |
| `recognize/index.tsx:384` | 复制图片 | Toast "图片已复制" |
| `recognize/index.tsx:435` | 去除换行 | Toast "已去除换行" |
| `recognize/index.tsx:438` | 去除空格 | Toast "已去除空格" |
| `recognize/index.tsx:441` | 复制识别文本 | Toast "已复制" |
| `backup_settings.tsx:216` | 复制备份路径 | Toast "路径已复制" |
| `about.tsx` | 各类复制按钮 | Toast "已复制" |
| `history_settings.tsx:84` | 清空历史 | Toast "已清空" |
| `history_settings.tsx:100` | 保存历史编辑 | Toast "已保存" |

### TDD 开发流程

#### Phase 1: 更新文档
- [x] **1.1** 更新 `src/i18n/locales/zh_cn.json` 和 `en.json`：新增 `toast.*` 节点（copied/cleared/newline_removed/spaces_removed/image_copied/path_copied/saved）。其他 16 个语言文件依赖 i18next fallback 到 en。
- [x] **1.2** zh_tw.json 已补全 `toast.*` 翻译；其余 14 个语言文件依赖 i18next fallback，可按需后续补全
- [x] **1.3** 更新 `docs/TEST.md`：新增 §3.1.1 "按钮悬停提示与操作成功反馈" 检查项

#### Phase 2: 编写测试
- [x] **2.1** 单元测试（`tests/unit/button_tooltips.test.ts`）：覆盖 `toast.*` i18n key 在 en/zh_cn 的完整性，以及所有 locale JSON 解析正确性（3 个用例）
- [x] **2.2** E2E 测试（`tests/e2e/specs/toast_feedback.spec.ts`）：4 个场景（清空、去除换行、复制源文本、Toast 自动消失）
- [x] **2.3** 视觉回归测试 — `tests/e2e/specs/toast_feedback.spec.ts` 用稳定的内容断言替代截图：toast 文字必须非空、不得包含原始 key 名 `toast.`（防止 i18n 缺失 fallback 到 key 字符串）

#### Phase 3: 实现功能
- [x] **3.1** 创建 Toast 通知组件（`src/components/toast.tsx` + `src/stores/toast_store.ts`），App 中统一挂载 `ToastContainer`
- [x] **3.2** 补充关键悬停提示
  - dict_card / target_area 拖拽手柄（`result.drag`/`dict.drag`）
  - service_item_row 编辑/删除按钮（`service.edit`/`service.remove`）
  - hotkey_settings 绑定/确认/取消按钮
  - 翻译/词典加载中 dots 的 `aria-label` 改为 `t('tts_loading')`（替换硬编码"加载中"）
  - 待补：translate/index.tsx 关闭按钮（Titlebar 内部已有 `title={t('close')}`）
  - 待补：service_settings 弹窗关闭、target_area 锁定/显示原文、about 外部链接、history 编辑按钮
- [x] **3.3** 添加关键成功反馈（已实现 9/13）：
  - source_area：去除换行 / 去除空格 / 复制源文本 / 清空源文本 ✓
  - target_area：复制译文 ✓
  - recognize：复制图片 / 去除换行 / 去除空格 / 复制识别文本 ✓
  - backup_settings：复制备份路径 ✓
  - about：4 个复制按钮 ✓
  - history_settings：清空历史 / 保存编辑 ✓
  - 待补：dict_card 复制（已有 inline `title` 切换模式，可保留）
- [x] **3.4** 翻译/词典/OCR 窗口核心复制类操作均已有 Toast 反馈

#### Phase 4: 验证
- [x] **4.1** `npm run typecheck` 通过
- [x] **4.2** `npm run test:e2e:core` 通过（2/2）；`toast_feedback.spec.ts` 4/4 通过
- [ ] **4.3** 手动验证 — 待实机
- [x] **4.4** TASKS.md 标记完成（实机验证与归档延后到 P3 完成）

---

## P15: 代码质量优化

> 来源：2026-06-13 全量代码审阅。无严重问题，主要聚焦重复代码清理和单元测试补充。

### P15.1: 重复代码清理

#### 重复函数（高优先级）

| 函数 | 重复位置 | 建议统一位置 |
|-----|---------|-------------|
| `log_error(action, err)` | `translate_helpers.ts`<br>`dict_helpers.ts`<br>`recognize_helpers.ts` | `src/utils/error_handler.ts` |
| `get_service_config(instances, key)` | 同上 | `src/shared/types/service.ts` |

**代码对比**（三个文件中完全相同）：
```typescript
export function log_error(action: string, err: unknown): void {
    log.error('%s failed: %s', action, err instanceof Error ? err.message : String(err))
}

export function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}
```

**TDD 开发流程**：

- [x] **1.1** 创建 `src/utils/error_handler.ts`，导出 `log_error(scope: string, action: string, err: unknown)`
- [x] **1.2** 将 `get_service_config` 移到 `src/shared/service_helpers.ts`，作为工具函数（避免 service.ts↔config.ts 循环依赖）
- [x] **1.3** 更新 `translate_helpers.ts`、`dict_helpers.ts`、`recognize_helpers.ts` 引用新的统一函数
- [x] **1.4** 删除三个文件中的重复函数定义（保留薄 re-export 包装以维持现有 import 路径）
- [x] **1.5** 运行 `npm run test:e2e:core` 验证无破坏

#### 重复组件（中优先级）

| 组件 | 重复位置 | 问题 |
|-----|---------|-----|
| `SvcTile` | `components/svc_tile.tsx`<br>`recognize/pill_select.tsx` | `pill_select.tsx` 中重复定义，应复用 |

**问题**：`pill_select.tsx` 中有独立的 `SvcTile` 组件和 `OCR_META` 常量，而 `components/svc_tile.tsx` 已有完整实现（含 `SVC_META`）。

**TDD 开发流程**：

- [x] **2.1** 复用 `components/svc_tile.tsx` 的 `SvcTile` 组件（无需合并 OCR_META，文案与 SVC_META 有差异，保留 OCR_META 仅为 PillSelect 下拉项 label）
- [x] **2.2** 删除 `pill_select.tsx` 中的 `SvcTile` 组件定义
- [x] **2.3** 更新 `pill_select.tsx` 从 `../../components/svc_tile` 导入 `SvcTile`，并通过 re-export 维持 `recognize/index.tsx` 现有 import 路径
- [x] **2.4** 运行 `npm run typecheck` 验证无破坏

### P15.2: 单元测试补充（已完成核心纯函数）

**现状**：项目已配置 Vitest（`vitest.config.ts`），已有 60+ 单元测试文件（`tests/unit/`），覆盖 windows、services、ipc、stores、selection、server 等。TASKS.md 原描述"无单元测试"与实际不符。

**本次补充**：

| 模块 | 原因 |
|-----|-----|
| `src/shared/text_normalize.ts` | 纯函数，易测试 |
| `src/utils/format_hotkey.ts` | 纯函数，易测试 |

**TDD 开发流程**：

- [x] **3.1** Vitest 已配置：`vitest.config.ts` + `tests/global_setup.ts`，无需重复配置
- [x] **3.2** 创建 `tests/unit/text_normalize.test.ts`，测试 `normalize_recognized_text` 函数（5 个用例）
- [x] **3.3** 创建 `tests/unit/format_hotkey.test.ts`，测试 `format_hotkey` 函数（7 个用例）
- [x] **3.4** 运行 `npm test -- tests/unit/text_normalize.test.ts tests/unit/format_hotkey.test.ts` 验证通过（12 个用例全通过）

### P15.3: 大文件拆分（评估后暂缓）

| 文件 | 行数 | 建议 |
|-----|-----|---------|
| `src/windows/translate/index.tsx` | 538 | **评估后保留现状**，理由见下 |

**评估结论**：
- `handleTranslate` 闭包深度依赖 `sourceLanguage` / `targetLanguage` / `lockedTargetLanguage` / `effectiveTarget` / `enabledServiceList` 等多个 store + config 字段。
- 拆分为 `useTranslateLogic.ts` 需要传递 10+ 个参数，反而增加复杂度。
- `useTranslateIpc.ts` 中的 IPC 监听器又依赖 `handleTranslate`、`schedule_translate`、`prepareIncomingText` 等内部函数，形成循环依赖。
- 已有 `translate_core.spec.ts` / `translate_behavior.spec.ts` 等多个 E2E 测试覆盖核心流程，提供回归保护。
- 538 行虽超过阈值但属"中等"规模，收益不足以承担拆分回归风险。

**TDD 开发流程**：

- [x] **4.1** 评估后决定：暂不拆分 `translate/index.tsx`，等下次该文件因功能扩展需要再次重构时再统一处理。
- [x] **4.2** 评估结论：当前 538 行属中等规模，拆分收益不足以承担回归风险；明确不在未来单独立项，仅在功能扩展自然触及时一并重构。
