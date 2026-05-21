# 文字识别设置页面

_Started 2026-05-21 06:39 UTC_

---

## User

设置窗口添加文字识别页面的设置，- 默认识别语言（默认：自动检测）
- 自动去除换行（默认关闭）
- 自动复制结果（默认开启）
- 失焦时关闭（默认开启） 
- 识别后隐藏窗口（默认开启） 当前 spec 要求用户可见快捷键使用简洁清晰、带空格的格式：
- Windows / Linux：`Ctrl + Alt + T`
- macOS：`Cmd + Opt + T`  - 用户入口统一为“词典”，不使用“字典词典”作为按钮、菜单、窗口模式名。
- 中文 UI 使用“文字识别 / 截图翻译”，避免显示“OCR”三字母。主卡片、主要按钮统一 10px；pill、圆形 icon button、颜色圆点等小元素可保留 pill / 圆形语义。

## Assistant

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

Looking at the project, I can see the recognize settings page already exists in `config.jsx`. I need to:

1. Update defaults so `失焦时关闭` and `识别后隐藏窗口` default to `true`
2. Add a `cfg-recognize` artboard to the design canvas (currently missing!)
3. Make sure user-visible shortcuts use the ` + ` spaced format

_[tool: str_replace_edit]_

Now add the missing artboard for the recognize settings page:

_[tool: str_replace_edit]_

Now update the `TranslateEmptyState` to show shortcuts with the spec's `Ctrl + Alt + T` format (with `+` separators):

_[tool: grep]_

_[tool: str_replace_edit]_

I see two user-visible instances of "字典词典" that should be just "词典":

_[tool: str_replace_edit]_

_[tool: done]_

Made these changes to align with the spec:

**Settings · 文字识别 page (`windows/config.jsx`)**
- Updated default toggle values: `失焦时关闭` → 开启, `识别后隐藏窗口` → 开启
- (The page already had: 默认识别语言 = 自动检测, 自动去除换行 = 关闭, 自动复制结果 = 开启)

**Design canvas (`omni_pot Design.html`)**
- Added the missing `cfg-recognize` artboard so the 文字识别 settings page is now visible in the 04 · 设置窗口 section
- Welcome screen快捷键 badges now render `Ctrl + Alt + T` (with `+` separators) matching the spec format
- Removed "字典词典" wording — now just "词典" in welcome card and hotkey settings

Note: "OCR" still appears in internal JS identifiers (`OCR_ENGINES`, `OCR_LANGS`) and the source `spec.md` — those aren't user-visible. All Chinese UI strings now say "文字识别 / 截图翻译".

_[tool: fork_verifier_agent]_

Done.

## User

Apply comment

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: done]_

The `HK` component already splits on `+` and renders each segment as a separate `<kbd>` with `+` separators between them, so the user sees `[Ctrl] + [Alt] + [T]` — already matches the spec.系统托盘的快捷键已更新为 `Ctrl + Alt + T` 带空格格式（翻译、词典、文字识别、截图翻译、设置都改了）。

