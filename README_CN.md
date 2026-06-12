# Omni Pot

跨平台桌面翻译、OCR 和词典工具。基于 Electron + React + TypeScript 构建。

[English](README.md)

## 功能

- **翻译** — 多引擎并行翻译，支持系统划词选中和剪贴板监听
- **词典** — 字词查询，支持英文词典和中文词典
- **文字识别** — 区域截图 → 文字识别
- **截图翻译** — 截图 → 识别 → 自动翻译
- **朗读** — 翻译结果语音合成
- **HTTP API** — 本地 HTTP 服务器供外部脚本调用
- **系统托盘** — 常驻后台，全局快捷键

## 技术栈

Electron 39 · React 19 · TypeScript 6 · electron-vite · Tailwind CSS · Zustand · better-sqlite3

## 快速开始

```bash
git clone https://github.com/TuTouPower/omni_pot.git
cd omni_pot
npm install
npm run build:chinese-dictionary   # 生成词典数据库
npm run dev                        # 启动开发模式
```

## 常用命令

| 命令 | 用途 |
|---|---|
| `npm run dev` | 启动开发模式（热重载） |
| `npm run build` | 构建（不打包） |
| `npm run dist` | 构建 + 打包（安装版 + 便携版） |
| `npm test` | 运行单元测试 |
| `npm run test:e2e` | 运行端到端测试 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run lint` | ESLint 检查 |

## 目录结构

| 目录 | 说明 |
|---|---|
| `src/main/` | 主进程代码（窗口管理、IPC、服务、配置等） |
| `src/` | 渲染进程代码（React UI） |
| `src/shared/` | 主进程/渲染进程共享类型 |
| `public/` | 静态资源（logo 等） |
| `data/` | 词典数据、Tesseract 训练数据 |
| `scripts/` | 自动构建/发布脚本 |
| `tests/` | 单元测试 |
| `tests/e2e/` | 端到端测试 |
| `docs/` | 项目文档 |

## 文档

完整产品规格见 `docs/SPEC.md`。`docs/` 下另有测试规范、API 文档、发布流程等。

## 定价

Omni Pot **功能免费使用**，不收取任何费用。

官网（[zzzkkkccc.site](https://www.zzzkkkccc.site/)）上的定价仅用于满足国外应用商店支付平台的合规要求，并非实际收费。

## 许可

私有仓库，保留所有权利。
