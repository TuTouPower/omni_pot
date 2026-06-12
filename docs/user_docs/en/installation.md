# Installation & Updates

## Download

Visit [GitHub Releases](https://github.com/TuTouPower/omni_pot/releases) to download the installer for your platform.

| Platform | Package | Notes |
|---|---|---|
| Windows | `OmniPot-{version}-windows-setup.exe` | NSIS installer with custom directory support |
| Windows | `OmniPot-{version}-windows-portable.exe` | Portable — double-click to run, no registry |
| macOS | `OmniPot-{version}-macos.dmg` | Universal build for Intel and Apple Silicon |
| Linux | `OmniPot-{version}-linux.AppImage` | No installation required, just make executable and run |

## Installation

### Windows

**Installer**: Double-click the `.exe` and follow the wizard. Desktop and Start Menu shortcuts are created automatically.

**Portable**: Double-click the `.exe` to run directly. No registry entries are written. Config data is stored in `%APPDATA%\omni_pot\` just like the installer version.

### macOS

1. Open the `.dmg` and drag Omni Pot into the Applications folder
2. On first open, macOS may show "cannot verify developer". Go to **System Settings > Privacy & Security** and click "Open Anyway"
3. To use selection translation, grant **Accessibility** permission (System Settings > Privacy & Security > Accessibility)

### Linux

```bash
chmod +x OmniPot-{version}-linux.AppImage
./OmniPot-{version}-linux.AppImage
```

## Auto-Update

Omni Pot checks for updates on startup (can be disabled in settings). When a new version is found, an update window appears with version info, release notes, and a download progress bar.

Click **Update Now** to download and launch the installer in-app.

Update sources:
- Cloudflare CDN (primary)
- GitHub Release (fallback)

Both sources must agree on version and file checksums before the update is pushed.

## Data Directory

User data is stored in:

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\omni_pot\` |
| macOS | `~/Library/Application Support/omni_pot/` |
| Linux | `~/.config/omni_pot/` |

Contents:

| File | Description |
|---|---|
| `config.json` | User settings |
| `history.db` | Translation history |
| `logs/main.log` | Runtime log (max 5 MB per file) |

## Uninstall

- **Windows Installer**: Control Panel > Programs > Omni Pot > Uninstall
- **Windows Portable**: Delete the `.exe` file. To clear config, delete `%APPDATA%\omni_pot\`
- **macOS**: Delete Omni Pot from Applications. To clear config, delete `~/Library/Application Support/omni_pot/`
- **Linux**: Delete the `.AppImage` file. To clear config, delete `~/.config/omni_pot/`
