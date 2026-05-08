# Critical Paths — 关键路径文档

> 本文档描述 omni_pot 应用的所有用户关键路径。
> 每条路径对应一个完整的用户操作流程，列出涉及的文件和数据流。

---

## CP1: 划词翻译

**流程**: 用户在任意应用选中文字 → 按快捷键 → 翻译窗口弹出 → 多服务并行翻译 → 结果展示

```
用户选中文字 → 按快捷键
  → electron/hotkey/index.ts: triggerSelectionTranslate()
    → electron/selection/index.ts: readSelectedText()  [读取选中文本]
    → electron/windows/manager.ts: focusOrCreate(TRANSLATE)
    → manager.sendWhenReady('translate:from-selection', text)
      → 翻译窗口 renderer 收到 IPC
        → src/stores/translate_store.ts: setSourceText(text)
        → src/windows/translate/index.tsx: handleTranslate()
          → 遍历 translate_service_list，并行调用 service.translate()
          → 结果写入 store → TargetArea 渲染卡片
```

**涉及文件**:
- `electron/hotkey/index.ts` — 快捷键注册与 action 分发
- `electron/selection/index.ts` — 跨平台选中文本提取
- `electron/windows/manager.ts` — 窗口创建/聚焦/消息发送
- `src/windows/translate/index.tsx` — 翻译窗口主组件
- `src/windows/translate/source_area.tsx` — 源文本输入区域
- `src/windows/translate/target_area.tsx` — 结果卡片（拖拽排序/折叠/收藏/重试）
- `src/windows/translate/language_area.tsx` — 语言选择器 + 交换
- `src/stores/translate_store.ts` — 翻译状态管理
- `src/services/registry.ts` — 服务注册表
- `src/services/detect.ts` — 语言检测（bing/google/baidu/tencent/niutrans/local）

**关键行为**:
- 源语言 auto 时调用 detect 服务，检测结果与目标语言相同则回退到第二语言
- 多服务 `Promise.allSettled` 并行翻译
- 支持 OpenAI/Ollama 流式输出（`translateStream` AsyncGenerator）
- requestId 机制防止旧结果覆盖新结果

---

## CP2: 输入翻译

**流程**: 用户在翻译窗口输入文本 → 按 Enter → 翻译

```
用户输入文本 → 按 Enter
  → src/windows/translate/source_area.tsx: handleKeyDown()
    → onTranslate() 回调
      → src/windows/translate/index.tsx: handleTranslate()
        → 同 CP1 翻译流程
```

**涉及文件**: 同 CP1 + `src/windows/translate/source_area.tsx`

**关键行为**:
- `dynamic_translate` 开启时，输入 1s 防抖自动翻译
- Alt+Shift+U 对选中文本循环变量名格式（snake/screaming_snake/kebab/dot/space/title/camel/pascal）
- IME 处理：`isComposing` 时跳过快捷键

---

## CP3: 截图 OCR 识别

**流程**: 用户按截图快捷键 → 屏幕截图覆盖层 → 选择区域 → OCR 窗口显示识别结果

```
按快捷键
  → electron/hotkey/index.ts: start_screenshot_capture(mgr, 'recognize')
    → electron/screenshot/index.ts: captureScreenshot()
      → 创建 SCREENSHOT 窗口（全屏透明覆盖）
      → 用户选区 → 返回 base64 图片
    → electron/ipc/ocr_handlers.ts: process OCR
      → tesseract.js (renderer) 或 system OCR (main process IPC)
    → 创建 RECOGNIZE 窗口
      → src/windows/recognize/index.tsx: 显示图片 + 识别文字
```

**涉及文件**:
- `electron/screenshot/index.ts` — 截图覆盖层 + 区域选择
- `electron/ipc/ocr_handlers.ts` — OCR IPC 处理
- `src/services/ocr/system.ts` — 系统 OCR（Windows WinRT / Linux tesseract）
- `src/windows/recognize/index.tsx` — 识别结果窗口
- `src/windows/screenshot/index.tsx` — 截图覆盖层 UI

**关键行为**:
- 识别结果可编辑
- 可切换 OCR 服务/语言，重新识别
- "翻译" 按钮调用 `ocr:send-to-translate` 将文字发到翻译窗口

---

## CP4: 截图 OCR 翻译

**流程**: 同 CP3 但 mode='translate'，OCR 结果直接送入翻译窗口

```
start_screenshot_capture(mgr, 'translate')
  → 截图选区 → OCR 识别
  → manager.sendWhenReady(TRANSLATE, 'translate:from-api', ocrText)
    → 翻译窗口执行翻译
```

