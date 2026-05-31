# 交接：DeepL 目标语言 fallback 残留 bug（2026-05-31）

## 现象（用户复现）

- 在翻译窗口输入 `面条`（或任何中文短词），DeepL 返回 `面条` 原文，没有翻成英文。
- 其它服务（Bing/Google 等）行为待确认；DeepL 一定能复现。
- 不是 DeepL 服务本身的 bug：是 **renderer 传给 DeepL 的 target 语言就是 `zh_cn`，DeepL 收到 zh→zh 当然返回原文**。

## 日志证据

文件：`%APPDATA%\omni_pot\logs\main.log`

关键两行（08:22:22 那一次翻译）：

```
[2026-05-31 08:22:22.347] [info]  (renderer:translate)  translate start: src=auto→zh_cn, len=2, services=4
[2026-05-31 08:22:22.352] [info]  (renderer:translate)  detected language: zh_cn
```

- `src=auto→zh_cn`：用户 source=auto, target=zh_cn（来自 config `translate_target_language`）
- `detected language: zh_cn`：cld3 把"面条"正确识别成中文
- **应该发生**：renderer 判定 `detected == target`，fallback 到 `translate_second_language`（默认 `en`），把 `en` 传给 DeepL
- **实际发生**：fallback 没生效，传给 DeepL 的还是 `zh_cn`

⚠️ 当前 build 里**没有 effectiveTarget 日志**，看不到实际传给 service 的最终 target。下一步需要加 log 重启确认（我在 `src/windows/translate/index.tsx:158` 加了一行 `log.info('resolve target: ...')`，但**还没 rebuild、还没 commit**）。

## 相关 commit 历史（按时间）

| commit | 日期 | 说明 | 关键文件 |
|---|---|---|---|
| `77618b0` | 05-30 08:24 | **引入** `lockedTargetLanguage`：auto fallback/swap/手动选 target 都加锁；新输入/新截图重置锁。意图是 zh_cn→en fallback 后，用户手动改 source language 不会重新计算 target。 | `translate_store.ts`, `translate/index.tsx`, `recognize/index.tsx` |
| `75ba378` | 05-30 23:00 | 全 revert `77618b0`（commit msg 未说明原因） | 同上 |
| `ca915c4` | 05-30 23:01 | reapply `77618b0`（代码与 77618b0 完全相同） | 同上 |
| `c386b57` | 05-30 23:04 | 修 config 加载误锁：`setTargetLanguage` 不再加锁，加锁逻辑移到 `LangPick` 的 onChange（用户手动切换才锁） | `translate_store.ts`, `language_area.tsx` |
| `9b37a10` | 05-31 00:18 | **本次会话修复**：`setSourceText` 重置 `lockedTargetLanguage` 和 `effectiveTargetLanguage`。意图是新输入清锁。 | `translate_store.ts` 唯一一行改动 |
| `cb89e99` | 05-31 00:?? | 词典窗口动态高度（无关） | dict 模块 |
| `89c9781`, `2b2bbf1`, `bd2023b`, `b53156c` | 05-31 | 4 个测试 commit（无关） | tests |

**重要观察**：`9b37a10` 只改了 store（`setSourceText` reducer 加 `lockedTargetLanguage: null`）。这只解决了 store 状态，**没解决 `handleTranslate` 闭包问题**（见下）。

## 怀疑的真实 bug

`src/windows/translate/index.tsx:134-247` 的 `handleTranslate`：

```ts
const handleTranslate = useCallback(async (textOverride?) => {
    // ...
    let effectiveTarget = lockedTargetLanguage ?? targetLanguage   // ← 闭包变量
    if (!lockedTargetLanguage && sourceLanguage === 'auto' && detected && detected === targetLanguage) {
        effectiveTarget = secondLanguage as LanguageCode
    }
    // ...
}, [sourceLanguage, targetLanguage, lockedTargetLanguage, ...])
```

`lockedTargetLanguage` 是从 Zustand subscribe 来的 React 渲染态，被 useCallback 闭包**捕获**。

**问题流程**（推测，需 log 验证）：

外部触发翻译时（例如剪贴板/划词/`schedule_translate(text)`）：

1. IPC 回调收到新文本
2. `setSourceText(nextText)` 同步更新 store：`locked=null`, `requestId++`
3. `schedule_translate(nextText)` → `setTimeout(0, handleTranslate)`
4. React commit 阶段：subscribe 触发 re-render，新的 `handleTranslate` useCallback 闭包捕获 `locked=null`
5. setTimeout 触发：调用**当时被 schedule_translate 闭包捕获的 handleTranslate** —— 这是 **setSourceText 之前**渲染的版本，捕获的 `locked` 仍是旧值（如 `zh_cn`）
6. handleTranslate 用旧 `locked='zh_cn'` → `effectiveTarget = 'zh_cn'`，**fallback 分支被 `!lockedTargetLanguage` 守卫挡掉**
7. `service.translate(text, auto, 'zh_cn', config)` → DeepL 返回原文

