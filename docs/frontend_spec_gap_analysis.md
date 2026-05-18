# 前端实现与 SPEC 差异分析

> 日期：2026-05-19  
> 对照基准：`docs/spec.md`（2026-05-19）  
> 范围：当前前端 / Electron UI 实现与产品规格的差异。本文只记录差异与证据，不修改实现。

## 结论摘要

当前前端已经覆盖了翻译窗口基础结构、欢迎页基础展示、翻译结果卡片、设置窗口主框架、服务实例基础管理、历史列表、备份入口等能力，但与 SPEC 的最新目标仍存在明显差距。

最高优先级差异集中在：

1. 翻译入口仍在配置和 UI 上拆成“划词翻译 / 输入翻译”，没有完全收敛成 SPEC 的单一“翻译”入口。
2. 文字识别与截图翻译仍不是同一个截图翻译窗口体系；截图翻译目前会转到翻译窗口，缺少左图右文的截图翻译布局。
3. 设置页仍保留代理功能、主题下拉框、文字预览块、旧历史工具栏、5 个快捷键项等与 SPEC 不符的内容。
4. 多处快捷键展示直接显示 `CommandOrControl`，没有按平台显示 `Control` / `Command`。
5. 多处 i18n fallback 使用 `t(key) || fallback`，在缺 key 时可能直接展示原始 key，例如 `config.title`。
6. 托盘缺少“字典词典”菜单项，且快捷键展示未格式化。
7. 非固定窗口失焦自动关闭只覆盖翻译窗口且受旧配置开关控制；SPEC 要求除设置窗口外均按固定状态关闭。

## 高优先级缺口

### G1. 翻译入口未完全合并

- SPEC：用户面向功能只有一个“翻译”入口；有选中文本时翻译选中文本，未选中时弹出空输入窗口。见 `docs/spec.md:68`、`docs/spec.md:522-531`、`docs/spec.md:980-995`。
- 当前实现：主进程行为已有部分合并，`electron/hotkey/index.ts:38-70` 将 `hotkey_selection_translate` 和 `hotkey_input_translate` 都导向同一个 translate entry。
- 当前差异：配置模型仍有 `hotkey_selection_translate` / `hotkey_input_translate` 两个键，见 `shared/types/config.ts:53-57`、`shared/types/config.ts:142-146`；快捷键设置页仍渲染“划词翻译”和“输入翻译”两行，见 `src/windows/config/hotkey_settings.tsx:137-146`。
- 影响：欢迎页、设置页、托盘、快捷键配置仍会向用户暴露两个翻译入口，违反 SPEC 的 4 个用户面向功能模型。

### G2. 欢迎页跳过不关闭窗口

- SPEC：点击“跳过”后直接关闭当前欢迎 / 翻译窗口，本会话内不再打开或保留空翻译窗口。见 `docs/spec.md:326-333`。
- 当前实现：`src/windows/translate/index.tsx:649-650` 的 `onSkip` 只调用 `setWelcomeDismissed(true)`。
- 差异：欢迎页隐藏后空翻译窗口仍留在屏幕上。

### G3. 快捷键展示未按平台转换

- SPEC：Windows / Linux 显示 `Control`，macOS 显示 `Command`，不得显示 `CommandOrControl`。见 `docs/spec.md:331-332`、`docs/spec.md:531`、`docs/spec.md:993-995`、`docs/spec.md:1163`。
- 当前实现：欢迎页 `src/windows/translate/welcome_empty.tsx:18-20` 只是按 `+` 拆分，`src/windows/translate/welcome_empty.tsx:43-47` 原样渲染片段。
- 当前实现：快捷键设置页 `src/windows/config/hotkey_settings.tsx:15` 捕获时写入 `CommandOrControl`，`src/windows/config/hotkey_settings.tsx:31-33` 原样拆分展示。
- 当前实现：托盘弹窗 `src/windows/tray/index.tsx:32-36` 保存原始快捷键字符串，`src/windows/tray/index.tsx:104-105` 原样展示。
- 差异：用户可能直接看到 `CommandOrControl+Alt+...`。

