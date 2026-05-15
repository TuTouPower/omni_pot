# 已知问题记录 (Issues Log)

## 当前开放问题

暂无。

## 已修复

1. **依赖错误 (图片报错)**: 生产环境/单文件运行时报错 `Uncaught Exception: Error: Cannot find module 'better-sqlite3'`。
   - 已通过 electron-builder 打包配置修复：生产包启用 native rebuild，`*.node` 解包到 `app.asar.unpacked`。
   - 已用 `npm run dist:dir` 验证 `better_sqlite3.node` 存在于打包产物，并用打包后的 `omni_pot.exe` 启动验证本地 API 可用。
2. **启动问题**: 双击一次单文件(exe)无法运行，必须要双击点两次才能启动。
   - 已通过 `npm run dist:dir` 生成 unpacked Windows 包，并验证打包后的 `omni_pot.exe` 可一次启动并响应 `/config`。
3. **翻译服务**: Bing 翻译失败。
   - 已修复，并由 `translate_core.spec.ts` 的全部免费翻译服务真实结果用例守护。
4. **窗口控制按钮失效**: 置顶按钮、关闭窗口按钮均无法使用。
   - 已修复，并由 `translate_titlebar.spec.ts` 守护。
5. **翻译操作**: 翻译按钮点击没用（无效）。
   - 已修复，并由 `translate_source_area.spec.ts` 守护。
6. **语言检测显示**:
   - “检测到 zh_cn” 应该显示为 “检测到简体中文”
   - “auto dectect” 应该显示为 “自动检测”
   - 已修复，并由 `translate_language_area.spec.ts` 守护。
7. **语言切换交互**: 点击检测到的语言时，应该支持切换/反转转换的语言。
   - 已修复，并由 `translate_language_area.spec.ts` 守护。
8. **标题栏样式**:
   - 顶部的 "omni_pot" 文本/标题显示有问题（拼写/样式）。
   - “翻译” 这个模式标签（Mode Label）缺少背景色。
   - 已修复，并由 `translate_titlebar.spec.ts` 守护。
