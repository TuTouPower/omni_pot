# 翻译窗口尺寸与滚动改造 设计文档

- **日期**:2026-05-24
- **状态**:已确认,待实现计划
- **作用域**:Omni Pot 翻译主窗口(`src/windows/translate/*`、`electron/windows/translate_options.ts`、相关 IPC)

## 1. 目标

改造翻译窗口的尺寸、滚动与可调性行为:

1. 输入框 textarea 的滚动条变细、颜色变淡;同样规则应用到结果区滚动条。
2. 翻译窗口的最大高度 = 当前显示器工作区高度的 3/4(`MAX_HEIGHT_RATIO = 0.75`)。
3. 结果区在无任何引擎返回时折叠不显示;每个引擎返回后对应卡片出现,窗口高度立即扩张(N 个引擎产生 N 次扩张)。
4. 当内容总高度 > 窗口最大高度时:窗口锁定在最大高度,结果区内部出现滚动条;**滚动时输入区固定在窗口顶部不动,只有结果卡片滑动**。
5. 用户拖拽改变窗口**宽度**时,内部所有内容(输入框、卡片)宽度跟随变化;**禁止用户调整窗口高度**,高度完全由应用逻辑控制。
6. 宽度只限制最小值(`MIN_WIDTH`,初定 360px),无最大值。
7. 输入框 textarea 自动增长,最多 8 行,超出后 textarea 内部滚动,窗口高度不再因输入文字而增加。

## 2. 架构

### 职责划分

```
┌────────── 渲染进程 (translate window) ──────────┐
│ <Layout>                                         │
│  ├─ <LanguageArea>                               │
│  ├─ <SourceArea>   (textarea 自动增长 1..8 行)  │
│  ├─ <ActionBar>                                  │
│  └─ <ResultsScroll> (overflow-y:auto)            │
│       └─ <TargetArea> × N                        │
│                                                  │
│ use_content_height() hook:                       │
│   ResizeObserver 监测 #app 自然高度              │
│   rAF 合批 → IPC 上报 'translate:report-content- │
│   height' { content_height }                     │
└──────────────────────────────────────────────────┘
                       │
                       ▼
┌────────── 主进程 ────────────────────────────────┐
│ on('translate:report-content-height'):           │
│   work_area = screen.getDisplayMatching(bounds)  │
│                      .workArea                   │
│   max_h     = floor(work_area.height * 0.75)     │
│   target_h  = clamp(content_height, min_h, max_h)│
│   if (win.getBounds().height === target_h) return│
│   win.setMinimumSize(MIN_WIDTH, target_h)        │
│   win.setMaximumSize(0, target_h)                │
│   win.setBounds({ height: target_h })            │
└──────────────────────────────────────────────────┘
```

### 关键设计点

- **唯一可信源**:主进程持有"当前应有窗口高度",渲染端只汇报内容高度。
- **高度锁定**:`setMinimumSize` 与 `setMaximumSize` 的高度分量设为同一个 `target_h`,宽度上界设为 0(Electron 约定:0 = 无限制),从而宽度可调、高度固定。`BrowserWindow.resizable` 保持 `true`(否则宽度也不能拖)。
- **多显示器**:每次重算时通过 `screen.getDisplayMatching(win.getBounds()).workArea` 取当前显示器的工作区,适应多屏/DPI 变化。
- **节流**:渲染端用 rAF 合并 ResizeObserver 回调,差异 < 1px 时不汇报;主进程对相同 `target_h` 做幂等判断。

## 3. 布局与交互

### 结构层级

```
#app  (display:flex, flex-direction:column, height:auto)
 ├─ <LanguageArea>          固定高度,顶部
 ├─ <SourceArea>            高度自适应(textarea 1..8 行)
 │   └─ <textarea>          自动增长,>8 行内部滚动(.thin-scroll)
 ├─ <ActionBar>             翻译/清空/朗读等按钮行
 └─ <ResultsScroll>         flex:1, overflow-y:auto, min-height:0, .thin-scroll
      └─ <TargetArea>[]     每张卡片 = header + body
           ├─ header        引擎名 + 朗读 + 复制 + 折叠按钮(默认 1 行)
           └─ body          翻译文本,可折叠
```

### 结果区行为

- 无任何引擎返回时:`ResultsScroll` 不渲染(`display:none` 或条件渲染),窗口高度 = LanguageArea + SourceArea + ActionBar。
- 引擎返回时,对应 `<TargetArea>` 出现;卡片至少展示 header 一行,有翻译文本则 body 展开。
- 用户在 header 点折叠 → body 隐藏,但 header 仍占一行。
- 多引擎卡片纵向堆叠在 `ResultsScroll` 内。

### 滚动行为

- 当 `content_height > max_h`:主进程把窗口锁定在 `max_h`;`ResultsScroll` 在 flex 容器中自然分配剩余高度(`flex:1 + min-height:0`)并自身溢出滚动。
- `SourceArea` 永远在窗口顶部不参与滚动,滚动条只出现在 `ResultsScroll` 内。

### 宽度变化响应

- 所有内部块使用 `width:100%` / flex 自适应。
- 卡片 body 文本采用 `white-space:pre-wrap; word-break:break-word`,宽度变化后自动重排。
- 宽度变化触发 ResizeObserver → 内容高度可能变化 → 重新汇报 → 主进程重算高度(典型:变窄 → 文本换行更多 → 高度上限内增加)。

### 滚动条样式

