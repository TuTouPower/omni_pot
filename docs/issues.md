# 已知问题记录

*这里记录了当前项目已知的遗留问题、待办修复或需要追踪的缺陷。已解决的问题归档在 `docs/archive/closed_issues/` 目录下。*

## Windows / 打包实机 smoke

- [ ] **语音朗读（TTS）实机发声验证**：自动化 + PowerShell SAPI 已验证发声链路；仍需在 Windows dist 产物中翻译/词典/识别窗口点击朗读人工确认有声音。
- [ ] **打包后基础路径 smoke**：`npm run dist` 后在 Windows 上验证首次启动、托盘、快捷键、截图、设置窗口、识别窗口。

## 翻译

- [ ] **谷歌翻译当前环境失败**：保留为已知问题，不用 mock 隐藏；需要在网络可达的环境复测，或更换默认免费引擎。

## 窗口尺寸记忆

- [x] **窗口宽度应按类别记忆**（2026-05-20）：翻译窗口和词典窗口共享同一份宽度记忆（`translate_remember_window_size` / `translate_window_width` / `translate_window_height`）；文字识别窗口和截图翻译窗口共享同一份宽度记忆（`recognize_remember_window_size` / `recognize_window_width` / `recognize_window_height`）；设置窗口单独记忆。已实现 `dict_options.ts` 使用翻译窗口配置键，`recognize_options.ts` 使用独立配置键。设置页翻译设置和文字识别设置各有"记住窗口大小"开关。

## 快捷键设置

- [x] **快捷键设置不要显示"绑定成功"提示**（2026-05-20）：绑定成功后不再设置 status，只有冲突和失败才显示提示。
- [x] **一次只能设置一个快捷键**（2026-05-20）：`HotkeySettings` 组件维护 `activeField` 状态，当一个字段进入录入态时，其他字段自动退出。通过 `onStartCapture` 回调实现互斥。

## 置顶按钮（固定按钮）

- [ ] **翻译、词典、文字识别、截图翻译窗口均应有置顶按钮**：除设置窗口外，所有主要窗口都应有样式和行为完全一致的置顶按钮。当前存在部分窗口缺失或样式不统一的情况。
- [ ] **置顶按钮图钉符号缺少竖线**：当前实现的图钉图标路径 `M12 16v6` 已包含竖线，但用户反馈仍缺失。需在 dist 实物中确认视觉效果，可能需要调整 strokeWidth 或 path。

## 去除换行 / 去除空格符号

- [ ] **去除换行、去除空格图标与 demo 不一致**：当前 `Icons.Newline` 和 `Icons.Space` 已按 demo 的 `MdSmartButton` / `CgSpaceBetween` 样式重绘，但仍需在实物中确认一致性。

## 截图翻译语言显示

- [x] **截图翻译目标语言显示错误**（2026-05-20）：识别出中文后翻译成英文时，底栏语言区域现在显示实际使用的目标语言（包括第二语言回退），而非始终显示配置的目标语言。通过 `effectiveTargetLang` 状态跟踪实际翻译目标。
- [x] **目标语言下拉框不应包含"自动检测"**（2026-05-20）：目标语言 PillSelect 使用 `LANGUAGE_CODES.filter(c => c !== 'auto')` 构建选项列表，不再包含"自动检测"。
- [x] **语言下拉框出现两个"自动检测"**（2026-05-20）：源语言选项列表构建时 `LANGUAGE_CODES` 已包含 `'auto'`，之前又手动 unshift 了一个 `'auto'`，导致重复。已修复为先手动添加 `'auto'`，再从 `LANGUAGE_CODES` 中 filter 掉 `'auto'`。
- [x] **截图翻译语言标签需显示具体语言名称**（2026-05-20）：截图翻译模式下，识别结果卡标题显示"`{检测语言}的文字识别`"，翻译结果卡标题显示"`{目标语言}的翻译`"。通过 `detectedSourceLang` 和 `effectiveTargetLang` 状态实现。

## 词典服务分流

- [ ] **中文字词应只调用中文词典和 ecdict**：代码层面 `handleLookup` 已按 `detected === 'en'` 分流到 `enServiceList` / `zhServiceList`。需通过 e2e 测试验证实际行为。
- [ ] **英文字词应只调用 Free Dictionary 和 Cambridge**：同上，需 e2e 验证。
- [ ] **简单中文字词查询无结果**：如"经济"、"自我"、"佛"等常用字词，中文词典查不出结果，需排查 chinese_dictionary 数据库查询逻辑或数据覆盖范围。
