# example 设计稿已知偏差

> 记录 `docs/design/example/` 设计稿与 `docs/spec.md` 不一致的地方。
> **example 文件本身不修改** —— 本文件仅作备忘，便于阅读 example 时知道哪些点是已知偏差，
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

## 3. 配置窗口默认页不同

`windows/config.jsx` 的 `ConfigWindow` 原型默认打开 `translate` 页；当前产品仍默认打开 `general` 页，避免首次进入设置时跳过应用、外观、语言等全局设置。
