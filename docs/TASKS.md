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

- [ ] **TTS 实机发声**：翻译/词典/识别窗口点击朗读，确认有声音。
- [ ] **dist 打包 smoke**：`npm run dist` 后验证首次启动、托盘、快捷键、截图、设置、识别窗口，并确认 `better-sqlite3` 的 `*.node` 位于 `app.asar.unpacked` 且词典/历史数据库可正常打开。
- [ ] **P7 修复后视觉验证**：确认置顶/固定按钮四窗口一致、图钉竖线可见、去除换行/空格图标与 demo 一致。

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
- [ ] **1.1** 测试 `triggerTranslateEntry` 立即调用 `focusOrCreate`（不 await 文本读取）
- [ ] **1.2** 测试 `show_ms` < 50ms（窗口显示时间）

#### Phase 2: E2E 测试
- [ ] **2.1** 测试快捷键触发后窗口立即显示（不等待文本读取）
- [ ] **2.2** 测试 `show_ms` 日志值 < 100ms

#### Phase 3: 实现
- [ ] **3.1** 修改 `triggerTranslateEntry`：先 `focusOrCreate`，再 await 读文本
- [ ] **3.2** 修改 `triggerSelectionDictionary`：同样逻辑
- [ ] **3.3** 删除 `readSelectedTextLater`，直接使用 `readSelectedText()`

#### Phase 4: 验证
- [ ] **4.1** `npm test` 通过
- [ ] **4.2** `npm run test:e2e` 通过
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
- [ ] **macOS universal DMG**：electron-builder 加 mac target（`dmg`，`artifactName: "OmniPot-${version}-macos.${ext}"`）
- [ ] **Linux AppImage**：electron-builder 加 linux target（`AppImage`，`artifactName: "OmniPot-${version}-linux.${ext}"`）
- [ ] **自动更新适配 v2**：`src/main/updater/` 按 `os` 筛选 `files` 数组匹配对应平台下载链接

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
- [ ] **1.1** 更新 `src/i18n/locales/zh_cn.json`：新增以下 key
  ```json
  "dict": { "drag": "拖拽排序" },
  "result": { "drag": "拖拽排序", "lock": "锁定翻译", "show_original": "显示原文" },
  "tts_loading": "加载中",
  "close": "关闭",
  "confirm": "确认",
  "cancel": "取消",
  "service": { "edit": "编辑服务", "remove": "移除" },
  "hotkey": { "bind": "绑定快捷键" },
  "backup": { "create_now": "立即备份", "restore_from": "从备份恢复", "restore": "恢复" },
  "about": { "website": "官网", "docs": "文档", "feedback": "问卷反馈", "check_update": "检查更新", "support": "支持作者" },
  "save": "保存",
  "toast": {
    "copied": "已复制",
    "cleared": "已清空",
    "newline_removed": "已去除换行",
    "spaces_removed": "已去除空格",
    "image_copied": "图片已复制",
    "path_copied": "路径已复制",
    "saved": "已保存"
  }
  ```
- [ ] **1.2** 同步到 `src/i18n/locales/en.json`、`zh_tw.json` 等其他语言文件（英文翻译需符合 UX 规范）
- [ ] **1.3** 更新 `docs/TEST.md`：新增"按钮悬停提示"和"操作成功反馈"的测试检查项

#### Phase 2: 编写测试
- [ ] **2.1** 单元测试（`tests/unit/button_tooltips.test.ts`）
  - 测试所有纯图标按钮都有 `title` 或 `aria-label`
  - 测试硬编码中文 `aria-label="加载中"` 不存在，应使用 i18n key
- [ ] **2.2** E2E 测试（`tests/e2e/button_interaction.spec.ts`）
  - 测试复制/去除换行/去除空格/清空操作后出现 Toast 通知
  - 测试 Toast 文案正确（使用 i18n key）
  - 测试 Toast 自动消失（~2 秒）
- [ ] **2.3** 视觉回归测试（`tests/e2e/ui/button_tooltips.spec.ts`）
  - 截图对比按钮悬停状态（tooltip 可见）

#### Phase 3: 实现功能
- [ ] **3.1** 创建 Toast 通知组件（`src/components/toast.tsx`，若不存在）
  - 支持 `show(message: string, duration?: number)` API
  - 默认显示在窗口底部中央，淡入淡出动画
  - 支持队列（多个 Toast 不重叠）
- [ ] **3.2** 补充悬停提示（17 处）
  - 按位置逐文件添加 `title` 或 `aria-label`
  - 硬编码中文改为 i18n key（两处 `aria-label="加载中"`）
