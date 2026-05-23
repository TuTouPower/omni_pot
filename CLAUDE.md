# omni_pot 项目约定

## 项目介绍

Omni Pot 是一个跨平台桌面翻译、OCR 和词典工具，基于 Electron + React + TypeScript 构建。
支持多翻译引擎、截图 OCR、划词翻译/词典、剪贴板监听等功能，常驻系统托盘。

- 显示名（UI/文档中展示给用户）：**Omni Pot**
- 代码名（变量/文件名/package name）：**omni_pot**

技术栈：Electron 39 + React 19 + TypeScript 6 + electron-vite + Tailwind CSS + Zustand + better-sqlite3

## 常用命令

| 命令 | 用途 |
|---|---|
| `npm run dev` | 启动开发模式（热重载） |
| `npm run build` | 构建（不打包） |
| `npm run dist` | 构建 + 打包（NSIS 安装版 + 便携版；Windows 上成功后自动启动新产物；若既有 release 产物被 Omni Pot 占用，会在打包前自动关闭） |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run lint` | ESLint 检查 |
| `npm test` | 运行单元测试 |
| `npm run test:e2e` | 运行端到端测试 |
| `npm run test:e2e:core` | 运行核心 e2e 测试 |
| `npm run test:e2e:ui` | 运行 UI 回归 e2e 测试 |
| `npm run test:e2e:external` | 运行真实外部服务连通性 e2e 测试（需要网络） |
| `npm run dist:dir` | 构建 unpacked 目录产物，用于本地打包 smoke；Windows 上成功后自动启动 unpacked 应用 |
| `npm run start` | 预览构建产物 |
| `npm run build:chinese-dict` | 生成 `resources/data/dict/chinese_dict.db`（86MB，gitignored） |
| `npm run build:cc-cedict` | 生成 `resources/data/dict/cc_cedict.db`（24MB，gitignored） |

## 新克隆后的初始化

仓库不提交大体积二进制；首次本地开发或打包前需要生成两个词典 DB（`npm run dist` 已经在 `scripts/run_dist.mjs` 里自动跑这两步，纯本地 `dev`/`build` 路径可按需手动跑）：

```bash
npm install
npm run build:chinese-dict   # 依赖项目内 github_repo/chinese-dictionary 或 WSL 上游 \\wsl.localhost\Ubuntu-22.04\home\karon\karson_ubuntu\github_repo\chinese-dictionary
npm run build:cc-cedict      # 解压打包仓库内的 data/dict/cedict.txt.gz，纯本地即可
```

## 目录结构

| 目录 | 说明 |
|---|---|
| `electron/` | 主进程代码（窗口管理、IPC、服务、配置等） |
| `src/` | 渲染进程代码（React UI） |
| `shared/` | 主进程/渲染进程共享类型 |
| `public/` | 静态资源（logo 等） |
| `resources/` | 应用图标（icon.png, icon.ico） |
| `data/` | 词典数据、Tesseract 训练数据 |
| `tests/` | 单元测试 |
| `tests/user_e2e/` | 端到端测试 |
| `docs/` | 项目文档 |
| `out/` | 构建输出 |
| `release/` | 打包输出 |

## 运行时数据目录

应用的用户数据统一存放在 `%APPDATA%\omni_pot\`（Windows），开发和打包环境一致（`app.name = 'omni_pot'`）。

目录内容：

| 路径 | 说明 |
|---|---|
| `logs/main.log` | 主进程运行日志（electron-log，单文件最大 5MB，超限归档为 `main.old.log`） |
| `config.json` | 用户配置 |
| `history.db` | 翻译历史记录（SQLite） |
| `cc_cedict.db` | CC-CEDICT 词典数据库 |

## 项目背景

- 本项目基于新技术栈（Electron + React + TypeScript）重写 pot-desktop，实现其全部功能。
- `docs/archive/old_pot/spec.md` 是 pot-desktop 3.0.7 的旧规格，原开发者已不再维护、技术老旧，
  仅作**功能蓝本**参考，代码无直接利用价值。
- `~/karson_ubuntu/new_pot` 是修好 bug 的 clone 版本，作为**参考项目**；
  不知道某功能怎么实现时可以看它的代码。

## 文档索引

`docs/` 下文档**按需查阅**，不要全部加载到上下文。各文档作用：

| 文档 | 作用 |
|---|---|
| `docs/spec.md` | **产品规格** — omni_pot 功能、窗口、UI、服务、配置的权威定义 |
| `docs/design/omni-pot/` | UI 设计稿原型（HTML/JSX/CSS，最高优先级） |
| `docs/design/demo_todo.md` | omni_pot 设计稿与 spec 的已知偏差备忘 |
| `docs/test.md` | 测试规范与总则（分层、原则、快捷键策略、运行命令） |
| `docs/test_user_e2e.md` | 用户端到端测试设计（基础设施、文件规划、各 spec 内容） |
| `docs/api.md` | 主进程对外暴露的 HTTP API（`server_port`，默认 20202） |
| `docs/runtime_issues.md` | 运行时问题记录（日志证据、影响范围、修复方向与验证方式） |
| `TASKS.md` | 开发待办、测试覆盖审查、已知问题（合并自原 PLAN/review/issues） |
| `docs/external_service_catalog.md` | 外部服务事实清单（翻译/词典/OCR/TTS/检测/同步），按是否需要 key/本地依赖分类 |
| `docs/archive/external_services/` | 外部服务历史研究与测试报告快照（catalog 的溯源） |
| `docs/code_quality_checks_plan.md` | 代码质量检查体系落地方案 |
| `docs/archive/closed_issues/` | 已关闭的问题记录 |
| `docs/archive/handoffs/` | 历史会话交接备忘 |
| `docs/archive/reviews/` | 历史代码 review 与 demo/spec 差异分析 |
| `docs/archive/plan_archives/` | 历史 PLAN 归档 |
| `docs/archive/old_pot/spec.md` | pot-desktop 3.0.7 旧规格（历史参考，不代表当前实现） |
| `docs/superpowers/` | 早期重写设计与分阶段计划（历史参考，不代表当前实现） |

## 编码约定

- `scripts/` 下的命令行构建脚本可以使用 `console.log` / `console.warn` / `console.error` 输出用户可见进度与错误；应用代码仍使用日志模块。

- `scripts/build_chinese_dict.ts` 默认优先使用项目内 `github_repo/chinese-dictionary`；不存在时自动回退到 WSL 上游仓库 `\\wsl.localhost\Ubuntu-22.04\home\karon\karson_ubuntu\github_repo\chinese-dictionary`。

## 测试要求

测试要做完好的单元测试、集成测试、端到端测试，尽量少用 mock，多用真实环境，
保证测试覆盖 SPEC 的所有功能、所有 UI。外部服务 stub 边界按 `docs/test.md §2.1` 执行。
详见 `docs/test.md`。

## 产品术语

- **语音合成**是服务/配置类别名称；**朗读**是用户在按钮和操作入口上看到的动作名称。两者指同一个 TTS 能力，不要当成两个独立功能实现或记录。
- **文字识别**是 OCR 能力的用户展示名；**截图翻译**是截图后识别并翻译的用户展示名。中文 UI 和用户文档避免使用“文字识别”以外的“OCR 识别”表述。

## 文档同步

每次修改代码后，检查 `docs/` 与本文件中是否有受影响的文档，一并更新，
保证文档与代码始终一致，不出现过时描述。
