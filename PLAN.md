# omni_pot 开发待办

## 已完成

- [x] Bing Translate 修复 — `src/services/bing.ts` token 正则 + key 字段已修复
- [x] 全部 22 个 API 测试完成 — 结果见 `docs/external_services/api_test_results.md`
- [x] **MyMemory 翻译服务** — `src/services/mymemory.ts` ✅ 已验证连通
- [x] **dictionaryapi.dev 词典服务** — `src/services/free_dictionary.ts` ✅ 已验证连通
- [x] **Yandex Translate** — API 403，免费端点已关闭，不再实现
- [x] **Bing Dictionary** — API 403，服务已停用，不再实现
- [x] **字典模式** — 独立窗口 + 独立快捷键 + 独立服务列表
  - `src/windows/dict/index.tsx` — 字典窗口，完整 DictResult 渲染
  - `src/stores/dict_store.ts` — 独立状态
  - `dictionary_service_list` 配置 + `hotkey_selection_dictionary` 快捷键
  - 配置 UI：服务设置 Dictionary 标签页 + 快捷键设置页
- [x] **OCR E2E 测试** — 真实 Tesseract.js + 真实翻译 API
- [x] **截图覆盖层修复** — workAreaSize→display.size, sendWhenReady 机制
- [x] **运行文件整理** — data/ 目录

---

## 待实现：OCR 服务（缺 1 个）

- [x] **系统 OCR** — `src/services/ocr/system.ts`
  - Windows: WinRT OcrEngine（通过 PowerShell 调用）
  - macOS: 暂不支持（需捆绑二进制）
  - Linux: tesseract CLI
  - 语言: auto + 24 种

### 已完成

- [x] **讯飞 OCR 系列** — 3 个服务
- [x] **百度高精度 OCR** — `src/services/ocr/baidu_accurate_ocr.ts`
- [x] **百度图片 OCR** — `src/services/ocr/baidu_img_ocr.ts`
- [x] **腾讯高精度 OCR** — `src/services/ocr/tencent_accurate_ocr.ts`
- [x] **腾讯图片 OCR** — `src/services/ocr/tencent_img_ocr.ts`
- [x] **火山引擎多语言 OCR** — `src/services/ocr/volcengine_multi_lang_ocr.ts`
- [x] **Simple LaTeX OCR** — `src/services/ocr/simple_latex_ocr.ts`

---

## 待实现：翻译服务（缺 1 个可用 + 1 个需架构）

- [ ] **CC-CEDICT 离线词典** — 需架构调整
  - `nodeIntegration: false`，renderer 无法直接用 `better-sqlite3`
  - 方案 A: IPC bridge — main process 管 SQLite，renderer 通过 IPC 查询
  - 方案 B: sql.js（WASM SQLite）在 renderer 中运行
  - 约 30MB 磁盘，< 5MB 内存，微秒级查询
  - 查英文→中文释义，查中文→英文释义

---

## 待实现：UI 细节

### 翻译窗口

- [x] **拖拽排序服务卡片** — @dnd-kit
- [x] **流式翻译输出** — OpenAI/Ollama stream 模式
- [x] **变量名转换** — Alt+Shift+U 循环: snake_case → SNAKE_CASE → kebab-case → dot.notation → 空格 → Title Case → CamelCase → PascalCase → snake_case
- [x] **动态翻译** — dynamic_translate 配置，输入 1s 防抖自动翻译
- [x] **服务卡片折叠/展开** — spring 动画
- [x] **服务卡片内切换服务** — 下拉框切换实例
- [x] **重试按钮** — 翻译失败后显示
- [x] **收藏按钮** — 每个服务卡片底部，对应 collection_service_list 中的服务
- [x] **SourceArea 补全** — 删除换行按钮、清空按钮、TTS 朗读按钮
- [x] **IME 处理** — 防止输入法与语言检测竞态
- [x] **窗口大小记忆** — translate_remember_window_size + 保存尺寸

### 识别窗口

- [x] **识别窗口补全** — Pin 按钮、窗口控制（最小化/最大化/关闭）
- [x] **可编辑文本** — OCR 结果可编辑
- [x] **删除换行/删除空格按钮**
- [x] **服务/语言下拉框** — 切换 OCR 服务和语言
- [x] **重新识别按钮** — 换服务重新 OCR
- [x] **翻译按钮** — 发送 OCR 结果到翻译窗口

### 截图窗口

- [x] **右键关闭** — 右键点击关闭截图窗口不执行操作

### 配置窗口

- [x] **字体选择** — 系统字体列表下拉框 + 预览
- [x] **自动启动** — 开机自启开关
- [x] **透明开关** — macOS 上隐藏
- [x] **托盘点击事件** — tray_click_event（仅 Windows）

---

## 待实现：基础设施

- [x] **国际化 (i18n)** — 19 种语言
  - react-i18next 集成 + bindI18nToConfig() 跟随 app_language 配置
  - 19 个语言文件: en, zh_cn, zh_tw, ru, pt_br, de, es, fr, it, ja, ko, pt_pt, tr, nb_no, nn_no, fa, uk, ar, he
  - 所有配置窗口 + 翻译窗口 + 识别窗口 + 字典窗口 + 更新窗口已接入 i18n

- [ ] **插件系统** — .potext 文件格式
  - 插件安装/卸载
  - 插件运行时（sandbox JS 执行）
  - 插件配置 UI（动态表单）
  - 支持 translate/recognize/tts/collection 四种类型

- [x] **自动更新** — updater 窗口
  - 检查 GitHub releases
  - ~~下载 + 安装 + 重启~~（需 electron-builder 打包后实现）
  - 更新日志渲染
  - 下载链接

- [x] **语言检测在线引擎** — bing/google/baidu/tencent/niutrans + local 已全部实现

---

## 不再实现（API 已停用）

- ~~**Yandex Translate**~~ — 403 免费端点已关闭
- ~~**Bing Dictionary**~~ — 403 服务已停用
