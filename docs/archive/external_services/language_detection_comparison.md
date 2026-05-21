# 本地语言检测方案对比

> 更新日期: 2026-05-17
> 背景：当前 `src/services/detect.ts` 的 `detect_local()` 使用 Unicode 正则匹配，只能区分不同字符系统（中日韩俄泰阿拉伯等），拉丁字母系语言（英法德西意葡土等）全部 fallback 到 `en`。旧版 pot-desktop 使用 Rust `lingua` crate（n-gram 概率模型）。本文档对比三个可替换方案。

---

## 方案总览

| 方案 | 原理 | 语言数 | npm 包 | 大小 | 准确率 | 速度 |
|------|------|--------|--------|------|--------|------|
| **当前 regex** | Unicode 字符范围 | ~8 类 | 无（内置） | 0 | 46.7% | ~0ms |
| **franc** | 纯 JS trigram | 82/187/419 | `franc` v6.2.0 | ~236KB data | 66.7% | 0.24ms 短 / 3.6ms 长 |
| **cld3-asm** | WASM 神经网络 (Google CLD3) | ~107 | `cld3-asm` v4.0.0 | ~2MB WASM | 73.3% | 0.10ms 短 / 0.44ms 长 |
| **lingua-rs** | Rust n-gram (1-5) | 75 | 无 npm 包 | ~288MB 全语言 | ~99.7% (句子) | 最慢 |

---

## 基准测试结果

测试环境：WSL Ubuntu 22.04, Node.js v22.22.2
测试数据：15 种语言 × 2 种长度（短文本 ~2-5 词，长文本 ~2-3 句），共 30 个用例
速度测试：每种检测器运行 1000 次

### 准确率

| 方案 | 正确数 | 总数 | 准确率 |
|------|--------|------|--------|
| regex | 14 | 30 | 46.7% |
| franc | 20 | 30 | 66.7% |
| cld3-asm | 22 | 30 | 73.3% |

### 速度（1000 次迭代）

| 方案 | 短文本总耗时 | 短文本每次 | 长文本总耗时 | 长文本每次 |
|------|-------------|-----------|-------------|-----------|
| regex | <1ms | ~0ms | <1ms | ~0ms |
| franc | 237ms | 0.237ms | 3605ms | 3.605ms |
| cld3-asm | 101ms | 0.101ms | 444ms | 0.444ms |

### 详细准确率

| 语言 | regex (短/长) | franc (短/长) | cld3 (短/长) |
|------|--------------|--------------|-------------|
| en | OK/OK | OK/OK | OK/OK |
| zh_cn | OK/OK | OK/OK | OK/OK |
| ja | OK/OK | OK/OK | OK/OK |
| ko | OK/OK | OK/OK | OK/OK |
| fr | en/en | en/OK | OK/OK |
| de | en/en | en/OK | OK/OK |
| es | en/en | en/OK | en/OK |
| it | en/en | en/OK | en/OK |
| pt | en/en | en/OK | en/OK |
| nl | en/en | de/OK | en/OK |
| tr | en/en | en/OK | en/OK |
| ru | OK/OK | OK/OK | OK/OK |
| ar | OK/OK | en/OK | en/OK |
| hi | OK/OK | OK/OK | en/OK |
| th | OK/OK | OK/OK | OK/OK |

> 注：测试数据中部分拉丁语言缺少变音符号（fr/de/es/it/pt/nl/tr），实际使用中带变音符号的文本准确率会更高。

---

## 详细分析

### 1. 当前 regex（`src/services/detect.ts`）

**原理**：用 Unicode 字符范围正则判断文本属于哪个字符系统。

**优点**：
- 速度最快（几乎为零开销）
- 零依赖，无额外体积

**缺点**：
- 只能区分字符系统，不能区分同一系统的语言
- 所有拉丁字母语言（英法德西意葡土等）全部返回 `en`
- 本质上不是语言检测，只是文字系统分类

**结论**：作为 fallback 可以保留，但不能作为唯一的本地检测手段。

### 2. franc

**原理**：纯 JS 实现的 trigram（三字母组合）概率模型。将输入文本的 trigram 频率与已知语言模型对比，选择最匹配的语言。

**npm 包**：`franc` v6.2.0
- `franc-min`：20 种语言，最小体积
- `franc`：82 种语言，推荐
- `franc-all`：419 种语言