**涉及文件**: CP3 文件 + 翻译窗口文件

---

## CP5: 划词字典

**流程**: 用户选中文字 → 按字典快捷键 → 字典窗口弹出 → 多字典服务查询

```
按字典快捷键
  → electron/hotkey/index.ts: triggerSelectionDictionary()
    → readSelectedText()
    → focusOrCreate(DICT)
    → sendWhenReady('dict:lookup', text)
      → src/windows/dict/index.tsx: handleLookup()
        → 遍历 dictionary_service_list，并行调用 service.translate()
        → 返回 DictResult 的服务渲染为字典卡片
```

**涉及文件**:
- `electron/hotkey/index.ts` — 快捷键触发
- `electron/selection/index.ts` — 文本提取
- `src/windows/dict/index.tsx` — 字典窗口
- `src/stores/dict_store.ts` — 字典状态
- `src/services/free_dictionary.ts` — dictionaryapi.dev 英文词典
- `src/services/ecdict.ts` — CC-CEDICT 离线中英词典
- `electron/dict/index.ts` — CC-CEDICT SQLite 数据库
- `electron/ipc/dict_handlers.ts` — 字典查询 IPC

**CC-CEDICT 数据流**:
```
renderer: ecdict.translate()
  → window.electronAPI.dict.lookup(text, from, to)
    → IPC → electron/dict/index.ts: lookup_chinese() / lookup_english()
      → better-sqlite3 查询 cc_cedict.db
        → 返回 DictResult | null
```

**CC-CEDICT 首次启动**:
```
electron/main.ts: auto_import_if_needed()
  → electron/dict/index.ts: 检查数据库是否已有数据
    → 无数据 → 读取 data/dict/cedict.txt.gz
    → 解压 → 解析 CC-CEDICT 文本格式 → 批量 INSERT 到 SQLite
    → 重建 FTS5 索引
```

**关键行为**:
- 字典服务返回 `DictResult`（type='dict'）才渲染为字典卡片
- free_dictionary 在线查询英文音标/词性/释义
- CC-CEDICT 离线查询：中文→英文（simplified/traditional 精确匹配），英文→中文（LIKE 模糊搜索）

---

## CP6: 剪贴板翻译

**流程**: 复制文字到剪贴板 → 监听器自动触发翻译

```
clipboard_monitor = true
  → electron/clipboard/index.ts: startClipboardMonitor()
    → 轮询剪贴板变化
    → 检测到新文本 → focusOrCreate(TRANSLATE)
    → sendWhenReady('translate:from-clipboard', text)
      → 翻译窗口执行翻译
```

**涉及文件**:
- `electron/clipboard/index.ts` — 剪贴板监听
- 其余同翻译流程

---

## CP7: 配置管理

**流程**: 用户打开配置窗口 → 修改设置 → 实时生效 + 持久化

```
用户打开配置窗口（托盘或 tray_click_event）
  → src/windows/config/index.tsx: 侧栏导航
    → 各配置页面:
      - general.tsx: 主题/字体/代理/启动/更新/开发者模式
      - translate_settings.tsx: 语言/检测引擎/自动复制/窗口行为
      - recognize_settings.tsx: OCR 语言/行为
      - hotkey_settings.tsx: 快捷键录制
      - service_settings.tsx: 服务添加/删除/排序/配置
      - history_settings.tsx: 历史记录开关/清空/分页浏览/编辑
      - backup_settings.tsx: WebDAV/本地备份
      - about.tsx: 版本/技术栈/链接
```

**数据流**:
```
renderer: useConfig(key) hook
  → 读: useConfigStore(s => s.config[key])
  → 写: useConfigStore.set(key, value)
    → electron/preload.ts: config:set IPC
      → electron/config/store.ts: setConfig(key, value)
        → 写入 userData/config.json
        → 广播 config:changed 到所有窗口
          → renderer: config.onChange() → zustand store 更新
```

**涉及文件**:
- `electron/config/store.ts` — JSON 配置持久化 + 变更广播
- `electron/ipc/config_handlers.ts` — 配置 IPC
- `src/hooks/use_config.ts` — React hook
- `src/stores/config_store.ts` — Zustand 配置 store
- `shared/types/config.ts` — AppConfig 类型 + 默认值
- `src/windows/config/*.tsx` — 各配置页面

---

## CP8: 自动更新

**流程**: 应用启动 → 检查 GitHub releases → 有新版本 → 打开更新窗口