### G4. 原始 i18n key 仍可能暴露

- SPEC：缺失 locale key 必须显示明确 fallback，不允许把 `welcome.translate`、`Delete_spaces` 等原始翻译 key 展示给用户。见 `docs/spec.md:1091-1097`、`docs/spec.md:1145`。
- 当前实现：设置标题栏 `src/windows/config/index.tsx:70` 使用 `t('config.title') || '设置'`。
- 当前证据：中文 locale `src/i18n/locales/zh_cn.json:108-252` 没有 `config.title`。
- 差异：i18next 缺 key 时会返回 key 字符串，`|| '设置'` 不会生效，可能显示 `config.title`。
- 当前实现：翻译源区去除空格 tooltip 使用 `t('delete_spaces')`，见 `src/windows/translate/source_area.tsx:214`。
- 当前证据：中文 locale 只有 `recognize.delete_spaces`，见 `src/i18n/locales/zh_cn.json:11-12`，没有顶层 `delete_spaces`；英文 locale 有顶层 key，但中文会显示原始 key。

## 翻译窗口差异

### T1. 去除换行 / 去除空格图标未对齐设计稿

- SPEC：去除换行与去除空格图标必须使用设计稿符号，不得自造。见 `docs/spec.md:259-260`、`docs/spec.md:1145`。
- 设计稿：`docs/design/omni-pot/project/windows/translate.jsx` 使用 `MdSmartButton` 表示去除换行，`CgSpaceBetween` 表示去除空格。
- 当前实现：`src/components/icons.tsx:43` 自定义 `Space` SVG，`src/components/icons.tsx:49` 自定义 `Newline` SVG；翻译源区 `src/windows/translate/source_area.tsx:211-216` 使用这两个自定义图标。
- 差异：实现没有使用设计稿指定符号，至少需要视觉核对。

### T2. 翻译窗口部分基础要求已符合

- 欢迎页只在源文本为空且未跳过时显示：`src/windows/translate/index.tsx:342-344`。
- 欢迎页高度自适应只调用高度更新，不主动改宽：`src/windows/translate/index.tsx:538-563`。
- 源区操作按钮常驻：`src/windows/translate/source_area.tsx:198-240`。
- 去除换行文本处理符合 `/-\s+/g → ''` 和 `/\s+/g → ' '`：`src/windows/translate/index.tsx:22-24`、`src/windows/translate/source_area.tsx:138-140`。
- 检测语言标签显示本地化名称：`src/windows/translate/source_area.tsx:200-208`。
- 语言区使用可读语言名：`src/windows/translate/language_area.tsx:89`、`src/windows/translate/language_area.tsx:136`。
- 结果卡不显示 `stream` 标签，并使用轻量等待态：`src/windows/translate/target_area.tsx:130-145`。

## 托盘差异

### TR1. 托盘缺少“字典词典”功能项

- SPEC：托盘功能项应包含翻译、字典词典、文字识别、截图翻译。见 `docs/spec.md:948-955`。
- 当前实现：`src/windows/tray/index.tsx:4-15` 只定义 translate、OCR recognize、screenshot translate、clipboard monitor、settings、update、logs、restart、quit。
- 当前实现：`electron/tray/index.ts:24-49` 的 label 集合也缺少字典词典。
- 差异：托盘没有字典词典入口。

### TR2. 托盘“翻译”行为仍偏输入翻译

- SPEC：托盘“翻译”应对应单一翻译入口。见 `docs/spec.md:952`、`docs/spec.md:986-989`。
- 当前实现：`src/windows/tray/index.tsx:4-8` 的 action 名仍是 `input_translate`；`electron/tray/index.ts:179-184` 打开翻译窗口并发送 `translate:input-translate`。
- 差异：托盘入口不会尝试读取选中文本，仍是旧“输入翻译”语义。

### TR3. 托盘弹窗显示时机基本符合

