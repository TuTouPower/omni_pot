# omni_pot 设计稿待修改

> 来源：`docs/archive/reviews/spec_demo.md` 差异报告中用户标记为"设计稿"的项目。
> 设计稿原型文件：`docs/design/omni-pot/project/` 下的 jsx/css/html 文件。

---

## 一、翻译窗口

### [高] 1.1 翻译结果卡片移除"收藏"按钮

- 文件：`windows/translate.jsx`
- 当前：ResultCard 右上角 4 个按钮 — 朗读、复制、**收藏(Heart)**、折叠
- 目标：移除 Heart 按钮，只保留朗读、复制、折叠（共 3 个）

### [中] 1.2 结果卡片中的收藏按钮同步移除

- 文件：`windows/translate.jsx`
- 与 1.1 同一个文件，确认 SOURCE_BUTTONS 数组本身正确，问题仅在 ResultCard

### [中] 1.3 快捷键展示格式改为缩写（同时涉及设置页和托盘）

- 文件：`windows/config.jsx`（快捷键页）、`windows/other.jsx`（托盘菜单）
- 当前：`Ctrl+Alt+T`（设置页）、`Ctrl + Alt + T`（托盘）
- 目标：统一为 Windows `Ctrl + Alt + T`，macOS `Cmd + Alt + T`（带空格的缩写格式，非完整单词）
- 适用于：快捷键设置页、托盘菜单右侧标注、欢迎页快捷键提示卡

### [低] 1.4 托盘菜单移除非功能项的快捷键

- 文件：`windows/other.jsx`
- 当前：设置（`Ctrl + Alt + ,`）等非功能项也显示了快捷键
- 目标：spec 明确仅 4 个功能项（翻译/词典/文字识别/截图翻译）有快捷键，其余不显示

---

## 二、词典窗口

### [高] 2.1 Chinese Dictionary卡片隐藏词性标签和朗读按钮

- 文件：`windows/translate.jsx`（DictBody / SAMPLE_DICT_ZH）
- 当前：Chinese Dictionary (`chinese_dictionary`) 正常渲染词性标签（"动""形"）和朗读按钮
- 目标：Chinese Dictionary卡片隐藏词性标签（POS tag）和朗读按钮；英文词典保留

### [高] 2.2 源词卡片操作栏只保留复制+查询

- 文件：`windows/translate.jsx`（DictSourceCard）
- 当前：操作栏 4 个按钮 — 朗读(Volume)、复制(Copy)、收藏(Heart)、查询(Type)
- 目标：只保留**复制(Copy)、查询(Type)**（共 2 个）

### [低] 2.3 词典窗口默认宽度改为 spec 值

- 文件：`windows/translate.jsx`（DictWindow）
- 当前：`width = 420`
- 目标：快捷键唤起 400×500，HTTP 唤起 350×420

---

## 三、设置窗口

### [高] 3.1 服务设置移除"收藏"Tab

- 文件：`windows/config.jsx`（PageService）
- 当前：6 个 Tab（翻译/Chinese Dictionary/英文词典/文字识别/语音朗读/**收藏**）
- 目标：只保留 5 个 Tab，移除"收藏"

### [中] 3.2 服务列表示例数据精简为实际服务

- 文件：`windows/config.jsx`（PageService data 对象）
- 当前：翻译 Tab 含 `lingva`，中文/英文词典 Tab 含 `ecdict`
- 目标：只使用以下服务：
  - 翻译：`bing` `google` `deepl` `mymemory`
  - OCR：`system` `tesseract` `qrcode`
  - Chinese Dictionary：`cc-cedict`
  - 英文词典：`cambridge_dict` `cc-cedict`

### [中] 3.3 服务实例列表不显示 key 和 PLATFORM/OFFLINE 标签

- 文件：`windows/config.jsx`（PageService 渲染逻辑）
- 当前：显示 `s.key` 副文本和 `s.tag` chip（PLATFORM/OFFLINE）
- 目标：不显示实例 key 副文本，不显示 PLATFORM/OFFLINE 等标签 chip

### [低] 3.4 通用页隐藏字体/字号设置

- 文件：`windows/config.jsx`（PageGeneral）
- 当前：外观卡片有"文字"行（字体族 + 字号下拉）
- 目标：移除"文字"行，spec 标注这些字段"设置 UI 已隐藏，保留配置兼容"

### [低] 3.5 历史页补上"全部时间"筛选项

- 文件：`windows/config.jsx`（PageHistory）
- 当前：时间筛选只有今天/本周/本月
- 目标：补上"全部时间"选项

### [低] 3.6 关于页路径改为动态获取

- 文件：`windows/config.jsx`（PageAbout）
- 当前：写死 macOS 路径 `~/Library/...`
- 目标：实现时通过 IPC 动态获取实际 `userData` 路径

### [低] 3.7 备份内容说明移除 CC-CEDICT

- 文件：`windows/config.jsx`（PageBackup）
- 当前："备份内容：设置、历史记录数据库、CC-CEDICT 词典数据库"
- 目标："备份内容：设置、历史记录数据库"

---

## 四、文字识别 / 截图翻译窗口

### [低] 4.1 复制按钮文案改为"复制识别文本"

- 文件：`windows/other.jsx`
- 当前：`复制文本`
- 目标：`复制识别文本`

---

## 五、设计系统

### [高] 5.1 shared.jsx 冗余 Titlebar 组件清理

- 文件：`shared.jsx`
- 当前：`Titlebar` 组件无置顶/固定按钮，与实际使用的 `TitlebarLeft`（translate.jsx）不一致
- 目标：清理或修正，确保所有窗口使用一致的 `TitlebarLeft` 组件

### [中] 5.2 shared.jsx Titlebar 区分仅关闭/三件套

- 文件：`shared.jsx`
- 当前：`Titlebar` 默认渲染完整三件套，无"仅关闭"变体
- 目标：与 `TitlebarLeft` 的 `chrome` 参数逻辑对齐（`wmctl` = 三件套，否则仅关闭）

### [中] 5.3 图标按钮激活态视觉修正

- 文件：`windows/translate.jsx`（TitleBtn / LockGlyph）
- 当前：颜色始终为 `var(--brand-primary)`，通过 SVG fill 区分激活/未激活
- 目标：未激活 = 主色描边无背景；激活 = 填充主色，内部线条反色（当前 LockGlyph 用 `var(--bg)` 模拟，接近但不严格）

---

## 六、Tweaks 面板

### [低] 6 移除 density 和 fontSize 默认值

- 文件：`tweaks-panel.jsx`
- 当前：`TWEAK_DEFAULTS` 包含 `fontSize: 16` 和 `density: "regular"`
- 目标：原型调试工具不影响生产代码，但与 spec 矛盾（圆角和密度固定不可调），标注即可
