# 用户端到端测试设计 (User E2E Test Design)

> omni_pot 用户端到端测试的完整设计方案 —— 从头重做。
> 测试目录：`tests/user_e2e/`
> 测试总则与分层职责见 `docs/test.md`；本文是 E2E 这一层的详细设计。
> E2E 框架为 **Playwright**（`@playwright/test` + Electron）。
> 功能与 UI 定义见 `docs/spec.md`；UI 设计稿原型见 `docs/design/omni-pot/`。

---

## 1. 为什么从头重做

旧 `tests/user_e2e/01_all_critical_paths.test.ts` 曾存在结构性问题，已随 Playwright 迁移删除：

| 问题 | 后果 |
|---|---|
| 单文件 600 行，CP1–CP6 全塞一起 | 难维护、难定位失败、无法独立运行 |
| 两套重复 helper（`test_utils.ts` 全局单例 + 测试文件内联 `ctx_*`） | 维护负担翻倍、行为不一致 |
| `shuffle()` 随机执行顺序 | 失败不可复现 |
| serial / parallel 模式逻辑混在测试体里 | 测试逻辑被基础设施噪音淹没 |
| 大量裸 `setTimeout(r, 300)` | flaky |
| 断言靠 DOM 字符串匹配（`textContent.includes('翻译失败')`） | UI 一改就碎，且测不到真实交互 |
| 只测“文本进→结果出”的数据流 | **完全不测 UI 交互** —— issues.md 里 8 个 bug 全部漏网 |

所以本设计**不保留**现有文件，基于 **Playwright** 重建一套分层、可维护、覆盖完整的体系。

> **为什么用 Playwright 而非继续自研 Vitest + CDP**：Playwright 的 `locator` API 能稳定
> 表达用户看到/点击的元素，自动等待机制比自写 CDP 轮询更稳，内置 screenshot / trace /
> video / HTML report 便于定位 UI 回归，Page Object 写法成熟。现有 Vitest + CDP 实现仅作
> 迁移前的历史参考；其中 Electron 启动、端口分配、HTTP readiness、E2E 环境变量等经验可
> 迁移到 Playwright fixture。不再扩展自研 CDP selector/click/drag helper，不再以
> `vitest.e2e.config.ts` 作为用户 E2E 配置。

---

## 2. 设计目标与原则

1. **覆盖完整**：覆盖 `docs/design/omni-pot/` 设计稿出现的每个 UI 元素与交互，
   以及代码已实现的每个窗口与功能。设计稿与 spec 的差异处理见 `docs/design/demo_todo.md`。
2. **测真实交互**：用真实鼠标/键盘事件点击真实元素，而非调用 `electronAPI` 绕过 UI。
   按钮失效类 bug（issues #4 #5）只有点真按钮才能抓到。
   **不写脱离用户视角的冒烟测试或接口测试** —— 每个用例都是“用户做了某操作 → 看到某结果”。
   服务可用性不靠直接调 service API 验证，而靠“用户在窗口里翻译/查词/识别 → 看到结果卡片”来验证。
3. **稳定可复现**：固定执行顺序、显式等待条件、稳定的 `data-testid` 选择器、
   每个用例独立且自带配置重置。
4. **分层**：基础设施 / 页面对象 / 测试用例三层分离，测试体只表达“测什么”。
5. **真实环境优先**：免费服务真实 API 调用；付费服务才 mock（遵循 `CLAUDE.md`）。
6. **一个 spec 一个关注点**：文件名即覆盖范围，失败一眼定位。

---

## 3. 目录结构

```
tests/user_e2e/
├── playwright.config.ts     # Playwright 配置：projects(core/ui/full)、reporter、超时、artifact
├── fixtures/
│   ├── electron_app.ts      # 启动/停止 Electron：_electron.launch()，独立端口 + 独立 userData
│   ├── app_fixture.ts       # AppFixture：封装 ElectronApplication + 多窗口 Page + 配置读写 + 重置
│   └── e2e_api.ts           # 封装 E2E HTTP 端点调用（触发选区/字典/截图、读剪贴板、重置配置等）
├── pages/                   # Page Object：每个窗口一个，基于 Playwright locator
│   ├── translate_page.ts
│   ├── dict_page.ts
│   ├── recognize_page.ts
│   ├── screenshot_page.ts
│   ├── config_page.ts
│   ├── updater_page.ts
│   └── tray.ts
├── specs/                   # 测试用例文件（见第 5 节）
│   ├── app_lifecycle.spec.ts
│   ├── translate_core.spec.ts
│   ├── translate_titlebar.spec.ts
│   ├── translate_source_area.spec.ts
│   ├── translate_result_cards.spec.ts
│   ├── translate_language_area.spec.ts
│   ├── translate_behavior.spec.ts
│   ├── dict_window.spec.ts
│   ├── recognize_window.spec.ts
│   ├── screenshot_window.spec.ts
│   ├── screenshot_latency.spec.ts
│   ├── config_settings.spec.ts
│   ├── config_service_mgmt.spec.ts
│   ├── config_history_backup.spec.ts
│   ├── external_services.spec.ts
│   ├── updater_and_tray.spec.ts
│   └── i18n.spec.ts
└── data/                    # 测试夹具数据（样例图片、OCR 语言包等）
```