- SPEC：弹窗必须在 renderer 内容和菜单文案就绪后显示，不允许先显示空白弹窗。见 `docs/spec.md:966-971`。
- 当前实现：`electron/tray/index.ts:120-130` 创建窗口时 `show: false`；`src/windows/tray/index.tsx:24-48` 等 labels/config ready 后调用 `popupReady(width, height)`。
- 状态：该点基本符合。

## 文字识别 / 截图翻译差异

### O1. 文字识别与截图翻译没有共用同一个截图翻译窗口体系

- SPEC：文字识别入口与截图翻译入口共用同一个截图翻译窗口体系；文字识别窗口点击“翻译”后进入同一个“截图翻译窗口”。见 `docs/spec.md:426-430`。
- 当前实现：`electron/ipc/ocr_handlers.ts:111-116` 的 `ocr:send-to-translate` 打开 `WindowLabel.TRANSLATE`。
- 当前实现：`src/windows/screenshot/index.tsx:128-132` 在截图翻译模式下把 OCR 文本发送到翻译窗口。
- 当前实现：`src/windows/recognize/index.tsx:398-401` 点击翻译也把识别文本发送到翻译窗口。
- 差异：截图翻译会丢失原图上下文，没有进入 SPEC 要求的截图翻译窗口布局。

### O2. 截图翻译布局缺少右侧翻译卡片

- SPEC：第二排应为左侧大原图卡片 + 右侧纵向两个小卡片（识别内容、翻译内容）。见 `docs/spec.md:436-442`、`docs/spec.md:1151`。
- 当前实现：`src/windows/recognize/index.tsx:459-515` 是两列布局：左侧图片卡片，右侧一个 textarea 识别结果卡片。
- 差异：没有截图翻译结果卡片，也没有截图翻译模式下的两卡片右栏。

### O3. 窗口模式不能切换为“截图翻译”

- SPEC：模式标签分别为 `文字识别` / `截图翻译`。见 `docs/spec.md:430-434`。
- 当前实现：`src/windows/recognize/index.tsx:452` 固定渲染 `t('recognize.title')`；中文 locale `src/i18n/locales/zh_cn.json:4-18` 的 `recognize.title` 为 `文字识别`。
- 差异：recognize 窗口没有截图翻译模式状态和标题。

### O4. 切换识别语言不会自动重新识别

- SPEC：文字识别窗口切换识别语言后自动重新识别；截图翻译窗口切换识别语言后重新识别并刷新翻译，切换目标语言后重新翻译。见 `docs/spec.md:470-477`、`docs/spec.md:1152`。
- 当前实现：`src/windows/recognize/index.tsx:548` 的语言选择只调用 `setSelectedLanguage`。
- 当前实现：重新识别仍是手动按钮，见 `src/windows/recognize/index.tsx:534-543`。
- 差异：语言变化不会自动触发 OCR；截图翻译目标语言控制也不存在。

### O5. 底栏按钮顺序和内容不符合 SPEC

- SPEC：文字识别左侧为 `复制图片 → 选择识别引擎 → 自动检测`，右侧为 `翻译 → 去除换行 → 去除空格 → 复制识别文本 → 导出`；不得有独立“重新识别 / 重新翻译”按钮。见 `docs/spec.md:448-464`。
- 当前实现：`src/windows/recognize/index.tsx:525-550` 左侧是服务选择、重新识别、语言选择。
- 当前实现：没有复制图片按钮；有独立重新识别按钮。
- 当前实现：`src/windows/recognize/index.tsx:554-573` 右侧顺序基本是翻译、去除换行、去除空格、复制、导出。
- 差异：左侧缺复制图片，且多出重新识别按钮。

### O6. 语言选择前仍有图标

- SPEC：语言下拉不带 AUTO/ZH 等字母前缀，也不在语言项前添加网络图标。见 `docs/spec.md:446`。
- 当前实现：语言选项自身是文本，见 `src/windows/recognize/index.tsx:350-354`。
- 当前实现：语言选择触发器前仍有 `Icons.Globe`，见 `src/windows/recognize/index.tsx:544-549`。
- 差异：如果按验收口径“语言区域前不显示网络 / globe 图标”，当前仍不符合。

### O7. OCR 旧请求结果未忽略

