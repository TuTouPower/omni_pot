# omni_pot 设计稿已知偏差

> 记录 `docs/design/omni_pot/` 设计稿与 `docs/spec.md` 不一致的地方。
> **设计稿文件本身不修改** —— 本文件仅作备忘，便于阅读设计稿时知道哪些点是已知偏差，
> 不要把这些偏差照抄到代码或 spec 里。
> 设计稿原型文件：`design-canvas.jsx`、`shared.jsx`、`windows/translate.jsx`、
> `windows/other.jsx`、`windows/config.jsx`、`styles.css`、`omni_pot Design.html`。
> `uploads/spec.md` 是旧上传参考，不作为当前设计稿依据。

---

## 1. 检测引擎选项不全

`windows/config.jsx` `PageTranslate` 检测引擎仍只有 3 项（`本地 (Lingua) / Google / 百度`），且默认选中 `local`。

spec §17 是 6 项（`bing / google / baidu / tencent / niutrans / local`），默认值为 `bing`，失败回退顺序为 `bing → google → baidu → tencent → niutrans → local`。

## 2. 源文本编辑器实现形态不同

`windows/translate.jsx` 的源文本区域使用 `contentEditable` 原型；当前实现继续使用受控 `textarea`，以保留 IME、快捷键、Playwright 输入断言和无障碍表单语义。视觉行为已按设计对齐为从 1 行起自动增长、最多约 8 行后内部滚动。

## 3. 翻译结果卡片 loading 与 stream 标签需要对齐 spec

`windows/translate.jsx` 的结果卡片状态仍需按 spec 更新：不显示 `stream` / 流式标签，流式能力只是实现细节；等待翻译结果时，卡片内部应显示一段小型动效（如三点跳动、细条 shimmer 或轻量 spinner）配合简短”翻译中…”状态，不能只留下空白卡片或暴露 `stream` 标签。

## 4. 托盘菜单项与当前实现不一致

`windows/other.jsx` `TrayMenu` 包含以下菜单项：输入翻译、OCR 识别、OCR 翻译、剪贴板监听（勾选）、自动复制（子菜单）、设置、检查更新、查看日志、重启、退出。

当前 `electron/tray/index.ts` 实际实现的菜单项为：输入翻译、OCR 识别、截图翻译、剪贴板监听（checkbox）、设置、检查更新、查看日志、重启、退出。

差异：

- example 用”OCR 翻译”，代码用”截图翻译”——名称不同。
- example 有”自动复制”子菜单入口，代码没有。
- example 有快捷键标注（⌥ Q、⌥ ⇧ S 等），代码没有。

## 5. 设置窗口 pin/close 按钮尺寸偏小

以 `windows/translate.jsx` 为准：pin/close 按钮为 28×28px、图标 size={18}。

`windows/config.jsx` 的 pin/close 按钮使用 `.ic-btn` 样式（24×24px）、图标 size={15}/size={14}，比翻译窗口小，需要对齐到 28×28px、size={18}。

## 6. Wayland 提示仍保留在 example 快捷键页

`windows/config.jsx` `PageHotkey` 底部仍显示 Wayland 提示卡片（”Wayland 用户：系统级快捷键可能不可用…”）。

按 issue #22 和 spec 决策，该提示已从默认快捷键设置页移除，只作为故障排查或错误态说明。example 中仍作为常驻内容展示，属于已知偏差。

## 7. 翻译源文本区操作按钮图标尺寸偏大

`windows/translate.jsx` 的 `SOURCE_BUTTONS` 使用 `size={16}`，翻译按钮使用 `Icons.Translate size={18}`。
当前实现中普通操作符号为 13px，与汉字视觉大小一致。

example 的图标尺寸比当前实现大约 20-38%，需确认以哪个视觉规格为准。

## 8. 翻译窗口和识别窗口使用固定尺寸

`windows/translate.jsx` 的 `TranslateWindow` 默认 `width={400}`。
`windows/other.jsx` 的 `RecognizeWindow` 固定 `width: 860, height: 520`。