**关键根因**：handleTranslate 应该从 `useTranslateStore.getState()` 取**最新**的 `lockedTargetLanguage`（和 `targetLanguage` 等），而不是从闭包变量。

类似 `handleRetry`（同文件 469 行）已经用 `useTranslateStore.getState()` 取所有状态，没这个问题；`handleTranslate` 是少数还在用闭包变量的地方。

## 什么场景会触发

需要 **lockedTargetLanguage 在某次翻译中被设置过** + **下一次翻译的 source 是从外部路径进来的（不是 SourceArea 直接输入）**：

| 操作 | 是否触发 |
|---|---|
| 启动后第一次输入"面条"按回车 | **可能不触发**（locked 初始 null） |
| 先输入 "hi" 翻译 → detected=en, target=zh_cn → effectiveTarget=zh_cn → **不设 locked**（fallback 没触发） → 再输入"面条" | 可能不触发 |
| 先输入 "你好" 翻译 → detected=zh_cn, fallback 到 en, **setLocked('en')** → 再输入"面条" | setSourceText 重置 locked=null，但 handleTranslate 闭包可能还是旧值，**触发** |
| 划词/剪贴板/快捷键带文本进窗口 | **更易触发**（schedule_translate 路径有 setTimeout，闭包/re-render 时序问题更明显） |
| swapLanguages 调用过（也会 setLocked） → 后续任何翻译 | 易触发 |

用户最可能的场景：先翻译过别的东西（任意触发过 setLocked 的路径），再翻译"面条"。"面条"不特殊，任何 detected==当前 target 的输入都会复现。

## 已做但还没 commit 的改动

- `src/windows/translate/index.tsx:158` 加了一行 log（仅诊断用）：
  ```ts
  log.info('resolve target: locked=%s target=%s detected=%s second=%s → effective=%s',
      lockedTargetLanguage ?? '-', targetLanguage, detected ?? '-', secondLanguage, effectiveTarget)
  ```
- 没 rebuild，没 commit。

## 下一步建议

1. **加 log 重启复现一次**：跑 `npm run dist`，复现"面条"→DeepL 返回原文，看日志里 `resolve target` 行的 `locked=?` 和 `effective=?`。如果 `locked=zh_cn effective=zh_cn` → 印证上面闭包假设；如果 `locked=- effective=zh_cn` → 是另一种 bug（detected 没匹配上之类），重新分析。
2. **如果印证闭包问题**：把 `handleTranslate` 内部所有 `sourceLanguage`/`targetLanguage`/`lockedTargetLanguage` 改成 `useTranslateStore.getState()` 现取（仿 `handleRetry`），useCallback deps 相应削减。同时回退 useEffect [sourceLanguage, targetLanguage, sourceText, handleTranslate] 里对 handleTranslate 引用的依赖（用 ref 模式）。
3. **加单测**：在 `tests/unit/windows/`（或 store 测试里）模拟"先一次 fallback 锁定 → setSourceText 新输入 → 再翻译"的序列，断言 fallback 再次生效。当前测试 `tests/unit/stores/test_translate_store.ts` 的 "Bug 2 regression" 只测了 store reducer，没测 handleTranslate 的真实路径。
4. **回归测**：`tests/user_e2e/specs/translate_*` 是否覆盖了"中文输入 + auto + target=zh_cn → 期望 fallback 到 en"的场景？没覆盖就补一个 e2e。

## 相关文件速查

| 文件 | 关注点 |
|---|---|
| `src/stores/translate_store.ts:50` | `setSourceText` 重置 locked（commit 9b37a10） |
| `src/stores/translate_store.ts:63-83` | `swapLanguages` 设置 locked |
| `src/stores/translate_store.ts:54-56` | `setTargetLanguage` **不**设置 locked（commit c386b57） |
| `src/windows/translate/language_area.tsx` | `LangPick onChange` 设置 locked |
| `src/windows/translate/index.tsx:134-247` | `handleTranslate` — 怀疑点 |
| `src/windows/translate/index.tsx:469-528` | `handleRetry` — 正确模式参考 |
| `src/windows/translate/index.tsx:263-269` | `schedule_translate` — 外部触发路径 |
| `src/services/deepl.ts:197-252` | DeepL `translate(text, from, to, config)` — 透传 `to`，无锅 |
| `shared/types/config.ts:116` | `translate_second_language` 默认 `en` |
| `%APPDATA%/omni_pot/config.json` | 用户实际 config |
| `%APPDATA%/omni_pot/logs/main.log` | 翻译日志 |

## TASKS.md 状态

`TASKS.md` 里 "Bug 2: DeepL 翻译返回原文" 已被本会话标成"已修复 commit 9b37a10"。**这个标注需要回退**（bug 没真正修复，只修了浅表症状）。
