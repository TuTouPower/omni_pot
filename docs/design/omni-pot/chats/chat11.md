# 字典词典统一格式

_Started 2026-05-19 05:04 UTC_

---

## User

所有字典词典的返回使用相同的格式，DictResult，你根据这个对象格式来设定卡片格式。并且可以展示多个卡片，卡片ui就类似于翻译结果的 ui。服务里面对字典词典分开，改成中文词典，英文词典，可以设置中文使用什么词典，英文使用什么词典。默认情况下中文使用chinese_dictionary和ecdict，英文使用cambridge_dict和 edict。字典词典窗口改成词典。系统托盘里的字典词典也跟着改。欢迎页的字典词典也改。欢迎页的选中单词查询词典释义 改成选中字词查询字典词典。

## Assistant

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: update_todos]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now let me add `chinese_dictionary` to SVC_META and update the other files (tray, welcome, config tabs, artboard labels).Now update the welcome state and artboard labels in the main HTML file:

_[tool: str_replace_edit]_

_[tool: grep]_

Those remaining occurrences are intentional (the subtitle text "选中字词查询字典词典" per user spec). Let me verify the design renders cleanly.

_[tool: done]_

_[tool: fork_verifier_agent]_

已完成的改动：

**词典窗口（DictWindow）重写**
- 改为按 `DictResult` 统一格式渲染：每个服务一张卡片，结构与翻译结果卡片一致（拖拽手柄 + 服务图标 + 名称 + 发音 chip + 折叠箭头）。
- 卡片内展示三段：`pronunciations`（多个时溢出到正文）、`definitions`（按 partOfSpeech 分组的编号义项）、`examples`（左侧细线 + 源/译双行）。
- 顶部源词卡片：可编辑词 + 语言检测 + 朗读/复制/收藏/查询。
- 样例数据严格按测试报告里的 DictResult 形状构造：
  - 英文 `reconcile`：cambridge_dict（含 US/UK 双发音、英文释义+中文翻译合并、例句）+ ECDict 英→中（中文翻译列表，无发音）
  - 中文 `调和`：chinese_dictionary（普通话拼音、动/形分组、多义项）+ ECDict 中→英（英文释义列表）

**服务管理 · 拆分中英文词典**
- "字典词典" 一个 tab → 拆为 "中文词典"(2) 和 "英文词典"(3)
- 默认启用：中文 = chinese_dictionary + ecdict；英文 = cambridge_dict + ecdict；free_dictionary 默认关闭

**改名 字典词典 → 词典**
- 词典窗口标题栏、系统托盘菜单项、欢迎页项目标题。
- 设计画板上两个 dict artboard 的标签也同步更新。
- 欢迎页与快捷键页的副标题改为「选中字词查询字典词典」。
- 新增 `chinese_dictionary` 到 SVC_META（中字 monogram）。

## User

cambridge 换数据集了，只有纯英文。英文音标 中文拼音都单开一行，而且加上朗读按钮，字典没有朗读，但是我会额外加朗读功能。设置里面加一个日志导出按钮，你觉得放哪里合适

## Assistant

_[tool: read_file]_

_[tool: read_file]_

Pronunciations to separate lines with TTS, Cambridge purely English, plus a log-export button. I'll put **导出日志** in the **关于** page — that's the canonical "diagnostic / support" spot (sits with version info, near where someone troubleshooting would land). Let me know if you'd rather it in 备份 instead.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

已完成：

**词典卡片**
- 删除头部那枚发音 chip，发音改为正文里每行一项：`region` 标签 + 音标（mono） + 朗读按钮。无论英文 IPA 还是中文拼音都遵循同一行式。朗读按钮独立于字典数据本身（字典返回的 DictResult 没有音频字段，按你后面接入的 TTS 服务驱动）。
- Cambridge 样例改为纯英文释义（移除合并进来的中文翻译），仍保留 US/UK 双发音 + 英文例句。

**导出日志**
- 放在 **关于 → 诊断** 卡片里，紧挨「日志目录 / 设置目录 / 本机 API」三行下面，按钮文案 `导出日志`，说明文案「最近 7 天的日志打包为 zip，可附在反馈中」。
- 理由：诊断信息聚拢在一处，反馈/排错路径短；备份页是用户数据 export，日志是诊断 export，混在一起容易让用户犹豫备份里到底有没有隐私日志。如果你更想要 备份页 或 通用页 也可以挪。

## User

Apply comment

## Assistant

_[tool: str_replace_edit]_

_[tool: done]_

已改：Cambridge 的 us / uk 两个音标合并到同一行（flex-wrap + 列间距 14px），每个音标后跟自己的朗读按钮。中文只有一个发音，仍是单行显示，视觉一致。

