# 安装与更新

## 下载

前往 [GitHub Releases](https://github.com/TuTouPower/omni_pot/releases) 下载对应平台的安装包。

| 平台 | 安装包 | 说明 |
|---|---|---|
| Windows | `OmniPot-{version}-windows-setup.exe` | NSIS 安装版，支持自定义安装目录 |
| Windows | `OmniPot-{version}-windows-portable.exe` | 便携版，双击即用，不写注册表 |
| macOS | `OmniPot-{version}-macos.dmg` | Universal build，兼容 Intel 和 Apple Silicon |
| Linux | `OmniPot-{version}-linux.AppImage` | 无需安装，赋予执行权限后运行 |

## 安装

### Windows

**安装版**：双击 `.exe`，按向导完成安装。安装后桌面和开始菜单出现快捷方式。

**便携版**：双击 `.exe` 直接运行，不写入系统注册表，配置数据同样存放在 `%APPDATA%\omni_pot\`。

### macOS

1. 打开 `.dmg`，将 Omni Pot 拖入 Applications 文件夹
2. 首次打开时，macOS 可能提示"无法验证开发者"，在 **系统设置 → 隐私与安全性** 中点击"仍要打开"
3. 如需使用划词功能，需授予 **辅助功能** 权限（系统设置 → 隐私与安全性 → 辅助功能）

### Linux

```bash
chmod +x OmniPot-{version}-linux.AppImage
./OmniPot-{version}-linux.AppImage
```

## 自动更新

Omni Pot 启动时自动检查新版本（可在设置中关闭）。发现新版本后弹出更新窗口，显示版本信息、更新日志和下载进度。

点击**立即更新**后，应用内下载并启动安装程序。

更新检查来源：

- Cloudflare CDN（主）
- GitHub Release（备用）

两个来源的版本号和文件校验必须一致才会推送更新。

## 数据目录

Omni Pot 的用户数据统一存放在：

| 平台 | 路径 |
|---|---|
| Windows | `%APPDATA%\omni_pot\` |
| macOS | `~/Library/Application Support/omni_pot/` |
| Linux | `~/.config/omni_pot/` |

目录内容：

| 文件 | 说明 |
|---|---|
| `config.json` | 用户配置 |
| `history.db` | 翻译历史记录 |
| `logs/main.log` | 运行日志（单文件最大 5MB） |

## 卸载

- **Windows 安装版**：控制面板 → 程序和功能 → Omni Pot → 卸载
- **Windows 便携版**：直接删除 `.exe` 文件；如需清除配置，删除 `%APPDATA%\omni_pot\`
- **macOS**：从 Applications 删除 Omni Pot；如需清除配置，删除 `~/Library/Application Support/omni_pot/`
- **Linux**：删除 `.AppImage` 文件；如需清除配置，删除 `~/.config/omni_pot/`
