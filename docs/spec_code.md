# spec vs 代码对比报告

> 生成日期: 2026-05-28
> 方法: 只读比对，不修改任何文件

---

## 1. 技术栈（§2）

| 项目 | spec 声称 | 代码实际 | 状态 |
|---|---|---|---|
| Electron | 35+ | ^39.8.10 | OK（"35+" 包含 39） |
| React | 19 | ^19.2.5 | OK |
| TypeScript | — | ^6.0.3 | spec 未写版本号，无冲突 |
| Tailwind CSS | — | ^4.2.4 | spec 未写版本号，无冲突 |
| Zustand | — | ^5.0.13 | OK |
| better-sqlite3 | — | ^12.9.0 | OK |
| koffi | — | ^2.16.2 | OK |
| i18next | — | ^26.0.8 | OK |
| electron-vite | — | ^5.0.0 | OK |

**结论**: 无冲突。spec 只对 Electron 给了下限，其他未锁版本。

---

## 2. 窗口标签（§3.1）

| 标签 | spec | 代码 | 差异 |
|---|---|---|---|
| DAEMON / TRANSLATE / SCREENSHOT / RECOGNIZE / DICT / CONFIG / UPDATER | ✓ | ✓ | — |
| **TRAY** | **缺失** | 有 `TRAY = 'tray'` | **spec 需补** |

代码 `electron/windows/types.ts` 多了 `TRAY = 'tray'`。

---

## 3. 翻译服务清单（§13）

spec 列 20 个，代码注册 21 个。

| 差异 | 详情 |
|---|---|
| **代码多了 `ecdict`（CC-CEDICT）** | `src/services/ecdict.ts`，key=`ecdict`，中英词典服务。spec 完全未提及 |

代码注册顺序（`src/services/index.ts`）:
bing, google, deepl, cambridge_dict, alibaba, baidu, baidu_field, caiyun, niutrans, youdao, volcengine, transmart, tencent, openai, chatglm, geminipro, ollama, mymemory, free_dictionary, chinese_dictionary, **ecdict**

---

## 4. OCR 服务清单（§14）

spec 16 个，代码 16 个（含条件注册的 system OCR）。**完全一致。**

---

## 5. TTS 服务（§15）

spec 1 个（system_tts），代码 1 个。**完全一致。**

---

## 6. 默认服务实例（§12.3）

### DEFAULT_SERVICE_INSTANCES 差异

| 实例 key | spec | 代码 | 差异 |
|---|---|---|---|
| bing@default | ✓ | ✓ | — |
| google@default | ✓ | ✓ | — |
| deepl@default | ✓ | ✓ | — |
| mymemory@default | ✓ | ✓ | — |
| tesseract@default | ✓ | ✓ | — |
| free_dictionary@default | ✓ | ✓ | — |
| chinese_dictionary@default | ✓ | ✓ | — |
| cambridge_dict@default | ✓ | ✓ | — |
| system_tts@default | ✓ | ✓ | — |
| **system@default** | **缺失** | ✓ | **spec 需补** |
| **qrcode@default** | **缺失** | ✓ | **spec 需补** |
| **ecdict@default** | **缺失** | ✓ | **spec 需补** |

---

## 7. 配置键（§18.2）

### 代码有但 spec 缺失的键（11 个）

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `welcome_dismissed` | boolean | `false` | 欢迎页已跳过标记 |
| `dict_always_on_top` | boolean | `false` | 词典窗口置顶 |
| `dict_pinned` | boolean | `false` | 词典窗口固定 |
| `recognize_always_on_top` | boolean | `false` | 识别窗口置顶 |
| `recognize_pinned` | boolean | `false` | 识别窗口固定 |
| `recognize_remember_window_size` | boolean | `true` | 识别窗口记忆尺寸 |
| `recognize_window_width` | number | `860` | 识别窗口宽度 |
| `recognize_window_height` | number | `520` | 识别窗口高度 |
| `hotkey_selection_translate` | string | `''` | 旧划词翻译快捷键（已废弃，spec §9.6 只留 4 个键） |
| `hotkey_input_translate` | string | `''` | 旧输入翻译快捷键（同上） |
| `english_dictionary_service_list` | string[] | `['cambridge_dict@default', 'ecdict@default']` | 英文词典列表 |

### 默认值不一致

| 键 | spec 默认值 | 代码默认值 | 差异 |
|---|---|---|---|
| `dictionary_service_list` | `['chinese_dictionary@default']` | `['chinese_dictionary@default', 'ecdict@default']` | 代码多了 ecdict |

### spec 有但代码无的键

无。spec 列的所有键都在 AppConfig 中存在。

---

## 8. DictResult 类型（§12.1）

| 字段 | spec | 代码 | 差异 |
|---|---|---|---|
| `type: 'dict'` | ✓ | ✓ | — |
| `pronunciations` | ✓ | ✓ | — |
| `definitions` | ✓ | ✓ | — |
| `examples` | ✓ | ✓ | — |
| **`partsOfSpeech?: string[]`** | **有** | **无** | **代码缺失或 spec 过时** |
| **`inflections?: string[]`** | **有** | **无** | **代码缺失或 spec 过时** |

代码 `shared/types/service.ts` 的 `DictResult` 只有 `type`, `pronunciations`, `definitions`, `examples` 四个字段。

---

## 9. HTTP API（§19）

### POST /recognize 行为不一致

| spec 描述 | 代码实现 |
|---|---|
| "预留（当前为 stub）" | **完整实现**：解析 `{ mode: "translate" }` 参数，调用 `start_screenshot_capture(mgr, mode)` |

### E2E 端点差异

spec 列 5 个 E2E 端点，代码有 19 个（新增的都在 `/e2e/` 命名空间下）。

