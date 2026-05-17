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

`windows/translate.jsx` 和当前实现需要按 spec 更新结果卡片状态：不显示 `stream` / 流式标签，流式能力只是实现细节；等待翻译结果时，卡片内部应显示一段小型动效（如三点跳动、细条 shimmer 或轻量 spinner）配合简短”翻译中…”状态，不能只留下空白卡片或暴露 `stream` 标签。

## 4. 托盘菜单项与当前实现不一致

`windows/other.jsx` `TrayMenu` 包含以下菜单项：输入翻译、OCR 识别、OCR 翻译、剪贴板监听（勾选）、自动复制（子菜单）、设置、检查更新、查看日志、重启、退出。

当前 `electron/tray/index.ts` 实际实现的菜单项为：输入翻译、OCR 识别、截图翻译、剪贴板监听（checkbox）、配置、重启、退出。

差异：

- example 用”OCR 翻译”，代码用”截图翻译”——名称不同。
- example 有”自动复制”子菜单入口，代码没有。
- example 有”检查更新”入口，代码没有。
- example 有”查看日志”入口，代码没有。
- example 有快捷键标注（⌥ Q、⌥ ⇧ S 等），代码没有。

## 5. 配置窗口 pin/close 按钮尺寸偏小

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
