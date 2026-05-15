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