全局 utility class `.thin-scroll`(放入 Tailwind plugin 或全局 CSS):

```css
.thin-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.thin-scroll::-webkit-scrollbar-track { background: transparent; }
.thin-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}
.thin-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.30);
}
```

应用于:textarea(`SourceArea`)、`ResultsScroll`、若卡片 body 自身溢出也加上。

### 窗口可调性

- `BrowserWindow.resizable = true`(必须 true 才能拖宽)。
- 通过同步设置 `minimumSize.height === maximumSize.height === target_h` 模拟"高度不可调";每次目标高度变化时同步更新。
- 视觉折中:Electron 在边角仍可能显示斜向 resize 光标,但实际拖动不会改变高度。接受此折中(若日后需要消除,可在 frameless 自定义边框中只暴露左右两边的 resize 区)。

## 4. 错误处理与边界场景

### 节流与抖动防护

- 渲染端 ResizeObserver 回调 → `requestAnimationFrame` 合批,差异 < 1px 直接丢弃。
- 主进程:相同 `target_h` 直接 return(`win.getBounds().height === target_h`)。
- 屏幕切换:`win.on('move')` 防抖 100ms 后重算 `max_h`;若超出新显示器 75vh,缩回新的 `max_h`。

### 边界场景

| 场景 | 处理 |
|---|---|
| 首次打开窗口 | 初始 `target_h = LanguageArea + SourceArea(1 行) + ActionBar` |
| 引擎报错返回 error 卡片 | error 文本占用 body,与正常卡片同样参与高度计算 |
| 卡片折叠/展开 | 触发 ResizeObserver → 标准重算流程 |
| 清空输入,结果卡片消失 | `content_height` 减小 → 主进程缩回最小高度 |
| 流式输出(分片到达) | 每片 → ResizeObserver → rAF 合批,呈现"平滑增长" |
| 最小化后恢复 | 监听 `win.on('restore')` 立即重算 |
| 显示器分辨率变化 | 监听 `screen.on('display-metrics-changed')` 重算 |
| 跨显示器拖拽窗口 | `win.on('move')` 防抖重算 `max_h` |

## 5. 常量

| 名称 | 值 | 说明 |
|---|---|---|
| `MIN_WIDTH` | 360 | 窗口最小宽度(像素) |
| `MIN_HEIGHT_INPUT_LINES` | 1 | textarea 最少行数 |
| `MAX_HEIGHT_INPUT_LINES` | 8 | textarea 最多行数,超出内部滚动 |
| `MAX_HEIGHT_RATIO` | 0.75 | 窗口最大高度占当前显示器 `workArea.height` 比例 |
| `HEIGHT_REPORT_DEBOUNCE_PX` | 1 | 内容高度差小于此值不上报 |
| `SCREEN_MOVE_DEBOUNCE_MS` | 100 | 跨显示器移动后重算的防抖时间 |

## 6. IPC 协议

| Channel | 方向 | 载荷 | 说明 |
|---|---|---|---|
| `translate:report-content-height` | renderer → main | `{ content_height: number }` | 渲染端汇报当前内容自然高度 |

## 7. 测试

### 单元测试

- `compute_target_height(content_h, work_area_h, min_h)` 纯函数:覆盖 `< min`、`> max`、跨界、边界值。
- `count_textarea_lines(text)` → 行数 → 像素高度封顶 8 行。

### e2e 测试(`tests/user_e2e/translate_window_resize.spec.ts`)

1. 打开翻译窗口,断言初始高度 ≈ 输入区 + 顶/底 chrome 高度。
2. 输入 3 行文本,断言窗口高度增长且 textarea 显示 3 行。
3. 输入 12 行,断言 textarea 高度封顶 8 行,内部出现滚动条,**窗口高度不再增长**。
4. 模拟两个引擎依次返回,断言窗口分两次扩张,最终高度 = 输入 + 两张卡片。
5. 模拟超长结果使总高度 > 75vh,断言窗口锁定在 `floor(workArea.height * 0.75)`,`ResultsScroll` 出现滚动条;滚动时 `SourceArea` 视觉位置不动。
6. 拖宽窗口宽度,断言成功;尝试拖高,断言 `getBounds().height` 与拖动前一致。
7. 清空输入与结果,断言窗口缩回初始高度。

## 8. 文档同步

实现完成后必须更新:

- `docs/spec.md` 翻译窗口章节:补充窗口尺寸策略、滚动行为、可调性约束。
- `CLAUDE.md`(若有窗口尺寸约定段落)。
- `TASKS.md` 记录本次改造完成状态。

## 9. 已知风险

- **跨平台高度锁定差异**:`setMinimumSize`/`setMaximumSize` 同值在 Windows DPI 缩放下可能出现 ±1px 偏差,需 Win11 实测 e2e。
- **流式翻译高频重算**:引擎极快时分片连续触发,通过 rAF + 1px 阈值 + 幂等判断压制。
- **resize 光标视觉**:边角仍可能显示斜向 resize 光标;接受此折中,不在本次改造中投入资源消除。

## 10. 非目标(明确不做)

- 不实现窗口最大宽度限制(用户拖多宽都行)。
- 不在本次改造中重设计卡片内部样式、配色、排版,仅改变其尺寸/滚动行为。
- 不改造其他窗口(截图、词典、设置等)的尺寸策略。
- 不增加用户可配置项(MAX_HEIGHT_RATIO 等常量内置)。
