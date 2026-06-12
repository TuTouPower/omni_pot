# 发布流程

## 仓库结构

| 仓库 | 地址 | 可见性 | 用途 |
|---|---|---|---|
| 源码仓库 | `https://github.com/TuTouPower/omni_pot` | 公开 | 开发、CI、测试 |
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

## 产物命名

```
OmniPot-{version}-{os}-{type}.{ext}
```

| 平台 | type | 文件名 | 状态 |
|---|---|---|---|
| Windows | `setup` | `OmniPot-1.0.0-windows-setup.exe` | 已支持 |
| Windows | `portable` | `OmniPot-1.0.0-windows-portable.exe` | 已支持 |
| macOS | `dmg` | `OmniPot-1.0.0-macos.dmg` | 待实现 |
| Linux | `appimage` | `OmniPot-1.0.0-linux.AppImage` | 待实现 |

macOS 为 universal build（同时兼容 Intel + M 系列），一个包即可。

## latest.json 格式 (v2)

```json
{
  "format_version": 2,
  "version": "1.0.0",
  "released_at": "2026-06-12T20:00:00+08:00",
  "files": [
    {
      "os": "windows",
      "type": "setup",
      "filename": "OmniPot-1.0.0-windows-setup.exe",
      "sha256": "...",
      "size": 88456789,
      "github_url": "https://github.com/TuTouPower/omni_pot_release/releases/download/v1.0.0/OmniPot-1.0.0-windows-setup.exe",
      "r2_url": "https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot-1.0.0-windows-setup.exe"
    },
    {
      "os": "windows",
      "type": "portable",
      "filename": "OmniPot-1.0.0-windows-portable.exe",
      ...
    }
  ]
}
```

`format_version` 1→2，`files` 从 `{key: obj}` 改为 `[{os, type, filename, ...}]`，去掉 `versioned_filename`（与 `filename` 合并）。

## 下载渠道

每版 release 有 3 个下载渠道：

| 渠道 | URL |
|---|---|
| GitHub 源码仓库 | `https://github.com/TuTouPower/omni_pot/releases` |
| GitHub 发布仓库 | `https://github.com/TuTouPower/omni_pot_release/releases` |
| Cloudflare R2 | `https://downloads.zzzkkkccc.site/omni-pot/latest/` |

产物上传到上述 3 个渠道 + R2 版本归档。`latest.json` 只记录发布仓库和 R2 的 URL，自动更新从 R2 拉取。`latest.json` 上传到两个 GitHub 仓库和 R2。

## 注意事项

- 源代码在公开仓库，release 产物由源码仓库的代码构建，确保构建前测试通过。
