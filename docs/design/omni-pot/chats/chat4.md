# Translation Window Design

_Started 2026-05-16 03:03 UTC_

---

## User

翻译窗口的自动检测转换符号简体中文，这两个语言应该是下拉框，是可以选择语言的。删除换行和删除空格换符号用 react-icons 库。删除换行用 MdSmartButton（来自 react-icons/md），删除空格用 CgSpaceBetween（来自 react-icons/cg）。

## Assistant

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

## Assistant

_[tool: str_replace_edit]_

Now I'll update the translation window to:
1. Add real dropdowns for source/target languages
2. Load `react-icons` via esm.sh and use `MdSmartButton` (newline) + `CgSpaceBetween` (space)
3. Add the "remove spaces" button alongside "remove newlines"

First, let me add react-icons loading to the HTML:

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: read_file]_

_[tool: show_html]_

_[tool: str_replace_edit]_

Now let me update `translate.jsx` to:
1. Add a `RIcon` wrapper that renders react-icons (waits for them to load)
2. Replace `LangPick` with a proper dropdown using existing `Select`/`LangSelect` pattern, styled to match
3. Add a "remove spaces" button alongside "remove newlines", both using react-icons

_[tool: str_replace_edit]_

## Assistant

Now let me update translate.jsx to:
1. Add a `LangDropdown` component (matching the inline-pill look but with a real dropdown)
2. Add a `ReactIcon` wrapper that handles async-loaded react-icons
3. Add a "remove space" button alongside "remove newline", using react-icons

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: done]_

_[tool: fork_verifier_agent]_

I've updated the translation window:

- **Language dropdowns**: 自动检测 and 简体中文 are now real dropdowns (`<LangDropdown>`) — click to see a list with mono lang codes (AUTO/EN/ZH/JA/…) and full names. Source includes 自动检测; target excludes it. The swap button is disabled while source is on 自动检测.
- **react-icons**: loaded `MdSmartButton` (去换行) and `CgSpaceBetween` (去空格) from `react-icons@5.3.0` via `esm.sh` (ESM module → exposed on `window`). A small `<ReactIcon>` wrapper handles the async load and re-renders once icons arrive.
- **New "去空格" button**: added to the source action row, between 去换行 and 朗读.

## User

Verifier agent check completed

## Assistant

_[tool: write_file]_

Switching to importmap + react shim so react-icons uses the host React instance.

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Fixed. The previous issue was that esm.sh-bundled react-icons used its own React instance whose element `$$typeof` Symbol didn't match the host's. Now:

- Added a `react-shim.js` ESM module that re-exports the host's `window.React`
- Added an `<script type="importmap">` mapping `"react"` → `./react-shim.js`
- Load react-icons with `?external=react` so the icon modules import React from the shim — same instance as the app

`MdSmartButton` (去换行) and `CgSpaceBetween` (去空格) now render through real react-icons components. Language dropdowns also active.

## User

设置里面的通用设置，它那个界面语言应该在应用那个大卡片里，不在外观这个大卡片.设置的翻译设置里面的语言的大卡片。他那个语言的标签去掉，你就直接显示自动检测简体中文English就行，不要显示auto ZH EN。把那个识别的设置界面也做出来，还有设置快捷键里面的那个系统快捷键可能不可用的。提示你放在下面的状态细节就行，不要放在那个主要的界面里。服务设置的编辑按钮和删除按钮都太小了。取消所有地方的stream标签。设置里面的那个字体改成文字，然后这个文字设置后面跟着字体选择系统默认字号多大多大。设置里面的翻译设置你那些语言你点选的时候，它都那个下拉框不会超过语言的大卡片。就我选个第二语言，它就只冒出来一个English，然后下面半行简体中文，你剩下的内容都被那个卡片挡住了。然后选择语言的话，你应该是简体中文English 这样的，语言就用对应语言的翻译文字。不要中文。翻译设置中的第二语言、目标语言等语言项应按对应语言自身文字显示，例如英语显示为 `English`，日语显示为对应的日语名称，而不是统一按当前界面语言显示。翻译窗口的自动检测转换符号简体中文，这两个语言应该是下拉框，是可以选择语言的 这个选择语言应该可以选择多种语言 你现在怎么就只有一个简体中文在那.应该可以选择简体中文，English什么什么之类的.还有我让你换的符号怎么没换呀,翻译窗口的你换了？你这个识别OCR窗口你没换呀

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: str_replace_edit]_

I have a lot of changes to make. Let me handle them systematically.

First, fix the Select component to use fixed positioning (escape card clipping) and remove the flag prefix:Now update translate.jsx — make LangDropdown use fixed positioning, drop the mono labels, expand language lists, switch icons in source state too:

_[tool: str_replace_edit]_

Now update OCR window — swap newline/space icons, fix lang names to native:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now update config.jsx — General/Translate/Recognize/Hotkey/Service pages:

