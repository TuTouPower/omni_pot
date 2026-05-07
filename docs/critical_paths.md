# Critical Paths — E2E 测试覆盖

> 每条路径定义: 前置条件 → 操作步骤 → 每步验证点。
> E2E 测试必须逐条覆盖，不遗漏任何验证点。

---

## CP1: 划词翻译全流程

**用户旅程**: 用户在任意应用中选中文字 → 按快捷键 → 翻译窗口弹出 → 多个服务并行翻译 → 结果正确显示

### 前置条件

- 应用已启动，托盘图标可见
- 至少配置 2 个翻译服务（bing, google）
- 源语言 = auto，目标语言 = zh_cn，第二语言 = en

### 测试步骤

| # | 操作 | 验证点 |
|---|------|--------|
| 1 | 向系统剪贴板写入 `"hello world"` | 剪贴板内容 === `"hello world"` |
| 2 | 模拟触发划词翻译快捷键（`translate:from-selection`） | — |
| 3 | 检查翻译窗口 | 窗口存在且可见；源文本 textarea.value === `"hello world"` |
| 4 | 等待翻译完成（最多 30s） | DOM 中 `[data-result-key]` 卡片数量 >= 2 |
| 5 | 检查每个结果卡片 | 每个卡片有服务名 header（如 Bing, Google） |
| 6 | 检查第一个服务的翻译结果 | 结果 textarea 非空；结果 !== `"hello world"`（确认是翻译不是回显） |

### 语言自动检测 + 第二语言回退

| # | 操作 | 验证点 |
|---|------|--------|
| 7 | 清空，剪贴板写入 `"你好世界"`，触发快捷键 | 源文本 === `"你好世界"` |
| 8 | 等待翻译完成 | 检测到源语言 = zh_cn，与目标语言相同 → 回退到 en |
| 9 | 检查翻译结果 | 结果包含英文字母（`/[a-zA-Z]{2,}/`） |

### 反向验证: 英译中

| # | 操作 | 验证点 |
|---|------|--------|
| 10 | 清空，剪贴板写入 `"good morning"`，触发快捷键 | 源文本 === `"good morning"` |
| 11 | 等待翻译完成 | 结果包含中文字符（`/[一-鿿]/`） |

### 结果展示格式

| # | 操作 | 验证点 |
|---|------|--------|
| 12 | 翻译 `"test"` 并等待完成 | 至少一个结果卡片的 textarea 有值且为 readonly |
| 13 | 检查结果卡片顺序 | 卡片在 DOM 中的顺序 === `translate_service_list` 配置顺序 |

### 历史记录

| # | 操作 | 验证点 |
|---|------|--------|
| 14 | 翻译唯一文本 `"e2e history test {timestamp}"` | 翻译完成后，`history.list()` 返回的记录中包含该源文本 |

### 多次翻译无状态污染

| # | 操作 | 验证点 |
|---|------|--------|
| 15 | 翻译 `"first translation"`，等待结果 | 结果非空 |
| 16 | 清空，翻译 `"second translation test"`，等待结果 | 结果非空；源文本 === `"second translation test"` |

### 边界情况

| # | 操作 | 验证点 |
|---|------|--------|
| 17 | 翻译短文本 `"hi"` | 结果非空 |
| 18 | 翻译长文本（200+ 字符） | 窗口不崩溃，至少一个结果卡片 |
| 19 | 翻译特殊字符 `"Hello! @#$% 123"` | 窗口不崩溃 |

### 关键: 触发方式

本路径的触发方式是**快捷键**（`translate:from-selection`），不是 HTTP API。
测试中通过以下方式模拟:
1. 写入剪贴板: `navigator.clipboard.writeText()` 或 Electron `clipboard.writeText()`
2. 触发快捷键: CDP 发送 `translate:from-selection` IPC 到翻译窗口（模拟快捷键 action 的最终效果）

---

## CP2: 输入翻译全流程

**用户旅程**: 用户在翻译窗口手动输入文本 → 按回车 → 翻译结果展示

### 前置条件

- 翻译窗口已打开，textarea 可见且可编辑

### 输入测试

| # | 操作 | 验证点 |
|---|------|--------|
| 1 | CDP `Input.insertText("hello")` | textarea.value === `"hello"` |
| 2 | 清空，`Input.insertText("你好世界")` | textarea.value === `"你好世界"` |
| 3 | 清空，`Input.insertText("Hello 你好 World 世界")` | textarea.value === 完整混合文本 |
| 4 | 清空，`Input.insertText("Hello! 你好？¡Hola! 123 @#$%")` | 值完整保留 |
| 5 | 清空，输入长文本（200+ 字符） | textarea.value 长度 > 100 |

### 翻译触发

