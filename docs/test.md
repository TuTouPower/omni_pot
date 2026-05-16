# 测试规范

> omni_pot 测试的总则与约定。
> 用户端到端测试的**详细设计**（基础设施、文件规划、每个 spec 测什么）见
> `docs/test_user_e2e.md`；本文只讲总则、分层职责与运行约定。

---

## 1. 测试分层

| 层级 | 目录 | 框架 | 职责 |
|---|---|---|---|
| 单元测试 | `tests/unit/` | Vitest | 服务接口、工具函数、状态管理逻辑 |
| 集成测试 | `tests/integration/` | Vitest | 能在 Node/Vitest 环境真实运行的主进程模块行为，例如配置读写、默认配置边界 |
| 用户端到端测试 | `tests/user_e2e/` | Playwright | 真实 Electron 实例，**模拟真实用户操作** |

三层职责不重叠：

- 单元/集成测试验证**模块正确性**（函数返回值、可在 Vitest 中真实执行的主进程模块契约）。
- 原生 Electron ABI 依赖的数据库行为不在 Vitest 中复制 SQL 逻辑；通过用户 E2E 覆盖历史记录增删改查、分页、禁用历史和备份恢复。
- 用户端到端测试验证**功能正确性**：用户点了按钮、输入了文字，看到了预期结果。
  E2E 不直接调 `electronAPI` 绕过 UI，不写脱离用户视角的冒烟/接口测试。

> 两个测试文档的分工：
> **本文档（`test.md`）** = 测试总则与约定（分层、原则、快捷键策略、运行命令）。
> **`test_user_e2e.md`** = 用户端到端测试的设计方案（基础设施架构、Page Object、
> 15 个 spec 各测什么、实施路线）。

---

## 2. 通用原则

- **少 mock，多真实**（`CLAUDE.md` 要求）：免费、无需密钥的服务走真实 API；
  只有付费/需密钥的服务才 mock。
- **覆盖完整**：测试要覆盖 `docs/spec.md` 的所有功能、所有 UI。
- **E2E 全程真实用户视角**：每个用例都是“用户做了某操作 → 看到某结果”。
- **稳定可复现**：固定执行顺序，显式等待条件，稳定的 `data-testid` 选择器，
  每个用例独立且自带配置重置。
- **命名**：测试文件、helper、变量一律 `snake_case`（E2E spec 以 `.spec.ts` 结尾）。

---

## 3. 自动化测试与真实 smoke 边界

自动化测试必须优先守住能稳定复现的产品行为，但不能把自动化通过等同于真实打包产物验收通过。每个缺陷修复都应先判断属于哪一类，并在测试或 issue 中写清覆盖范围。

### 3.1 必须自动化覆盖

以下问题应补 Vitest、集成测试或 Playwright E2E，不能只靠人工检查：

- 按钮点击是否触发实际行为，例如收藏、朗读、语音相关按钮不能只断言“按钮存在”。
- 收藏、历史、配置、语言选择等状态是否持久化并能再次读取。
- 朗读按钮是否调用 TTS IPC/服务；服务不可用时是否显示明确 disabled 态或错误反馈。
- 源语言/目标语言下拉是否可点击、可选择，选择后是否更新方向并触发重新翻译。
- 自动检测后的目标语言、请求参数和 UI 显示方向是否一致。
- 中文输入是否走中文词典/中文字典并返回中文释义；英文输入是否走英文词典。
- 欢迎空状态、加载态、结果卡片数量、错误态、空态等 DOM 状态是否符合 `docs/spec.md`。
- 快捷键 action 链路是否能从“读取选区/剪贴板”走到目标窗口与目标功能。
- 默认配置、服务列表、fallback 语言、禁用态文案等产品规则。

### 3.2 可半自动化覆盖

以下问题应尽量用 Playwright 的 DOM bounding box、窗口 bounds、截图快照或辅助断言覆盖，但仍要在必要时补真实 Windows smoke：

- 窗口最小宽度、最大高度、内容高度是否随文本和结果卡片变化。
- 下拉弹层、菜单、浮层是否被父容器裁剪。
- 识别窗口是否只让图片卡片和结果卡片参与伸缩，其他控件是否保持稳定。
- 加载动画、stream 标签隐藏、按钮排列、语言栏宽度等可通过截图或 DOM 尺寸判断的 UI 细节。

