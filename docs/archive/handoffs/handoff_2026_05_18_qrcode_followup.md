# 2026-05-18 QR Code / 外部服务覆盖交接

## 当前分支与状态

- 分支：`fix/p0-user-acceptance-issues`
- 最近提交：
  - `29fd73b fix(ocr): harden system language handling`
  - `fe4468e docs(external): classify service dependencies`
  - `a59d271 test(e2e): keep screenshot latency acceptance active`
- 当前未提交改动：
  - [tests/user_e2e/specs/recognize_window.spec.ts](../tests/user_e2e/specs/recognize_window.spec.ts)
  - 内容是新增 QR Code 本地识别 E2E 测试，但该测试当前失败，尚未提交。

## 用户要求与边界

- 用户要把“不需要用户填 key/token/API URL，也不需要额外启动本地服务”的能力都测到。
- 按这个口径：
  - System OCR、Tesseract、本地词典、QR Code 都算“无需用户配置”。
  - Ollama、Anki/AnkiConnect 不算，因为需要用户自己安装/启动额外本地服务。
- 不要用 Playwright route mock 掩盖真实外部服务失败。
- 不要 push，除非用户明确要求。
- 每完成一个小步骤要 commit。
- 修改代码后，最终收尾前需要跑 `npm run dist`；打包脚本可以自动关闭并重启被 release 产物锁住的 Omni Pot。
- 不要修改 `docs/design/omni_pot/*` 设计稿；只可按需更新 [docs/design/demo_todo.md](design/demo_todo.md)。

## 已完成并提交的工作

### 1. 外部服务依赖文档

提交：`fe4468e docs(external): classify service dependencies`

相关文件：

- [docs/external_services/external_services.md](external_services/external_services.md)
- [docs/issues.md](issues.md)

当前文档已经按用户修正后的口径整理：

- 无需用户配置的公网服务：Bing、Google、DeepL free / DeepLX free、Lingva Translate、MyMemory、Cambridge Dictionary、Free Dictionary、Edge TTS、Lingva TTS。
- 无需用户配置的本地/系统服务：Chinese Dictionary、ECDICT、Tesseract、System OCR、QR Code。
- 需要用户配置或额外本地服务：Baidu/Tencent/Alibaba/Volcengine/Youdao/Caiyun/NiuTrans/OpenAI/Gemini/ChatGLM/SimpleTex/Eudic/Ollama/Anki 等。
- 当前真实公网健康检查结果记录为：Bing、DeepL free、MyMemory、Cambridge、Free Dictionary 通过；Google、Lingva Translate、Edge TTS、Lingva TTS 失败。
- 文档目前仍写着：QR Code 是唯一未覆盖的“无需用户配置服务”缺口。

### 2. System OCR 真实路径修复与安全加固

提交：`29fd73b fix(ocr): harden system language handling`

相关文件：

- [electron/ipc/ocr_handlers.ts](../electron/ipc/ocr_handlers.ts)
- [tests/user_e2e/specs/recognize_window.spec.ts](../tests/user_e2e/specs/recognize_window.spec.ts)
- [tests/unit/ipc/ocr_handlers.test.ts](../tests/unit/ipc/ocr_handlers.test.ts)

背景：

- 新增了 System OCR 真实重识别 E2E：从识别窗口切换到 System OCR，点击重新识别，应从画布图片识别到 `OCR`。
- 一开始失败，说明不是简单“测过 UI 按钮”，而是真实 Windows OCR 路径没有跑通。
- 直接 PowerShell 探针确认 Windows OCR 本身可用，能识别 `HELLO OCR TEST`。
- 根因是原 PowerShell WinRT async 调用使用 `.AsTask()` 扩展方法，在当前 `powershell.exe` 环境下 `[System.__ComObject]` 没有暴露该方法。
- 修复方式：加载完整 WinRT 类型，并用反射调用 `System.WindowsRuntimeSystemExtensions.AsTask<T>`。

安全 review 发现：

- `lang` 来自 IPC，原先直接插入 PowerShell 单引号字符串，有命令注入风险。
- 已在主进程加入 `normalize_system_ocr_language()` allowlist，只接受渲染端会传入的 BCP-47 标签，如 `en-US`、`zh-CN`、`ja-JP` 等；空值归一为 `en-US`；其他值抛 `Unsupported OCR language`。
- 新增单元测试覆盖危险输入：`en-US'); Write-Error 'owned` 必须被拒绝。

已跑验证：

```bash
npm test -- tests/unit/ipc/ocr_handlers.test.ts
# 1 passed, 2 tests passed

npm run typecheck
# passed

npm run test:e2e -- specs/recognize_window.spec.ts
# 5 passed
```

独立 TypeScript reviewer 也复查过：没有 blocker，确认 allowlist 切断了 PowerShell 注入路径。

## 当前未完成工作：QR Code 本地解析覆盖

### 目标

补上 [docs/issues.md](issues.md) 和 [docs/external_services/external_services.md](external_services/external_services.md) 标出的最后一个无需用户配置服务缺口：QR Code 本地解析服务。

QR Code 实现：

- [src/services/ocr/qrcode.ts](../src/services/ocr/qrcode.ts)
- 使用 `jsQR`。
- 不需要网络、key、token、API URL 或额外本地服务。
- `recognize()` 通过浏览器 `Image` + `canvas` 把 base64 PNG 转成 `ImageData`，再调用 `jsQR(image_data.data, image_data.width, image_data.height)`。

