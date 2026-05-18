# 已知问题记录

*这里记录了当前项目已知的遗留问题、待办修复或需要追踪的缺陷。当问题被解决后，相关的记录将被移除。如果积累了大量已解决的问题，或该文件过长，可将其归档到 `docs/archive/` 目录下。*

## Windows / 打包实机 smoke

- [ ] **语音朗读（TTS）实机发声验证**：自动化已覆盖朗读 IPC/按钮状态链路，但是否真实出声需要在 Windows 打包产物中手动验证：翻译、词典、识别窗口点击朗读后应能听到声音。
- [ ] **打包后基础路径 smoke**：`npm run dist` 后在 Windows 上验证首次启动、托盘、快捷键、截图、设置窗口、识别窗口。

## 外部 API / 服务端口

- [ ] **`POST /recognize` 仍是 stub**：[docs/external_api.md](external_api.md) 中已标注；后续接入真实 OCR 触发流程。
- [ ] **测试断言加固未完成**：`PLAN.md` 中列出的 11 个测试文件需要把"链路通"提升为"体验对"。

## 词典

- [ ] **CC-CEDICT 词典需要运行时下载**：词典窗口检测到未导入时会展示"Download Dictionary (~6MB)"按钮，从 mdbg.net 拉 `cedict_1_0_ts_utf-8_mdbg.txt.gz`；本地 dev 环境网络受限时仍可能失败，需要在 Windows 实机产物中验证一次。
- [ ] **中文词典 DB 不在 git 仓库**：`resources/data/dict/chinese_dict.db`（约 86 MB）被 `.gitignore` 排除，需在新克隆后执行 `npm run build:chinese-dict` 生成；该脚本依赖 `github_repo/chinese-dictionary` 或 WSL 上游仓库。

## 翻译

- [ ] **谷歌翻译当前环境失败**：保留为已知问题，不用 mock 隐藏；后续需要在网络可达的环境复测，或更换默认免费引擎。
