# 测试规范

> omni_pot 测试的总则与约定。
> 用户端到端测试的**详细设计**（基础设施、文件规划、每个 spec 测什么）见
> `docs/test_user_e2e.md`；本文只讲总则、分层职责与运行约定。

---

## 1. 测试分层

| 层级 | 目录 | 框架 | 职责 |
|---|---|---|---|
| 单元测试 | `tests/unit/` | Vitest | 服务接口、工具函数、状态管理逻辑 |
| 集成测试 | `tests/integration/` | Vitest | IPC 通信、配置读写、数据库操作、选中文本提取的主方案/回退 |
| 用户端到端测试 | `tests/user_e2e/` | Playwright | 真实 Electron 实例，**模拟真实用户操作** |

三层职责不重叠：

- 单元/集成测试验证**模块正确性**（函数返回值、IPC 契约、SQL 结果）。
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

## 3. 快捷键测试策略

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

## 4. 运行命令

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