---

## 4. 测试基础设施设计

基于 Playwright 的 Electron 支持（`_electron`）。每个 spec 文件独立一个 Electron 实例。

### 4.1 electron_app.ts —— 启动/停止

```ts
import { _electron as electron, type ElectronApplication } from 'playwright'

interface AppOptions {
  userDataDir?: string         // 复用既有 userData；未传时创建独立临时目录
  cleanupUserDataDir?: boolean // closeApp 时是否清理 userData
  config?: Partial<AppConfig>  // 启动前预写入的 config.json
  firstRun?: boolean           // 模拟首次运行（空 config）
}

interface LaunchedApp {
  app: ElectronApplication
  httpPort: number             // E2E HTTP 端点端口
  userDataDir: string
  cleanupUserDataDir: boolean
}

export async function launchApp(opts: AppOptions): Promise<LaunchedApp>
export async function closeApp(launched: LaunchedApp): Promise<void>
```

要点：

- 用 `electron.launch({ args: ['out/main/index.js'], env })` 启动；Playwright 自带 CDP 接管，
  无需手动管理 `--remote-debugging-port`。
- `globalSetup` 在每次 Playwright 命令开始时执行一次 `electron-vite build`，避免旧 `out/` 产物。
- 每个测试独立随机 `httpPort`、**独立 userData 临时目录** —— 测试间隔离。
- 环境变量把 `userDataDir`、预置 `config`、`firstRun`、`OMNI_POT_E2E=1`、
  `OMNI_POT_E2E_TOKEN` 传给 main 进程；E2E-only HTTP 端点必须带匹配 token。
- 关闭时默认清理 userData 临时目录；需要验证重启持久化时可复用同一 userData，最终停止时再清理。

### 4.2 多窗口 Page

omni_pot 是多窗口应用，每个 BrowserWindow 是一个 Playwright `Page`：

- `app.firstWindow()` —— 首个窗口（通常翻译窗口）
- `app.windows()` —— 当前全部窗口
- `app.waitForEvent('window')` —— 等待新窗口出现（打开配置/词典/识别时）
- 按 URL hash 区分窗口：`page.url()` 含 `#translate` / `#dict` / `#config` 等

`app_fixture` 负责把“某 label 的窗口”解析为对应 `Page` 并包进 Page Object。

### 4.3 app_fixture.ts —— AppFixture

一个 spec 文件持有一个 `AppFixture`，以 Playwright fixture 形式注入：

```ts
class AppFixture {
  readonly app: ElectronApplication

  // 窗口 Page Object（按 label 解析 Page，按需等待窗口出现）
  translate(): Promise<TranslatePage>
  dict(): Promise<DictPage>
  recognize(): Promise<RecognizePage>
  config(): Promise<ConfigPage>
  screenshot(): Promise<ScreenshotPage>
  updater(): Promise<UpdaterPage>

  // 触发入口（走 E2E HTTP 端点 / 主进程辅助 API）
  triggerSelectionTranslate(text: string): Promise<TriggerResult>
  triggerInputTranslate(): Promise<void>
  triggerSelectionDict(text: string): Promise<void>
  triggerClipboardText(text: string): Promise<void>
  triggerScreenshot(mode: 'recognize' | 'translate'): Promise<void>
  translateViaHttp(text: string): Promise<void>
  openConfig(): Promise<ConfigPage>
  openUpdater(): Promise<UpdaterPage>
  clickTrayItem(item: TrayItem): Promise<void>

  // 配置与状态
  getConfig<K extends ConfigKey>(key: K): Promise<AppConfig[K]>
  setConfig<K extends ConfigKey>(key: K, value: AppConfig[K]): Promise<void>
  resetConfig(): Promise<void>             // 恢复 DEFAULT_CONFIG，关闭多余窗口
  readClipboard(): Promise<string>
  windowState(label): Promise<{ visible: boolean; alwaysOnTop: boolean; bounds: Rect }>
  history: { count(): Promise<number>; list(p, n): Promise<HistoryRecord[]>; clear(): Promise<void> }
}
```

以 Playwright fixture 形式注入，自动 setup/teardown：

```ts
export const test = base.extend<{ omni: AppFixture }>({
  omni: async ({}, use) => {
    const omni = await AppFixture.start()      // launchApp + 连接窗口
    await omni.resetConfig()
    await use(omni)
    await omni.stop()                          // closeApp + 清理 userData
  },
})
```