### 3.3 必须真实 Windows 打包 smoke

以下问题涉及操作系统、打包产物或硬件环境，自动化只能辅助，不能单独宣称已解决：

- `release/Omni Pot 0.1.0.exe`、NSIS 安装版、便携版的首次启动和重新打开行为。
- Windows 系统托盘真实显示效果、托盘 popup 位置、失焦关闭、浅色主题和 example 对齐。
- 真实 `globalShortcut` 是否被 Windows 接收并触发应用 action。
- OCR 鼠标框选截图在 DPI 缩放、多显示器、窗口偏移下是否裁剪到用户实际框选区域。
- TTS 是否真的发声、系统音频设备不可用时是否有用户可见反馈。
- 原生窗口 resize、边框拖拽、最小/最大尺寸在真实桌面环境中的表现。

修复这类问题时，完成报告必须分开说明：自动化测试结果、`npm run dist` 结果、真实打包产物 smoke 结果。没有真实 smoke 的，只能写“自动化路径通过，packaged 行为未验证”，不能写“已修复”。`npm run dist` 会在打包前检查既有 `release` exe 产物是否被 Omni Pot 或其他进程占用，若占用则直接报错，避免 electron-builder 长时间等待解锁。

---

## 4. 快捷键测试策略

`globalShortcut` 是 OS 级注册，Playwright 页面级键盘事件触发不了；用两层验证组合覆盖。

### 两层验证

| 层级 | 方法 | 何时使用 |
|------|------|----------|
| **注册验证** | `globalShortcut.isRegistered(shortcut)` 返回 `true` | 所有环境 |
| **Action 流程验证** | 直接触发快捷键最终执行的 action（经 E2E HTTP 端点 → IPC → 目标窗口） | 所有环境 |
| **OS 级按键模拟** | PowerShell `SendKeys` / `nut.js` 发送真实系统快捷键 | **仅 CI/headless，且用户明确允许** |

### AI 开发时的规则

- **禁止**使用 OS 级按键模拟（PowerShell SendKeys、nut.js 等）。
- **禁止**在开发者机器上触发系统快捷键。
- 只用注册验证 + Action 流程验证覆盖快捷键路径。
- 快捷键 action 的最终效果：读选区/剪贴板 → 打开目标窗口 → 填入文本 → 触发翻译/识别/查词。
- 测试通过 E2E HTTP 端点直接触发这个 action 链路，不经过 `globalShortcut`。

### 用户手动测试时的规则

- 用户明确允许后，可开启 OS 级按键模拟，通过环境变量 `E2E_OS_SHORTCUT=1` 控制。
- 仅在 headless/CI 环境使用，不在开发机前台运行。

### 为什么这样拆

- `globalShortcut` 是 OS 级注册，Playwright 页面级键盘事件触发不了。
- PowerShell SendKeys 发送到当前焦点窗口，会干扰开发者正常操作。
- 注册验证确保快捷键绑定了，Action 验证确保按下后的完整流程跑通。
- 两层组合等价于端到端覆盖，且不影响开发环境。

---

## 5. 运行命令

```bash
# 单元 + 集成测试
npx vitest run tests/unit tests/integration

# 用户端到端测试（Playwright）
npm run test:e2e            # 全部 spec（full project）
npm run test:e2e:core       # 核心用户路径（@core 标签），PR 快速门禁
npm run test:e2e:ui         # UI 回归（@ui 标签）
npm run test:e2e -- <file>  # 单文件调试
```

> **注意**: `test:e2e:core` 和 `test:e2e:ui` 分别指定 Playwright `core` / `ui`
> project；对应 project 通过 `@core` / `@ui` 标签分组，spec 文件中需用
> `test.describe('@core', ...)` 或 `test('@ui ...', ...)` 标注。

- 用户端到端测试当前由 Playwright fixture 为每个测试启动独立 Electron 实例、
  独立随机端口、独立 userData 目录；Playwright `workers: 1`，用例固定顺序执行。
- Playwright `globalSetup` 在每次 `test:e2e` 命令开始时执行一次 `electron-vite build`，
  避免源码修改后继续运行旧 `out/` 产物。
- 详细的实例生命周期、Page Object、E2E HTTP 端点见 `docs/test_user_e2e.md`。