### 当前未提交改动

在 [tests/user_e2e/specs/recognize_window.spec.ts](../tests/user_e2e/specs/recognize_window.spec.ts) 中新增了：

- `qrcode_config`
  - `recognize_service_list: ['qrcode@default']`
  - `service_instances.qrcode@default.serviceKey = 'qrcode'`
- `qrcode_image`
  - 一个内嵌 base64 PNG，内容应该是 `OMNI_POT_QR_TEST`
- 测试：`user reruns OCR with local QR Code engine`
  - 启动 AppFixture，打开识别窗口，传入二维码图片。
  - 断言引擎显示 `QR Code`。
  - 点击重新识别。
  - 期望文本框变成 `OMNI_POT_QR_TEST`。

当前 diff 可用：

```bash
git diff -- tests/user_e2e/specs/recognize_window.spec.ts
```

### 当前失败

运行：

```bash
npm run test:e2e -- specs/recognize_window.spec.ts --grep "local QR Code"
```

结果：失败。

失败现象：

```text
Expected: "OMNI_POT_QR_TEST"
Received: ""
```

说明：

- 识别窗口能打开。
- OCR 引擎下拉显示 `QR Code`，说明服务实例/注册路径至少能被 UI 找到。
- 点击“重新识别”后文本仍为空。
- UI 的 `handleRecognize()` 对 service 抛错会 catch 并保留原文本，所以当前失败可能是：
  1. `qrcodeOcrService.recognize()` 成功运行但 `jsQR()` 返回 `null`；或
  2. `base64_to_image_data()` / `Image` / canvas 路径抛错，被 UI catch 吞掉；或
  3. E2E 传入的 base64 图片在 renderer 中无法被 `Image` 正确加载；或
  4. fixture 对 OpenCV 可解，但对 `jsQR` 不够友好。

### 已排除/已尝试

1. 第一次手写 QR 生成脚本生成的 PNG 无法被 OpenCV 解码，已替换。
2. 当前内嵌 PNG 是用本机 Python OpenCV 的 `QRCodeEncoder_create()` 生成的，并用 OpenCV `QRCodeDetector().detectAndDecode()` 本地验证过能解出：

```text
decoded= OMNI_POT_QR_TEST
```

但这不保证 `jsQR` 能解。

3. 尝试用 `npx --yes qrcode ...` 生成 fixture，但命令卡住，已手动停止；不要依赖它。

## 建议下一步

1. 先不要提交当前 QR Code 测试，因为它是红的。
2. 直接定位 QR Code 失败原因，建议按这个顺序：
   - 用 Playwright 在识别窗口 renderer 里直接执行 `qrcodeOcrService.recognize(qrcode_image, 'auto')`，看返回空还是抛错。
   - 如果抛错，抓 console/error 或临时在测试里 `page.evaluate` 返回错误 message，不要改产品代码加调试日志。
   - 如果返回空，换一个 `jsQR` 更容易识别的 fixture：更大 quiet zone、更高缩放、黑白 RGBA 清晰边缘。
   - 如果服务直接调用能返回值，而 UI 点击不行，再查 `handleRecognize()` 的 `imageBase64` / `effectiveService` / `service_instances`。
3. QR Code E2E 变绿后，同步更新：
   - [docs/external_services/external_services.md](external_services/external_services.md)：QR Code 测试覆盖从 `未覆盖 / 待补` 改为指向 [tests/user_e2e/specs/recognize_window.spec.ts](../tests/user_e2e/specs/recognize_window.spec.ts)，结果改为 `通过`。
   - [docs/issues.md](issues.md)：移除“无需用户配置服务测试缺口”这一条，或改成没有剩余缺口。
4. 跑验证：

```bash
npm run test:e2e -- specs/recognize_window.spec.ts --grep "local QR Code"
npm run test:e2e -- specs/recognize_window.spec.ts
npm run typecheck
```

5. 让 reviewer 复查 QR Code 测试改动，确认没有 mock、没有误导性 fixture、没有产品回归。
6. 小步提交，例如：

```text
test(e2e): cover local QR code OCR
```

7. 最终所有代码改动结束后，按用户要求跑：

```bash
npm run dist
```

## 当前 todo 状态

- 已完成：找到 QR Code 服务路径。
- 已完成：新增 QR Code no-mock E2E 覆盖，但测试仍失败，不能算最终完成。
- 进行中：定位/修复 QR Code 测试失败。
- 未完成：更新 QR Code 覆盖文档。
- 未完成：focused verification + review。
- 未完成：提交 QR Code 覆盖。
- 未完成：最终 `npm run dist`。

## 注意事项

- 当前只有 [tests/user_e2e/specs/recognize_window.spec.ts](../tests/user_e2e/specs/recognize_window.spec.ts) 未提交。
- 不要误删已提交的 System OCR 修复；它已经验证并提交。
- 不要把 QR Code 失败简单记录成“上游失败”，它是本地解析路径，应该能被稳定测试。
- 不要用 route mock；QR Code 应该用真实二维码图片 + 真实 `jsQR` 路径。
- 如果需要临时生成 fixture，生成脚本可以是一次性本地命令，不一定要加入项目依赖；最终测试里最好只保留稳定 fixture 或项目内 fixture 文件。
