# omni_pot 代码质量检查体系落地方案

> 本文档说明 omni_pot 项目要把哪些“编译前 / 运行前”检查纳入本地、Git hook、CI 和发布门禁。
> 通用严格版参考：`D:\Kar\file_need\obsidian_repo\my_note\Tech\strict_code_quality_checks.md`。
> 本文是针对 omni_pot（Electron + React + TypeScript）的裁剪版，只保留本项目需要落地的部分。

---

## 1. 总原则

### 1.1 warning 视为 error

最终目标不是承诺“永远没有 bug”，而是做到所有已知问题在提交、合并、发布前失败拦截：

- TypeScript type error 不能提交；
- ESLint warning 不能合并；
- 格式化 diff 不能进入主分支；
- high / critical 依赖漏洞不能发布；
- secret 泄漏、循环依赖、未使用依赖不能长期存在；
- `master` / release 分支必须由 CI 强制门禁保护。

### 1.2 分层拦截

不要只依赖 CI。检查分 5 层逐步拦截：

| 阶段 | 目标 | omni_pot 适用工具 |
|---|---|---|
| 编辑器保存时 | 立即发现低级问题 | TypeScript、ESLint、格式化插件 |
| pre-commit | 阻止明显坏代码进入 Git | lint-staged、Gitleaks、格式化检查 |
| pre-push | 阻止本地未通过代码推送 | typecheck、lint、unit tests |
| CI 合并门禁 | 全量检查，保护 `master` | GitHub Actions：check、build、E2E 分组 |
| 发布前 | 供应链、安全、构建产物检查 | npm audit、OSV-Scanner、Semgrep、CodeQL、electron-builder smoke |

### 1.3 存量项目渐进收紧

本项目已有存量代码，不能一次全开所有规则。策略：

1. 已接入的规则保持零 warning；
2. 新增工具先以“报告 + baseline”方式接入；
3. 新代码零容忍，旧问题按模块清理；
4. baseline 每轮减少；
5. 最后把所有检查设为 CI 必过。

---

## 2. 当前状态

omni_pot = Electron 39 + React 19 + TypeScript 6 + electron-vite，当前已落地基础门禁：

| 已有 | 后续增强 |
|---|---|
| `typecheck` 脚本（tsc --noEmit），并已开启第一档严格 TS 选项 | 全仓 Biome 格式化基线 |
| ESLint flat config + type-aware 规则 + React Hooks 规则 | Gitleaks / osv-scanner / Semgrep |
| Vitest 单测 + Playwright E2E | Git hooks / CI required checks |
| Knip 死代码 / 依赖检查 | dependency-cruiser 架构边界 |
| Biome scoped format check | CodeQL / Electron Fuses 检查 |
| `npm audit --audit-level=high` | |

### 2.1 当前 package.json 脚本

```jsonc
{
    "scripts": {
        "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
        "lint": "eslint --config eslint_config.mjs . --max-warnings=0",
        "format:check": "biome ci ... package.json knip.json",
        "deadcode": "knip",
        "security": "npm audit --audit-level=high",
        "check": "npm run typecheck && npm run lint && npm run format:check && npm run deadcode && npm run security && npm test"
    }
}
```

说明：

- `format:check` 当前用 Biome CLI 参数检查 `package.json` 与 `knip.json`，不新增 `biome.json`；本地配置保护 hook 会阻止修改 `biome.json`。
- 全仓 Biome 格式化会触发大量存量 diff，需要单独做格式化基线迁移后再扩大 `format:check` 范围。
- `deadcode` 使用 `knip.json` 记录当前存量未引用文件和工具依赖 false positive，避免在质量门禁落地时顺手删除无关旧代码。
- `security` 先纳入 `npm audit --audit-level=high`；Gitleaks / osv-scanner / Semgrep 放到后续增强继续补。

---

## 3. 推荐落地顺序

### P0 — 保持现有门禁稳定

要求：

- `npm run typecheck` 必须零错误；
- `npm run lint` 必须零 warning；
- `npm test` 必须通过；
- `npm run check` 必须通过；
- 新增 TS / TSX 文件必须纳入 type-aware lint 覆盖，避免漏扫。

### P1 — 格式化与死代码

#### 3.1 format check

当前已用 Biome CLI 参数做 scoped check。下一步是做一次独立格式化基线迁移，再把检查范围从 `package.json knip.json` 扩大到全仓。

必须配置：

```txt
indentWidth = 4
useTabs = false
```

原因：项目 CLAUDE.md 要求 4 空格缩进，默认 2 空格会制造大规模无意义 diff。

#### 3.2 Knip

用于检查未使用文件、导出、依赖和 devDependencies。

当前已接入 `npm run deadcode`，并用 `knip.json` 保存存量动态入口 / false positive 基线。后续规则：