- [ ] **3.3** 添加成功反馈（13 处）
  - 每个操作完成后调用 `toast.show(t('toast.xxx'))`
  - 复制类操作可复用现有 `copied` 状态 UI，统一改用 Toast
- [ ] **3.4** 确保翻译/词典/OCR 窗口所有小按钮都有提示和反馈

#### Phase 4: 验证
- [ ] **4.1** 运行 `npm test` — 单元测试通过
- [ ] **4.2** 运行 `npm run test:e2e` — E2E 测试通过
- [ ] **4.3** 手动验证 — 打包后实机测试每个按钮的悬停提示和点击反馈
- [ ] **4.4** 更新 `docs/TASKS.md` — 标记完成，归档到 `docs/archive/closed_issues/`

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

- [ ] **1.1** 创建 `src/utils/error_handler.ts`，导出 `log_error(scope: string, action: string, err: unknown)`
- [ ] **1.2** 将 `get_service_config` 移到 `src/shared/types/service.ts`，作为工具函数
- [ ] **1.3** 更新 `translate_helpers.ts`、`dict_helpers.ts`、`recognize_helpers.ts` 引用新的统一函数
- [ ] **1.4** 删除三个文件中的重复函数定义
- [ ] **1.5** 运行 `npm run test:e2e` 验证无破坏

#### 重复组件（中优先级）

| 组件 | 重复位置 | 问题 |
|-----|---------|-----|
| `SvcTile` | `components/svc_tile.tsx`<br>`recognize/pill_select.tsx` | `pill_select.tsx` 中重复定义，应复用 |

**问题**：`pill_select.tsx` 中有独立的 `SvcTile` 组件和 `OCR_META` 常量，而 `components/svc_tile.tsx` 已有完整实现（含 `SVC_META`）。

**TDD 开发流程**：

- [ ] **2.1** 将 `OCR_META` 合并到 `components/svc_tile.tsx` 的 `SVC_META` 中
- [ ] **2.2** 删除 `pill_select.tsx` 中的 `SvcTile` 组件定义
- [ ] **2.3** 更新 `pill_select.tsx` 从 `../../components/svc_tile` 导入 `SvcTile`
- [ ] **2.4** 运行 `npm run test:e2e` 验证无破坏

### P15.2: 单元测试补充（高优先级）

**现状**：仅有 E2E 测试（20+ 文件），无单元测试。

**优先覆盖模块**（纯函数优先）：

| 模块 | 原因 |
|-----|-----|
| `src/shared/text_normalize.ts` | 纯函数，易测试 |
| `src/utils/format_hotkey.ts` | 纯函数，易测试 |
| `src/windows/translate/translate_helpers.ts` | 工具函数 |
| `src/windows/dict/dict_helpers.ts` | 工具函数 |
| `src/services/` 各翻译服务 | 核心业务逻辑 |
| `src/stores/translate_store.ts` | 状态管理逻辑 |

**TDD 开发流程**：

- [ ] **3.1** 配置 Vitest（若未配置）：`npm install -D vitest @vitest/ui`，更新 `vite.config.ts` 添加 `test: { globals: true, environment: 'node' }`
- [ ] **3.2** 创建 `tests/unit/text_normalize.test.ts`，测试 `normalize_recognized_text` 函数
- [ ] **3.3** 创建 `tests/unit/format_hotkey.test.ts`，测试 `format_hotkey` 函数
- [ ] **3.4** 创建 `tests/unit/translate_helpers.test.ts`，测试 `normalize_source_text` 函数
- [ ] **3.5** 运行 `npm test` 验证通过

### P15.3: 大文件拆分（中优先级）

| 文件 | 行数 | 建议拆分 |
|-----|-----|---------|
| `src/windows/translate/index.tsx` | 538 | 拆分为 `useTranslateLogic.ts`、`useTranslateIpc.ts`、保持 UI 组件简洁 |

**当前职责**：翻译逻辑、IPC 监听、语言切换、历史记录、剪贴板等。

**拆分建议**：

- [ ] **4.1** 创建 `src/windows/translate/useTranslateLogic.ts`：提取 `handleTranslate`、`schedule_translate`、`prepareIncomingText` 等核心翻译逻辑
- [ ] **4.2** 创建 `src/windows/translate/useTranslateIpc.ts`：提取所有 IPC 事件监听器（`useEffect` 订阅）
- [ ] **4.3** 简化 `TranslateWindow.tsx`：仅保留 UI 结构和事件绑定
- [ ] **4.4** 运行 `npm run test:e2e` 验证无破坏
