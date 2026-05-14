# omni_pot 项目约定

## 项目背景

- 本项目基于新技术栈（Electron + React + TypeScript）重写 pot-desktop，实现其全部功能。
- `docs/old_pot/spec.md` 是 pot-desktop 3.0.7 的旧规格，原开发者已不再维护、技术老旧，
  仅作**功能蓝本**参考，代码无直接利用价值。
- `~/karson_ubuntu/new_pot` 是修好 bug 的 clone 版本，作为**参考项目**；
  不知道某功能怎么实现时可以看它的代码。

## 文档索引

`docs/` 下文档**按需查阅**，不要全部加载到上下文。各文档作用：

| 文档 | 作用 |
|---|---|
| `docs/spec.md` | **产品规格** — omni_pot 功能、窗口、服务、配置的权威定义 |
| `docs/design/ui_design.md` | 全部窗口的 UI 设计需求 |
| `docs/design/example/` | UI 设计稿原型（HTML/JSX/CSS） |
| `docs/design/example_todo.md` | example 设计稿与 spec 的差异及处理决定 |
| `docs/test.md` | 测试规范与总则（分层、原则、快捷键策略、运行命令） |
| `docs/test_user_e2e.md` | 用户端到端测试设计（基础设施、文件规划、各 spec 内容） |
| `docs/issues/issues.md` | 已知问题记录 |
| `docs/issues/closed/` | 已关闭的问题记录 |
| `docs/external_services/` | 外部服务 API 信息与连通性测试结果 |
| `docs/old_pot/spec.md` | pot-desktop 3.0.7 旧规格（历史参考，不代表当前实现） |
| `docs/superpowers/` | 早期重写设计与分阶段计划（历史参考，不代表当前实现） |
| `docs/code_quality_checks_plan.md` | 代码质量检查体系落地方案 |
| `PLAN.md` | 开发待办与下一步 |

## 测试要求

测试要做完好的单元测试、集成测试、端到端测试，尽量少用 mock，多用真实环境，
保证测试覆盖 SPEC 的所有功能、所有 UI。详见 `docs/test.md`。

## 文档同步

每次修改代码后，检查 `docs/` 与本文件中是否有受影响的文档，一并更新，
保证文档与代码始终一致，不出现过时描述。