1. 动态入口误报必须写入配置；
2. 只删除确认无引用且不属于动态入口的项目；
3. baseline 每轮减少；
4. CI 初期可只报告，稳定后设为必过。

### P2 — 安全与依赖漏洞

#### 3.3 Gitleaks

项目包含大量外部服务配置入口，必须防止密钥进入仓库。

建议脚本：

```jsonc
{
    "scripts": {
        "secrets": "gitleaks detect --source ."
    }
}
```

建议同时加入 pre-commit 和 CI。

#### 3.4 npm audit + OSV-Scanner

当前已接入：

```jsonc
{
    "scripts": {
        "security": "npm audit --audit-level=high"
    }
}
```

后续增强：

```jsonc
{
    "scripts": {
        "security:deps": "npm audit --audit-level=high && osv-scanner -r ."
    }
}
```

规则：

- high / critical 必须阻断发布；
- devDependency 漏洞如果只影响本地工具，可以记录风险后延后，但不能静默忽略；
- Electron / better-sqlite3 / 构建链漏洞优先处理。

#### 3.5 Semgrep

用于扫描 Electron、Node、Web 安全风险。

建议脚本：

```jsonc
{
    "scripts": {
        "security:sast": "semgrep scan --config=auto"
    }
}
```

重点规则：

- 禁止 `eval` / `new Function`；
- `shell.openExternal` 必须校验 URL；
- IPC 必须校验 sender / origin / payload；
- renderer 禁止直接暴露 `fs` / `path` / `child_process`；
- 禁止加载不可信远程内容；
- CSP 必须严格。

### P3 — 架构边界与 CI 门禁

#### 3.6 dependency-cruiser

用于检查循环依赖和层级边界。

建议脚本：

```jsonc
{
    "scripts": {
        "arch": "depcruise electron src shared tests --validate .dependency-cruiser.cjs"
    }
}
```

建议规则：

```txt
禁止循环依赖
禁止生产代码依赖 test 文件
禁止 renderer 直接 import electron/main-only 模块
禁止 src/ 直接访问 better-sqlite3 或 Node fs/path/child_process
shared/ 只能放纯类型和跨进程安全常量
Electron preload 只能暴露经过白名单封装的 API
```

#### 3.7 CI required checks

