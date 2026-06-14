# 文档更新确认

_Started 2026-05-18 13:56 UTC_

---

## User

按照文档里的改，还有圆角固定 10 不用再设置了。

## Assistant

_[tool: read_file]_

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: update_todos]_

我来根据文档对设计稿做改动。下面是我要做的清单：

_[tool: str_replace_edit]_

Let me start with the root HTML — fix radius at 10 and remove the radius tweak / stream label sample.

_[tool: str_replace_edit]_

Now config.jsx — engine options, pin/close size, and 配置→设置 terminology:

_[tool: str_replace_edit]_

Tray menu (#4):

_[tool: str_replace_edit]_

Add loading-dot animation to styles.css:

_[tool: str_replace_edit]_

Now translate.jsx — the big set of changes:

_[tool: str_replace_edit]_

Wire up the volume button in source bar and add collapse + loading to DictWindow:

_[tool: str_replace_edit]_

Update the TranslateLoadingState in the root HTML to use the new dots:

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: done]_

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

已按 `uploads/demo_todo.md` 改完。要点：

- **#1 检测引擎**：补到 6 项 `bing/google/baidu/tencent/niutrans/local`，默认 `bing`，并加了"失败时按选项顺序依次回退"的提示。
- **#3 + #12 结果卡片**：默认折叠；header 里用三点跳动动效代替 "翻译中…" 与 `stream` 标签；出结果后自动展开（保留用户后续手动折叠权）；展开等待时用 shimmer 占位条。
- **#4 托盘菜单**：`OCR 翻译 → 截图翻译`，移除 `自动复制` 子菜单与所有快捷键标注。
- **#5 设置窗口**：`pin / close` 改为 28×28、`size={18}`，与翻译窗口一致。
- **#10 标题栏**：拆成独立的 `固定` 与 `置顶`（用 `Icons.Layers`）两个按钮；点 `置顶` 自动激活 `固定`，反向则不联动；激活态使用 `brand-primary-soft` 填充以区分。
- **#11 重试按钮**：`ResultCard` 错误态增加 `Icons.Cycle size=14` 重试按钮（danger 色），仅错误时出现。
- **#13 朗读三态**：`VolumeButton` 抽出来，`idle / busy(三点跳动) / playing(主色填充+背景)` 三态；源文本栏与词典 header 也复用。
- **#14 词典卡片**：抽 `DictSection`，统一折叠按钮 + loading 三点跳动 + shimmer；新增一个 `AI 翻译` 折叠段示范 loading 状态；`词形变化` 默认折叠。
- **#16 术语**：`配置目录 → 设置目录`。
- **圆角**：固定 10px（写在 `FIXED_RADIUS` 常量里，由 `applyTweaks` 注入），Tweaks 面板移除圆角 slider。

未改动（文档说"设计稿可作为静态原型保留"或属于开放问题）：#2 contentEditable（视觉行为已对齐）、#7 源操作按钮尺寸（文档未给定）、#8 / #15 自适应尺寸约束。

## User

Apply comment

## Assistant

_[tool: read_file]_

_[tool: grep]_

_[tool: str_replace_edit]_

I have 4 changes to apply. Let me handle them:

**A** Translate window height — auto-fit content (#15)
**B** Dict window — only pure-CN & pure-EN dicts; remove AI 翻译, 词形变化
**C** Empty state — merge 划词翻译 + 输入翻译 into one "翻译" entry
**D** Hotkey page — same merge

_[tool: grep]_

_[tool: str_replace_edit]_

Now update TitlebarLeft — swap icons and switch to outline / filled states:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now C/D — merge 划词翻译 + 输入翻译 into one in the empty state and hotkey page:

_[tool: grep]_

_[tool: grep]_

_[tool: str_replace_edit]_

Now PageHotkey in config.jsx — merge 划词翻译 and 输入翻译:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Let me adjust artboard heights to fit the new auto-sized windows:

_[tool: done]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

已应用 4 项更改：

- **翻译窗口**：去掉 `flex:1 / height:100%`，设为 `height:auto + alignSelf:flex-start`，窗口贴合内容；artboard 同步收紧（短文本 540、长文本 720）。
- **词典窗口**：精简为两段 — `中文词典 · ECDict`（中文释义）+ `英文词典 · Free Dictionary`（英文释义带例句）。删除 AI 翻译与词形变化；底部来源 chip 同步精简为 ECDict / Free Dictionary。
- **首次启动 + 快捷键页**：合并"划词翻译 / 输入翻译"为一个 `翻译` 项，说明"有选中文本时翻译选中文本，否则弹出空输入窗口"。`OCR 翻译` 改名为 `截图翻译` 与托盘菜单一致。
- **标题栏按钮**：新增 `Icons.Lock` 给 `固定`；`置顶` 继续用图钉。状态视觉改为：未激活 = 透明背景 + 主色描边 + 主色图标；激活 = 主色填充 + 白色图标。

