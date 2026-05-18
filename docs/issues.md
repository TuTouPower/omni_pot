# 已知问题记录

*这里记录了当前项目已知的遗留问题、待办修复或需要追踪的缺陷。当问题被解决后，相关的记录将被移除。如果积累了大量已解决的问题，或该文件过长，可将其归档到 `docs/archive/closed_issues/` 目录下。*

## Windows / 打包实机 smoke

- [ ] **外部服务真实连通性波动**：`OMNI_POT_EXTERNAL_SERVICE_TESTS=1 npm run test:e2e -- specs/external_services.spec.ts` 已覆盖无密钥、免费、可公网直接调用的翻译/词典/TTS 服务；完整依赖分类见 `docs/external_services/external_services.md`。2026-05-18 当前环境结果为 Bing、DeepL 免费模式、MyMemory、Cambridge、Free Dictionary 通过，Google、Lingva Translate、Edge TTS、Lingva TTS 失败。默认翻译服务已避开 Google/Lingva，TTS 实机发声仍需在 Windows 打包产物验证。
- [ ] **语音朗读（TTS）实机发声验证**：自动化已覆盖朗读 IPC/按钮状态链路，但是否真实出声需要在 Windows 打包产物中手动验证：翻译、词典、识别窗口点击朗读后应能听到声音。
- [ ] **谷歌翻译打包产物验证**：`OMNI_POT_EXTERNAL_SERVICE_TESTS=1 npm run test:e2e -- specs/external_services.spec.ts` 已覆盖真实 Google Translate 健康检查；当前环境失败时保留问题，不用 mock 隐藏。
- [ ] **打包后基础路径 smoke**：`npm run dist` 后在 Windows 上验证首次启动、托盘、快捷键、截图、设置窗口、识别窗口。
