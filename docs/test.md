# E2E 测试规则

## 快捷键测试策略

### 两层验证

| 层级 | 方法 | 何时使用 |
|------|------|----------|
| **注册验证** | `globalShortcut.isRegistered(shortcut)` 返回 `true` | 所有环境 |
| **Action 流程验证** | 直接触发快捷键最终执行的 action（写剪贴板 → IPC → 翻译窗口） | 所有环境 |
| **OS 级按键模拟** | PowerShell `SendKeys` / `nut.js` 发送真实系统快捷键 | **仅 CI/headless，且用户明确允许** |

### AI 开发时的规则

- **禁止**使用 OS 级按键模拟（PowerShell SendKeys、nut.js 等）
- **禁止**在开发者机器上触发系统快捷键
- 只用注册验证 + Action 流程验证覆盖快捷键路径
- 快捷键 action 的最终效果是: 读剪贴板 → 打开翻译窗口 → 填入源文本 → 触发翻译
- 测试通过 IPC 直接触发这个 action 链路，不经过 `globalShortcut`

### 用户手动测试时的规则

- 用户明确允许后，可开启 OS 级按键模拟
- 通过环境变量控制: `E2E_OS_SHORTCUT=1`
- 仅在 headless/CI 环境使用，不在开发机前台运行

### 为什么这样拆

- `globalShortcut` 是 OS 级注册，CDP 键盘事件触发不了
- PowerShell SendKeys 发送到当前焦点窗口，会干扰开发者正常操作
- 注册验证确保快捷键绑定了，Action 验证确保按下后的完整流程跑通
- 两层组合等价于端到端覆盖，且不影响开发环境

## 测试执行

### 环境变量

| 变量 | 作用 | 示例 |
|------|------|------|
| `CP_FILTER` | 只跑指定的 CP（逗号分隔） | `CP_FILTER=1,3,5` |
| `CP_PARALLEL` | 并行模式：每个 CP 各起一个 Electron 实例同时跑 | `CP_PARALLEL=1` |

### 常用命令

```bash
# 串行跑全部 CP（随机顺序，单实例）
npx vitest run --config vitest.e2e.config.ts

# 串行跑指定 CP
CP_FILTER=1 npx vitest run --config vitest.e2e.config.ts
CP_FILTER=1,3,5 npx vitest run --config vitest.e2e.config.ts

# 并行跑全部 CP（每个 CP 独立实例，同时执行）
CP_PARALLEL=1 npx vitest run --config vitest.e2e.config.ts

# 并行跑指定 CP
CP_FILTER=1,2 CP_PARALLEL=1 npx vitest run --config vitest.e2e.config.ts

# CI 环境 + 用户允许: 开启 OS 快捷键测试
E2E_OS_SHORTCUT=1 npx vitest run --config vitest.e2e.config.ts
```

### 模式说明

- **串行模式**（默认）：启动一个 Electron 实例，随机顺序依次执行所有 CP。执行过程中验证中间状态，结束后验证 history 汇总和窗口可用性。
- **并行模式**（`CP_PARALLEL=1`）：每个 CP 启动独立的 Electron 实例，通过 `Promise.allSettled` 同时执行。每个实例内部独立验证 history。串行模式的 history 汇总检查和"窗口仍然可用"检查在并行模式下跳过。