- SPEC：旧请求 ID 的 OCR 结果被忽略。见 `docs/spec.md:472`。
- 当前实现：`src/windows/recognize/index.tsx:360-390` 启动异步 OCR 后直接应用返回结果，没有 request id / ref guard。
- 差异：快速切换图片、服务或语言时，旧请求可能覆盖新状态。

### O8. 导出 doc/docx 只是纯文本扩展名

- SPEC：导出支持 md / txt / docx / doc。见 `docs/spec.md:463`。
- 当前实现：`src/windows/recognize/index.tsx:231-245` 列出格式，但所有格式都写 `text/plain;charset=utf-8` Blob。
- 差异：`.docx` / `.doc` 不是实际 Word 文档格式。

## 字典词典窗口差异

### D1. 用户可见名称不统一为“字典词典”

- SPEC：用户面向名称为“字典词典”。见 `docs/spec.md:66-72`、`docs/spec.md:337-349`、`docs/spec.md:524-529`。
- 当前实现：词典窗口标题硬编码 `词典`，见 `src/windows/dict/index.tsx:276`。
- 当前 locale：`src/i18n/locales/zh_cn.json:177-185` 的快捷键项是 `查询字典`，`src/i18n/locales/zh_cn.json:225-234` 的 dict title 是 `字典`。
- 当前快捷键设置 fallback：`src/windows/config/hotkey_settings.tsx:157-160` 使用 `划词词典` / `查词典`。
- 差异：多个入口仍不是“字典词典”。

### D2. 英文输入查询的词典服务过多

- SPEC：英文输入只渲染英文词典 `free_dictionary`；中文输入只渲染中文词典 / ECDICT 中文释义。见 `docs/spec.md:341-357`。
- 当前实现：`src/windows/dict/index.tsx:98-106` 允许英文输入查询 `free_dictionary`、`ecdict`、`cambridge_dict`。
- 差异：英文输入不是单一英文词典。

### D3. 仍渲染“来源” chips

- SPEC：不再渲染“来源” chips。见 `docs/spec.md:356`。
- 当前实现：`src/windows/dict/index.tsx:363-373` 渲染“来源”行和服务 chips。
- 差异：保留了 SPEC 明确删除的信息。

### D4. 收藏按钮位置不符合

- SPEC：每个词卡右上角放置收藏按钮。见 `docs/spec.md:354`。
- 当前实现：收藏按钮在顶部 header card，见 `src/windows/dict/index.tsx:319-329`；结果卡底部是复制按钮，见 `src/windows/dict/index.tsx:72-76`。
- 差异：不是每个词卡右上角收藏。

## 设置页差异

### C1. 通用页仍保留代理功能

- SPEC：不提供代理功能，不显示代理设置卡片，不保留代理入口或代理文案。见 `docs/spec.md:505-510`、`docs/spec.md:1162`。
- 当前实现：`shared/types/config.ts:18-20` 和 `shared/types/config.ts:107-109` 仍保留 `proxy_enable`、`proxy_host`、`proxy_port`。
- 当前实现：`src/windows/config/general.tsx:54-56` 读取代理配置，`src/windows/config/general.tsx:159-178` 渲染“网络代理”卡片。
- 当前 locale：`src/i18n/locales/zh_cn.json:139-142` 仍有代理文案。
- 差异：代理功能仍在配置、UI 和文案中存在。

### C2. 本地 API 端口缺少标签旁问号文档按钮

- SPEC：本地 API 端口标签右侧显示小圆圈问号按钮，点击打开 API 文档；按钮贴近“本地 API 端口”文字，不放输入框右侧。见 `docs/spec.md:507-509`、`docs/spec.md:1162`。
- 当前实现：`src/windows/config/general.tsx:82-90` 只渲染 `ConfigRow` 和输入框，没有问号按钮。
- 差异：缺少 API 文档入口。

### C3. 主题仍是下拉框，不是三按钮分段控件

