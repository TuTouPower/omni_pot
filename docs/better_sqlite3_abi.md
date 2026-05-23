# better-sqlite3 ABI 切换问题说明

## 现象

`better-sqlite3` 是原生 Node 模块，实际加载的是：

```text
node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

这个 `.node` 二进制只能匹配一个运行时 ABI。当前项目里会遇到两类相反的报错：

```text
was compiled against a different Node.js version using
NODE_MODULE_VERSION 140. This version of Node.js requires
NODE_MODULE_VERSION 127.
```

以及：

```text
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 140.
```

它们不是两个独立问题，而是同一个二进制在 Node 运行时和 Electron 运行时之间被来回重编译导致的。

## 当前 ABI 对应关系

当前本地命令观察到：

| 运行时 | 用途 | ABI |
|---|---|---|
| Node.js | `npm test`、`npx tsx scripts/build_*.ts`、普通脚本 | `127` |
| Electron 39.8.10 | E2E 启动的 Electron 主进程、打包产物 | `140` |

因此：

- 如果 `better_sqlite3.node` 是 ABI `140`，Node 侧脚本会失败。
- 如果 `better_sqlite3.node` 是 ABI `127`，Electron 主进程会失败。

## 为什么会“一会儿错一下，一会儿错一下”

仓库里同一个 `node_modules/better-sqlite3` 同时被两类命令使用：

### Node 侧命令

这些命令在普通 Node.js 里加载 `better-sqlite3`，需要 ABI `127`：

```bash
npm test
npm run build:chinese-dict
npm run build:cc-cedict
npm rebuild better-sqlite3
```

其中 `npm rebuild better-sqlite3` 会把模块编译/安装成当前 Node.js 的 ABI，也就是 ABI `127`。

### Electron 侧命令

这些命令运行 Electron 主进程或给 Electron 打包，需要 ABI `140`：

```bash
npm run test:e2e
npm run test:e2e:core
npm run test:e2e:ui
npm run test:e2e:external
npx electron-builder install-app-deps
npm run dist
```

其中 `electron-builder install-app-deps` / `electron-builder` 会把原生依赖重建成 Electron ABI，也就是 ABI `140`。

### 典型切换链路

1. 执行 `npm run dist`。
2. `dist` 前半段会跑词典构建脚本，这些脚本需要 Node ABI `127`。
3. `dist` 后半段会跑 `electron-builder`，它会把 `better-sqlite3` 重建成 Electron ABI `140`。
4. 这时再跑 `npm test` 或词典构建脚本，就可能报“模块是 140，但 Node 要 127”。
5. 手动执行 `npm rebuild better-sqlite3` 后，模块变回 Node ABI `127`。
6. 这时再跑 E2E，Electron 主进程就可能报“模块是 127，但 Electron 要 140”。

所以问题的本质不是某个测试不稳定，而是同一个工作区里的同一个原生模块二进制，被不同运行时轮流改写。

## 当前仓库里的相关位置

- `package.json`
  - `postinstall`: `electron-builder install-app-deps`
  - `test`: `vitest run`
  - `test:e2e`: `npx playwright test --project=full`
  - `test:e2e:external`: `npx playwright test --project=external`
  - `build:chinese-dict`: `npx tsx scripts/build_chinese_dict.ts`
  - `build:cc-cedict`: `npx tsx scripts/build_cc_cedict.ts`
- `scripts/build_chinese_dict.ts`
  - Node 进程中 import `better-sqlite3`，用于生成 `resources/data/dict/chinese_dict.db`。
- `scripts/build_cc_cedict.ts`
  - Node 进程中 import `better-sqlite3`，用于生成 `resources/data/dict/cc_cedict.db`。
- `electron/dict/index.ts`
  - Electron 主进程中 import `better-sqlite3`，运行词典查询。
- `electron/chinese_dict/index.ts`
  - Electron 主进程中 import `better-sqlite3`，运行中文词典查询。
- `electron/history/index.ts`
  - Electron 主进程中 import `better-sqlite3`，运行历史记录数据库。
- `tests/integration/chinese_dict_build.test.ts`
  - Vitest / Node 进程中 import `better-sqlite3`，检查生成的中文词典 DB。

## 解决方案：入口自动切 ABI（方案 A）

### 设计原则

每个 npm script 在执行前自动确保 `better-sqlite3` 处于正确的 ABI，开发者无需手动记忆或切换。

- **Node 侧命令**（`test`、`build:chinese-dict`、`build:cc-cedict`）：入口前置 `npm rebuild better-sqlite3`。
- **Electron 侧命令**（`test:e2e`、`test:e2e:core`、`test:e2e:ui`、`test:e2e:external`）：入口前置 `npx electron-builder install-app-deps`。
- **dist**：`run_dist.mjs` 已有分阶段逻辑，在词典构建前确保 Node ABI，electron-builder 自身会切到 Electron ABI，无需额外处理。

### 实施细节

#### 1. 新增辅助脚本 `scripts/ensure_node_abi.mjs`

快速检测当前 `better-sqlite3` 是否能被 Node 加载，不能则 rebuild：

```javascript
// scripts/ensure_node_abi.mjs
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const check = spawnSync(
    process.execPath,
    ['-e', "require('better-sqlite3')"],
    { stdio: 'pipe' }
)

