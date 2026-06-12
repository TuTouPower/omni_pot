# 发布流程

## 仓库结构

| 仓库 | 地址 | 可见性 | 用途 |
|---|---|---|---|
| 源码仓库 | `https://github.com/TuTouPower/omni_pot` | 公开 | 开发、CI、Release 发布 |

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

macOS 为 universal build（同时兼容 Intel + M 系列）。

## 发布步骤

### 1. 确定版本号

版本号定义在 `package.json` 的 `version` 字段，遵循 semver。发布前确认版本号已更新。

### 2. 本地发布

```bash
npm run release:publish
```

脚本会运行 `npm run dist`，生成 `build/release/latest.json`，在源码仓库创建或复用 `v{VERSION}` release，上传 GitHub Release 产物，并同步 Cloudflare R2。

可选参数：

| 参数 | 说明 |
|---|---|
| `--version {VERSION}` | 一致性校验；传入值必须等于 `package.json` 的 `version` |
| `--skip-dist` | 跳过 `npm run dist`，使用已有 `build/release/` 产物 |
| `--dry-run` | 只打印将执行的上传命令，不执行上传 |

### 3. 上传目标

| 目标 | 说明 |
|---|---|
| GitHub Release | 安装包 + latest.json，发布到 `TuTouPower/omni_pot` |
| Cloudflare R2 | 安装包（latest + 版本归档）+ latest.json |

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
      "github_url": "https://github.com/TuTouPower/omni_pot/releases/download/v1.0.0/OmniPot-1.0.0-windows-setup.exe",
      "r2_url": "https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot-1.0.0-windows-setup.exe"
    },
    {
      "os": "windows",
      "type": "portable",
      "filename": "OmniPot-1.0.0-windows-portable.exe",
      ...
    },
    {
      "os": "macos",
      "type": "dmg",
      "filename": "OmniPot-1.0.0-macos.dmg",
      ...
    },
    {
      "os": "linux",
      "type": "appimage",
      "filename": "OmniPot-1.0.0-linux.AppImage",
      ...
    }
  ]
}
```

自动更新从 R2 `latest.json` 拉取，按 `os` / `type` 筛选匹配下载链接。

## 下载链接

> 以 `v1.0.0` 为例。`{version}` = `1.0.0`，`VERSION` = `1.0.0`。

### Windows Setup

| 渠道 | URL |
|---|---|
| GitHub | `https://github.com/TuTouPower/omni_pot/releases/download/v{VERSION}/OmniPot-{version}-windows-setup.exe` |
| Cloudflare | `https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot-{version}-windows-setup.exe` |

### Windows Portable

| 渠道 | URL |
|---|---|
| GitHub | `https://github.com/TuTouPower/omni_pot/releases/download/v{VERSION}/OmniPot-{version}-windows-portable.exe` |
| Cloudflare | `https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot-{version}-windows-portable.exe` |

### macOS

| 渠道 | URL |
|---|---|
| GitHub | `https://github.com/TuTouPower/omni_pot/releases/download/v{VERSION}/OmniPot-{version}-macos.dmg` |
| Cloudflare | `https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot-{version}-macos.dmg` |

### Linux

| 渠道 | URL |
|---|---|
| GitHub | `https://github.com/TuTouPower/omni_pot/releases/download/v{VERSION}/OmniPot-{version}-linux.AppImage` |
| Cloudflare | `https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot-{version}-linux.AppImage` |

### 元数据

| 用途 | URL |
|---|---|
| latest.json（GitHub） | `https://github.com/TuTouPower/omni_pot/releases/download/v{VERSION}/latest.json` |
| latest.json（R2） | `https://downloads.zzzkkkccc.site/omni-pot/latest.json` |

### 浏览页

| 渠道 | URL |
|---|---|
| GitHub Releases | `https://github.com/TuTouPower/omni_pot/releases` |
| R2 latest 目录 | `https://downloads.zzzkkkccc.site/omni-pot/latest/` |

## 注意事项

- 发布前确保构建和测试通过。
- R2 上 `latest/` 始终指向最新版；旧版本归档在 `{version}/` 目录下。
