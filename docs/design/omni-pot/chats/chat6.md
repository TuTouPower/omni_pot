# OCR翻译界面优化

_Started 2026-05-18 14:25 UTC_

---

## User

置顶按钮放在固定按钮前面，按钮不要外框。我要的是未选中的时候是只有符号的线，选中后符号内部填充颜色。翻译窗口，你不要有没用的空白呀，傻逼。你他妈就在内容结果外面加一点留白就行，搞没用的空白干嘛。我都能看到你的外框圆角线，圆角线之外的都没用，去掉。ocr 的翻译小卡片 你搞那么特殊干嘛，背景色字色都和 识别结果保持一致。ocr 翻译是会从 ocr 识别变过来的。你他妈不要有太多差别。按钮这么放，复制图片 系统 ocr 自动检测 重新识别 转换符号 简体中文 重新翻译。 然后右边四个按钮。你这个ocr翻译和翻译窗口保持一致，自动检测和简体中文前面不要有乱七八糟的符号，转换符号也保持一致。ocr 识别窗口的翻译按钮放在去除换行按钮的左边。翻译服务哪来的 gemini 和 openai 去掉。还有下面的状态细节，把窗口底部没用的空白都给我去掉，傻逼。还有这个词典界面和翻译窗口界面，圆角的边框线你都画出来了，边框线外面的空白留着干嘛。

## Assistant

_[tool: list_files]_

_[tool: read_file]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: update_todos]_

Got it. Let me make all the changes you described.

_[tool: str_replace_edit]_

### 1. Titlebar buttons — reorder, drop border, fill-on-active

_[tool: str_replace_edit]_

### 2. OCR window — action bar reorder + unified lang dropdowns + translate card matches recognition

_[tool: str_replace_edit]_

Now reorder the action bar and unify language pickers with the translate window:

_[tool: str_replace_edit]_

### 3. Remove gemini & openai from translate services list

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Also swap openai → bing in the sample translate window data:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

### 4. Trim artboards so they hug window content — no whitespace below the rounded border

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Let me also fix the state windows so they hug content (they currently set `height: 100%` which pinned them to the old fixed artboard height):

_[tool: done]_

_[tool: fork_verifier_agent]_

Done. Changes applied:

- **Titlebar buttons**: 置顶 now sits before 固定; both are borderless — stroke-only glyph when off, filled glyph when on.
- **Translate / Dict / state windows**: artboards switched to `height: auto` and the state-window inner shells dropped `height: 100%`, so the rounded card hugs its content with no white space below or beside it.
- **OCR translate card**: now matches the recognition card visually (same neutral background, same muted mono label) — only the leading label text distinguishes them.
- **OCR action bar** (both modes):
  - Left: 复制图片 → 系统 OCR → 自动检测 → (swap → 简体中文 in translate mode) → 重新识别/重新翻译
  - Right: (翻译 only in recognize mode, placed left of 去除换行) → 去除换行 → 去除空格 → 复制文本 → 导出
  - 自动检测 and 简体中文 now use the same transparent `LangDropdown` as the translate window — no leading icons, swap glyph matches.
- **Services**: removed openai and gemini from the translate services list (count adjusted 7 → 5), and swapped openai → bing in the sample translate cards / error state.

## User

Verifier agent check completed

## Assistant

Verified clean. All the requested changes are in place.

## User

置顶按钮和固定按钮放进一点，放大 0.5倍。然后固定安娜中间的锁芯填充在按钮点击后颜色填充后需要反色变成白色或者暗色（根据明暗）。词典窗口，对于英文词，只有英文词典，没有中文。对于中文字词，只有中文词典字典没有英文。ocr 窗口，自动检测的按钮样式要和重新识别一样，有背景色，按钮顺序改一下，系统 ocr 重新识别 自动检测。ocr 翻译窗口。自动检测 简体中文按钮的背景色也要和重新翻译一样。然后按钮顺序需要这么排。系统 ocr 重新识别 自动检测 转换符号 简体中文 重新翻译。配置改名设置，没有配置，只有设置。设置窗口不需要置顶按钮，改成普通的最小化 最大化 关闭窗口按钮 放在右上角。托盘窗口要显示几个功能的快捷键。更新器页面也不需要固定按钮和置顶按钮。

## User

置顶按钮和固定按钮放近一点，分那么远干嘛，符号放大 0.5倍。然后固定按钮中间的锁芯填充在按钮点击后颜色填充后需要反色变成白色或者暗色（根据明暗）。词典窗口，对于英文词，只有英文词典，没有中文。对于中文字词，只有中文词典字典没有英文。ocr 窗口，自动检测的按钮样式要和重新识别一样，有背景色，按钮顺序改一下，系统 ocr 重新识别 自动检测。ocr 翻译窗口。自动检测 简体中文按钮的背景色也要和重新翻译一样。然后按钮顺序需要这么排。系统 ocr 重新识别 自动检测 转换符号 简体中文 重新翻译。配置改名设置，没有配置，只有设置。设置窗口不需要置顶按钮，改成普通的最小化 最大化 关闭窗口按钮 放在右上角。托盘窗口要显示几个功能的快捷键。更新器页面也不需要固定按钮和置顶按钮。

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: str_replace_edit]_

Now I'll apply all the changes.

### 1. Titlebar — closer buttons, bigger icons, lock keyhole inverted, optional hide### 2. DictWindow — split into English-only and Chinese-only variants

_[tool: str_replace_edit]_

### 3. OCR action bar — reorder & switch lang pickers to pill style (with background)

_[tool: str_replace_edit]_

### 4. Updater — no pin/lock buttons; Tray — show shortcuts

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

### 5. Settings window — replace pin sidebar header with proper titlebar (min/max/close, no pin)

_[tool: str_replace_edit]_

### 6. Rename 配置 → 设置 in the canvas, and add Chinese-dict artboard

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Done. Summary of changes:

- **Titlebar buttons**: 置顶 + 固定 grouped in a tight 2px-gap wrapper (no longer spread by the 6px titlebar gap), icons enlarged ~50% (lock 24px, pin 25px). The lock has a custom glyph — when filled, the keyhole line stroke flips to `var(--bg)` so it reads as a knock-out in both light and dark themes.
- **Dict window**: now language-scoped via a `lang` prop. English headword → only the Free Dictionary section; Chinese headword (`调和`) → only the 现代汉语词典 section. Added a second artboard so both variants are visible.
- **OCR action bar**: reordered to 复制图片 → 系统 OCR → 重新识别 → 自动检测 (→ swap → 简体中文 → 重新翻译 in translate mode). All language pickers now use the same pill style (background + border) as 重新识别/重新翻译.
- **Settings window**: dropped the sidebar pin row, dropped the content header, and added a real titlebar (no pin/lock; min/max/close trio in the top-right). Mode label reads "设置 · 通用" etc.
- **Tray menu**: now shows ⌃⌥T / ⌃⌥S / ⌃⌥⇧S / ⌃⌥, shortcuts next to the matching items.
- **Updater**: pin/lock hidden via new `noPin` prop on TitlebarLeft.
- **Section title**: "04 · 配置窗口" → "04 · 设置窗口".

## User

Verifier agent check completed

## Assistant

_[tool: read_file]_

_[tool: write_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

All three fixes applied — section title now reads "04 · 设置窗口", the empty-state button reads "设置快捷键", and the backup hint reads "备份内容：设置、…".

