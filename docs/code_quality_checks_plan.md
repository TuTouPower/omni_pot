# omni_pot 代码质量检查体系落地方案

> 本文档说明 omni_pot 项目应该补哪些"编译前/运行前"检查、具体怎么配、有哪些坑。
> 执行人按本文档操作即可,不需要重新调研。

---

## 0. 先读什么

- **总纲(外部参考)**:`D:\Kar\file_need\obsidian_repo\my_note\Tech\strict_code_quality_checks.md`
  这是一份通用的严格检查体系总纲,覆盖 TS/React/Electron/扩展/Python。本文档是它**针对 omni_pot 的裁剪版**,只保留本项目用得上的部分。需要查某个工具的完整理由或配置范例时回去翻它,重点看:
  - 第 2 节(TypeScript / ESLint 严格配置)
  - 第 3 节(Electron 专项)
  - 第 6 节(死代码 / 依赖 / 架构)
  - 第 10 节(落地顺序)、第 12 节(注意事项)
- **项目约定**:仓库根 `CLAUDE.md` + 用户全局 `CLAUDE.md`
  关键约束:**所有命名(含文件名、目录名)一律 `snake_case`**;缩进 4 空格;日志用 logging 库不用 `console.log`。
  这条命名约定会和某些 lint 规则的默认值冲突,见第 4 节。

---

## 1. 项目现状

omni_pot = Electron 35 + React 19 + TypeScript 6 + electron-vite,目前检查非常薄:

| 已有 | 缺失 |
| --- | --- |
| `tsconfig` 裸 `strict: true` | ESLint(完全没有) |
| `typecheck` 脚本(tsc --noEmit) | 格式化检查(Prettier/Biome) |
| vitest 单测 + e2e | 死代码检查(Knip) |
| | Electron 安全扫描(Electronegativity) |
| | 密钥泄漏扫描(Gitleaks) |
| | 依赖漏洞扫描(npm audit / osv-scanner) |
| | git hooks / CI 门禁 |

---

## 2. 落地顺序(分三档,按档推进,不要一次全开)

> **重要**:本项目已有上万行存量代码。一次性全开严格检查会爆出几百上千个错误把人淹没。
> 必须**一档一档来,每档消化完再下一档**。

### 第一档 — 必须加(缺口最大)

#### 2.1 收紧 tsconfig

`tsconfig.node.json` 和 `tsconfig.web.json` 两个文件的 `compilerOptions` 都加上:

```jsonc
"noUncheckedIndexedAccess": true,   // 数组/对象索引结果变 T | undefined,能抓 services 解析 API 响应时的隐藏空值
"noUnusedLocals": true,
"noUnusedParameters": true,
"noImplicitReturns": true,
"noFallthroughCasesInSwitch": true
```

- `skipLibCheck: true` 保留不动。
- 改完跑 `npm run typecheck`,先把这批错误清干净再往下走。

#### 2.2 接入 ESLint(type-aware)

项目目前一行 lint 都没有,这是最大的洞。安装:

```
typescript-eslint            # TS 类型感知 lint
eslint-plugin-react-hooks    # React 19 + 大量 useEffect,必开
eslint-plugin-react
```

`eslint.config.js`(flat config)核心:
- 启用 `typescript-eslint` 的 `strictTypeChecked`(配 `parserOptions.project` 指向两个 tsconfig)
- `react-hooks/rules-of-hooks: error`、`react-hooks/exhaustive-deps: error`
- 关键规则:`@typescript-eslint/no-floating-promises`、`no-explicit-any`、`switch-exhaustiveness-check`、`consistent-type-imports`
- 跑 `eslint . --max-warnings=0`

新增 package.json 脚本:`"lint": "eslint . --max-warnings=0"`

#### 2.3 Electronegativity(Electron 安全扫描)

本项目是 Electron 应用,有 `electron/preload.ts`、`electron/selection/windows.ts`、IPC handlers、`koffi` 原生调用——攻击面真实存在。

```
npx @doyensec/electronegativity -i .
```

重点确认:`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`、IPC 校验了 sender/payload、设置了 CSP。

### 第二档 — 强烈建议

#### 2.4 Knip(死代码 / 未用依赖)

最近的 commit 就是 "fix leaks, deduplicate services",死代码是真实痛点。`src/services/*` 十几个文件,Knip 能找出没人用的导出和依赖。

```
npx knip
```