_[tool: str_replace_edit]_

Now add a Wayland hotkey-unavailable state card to the "状态细节" section in the main HTML, since I removed it from the hotkey page:

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

Now define the HotkeyUnavailableBanner component in the main HTML:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Round-up of changes:

- **OCR window**: `MdSmartButton` (去换行) + `CgSpaceBetween` (去空格) now used in the action bar; added an image-copy button at the far left of the bar.
- **Language dropdowns** (translate window & config-translate card): switched to `position: fixed` popups so they escape `overflow:hidden` on cards; removed the `AUTO/ZH/EN` mono code labels; each lang now shown in its own native script (English, 日本語, 한국어, Français, …); expanded to 15 langs source / 14 target.
- **配置 → 通用**: 界面语言 moved into the 应用 card; 字体 row renamed 文字 and now hosts both a font picker (系统默认/Geist/Inter/SF Pro/Noto) and a size picker (12–16px).
- **配置 → 识别**: fleshed out — engine, language, auto-newline-removal, auto-copy, dynamic OCR, blur-close, hide-on-recognize, default export format, screenshot post-action, edge color.
- **配置 → 快捷键**: Wayland banner removed; moved to new "Wayland 快捷键提示" card in `06 · 状态细节`.
- **配置 → 服务管理**: 编辑 / 删除 buttons now full-size with text labels.
- **Stream pills removed** everywhere (translate result cards and service-list tags).

## User

Verifier agent check completed

## Assistant

All checks passed. Changes are in place.

## User

翻译窗口长文本的滑动你没有体现出来。就文本太长的话，它有一个最高长度限制，然后在那个窗口内是可以滑动的，就在这个输入文本的小卡片里面可以滑动。你这个翻译窗口，那个选择语言，你选择的语言蹦出来的弹窗怎么跑偏了。选择语言，蹦出来的弹窗应该就在语言的语言下面。识别和OCR窗口，它那个翻译的时候也可以设置目标语言，你想一下这个设置放在哪比较好。就是如果用户在这个OCR窗口点击翻译了，或者说本来就是OCR翻译的窗口，你就要多一个可以选择目标语言的下拉框。就是OCR窗口和OCR翻译的窗口，应该是两个。多了一个翻译的下拉框。你这个设置里面的翻译怎么不能点击出来一个下拉框切换语言了。还有，你这个快捷键绑定很丑啊。你前面显示快捷键，后面已绑定，下面是空的，然后是绑定两个字，根本没有对齐。翻译窗口也给结果加上按钮，可以拖动顺序。这里的按钮要和服务那里的那些服务的拖动按钮保持一致。把你那个wayland的快捷键提示给去掉，你要提示，只需要提示快捷键已经被其他应用占用。

## Assistant

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

## Assistant

_[tool: grep]_

_[tool: str_replace_edit]_

## Assistant

_[tool: str_replace_edit]_

Now I'll fix all the issues. First, the dropdown position bug — the design canvas uses CSS transforms so `position: fixed` doesn't work without a portal:Now fix the LangDropdown in translate.jsx to also use a portal, and align under the trigger. Also add drag handles to ResultCard:

_[tool: str_replace_edit]_

Now update OCR window to accept a `translate` mode prop, adding a target-language dropdown:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now update the hotkey row in config.jsx for better alignment, and add the OCR-translate artboard in main HTML, and simplify the Wayland banner:

_[tool: str_replace_edit]_

Now update the main HTML — extend the long-text sample so scrolling is visible, add the OCR-translate artboard, simplify the Wayland banner:

_[tool: str_replace_edit]_

## User

继续 改完没

## Assistant

_[tool: done]_

_[tool: fork_verifier_agent]_

Summary of this round:

- **Long-text scroll**: extended the sample text in 02 artboard so internal scroll inside the source card is visible.
- **Dropdown positioning**: Select / LangDropdown / PillSelect now portal their popups to `document.body` and use `position: fixed` — they escape both card `overflow:hidden` and the DesignCanvas's CSS transform. Popups now land directly under (or above when no space) the trigger, centered on it.
- **OCR window**: split into two artboards — `识别窗口` and `OCR 翻译窗口`. The translate variant adds a target-language pill dropdown in the action bar (translate icon → lang) and stacks two text cards on the right (识别 + 翻译).
- **配置 → 快捷键**: redesigned row layout — single horizontal row with proper alignment; bound state shows a × clear button instead of a static "已绑定" tag; empty state shows a normal "绑定" button.
- **Wayland banner**: removed; the state-detail card now shows a red-tinted "快捷键已被其他应用占用" notice referencing the conflicting combo.
- **Result cards**: drag handle (`Icons.Drag`) added to the left of the service tile, matching the service-list rows.
- **Bug fixes**: removed the stuck "stream" pills; OCR action bar dropdowns open upward since they sit at the window bottom.