### 4.4 Page Object（pages/）

每个窗口一个 PO，封装该窗口的 `locator` 与语义操作；**测试用例只调 PO 方法**，
DOM 结构变化只需改 PO。基于 Playwright `getByTestId` / `locator`：

```ts
class TranslatePage {
  constructor(private page: Page) {}

  // 标题栏
  clickPin()   { return this.page.getByTestId('titlebar-pin').click() }
  clickClose() { return this.page.getByTestId('titlebar-close').click() }
  getModeLabel() { return this.page.getByTestId('titlebar-mode').textContent() }
  isPinActive(): Promise<boolean>             // 读按钮颜色是否主色
  // 源文本区
  typeSource(text: string): Promise<void>
  clickTranslate() { return this.page.getByTestId('source-translate-btn').click() }
  clickClearSource(): Promise<void>
  getSourceText(): Promise<string>
  getDetectedLanguageLabel(): Promise<string> // 期望 "检测为英文"
  // 语言区
  getSourceLangLabel(): Promise<string>       // 期望 "自动检测"
  getTargetLangLabel(): Promise<string>       // 期望 "简体中文"
  clickSwap(): Promise<void>
  clickDetectedLanguage(): Promise<void>
  // 结果卡片
  resultCard(instanceKey: string): Locator    // [data-testid=result-card][data-result-key=...]
  waitAllResults(timeout?: number): Promise<void>
}
```

利用 Playwright 的自动等待：`locator.click()` 自动等元素可见可点击，
`expect(locator).toHaveText(...)` 自动轮询 —— 不再手写 CDP 轮询与裸 `setTimeout`。

当前已落地基础 Page Object：`translate_page.ts`、`dict_page.ts`、`recognize_page.ts`、
`screenshot_page.ts`、`config_page.ts`、`updater_page.ts`。

### 4.5 需要源码配合的基础设施

> E2E 基础设施已部分落地；剩余项跟踪进度见 `PLAN.md`。

测试要稳定，必须给源码加 **稳定选择器** 与 **E2E 端点**。

已落地的基础选择器：

- 翻译：`titlebar-pin`、`titlebar-close`、`titlebar-mode`、`titlebar-wordmark`、
  `titlebar`、`source-input`、`source-translate-btn`、`source-clear-btn`、
  `source-newline-btn`、`source-copy-btn`、`source-tts-btn`、`detected-lang`、
  `lang-source`、`lang-source-button`、`lang-source-option-{code}`、`lang-target`、
  `lang-target-button`、`lang-target-option-{code}`、`lang-swap`、
  结果卡片 `result-card` / `result-tts` / `result-copy` / `result-collect` /
  `result-collapse` / `result-retry` / `result-body` / `result-error`，以及
  `data-result-key` / `data-result-content` / `data-result-error`
- 词典：标题栏基础选择器、`dict-word`、`dict-card`、`dict-source-tag`
- 识别：标题栏基础选择器、`ocr-image`、`ocr-text`、`ocr-engine-select`、
  `ocr-lang-select`、`ocr-reocr-btn`、`ocr-newline-btn`、`ocr-space-btn`、
  `ocr-copy-btn`、`ocr-export-btn`、`ocr-translate-btn`
- 截图：`shot-overlay`、`shot-selection`、`shot-size-label`、`shot-hint`
- 设置：`config-wordmark`、`config-titlebar`、`config-minimize`、`config-maximize`,
  `config-version`、`config-nav-{page}`、`config-title`、`config-close`、各设置项
  `cfg-{key}`、服务项 `svc-item`、服务 tab `svc-tab-{listKey}`、`svc-add-btn`、
  `svc-add-option`、`svc-delete`、`svc-move-up`、`svc-move-down`、`svc-drag-handle`、
  `svc-toggle`、`svc-edit`、`svc-edit-modal`、`svc-edit-name`、`svc-edit-config`、
  `svc-test`、`svc-test-status`、`svc-edit-save`、
  历史 `history-row` / `history-clear` / `history-edit-*` / `history-prev` / `history-next`、
  备份 `backup-create` / `backup-row` / `backup-restore-*`
- 更新器：`updater-changelog`、`updater-progress`、`updater-confirm`、`updater-later`

当前 UI 尚未实现的控件不预埋选择器：词典收藏 `dict-collect`、词典朗读 `dict-tts`。
后续实现这些用户功能时，同步补选择器与对应用户路径 spec。

**(b) E2E HTTP 端点扩充**（`electron/server/index.ts`，仅 `OMNI_POT_E2E` +
`OMNI_POT_E2E_TOKEN` 匹配时启用）：