**优点**：
- 纯 JS，无 WASM/Native 依赖
- 安装简单（`npm install franc`）
- 返回 ISO 639-3 代码，需映射到项目语言代码
- 体积小（~236KB 语言数据）

**缺点**：
- 短文本准确率低（2-5 词时经常误判）
- 长文本速度慢（3.6ms/次，比 cld3 慢 8 倍）
- 拉丁系语言之间容易混淆（nl→de，fr/es/it/pt→en）

**代码示例**：
```ts
import { franc } from 'franc';
const code = franc('你好世界'); // 'cmn'
// 需要 ISO 639-3 -> 项目语言代码的映射
```

### 3. cld3-asm（推荐）

**原理**：Google Compact Language Detector v3 的 WebAssembly 移植版，使用神经网络模型。

**npm 包**：`cld3-asm` v4.0.0
- 依赖 `emscripten-wasm-loader`
- WASM 二进制在运行时下载/加载

**优点**：
- 准确率最高（73.3%，实际带变音符号的文本会更高）
- 速度快（0.1ms 短文本，0.44ms 长文本）
- Google 维护的检测模型
- 支持 ~107 种语言
- 返回置信度（`isReliable`），可与在线检测结果对比

**缺点**：
- 依赖 WASM（首次加载需初始化）
- `cld3-asm` 依赖 `emscripten-wasm-loader`，会下载 WASM 二进制
- 返回 BCP-47 语言代码（如 `zh`、`zh-Hant`），需映射
- npm 包最后一次更新较久（需验证兼容性）

**代码示例**：
```ts
import { loadModule } from 'cld3-asm';
const factory = await loadModule();
const instance = factory.create(0);
const result = instance.findLanguage('你好世界');
// { language: 'zh', isReliable: true, proportion: 1.0 }
```

### 4. lingua-rs（无法直接使用）

**原理**：Rust 实现的 n-gram（1-5）概率模型 + 规则引擎，75 种语言。

**npm 包**：无
- `unrs/lingua` GitHub 仓库是空壳（2025 年 4 月创建，只有 README + LICENSE）
- 需要自行用 `wasm-pack` 编译 lingua-rs 为 WASM
- 全语言模型 ~288MB，单语言 ~4MB

**优点**：
- 短文本准确率最高（单词 ~74%，句子 ~99.7%）
- 不依赖网络，纯离线
- Rust 实现，内存安全

**缺点**：
- 无 npm 包，需要自行编译 WASM
- 速度最慢（基准测试显示 492ms-3.1s / 2000 句，单线程）
- 全语言模型体积巨大（~288MB）
- 集成成本高

**结论**：理论上最准确，但集成成本过高，不建议本轮使用。如果未来有人发布 npm 可用的 WASM 包，可以重新评估。

---

## 推荐方案

### 首选：cld3-asm

**理由**：
1. 准确率最高（73.3%，实际会更高）
2. 速度最快（比 franc 快 3-8 倍）
3. 有现成 npm 包，集成简单
4. Google 维护的模型，语言覆盖广

**集成步骤**：
1. `npm install cld3-asm`
2. 在 `src/services/detect.ts` 中添加 `detect_cld3()` 函数
3. 添加 BCP-47 代码到项目语言代码的映射表
4. 修改 `detect_local()` 优先使用 cld3，regex 作为 fallback
5. 处理 WASM 初始化（可能需要在 app 启动时预加载）

**风险**：
- WASM 二进制加载可能增加首次启动时间
- `cld3-asm` 包较老，需验证与当前 Node/Electron 版本兼容性
- 需要处理 `emscripten-wasm-loader` 的 WASM 文件打包问题

### 备选：franc

如果 cld3-asm 在 Electron 环境中有 WASM 加载问题，franc 是纯 JS 方案，无 WASM 依赖，集成最简单。

### 不推荐：lingua-rs

无 npm 包，需要自行编译 WASM，集成成本过高。

---

## 下一步

1. 在 Electron 环境中测试 cld3-asm 的 WASM 加载兼容性
2. 验证 `cld3-asm` 与当前 Node.js / Electron 版本的兼容性
3. 测试 WASM 初始化对启动时间的影响
4. 如果 cld3 可用，实现 `detect_cld3()` 并替换 `detect_local()`
5. 保留 regex 作为 WASM 加载失败时的 fallback