按 issue #4（翻译窗口尺寸应自适应内容）和 issue #7（识别窗口应根据内容计算大小），两个窗口的 example 都使用固定尺寸，未体现自适应行为。当前 example 作为静态原型可以接受，但不能作为自适应布局的参考。

## 9.默认主题色改成5个颜色里最淡的那个蓝色

## 10. 翻译窗口标题栏缺少 "置顶" 按钮

`windows/translate.jsx` `TitlebarLeft` 只有一个 pin 按钮，含义混在 "固定" 与 "置顶" 之间。

按 `docs/issues.md` 的产品决策，标题栏需要拆成 **两个独立按钮**：

- **固定**：仅控制窗口在失焦时不自动关闭。
- **置顶**：控制窗口 always-on-top；点击置顶时自动激活固定，但点击固定不激活置顶。

设计稿需补一个独立的"置顶"按钮（与现有 Pin 风格一致，建议复用 `Icons.Pin` 加上方向变体或换一个图钉/图层图标），并明确两种激活态的视觉差异（建议主色 fill 表示开启）。

## 11. 翻译结果卡片缺少 "重试" 按钮设计

`windows/translate.jsx` `ResultCard` 错误态只把 `r.error` 渲染成一段红色文字，没有重试入口。

按 `docs/issues.md` "翻译失败重试功能失效"，错误态需要在错误文字旁展示一个**重试图标按钮**（建议 `Icons.Cycle` size=14，点击后重新请求该实例的翻译）。设计稿需补该按钮，标注它仅在错误态出现，与卡片右上角操作按钮区分。

## 12. 翻译结果卡片初始态应为折叠 + 加载动效

`windows/translate.jsx` `ResultCard` 默认 `col = false`（展开），仅在 header 内显示 "翻译中…" 小字。

按 `docs/issues.md` "翻译结果卡片折叠与加载动效"：

- **初始查询时**结果卡片应处于**折叠状态**（只显示 header），等待时在 header 处展示加载动效（如三点跳动）。
- **结果返回后自动展开**，窗口高度也随之延长以适应内容。
- 词典窗口的结果卡片同此规则。

设计稿需明确"折叠+loading""展开+result"两种状态的过渡，并提供加载动效原型，避免后续实现只画了空白卡片或停留在展开 + 文案。

## 13. 朗读按钮缺少播放中 / 加载中视觉状态

`windows/translate.jsx` 源文本区与 `ResultCard` 的朗读按钮 `Icons.Volume size=16` 没有 active/busy 视觉态。

按当前实现，朗读按钮有 `idle / busy / playing` 三态，需要设计稿至少明确 `playing` 时的视觉（建议主色 fill + 标题 "停止朗读"），便于实现对齐而不需要测试再去猜。

## 14. 词典卡片 / 翻译卡片折叠按钮统一图标

`windows/translate.jsx` 用 `Icons.Chev` 旋转表达折叠/展开；词典 `DictWindow` 卡片暂无折叠按钮。

按 `docs/issues.md` "词典结果卡片折叠与加载动效"，词典卡片也需折叠/展开能力。设计稿需补词典卡片的折叠按钮与加载动效，与翻译卡片视觉一致。

## 15. 翻译窗口尺寸约束未在设计稿表达

`windows/translate.jsx` 用固定 `width={400}` 静态展示，未表达自适应约束：

- **max-height** = 全部内容卡片完整展示后的高度（不允许窗口被拉伸出底部空白）。
- **min-height** = 第一个结果卡片完整可见的高度。
- **min-width** = 语言切换行（源语言 → 转换符号 → 目标语言）完整可见的宽度。

`docs/spec.md` 已有自适应约束描述（issue #4），设计稿仍以静态原型展示，确认设计稿不更新；后续以 spec 为准实现，并由 `tests/user_e2e/specs/translate_window_constraints.spec.ts` 守护。

## 16. 设置窗口设计稿仍保留旧术语

`windows/config.jsx` 与 `.design-canvas.state.json` 仍有用户可见的”配置”旧术语（例如”配置目录”）。当前实现、spec、测试和文档已统一为”设置”；设计稿文件按约定不直接修改，后续更新设计稿时需要同步迁移这些文案。