#### 2.5 Gitleaks(密钥泄漏)

项目接了一堆带 API key 的服务(alibaba/baidu/tencent/openai/volcengine...),必须扫:

```
gitleaks detect --source .
```

#### 2.6 格式化检查

Biome(推荐,快、能兼做部分 lint)或 Prettier,以 `--check` 模式进门禁。
**注意缩进必须配成 4 空格**(CLAUDE.md 要求)。

### 第三档 — 锦上添花

- `npm audit --audit-level=high` + `osv-scanner -r .`(依赖漏洞)
- Semgrep `--config=auto`(SAST)
- `lint-staged` + git pre-commit hook(拦明显坏代码)
- GitHub Actions:把 `typecheck + lint + test + build` 设为 master 必过门禁

---

## 3. 推荐的最终 package.json 脚本

```jsonc
{
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
    "lint": "eslint . --max-warnings=0",
    "format:check": "biome ci .",
    "deadcode": "knip",
    "security": "gitleaks detect --source . && npm audit --audit-level=high",
    "electron:security": "electronegativity -i .",
    "check": "npm run typecheck && npm run lint && npm run format:check && npm run deadcode"
  }
}
```

---

## 4. 必须注意的坑

### 4.1 文件名命名规则冲突(最重要)

本项目 CLAUDE.md 要求**文件名一律 `snake_case`**,项目现状也确实是(`source_area.tsx`、`config_components.tsx`、`icons.tsx`)。但**大多数 ESLint 文件名规则的默认值是为 React 社区惯例 `PascalCase` 设计的**,直接开会每个文件都报错。

| 规则 | 会不会冲突 | 怎么办 |
| --- | --- | --- |
| `unicorn/filename-case` | **会**。默认只认 `kebabCase`/`camelCase`,不认 `snake_case` | 显式配 `{ "case": "snakeCase" }`(推荐,还能拦住手滑写 `PascalCase.tsx`),或直接关掉 |
| `react/jsx-pascal-case` | **不冲突**。它管 JSX 标签名(`<SourceArea />`),与文件名无关 | 正常开 |
| `@typescript-eslint/naming-convention` | 不冲突(除非额外强制"导入名=文件名") | 正常开,管变量/函数/类型命名 |
| `eslint-config-next` | 不适用 | 本项目是 electron-vite 不是 Next,无视 |

**核心认知:"文件名风格"和"组件名风格"是两件事**:
- 文件名 → `snake_case`(CLAUDE.md 要求,项目已统一)
- 组件名/Hook 名 → `PascalCase` / `camelCase`(React 硬规则,靠大小写区分组件和 DOM 元素,**必须遵守,不能改**)

所以 `source_area.tsx` 里导出 `function SourceArea()`、`import SourceArea from './source_area'` 是**完全正常**的,不是冲突。

→ 落地动作:加 lint 时,`unicorn/filename-case` 显式设成 `snakeCase`;组件/Hook 命名规则照常全开。

### 4.2 存量项目不要一次性全开

参考总纲第 12 节。正确做法:
1. 先接入工具,允许 baseline(存量问题先挂账)
2. 新代码零 warning、零 type error
3. 旧问题按模块逐步清理
4. 最后把所有 warning 升级为 error

### 4.3 type-aware lint 要配 `parserOptions.project`

`typescript-eslint` 的 `strictTypeChecked` 依赖类型信息,必须在 ESLint config 里把 `parserOptions.project` 指向 `tsconfig.node.json` 和 `tsconfig.web.json` 两个,否则规则不生效或报错。

### 4.4 缩进 4 空格

CLAUDE.md 要求 4 空格、禁 tab。配 Biome/Prettier 时显式设 `indentWidth: 4`,否则默认值(Prettier 2、Biome 2)会和约定冲突,格式化一跑全项目 diff。

### 4.5 日志规范

CLAUDE.md 要求用 logging 库、禁 `console.log`。可以加 `no-console` 规则(electron 主进程除外按需放开),但这属于第三档,不急。

---

## 5. 验证标准

每一档做完,对应检查应满足:

- 第一档:`npm run typecheck` 零错误;`npm run lint` 零 warning;Electronegativity 无 high/critical。
- 第二档:`npx knip` 无未用依赖;`gitleaks` 无泄漏;`format:check` 无 diff。
- 第三档:`npm audit` 无 high/critical;CI 上 `check` 全绿并设为 master 门禁。