当前已有：`/trigger-selection`、`/trigger-dict`、`/trigger-clipboard`、
`/trigger-clipboard-translate`、`/capture-clock`、`POST /e2e/open-window`、
`POST /e2e/reset-config`、`GET /e2e/clipboard`、`GET /e2e/window-state`、
`POST /e2e/trigger-screenshot`、`POST /e2e/trigger-input-translate`、
`POST /e2e/tray-action`、`GET /e2e/tray-menu`、`POST /e2e/mock-update`。

| 端点 | 用途 |
|---|---|
| `POST /e2e/trigger-screenshot` | 触发截图（指定 `recognize` / `translate` mode） |
| `POST /e2e/trigger-input-translate` | 触发输入翻译入口 |
| `GET /e2e/window-state` | 查询窗口存在、可见、聚焦、置顶与 bounds 状态 |
| `POST /e2e/tray-action` | 触发托盘动作：`input_translate` / `clipboard_monitor` / `config` / `tray_click` |
| `GET /e2e/tray-menu` | 读取原生托盘菜单当前文案，用于验证界面语言切换后的托盘项本地化 |
| `POST /e2e/mock-update` | 注入一个假的“有新版本”用于更新器测试 |

**(c) 独立 userData**：已通过 `OMNI_POT_USER_DATA` 从 Playwright fixture 传给 main 进程，
每个测试使用独立临时目录，关闭时清理。

---

## 5. 测试文件规划（15 个 spec）

当前基础版 fixture：常规用例每个测试启动独立实例 → `resetConfig()` →
用例用 PO 操作与断言 → 测试结束停止实例并清理 userData。生命周期类用例可手动 `AppFixture.start()`，以覆盖首次运行、窗口常驻等启动状态。Playwright `workers: 1`，固定顺序，无 shuffle。

### 5.1 app_lifecycle.spec.ts — 应用生命周期与窗口管理

- 启动后创建 daemon（隐藏）+ 翻译窗口
- `firstRun` 模式额外自动打开设置窗口；非首次运行不打开
- 窗口复用：重复触发同一窗口 → focus 而非新建（窗口数不增）
- 关闭所有可见窗口后应用进程仍存活（托盘常驻）
- 多窗口并存：翻译 + 词典 + 识别同时打开，互不干扰
- 翻译窗口尺寸为配置值（默认 350×420）
- `Escape` 关闭当前窗口

### 5.2 translate_core.spec.ts — 翻译核心用户路径

模拟用户从五种入口发起翻译，每种都验证：触发 → 源文本就位 → 多服务并行出结果 → 写历史。

- 用户在别处选中文字按划词翻译快捷键（`/trigger-selection`）
- 用户在翻译窗口输入框打字后按 Enter
- 外部脚本通过 HTTP API 发文本（`POST /translate`）
- 用户复制文字、剪贴板监听自动翻译（`clipboard_monitor`）
- 用户截图做截图翻译（截图 → 文字识别 → 翻译，CP4）
- **默认免费翻译服务真实出结果**（覆盖 issue #3）：用户启用 bing / deepl(free) / mymemory 实例 → 在翻译窗口翻译一段文字 → 每张服务卡片都
  显示真实译文，无“翻译失败”；所有无密钥外部服务的逐项连通性由 `external_services.spec.ts` 覆盖
- 翻译成功写入历史；`history_disable=true` 时不写
- `requestId`：用户连续两次翻译，旧结果不覆盖新结果
- 流式服务（如已配置 openai 实例）结果卡片增量更新

### 5.3 translate_titlebar.spec.ts — 翻译窗口标题栏 · issues #4 #8

- 布局：左对齐顺序为 置顶按钮 → 固定按钮 → wordmark → 模式标签；右上角只有关闭按钮
- wordmark 文本为 `Omni Pot`，使用常规字标样式（issue #8）
- 模式标签文本为 `翻译`，无胶囊背景，渲染正常（issue #8）
- **点击固定按钮** → `translate_pinned` 翻转；固定只阻止失焦关闭，不让窗口实际置顶
- **点击置顶按钮** → `translate_always_on_top` 翻转 + 自动开启 `translate_pinned` + 按钮变主色 + 窗口实际置顶；
  再次点击恢复置顶状态（issue #4）
- **点击关闭按钮** → 窗口关闭/隐藏（issue #4）
- 标题栏区域可拖拽（`-webkit-app-region: drag`），按钮区不可拖拽

### 5.4 translate_source_area.spec.ts — 源文本区 · issue #5

- 卡片样式渲染；输入框从 1 行起随内容自动增长，单行高度随用户字号计算，最多显示约 8 行
- 输入超长文本：操作按钮仍可见、不被遮挡，输入框内部滚动出现
- **点击翻译按钮** → 触发翻译、产出结果卡片（issue #5）
- 翻译按钮只有翻译符号、无“翻译”文字、无独立背景，颜色为主色
- 点击去除换行 → 源文本换行被规范化
- 点击朗读 → 配置真实 Edge TTS 服务后触发合成，按钮进入忙碌/播放激活态；再次点击可取消；清空原文会停止朗读
- 点击复制原文 → `readClipboard()` 等于源文本
- 点击清空 → 源文本清空；源文本为空时清空按钮禁用
- 键盘：`Enter` 翻译、`Shift+Enter` 换行、`Escape` 关闭
- IME 组合中（`isComposing`）`Enter` 不触发翻译

