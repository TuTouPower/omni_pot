# omni_pot 开发待办

> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_user_e2e.md` 为准。
> 本文档综合了 `docs/frontend_spec_gap_analysis.md`、`docs/design/demo_vs_implementation_diff.md`、`docs/issues.md` 的待办项。
> 已完成项归档见 `docs/archive/plan_archive.md`、`docs/archive/plan_archive_2.md`。

---

## 当前阶段

2026-05-18 用户验收发现大量 UI/体验问题。核心矛盾：**测试只验证了"链路通"，没有验证"体验对"**。
第一轮 P0-P2 代码修复已完成并归档（`docs/archive/plan_archive_2.md`）。剩余工作：

1. 人工验证（TTS 实机发声 + 打包后 smoke）
2. P5：集成免费翻译/词典服务（暂不做，仅记录）
3. 已知环境问题跟踪

### 测试为什么漏掉这些问题

| 缺失维度 | 具体表现 |
|---|---|
| **视觉正确性** | 没有截图比对，图标画错（图钉缺竖线、换行/空格符号错）完全检测不到 |
| **内容正确性** | 断言只查 `toBeVisible()` / `toHaveValue()`，不断言具体文字（语言标签、下拉选项列表），所以语言显示错误、"自动检测"重复检测不到 |
| **交互序列** | 不测连续操作（连续点击两个快捷键绑定按钮），交互状态丢失的 bug 无法暴露 |
| **持久化** | 每次测试都是全新实例，从不关窗口再重开，窗口宽度记忆等跨 session 行为无法覆盖 |
| **服务路由** | 断言"每张卡片都出了结果"，不验证"调了哪些服务"，词典分流错误检测不到 |
| **中文场景** | 测试数据全是英文（`hello world`），中文字词查询无结果从未被测试覆盖 |

核心教训：测试必须同时验证**链路通**和**体验对**。链路通 = 元素存在 + 结果到达；体验对 = 具体内容正确 + 视觉符合设计稿 + 交互状态一致。

---

## 人工验证

以下项需在 Windows dist 产物中人工确认：

- [ ] **TTS 实机发声**：翻译/词典/识别窗口点击朗读，确认有声音
- [ ] **打包后 smoke**：首次启动、托盘、快捷键、截图、设置窗口、识别窗口

---

## P5: 集成免费翻译/词典服务（不做，仅记录）

来源：`docs/external_services/pot_plugin_api_test_results.md`（2026-05-19 测试）。

将 pot-app 社区验证过的免费、无需 API key 的服务接入 omni_pot，扩充翻译和词典引擎。

### 翻译服务（免费无 key，已验证可用）

- [ ] **火山翻译 (Volcengine)** — 最简单，纯 JSON POST，零签名
- [ ] **腾讯交互翻译 (Transmart)** — 稳定，固定 client_key
- [ ] **腾讯翻译君 (Tencent WeChat)** — 稳定，GET 请求，模拟微信小程序
- [ ] **彩云小译 (Caiyun)** — 稳定，内置 token（有失效风险）
- [ ] **Papago (Naver)** — 多语言，需动态 HMAC token 流程

### 词典服务（免费无 key，已验证可用）

- [ ] **Free Dictionary API** — 英文词义/音标/例句（当前项目已有集成，确认是否最新）
- [ ] **Tatoeba 例句查询** — 多语言例句搜索引擎，适合做辅助功能

### 参考

各服务 API 格式、请求/响应示例、注意事项详见 `docs/external_services/pot_plugin_api_test_results.md`。

---

## 已知环境问题（不修，仅跟踪）

- **谷歌翻译当前环境失败**：网络可达时复测，或更换默认免费引擎