```
electron/main.ts: checkForUpdate(windowManager)
  → electron/updater/index.ts: checkForUpdate()
    → fetch GitHub API latest release
    → 比较版本号
    → 有更新 → 创建 UPDATER 窗口
      → src/windows/updater/index.tsx:
        - 显示当前版本 vs 最新版本
        - 渲染 release notes
        - 提供下载链接
```

**涉及文件**:
- `electron/updater/index.ts` — 版本检查
- `src/windows/updater/index.tsx` — 更新窗口 UI

---

## CP9: 备份恢复

**流程**: 用户在配置窗口创建备份 → 选择恢复点 → 恢复配置

```
backup.create()
  → electron/backup/index.ts: 将 config.json + cc_cedict.db 打包为 zip
  → 存储到本地或 WebDAV
backup.restore(name)
  → 下载/读取 zip → 解压覆盖 config.json
```

**涉及文件**:
- `electron/backup/index.ts` — 备份/恢复逻辑
- `electron/ipc/backup_handlers.ts` — 备份 IPC
- `src/windows/config/backup_settings.tsx` — 备份 UI

---

## CP10: 国际化

**流程**: 用户切换 app_language → 所有 UI 文案即时切换

```
config.set('app_language', 'zh_cn')
  → electron/config/store.ts 广播变更
    → src/i18n/index.ts: bindI18nToConfig()
      → subscribe 到 config store
      → i18n.changeLanguage(lang)
        → 所有 useTranslation() 组件重渲染
```

**涉及文件**:
- `src/i18n/index.ts` — i18next 初始化 + 配置绑定
- `src/i18n/locales/*.json` — 19 个语言文件
- 所有使用 `useTranslation()` 的组件

---

## 窗口总览

| 窗口 | Label | 入口文件 | 触发方式 |
|------|-------|----------|----------|
| 翻译 | TRANSLATE | `src/windows/translate/index.tsx` | 快捷键/输入/剪贴板/OCR/API |
| 字典 | DICT | `src/windows/dict/index.tsx` | 划词字典快捷键 |
| 识别 | RECOGNIZE | `src/windows/recognize/index.tsx` | 截图 OCR 快捷键 |
| 截图 | SCREENSHOT | `src/windows/screenshot/index.tsx` | 截图快捷键（全屏覆盖层） |
| 配置 | CONFIG | `src/windows/config/index.tsx` | 托盘/首次运行 |
| 更新 | UPDATER | `src/windows/updater/index.tsx` | 检测到新版本自动弹出 |
| 后台 | DAEMON | — | 隐藏后台进程 |

## IPC 通道总览

| 通道 | 方向 | 用途 |
|------|------|------|
| `translate:from-selection` | main→renderer | 划词翻译文本 |
| `translate:input-translate` | main→renderer | 输入翻译触发 |
| `translate:from-api` | main→renderer | API/OCR 发送的翻译文本 |
| `translate:from-clipboard` | main→renderer | 剪贴板翻译文本 |
| `dict:lookup` | main→renderer | 划词字典文本 |
| `dict:lookup` (invoke) | renderer→main | CC-CEDICT 查询 |
| `dict:check` | renderer→main | 检查字典数据库状态 |
| `dict:import` | renderer→main | 下载/导入 CC-CEDICT 数据 |
| `ocr:capture-screenshot` | renderer→main | 启动截图 |
| `ocr:open-recognize` | renderer→main | 打开识别窗口 |
| `ocr:send-to-translate` | renderer→main | OCR 文字发送到翻译窗口 |
| `ocr:system-recognize` | renderer→main | 系统 OCR 识别 |
| `config:get/set/getAll` | renderer→main | 配置读写 |
| `config:changed` | main→renderer | 配置变更广播 |
| `hotkey:register/unregister` | renderer→main | 快捷键注册 |
| `history:*` | renderer→main | 历史记录 CRUD |
| `backup:*` | renderer→main | 备份创建/恢复 |
| `renderer:ready` | renderer→main | 窗口就绪信号 |
| `window:*` | renderer→main | 窗口控制 |

## 服务注册表

| 注册表 | 服务 |
|--------|------|
| translateServiceRegistry | bing, google, deepl, lingva, alibaba, baidu, baidu_field, caiyun, niutrans, youdao, volcengine, transmart, tencent, openai, chatglm, geminipro, ollama, mymemory, free_dictionary, ecdict, cambridge_dict |
| ocrServiceRegistry | tesseract, baidu_accurate, baidu_img, tencent_accurate, tencent_img, volcengine_multi_lang, simple_latex, xfyun (×3), system |
| ttsServiceRegistry | 各 TTS 服务 |
| collectionServiceRegistry | 各收藏服务 |