### 5.5 translate_result_cards.spec.ts — 结果卡片

- 每个启用的翻译实例渲染一张卡片
- 卡片右上角同一行操作按钮顺序：朗读、复制、收藏、折叠
- **点击朗读** → 配置真实 TTS 服务后按钮进入播放态；再次点击停止播放；音频仍在加载时再次点击不会重复发起 TTS 请求
- **点击折叠** → 卡片主体收起/展开；折叠图标尺寸接近正文
- **点击复制** → 剪贴板为该卡片译文
- **点击收藏** → 触发收藏，无异常
- 卡片出错时显示红色错误文本 + 重试按钮；**点击重试** → 重新翻译该卡片
- 重试按钮仅在出错后出现
- **拖拽排序** → 卡片顺序变化并写回 `translate_service_list`
- 卡片高度足够，主要内容完整可见
- 词典型结果（`DictResult`）渲染发音/释义/例句结构

### 5.6 translate_language_area.spec.ts — 语言区 · issues #6 #7

- 语言区卡片样式，三元素整体居中：源语言 → 转换符号 → 目标语言
- 源语言显示”自动检测”，**不出现** `auto` / `auto detect`（issue #6）
- 目标语言显示”简体中文”，**不出现** `zh_cn` / `ZH`（issue #6）
- 自动翻译后检测标签显示”检测为英文”，**不出现** `EN` / `en`（issue #6）
- 转换符号尺寸已放大
- 点击源/目标语言可打开选择并切换
- 源语言下拉选项只有一个”自动检测”（不重复）
- **目标语言下拉不包含”自动检测”**
- **点击交换按钮** → 源↔目标语言交换（issue #7）
- **点击检测到的语言** → 切换/反转转换方向（issue #7）
- 切换语言后重新翻译，结果与新方向一致
- `hide_language=true` 时语言区隐藏

### 5.7 translate_behavior.spec.ts — 配置联动行为

每项：设配置 → 操作 → 断言行为。

- `translate_close_on_blur`：true 失焦关闭，false 不关闭
- `translate_always_on_top`：true 时窗口置顶生效
- `hide_source`：划词/API/剪贴板翻译时隐藏源文本区；输入翻译强制显示
- `incremental_translate`：true 追加、false 替换
- `translate_delete_newline`：true 时换行被规范化
- `translate_auto_copy`：`source` / `target` / `source_target` / `disable` 四种
- `dynamic_translate`：true 时输入停顿 1s 自动翻译
- `translate_remember_window_size`：resize 后尺寸写入配置
- `translate_remember_language`：重开窗口语言被记住
- 第二语言回退：检测语言 == 目标语言时改用 `translate_second_language`

### 5.8 dict_window.spec.ts — 词典窗口

- `/trigger-dict` 打开词典窗口
- 标题栏：置顶 → wordmark → 模式标签 `词典`，右上角关闭按钮
- 查英文词（`hello`）：**只渲染英文词典**（free_dictionary），断言**不渲染任何中文词典卡片**
- 查中文词：**只渲染中文词典**（chinese_dictionary / ecdict 中文释义），断言**不渲染任何英文词典卡片**
- 查中文词"经济"/"学习"等常用字词：中文词典卡片出现且含真实内容
- 服务分流通过 `data-result-key` 验证：英文查询的卡片 key 均以 `cambridge_dict@` 或 `ecdict@` 开头；中文查询的卡片 key 均以 `chinese_dictionary@` 或 `ecdict@` 开头
- 多词典并行真实出结果：用户启用 free_dictionary / ecdict / cambridge_dict，查英文词后所有英文词典服务渲染含真实内容的卡片
- **无搜索框**：断言窗口内不存在搜索输入框
- **无换行符号**：断言不存在去换行按钮
- **无词形变化卡片**：断言不存在词形变化区块
- **无来源 chips**：断言卡片底部不渲染来源 chips 段
- 窗口高度自适应内容，不留多余空白
- 每个词右上角收藏按钮，**点击** → 触发收藏
- 置顶/关闭按钮可用

### 5.9 recognize_window.spec.ts — 文字识别 / 截图翻译窗口

