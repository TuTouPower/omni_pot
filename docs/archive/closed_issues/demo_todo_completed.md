# demo_todo 已完成项目记录

> 来源：`docs/demo_todo.md`（已拆分归档）
> 归档日期：2026-06-12

以下项目已验证在代码中完成：

## 已确认完成

- **1.1 翻译结果卡片移除"收藏"按钮** — translate 窗口中无 Heart 按钮
- **1.2 结果卡片中的收藏按钮同步移除** — 同上
- **2.1 POS tag 隐藏** — `dict/index.tsx:359` `hidePosTag={is_zh_dict}`
- **2.2 源词卡片操作栏只保留复制+查询** — `dict/index.tsx:323-339` 仅 Copy + Type 两个按钮
- **3.1 服务设置移除"收藏"Tab** — config 中无收藏/favorite 相关代码
- **3.4 通用页隐藏字体/字号设置** — `general.tsx` 外观卡片仅含主题选择
- **3.5 历史页补上"全部时间"筛选项** — `history_settings.tsx:18` `{ value: 0, labelKey: 'history.all_time' }`

## 备注

未完成及未验证项目已移入 `docs/TASKS.md`。
