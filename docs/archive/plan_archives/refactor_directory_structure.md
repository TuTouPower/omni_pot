# omni_pot 目录结构规范化计划

**状态：已完成（2026-06-06）**

Commits:
1. `c7bd304` — tests/user_e2e/ → tests/e2e/
2. `cc6488d` — shared/ → src/shared/
3. `84fa03a` — eslint_config.mjs → config/lint/ + knip.json → config/
4. `f0a2d10` — electron/ → src/main/

## 目标

参照 `project_manager/docs/project_structure.md` 规范，统一目录结构。
根目录只保留工具强制文件和一级功能目录。

## 变更清单

### 1. `tests/user_e2e/` → `tests/e2e/`

**影响文件：**
- `playwright.config.ts` — testDir、globalSetup、outputDir
- `vitest.config.ts` — exclude glob
- `package.json` — e2e 相关 scripts（通过 scripts/*.mjs 间接引用）
- `scripts/run_e2e.mjs`、`scripts/run_with_external_tests.mjs` — 路径引用
- `.gitignore` — `tests/user_e2e/test-results/`
- `docs/test.md`、`docs/test_user_e2e.md` — 文档引用
- `CLAUDE.md` — 目录结构说明

**步骤：**
1. `git mv tests/user_e2e tests/e2e`
2. 更新 `playwright.config.ts` 中 3 处路径
3. 更新 `vitest.config.ts` exclude
4. 更新 `.gitignore`
5. 更新 `scripts/` 中引用的路径
6. 更新 `docs/` 和 `CLAUDE.md`

**验证：** `npm test`、`npm run test:e2e:core`

---

### 2. `shared/` → `src/shared/`

**影响文件：**
- `tsconfig.node.json` — paths `@shared/*`
- `tsconfig.web.json` — paths `@shared/*`
- `tsconfig.eslint.json` — paths `@shared/*`
- `electron.vite.config.ts` — 3 处 alias
- `src/` 下所有 `import from '@shared/...'` — 不需改（alias 指向新路径）
- `electron/` 下所有 `import from '@shared/...'` — 不需改
- `tests/` 下所有 `import from '@shared/...'` — 不需改
- `CLAUDE.md` — 目录结构说明

**步骤：**
1. `git mv shared src/shared`
2. 更新 3 个 tsconfig 的 paths：`"@shared/*": ["src/shared/*"]`
3. 更新 `electron.vite.config.ts`：3 处 alias 改为 `resolve(__dirname, 'src/shared')`
4. 更新 `CLAUDE.md` 目录结构

**验证：** `npm run typecheck`、`npm test`、`npm run build`

---

### 3. `eslint_config.mjs` → `config/lint/eslint.config.mjs`

**影响文件：**
- `package.json` — lint script
- `tsconfig.eslint.json` — 如果有引用

**步骤：**
1. `mkdir -p config/lint`
2. `git mv eslint_config.mjs config/lint/eslint.config.mjs`
3. 更新 `package.json` lint script：`eslint --config config/lint/eslint.config.mjs`
4. 验证 ESLint 能识别（ESLint 9 支持自定义 config 路径）

**验证：** `npm run lint`

---

### 4. `knip.json` → `config/knip.json`

**影响文件：**
- `package.json` — deadcode script

**步骤：**
1. `git mv knip.json config/knip.json`
2. 更新 `package.json` deadcode script：`knip --config config/knip.json`
3. 验证 knip 能识别

**验证：** `npm run deadcode`

---

### 5. `electron/` → `src/main/`（可选，高风险）

**说明：** electron-vite 的 main/preload 入口是配置项，不强制要求目录名。
移动后所有 `electron/` 的相对 import 不需改（因为是内部相对路径）。
但 `electron.vite.config.ts` 的入口路径需改。

**影响文件：**
- `electron.vite.config.ts` — main entry、preload entry、external 路径
- `tsconfig.node.json` — include/exclude（如有）
- `scripts/` 中引用 `electron/` 的脚本
- `docs/` 和 `CLAUDE.md`
- `tests/` 中 mock 路径（如 `vi.mock('electron', ...)` 不受影响）

**步骤：**
1. `git mv electron src/main`
2. 更新 `electron.vite.config.ts`：main entry → `src/main/main.ts`，preload entry → `src/main/preload.ts`，external 路径
3. 更新 `tsconfig.node.json` include
4. 更新 `docs/` 和 `CLAUDE.md`
5. 搜索所有硬编码 `electron/` 路径的文件

**验证：** `npm run typecheck`、`npm test`、`npm run build`、`npm run dist`

---

### 6. 不动项

| 目录/文件 | 原因 |
|---|---|
| `public/` | electron-vite renderer 强制要求 |
| `resources/` | electron-builder 强制要求 |
| `out/` | electron-vite 硬编码输出目录，改名需改 vite config + 所有 CI |
| `index.html` | Vite 入口，工具强制 |
| `*.config.*` 根目录文件 | 各工具强制放根目录 |
| `tsconfig*.json` | TypeScript 强制放根目录 |
| `package.json`、`package-lock.json` | npm 强制 |
| `release/` | 已在 gitignore |

---

## 执行顺序

1. `tests/user_e2e/` → `tests/e2e/`（低风险，独立）
2. `shared/` → `src/shared/`（中风险，alias 改动）
3. `eslint_config.mjs` → `config/lint/`（低风险）
4. `knip.json` → `config/`（低风险）
5. `electron/` → `src/main/`（高风险，最后做）

每步完成后：`npm run typecheck && npm test`，通过后再下一步。

---

## 最终目录结构

```txt
omni_pot/
├─ src/                         # 所有源码
│  ├─ main/                     # Electron 主进程（原 electron/）
│  │  ├─ main.ts
│  │  ├─ preload.ts
│  │  ├─ windows/
│  │  ├─ server/
│  │  ├─ ipc/
│  │  ├─ config/
│  │  ├─ updater/
│  │  └─ ...
│  ├─ shared/                   # 主进程/渲染进程共享（原 shared/）
│  │  └─ types/
│  ├─ components/
│  ├─ windows/
│  ├─ stores/
│  ├─ services/
│  └─ ...
├─ tests/
│  ├─ unit/
│  ├─ e2e/                      # 原 user_e2e/
│  │  ├─ specs/
│  │  ├─ pages/
│  │  └─ fixtures/
│  ├─ integration/
│  └─ chinese_dict/
├─ config/
│  ├─ lint/                     # eslint 配置
│  │  └─ eslint.config.mjs
│  └─ knip.json
├─ scripts/
├─ docs/
├─ data/
├─ public/                      # 不动
├─ resources/                   # 不动
├─ package.json
├─ tsconfig.json / .node / .web / .eslint
├─ electron.vite.config.ts
├─ playwright.config.ts
├─ vitest.config.ts
├─ CLAUDE.md
├─ TASKS.md
└─ README.md
```
