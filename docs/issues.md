# 已知问题记录

*这里记录了当前项目已知的遗留问题、待办修复或需要追踪的缺陷。当问题被解决后，相关的记录将被移除。如果积累了大量已解决的问题，或该文件过长，可将其归档到 `docs/archive/` 目录下。*

## Windows / 打包实机 smoke

- [ ] **语音朗读（TTS）实机发声验证**：自动化 + PowerShell SAPI 已验证发声链路；仍需在 Windows dist 产物中翻译/词典/识别窗口点击朗读人工确认有声音。
- [ ] **打包后基础路径 smoke**：`npm run dist` 后在 Windows 上验证首次启动、托盘、快捷键、截图、设置窗口、识别窗口。

## 翻译

- [ ] **谷歌翻译当前环境失败**：保留为已知问题，不用 mock 隐藏；需要在网络可达的环境复测，或更换默认免费引擎。
- [ ] **DeepL 对部分长英文段落返回原文**：复现：把 `1.txt`（一段英文客服申诉邮件，约 17 行、含 case number 与多个段落）作为源文本输入翻译窗口，DeepL 卡片返回的"翻译结果"和源文本完全一致（即未翻译成中文）；同样输入下 Bing 能正常翻译。其他较短英文段落 DeepL 工作正常。怀疑 DeepLX 免费端点对包含数字 ID/换行格式的长文有自动跳过/检测逻辑。需排查 [src/services/deepl.ts](src/services/deepl.ts) 的 source_lang 推断、deeplx_free 类型分支和返回体解析。

## 测试

- [ ] **TTS playback state e2e**：fixture 已支持 `init_script`，`translate_source_area` 和 `translate_result_cards` 已恢复完整按压/取消等待断言。如发现新的 TTS 状态分支没覆盖，仍在此跟踪。