- SPEC：主题使用跟随系统 / 浅色 / 深色三按钮分段控件，不使用下拉框。见 `docs/spec.md:509`、`docs/spec.md:1166`。
- 当前实现：`src/windows/config/general.tsx:93-102` 使用 `ConfigSelect` 渲染主题。
- 差异：控件形态不符合 demo / SPEC。

### C4. “文字”设置仍叫“字体”，且仍有预览块

- SPEC：外观卡片中该项标签叫“文字”，不叫“字体”，且不显示预览块。见 `docs/spec.md:509`、`docs/spec.md:1162`。
- 当前实现：`src/windows/config/general.tsx:125` label 使用 `t('general.font_family') || '字体'`。
- 当前实现：`src/windows/config/general.tsx:143-153` 渲染预览卡片，内容为 `Hello World 你好世界 こんにちは 안녕하세요`。
- 当前 locale：`src/i18n/locales/zh_cn.json:134-136` 仍是 `font_family: 字体`。
- 差异：与最新 demo 聊天结论相反。

### C5. 历史页工具栏不符合一行布局

- SPEC：历史页顶部工具栏一行展示 `启用` 开关、搜索框、服务筛选、时间筛选、清空；关闭时其余历史操作置灰或禁用。见 `docs/spec.md:545-553`、`docs/spec.md:1158`。
- 当前实现：`src/windows/config/history_settings.tsx:53-57` 单独用卡片显示 `禁用历史记录`。
- 当前实现：`src/windows/config/history_settings.tsx:59-65` 只有清空按钮，没有搜索框、服务筛选、时间筛选，也没有一行 `启用` 开关。
- 差异：页面结构、文案、布局和禁用态都不符合。

### C6. 快捷键页仍是 5 项，且按钮文案不符合

- SPEC：快捷键设置只有 4 项：翻译、字典词典、文字识别、截图翻译；已绑定显示“解绑”，未绑定显示“绑定”，不使用 × 清除。见 `docs/spec.md:522-531`、`docs/spec.md:1160`。
- 当前实现：`src/windows/config/hotkey_settings.tsx:137-160` 渲染 5 项：划词翻译、输入翻译、文字识别、截图翻译、划词词典。
- 当前实现：`src/windows/config/hotkey_settings.tsx:117-119` 已绑定按钮显示 `t('ui.set') || '已绑定'`，中文 locale `src/i18n/locales/zh_cn.json:239` 的 `ui.set` 是“设置”，不是“解绑”。
- 差异：项目数量、命名和按钮文案均不符合。

### C7. 服务页类别名、按钮形态和操作能力不完全符合

- SPEC：服务页 5 个 Tab 为翻译 / 字典词典 / 文字识别 / 语音朗读 / 收藏；编辑、删除使用带文字完整按钮，并支持上移 / 下移。见 `docs/spec.md:533-543`、`docs/spec.md:1161`。
- 当前实现：`src/windows/config/service_settings.tsx:19-25` 使用 `词典`、`识别`、`朗读`，不是 `字典词典`、`文字识别`、`语音朗读`。
- 当前实现：`src/windows/config/service_settings.tsx:124-140` 编辑 / 删除是 icon button，不带文字。
- 当前实现：`src/windows/config/service_settings.tsx:68-77` 和 `src/windows/config/service_settings.tsx:92-141` 没有上移 / 下移按钮，只支持拖拽。
- 差异：服务页还未与 demo / SPEC 对齐。

### C8. 备份页缺少导出 zip 再导入的 UI 和验证闭环

- SPEC：导出的备份 zip 必须可作为恢复输入重新导入；恢复后验证配置、历史记录和随包数据库正确。见 `docs/spec.md:554-562`、`docs/spec.md:1065-1073`、`docs/spec.md:1171`。
- 当前实现：`src/windows/config/backup_settings.tsx:38-66` 只提供创建备份和从列表恢复。
- 当前实现：`src/windows/config/backup_settings.tsx:112-125` 只有“立即备份 / 从备份恢复”按钮和备份内容提示。
- 当前实现：`src/windows/config/backup_settings.tsx:142-195` 只能从已列出的备份项恢复，没有选择外部 zip 导入入口，也没有 UI 层面的恢复后校验结果。
- 差异：缺少导出 zip 再导入的验收路径。

