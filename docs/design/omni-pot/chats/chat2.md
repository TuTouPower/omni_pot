# 软件界面优化建议

_Started 2026-05-15 20:26 UTC_

---

## User

置顶按钮和关闭窗口的按钮，放大符号。软件名前面的点去掉，不需要这个。置顶符号如果没有置顶中间是空的，如果置顶了就是实心，是可点击的。自动检测简体中文之间转换符怎么有点歪，上下两个横。设置里面可以设置主色调，就放在外观里面。去除开发者模式。首次启动的欢迎页，下面的配置快捷键 跳过两个按钮和上面的四个功能的中间的空白太多了。

## Assistant

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

I'll make all the requested changes. Let me update the files:

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now update TitlebarLeft: remove dot, make pin/close icons larger, make pin clickable and toggleable:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Add CSS hover states for the new pin/close buttons:Now fix ConfigWindow: remove dot, remove developer mode, add primary color picker in appearance section:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now fix the welcome page spacing (remove the big flex:1 spacer):

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: done]_

Now let me verify everything looks good:

_[tool: fork_verifier_agent]_

Done. Changes applied:

- **Pin & close buttons** in the translate titlebar enlarged (icons 14→18px, hit area 24→28px)
- **Removed colored dot** before "Omni Pot" wordmark across translate / config / tray / generic titlebars
- **Pin button is clickable** — hollow when not pinned, filled (and primary-tinted) when pinned, toggles on click
- **Swap icon** redrawn as two clean parallel horizontal arrows
- **Settings → 外观**: added 主色调 row with 5 curated swatches (writes to `--brand-primary` and persists via the tweak channel)
- **开发者模式** row removed from 外观
- **首次启动** welcome page: removed the `flex:1` spacer between the 4 entry items and the bottom buttons; artboard height trimmed 460→420

## User

Verifier agent check completed

## Assistant

Verifier confirmed all changes look correct.

