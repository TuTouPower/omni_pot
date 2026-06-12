# FAQ

## Installation & Launch

### Q: macOS says "cannot verify developer" when opening

macOS restricts unnotarized apps. Go to **System Settings > Privacy & Security**, and in the Security section click "Open Anyway".

### Q: Linux AppImage won't run

Make sure the file has execute permission:

```bash
chmod +x OmniPot-{version}-linux.AppImage
```

### Q: What's the difference between installer and portable?

| Comparison | Installer | Portable |
|---|---|---|
| Installation | Requires install, writes registry | Double-click to run |
| Update | Auto-update replaces files | Auto-update replaces files |
| Config location | `%APPDATA%\omni_pot\` | `%APPDATA%\omni_pot\` |
| Uninstall | Control Panel > Uninstall | Delete the exe file |

Both versions store config data in the same location.

### Q: Hotkeys don't work on Wayland

Electron global hotkeys may be unreliable under Wayland. Alternatives:

- Use the HTTP API (default port 20202)
- Use the system tray menu

---

## Translation

### Q: Translation result is empty or shows an error

1. Check your network connection
2. Go to **Settings > Services > Translation** and test the service
3. Some services require API keys — make sure they're entered correctly

### Q: The translation window disappears too quickly

By default, the window closes when it loses focus (if not pinned). Solutions:

- Click the "Pin" button in the window's top-left corner
- Or disable "Close on Blur" in **Settings > Translation > Window**

### Q: Language detection is inaccurate

Language detection uses a local engine, which may struggle with short text. Manually selecting the source language bypasses this issue.

### Q: How to reorder translation engines?

In **Settings > Services > Translation**, drag service instances to reorder. Results appear in the set order.

---

## Dictionary

### Q: Chinese dictionary shows "Loading"

Chinese Dictionary is a local offline dictionary (86 MB). The database file must exist in the application directory on first use.

### Q: Dictionary window doesn't appear

Make sure the dictionary hotkey is bound (**Settings > Hotkeys > Dictionary**) and that text is selected.

---

## OCR

### Q: Tesseract recognition is inaccurate

Tesseract accuracy depends on image quality and language. Suggestions:

- Ensure the screenshot is clear and text is large enough
- Select the correct language from the engine dropdown
- For Chinese, system OCR (Windows/macOS) is usually more accurate than Tesseract

### Q: System OCR is not available

System OCR is only supported on Windows and macOS. Linux users should use Tesseract.

- Windows: Requires Windows 10+, uses the built-in WinRT OCR engine
- macOS: Uses the system Vision framework

### Q: How to change the screenshot translation target language?

In the screenshot translation window, click the language area ("Auto Detect -> Simplified Chinese") in the bottom action bar to switch. Translation runs automatically after switching.

---

## Settings & Config

### Q: Where is the config file?

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\omni_pot\config.json` |
| macOS | `~/Library/Application Support/omni_pot/config.json` |
| Linux | `~/.config/omni_pot/config.json` |

Also viewable in **Settings > About > Settings Directory**.

### Q: Where are the log files?

In the `logs/main.log` file next to the config directory. You can also click "Export Log" in **Settings > About** to package the last 7 days of logs.

### Q: How to back up settings?

In **Settings > Backup**, click "Backup Now" and choose a save location. The backup includes settings and translation history, but not API keys or other credentials.

### Q: Settings lost after update?

Omni Pot updates do not overwrite user settings. If settings are lost, restore from a backup in **Settings > Backup**.

---

## System Tray

### Q: How to quit Omni Pot?

Omni Pot stays in the system tray; closing all windows does not quit it. Right-click the tray icon and select "Quit".

### Q: Tray icon not showing

- Windows: Check the overflow area on the taskbar
- macOS: Check the right side of the menu bar
- Linux: Make sure your desktop supports system tray (GNOME may need an extension)

### Q: Does clipboard monitoring consume resources?

Clipboard monitoring uses polling with a long interval, so it has minimal system impact. Disable it from the tray menu or settings when not needed.
