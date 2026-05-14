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

- [x] **CC-CEDICT 离线词典** — IPC bridge 架构
  - `electron/dict/index.ts` — SQLite 数据库模块（better-sqlite3 + WAL + FTS5）
  - `electron/ipc/dict_handlers.ts` — IPC 处理器（lookup/check/import）
  - `src/services/ecdict.ts` — Renderer 侧服务，通过 IPC 调用主进程
  - 首次使用时从 MDBG 下载 CC-CEDICT 文本（~6MB gzipped），解析入库
  - 中文查询：按 simplified/traditional 精确匹配
  - 英文查询：LIKE 模糊搜索 english 列
  - 字典窗口集成下载提示

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

- [ ] **代码质量检查体系** — 落地方案见 `docs/code_quality_checks_plan.md`
  - 第一档：收紧 tsconfig + 接入 ESLint(type-aware) + Electronegativity
  - 第二档：Knip 死代码 + Gitleaks 密钥扫描 + 格式化检查
  - 第三档：依赖漏洞扫描 + Semgrep + git hooks + CI 门禁
  - 注意：`unicorn/filename-case` 需显式设 `snakeCase`；存量项目分档推进不要一次全开

---

## UI 设计对齐（进行中）

**策略**：混合方案（保留 HeroUI 功能逻辑，覆盖所有视觉样式）+ 分步实施
**设计参考**：`docs/design/example/`

### Step 1：设计令牌 + 全局样式 + 字体
- [x] 添加 Geist 字体（CDN: jsdelivr geist@1.4.1）
- [x] 创建 `src/styles/design_tokens.css`（oklch 色彩、圆角、间距变量）
- [x] 重写 `src/styles/globals.css`（自定义组件类：.btn, .card, .ic-btn, .switch, .select, .chip 等）
- [x] 更新 `tailwind.config.js`（扩展主题匹配设计稿）

### Step 2：翻译窗口
- [x] 重写 `src/windows/translate/index.tsx`（标题栏 + 整体布局）
- [x] 重写 `src/windows/translate/source_area.tsx`（Source Card）
- [x] 重写 `src/windows/translate/language_area.tsx`（LangPick）
- [x] 重写 `src/windows/translate/target_area.tsx`（ResultCard）

### Step 3：词典窗口
- [x] 重写 `src/windows/dict/index.tsx`

### Step 4：配置窗口
- [x] 重写 `src/windows/config/index.tsx`（侧边栏 + 内容区）
- [x] 重写各子页面（general, translate, recognize, hotkey, service, history, backup, about）

### Step 5：识别窗口 + 截图窗口
- [x] 重写 `src/windows/recognize/index.tsx`（双栏布局 + PillSelect/PillButton 操作栏）
- [x] 重写 `src/windows/screenshot/index.tsx`（暗色覆盖层 + 品牌色选区 + 角落手柄 + 尺寸标签）

### Step 6：更新窗口
- [x] 重写 `src/windows/updater/index.tsx`（品牌标题 + 更新日志卡片 + 下载链接）

---

## 不再实现（API 已停用）

- ~~**Yandex Translate**~~ — 403 免费端点已关闭
- ~~**Bing Dictionary**~~ — 403 服务已停用