- 通过截图或 `open-window` 打开窗口；分别覆盖 `recognize` 与 `translate` 两种模式
- 第一排：标题栏模式标签分别为 `文字识别` / `截图翻译`，置顶/关闭可用；**断言整页不出现 "OCR" 字面量**
- 第二排：左图右文 —— 左侧图片卡片显示截图，右侧文本卡片显示识别结果且可编辑；`translate` 模式右侧多一张翻译卡片，与识别卡背景/字色/标签视觉一致
- 第三排操作区交互（文字识别模式按钮顺序：`复制图片 → 识别引擎下拉 → 重新识别 → 自动检测 | 翻译 → 去除换行 → 去除空格 → 复制 → 导出`；截图翻译模式按钮顺序：`复制图片 → 识别引擎下拉 → 重新识别 → 自动检测 → 转换符号 → 简体中文 → 重新翻译 | 去除换行 → 去除空格 → 复制 → 导出`）：
  - **复制图片** → 剪贴板包含图片
  - 识别引擎下拉 → 切换服务
  - 语言下拉（自动检测 / 简体中文）使用 pill 样式，下拉项**不带 AUTO/ZH 字母前缀**，可切换
  - **重新识别 / 重新翻译**为**带文字 pill 按钮**（非纯图标） → 点击重跑
  - **去除换行** → 结果换行被去除
  - **去除空格** → 结果空格被去除
  - **复制** → 剪贴板为识别文本
  - **导出**为导出符号（非云符号），下拉含 md/txt/docx/doc
  - **翻译按钮**（仅文字识别模式，位于"去除换行"左侧） → 文字送到翻译窗口并触发翻译
- 信息精简：断言**不显示**图片尺寸、类型、识别字数、耗时
- 服务真实覆盖：用户切换 system / tesseract 引擎；Tesseract 重新识别得到真实识别文本
- `recognize_delete_newline` / `recognize_auto_copy` 配置联动

### 5.10 screenshot_window.spec.ts / screenshot_latency.spec.ts — 截图窗口

- `screenshot_latency.spec.ts`：触发截图后 SCREENSHOT 窗口应在 300ms 内可见，用于守护截图 OCR 唤起卡顿回归
- 触发截图 → 创建全屏 SCREENSHOT 窗口，全屏且置顶
- 屏幕图像作背景，其上有半透明遮罩
- 鼠标拖拽创建选区 → 出现主色描边、四角句柄、尺寸标签
- 顶部提示条文本：拖动选取区域 / Enter 确认 / Esc 取消
- `Enter` 或鼠标释放 → 裁剪并关闭窗口，产出图片
- `Esc` 或右键 → 取消关闭，无产出
- 截图完成后衔接识别（mode=recognize）/ 翻译（mode=translate）流程
- CI 无显示器时：跳过真实截屏断言，保留窗口创建与 Esc 取消路径

### 5.11 config_settings.spec.ts — 设置：通用/翻译/文字识别/快捷键/关于

- 侧栏：logo + 8 个导航项 + 版本号；**侧栏不含置顶 / 固定按钮**
- 顶栏：软件名 + 当前页面名 + 最小化/最大化/关闭三件套，**无置顶 / 固定按钮**
- 点击各导航项切换页面，激活项高亮、图标主色
- **通用页**：界面语言归"应用"卡片；外观卡片含主题/主色/文字（字体+字号）/透明/托盘点击行为；应用卡片含 API 端口/开机自启/检查更新
  逐项读写 → 断言 `config.json` 持久化
- **翻译页**：语言、行为、窗口三组卡片逐项读写持久化；语言下拉项以**该语言自身文字**显示（English / 日本語 / ...），不带 AUTO/ZH 字母前缀
- **文字识别页**：识别语言、去换行、自动复制、失焦关闭、隐藏窗口读写
- **快捷键页**：**4 个录入框**（翻译 / 词典 / 文字识别 / 截图翻译）；翻译行 UI 上同时绑定 `hotkey_selection_translate` 与 `hotkey_input_translate`；按钮在未绑定时显示"绑定"、已绑定显示"解绑"（**不出现 × 清除按钮**）；录入组合键、Backspace 清除、绑定按钮注册成功/失败提示；快捷键冲突提示出现在状态细节区域而非常驻在本页；**录入互斥**：点击翻译"绑定" → 点击词典"绑定" → 翻译自动退出录入态，词典进入录入态；绑定成功后**无"绑定成功"文字提示**
- **关于页**：版本号、官网/文档/反馈/检查更新链接、诊断信息（日志/设置目录、API 地址）
- **config:changed 广播**：设置窗口改 `app_theme` → 翻译窗口主题同步变化

### 5.12 config_service_mgmt.spec.ts — 服务管理页

