# omni_pot 开发待办

> **权威来源**: 功能定义以 `docs/spec.md` 为准，测试设计以 `docs/test_user_e2e.md` 为准。
> 已完成项归档见 `docs/archive/plan_archive.md`、`docs/archive/plan_archive_2.md`、`docs/archive/plan_archive_3.md`。

---

## 当前状态

- 第二轮代码修复 ✅ (6/6)、第二轮测试加固 ✅ (5/5)、第三轮测试整改 ✅ (9/9)、第四轮 review 覆盖加固 ✅ (9/10)
- 详见 `docs/archive/plan_archive_3.md`

---

## 待办

### P1: 语言检测回退链 + "我爱你"中文不误判日语

**来源**: `docs/review.md` §P1.7、建议 #10
**范围**: spec §17 失败回退链 `bing → google → baidu → tencent → niutrans → local`；spec §5.4 中文长句不被误判为日语
**整改**:
- [ ] 单元层 mock 模拟逐个引擎失败，断言回退顺序
- [ ] E2E 加 "我爱你×N → 检测为中文" 断言
- [ ] 检测引擎与目标语言相同 → 回退到 `translate_second_language` 的强断言

### P2: 单元 / 集成层薄弱项

来源 `docs/review.md` §P2：

- [ ] HTTP API 端点 `POST /translate`、`GET /config`、`/recognize` 集成测试（spec §20）
- [ ] 选中文本 fallback 链（UIA → Ctrl+C → sentinel → restore）完整覆盖（spec §24）
- [ ] CSP 策略验证（`connect-src` https、`media-src blob:`、`worker-src blob:`、WASM 执行）（spec §3.4）
- [ ] better-sqlite3 native rebuild + 打包 unpacked 自动化（spec §29，issue #1）
- [ ] 翻译历史按**实例 key** 存 `service_key`（同服务多实例）的专门断言（spec §25）
- [ ] 服务实例 `config.enable=false` 时**保留在列表中但不参与执行**的断言（spec §12.3）
- [ ] 剪贴板抑制窗口（划词翻译 Ctrl+C 回退期间不误触发监听）E2E 覆盖（spec §23）

---

## 人工验证

以下项需在 Windows dist 产物中人工确认：

- [ ] **TTS 实机发声**：翻译/词典/识别窗口点击朗读，确认有声音
- [ ] **打包后 smoke**：首次启动、托盘、快捷键、截图、设置窗口、识别窗口
- [ ] **置顶按钮图钉竖线视觉**：dist 实物中确认竖线显示，必要时调整 strokeWidth
- [ ] **去除换行 / 去除空格图标与 demo 一致性**：dist 实物中确认与设计稿一致

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