CI 合并门禁至少包含：

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e:core
```

建议分层：

| CI job | 命令 | 触发 |
|---|---|---|
| fast-check | `npm run check` | 每个 PR |
| build | `npm run build` | 每个 PR |
| e2e-core | `npm run test:e2e:core` | 每个 PR |
| e2e-ui | `npm run test:e2e:ui` | UI / window / config 相关 PR |
| security | `npm run secrets && npm run security:deps && npm run security:sast` | PR + nightly |
| package-smoke | `npm run dist:dir` 后启动产物 smoke | release / nightly |

---

## 4. TypeScript / ESLint 继续收紧项

现有配置已经启用 `strictTypeChecked` 和关键规则。后续可按批次追加：

| 规则 / 插件 | 作用 | 注意 |
|---|---|---|
| `eslint-plugin-react` | React JSX 规则 | React 19 配置需确认兼容 |
| `eslint-plugin-jsx-a11y` | UI 可访问性 | 前端窗口控件逐步修，不要一次性全开失败 |
| `eslint-plugin-security` | JS 安全模式 | Electron 项目建议加入 |
| `eslint-plugin-promise` | Promise 误用 | 与 `no-floating-promises` 互补 |
| `eslint-plugin-regexp` | 正则风险 | 适合服务解析与文本处理代码 |
| `eslint-plugin-unicorn` | 现代 JS 规则 | 文件名规则必须适配 snake_case |
| `eslint-plugin-sonarjs` | 复杂度 / 重复逻辑 | 初期建议 warning + baseline |

推荐保持或追加的关键规则：

```js
{
    rules: {
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/no-unsafe-assignment": "error",
        "@typescript-eslint/no-unsafe-member-access": "error",
        "@typescript-eslint/no-unsafe-call": "error",
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/await-thenable": "error",
        "@typescript-eslint/switch-exhaustiveness-check": "error",
        "@typescript-eslint/consistent-type-imports": "error",
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "error"
    }
}
```

---

## 5. Electron 专项安全检查

Electron 的风险是 renderer 漏洞可能升级成本机权限问题，因此需要单独门禁。

### 5.1 BrowserWindow 安全基线

所有窗口默认必须满足：

```txt
nodeIntegration: false
contextIsolation: true
sandbox: true
webSecurity: true
```

如某窗口确实不能 `sandbox: true`，必须在代码旁说明约束，并由安全 review 接受。

### 5.2 禁止或严控项

- 禁止 Electron `remote` module；
- 禁止 `eval` / `new Function`；
- renderer 不直接暴露 `fs` / `path` / `child_process`；
- IPC 必须校验 sender / origin / payload schema；
- `shell.openExternal` 必须校验 URL allowlist；
- 禁止加载不可信远程内容；
- 必须设置严格 CSP；
- E2E-only HTTP 端点必须只在 `OMNI_POT_E2E=1` 且 token 匹配时启用。

### 5.3 建议工具

| 工具 | 作用 |
|---|---|
| `eslint-plugin-security` | JS / Node 安全规则 |
| Semgrep | 自定义 Electron 安全规则 |
| CodeQL | 深度静态分析 |
| Electron Fuses 检查 | 减少运行时攻击面 |

不建议使用 Electronegativity 作为主检查工具：维护滞后，新版 Electron 容易误报 / 漏报。Electron 安全扫描以 `eslint-plugin-security + Semgrep + CodeQL + 人工 review` 为主。

---

## 6. 项目约定相关坑

### 6.1 文件名必须 snake_case

用户全局 CLAUDE.md 要求所有命名使用 `snake_case`，包括文件名、目录名、变量、函数。

但 React 组件名仍必须遵守 React 规则：

```txt
文件名：source_area.tsx
组件名：SourceArea
Hook 名：useTranslateStore
```

这不是冲突：文件名风格和 JSX 组件名风格是两件事。

如果启用 `eslint-plugin-unicorn`：

```js
{
    "unicorn/filename-case": ["error", { "case": "snakeCase" }]
}
```

不要启用默认只接受 kebab/camel 的文件名规则。

### 6.2 缩进必须 4 空格

Biome / Prettier 必须显式配置 4 空格，否则格式化工具默认 2 空格会造成全仓 diff。

### 6.3 日志规范

禁止为了调试新增 `console.log`。

建议规则：

```js
{
    "no-console": "error"
}
```

例外：构建配置、测试辅助脚本如确实需要 stdout，可用 per-file override。

### 6.4 动态入口不要被误删

Knip / dependency-cruiser 配置时要注意这些动态入口：

- Electron main / preload / renderer 多入口；
- 服务注册表；
- Playwright fixture 和 Page Object；
- electron-builder 打包资源；
- i18n locale 文件；
- data 目录中的词典和 OCR 资源。

误报必须写入工具配置，不要为了通过检查删除真实入口。

---

## 7. 推荐最终脚本

逐步落地到最终状态：

```jsonc
{
    "scripts": {
        "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
        "lint": "eslint --config eslint_config.mjs . --max-warnings=0",
        "format:check": "biome ci .",
        "deadcode": "knip",
        "arch": "depcruise electron src shared tests --validate .dependency-cruiser.cjs",
        "secrets": "gitleaks detect --source .",
        "security:deps": "npm audit --audit-level=high && osv-scanner -r .",
        "security:sast": "semgrep scan --config=auto",
        "check": "npm run typecheck && npm run lint && npm test",
        "check:full": "npm run check && npm run format:check && npm run deadcode && npm run arch && npm run secrets && npm run security:deps && npm run build"
    }
}
```

注意：`check:full` 初期不一定作为 PR 必过，应先解决 baseline，再逐项升级为必过。

---

## 8. 验收标准

### P0 验收

- `npm run typecheck` 零错误；
- `npm run lint` 零 warning；
- `npm test` 通过；
- `npm run check` 通过。

### P1 验收

- format check 无 diff；
- Knip 无未解释的未使用文件 / 导出 / 依赖；
- 动态入口的 ignore 有明确配置理由。

### P2 验收

- Gitleaks 无 secret 泄漏；
- npm audit / OSV 无 high / critical；
- Semgrep 无高危 Electron / Node / Web 问题；
- `shell.openExternal`、IPC、E2E-only HTTP 端点有安全约束。

### P3 验收

- dependency-cruiser 无循环依赖；
- renderer / main / shared 分层边界被工具约束；
- CI required checks 保护 `master`；
- release 前跑 `npm run build`、`npm run dist:dir` 和打包产物 smoke。

---

## 9. 最终门禁定义

最终状态下，以下任一问题都必须失败：

```txt
任何 TypeScript type error
任何 ESLint warning
任何 format diff
任何 unit / E2E 测试失败
任何构建失败
任何 high / critical security issue
任何 secret 泄漏
任何未解释的循环依赖
任何未解释的未使用依赖
任何 Electron 安全基线破坏
```

一句话目标：**类型检查 + 类型感知 lint + 格式检查 + 死代码检查 + 架构约束 + 安全扫描 + 依赖漏洞扫描 + Git hooks + CI 强制门禁**。只要任何一层发现问题，就不允许提交、合并或发布。