- Tabs 切换**翻译 / 中文词典 / 英文词典 / 文字识别 / 语音朗读 / 收藏** 六类
- 服务实例列表项渲染：拖拽手柄、图标、实例名、key、启停、编辑、上移/下移、删除
- **添加内置服务** → 创建新实例（key 形如 `bing@xxxx`），出现在列表与 `*_service_list`
- **删除实例** → 从列表与 `*_service_list` 移除，并同步删除 `service_instances` 项
- **启停实例** → `service_instances[instanceKey].config.enable` 翻转；翻译窗口结果卡片只显示启用实例
- **编辑/测试保存实例** → 输入实例名与 JSON 设置，点击测试显示成功/失败，保存后设置持久化并更新列表名称
- **拖拽排序** → `*_service_list` 顺序更新，翻译窗口结果卡片顺序随之变化

### 5.13 config_history_backup.spec.ts — 历史页 + 备份页

历史页：

- 翻译产生记录后，历史列表显示（图标、源文本、语言、译文、时间）
- 分页翻页正常
- 点击行打开详情，编辑源文本/译文并保存 → 持久化
- 清空 → 列表空、`history.count()` 为 0
- `history_disable=true` 时翻译不写历史

备份页：

- 备份目标切换 WebDAV / 本地；断言**无”阿里云盘”**选项（见 `docs/design/demo_todo.md` A4）
- 本地备份 → 生成 zip，列表列出
- 恢复 → 配置与历史记录被覆盖
- 备份内容含设置与 CC-CEDICT 数据库

### 5.14 external_services.spec.ts — 外部服务真实连通性

- 默认跳过；设置 `OMNI_POT_EXTERNAL_SERVICE_TESTS=1` 后运行真实公共服务检查
- 覆盖无密钥外部服务：Bing、Google、DeepL 免费模式、MyMemory、Cambridge、Free Dictionary、Edge TTS
- 不使用 route/mock；公共服务不可达时测试应失败并暴露具体服务

### 5.15 updater_and_tray.spec.ts — 更新器 + 托盘

更新器（用 `/e2e/mock-update` 注入假版本）：

- 打开更新器窗口，标题栏 `更新`
- 渲染版本对比、发布日期、更新日志和下载链接
- “稍后提醒”关闭窗口；“查看详情”按钮存在且可用

托盘：

- 菜单项触发：Input Translate → 打开翻译窗口；Clipboard Monitor → 切换
  `clipboard_monitor` 并在复制文本后自动翻译；Settings → 打开设置窗口
- 左键点击：`tray_click_event` 为 `show_config` / `show_translate` / `none` 时行为正确

### 5.16 i18n.spec.ts — 国际化

- 切换 `app_language`（en ↔ zh_cn）→ 所有已打开窗口 UI 文案即时切换，无需重启
- 中文下关键文案正确：自动检测、简体中文、检测为英文、各设置页标签、托盘项
- 英文下对应英文文案
- 回退链：未翻译的 key 回退到默认语言

---

## 6. 测试编写规范

### 6.1 断言策略

- **基于语义状态，不基于 DOM 字符串**：用 PO 方法（`isPinActive()`、
  `getDetectedLanguageLabel()`）返回语义值再断言，不在测试里写
  `textContent.includes(...)`。
- **测真实交互**：点按钮用 `clickSelector` 派发真实鼠标事件；不调 `electronAPI` 绕过 UI。
- **正反都测**：如置顶按钮，既测点击后置顶生效，也测再次点击后恢复。

### 6.2 等待与超时

- 禁止裸 `setTimeout` 当“等渲染”。一律用 `waitForSelector` / `waitForText` /
  `waitFor(condition)` 显式等待条件。
- 超时分级：UI 渲染 5s；本地操作 8s；网络翻译 45s；TTS 合成 60s；OCR 60s。
- flaky 来源（截图、OCR、网络服务）用 `retry(fn, 3)` 包装，并打印每次失败原因。

### 6.3 隔离

- 文件级：每个 spec 独立 Electron 实例 + 独立 userData。
- 用例级：`beforeEach` 调 `resetConfig()` 恢复默认配置、关闭多余窗口、清空历史。
- 不依赖用例间顺序，不共享可变状态。

### 6.4 真实环境 vs 桩

- 全部测试模拟真实用户操作，免费服务在”用户翻译/查词/识别”流程中被真实调用。
- 付费服务（需密钥）E2E 不覆盖，由单元测试 mock。
- 更新检查：`/e2e/mock-update` 注入假”有新版本”数据，避免依赖真实 GitHub release ——
  这只是数据桩，用户操作（点更新器按钮）仍是真实的。
- 截图/OCR：真实路径优先；CI 无显示器时降级为窗口创建与取消路径。

### 6.5 本地可控 HTTP 服务策略

> 用于需要控制服务响应时序或内容的 UI 状态测试（loading、retry、长文本布局、
> 动态翻译 debounce、历史写入等）。**不用于替代真实外部服务连通性测试**。

- 启动本地 HTTP test server（Node.js `http.createServer`），提供 MyMemory
  兼容响应格式。
- 通过 E2E config 或环境变量将服务 base URL 指向本地 test server，
  让应用照常走真实 service adapter 和真实 HTTP 请求。
