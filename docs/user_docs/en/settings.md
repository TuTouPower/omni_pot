# Settings

The Settings window can be opened from the system tray menu or via a settings shortcut.

The layout uses a left sidebar navigation + right content area.

## General

### Application

| Setting | Description |
|---|---|
| Launch at Login | Auto-start Omni Pot when you log in |
| Check for Updates on Startup | Automatically check for new versions on launch |
| Local API Port | HTTP API service port (default 20202), requires app restart |
| Interface Language | Omni Pot UI language (Chinese, English, etc.) |

### Appearance

| Setting | Description |
|---|---|
| Theme | Follow System / Light / Dark (3-button segment) |
| Primary Color | Terracotta, Ultramarine, Pine Green, Mustard, Sky Blue (default) |
| Transparent Background | Transparent window background |
| Tray Click Action | Open Settings / Open Translate / None |

## Translation

### Language

| Setting | Description |
|---|---|
| Source Language | Default source, can be set to auto-detect |
| Target Language | Default translation target |
| Second Language | Fallback when detected language matches target |

### Behavior

| Setting | Description |
|---|---|
| Auto Copy | Copy translation to clipboard on success |
| Incremental Translation | New text appends to existing source (default: replace) |
| Dynamic Translation | Auto-translate while typing (1s debounce) |
| Auto Remove Newlines | Normalize incoming text newlines and hyphenation |
| Disable History | Don't save translation records |

### Window

| Setting | Description |
|---|---|
| Window Position | Mouse position / Previous position |
| Remember Window Size | Save user-adjusted width |
| Close on Blur | Auto-close when unfocused (if not pinned) |
| Always on Top | Translation window stays above all others |
| Hide Source Text | Hide source text area for selection translation |
| Hide Language Selector | Hide language swap area |
| Hide Window After Translate | Auto-hide window after translation completes |

## OCR

| Setting | Description |
|---|---|
| Default OCR Engine | Select default OCR service |
| Default OCR Language | Default is auto-detect |
| Auto Remove Newlines | Normalize newlines after recognition (off by default) |
| Auto Copy Result | Copy text to clipboard after recognition (on by default) |

## Hotkeys

Four global hotkey bindings:

| Hotkey | Description |
|---|---|
| Translate | Translates selected text; opens empty input when no text selected |
| Dictionary | Looks up selected text in dictionary |
| OCR | Starts screenshot recognition |
| Screenshot Translation | Starts screenshot translation |

Each hotkey has a Bind/Unbind button. Press Backspace to clear. When a hotkey conflicts with another app, a red warning appears in the status area.

Hotkey display adapts to platform: `Ctrl` on Windows/Linux, `Cmd` on macOS.

## Services

Five tabs manage five service categories:

| Tab | Description |
|---|---|
| Translation | Translation engine instances — enable/disable, reorder |
| Chinese Dictionary | Chinese dictionary service instances |
| English Dictionary | English dictionary service instances |
| OCR | OCR service instances |
| Text-to-Speech | TTS service instances |

Each instance supports: drag-to-reorder, enable/disable, edit config, delete. Multiple instances of the same service can coexist with different configs.

## History

- Translation history table: service icon, source text, source/target language, translation, timestamp
- Toolbar in one row: Enable toggle, search, service filter, time filter, clear button
- Supports pagination, click row to view details and edit
- When the Enable toggle is off, new translations are not recorded and history actions are grayed out

## Backup

- **Backup**: Packages config (excluding secrets) and history into a local zip file
- **Restore**: Restores config and history from a zip backup
- Backup zip can be re-imported; config and history restore correctly
- API keys and other credentials are not included; re-enter after restore

## About

Displays Omni Pot version, links, and diagnostics:

| Item | Description |
|---|---|
| Log Directory | Main process log location, with copy button |
| Settings Directory | User data directory (where config.json lives), with copy button |
| Local API | HTTP API address, with copy button |
| API Token | API authentication token, with copy button |
| Export Log | Packages last 7 days of logs as a zip for bug reports |
