# 识别工具设置优化

_Started 2026-05-18 20:51 UTC_

---

## User

取消文字识别窗口和截图翻译窗口的重新识别按钮。设置里面的主题改成3个按钮让用户选，不要下拉框。预览: Hello World 你好世界 こんにちは 안녕하세요  设置里面的字体，改名文字，然后在文字设置好之后，下面要有一个预览，就跟着上面的设置顺应的变。设置的历史界面里要加一个按钮，是否开启历史记录。你可以把这个按钮放在搜索框的左边，就一行是开关按钮，搜索框服务选择时间选择，然后清空。

## Assistant

_[tool: read_file]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

I'll make the requested changes:

1. Remove "重新识别" buttons from both recognize windows
2. Change theme to 3-button selector
3. Add font preview below 文字 settings
4. Add history toggle in the history settings, on the same row as search/filters

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now update the General page — theme as 3-button segmented control + font settings with live preview:

_[tool: grep]_

The characters might differ — let me check the actual characters:

_[tool: str_replace_edit]_

_[tool: grep]_

Now check that Select supports onChange, then update PageHistory:Good. Now update PageHistory to add the toggle:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: read_file]_

Let me dim the rest of the history content when disabled:Now let me check whether the file loads cleanly:

_[tool: done]_

_[tool: fork_verifier_agent]_

改完了：

1. **文字识别 / 截图翻译窗口** — 移除了 "重新识别" 和 "重新翻译" 按钮
2. **设置 → 外观 → 主题** — 改成 3 按钮分段控件（跟随系统 / 浅色 / 深色），不再是下拉框
3. **设置 → 外观 → 字体** — 把"文字"重命名为"字体"，字体/字号下方新增预览块，实时跟随上方设置变化（"Hello World 你好世界 こんにちは 안녕하세요"）
4. **设置 → 历史** — 在搜索框左边加了"启用历史记录"开关，与搜索框 / 服务选择 / 时间选择 / 清空 同一行；关闭时其余筛选自动变灰

## User

预览去掉。字体改名文字。启用历史记录改成启用两个字就行。搜索框太大了。就那么一行，你要把所有的内容都展示在窗口里呀。本地API端口那里旁边加一个，那外面是一个圈，里面是一个小问号的，就点一下就能点开官网的API文档。

## Assistant

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

Good — the help "?" will render right next to the input. Let me verify:

_[tool: done]_

_[tool: fork_verifier_agent]_

改完了：

1. **预览块** — 已删除
2. **"字体" → "文字"**
3. **历史 → "启用历史记录" → "启用"**（精简成两个字的圆角小按钮，留出更多空间给搜索框）
4. **搜索框** — 已调整：标签变短，过滤项最小宽度收紧，所有内容在 780px 窗口内一行显示
5. **本地 API 端口** — 输入框右侧加了一个圆圈包问号的小按钮，悬停变主色调，点击新窗口打开 API 文档

## User

Verifier agent check completed

## Assistant

好的，验证通过 ✅

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: done]_

已把问号按钮移到「本地 API 端口」这几个字旁边，做小了一号，跟标签贴着——这样位置更自然，也不抢眼。