- 响应控制：
  - loading 测试：本地服务保持请求挂起（不释放响应），断言 loading UI；
    释放响应后断言结果展开。
  - retry 测试：本地服务第一次返回 500，第二次返回 200，
    断言 retry 后真实重新请求并渲染成功结果。
  - 长文本 / 卡片高度测试：本地服务返回固定长文本，断言布局高度、滚动和折叠行为。
  - 动态翻译 debounce 测试：本地服务记录请求次数和请求 body，
    断言停止输入后只发一次最终文本请求。
  - 历史写入测试：本地服务返回固定译文，真实点击翻译后打开历史页验证记录。
- 旧的 `fulfill_*_translation_once`（Playwright route.fulfill）属于 stub，
  逐步替换为本地 HTTP 服务。暂时保留的 stub 测试名称必须包含 `stubbed` 或注释说明只测 UI 状态。

---

## 7. 运行与 CI

### 前置准备

```bash
npm install
npm run build:chinese-dict   # 生成 chinese_dict.db（词典相关 E2E 测试依赖）
npm run build:cc-cedict      # 生成 cc_cedict.db（词典相关 E2E 测试依赖）
```

> 词典 DB 不提交到仓库（gitignored）。`npm run dist` 自动运行上述两步；
> 纯 E2E 测试路径需手动运行一次。词典 E2E spec 在 DB 缺失时直接报错并提示运行命令。

### 运行命令

`package.json` 脚本：

```
test:e2e            # 全部 spec（Playwright full project）
test:e2e:core       # @core 标签（app_lifecycle + translate_core），PR 快速门禁
test:e2e:ui         # @ui 标签（translate_* + dict + recognize + screenshot + config_*）
test:e2e -- <file>  # 单文件调试
```

### 可选：外部服务连通性测试

```bash
OMNI_POT_EXTERNAL_SERVICE_TESTS=1 npx playwright test tests/user_e2e/specs/external_services.spec.ts
```

> 默认跳过。设置 `OMNI_POT_EXTERNAL_SERVICE_TESTS=1` 后运行真实公共服务检查。
> CI nightly 跑此项；PR 不跑。

### CI 策略

- Playwright 当前由 fixture 为每个测试启动独立 Electron 实例、独立端口、独立 userData。
- Playwright `workers: 1`，用例固定顺序执行。
- `globalSetup` 在每次 Playwright 命令开始时执行一次 `electron-vite build`，避免旧 `out/` 产物。
- CI：PR 跑 `core + ui`；nightly 跑 full（含外部服务连通性）。
- issues #1（better-sqlite3 缺失）、#2（双击两次启动）属打包/启动问题，
  E2E 难直接覆盖 → 使用 `npm run dist:dir` 生成 unsigned unpacked 包做本地 smoke 验证，
  或 CI 单独加“打包产物启动验证”作业
  （打包 → 启动安装好的应用 → 模拟用户完成一次完整翻译）。

---

## 8. issues.md 对应关系

| issue | 描述 | 对应 spec |
|---|---|---|
| #1 | better-sqlite3 模块缺失 | 打包配置 + `npm run dist:dir` / CI 打包启动验证 |
| #2 | 双击两次才启动 | `npm run dist:dir` / CI 打包启动验证（E2E 难直接覆盖） |
| #3 | Bing 翻译失败 | `translate_core.spec.ts`（全部免费翻译服务用例） |
| #4 | 置顶/关闭按钮失效 | `translate_titlebar.spec.ts` |
| #5 | 翻译按钮点击无效 | `translate_source_area.spec.ts` |
| #6 | `zh_cn` / `auto detect` 未中文化 | `translate_language_area.spec.ts` |
| #7 | 点击检测语言切换方向 | `translate_language_area.spec.ts` |
| #8 | wordmark 样式 / 模式标签背景 | `translate_titlebar.spec.ts` |

---

## 9. 实施路线

1. **基础设施先行**：`playwright.config.ts` / `electron_app` fixture / `app_fixture` /
   `e2e_api` / 多窗口 Page Object，以及源码侧 `data-testid`、E2E 端点扩充、
   独立 userData 支持（第 4.5 节）。
2. **P0 守护已知 bug**：`translate_titlebar` / `translate_source_area` /
   `translate_language_area` / `translate_core`（免费服务用例）—— 直接覆盖 issues #3–#8。
3. **P1 核心窗口**：`translate_core` / `translate_result_cards` / `dict_window` /
   `recognize_window` / `config_settings`。
4. **P1 行为与窗口**：`translate_behavior` / `screenshot_window` / `app_lifecycle`。
5. **P2 管理类**：`config_service_mgmt` / `config_history_backup` /
   `updater_and_tray` / `i18n`。
6. 旧 Vitest + CDP E2E 文件已删除；后续只扩展 Playwright spec。