### C9. 设置主框架与 SPEC 部分符合

- 左侧 8 个导航项存在：`src/windows/config/index.tsx:37-46`。
- 设置窗口右上角有最小化 / 最大化 / 关闭三件套：`src/windows/config/index.tsx:72-82`。
- 左侧底部有版本号：`src/windows/config/index.tsx:123-125`。
- 但标题 `config.title` 可能暴露原始 key，见 G4。

## 窗口行为差异

### W1. 非固定失焦自动关闭范围不符合

- SPEC：除设置窗口外，所有非固定窗口失去焦点后应自动关闭。见 `docs/spec.md:140-148`、`docs/spec.md:1169-1170`。
- 当前实现：`electron/windows/manager.ts:109-115` 只对 `WindowLabel.TRANSLATE` 执行 blur close。
- 当前实现：关闭还受 `translate_close_on_blur` 配置控制；SPEC 目标是按非固定状态关闭，而不是保留用户可关的旧开关。
- 当前实现：`shared/types/config.ts:35`、`shared/types/config.ts:50`、`shared/types/config.ts:124`、`shared/types/config.ts:134` 仍保留 `translate_close_on_blur` / `recognize_close_on_blur`。
- 差异：词典、识别 / 截图翻译等窗口没有统一失焦关闭行为；旧配置也与 SPEC 配置表不一致。

## 语言检测差异风险

### L1. 中文长句误判为日语的验收用例缺少明确前端保障

- SPEC：中文长句，例如重复“我爱你”，必须识别为简体中文，不得误判为日语。见 `docs/spec.md:312`。
- 当前实现：本地 fallback 中汉字优先返回 `zh_cn`，见 `src/services/detect.ts:3-10`。
- 当前实现：在线检测引擎映射可能返回 `ja`，翻译流程 `src/windows/translate/index.tsx:148-153` 直接使用检测结果。
- 差异风险：如果在线检测引擎将纯汉字长句返回为日语，当前前端没有额外的汉字优先纠偏逻辑来覆盖该结果。

## 配置模型差异

### M1. SPEC 配置键与当前类型不一致

- SPEC：快捷键配置为 `hotkey_translate`、`hotkey_ocr_recognize`、`hotkey_ocr_translate`、`hotkey_selection_dictionary`。见 `docs/spec.md:866-873`。
- 当前实现：`shared/types/config.ts:53-57` 和 `shared/types/config.ts:142-146` 使用 `hotkey_selection_translate` / `hotkey_input_translate`，没有 `hotkey_translate`。
- SPEC：不再保留代理设置。见 `docs/spec.md:505-510`、`docs/spec.md:803-895`。
- 当前实现：`shared/types/config.ts:18-20`、`shared/types/config.ts:107-109` 仍保留代理配置。
- SPEC：配置表不再列 `translate_close_on_blur` / `recognize_close_on_blur`。见 `docs/spec.md:826-865`。
- 当前实现：`shared/types/config.ts:35`、`shared/types/config.ts:50`、`shared/types/config.ts:124`、`shared/types/config.ts:134` 仍保留。

## 建议修复顺序

1. 先统一产品入口和配置模型：合并翻译快捷键为 `hotkey_translate`，同步欢迎页、托盘、快捷键设置页。
2. 修复 i18n fallback 机制：全局查找 `t(key) || fallback`，改为 `t(key, { defaultValue })` 或补齐 locale，优先处理 `config.title`、`delete_spaces`。
3. 按 demo 重做识别 / 截图翻译窗口：保留原图，加入右侧识别卡 + 翻译卡，移除重新识别按钮，语言变化自动执行。
4. 按最新 demo 重做设置页关键差异：通用、历史、快捷键、服务、备份。
5. 修复托盘：加入字典词典项，统一快捷键格式，翻译项改为单一入口语义。
6. 统一非设置窗口失焦关闭行为，并移除旧 close-on-blur 配置入口。
7. 增加覆盖这些差异的 E2E / UI 断言，避免再次回归。
