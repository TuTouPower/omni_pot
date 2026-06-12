# 发布流程

## 仓库结构

| 仓库 | 地址 | 可见性 | 用途 |
|---|---|---|---|
| 源码仓库 | `https://github.com/TuTouPower/omni_pot` | 私有 | 开发、CI、测试 |
| 发布仓库 | `https://github.com/TuTouPower/omni_pot_release` | 公开 | 对外发布 release |

本地 git remote 配置：

- `origin` → 私有源码仓库
- `release` → 公开发布仓库

## 发布步骤

### 1. 确定版本号

版本号定义在 `package.json` 的 `version` 字段，遵循 semver。

发布前确认版本号已更新。

### 2. 本地发布

```bash
npm run release:publish
```

脚本会运行 `npm run dist`，生成 `build/release/latest.json`，在源码仓库和公开发布仓库分别创建或复用 `v{VERSION}` release，上传 GitHub Release 产物到两个仓库，并同步 Cloudflare R2。同步 R2 时会先上传并读回校验当前 `latest/` 文件，再切换 GitHub 与 R2 的 `latest.json`，最后删除旧 `latest.json` 指向、且不在当前版本 manifest 里的 `omni-pot/latest/` 对象；Wrangler CLI 不能枚举对象，手工散落对象需要人工删除。

可选参数：

| 参数 | 说明 |
|---|---|
| `--version {VERSION}` | 可选一致性校验；传入值必须等于 `package.json` 的 `version` |
| `--skip-dist` | 跳过 `npm run dist`，使用已有 `build/release/` 产物 |
| `--dry-run` | 只打印将执行的上传命令，不执行上传 |

产物输出在 `build/release/` 目录，包含 NSIS 安装版（`OmniPot{VERSION}.exe`）和便携版（`OmniPot{VERSION}-portable.exe`）。

## 注意事项

- 源代码不推送到公开仓库，公开仓库仅用于 GitHub Release 功能。
- release 产物由私有仓库的代码构建，确保构建前测试通过。