| # | 操作 | 验证点 |
|---|------|--------|
| 6 | 输入 `"hello"`，按 Enter | `[data-result-key]` 卡片出现 |
| 7 | 输入 `"你好"`，按 Enter | 页面不崩溃，卡片出现 |
| 8 | 输入 `"world"`，按 Enter | 结果卡片 header 有服务名 |

### UI 功能

| # | 操作 | 验证点 |
|---|------|--------|
| 9 | 输入文本后点击清空按钮 | textarea.value === `""` |
| 10 | 翻译后清空，输入新文本 | 新文本正确显示 |
| 11 | 检查语言选择器 | 存在 >= 2 个 `<select>`，选项包含 auto/zh_cn/en |

### 关键: 输入方式

文本输入必须通过 CDP `Input.insertText`（模拟真实键盘，兼容 React 受控组件和 IME）。
不用 `evaluate("el.value = '...'")` 直接设值。

---

## CP3: OCR 识别全流程

**用户旅程**: 触发 OCR → 截图区域选择 → OCR 窗口显示识别文字

### 前置条件

- 应用已启动

### 测试步骤

| # | 操作 | 验证点 |
|---|------|--------|
| 1 | `electronAPI.ocr.openRecognize(base64Image, 'test text')` | recognize 窗口出现在 CDP targets |
| 2 | 连接 recognize 窗口的 CDP client | 连接成功 |
| 3 | 检查图片 | `<img>` 存在，src 以 `data:image/png;base64,` 开头 |
| 4 | 检查识别文字 | `<pre>` 文本包含 `'test text'` |
| 5 | 检查复制按钮 | "Copy" 按钮存在且未禁用 |
| 6 | 检查关闭按钮 | header 中有 SVG 图标按钮 |
| 7 | 按 Escape | recognize 窗口从 CDP targets 消失 |

### 关键: 窗口连接

recognize 是独立 BrowserWindow，需要通过 CDP `findAllTargets` 找到并单独连接。
测试中不实际截图，通过 IPC 模拟传入 OCR 数据。

---

## CP4: OCR 翻译联动

**用户旅程**: OCR 识别后，将文字发送到翻译窗口翻译

### 前置条件

- 翻译窗口已打开，textarea 可见

### 测试步骤

| # | 操作 | 验证点 |
|---|------|--------|
| 1 | `electronAPI.ocr.sendToTranslate('OCR text')` | 翻译窗口 textarea.value === `'OCR text'` |
| 2 | 等待翻译 | 至少一个结果卡片有内容 |
| 3 | `sendToTranslate('你好世界')`（中文） | textarea.value === `'你好世界'` |
| 4 | 翻译完成后手动输入新文本 | 输入正常，无状态污染 |

### 关键: IPC 链路

`sendToTranslate` 走: renderer → `ocr:send-to-translate` invoke → main process → `sendWhenReady('translate:from-api')` → 翻译窗口 renderer。
验证这条链路不丢消息。

---

## CP5: 配置持久化全流程

**用户旅程**: 修改配置 → 验证当前生效 → 验证重启后保持

### 前置条件

- 应用已启动

### 测试步骤

| # | 操作 | 验证点 |
|---|------|--------|
| 1 | `config.get('translate_source_language')` | === `'auto'` |
| 2 | `config.get('translate_target_language')` | 是有效非空字符串 |
| 3 | `config.set('translate_close_on_blur', true)` → `config.get(...)` | === `true` |
| 4 | `config.set('translate_close_on_blur', false)` → `config.get(...)` | === `false` |
| 5 | `config.getAll()` | 包含 app_language, translate_source_language, translate_target_language, translate_service_list, server_port |
| 6 | `config.getAll()` | translate_service_list 是数组 |
| 7 | 监听 `config.onChange` → `config.set('translate_always_on_top', true)` | onChange 回调收到 key=`'translate_always_on_top'`, value=`true` |
| 8 | `config.get('translate_service_list')` | 长度 > 0，包含 `'bing'` 和 `'google'` |
| 9 | `config.get('server_port')` | > 0 且 <= 65535 |
| 10 | 写入 `app_font_size` = 20 → 读回 → 恢复原值 | 读写一致 |
| 11 | 写入 `app_language` = `'zh_cn'` → 读回 → 恢复原值 | 读写一致 |

### 关键: cleanup

每次写入后在 afterAll 中恢复原值，避免污染其他测试。

---

## 通用验证规则

所有关键路径必须满足:

1. **真实 API**: 翻译服务调用真实外部 API，不 mock
2. **并行执行**: 多个翻译服务通过 `Promise.allSettled` 并行
3. **结果顺序**: 结果卡片 DOM 顺序 === `translate_service_list` 配置顺序
4. **历史记录**: 翻译成功后 history 表有记录（除非 `history_disable` = true）
5. **无状态污染**: 连续多次翻译之间 requestId 机制防止旧结果覆盖新结果
6. **窗口存活**: 翻译流程结束后窗口仍然响应输入