if (check.status !== 0) {
    process.stderr.write('[abi] better-sqlite3 not compatible with Node, rebuilding...\n')
    const rebuild = spawnSync(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['rebuild', 'better-sqlite3'],
        { stdio: 'inherit', shell: process.platform === 'win32' }
    )
    if (rebuild.status !== 0) {
        process.exit(rebuild.status ?? 1)
    }
    process.stderr.write('[abi] rebuild complete\n')
}
```

#### 2. 新增辅助脚本 `scripts/ensure_electron_abi.mjs`

检测当前 `better-sqlite3` 是否已经是 Electron ABI，不是则 install-app-deps：

```javascript
// scripts/ensure_electron_abi.mjs
import { spawnSync } from 'node:child_process'
import process from 'node:process'

// 如果 Node 能加载，说明当前是 Node ABI，需要切到 Electron ABI
const check = spawnSync(
    process.execPath,
    ['-e', "require('better-sqlite3')"],
    { stdio: 'pipe' }
)

if (check.status === 0) {
    process.stderr.write('[abi] better-sqlite3 is Node ABI, switching to Electron ABI...\n')
    const install = spawnSync(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['electron-builder', 'install-app-deps'],
        { stdio: 'inherit', shell: process.platform === 'win32' }
    )
    if (install.status !== 0) {
        process.exit(install.status ?? 1)
    }
    process.stderr.write('[abi] switch complete\n')
}
```

#### 3. 修改 `package.json` scripts

```jsonc
{
  "scripts": {
    // Node 侧：前置 ensure_node_abi
    "test": "node scripts/ensure_node_abi.mjs && vitest run",
    "build:chinese-dict": "node scripts/ensure_node_abi.mjs && npx tsx scripts/build_chinese_dict.ts",
    "build:cc-cedict": "node scripts/ensure_node_abi.mjs && npx tsx scripts/build_cc_cedict.ts",

    // Electron 侧：前置 ensure_electron_abi
    "test:e2e": "node scripts/ensure_electron_abi.mjs && npx playwright test --project=full",
    "test:e2e:core": "node scripts/ensure_electron_abi.mjs && npx playwright test --project=core",
    "test:e2e:ui": "node scripts/ensure_electron_abi.mjs && npx playwright test --project=ui --pass-with-no-tests",

    // dist 不变：run_dist.mjs 内部已处理
    "dist": "node scripts/run_dist.mjs",
    "dist:dir": "node scripts/run_dist.mjs --dir"
  }
}
```

#### 4. 修改 `scripts/run_dist.mjs`

在词典构建步骤前显式确保 Node ABI（替换现有的 retry 逻辑为前置检查）：

```javascript
// 在 steps 数组前加一步
const ensure_node_abi = ['node', ['scripts/ensure_node_abi.mjs']]

const steps = [
    [npm_cmd, ['run', 'dist:check-locks']],
    ensure_node_abi,                              // 确保词典构建用 Node ABI
    [npm_cmd, ['run', 'build:chinese-dict']],
    [npm_cmd, ['run', 'build:cc-cedict']],
    [npm_cmd, ['run', 'build']],
    [npm_cmd, ['run', 'dist:check-locks']],
    [npx_cmd, ['electron-builder', ...]],         // electron-builder 自动切 Electron ABI
]
```

注意：`build:chinese-dict` 和 `build:cc-cedict` 的 script 定义里也有 `ensure_node_abi` 前缀，但从 `run_dist.mjs` 调用时会走 `npm run build:chinese-dict`，所以检查会执行两次。第二次检查是秒过的（已经是 Node ABI），不影响性能。

### 性能影响

| 场景 | 额外耗时 |
|---|---|
| ABI 已匹配 | < 1 秒（`node -e require(...)` 检查通过，跳过） |
| ABI 不匹配，需要 rebuild | 约 5-10 秒（重新编译 better-sqlite3） |

### 行为保证

| 操作序列 | 结果 |
|---|---|
| `npm run dist` → `npm test` | `test` 入口自动 rebuild 回 Node ABI，通过 |
| `npm test` → `npm run test:e2e` | `test:e2e` 入口自动切到 Electron ABI，通过 |
| `npm run test:e2e` → `npm run build:chinese-dict` | 词典构建入口自动 rebuild 回 Node ABI，通过 |
| 任意顺序连续执行 | 每个命令自行保证 ABI，互不干扰 |

### 不变的部分

- `postinstall` 仍然是 `electron-builder install-app-deps`（`npm install` 后默认切到 Electron ABI，因为开发时最常用的是 `npm run dev` 启动 Electron）。
- `run_dist.mjs` 保留现有的 `run_with_better_sqlite3_rebuild` 作为兜底 fallback，但正常路径下不会触发。
- `npm run dev`、`npm run build`、`npm run start` 不涉及 `better-sqlite3` 的直接加载，无需修改。

## 判断当前模块属于哪个 ABI

如果 Node 侧能加载：

```bash
node -e "require('better-sqlite3'); console.log('node abi ok')"
```

说明当前模块匹配 Node.js（ABI 127）。

如果上面报错，说明当前模块是 Electron ABI（ABI 140）。

## 结论

这个问题的根因是：`better-sqlite3` 的同一个原生二进制在普通 Node.js 和 Electron 两个不同 ABI 的运行时之间复用。通过在每个 npm script 入口自动检测并切换 ABI，开发者可以以任意顺序运行任何命令，不再需要手动记忆切换步骤。