spec 列的（旧式）:
- `POST /trigger-selection`, `/trigger-dict`, `/trigger-clipboard`, `/trigger-clipboard-translate`
- `GET /capture-clock`

代码新增的（新式 `/e2e/`）:
- `POST /e2e/open-window`, `/e2e/reset-config`, `/e2e/set-config`, `/e2e/trigger-screenshot`, `/e2e/trigger-input-translate`, `/e2e/trigger-hotkey`, `/e2e/hotkey-system-failures`, `/e2e/tray-action`, `/e2e/mock-update`
- `GET /e2e/clipboard`, `/e2e/clipboard-image`, `/e2e/window-state`, `/e2e/primary-display`, `/e2e/tray-menu`

### GET /config E2E 绕过

代码在有 E2E token 时返回完整未脱敏配置，spec 未提及。

---

## 10. IPC 通道（§18）

### spec 有但代码无

| 方法 | 命名空间 |
|---|---|
| `dict.import` | dict |

### 代码有但 spec 缺失的命名空间

| 命名空间 | 方法 |
|---|---|
| `translate` | `reportContentHeight`, `reportMinWidth` |
| `shell` | `openExternal` |
| `log` | `getDir`, `export`, `write` |
| `chineseDict` | `lookup`, `check`, `reload`, `onStateChanged` |
| `update` | `onRelease`, `downloadAndInstall`, `onDownloadProgress` |
| `tray` | `show`, `close`, `action`, `labels`, `clipboardMonitoring`, `popupReady` |
| `detect` | `local` |

### 代码有但 spec 缺失的方法（已文档化的命名空间内）

| 命名空间 | 额外方法 |
|---|---|
| `window` | `setContentSize`, `setContentHeight`, `openConfig`, `onConfigNavigate` |
| `config` | `getUserDir` |
| `text` | `writeClipboardImage`, `onTranslateSelectionEmpty`, `onDictSelectionEmpty` |
| `history` | `serviceKeys` |
| `backup` | `listWithSize`, `import`, `delete`, `getPath` |

---

## 11. 最终决断

### SPEC 需更新（10 项）

| # | 条目 | 判定 | 操作 |
|---|---|---|---|
| 1 | §3.1 缺少 `TRAY` 标签 | SPEC | 补 `TRAY = 'tray'`，说明托盘弹窗是自定义 BrowserWindow |
| 2 | §13 缺少 ecdict 服务 | SPEC | 补第 21 行：`ecdict` / CC-CEDICT / 免费 / 中英词典 |
| 3 | §12.3 DEFAULT_SERVICE_INSTANCES 缺 3 个 | SPEC | 补 `system@default`, `qrcode@default`, `ecdict@default` |
| 4 | §18.2 缺少 9 个配置键 | SPEC | 补 `welcome_dismissed`, `dict_always_on_top`, `dict_pinned`, `recognize_always_on_top`, `recognize_pinned`, `recognize_remember_window_size`, `recognize_window_width`, `recognize_window_height`, `english_dictionary_service_list` |
| 5 | §18.2 `dictionary_service_list` 默认值 | SPEC | 默认值改为 `['chinese_dictionary@default', 'ecdict@default']` |
| 6 | §18 `english_dictionary_service_list` | SPEC | spec 用单一 `dictionary_service_list` 描述词典，代码已拆分中文/英文两个独立列表；spec 需改为两个键 |
| 7 | §19 `POST /recognize` 描述 | SPEC | 删除"预留（当前为 stub）"，改为已完整实现 |
| 8 | §18 E2E 端点列表 | SPEC | 补齐 `/e2e/` 命名空间下 14 个端点 |
| 9 | §18 IPC 通道表 | SPEC | 补 `translate`, `shell`, `log`, `chineseDict`, `update`, `tray`, `detect` 7 个命名空间及各命名空间内遗漏的方法 |
| 10 | §19 GET /config E2E 绕过 | SPEC | 补充 E2E token 存在时返回未脱敏配置的行为说明 |

### SPEC 需删除（3 项）

| # | 条目 | 判定 | 操作 |
|---|---|---|---|
| 11 | §12.1 DictResult 的 `partsOfSpeech` / `inflections` | SPEC 删除 | 这两个字段从未实现，词形变化卡片 spec 已写"不再渲染"，属于残留定义，从 DictResult 类型中删除 |
| 12 | §18 `dict.import` | SPEC 删除 | spec 列了但从未实现，从 IPC 表中删除 |
| 13 | §6.2 独立发音卡片 | SPEC 删除 | spec 写"源词卡片下方紧接一张独立发音卡片，展示第一个有结果服务的 pronunciations"。代码实际做法：发音嵌在每个词典服务的 `SortableDictCard` 内部（`index.tsx:91-111`），跟释义、例句同卡，没有独立发音卡。spec 需删除"独立发音卡片"描述，改为发音随各服务结果卡片内展示 |

### 代码需清理（1 项）

| # | 条目 | 判定 | 操作 |
|---|---|---|---|
| 13 | `hotkey_selection_translate` / `hotkey_input_translate` | 代码清理 | spec §9.6 已明确只保留 4 个快捷键（合并为单一翻译入口），这两个旧键是废弃残留。清理 `AppConfig` 中的定义，运行时不再读写；或保留但标注 `@deprecated` 并在 spec 中说明向后兼容意图 |

### 无需改动（确认 OK）

| # | 条目 | 判定 |
|---|---|---|
| 14 | §2 技术栈版本 | 无冲突，不需要改 |
| 15 | §14 OCR 服务清单 | 一致 |
| 16 | §15 TTS 服务 | 一致 |
| 17 | spec 有但代码无的配置键 | 无 |

---

*报告结束。*
